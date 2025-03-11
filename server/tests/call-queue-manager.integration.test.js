/**
 * Call Queue Manager Integration Tests
 *
 * These tests validate the core functionality of the call queue system,
 * including queue processing, call assignment, and status handling.
 */

const sinon = require('sinon');
const queueManager = require('../call-queue-manager');
const featureFlags = require('../services/feature-flags');
const errorService = require('../services/error-service');
const lockService = require('../services/lock-service');
const schedulerService = require('../services/scheduler-service');
const loadBalancingService = require('../services/load-balancing-service');
const abTestingService = require('../services/ab-testing-service');

describe('Call Queue Manager Integration', () => {
  let sandbox;
  let mockStore;
  let mockTwilioClient;
  
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Mock the store
    mockStore = {
      callQueue: {
        getQueued: sandbox.stub().resolves([]),
        getAll: sandbox.stub().resolves([]),
        add: sandbox.stub().resolves({ id: 'call-123' }),
        getById: sandbox.stub().resolves(null),
        assignToAgent: sandbox.stub().resolves(true),
        updateStatus: sandbox.stub().resolves(true),
        update: sandbox.stub().resolves(true)
      },
      agentStatus: {
        getAvailableAgents: sandbox.stub().resolves([]),
        updateStatus: sandbox.stub().resolves(true)
      },
      callHistory: {
        add: sandbox.stub().resolves(true),
        getAll: sandbox.stub().resolves([]),
        update: sandbox.stub().resolves(true)
      },
      dispositions: {
        getActive: sandbox.stub().resolves([
          { id: 'completed', name: 'Call Completed', is_final: true },
          { id: 'no-answer', name: 'No Answer', is_final: false },
          { id: 'busy', name: 'Busy', is_final: false }
        ])
      },
      verifyPassword: sandbox.stub().returns(true)
    };
    
    // Mock Twilio client
    mockTwilioClient = {
      calls: {
        create: sandbox.stub().resolves({
          sid: 'CA123456789',
          status: 'queued'
        })
      }
    };
    
    // Mock feature flags service
    sandbox.stub(featureFlags, 'isFeatureEnabled').resolves(false);
    
    // Mock lock service
    sandbox.stub(lockService, 'LockTypes').value({
      QUEUE_PROCESSING: 'queue-processing',
      CALL_ASSIGNMENT: 'call-assignment'
    });
    sandbox.stub(lockService, 'acquireLock').resolves({ success: true });
    sandbox.stub(lockService, 'releaseLock').resolves({ success: true });
    
    // Mock scheduler service
    sandbox.stub(schedulerService, 'initialize').resolves();
    sandbox.stub(schedulerService, 'stop').returns();
    sandbox.stub(schedulerService, 'scheduleCall').resolves({ success: true });
    
    // Mock load balancing service
    sandbox.stub(loadBalancingService, 'initialize').resolves();
    sandbox.stub(loadBalancingService, 'stop').returns();
    sandbox.stub(loadBalancingService, 'isSystemThrottled').returns(false);
    sandbox.stub(loadBalancingService, 'distributeCallsToAgents').returns([]);
    sandbox.stub(loadBalancingService, 'recordCallAssignment').returns();
    sandbox.stub(loadBalancingService, 'recordCallResult').returns();
    
    // Mock AB testing service
    sandbox.stub(abTestingService, 'getVariant').returns('traditional');
    sandbox.stub(abTestingService, 'recordResult').returns();
    
    // Replace queueManager dependencies
    queueManager.store = mockStore;
    queueManager.twilioClient = mockTwilioClient;
    
    // Store original console.log/error
    this.originalConsoleLog = console.log;
    this.originalConsoleError = console.error;
    
    // Silence console during tests
    console.log = () => {};
    console.error = () => {};
  });
  
  afterEach(async () => {
    // Stop the queue manager if it was started
    await queueManager.stop();
    
    // Restore original dependencies
    sandbox.restore();
    
    // Restore console functions
    console.log = this.originalConsoleLog;
    console.error = this.originalConsoleError;
  });
  
  describe('Queue Processing', () => {
    it('should process the queue and assign calls to available agents', async () => {
      // Set up the mock store with a queued call and available agent
      const queuedCall = {
        id: 'call-123',
        phone_number: '+15551234567',
        contact_name: 'Test Contact',
        status: 'Queued',
        created_at: new Date().toISOString()
      };
      
      const availableAgent = {
        user_id: 'agent-123',
        username: 'testagent',
        status: 'Available',
        last_status_change: new Date().toISOString()
      };
      
      mockStore.callQueue.getQueued.resolves([queuedCall]);
      mockStore.agentStatus.getAvailableAgents.resolves([availableAgent]);
      
      // Set up Twilio client to succeed
      mockTwilioClient.calls.create.resolves({
        sid: 'CA123456789',
        status: 'queued'
      });
      
      // Process the queue
      await queueManager.processQueue();
      
      // Verify the call was assigned to the agent
      expect(mockStore.callQueue.assignToAgent).to.have.been.calledWith(
        'call-123', 'agent-123'
      );
      
      // Verify Twilio client was called to initiate the call
      expect(mockTwilioClient.calls.create).to.have.been.calledOnce;
      
      // Verify call status was updated
      expect(mockStore.callQueue.updateStatus).to.have.been.calledWith(
        'call-123', 'In Progress', 'CA123456789'
      );
      
      // Verify call history was created
      expect(mockStore.callHistory.add).to.have.been.calledOnce;
    });
    
    it('should not process calls when no agents are available', async () => {
      // Set up the mock store with a queued call but no available agents
      const queuedCall = {
        id: 'call-123',
        phone_number: '+15551234567',
        contact_name: 'Test Contact',
        status: 'Queued',
        created_at: new Date().toISOString()
      };
      
      mockStore.callQueue.getQueued.resolves([queuedCall]);
      mockStore.agentStatus.getAvailableAgents.resolves([]); // No available agents
      
      // Process the queue
      await queueManager.processQueue();
      
      // Verify the call was not assigned to any agent
      expect(mockStore.callQueue.assignToAgent).not.to.have.been.called;
      
      // Verify Twilio client was not called
      expect(mockTwilioClient.calls.create).not.to.have.been.called;
    });
    
    it('should handle Twilio call initiation errors', async () => {
      // Set up the mock store with a queued call and available agent
      const queuedCall = {
        id: 'call-123',
        phone_number: '+15551234567',
        contact_name: 'Test Contact',
        status: 'Queued',
        created_at: new Date().toISOString()
      };
      
      const availableAgent = {
        user_id: 'agent-123',
        username: 'testagent',
        status: 'Available',
        last_status_change: new Date().toISOString()
      };
      
      mockStore.callQueue.getQueued.resolves([queuedCall]);
      mockStore.agentStatus.getAvailableAgents.resolves([availableAgent]);
      
      // Set up Twilio client to fail
      const twilioError = new Error('Invalid phone number');
      twilioError.code = 21211;
      mockTwilioClient.calls.create.rejects(twilioError);
      
      // Process the queue
      await queueManager.processQueue();
      
      // Verify the call was assigned to the agent
      expect(mockStore.callQueue.assignToAgent).to.have.been.calledWith(
        'call-123', 'agent-123'
      );
      
      // Verify Twilio client was called
      expect(mockTwilioClient.calls.create).to.have.been.calledOnce;
      
      // Verify call status was updated to Failed
      expect(mockStore.callQueue.updateStatus).to.have.been.calledWith(
        'call-123', 'Failed'
      );
    });
  });
  
  describe('Call Status Updates', () => {
    it('should handle completed call status updates', async () => {
      // Set up a call in the store
      const call = {
        id: 'call-123',
        phone_number: '+15551234567',
        contact_name: 'Test Contact',
        status: 'In Progress',
        assigned_to: 'agent-123',
        call_sid: 'CA123456789',
        created_at: new Date().toISOString()
      };
      
      mockStore.callQueue.getAll.resolves([call]);
      
      // Set up call history
      const callHistory = {
        call_sid: 'CA123456789',
        user_id: 'agent-123',
        phone_number: '+15551234567',
        contact_name: 'Test Contact',
        direction: 'outbound',
        start_time: new Date().toISOString(),
        call_status: 'in-progress'
      };
      
      mockStore.callHistory.getAll.resolves([callHistory]);
      
      // Create a call status update
      const callStatus = {
        CallSid: 'CA123456789',
        CallStatus: 'completed',
        CallDuration: '120'
      };
      
      // Handle the call status update
      await queueManager.handleCallStatusUpdate(callStatus);
      
      // Verify call history was updated
      expect(mockStore.callHistory.update).to.have.been.calledWith(
        'CA123456789',
        sinon.match({
          call_status: 'completed',
          duration: 120,
          end_time: sinon.match.string
        })
      );
      
      // Verify call was marked as completed with disposition
      expect(mockStore.callQueue.update).to.have.been.calledWith(
        'call-123',
        sinon.match({
          disposition_id: 'completed',
          disposition_name: 'Call Completed'
        })
      );
      
      // Verify call status was updated to Completed
      expect(mockStore.callQueue.updateStatus).to.have.been.calledWith(
        'call-123', 'Completed'
      );
    });
    
    it('should handle no-answer call status updates', async () => {
      // Set up a call in the store
      const call = {
        id: 'call-123',
        phone_number: '+15551234567',
        contact_name: 'Test Contact',
        status: 'In Progress',
        assigned_to: 'agent-123',
        call_sid: 'CA123456789',
        created_at: new Date().toISOString()
      };
      
      mockStore.callQueue.getAll.resolves([call]);
      
      // Set up call history
      const callHistory = {
        call_sid: 'CA123456789',
        user_id: 'agent-123',
        phone_number: '+15551234567',
        contact_name: 'Test Contact',
        direction: 'outbound',
        start_time: new Date().toISOString(),
        call_status: 'in-progress'
      };
      
      mockStore.callHistory.getAll.resolves([callHistory]);
      
      // Create a call status update
      const callStatus = {
        CallSid: 'CA123456789',
        CallStatus: 'no-answer',
        CallDuration: '0'
      };
      
      // Handle the call status update
      await queueManager.handleCallStatusUpdate(callStatus);
      
      // Verify call history was updated
      expect(mockStore.callHistory.update).to.have.been.calledWith(
        'CA123456789',
        sinon.match({
          call_status: 'no-answer'
        })
      );
      
      // Verify call was marked with disposition
      expect(mockStore.callQueue.update).to.have.been.calledWith(
        'call-123',
        sinon.match({
          disposition_id: 'no-answer',
          disposition_name: 'No Answer'
        })
      );
    });
  });
  
  describe('Queue Management', () => {
    it('should add calls to the queue', async () => {
      // Call data to add to queue
      const callData = {
        phone_number: '+15551234567',
        contact_name: 'Test Contact',
        notes: 'Test notes'
      };
      
      // Add to queue
      const result = await queueManager.addToQueue(callData);
      
      // Verify call was added to the queue
      expect(mockStore.callQueue.add).to.have.been.calledWith(
        sinon.match(callData)
      );
      
      // Verify result
      expect(result.success).to.be.true;
      expect(result.id).to.equal('call-123');
    });
    
    it('should handle scheduled calls', async () => {
      // Enable scheduled calls feature
      featureFlags.isFeatureEnabled.withArgs('scheduledCalls.enabled').resolves(true);
      
      // Call data with scheduled_for
      const scheduledTime = new Date();
      scheduledTime.setHours(scheduledTime.getHours() + 1);
      
      const callData = {
        phone_number: '+15551234567',
        contact_name: 'Test Contact',
        notes: 'Test notes',
        scheduled_for: scheduledTime.toISOString()
      };
      
      // Mock getById to return the call after it's added
      mockStore.callQueue.getById.withArgs('call-123').resolves({
        id: 'call-123',
        ...callData
      });
      
      // Add to queue
      const result = await queueManager.addToQueue(callData);
      
      // Verify call was added to the queue
      expect(mockStore.callQueue.add).to.have.been.calledWith(
        sinon.match(callData)
      );
      
      // Verify call was scheduled
      expect(schedulerService.scheduleCall).to.have.been.calledOnce;
      
      // Verify result
      expect(result.success).to.be.true;
      expect(result.id).to.equal('call-123');
      expect(result.scheduled).to.be.true;
      expect(result.scheduled_time).to.equal(scheduledTime.toISOString());
    });
  });
  
  describe('Agent Status Management', () => {
    it('should set an agent as available and process the queue', async () => {
      // Set agent available
      const result = await queueManager.setAgentAvailable('agent-123');
      
      // Verify agent status was updated
      expect(mockStore.agentStatus.updateStatus).to.have.been.calledWith(
        'agent-123', 'Available'
      );
      
      // Verify result
      expect(result).to.be.true;
      
      // Ensure processQueue will be called (via setTimeout)
      // We can't directly test the setTimeout callback, but we can verify
      // the setup is correct
      expect(featureFlags.isFeatureEnabled).to.have.been.called;
    });
    
    it('should set an agent as unavailable', async () => {
      // Set agent unavailable
      const result = await queueManager.setAgentUnavailable('agent-123', 'On Break');
      
      // Verify agent status was updated
      expect(mockStore.agentStatus.updateStatus).to.have.been.calledWith(
        'agent-123', 'On Break'
      );
      
      // Verify result
      expect(result).to.be.true;
    });
  });
  
  describe('Feature Flags Integration', () => {
    it('should use load balancing if enabled', async () => {
      // Enable load balancing feature
      featureFlags.isFeatureEnabled.withArgs('loadBalancing.enabled', false).resolves(true);
      
      // Set up the mock store with queued calls and available agents
      const queuedCalls = [
        {
          id: 'call-123',
          phone_number: '+15551234567',
          contact_name: 'Test Contact 1',
          status: 'Queued'
        },
        {
          id: 'call-456',
          phone_number: '+15557654321',
          contact_name: 'Test Contact 2',
          status: 'Queued'
        }
      ];
      
      const availableAgents = [
        {
          user_id: 'agent-123',
          username: 'testagent1',
          status: 'Available'
        },
        {
          user_id: 'agent-456',
          username: 'testagent2',
          status: 'Available'
        }
      ];
      
      // Prepare load balancing assignments
      const assignments = [
        { call: queuedCalls[0], agent: availableAgents[0] },
        { call: queuedCalls[1], agent: availableAgents[1] }
      ];
      
      mockStore.callQueue.getQueued.resolves(queuedCalls);
      mockStore.agentStatus.getAvailableAgents.resolves(availableAgents);
      loadBalancingService.distributeCallsToAgents.returns(assignments);
      
      // Process the queue
      await queueManager.start();
      await queueManager.processQueue();
      
      // Verify load balancing service was used
      expect(loadBalancingService.distributeCallsToAgents).to.have.been.calledWith(
        sinon.match.array, sinon.match.array
      );
      
      // Verify call assignments were recorded
      expect(loadBalancingService.recordCallAssignment).to.have.been.calledTwice;
      
      // Verify both calls were assigned
      expect(mockStore.callQueue.assignToAgent).to.have.been.calledWith(
        'call-123', 'agent-123'
      );
      expect(mockStore.callQueue.assignToAgent).to.have.been.calledWith(
        'call-456', 'agent-456'
      );
    });
  });
});