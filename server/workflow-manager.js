// Workflow Manager for Twilio Dialer Web App
const memoryStore = require('./memory-store');

class WorkflowManager {
  constructor() {
    this.store = memoryStore;
    this.scheduledTasks = new Map();
    this.processingInterval = null;
  }

  // Getter for store to allow stubbing in tests
  get store() {
    return this._store;
  }

  // Setter for store to allow stubbing in tests
  set store(value) {
    this._store = value;
  }

  // Start the workflow manager
  start(intervalMs = 60000) {
    console.log('Starting workflow manager');
    
    if (this.processingInterval) {
      this.stop();
    }
    
    this.processingInterval = setInterval(() => {
      this.processScheduledTasks();
    }, intervalMs);
    
    // Process immediately on start
    this.processScheduledTasks();
  }

  // Stop the workflow manager
  stop() {
    console.log('Stopping workflow manager');
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  // Process scheduled tasks
  async processScheduledTasks() {
    try {
      const now = new Date();
      
      // Find tasks that are due
      const dueTasks = [];
      for (const [taskId, task] of this.scheduledTasks.entries()) {
        if (new Date(task.executeAt) <= now) {
          dueTasks.push({ taskId, task });
        }
      }
      
      if (dueTasks.length > 0) {
        console.log(`Processing ${dueTasks.length} scheduled tasks`);
      }
      
      // Process due tasks
      for (const { taskId, task } of dueTasks) {
        this.scheduledTasks.delete(taskId);
        
        try {
          await this.executeTask(task);
        } catch (error) {
          console.error(`Error executing task ${taskId}:`, error);
        }
      }
    } catch (error) {
      console.error('Error processing scheduled tasks:', error);
    }
  }

  // Schedule a task for future execution
  scheduleTask(workflowId, stepId, context, executeAt) {
    const taskId = `${workflowId}_${stepId}_${Date.now()}`;
    
    this.scheduledTasks.set(taskId, {
      workflowId,
      stepId,
      context,
      executeAt: executeAt.toISOString()
    });
    
    console.log(`Scheduled task ${taskId} for ${executeAt}`);
    
    return taskId;
  }

  // Execute a scheduled task
  async executeTask(task) {
    const { workflowId, stepId, context } = task;
    
    // Get the workflow
    const workflow = await this.store.workflows.getById(workflowId);
    
    if (!workflow || !workflow.active) {
      console.log(`Workflow ${workflowId} not found or inactive, cancelling task`);
      return;
    }
    
    // Find the step
    const step = workflow.steps.find(s => s.id === stepId);
    
    if (!step) {
      console.log(`Step ${stepId} not found in workflow ${workflowId}, cancelling task`);
      return;
    }
    
    // Execute the step
    await this.executeWorkflowStep(workflow, step, context);
  }

  // Process a new lead trigger
  async processNewLead(leadData) {
    // Find active workflows with new lead trigger
    const workflows = await this.store.workflows.getActive();
    const matchingWorkflows = workflows.filter(workflow =>
      workflow.triggers.some(trigger => trigger.type === 'new_lead')
    );
    
    if (matchingWorkflows.length === 0) {
      console.log('No active workflows found for new lead trigger');
      return null;
    }
    
    console.log(`Found ${matchingWorkflows.length} active workflows for new lead trigger`);
    
    // Start each matching workflow
    for (const workflow of matchingWorkflows) {
      await this.startWorkflow(workflow, { lead: leadData });
    }
    
    return true;
  }

  // Process a call disposition trigger
  async processCallDisposition(callData) {
    // Get the disposition details
    const dispositionId = callData.disposition;
    const dispositionData = callData.disposition_data || await this.store.dispositions.getById(dispositionId);
    
    if (!dispositionId) {
      console.log('No disposition ID provided for call');
      return null;
    }
    
    console.log(`Processing call disposition: ${dispositionId}`);
    
    // Check if the disposition is final
    if (dispositionData && dispositionData.is_final) {
      console.log(`Disposition ${dispositionId} is final, no further processing needed`);
      return true;
    }
    
    // Find active workflows with call disposition trigger
    const workflows = await this.store.workflows.getActive();
    const matchingWorkflows = workflows.filter(workflow =>
      workflow.triggers.some(trigger =>
        trigger.type === 'call_disposition' &&
        (!trigger.disposition || trigger.disposition === dispositionId)
      )
    );
    
    if (matchingWorkflows.length === 0) {
      console.log(`No active workflows found for call disposition ${dispositionId}`);
      return null;
    }
    
    console.log(`Found ${matchingWorkflows.length} active workflows for call disposition ${dispositionId}`);
    
    // Start each matching workflow
    for (const workflow of matchingWorkflows) {
      await this.startWorkflow(workflow, {
        call: callData,
        disposition: {
          id: dispositionId,
          ...dispositionData
        }
      });
    }
    
    return true;
  }

  // Process campaign membership change trigger
  async processCampaignMembershipChange(data) {
    console.log(`[DEBUG] [CAMPAIGN MEMBERSHIP] Processing campaign membership change with data:`, JSON.stringify(data));
    
    const { campaign_id, lead_id, action } = data;
    
    if (!campaign_id || !lead_id || !action) {
      console.error(`[ERROR] [CAMPAIGN MEMBERSHIP] Missing required data for campaign membership change. campaign_id=${campaign_id}, lead_id=${lead_id}, action=${action}`);
      return null;
    }
    
    console.log(`[INFO] [CAMPAIGN MEMBERSHIP] Processing campaign membership change: ${action} for lead ${lead_id} in campaign ${campaign_id}`);
    
    try {
      // Find active workflows with campaign membership trigger
      console.log(`[DEBUG] [CAMPAIGN MEMBERSHIP] Fetching active workflows`);
      const workflows = await this.store.workflows.getActive();
      console.log(`[DEBUG] [CAMPAIGN MEMBERSHIP] Found ${workflows.length} active workflows total`);
      
      // Filter workflows with matching triggers
      const matchingWorkflows = workflows.filter(workflow => {
        const hasMatchingTrigger = workflow.triggers.some(trigger =>
          trigger.type === 'campaign_membership' &&
          (!trigger.campaign_id || trigger.campaign_id === campaign_id) &&
          (!trigger.action || trigger.action === action)
        );
        
        if (hasMatchingTrigger) {
          console.log(`[DEBUG] [CAMPAIGN MEMBERSHIP] Workflow ${workflow.id} has matching trigger for campaign ${campaign_id}, action ${action}`);
        }
        
        return hasMatchingTrigger;
      });
      
      if (matchingWorkflows.length === 0) {
        console.log(`[INFO] [CAMPAIGN MEMBERSHIP] No active workflows found for campaign membership change`);
        return null;
      }
      
      console.log(`[INFO] [CAMPAIGN MEMBERSHIP] Found ${matchingWorkflows.length} active workflows for campaign membership change`);
      console.log(`[DEBUG] [CAMPAIGN MEMBERSHIP] Matching workflow IDs: ${matchingWorkflows.map(w => w.id).join(', ')}`);
      
      // Get the lead and campaign
      console.log(`[DEBUG] [CAMPAIGN MEMBERSHIP] Fetching lead ${lead_id} details`);
      const lead = await this.store.callQueue.getById(lead_id);
      console.log(`[DEBUG] [CAMPAIGN MEMBERSHIP] Lead found: ${!!lead}`);
      
      console.log(`[DEBUG] [CAMPAIGN MEMBERSHIP] Fetching campaign ${campaign_id} details`);
      const campaign = await this.store.campaigns.getById(campaign_id);
      console.log(`[DEBUG] [CAMPAIGN MEMBERSHIP] Campaign found: ${!!campaign}`);
      
      if (!lead || !campaign) {
        console.error(`[ERROR] [CAMPAIGN MEMBERSHIP] Lead or campaign not found. lead=${!!lead}, campaign=${!!campaign}`);
        return null;
      }
      
      // Start each matching workflow
      console.log(`[DEBUG] [CAMPAIGN MEMBERSHIP] Starting ${matchingWorkflows.length} workflows for campaign membership change`);
      
      for (const workflow of matchingWorkflows) {
        console.log(`[DEBUG] [CAMPAIGN MEMBERSHIP] Starting workflow ${workflow.id} for campaign membership change`);
        
        const context = {
          lead,
          campaign,
          action
        };
        
        console.log(`[DEBUG] [CAMPAIGN MEMBERSHIP] Workflow context:`, JSON.stringify(context, (key, value) => {
          // Avoid circular references and limit large objects
          if (typeof value === 'object' && value !== null) {
            return Object.keys(value).length > 20 ? '[Large Object]' : value;
          }
          return value;
        }));
        
        await this.startWorkflow(workflow, context);
        console.log(`[DEBUG] [CAMPAIGN MEMBERSHIP] Successfully started workflow ${workflow.id}`);
      }
      
      console.log(`[INFO] [CAMPAIGN MEMBERSHIP] Successfully processed campaign membership change for lead ${lead_id} in campaign ${campaign_id}`);
      return true;
    } catch (error) {
      console.error(`[ERROR] [CAMPAIGN MEMBERSHIP] Error processing campaign membership change:`, error);
      console.error(`[ERROR] [CAMPAIGN MEMBERSHIP] Error details: ${error.message}`);
      console.error(`[ERROR] [CAMPAIGN MEMBERSHIP] Stack trace: ${error.stack}`);
      return null;
    }
  }

  // Process campaign refresh trigger
  async processCampaignRefresh(campaignId) {
    console.log(`[DEBUG] [CAMPAIGN REFRESH] Processing campaign refresh for campaign ID: ${campaignId}`);
    
    if (!campaignId) {
      console.error(`[ERROR] [CAMPAIGN REFRESH] No campaign ID provided for refresh`);
      return null;
    }
    
    console.log(`[INFO] [CAMPAIGN REFRESH] Processing campaign refresh for campaign ${campaignId}`);
    
    try {
      // Find active workflows with campaign refresh trigger
      console.log(`[DEBUG] [CAMPAIGN REFRESH] Fetching active workflows`);
      const workflows = await this.store.workflows.getActive();
      console.log(`[DEBUG] [CAMPAIGN REFRESH] Found ${workflows.length} active workflows total`);
      
      // Filter workflows with matching triggers
      const matchingWorkflows = workflows.filter(workflow => {
        const hasMatchingTrigger = workflow.triggers.some(trigger =>
          trigger.type === 'campaign_refresh' &&
          (!trigger.campaign_id || trigger.campaign_id === campaignId)
        );
        
        if (hasMatchingTrigger) {
          console.log(`[DEBUG] [CAMPAIGN REFRESH] Workflow ${workflow.id} has matching trigger for campaign ${campaignId}`);
        }
        
        return hasMatchingTrigger;
      });
      
      if (matchingWorkflows.length === 0) {
        console.log(`[INFO] [CAMPAIGN REFRESH] No active workflows found for campaign refresh`);
        return null;
      }
      
      console.log(`[INFO] [CAMPAIGN REFRESH] Found ${matchingWorkflows.length} active workflows for campaign refresh`);
      console.log(`[DEBUG] [CAMPAIGN REFRESH] Matching workflow IDs: ${matchingWorkflows.map(w => w.id).join(', ')}`);
      
      // Get the campaign
      console.log(`[DEBUG] [CAMPAIGN REFRESH] Fetching campaign ${campaignId} details`);
      const campaign = await this.store.campaigns.getById(campaignId);
      console.log(`[DEBUG] [CAMPAIGN REFRESH] Campaign found: ${!!campaign}`);
      
      if (!campaign) {
        console.error(`[ERROR] [CAMPAIGN REFRESH] Campaign ${campaignId} not found`);
        return null;
      }
      
      // Start each matching workflow
      console.log(`[DEBUG] [CAMPAIGN REFRESH] Starting ${matchingWorkflows.length} workflows for campaign refresh`);
      
      for (const workflow of matchingWorkflows) {
        console.log(`[DEBUG] [CAMPAIGN REFRESH] Starting workflow ${workflow.id} for campaign refresh`);
        
        const context = { campaign };
        
        console.log(`[DEBUG] [CAMPAIGN REFRESH] Workflow context:`, JSON.stringify(context, (key, value) => {
          // Avoid circular references and limit large objects
          if (typeof value === 'object' && value !== null) {
            return Object.keys(value).length > 20 ? '[Large Object]' : value;
          }
          return value;
        }));
        
        await this.startWorkflow(workflow, context);
        console.log(`[DEBUG] [CAMPAIGN REFRESH] Successfully started workflow ${workflow.id}`);
      }
      
      console.log(`[INFO] [CAMPAIGN REFRESH] Successfully processed campaign refresh for campaign ${campaignId}`);
      return true;
    } catch (error) {
      console.error(`[ERROR] [CAMPAIGN REFRESH] Error processing campaign refresh:`, error);
      console.error(`[ERROR] [CAMPAIGN REFRESH] Error details: ${error.message}`);
      console.error(`[ERROR] [CAMPAIGN REFRESH] Stack trace: ${error.stack}`);
      return null;
    }
  }

  // Start a workflow
  async startWorkflow(workflow, context) {
    console.log(`[DEBUG] [WORKFLOW START] Starting workflow ${workflow.id}: ${workflow.name}`);
    console.log(`[DEBUG] [WORKFLOW START] Initial context:`, JSON.stringify(context, (key, value) => {
      // Avoid circular references and limit large objects
      if (typeof value === 'object' && value !== null) {
        return Object.keys(value).length > 20 ? '[Large Object]' : value;
      }
      return value;
    }));
    
    try {
      // Find the start step
      console.log(`[DEBUG] [WORKFLOW START] Finding start step for workflow ${workflow.id}`);
      const startStep = workflow.steps.find(step => step.isStart || step.type === 'start');
      
      if (!startStep) {
        console.error(`[ERROR] [WORKFLOW START] Workflow ${workflow.id} has no start step`);
        return false;
      }
      
      console.log(`[DEBUG] [WORKFLOW START] Found start step ${startStep.id} for workflow ${workflow.id}`);
      
      // Execute the start step
      console.log(`[INFO] [WORKFLOW START] Executing start step ${startStep.id} for workflow ${workflow.id}`);
      await this.executeWorkflowStep(workflow, startStep, context);
      
      console.log(`[DEBUG] [WORKFLOW START] Successfully started workflow ${workflow.id}`);
      return true;
    } catch (error) {
      console.error(`[ERROR] [WORKFLOW START] Error starting workflow ${workflow.id}:`, error);
      console.error(`[ERROR] [WORKFLOW START] Error details: ${error.message}`);
      console.error(`[ERROR] [WORKFLOW START] Stack trace: ${error.stack}`);
      return false;
    }
  }

  // Execute a workflow step
  async executeWorkflowStep(workflow, step, context) {
    console.log(`[DEBUG] [WORKFLOW STEP] Executing step ${step.id} (${step.type}) in workflow ${workflow.id}`);
    console.log(`[DEBUG] [WORKFLOW STEP] Step details:`, JSON.stringify(step, (key, value) => {
      // Avoid circular references and limit large objects
      if (typeof value === 'object' && value !== null) {
        return Object.keys(value).length > 20 ? '[Large Object]' : value;
      }
      return value;
    }));
    console.log(`[DEBUG] [WORKFLOW STEP] Context:`, JSON.stringify(context, (key, value) => {
      // Avoid circular references and limit large objects
      if (typeof value === 'object' && value !== null) {
        return Object.keys(value).length > 20 ? '[Large Object]' : value;
      }
      return value;
    }));
    
    try {
      // Execute based on step type
      console.log(`[INFO] [WORKFLOW STEP] Routing step ${step.id} to handler for type: ${step.type}`);
      let result;
      
      switch (step.type) {
        case 'start':
          console.log(`[DEBUG] [WORKFLOW STEP] Executing start step ${step.id}`);
          result = await this.executeNextStep(workflow, step, context);
          break;
        case 'call':
          console.log(`[DEBUG] [WORKFLOW STEP] Executing call step ${step.id}`);
          result = await this.executeCallStep(workflow, step, context);
          break;
        case 'wait':
          console.log(`[DEBUG] [WORKFLOW STEP] Executing wait step ${step.id}`);
          result = await this.executeWaitStep(workflow, step, context);
          break;
        case 'condition':
          console.log(`[DEBUG] [WORKFLOW STEP] Executing condition step ${step.id}`);
          result = await this.executeConditionStep(workflow, step, context);
          break;
        case 'sms':
          console.log(`[DEBUG] [WORKFLOW STEP] Executing SMS step ${step.id}`);
          result = await this.executeSmsStep(workflow, step, context);
          break;
        case 'campaign':
          console.log(`[DEBUG] [WORKFLOW STEP] Executing campaign action step ${step.id}`);
          result = await this.executeCampaignAction(workflow, step, context);
          break;
        case 'end':
          console.log(`[DEBUG] [WORKFLOW STEP] Executing end step ${step.id}`);
          result = await this.executeEndStep(workflow, step, context);
          break;
        default:
          console.error(`[ERROR] [WORKFLOW STEP] Unknown step type: ${step.type} for step ${step.id}`);
          return false;
      }
      
      console.log(`[DEBUG] [WORKFLOW STEP] Step ${step.id} execution result: ${result}`);
      return result;
    } catch (error) {
      console.error(`[ERROR] [WORKFLOW STEP] Error executing step ${step.id} (${step.type}):`, error);
      console.error(`[ERROR] [WORKFLOW STEP] Error details: ${error.message}`);
      console.error(`[ERROR] [WORKFLOW STEP] Stack trace: ${error.stack}`);
      return false;
    }
  }

  // Execute the next step in the workflow
  async executeNextStep(workflow, currentStep, context, branchKey = 'next_step') {
    console.log(`[DEBUG] [NEXT STEP] Finding next step from ${currentStep.id} using branch key: ${branchKey}`);
    
    const nextStepId = currentStep[branchKey];
    console.log(`[DEBUG] [NEXT STEP] Next step ID: ${nextStepId || 'none'}`);
    
    if (!nextStepId) {
      console.log(`[INFO] [NEXT STEP] Workflow ${workflow.id} completed at step ${currentStep.id} (no next step defined)`);
      return true;
    }
    
    try {
      console.log(`[DEBUG] [NEXT STEP] Looking up step with ID ${nextStepId} in workflow ${workflow.id}`);
      const nextStep = workflow.steps.find(step => step.id === nextStepId);
      
      if (!nextStep) {
        console.error(`[ERROR] [NEXT STEP] Next step ${nextStepId} not found in workflow ${workflow.id}`);
        console.error(`[ERROR] [NEXT STEP] Available step IDs: ${workflow.steps.map(s => s.id).join(', ')}`);
        return false;
      }
      
      console.log(`[DEBUG] [NEXT STEP] Found next step ${nextStep.id} of type ${nextStep.type}`);
      console.log(`[INFO] [NEXT STEP] Transitioning from step ${currentStep.id} to step ${nextStep.id} in workflow ${workflow.id}`);
      
      return this.executeWorkflowStep(workflow, nextStep, context);
    } catch (error) {
      console.error(`[ERROR] [NEXT STEP] Error finding or executing next step:`, error);
      console.error(`[ERROR] [NEXT STEP] Error details: ${error.message}`);
      console.error(`[ERROR] [NEXT STEP] Stack trace: ${error.stack}`);
      return false;
    }
  }

  // Execute a call step
  async executeCallStep(workflow, step, context) {
    console.log(`[DEBUG] [CALL STEP] Starting execution of call step ${step.id} in workflow ${workflow.id}`);
    console.log(`[DEBUG] [CALL STEP] Step properties:`, JSON.stringify(step.properties || {}));
    console.log(`[DEBUG] [CALL STEP] Context:`, JSON.stringify(context, (key, value) => {
      // Avoid circular references and limit large objects
      if (typeof value === 'object' && value !== null) {
        return Object.keys(value).length > 20 ? '[Large Object]' : value;
      }
      return value;
    }));
    
    try {
      const queueManager = require('./call-queue-manager');
      const { lead } = context;
      
      console.log(`[DEBUG] [CALL STEP] Extracting phone number from context`);
      
      // Get phone number from context
      let phoneNumber;
      let contactName;
      let notes;
      
      if (lead) {
        console.log(`[DEBUG] [CALL STEP] Found lead in context, extracting contact details`);
        phoneNumber = lead.phone_number;
        contactName = lead.contact_name;
        notes = lead.notes;
      } else if (context.call) {
        console.log(`[DEBUG] [CALL STEP] Found call in context, extracting contact details`);
        phoneNumber = context.call.phone_number;
        contactName = context.call.contact_name;
        notes = context.call.notes;
      }
      
      if (!phoneNumber) {
        console.error(`[ERROR] [CALL STEP] Call step requires a phone number in context`);
        console.error(`[ERROR] [CALL STEP] Available context keys: ${Object.keys(context).join(', ')}`);
        return false;
      }
      
      console.log(`[DEBUG] [CALL STEP] Phone number found: ${phoneNumber}`);
      
      // Prepare call data
      const callData = {
        phone_number: phoneNumber,
        contact_name: contactName || null,
        notes: notes || null,
        priority: step.properties?.priority || 1,
        workflow_id: workflow.id,
        workflow_step_id: step.id
      };
      
      console.log(`[DEBUG] [CALL STEP] Prepared call data:`, JSON.stringify(callData));
      
      // Check if we're within business hours
      if (workflow.business_hours?.enabled) {
        console.log(`[DEBUG] [CALL STEP] Checking business hours constraints`);
        const isWithinHours = this.isWithinBusinessHours(workflow.business_hours);
        console.log(`[DEBUG] [CALL STEP] Current time is ${isWithinHours ? 'within' : 'outside'} business hours`);
        
        if (!isWithinHours) {
          // Schedule for the next business hours start time
          const nextBusinessTime = this.getNextBusinessHoursStartTime(new Date(), workflow.business_hours);
          callData.scheduled_for = nextBusinessTime.toISOString();
          console.log(`[INFO] [CALL STEP] Scheduling call for next business hours: ${nextBusinessTime}`);
        }
      }
      
      // Add to queue
      console.log(`[DEBUG] [CALL STEP] Adding call to queue`);
      const result = await queueManager.addToQueue(callData);
      
      if (!result.success) {
        console.error(`[ERROR] [CALL STEP] Failed to add call to queue: ${result.error}`);
        return false;
      }
      
      console.log(`[DEBUG] [CALL STEP] Successfully added call to queue with ID: ${result.id}`);
      
      // Update context with call information
      context.call = {
        id: result.id,
        status: 'queued',
        scheduled_for: result.scheduled_time
      };
      
      console.log(`[DEBUG] [CALL STEP] Updated context with call information:`, JSON.stringify(context.call));
      
      // If the call is scheduled for later, we need to schedule the next step
      if (result.scheduled) {
        console.log(`[INFO] [CALL STEP] Call scheduled for ${result.scheduled_time}, workflow will continue when call is made`);
        return true;
      }
      
      // Move to next step
      console.log(`[DEBUG] [CALL STEP] Call queued for immediate execution, moving to next step`);
      return this.executeNextStep(workflow, step, context);
    } catch (error) {
      console.error(`[ERROR] [CALL STEP] Error executing call step:`, error);
      console.error(`[ERROR] [CALL STEP] Error details: ${error.message}`);
      console.error(`[ERROR] [CALL STEP] Stack trace: ${error.stack}`);
      return false;
    }
  }

  // Execute a wait step
  async executeWaitStep(workflow, step, context) {
    console.log(`[DEBUG] [WAIT STEP] Starting execution of wait step ${step.id} in workflow ${workflow.id}`);
    console.log(`[DEBUG] [WAIT STEP] Step properties:`, JSON.stringify(step.properties || {}));
    console.log(`[DEBUG] [WAIT STEP] Context:`, JSON.stringify(context, (key, value) => {
      // Avoid circular references and limit large objects
      if (typeof value === 'object' && value !== null) {
        return Object.keys(value).length > 20 ? '[Large Object]' : value;
      }
      return value;
    }));
    
    try {
      // Get wait properties with defaults
      const { minutes, respect_hours } = step.properties || { minutes: 30, respect_hours: true };
      console.log(`[DEBUG] [WAIT STEP] Wait duration: ${minutes} minutes, respect business hours: ${respect_hours}`);
      
      if (!minutes || minutes <= 0) {
        console.error(`[ERROR] [WAIT STEP] Wait step requires a positive number of minutes, got: ${minutes}`);
        return false;
      }
      
      // Calculate wait time
      const now = new Date();
      console.log(`[DEBUG] [WAIT STEP] Current time: ${now.toISOString()}`);
      
      let waitUntil = new Date(now.getTime() + minutes * 60000);
      console.log(`[DEBUG] [WAIT STEP] Initial wait until time: ${waitUntil.toISOString()}`);
      
      // Respect business hours if configured
      if (respect_hours && workflow.business_hours?.enabled) {
        console.log(`[DEBUG] [WAIT STEP] Adjusting for business hours`);
        console.log(`[DEBUG] [WAIT STEP] Business hours:`, JSON.stringify(workflow.business_hours));
        
        waitUntil = this.adjustForBusinessHours(waitUntil, workflow.business_hours);
        console.log(`[DEBUG] [WAIT STEP] Adjusted wait until time: ${waitUntil.toISOString()}`);
      }
      
      console.log(`[INFO] [WAIT STEP] Scheduling next step for ${waitUntil.toISOString()}`);
      
      // Schedule next step execution
      const taskId = this.scheduleTask(workflow.id, step.next_step, context, waitUntil);
      console.log(`[DEBUG] [WAIT STEP] Created scheduled task with ID: ${taskId}`);
      
      console.log(`[DEBUG] [WAIT STEP] Successfully scheduled next step execution`);
      return true;
    } catch (error) {
      console.error(`[ERROR] [WAIT STEP] Error executing wait step:`, error);
      console.error(`[ERROR] [WAIT STEP] Error details: ${error.message}`);
      console.error(`[ERROR] [WAIT STEP] Stack trace: ${error.stack}`);
      return false;
    }
  }

  // Execute a condition step
  async executeConditionStep(workflow, step, context) {
    console.log(`[DEBUG] [CONDITION STEP] Starting execution of condition step ${step.id} in workflow ${workflow.id}`);
    console.log(`[DEBUG] [CONDITION STEP] Step condition:`, JSON.stringify(step.condition || {}));
    console.log(`[DEBUG] [CONDITION STEP] Context:`, JSON.stringify(context, (key, value) => {
      // Avoid circular references and limit large objects
      if (typeof value === 'object' && value !== null) {
        return Object.keys(value).length > 20 ? '[Large Object]' : value;
      }
      return value;
    }));
    
    try {
      const { field, operator, value } = step.condition || {};
      console.log(`[DEBUG] [CONDITION STEP] Evaluating condition: ${field} ${operator} ${value}`);
      
      if (!field || !operator) {
        console.error(`[ERROR] [CONDITION STEP] Condition step requires field and operator. field=${field}, operator=${operator}`);
        return false;
      }
      
      // Special handling for disposition conditions
      if (field === 'call.disposition' || field === 'disposition.id') {
        console.log(`[DEBUG] [CONDITION STEP] Processing disposition condition`);
        
        // Get the disposition ID from context
        const dispositionId = field === 'call.disposition'
          ? this.getFieldFromContext(context, 'call.disposition')
          : this.getFieldFromContext(context, 'disposition.id');
        
        console.log(`[DEBUG] [CONDITION STEP] Disposition ID from context: ${dispositionId}`);
        
        // If we're checking for a specific disposition
        if (operator === 'equals' || operator === 'not_equals') {
          console.log(`[DEBUG] [CONDITION STEP] Checking disposition with ${operator} operator`);
          
          // Get all active dispositions
          console.log(`[DEBUG] [CONDITION STEP] Fetching active dispositions`);
          const dispositions = await this.store.dispositions.getActive();
          console.log(`[DEBUG] [CONDITION STEP] Found ${dispositions.length} active dispositions`);
          
          // Find the disposition
          const disposition = dispositions.find(d => d.id === dispositionId);
          console.log(`[DEBUG] [CONDITION STEP] Disposition found: ${!!disposition}`);
          
          // If checking for a final disposition
          if (value === 'final' || value === 'is_final') {
            console.log(`[DEBUG] [CONDITION STEP] Checking if disposition is final`);
            const isFinal = disposition && disposition.is_final;
            const result = operator === 'equals' ? isFinal : !isFinal;
            
            console.log(`[INFO] [CONDITION STEP] Condition ${field} ${operator} ${value} (is_final) evaluated to ${result}`);
            
            // Follow the appropriate branch
            const branchKey = result ? 'true_branch' : 'false_branch';
            console.log(`[DEBUG] [CONDITION STEP] Following ${branchKey} branch`);
            return this.executeNextStep(workflow, step, context, branchKey);
          }
        }
      }
      
      // Special handling for campaign membership conditions
      if (field === 'lead.campaigns' || field === 'lead.in_campaign') {
        console.log(`[DEBUG] [CONDITION STEP] Processing campaign membership condition`);
        
        // Get the lead ID from context
        const leadId = this.getFieldFromContext(context, 'lead.id');
        console.log(`[DEBUG] [CONDITION STEP] Lead ID from context: ${leadId}`);
        
        if (!leadId) {
          console.error(`[ERROR] [CONDITION STEP] Campaign membership condition requires a lead ID in context`);
          console.error(`[ERROR] [CONDITION STEP] Available context keys: ${Object.keys(context).join(', ')}`);
          return false;
        }
        
        // If checking for membership in a specific campaign
        if (operator === 'contains' || operator === 'in') {
          console.log(`[DEBUG] [CONDITION STEP] Checking campaign membership with ${operator} operator`);
          
          // Get campaign membership
          console.log(`[DEBUG] [CONDITION STEP] Fetching campaign memberships for lead ${leadId}`);
          const campaignMembers = await this.store.campaignMembers.getByLeadId(leadId);
          console.log(`[DEBUG] [CONDITION STEP] Found ${campaignMembers.length} campaign memberships`);
          
          const campaignIds = campaignMembers.map(m => m.campaign_id);
          console.log(`[DEBUG] [CONDITION STEP] Campaign IDs: ${campaignIds.join(', ')}`);
          
          // Check if lead is in the specified campaign
          const result = campaignIds.includes(value);
          
          console.log(`[INFO] [CONDITION STEP] Condition ${field} ${operator} ${value} evaluated to ${result}`);
          
          // Follow the appropriate branch
          const branchKey = result ? 'true_branch' : 'false_branch';
          console.log(`[DEBUG] [CONDITION STEP] Following ${branchKey} branch`);
          return this.executeNextStep(workflow, step, context, branchKey);
        }
        
        // If checking for campaign count
        if (field === 'lead.campaigns.count') {
          console.log(`[DEBUG] [CONDITION STEP] Checking campaign count`);
          
          // Get campaign membership count
          console.log(`[DEBUG] [CONDITION STEP] Fetching campaign memberships for lead ${leadId}`);
          const campaignMembers = await this.store.campaignMembers.getByLeadId(leadId);
          const count = campaignMembers.length;
          console.log(`[DEBUG] [CONDITION STEP] Campaign count: ${count}`);
          
          // Evaluate the condition
          console.log(`[DEBUG] [CONDITION STEP] Evaluating condition: ${count} ${operator} ${value}`);
          const result = this.evaluateCondition(count, operator, value);
          
          console.log(`[INFO] [CONDITION STEP] Condition ${field} ${operator} ${value} evaluated to ${result}`);
          
          // Follow the appropriate branch
          const branchKey = result ? 'true_branch' : 'false_branch';
          console.log(`[DEBUG] [CONDITION STEP] Following ${branchKey} branch`);
          return this.executeNextStep(workflow, step, context, branchKey);
        }
      }
      
      // Get the field value from context
      console.log(`[DEBUG] [CONDITION STEP] Getting field value from context: ${field}`);
      const fieldValue = this.getFieldFromContext(context, field);
      console.log(`[DEBUG] [CONDITION STEP] Field value: ${fieldValue}`);
      
      // Evaluate the condition
      console.log(`[DEBUG] [CONDITION STEP] Evaluating condition: ${fieldValue} ${operator} ${value}`);
      const result = this.evaluateCondition(fieldValue, operator, value);
      
      console.log(`[INFO] [CONDITION STEP] Condition ${field} ${operator} ${value} evaluated to ${result}`);
      
      // Follow the appropriate branch
      const branchKey = result ? 'true_branch' : 'false_branch';
      console.log(`[DEBUG] [CONDITION STEP] Following ${branchKey} branch`);
      
      return this.executeNextStep(workflow, step, context, branchKey);
    } catch (error) {
      console.error(`[ERROR] [CONDITION STEP] Error executing condition step:`, error);
      console.error(`[ERROR] [CONDITION STEP] Error details: ${error.message}`);
      console.error(`[ERROR] [CONDITION STEP] Stack trace: ${error.stack}`);
      return false;
    }
  }

  // Execute an SMS step
  async executeSmsStep(workflow, step, context) {
    console.log(`[DEBUG] [SMS STEP] Starting execution of SMS step ${step.id} in workflow ${workflow.id}`);
    console.log(`[DEBUG] [SMS STEP] Step properties:`, JSON.stringify(step.properties || {}));
    console.log(`[DEBUG] [SMS STEP] Context:`, JSON.stringify(context, (key, value) => {
      // Avoid circular references and limit large objects
      if (typeof value === 'object' && value !== null) {
        return Object.keys(value).length > 20 ? '[Large Object]' : value;
      }
      return value;
    }));
    
    try {
      // Implementation for SMS sending would go here
      console.log(`[INFO] [SMS STEP] SMS step execution not implemented yet`);
      
      // Move to next step
      console.log(`[DEBUG] [SMS STEP] Moving to next step`);
      return this.executeNextStep(workflow, step, context);
    } catch (error) {
      console.error(`[ERROR] [SMS STEP] Error executing SMS step:`, error);
      console.error(`[ERROR] [SMS STEP] Error details: ${error.message}`);
      console.error(`[ERROR] [SMS STEP] Stack trace: ${error.stack}`);
      return false;
    }
  }

  // Execute a campaign action step
  async executeCampaignAction(workflow, step, context) {
    console.log(`[DEBUG] [CAMPAIGN ACTION] Starting execution of campaign action step ${step.id} in workflow ${workflow.id}`);
    console.log(`[DEBUG] [CAMPAIGN ACTION] Step properties:`, JSON.stringify(step.properties || {}));
    console.log(`[DEBUG] [CAMPAIGN ACTION] Context:`, JSON.stringify(context, (key, value) => {
      // Avoid circular references and limit large objects
      if (typeof value === 'object' && value !== null) {
        return Object.keys(value).length > 20 ? '[Large Object]' : value;
      }
      return value;
    }));
    
    const { action, campaign_id } = step.properties || {};
    
    if (!action || !campaign_id) {
      console.error(`[ERROR] [CAMPAIGN ACTION] Missing required properties. action=${action}, campaign_id=${campaign_id}`);
      return false;
    }
    
    // Get the lead ID from context
    const leadId = this.getFieldFromContext(context, 'lead.id');
    console.log(`[DEBUG] [CAMPAIGN ACTION] Retrieved lead ID from context: ${leadId}`);
    
    if (!leadId) {
      console.error(`[ERROR] [CAMPAIGN ACTION] No lead ID found in context for workflow ${workflow.id}, step ${step.id}`);
      console.error(`[ERROR] [CAMPAIGN ACTION] Available context keys: ${Object.keys(context).join(', ')}`);
      return false;
    }
    
    console.log(`[INFO] [CAMPAIGN ACTION] Executing campaign action: ${action} for lead ${leadId} in campaign ${campaign_id}`);
    
    try {
      // Execute the action
      switch (action) {
        case 'add':
          console.log(`[DEBUG] [CAMPAIGN ACTION] Adding lead ${leadId} to campaign ${campaign_id}`);
          const addData = {
            campaign_id,
            lead_id: leadId,
            added_at: new Date().toISOString(),
            added_by: null, // Added by workflow
            is_active: true
          };
          console.log(`[DEBUG] [CAMPAIGN ACTION] Add member data:`, JSON.stringify(addData));
          await this.store.campaignMembers.add(addData);
          console.log(`[DEBUG] [CAMPAIGN ACTION] Successfully added lead ${leadId} to campaign ${campaign_id}`);
          break;
          
        case 'remove':
          console.log(`[DEBUG] [CAMPAIGN ACTION] Removing lead ${leadId} from campaign ${campaign_id}`);
          await this.store.campaignMembers.remove(campaign_id, leadId);
          console.log(`[DEBUG] [CAMPAIGN ACTION] Successfully removed lead ${leadId} from campaign ${campaign_id}`);
          break;
          
        case 'refresh':
          console.log(`[DEBUG] [CAMPAIGN ACTION] Refreshing campaign ${campaign_id}`);
          await this.store.campaigns.refresh(campaign_id);
          console.log(`[DEBUG] [CAMPAIGN ACTION] Successfully refreshed campaign ${campaign_id}`);
          break;
          
        default:
          console.error(`[ERROR] [CAMPAIGN ACTION] Unknown campaign action: ${action}`);
          return false;
      }
      
      console.log(`[INFO] [CAMPAIGN ACTION] Successfully executed campaign action ${action} for workflow ${workflow.id}, step ${step.id}`);
      
      // Move to next step
      console.log(`[DEBUG] [CAMPAIGN ACTION] Moving to next step after campaign action ${action}`);
      return this.executeNextStep(workflow, step, context);
    } catch (error) {
      console.error(`[ERROR] [CAMPAIGN ACTION] Failed to execute campaign action ${action}:`, error);
      console.error(`[ERROR] [CAMPAIGN ACTION] Error details: ${error.message}`);
      console.error(`[ERROR] [CAMPAIGN ACTION] Stack trace: ${error.stack}`);
      return false;
    }
  }

  // Execute an end step
  async executeEndStep(workflow, step, context) {
    console.log(`[DEBUG] [END STEP] Starting execution of end step ${step.id} in workflow ${workflow.id}`);
    console.log(`[DEBUG] [END STEP] Context:`, JSON.stringify(context, (key, value) => {
      // Avoid circular references and limit large objects
      if (typeof value === 'object' && value !== null) {
        return Object.keys(value).length > 20 ? '[Large Object]' : value;
      }
      return value;
    }));
    
    console.log(`[INFO] [END STEP] Workflow ${workflow.id} ended at step ${step.id}`);
    
    try {
      // Perform any cleanup or final actions here if needed
      console.log(`[DEBUG] [END STEP] Successfully completed workflow ${workflow.id}`);
      return true;
    } catch (error) {
      console.error(`[ERROR] [END STEP] Error executing end step:`, error);
      console.error(`[ERROR] [END STEP] Error details: ${error.message}`);
      console.error(`[ERROR] [END STEP] Stack trace: ${error.stack}`);
      return false;
    }
  }

  // Helper: Get a field value from context
  getFieldFromContext(context, field) {
    const parts = field.split('.');
    let value = context;
    
    for (const part of parts) {
      if (value === undefined || value === null) {
        return undefined;
      }
      
      value = value[part];
    }
    
    return value;
  }

  // Helper: Evaluate a condition
  evaluateCondition(fieldValue, operator, compareValue) {
    switch (operator) {
      case 'equals':
        return fieldValue === compareValue;
      case 'not_equals':
        return fieldValue !== compareValue;
      case 'contains':
        return String(fieldValue).includes(String(compareValue));
      case 'greater_than':
        return fieldValue > compareValue;
      case 'less_than':
        return fieldValue < compareValue;
      case 'in':
        return Array.isArray(compareValue) && compareValue.includes(fieldValue);
      default:
        console.error(`Unknown operator: ${operator}`);
        return false;
    }
  }

  // Helper: Check if current time is within business hours
  isWithinBusinessHours(businessHours) {
    if (!businessHours.enabled) {
      return true; // If business hours are disabled, always return true
    }
    
    const now = new Date();
    
    // Get current day of week (0-6, where 0 is Sunday)
    const dayNum = now.getDay();
    
    // Check if current day is a work day
    if (!businessHours.days.includes(dayNum)) {
      return false;
    }
    
    // Get current time
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 60 + minutes; // Convert to minutes since midnight
    
    // Parse start and end times
    const [startHours, startMinutes] = businessHours.start_time.split(':').map(Number);
    const [endHours, endMinutes] = businessHours.end_time.split(':').map(Number);
    
    const startTime = startHours * 60 + startMinutes;
    const endTime = endHours * 60 + endMinutes;
    
    // Check if current time is within start and end times
    return currentTime >= startTime && currentTime <= endTime;
  }

  // Helper: Adjust time for business hours
  adjustForBusinessHours(time, businessHours) {
    if (!businessHours.enabled) {
      return time;
    }
    
    const timezone = businessHours.timezone;
    
    // Get the day of week (0-6, where 0 is Sunday)
    const dayNum = time.getDay();
    
    if (!businessHours.days.includes(dayNum)) {
      // Not a work day, find next work day
      return this.getNextBusinessHoursStartTime(time, businessHours);
    }
    
    // Parse business hours
    const [startHour, startMinute] = businessHours.start_time.split(':').map(Number);
    const [endHour, endMinute] = businessHours.end_time.split(':').map(Number);
    
    // Get current time components
    const hours = time.getHours();
    const minutes = time.getMinutes();
    
    // Convert to minutes since midnight
    const timeMinutes = hours * 60 + minutes;
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    
    if (timeMinutes < startMinutes) {
      // Before business hours, adjust to start time
      const adjusted = new Date(time);
      adjusted.setHours(startHour, startMinute, 0, 0);
      return adjusted;
    } else if (timeMinutes > endMinutes) {
      // After business hours, adjust to next day's start time
      return this.getNextBusinessHoursStartTime(time, businessHours);
    }
    
    // Within business hours, no adjustment needed
    return time;
  }

  // Helper: Get the next business hours start time
  getNextBusinessHoursStartTime(time, businessHours) {
    const { days, start_time } = businessHours;
    
    // Parse start time
    const [startHour, startMinute] = start_time.split(':').map(Number);
    
    // Start with the next day
    const nextDay = new Date(time);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(startHour, startMinute, 0, 0);
    
    // Get the day of week (0-6, where 0 is Sunday)
    const dayNum = nextDay.getDay();
    
    if (days.includes(dayNum)) {
      return nextDay;
    }
    
    // Recursively find the next work day
    return this.getNextBusinessHoursStartTime(nextDay, businessHours);
  }

  // Get all rules (for backward compatibility with rules-manager)
  getRules() {
    // Get the default workflow
    const defaultWorkflow = this.store.workflows.getById('default');
    
    if (!defaultWorkflow) {
      return {
        newLeadRule: {
          enabled: false,
          priority: 3,
        },
        noAnswerRetryRule: {
          enabled: false,
          retryDelayMinutes: 30,
          maxRetries: 3,
          respectCallCenterHours: true,
        },
        callCenterHours: {
          enabled: true,
          timezone: 'America/New_York',
          workDays: [1, 2, 3, 4, 5],
          startTime: '09:00',
          endTime: '17:00',
        }
      };
    }
    
    // Convert workflow to rules format
    return {
      newLeadRule: {
        enabled: defaultWorkflow.active,
        priority: defaultWorkflow.triggers.find(t => t.type === 'new_lead')?.priority || 3,
      },
      noAnswerRetryRule: {
        enabled: defaultWorkflow.active,
        retryDelayMinutes: defaultWorkflow.steps.find(s => s.type === 'wait')?.properties?.minutes || 30,
        maxRetries: 3, // Default value
        respectCallCenterHours: defaultWorkflow.steps.find(s => s.type === 'wait')?.properties?.respect_hours || true,
      },
      callCenterHours: {
        enabled: defaultWorkflow.business_hours?.enabled || true,
        timezone: defaultWorkflow.business_hours?.timezone || 'America/New_York',
        workDays: defaultWorkflow.business_hours?.days || [1, 2, 3, 4, 5],
        startTime: defaultWorkflow.business_hours?.start_time || '09:00',
        endTime: defaultWorkflow.business_hours?.end_time || '17:00',
      }
    };
  }

  // Update rules (for backward compatibility with rules-manager)
  updateRules(newRules) {
    // Get the default workflow
    let defaultWorkflow = this.store.workflows.getById('default');
    
    if (!defaultWorkflow) {
      // Create default workflow if it doesn't exist
      defaultWorkflow = {
        id: 'default',
        name: 'Default Lead Follow-up',
        description: 'Default workflow for new leads',
        active: newRules.newLeadRule?.enabled || false,
        triggers: [
          { type: 'new_lead', priority: newRules.newLeadRule?.priority || 3 }
        ],
        steps: [
          {
            id: 'start',
            type: 'start',
            name: 'Start',
            isStart: true,
            next_step: 'call',
            position: { x: 100, y: 100 }
          },
          {
            id: 'call',
            type: 'call',
            name: 'Make Call',
            properties: { priority: newRules.newLeadRule?.priority || 3 },
            next_step: 'condition',
            position: { x: 300, y: 100 }
          },
          {
            id: 'condition',
            type: 'condition',
            name: 'Check Disposition',
            condition: {
              field: 'call.disposition',
              operator: 'equals',
              value: 'no-answer'
            },
            true_branch: 'wait',
            false_branch: 'end',
            position: { x: 500, y: 100 }
          },
          {
            id: 'wait',
            type: 'wait',
            name: 'Wait 30 Minutes',
            properties: {
              minutes: newRules.noAnswerRetryRule?.retryDelayMinutes || 30,
              respect_hours: newRules.noAnswerRetryRule?.respectCallCenterHours || true
            },
            next_step: 'call2',
            position: { x: 500, y: 250 }
          },
          {
            id: 'call2',
            type: 'call',
            name: 'Retry Call',
            properties: { priority: 2 },
            next_step: 'end',
            position: { x: 300, y: 250 }
          },
          {
            id: 'end',
            type: 'end',
            name: 'End',
            position: { x: 700, y: 100 }
          }
        ],
        business_hours: {
          enabled: newRules.callCenterHours?.enabled || true,
          timezone: newRules.callCenterHours?.timezone || 'America/New_York',
          days: newRules.callCenterHours?.workDays || [1, 2, 3, 4, 5],
          start_time: newRules.callCenterHours?.startTime || '09:00',
          end_time: newRules.callCenterHours?.endTime || '17:00'
        }
      };
      
      this.store.workflows.create(defaultWorkflow);
    } else {
      // Update existing workflow
      const updatedWorkflow = { ...defaultWorkflow };
      
      // Update active state
      if (newRules.newLeadRule?.enabled !== undefined) {
        updatedWorkflow.active = newRules.newLeadRule.enabled;
      }
      
      // Update triggers
      if (newRules.newLeadRule?.priority !== undefined) {
        const newLeadTrigger = updatedWorkflow.triggers.find(t => t.type === 'new_lead');
        if (newLeadTrigger) {
          newLeadTrigger.priority = newRules.newLeadRule.priority;
        }
      }
      
      // Update wait step
      if (newRules.noAnswerRetryRule) {
        const waitStep = updatedWorkflow.steps.find(s => s.type === 'wait');
        if (waitStep) {
          waitStep.properties = {
            ...waitStep.properties,
            minutes: newRules.noAnswerRetryRule.retryDelayMinutes || waitStep.properties.minutes,
            respect_hours: newRules.noAnswerRetryRule.respectCallCenterHours !== undefined ? 
              newRules.noAnswerRetryRule.respectCallCenterHours : waitStep.properties.respect_hours
          };
        }
      }
      
      // Update business hours
      if (newRules.callCenterHours) {
        updatedWorkflow.business_hours = {
          ...updatedWorkflow.business_hours,
          enabled: newRules.callCenterHours.enabled !== undefined ? 
            newRules.callCenterHours.enabled : updatedWorkflow.business_hours.enabled,
          timezone: newRules.callCenterHours.timezone || updatedWorkflow.business_hours.timezone,
          days: newRules.callCenterHours.workDays || updatedWorkflow.business_hours.days,
          start_time: newRules.callCenterHours.startTime || updatedWorkflow.business_hours.start_time,
          end_time: newRules.callCenterHours.endTime || updatedWorkflow.business_hours.end_time
        };
      }
      
      this.store.workflows.update('default', updatedWorkflow);
    }
    
    return this.getRules();
  }

  // Process a new lead according to rules (for backward compatibility)
  processNewLead(leadData) {
    // Get the default workflow
    const defaultWorkflow = this.store.workflows.getById('default');
    
    if (!defaultWorkflow || !defaultWorkflow.active) {
      return null; // No active default workflow
    }
    
    // Get the new lead trigger
    const newLeadTrigger = defaultWorkflow.triggers.find(t => t.type === 'new_lead');
    if (!newLeadTrigger) {
      return null; // No new lead trigger
    }
    
    // Check if we're within business hours
    if (defaultWorkflow.business_hours?.enabled && !this.isWithinBusinessHours(defaultWorkflow.business_hours)) {
      // Schedule for the next business hours start time
      const nextBusinessTime = this.getNextBusinessHoursStartTime(new Date(), defaultWorkflow.business_hours);
      
      // Add to queue with scheduled time
      return {
        ...leadData,
        priority: newLeadTrigger.priority || 3,
        scheduled_for: nextBusinessTime.toISOString()
      };
    }
    
    // Within business hours, add to queue for immediate calling
    return {
      ...leadData,
      priority: newLeadTrigger.priority || 3
    };
  }

  // Process a no-answer call according to rules (for backward compatibility)
  processNoAnswerCall(call) {
    // Get the default workflow
    const defaultWorkflow = this.store.workflows.getById('default');
    
    if (!defaultWorkflow || !defaultWorkflow.active) {
      return null; // No active default workflow
    }
    
    // Check if we've reached the maximum number of retries
    const retryCount = call.retry_count || 0;
    const maxRetries = 3; // Default value
    
    if (retryCount >= maxRetries) {
      return null; // Max retries reached, do nothing
    }
    
    // Get the wait step
    const waitStep = defaultWorkflow.steps.find(s => s.type === 'wait');
    if (!waitStep) {
      return null; // No wait step
    }
    
    // Calculate next retry time
    const now = new Date();
    const retryDelayMs = (waitStep.properties?.minutes || 30) * 60 * 1000;
    let nextRetryTime = new Date(now.getTime() + retryDelayMs);
    
    // If we need to respect business hours
    if (waitStep.properties?.respect_hours && defaultWorkflow.business_hours?.enabled) {
      nextRetryTime = this.adjustForBusinessHours(nextRetryTime, defaultWorkflow.business_hours);
    }
    
    // Return updated call data for rescheduling
    return {
      ...call,
      status: 'Queued',
      retry_count: retryCount + 1,
      scheduled_for: nextRetryTime.toISOString(),
      last_retry: new Date().toISOString()
    };
  }
}

// Create a singleton instance
const workflowManager = new WorkflowManager();

module.exports = workflowManager;