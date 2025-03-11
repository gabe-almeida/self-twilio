// Call Queue Manager for Twilio Dialer Web App
const memoryStore = require('./memory-store');
const twilio = require('twilio');
const workflowManager = require('./workflow-manager');
// For backward compatibility
const rulesManager = workflowManager;
const errorService = require('./services/error-service');
const retryService = require('./services/retry-service');
const failureCategorization = require('./services/failure-categorization-service');
const featureFlags = require('./services/feature-flags');
const lockService = require('./services/lock-service');
const schedulerService = require('./services/scheduler-service');
const loadBalancingService = require('./services/load-balancing-service');
const abTestingService = require('./services/ab-testing-service');
require('dotenv').config();

// Create Twilio client
const createTwilioClient = () => {
  return twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
};

class CallQueueManager {
  constructor() {
    this._store = memoryStore;
    this._twilioClient = createTwilioClient();
    this.processingInterval = null;
    this.callInProgress = new Map(); // Map to track calls in progress by agent ID
    this.instanceId = `queue-manager-${Date.now()}`; // Unique ID for this instance
  }
  
  // Getter for store to allow stubbing in tests
  get store() {
    return this._store;
  }

  // Setter for store to allow stubbing in tests
  set store(value) {
    this._store = value;
  }
  
  // Getter for twilioClient to allow stubbing in tests
  get twilioClient() {
    return this._twilioClient;
  }
  
  // Setter for twilioClient to allow stubbing in tests
  set twilioClient(value) {
    this._twilioClient = value;
  }

  // Start the queue processing
  async start(intervalMs = 5000) {
    console.log('Starting call queue manager');
    
    if (this.processingInterval) {
      this.stop();
    }
    
    // Initialize load balancing service
    const loadBalancingEnabled = await featureFlags.isFeatureEnabled('loadBalancing.enabled', false);
    if (loadBalancingEnabled) {
      console.log('Load balancing is enabled, initializing load balancing service');
      await loadBalancingService.initialize();
    }
    
    // Check if scheduled calls feature is enabled
    const scheduledCallsEnabled = await featureFlags.isFeatureEnabled('scheduledCalls.enabled');
    
    if (scheduledCallsEnabled) {
      console.log('Scheduled calls feature is enabled, initializing scheduler service');
      
      // Initialize the scheduler service with a callback to process scheduled calls
      await schedulerService.initialize(async (callIds) => {
        console.log(`Processing ${callIds.length} scheduled calls`);
        
        // Process each scheduled call
        for (const callId of callIds) {
          // Get the call from the database
          const call = await this.store.callQueue.getById(callId);
          
          if (call && call.status === 'Queued') {
            console.log(`Processing scheduled call ${callId}`);
            
            // Update the call to remove the scheduled_for time
            await this.store.callQueue.update(callId, {
              scheduled_for: null
            });
            
            // Process the call
            this.processQueue();
          }
        }
      });
    } else {
      console.log('Using traditional interval-based queue processing');
      
      // Use traditional interval-based processing
      this.processingInterval = setInterval(() => {
        this.processQueue();
      }, intervalMs);
      
      // Process immediately on start
      this.processQueue();
    }
  }

  // Stop the queue processing
  async stop() {
    console.log('Stopping call queue manager');
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    // Check if scheduled calls feature is enabled
    const scheduledCallsEnabled = await featureFlags.isFeatureEnabled('scheduledCalls.enabled');
    
    if (scheduledCallsEnabled) {
      console.log('Stopping scheduler service');
      schedulerService.stop();
    }
    
    // Check if load balancing is enabled
    const loadBalancingEnabled = await featureFlags.isFeatureEnabled('loadBalancing.enabled', false);
    
    if (loadBalancingEnabled) {
      console.log('Stopping load balancing service');
      loadBalancingService.stop();
    }
  }

  // Process the call queue
  async processQueue() {
    // Check if concurrency control is enabled
    const concurrencyEnabled = await featureFlags.isFeatureEnabled('concurrency.enabled');
    
    // Use lock service if concurrency control is enabled
    if (concurrencyEnabled) {
      // Try to acquire a lock for queue processing
      const lockResult = await lockService.acquireLock(
        lockService.LockTypes.QUEUE_PROCESSING,
        'default',
        this.instanceId
      );
      
      // If we couldn't acquire the lock, return
      if (!lockResult.success) {
        console.log(`Queue processing already in progress: ${lockResult.error}`);
        return;
      }
      
      try {
        // Process the queue with the lock
        await this._processQueueWithLock();
      } finally {
        // Always release the lock when done
        await lockService.releaseLock(
          lockService.LockTypes.QUEUE_PROCESSING,
          'default',
          this.instanceId
        );
      }
    } else {
      // Fall back to the old method if concurrency control is disabled
      await this._processQueueLegacy();
    }
  }
  
  // Legacy queue processing method (for backward compatibility)
  async _processQueueLegacy() {
    // Use a simple flag to prevent concurrent processing
    if (this._isProcessing) {
      return;
    }
    
    this._isProcessing = true;
    
    try {
      await this._processQueueWithLock();
    } finally {
      this._isProcessing = false;
    }
  }
  
  // Process the queue with a lock
  async _processQueueWithLock() {
    try {
      // Check if enhanced error handling is enabled
      const errorHandlingEnabled = await featureFlags.isFeatureEnabled('errorHandling.enabled');
      
      // Process retries if retry feature is enabled
      if (errorHandlingEnabled) {
        await retryService.processRetries(() => this.processQueue());
      }
      
      // Get available agents
      const availableAgents = await this.store.agentStatus.getAvailableAgents();
      
      if (availableAgents.length === 0) {
        console.log('No available agents to process call queue');
        return;
      }
      
      // Filter out agents who already have a call in progress
      const freeAgents = availableAgents.filter(agent => !this.callInProgress.has(agent.user_id));
      
      if (freeAgents.length === 0) {
        console.log('All available agents are currently on calls');
        return;
      }
      
      // Get queued calls
      const queuedCalls = await this.store.callQueue.getQueued();
      
      // Get calls ready for retry if retry feature is enabled
      let retriableCalls = [];
      if (errorHandlingEnabled) {
        retriableCalls = await retryService.getCallsReadyForRetry();
      }
      
      // Combine queued and retriable calls, with retriable calls at the front
      const allCalls = [...retriableCalls, ...queuedCalls];
      
      if (allCalls.length === 0) {
        console.log('No calls in queue to process');
        return;
      }
      
      console.log(`Processing call queue: ${allCalls.length} calls (${retriableCalls.length} retries), ${freeAgents.length} free agents`);
      
      // Check if A/B testing is enabled for call distribution
      const abTestingEnabled = await featureFlags.isFeatureEnabled('abTesting.enabled', false);
      const callDistributionTestEnabled = await featureFlags.isFeatureEnabled('abTesting.tests.callDistribution.enabled', false);
      
      // Get the variant to use (loadBalanced or traditional)
      let distributionVariant = 'loadBalanced'; // Default to load balanced
      
      if (abTestingEnabled && callDistributionTestEnabled) {
        // Generate a unique ID for this distribution round
        const distributionId = `dist-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        
        // Get the variant from A/B testing service
        const variant = abTestingService.getVariant('callDistribution', distributionId);
        
        if (variant) {
          distributionVariant = variant;
          console.log(`A/B testing selected ${distributionVariant} distribution variant`);
        }
      } else {
        // Check if load balancing is enabled
        const loadBalancingEnabled = await featureFlags.isFeatureEnabled('loadBalancing.enabled', false);
        distributionVariant = loadBalancingEnabled ? 'loadBalanced' : 'traditional';
      }
      
      // Use the selected distribution method
      if (distributionVariant === 'loadBalanced') {
        // Use load balancing service to distribute calls
        console.log('Using load balancing to distribute calls');
        
        // Check if system is throttled
        if (loadBalancingService.isSystemThrottled()) {
          console.log('System is throttled, limiting call distribution');
        }
        
        // Get call-agent assignments from load balancing service
        const assignments = loadBalancingService.distributeCallsToAgents(allCalls, freeAgents);
        
        console.log(`Load balancing assigned ${assignments.length} calls to agents`);
        
        // Process each assignment
        for (const { call, agent } of assignments) {
          // Record the assignment in load balancing service
          loadBalancingService.recordCallAssignment(agent.user_id, call);
          
          // Assign the call to the agent
          await this.assignCallToAgent(call, agent);
          
          // Record the assignment in A/B testing service if enabled
          if (abTestingEnabled && callDistributionTestEnabled) {
            abTestingService.recordResult('callDistribution', 'loadBalanced', true, {
              agentId: agent.user_id,
              callId: call.id
            });
          }
        }
      } else {
        // Use traditional first-come, first-served distribution
        console.log('Using traditional call distribution');
        
        // Process each available agent
        for (const agent of freeAgents) {
          // Check if there are any calls left to process
          if (allCalls.length === 0) {
            break;
          }
          
          // Get the next call from the queue
          const nextCall = allCalls.shift();
          
          // Assign the call to the agent
          await this.assignCallToAgent(nextCall, agent);
          
          // Record the assignment in A/B testing service if enabled
          if (abTestingEnabled && callDistributionTestEnabled) {
            abTestingService.recordResult('callDistribution', 'traditional', true, {
              agentId: agent.user_id,
              callId: nextCall.id
            });
          }
        }
      }
    } catch (error) {
      // Use enhanced error handling if enabled
      const errorHandlingEnabled = await featureFlags.isFeatureEnabled('errorHandling.enabled');
      
      if (errorHandlingEnabled) {
        const errorInfo = await errorService.handleError(error, 'call-queue-manager.processQueue');
        console.error('Error processing call queue:', errorInfo);
      } else {
        console.error('Error processing call queue:', error);
      }
    }
  }

  // Assign a call to an agent
  async assignCallToAgent(call, agent) {
    // Check if concurrency control is enabled
    const concurrencyEnabled = await featureFlags.isFeatureEnabled('concurrency.enabled');
    
    // Use lock service if concurrency control is enabled
    if (concurrencyEnabled) {
      // Try to acquire a lock for call assignment
      const lockResult = await lockService.acquireLock(
        lockService.LockTypes.CALL_ASSIGNMENT,
        `agent-${agent.user_id}`,
        this.instanceId
      );
      
      // If we couldn't acquire the lock, return
      if (!lockResult.success) {
        console.log(`Call assignment to agent ${agent.user_id} already in progress: ${lockResult.error}`);
        return;
      }
      
      try {
        // Assign the call with the lock
        await this._assignCallToAgentWithLock(call, agent);
      } finally {
        // Always release the lock when done
        await lockService.releaseLock(
          lockService.LockTypes.CALL_ASSIGNMENT,
          `agent-${agent.user_id}`,
          this.instanceId
        );
      }
    } else {
      // Fall back to the old method if concurrency control is disabled
      await this._assignCallToAgentWithLock(call, agent);
    }
  }
  
  // Assign a call to an agent with a lock
  async _assignCallToAgentWithLock(call, agent) {
    try {
      console.log(`Assigning call ${call.id} to agent ${agent.user_id} (${agent.username})`);
      
      // Update the call in the database
      await this.store.callQueue.assignToAgent(call.id, agent.user_id);
      
      // Mark the agent as having a call in progress
      this.callInProgress.set(agent.user_id, call.id);
      
      // Initiate the call
      const result = await this.initiateCall(call, agent);
      
      // Check if load balancing is enabled
      const loadBalancingEnabled = await featureFlags.isFeatureEnabled('loadBalancing.enabled', false);
      
      if (result.success) {
        console.log(`Call ${call.id} successfully initiated with SID: ${result.callSid}`);
        
        // Update the call with the Twilio call SID
        await this.store.callQueue.updateStatus(call.id, 'In Progress', result.callSid);
        
        // Add to call history
        await this.store.callHistory.add({
          user_id: agent.user_id,
          phone_number: call.phone_number,
          contact_name: call.contact_name,
          direction: 'outbound',
          start_time: new Date().toISOString(),
          call_sid: result.callSid,
          call_status: 'initiated',
          notes: call.notes
        });
        
        // Record successful call assignment in load balancing service if enabled
        if (loadBalancingEnabled) {
          loadBalancingService.recordCallResult(agent.user_id, call, true);
        }
      } else {
        console.error(`Failed to initiate call ${call.id}:`, result.error);
        
        // Record failed call in load balancing service if enabled
        if (loadBalancingEnabled) {
          loadBalancingService.recordCallResult(agent.user_id, call, false);
        }
        
        // Check if enhanced error handling is enabled
        const errorHandlingEnabled = await featureFlags.isFeatureEnabled('errorHandling.enabled');
        
        if (errorHandlingEnabled) {
          // Handle the failed call with the retry service
          await retryService.handleFailedCall(call.id, result, () => this.processQueue());
        } else {
          // Fall back to basic error handling
          await this.store.callQueue.updateStatus(call.id, 'Failed');
        }
        
        // Remove from in-progress tracking
        this.callInProgress.delete(agent.user_id);
      }
    } catch (error) {
      // Check if enhanced error handling is enabled
      const errorHandlingEnabled = await featureFlags.isFeatureEnabled('errorHandling.enabled');
      
      // Check if load balancing is enabled
      const loadBalancingEnabled = await featureFlags.isFeatureEnabled('loadBalancing.enabled', false);
      
      // Record failed call in load balancing service if enabled
      if (loadBalancingEnabled) {
        loadBalancingService.recordCallResult(agent.user_id, call, false);
      }
      
      if (errorHandlingEnabled) {
        const errorInfo = await errorService.handleError(error, 'call-queue-manager.assignCallToAgent');
        console.error(`Error assigning call ${call.id} to agent ${agent.user_id}:`, errorInfo);
        
        // Handle the failed call with the retry service
        await retryService.handleFailedCall(call.id, errorInfo, () => this.processQueue());
      } else {
        console.error(`Error assigning call ${call.id} to agent ${agent.user_id}:`, error);
        
        // Mark the call as failed
        await this.store.callQueue.updateStatus(call.id, 'Failed');
      }
      
      // Remove from in-progress tracking
      this.callInProgress.delete(agent.user_id);
    }
  }

  // Initiate a call using Twilio
  async initiateCall(call, agent) {
    try {
      // Get the default caller ID from environment variables
      const defaultCallerId = process.env.DEFAULT_CALLER_ID || '+19788785223';
      
      // Format the destination number if needed
      let formattedNumber = call.phone_number;
      if (!formattedNumber.startsWith('+') && formattedNumber.replace(/\D/g, '').length === 10) {
        formattedNumber = `+1${formattedNumber.replace(/\D/g, '')}`;
      }
      
      // Get the server base URL
      const serverBaseUrl = process.env.SERVER_BASE_URL || 'http://localhost:3000';
      
      // Create call options
      const callOptions = {
        to: formattedNumber,
        from: defaultCallerId,
        url: `${serverBaseUrl}/voice/outgoing?to=${encodeURIComponent(formattedNumber)}&agentId=${agent.user_id}&callQueueId=${call.id}`,
        statusCallback: `${serverBaseUrl}/api/call-status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST'
      };
      
      console.log('Creating call with options:', JSON.stringify(callOptions, null, 2));
      
      // Create the call using Twilio REST API
      const twilioCall = await this.twilioClient.calls.create(callOptions);
      
      return {
        success: true,
        callSid: twilioCall.sid,
        status: twilioCall.status
      };
    } catch (error) {
      // Check if enhanced error handling is enabled
      const errorHandlingEnabled = await featureFlags.isFeatureEnabled('errorHandling.enabled');
      
      if (errorHandlingEnabled) {
        const errorInfo = await errorService.handleError(error, 'call-queue-manager.initiateCall');
        
        // Get failure categorization
        const failureInfo = failureCategorization.getFailureInfo(error);
        
        console.error('Error initiating call:', errorInfo);
        
        return {
          success: false,
          error: errorInfo.message,
          type: errorInfo.type,
          retryable: errorInfo.retryable,
          failureCategory: failureInfo.category,
          failureDescription: failureInfo.description
        };
      } else {
        console.error('Error initiating call:', error);
        
        return {
          success: false,
          error: error.message
        };
      }
    }
  }

  // Handle call status updates
  async handleCallStatusUpdate(callStatus) {
    try {
      const callSid = callStatus.CallSid;
      const status = callStatus.CallStatus;
      
      console.log(`Call status update for SID ${callSid}: ${status}`);
      
      // Find all calls in the queue
      const calls = await this.store.callQueue.getAll();
      
      // Find the call with matching SID
      const call = calls.find(c => c.call_sid === callSid);
      
      if (!call) {
        console.log(`No call found in queue with SID ${callSid}`);
        return;
      }
      
      const agentId = call.assigned_to;
      
      // Update call history
      const histories = await this.store.callHistory.getAll();
      const history = histories.find(h => h.call_sid === callSid);
      
      if (history) {
        await this.store.callHistory.update(callSid, { call_status: status });
      }
      
      // Map Twilio call status to our disposition system
      let dispositionId = null;
      
      // Get active dispositions
      const activeDispositions = await this.store.dispositions.getActive();
      
      // Map Twilio status to our disposition
      switch (status) {
        case 'completed':
          dispositionId = 'completed';
          break;
        case 'busy':
          dispositionId = 'busy';
          break;
        case 'no-answer':
          dispositionId = 'no-answer';
          break;
        case 'failed':
        case 'canceled':
          // These could map to a different disposition if needed
          dispositionId = 'no-answer';
          break;
      }
      
      // If we have a valid disposition and the call has ended
      if (dispositionId && (status === 'completed' || status === 'busy' || status === 'no-answer' || status === 'failed' || status === 'canceled')) {
        // Call has ended
        console.log(`Call ${callSid} has ended with status: ${status}, mapped to disposition: ${dispositionId}`);
        
        // Get the disposition details
        const disposition = activeDispositions.find(d => d.id === dispositionId);
        
        // Update call duration if available
        if (callStatus.CallDuration && history) {
          await this.store.callHistory.update(callSid, {
            duration: parseInt(callStatus.CallDuration),
            end_time: new Date().toISOString()
          });
        }
        
        // Update the call with the disposition
        await this.store.callQueue.update(call.id, {
          disposition_id: dispositionId,
          disposition_name: disposition ? disposition.name : status
        });
        
        // Check if enhanced error handling is enabled
        const errorHandlingEnabled = await featureFlags.isFeatureEnabled('errorHandling.enabled');
        
        // Check if load balancing is enabled
        const loadBalancingEnabled = await featureFlags.isFeatureEnabled('loadBalancing.enabled', false);
        
        // Record call result in load balancing service if enabled
        if (loadBalancingEnabled && agentId) {
          const duration = callStatus.CallDuration ? parseInt(callStatus.CallDuration) : 0;
          const success = status === 'completed';
          loadBalancingService.recordCallResult(agentId, call, success, duration);
        }
        
        // Check if A/B testing is enabled for call distribution
        const abTestingEnabled = await featureFlags.isFeatureEnabled('abTesting.enabled', false);
        const callDistributionTestEnabled = await featureFlags.isFeatureEnabled('abTesting.tests.callDistribution.enabled', false);
        
        // Record call result in A/B testing service if enabled
        if (abTestingEnabled && callDistributionTestEnabled && agentId) {
          // Determine which variant was used for this call
          // This is a simplification - in a real system, you would store the variant with the call
          // For now, we'll use a heuristic based on the call ID
          const callIdHash = call.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const variant = callIdHash % 2 === 0 ? 'loadBalanced' : 'traditional';
          
          const duration = callStatus.CallDuration ? parseInt(callStatus.CallDuration) : 0;
          const success = status === 'completed';
          
          abTestingService.recordResult('callDistribution', variant, success, {
            duration,
            agentId
          });
        }
        
        // If the call was not completed successfully and error handling is enabled, categorize the failure
        if (status !== 'completed' && errorHandlingEnabled) {
          const failureInfo = failureCategorization.getFailureInfo(null, status);
          
          console.log(`Call ${callSid} failed with category: ${failureInfo.category} - ${failureInfo.description}`);
          
          // Update the call with failure information
          await this.store.callQueue.update(call.id, {
            failure_category: failureInfo.category,
            failure_description: failureInfo.description
          });
          
          // Check if this failure is retryable
          if (failureInfo.retryable && await featureFlags.isFeatureEnabled('errorHandling.retryEnabled')) {
            // Schedule for retry using the retry service
            const retryResult = await retryService.scheduleRetry(call.id, {
              message: failureInfo.description,
              type: errorService.ErrorTypes.CALL_INITIATION_ERROR,
              retryable: true
            });
            
            if (retryResult.success) {
              console.log(`Scheduled retry for call ${call.id} due to ${failureInfo.category}`);
              
              // Remove from in-progress tracking
              if (agentId) {
                this.callInProgress.delete(agentId);
              }
              
              // Process the queue again to assign new calls
              setTimeout(() => this.processQueue(), 1000);
              
              return; // Skip the rest of the processing
            }
          }
        }
        
        // Check if this call is part of a workflow
        if (call.workflow_id) {
          // Process the call disposition in the workflow engine
          console.log(`Processing call ${call.id} with workflow ${call.workflow_id}`);
          const workflowResult = await workflowManager.processCallDisposition({
            ...call,
            disposition: dispositionId,
            disposition_data: disposition,
            duration: callStatus.CallDuration ? parseInt(callStatus.CallDuration) : 0
          });
          
          console.log(`Workflow processing result: ${workflowResult}`);
          
          // If the disposition is final, mark the call as completed
          if (disposition && disposition.is_final) {
            await this.store.callQueue.updateStatus(call.id, 'Completed');
          } else {
            // Otherwise, the workflow will handle rescheduling if needed
            console.log(`Disposition ${dispositionId} is not final, workflow will handle next steps`);
          }
        } else {
          // Special handling for no-answer status based on rules for backward compatibility
          if (dispositionId === 'no-answer' && !errorHandlingEnabled) {
            console.log(`Processing no-answer call ${call.id} according to retry rules`);
            
            // Get updated call data for retry processing
            const updatedCall = {
              ...call,
              retry_count: call.retry_count || 0,
              status: 'Completed',
              disposition: dispositionId
            };
            
            // Process the no-answer call according to rules
            const retryCall = workflowManager.processNoAnswerCall(updatedCall);
            
            if (retryCall) {
              console.log(`Rescheduling call ${call.id} for retry at ${retryCall.scheduled_for}`);
              
              // Update the call in the queue with retry information
              await this.store.callQueue.update(call.id, {
                status: 'Queued',
                retry_count: retryCall.retry_count,
                scheduled_for: retryCall.scheduled_for,
                last_retry: retryCall.last_retry,
                assigned_to: null, // Clear agent assignment
                call_sid: null // Clear call SID
              });
              
              // Log the rescheduling
              console.log(`Call ${call.id} rescheduled for ${retryCall.scheduled_for}`);
            } else {
              // No more retries, mark as completed
              console.log(`Call ${call.id} has reached maximum retries or retry rule is disabled`);
              await this.store.callQueue.updateStatus(call.id, 'Completed');
            }
          } else if (disposition && disposition.is_final) {
            // For final dispositions, mark the call as completed
            await this.store.callQueue.updateStatus(call.id, 'Completed');
          }
        }
        
        // Remove from in-progress tracking
        if (agentId) {
          this.callInProgress.delete(agentId);
        }
        
        // Process the queue again to assign new calls
        setTimeout(() => this.processQueue(), 1000);
      }
    } catch (error) {
      // Check if enhanced error handling is enabled
      const errorHandlingEnabled = await featureFlags.isFeatureEnabled('errorHandling.enabled');
      
      if (errorHandlingEnabled) {
        const errorInfo = await errorService.handleError(error, 'call-queue-manager.handleCallStatusUpdate');
        console.error('Error handling call status update:', errorInfo);
      } else {
        console.error('Error handling call status update:', error);
      }
    }
  }

  // Mark an agent as available
  async setAgentAvailable(userId) {
    try {
      await this.store.agentStatus.updateStatus(userId, 'Available');
      console.log(`Agent ${userId} marked as Available`);
      
      // Process the queue to assign calls
      setTimeout(() => this.processQueue(), 1000);
      
      return true;
    } catch (error) {
      console.error(`Error setting agent ${userId} as available:`, error);
      return false;
    }
  }

  // Mark an agent as unavailable
  async setAgentUnavailable(userId, status = 'Unavailable') {
    try {
      await this.store.agentStatus.updateStatus(userId, status);
      console.log(`Agent ${userId} marked as ${status}`);
      
      // If the agent has a call in progress, we need to handle it
      if (this.callInProgress.has(userId)) {
        const callId = this.callInProgress.get(userId);
        console.log(`Agent ${userId} has call ${callId} in progress while going ${status}`);
        
        // For now, we'll leave the call as is, but in a real system
        // you might want to transfer the call or handle it differently
      }
      
      return true;
    } catch (error) {
      console.error(`Error setting agent ${userId} as ${status}:`, error);
      return false;
    }
  }

  // Add a call to the queue
  async addToQueue(callData) {
    // Check if concurrency control is enabled
    const concurrencyEnabled = await featureFlags.isFeatureEnabled('concurrency.enabled');
    
    // Use lock service if concurrency control is enabled
    if (concurrencyEnabled) {
      // Generate a unique ID for this call data
      const callDataId = `call-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      
      // Try to acquire a lock for adding to queue
      const lockResult = await lockService.acquireLock(
        lockService.LockTypes.QUEUE_PROCESSING,
        `add-${callDataId}`,
        this.instanceId
      );
      
      // If we couldn't acquire the lock, retry with exponential backoff
      if (!lockResult.success) {
        console.log(`Queue add operation already in progress: ${lockResult.error}`);
        
        // Wait a short time and retry
        await new Promise(resolve => setTimeout(resolve, 500));
        return this.addToQueue(callData);
      }
      
      try {
        // Add to queue with the lock
        return await this._addToQueueWithLock(callData);
      } finally {
        // Always release the lock when done
        await lockService.releaseLock(
          lockService.LockTypes.QUEUE_PROCESSING,
          `add-${callDataId}`,
          this.instanceId
        );
      }
    } else {
      // Fall back to the old method if concurrency control is disabled
      return await this._addToQueueWithLock(callData);
    }
  }
  
  // Add a call to the queue with a lock
  async _addToQueueWithLock(callData) {
    try {
      // Check if this call is part of a workflow
      const workflowId = callData.workflow_id;
      const stepId = callData.workflow_step_id;
      
      // Process the call data
      let processedCallData = { ...callData };
      
      // If not part of a workflow, check if there's a matching workflow for new leads
      if (!workflowId && !stepId) {
        console.log('Processing new lead through workflow manager');
        const workflowResult = await workflowManager.processNewLead(callData);
        
        // If a workflow was triggered, use the processed data
        if (workflowResult === true) {
          console.log('New lead processed by workflow');
          return {
            success: true,
            id: null,
            workflow_triggered: true
          };
        } else if (workflowResult) {
          // Use the processed data from the workflow manager
          processedCallData = workflowResult;
          
          // If the call is scheduled for later, log it
          if (processedCallData.scheduled_for) {
            console.log(`New lead scheduled for later call at ${processedCallData.scheduled_for} due to business hours`);
          } else {
            console.log('New lead marked for immediate calling');
          }
        }
      }
      
      // Add the processed call data to the queue
      const result = await this.store.callQueue.add(processedCallData);
      console.log(`Added call to queue with ID: ${result.id}`);
      
      // Check if this is a scheduled call and the scheduler service is enabled
      const scheduledCallsEnabled = await featureFlags.isFeatureEnabled('scheduledCalls.enabled');
      
      if (processedCallData.scheduled_for && scheduledCallsEnabled) {
        // Schedule the call using the scheduler service
        console.log(`Scheduling call ${result.id} for ${processedCallData.scheduled_for}`);
        
        // Get the call with the ID from the database
        const call = await this.store.callQueue.getById(result.id);
        
        // Schedule the call
        const scheduleResult = await schedulerService.scheduleCall(call);
        
        if (scheduleResult.success) {
          console.log(`Call ${result.id} scheduled successfully`);
        } else {
          console.error(`Failed to schedule call ${result.id}:`, scheduleResult.error);
        }
      } else if (!processedCallData.scheduled_for) {
        // Process the queue immediately if not scheduled for later
        setTimeout(() => this.processQueue(), 1000);
      }
      
      return {
        success: true,
        id: result.id,
        scheduled: !!processedCallData.scheduled_for,
        scheduled_time: processedCallData.scheduled_for
      };
    } catch (error) {
      // Use enhanced error handling if enabled
      const errorHandlingEnabled = await featureFlags.isFeatureEnabled('errorHandling.enabled');
      
      if (errorHandlingEnabled) {
        const errorInfo = await errorService.handleError(error, 'call-queue-manager.addToQueue');
        console.error('Error adding call to queue:', errorInfo);
        
        return {
          success: false,
          error: errorInfo.message
        };
      } else {
        console.error('Error adding call to queue:', error);
        
        return {
          success: false,
          error: error.message
        };
      }
    }
  }
}

// Create a singleton instance
const queueManager = new CallQueueManager();

module.exports = queueManager;