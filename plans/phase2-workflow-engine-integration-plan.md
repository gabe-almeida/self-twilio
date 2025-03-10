# Phase 2: Workflow Engine Integration - Detailed Implementation Plan

## 1. Integrate Workflow Engine with call-queue-manager.js

### 1.1 Create workflow-engine.js
- [x] Create the main workflow engine file (implemented as workflow-manager.js)
  ```javascript
  // workflow-engine.js
  const store = require('./memory-store');
  const queueManager = require('./call-queue-manager');
  
  class WorkflowEngine {
    constructor() {
      this.scheduledTasks = new Map();
      this.activeWorkflows = new Map();
      this.processingInterval = null;
    }
    
    // Start the workflow engine
    start(intervalMs = 60000) {
      console.log('Starting workflow engine');
      
      if (this.processingInterval) {
        this.stop();
      }
      
      this.processingInterval = setInterval(() => {
        this.processScheduledTasks();
      }, intervalMs);
      
      // Process immediately on start
      this.processScheduledTasks();
    }
    
    // Stop the workflow engine
    stop() {
      console.log('Stopping workflow engine');
      
      if (this.processingInterval) {
        clearInterval(this.processingInterval);
        this.processingInterval = null;
      }
    }
    
    // Process scheduled tasks
    async processScheduledTasks() {
      const now = new Date();
      
      // Find tasks that are due
      const dueTasks = [];
      for (const [taskId, task] of this.scheduledTasks.entries()) {
        if (new Date(task.executeAt) <= now) {
          dueTasks.push({ taskId, task });
        }
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
      const workflow = await store.workflows.getById(workflowId);
      
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
      const workflows = await store.workflows.getActive();
      const matchingWorkflows = workflows.filter(workflow => 
        workflow.triggers.some(trigger => trigger.type === 'new_lead')
      );
      
      if (matchingWorkflows.length === 0) {
        console.log('No active workflows found for new lead trigger');
        return null;
      }
      
      // Start each matching workflow
      for (const workflow of matchingWorkflows) {
        await this.startWorkflow(workflow, { lead: leadData });
      }
      
      return true;
    }
    
    // Process a call disposition trigger
    async processCallDisposition(callData) {
      // Find active workflows with call disposition trigger
      const workflows = await store.workflows.getActive();
      const matchingWorkflows = workflows.filter(workflow => 
        workflow.triggers.some(trigger => 
          trigger.type === 'call_disposition' && 
          trigger.disposition === callData.disposition
        )
      );
      
      if (matchingWorkflows.length === 0) {
        console.log(`No active workflows found for call disposition ${callData.disposition}`);
        return null;
      }
      
      // Start each matching workflow
      for (const workflow of matchingWorkflows) {
        await this.startWorkflow(workflow, { call: callData });
      }
      
      return true;
    }
    
    // Start a workflow
    async startWorkflow(workflow, context) {
      console.log(`Starting workflow ${workflow.id}: ${workflow.name}`);
      
      // Find the first step
      const firstStep = workflow.steps.find(step => step.isStart);
      
      if (!firstStep) {
        console.error(`Workflow ${workflow.id} has no start step`);
        return false;
      }
      
      // Execute the first step
      await this.executeWorkflowStep(workflow, firstStep, context);
      
      return true;
    }
    
    // Execute a workflow step
    async executeWorkflowStep(workflow, step, context) {
      console.log(`Executing step ${step.id} (${step.type}) in workflow ${workflow.id}`);
      
      // Execute based on step type
      switch (step.type) {
        case 'call':
          return this.executeCallStep(workflow, step, context);
        case 'wait':
          return this.executeWaitStep(workflow, step, context);
        case 'condition':
          return this.executeConditionStep(workflow, step, context);
        case 'sms':
          return this.executeSmsStep(workflow, step, context);
        case 'end':
          return this.executeEndStep(workflow, step, context);
        default:
          console.error(`Unknown step type: ${step.type}`);
          return false;
      }
    }
    
    // Execute the next step in the workflow
    async executeNextStep(workflow, currentStep, context, branchKey = 'next_step') {
      const nextStepId = currentStep[branchKey];
      
      if (!nextStepId) {
        console.log(`Workflow ${workflow.id} completed at step ${currentStep.id}`);
        return true;
      }
      
      const nextStep = workflow.steps.find(step => step.id === nextStepId);
      
      if (!nextStep) {
        console.error(`Next step ${nextStepId} not found in workflow ${workflow.id}`);
        return false;
      }
      
      return this.executeWorkflowStep(workflow, nextStep, context);
    }
    
    // Execute a call step
    async executeCallStep(workflow, step, context) {
      const { lead } = context;
      
      if (!lead || !lead.phone_number) {
        console.error('Call step requires a lead with phone number');
        return false;
      }
      
      // Prepare call data
      const callData = {
        phone_number: lead.phone_number,
        contact_name: lead.contact_name,
        notes: lead.notes,
        priority: step.properties.priority || 1,
        workflow_id: workflow.id,
        step_id: step.id
      };
      
      // Add to queue
      const result = await queueManager.addToQueue(callData);
      
      if (!result.success) {
        console.error(`Failed to add call to queue: ${result.error}`);
        return false;
      }
      
      // Update context with call information
      context.call = {
        id: result.id,
        status: 'queued'
      };
      
      // Move to next step
      return this.executeNextStep(workflow, step, context);
    }
    
    // Execute a wait step
    async executeWaitStep(workflow, step, context) {
      const { minutes, respect_hours } = step.properties;
      
      if (!minutes || minutes <= 0) {
        console.error('Wait step requires a positive number of minutes');
        return false;
      }
      
      // Calculate wait time
      const now = new Date();
      let waitUntil = new Date(now.getTime() + minutes * 60000);
      
      // Respect business hours if configured
      if (respect_hours && workflow.business_hours && workflow.business_hours.enabled) {
        waitUntil = this.adjustForBusinessHours(waitUntil, workflow.business_hours);
      }
      
      // Schedule next step execution
      const nextStepId = step.next_step;
      
      if (!nextStepId) {
        console.log(`Workflow ${workflow.id} has no next step after wait`);
        return true;
      }
      
      this.scheduleTask(workflow.id, nextStepId, context, waitUntil);
      
      return true;
    }
    
    // Execute a condition step
    async executeConditionStep(workflow, step, context) {
      const { field, operator, value } = step.condition;
      
      // Get the field value from context
      const fieldValue = this.getFieldFromContext(context, field);
      
      // Evaluate the condition
      const result = this.evaluateCondition(fieldValue, operator, value);
      
      // Follow the appropriate branch
      const branchKey = result ? 'true_branch' : 'false_branch';
      
      return this.executeNextStep(workflow, step, context, branchKey);
    }
    
    // Execute an SMS step
    async executeSmsStep(workflow, step, context) {
      // Implementation for SMS sending would go here
      console.log('SMS step execution not implemented yet');
      
      // Move to next step
      return this.executeNextStep(workflow, step, context);
    }
    
    // Execute an end step
    async executeEndStep(workflow, step, context) {
      console.log(`Workflow ${workflow.id} ended at step ${step.id}`);
      return true;
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
    
    // Helper: Adjust time for business hours
    adjustForBusinessHours(time, businessHours) {
      const { timezone, days, start_time, end_time } = businessHours;
      
      // Convert to target timezone
      const options = { timeZone: timezone };
      
      // Check if the day is a work day
      const day = time.toLocaleDateString('en-US', { ...options, weekday: 'numeric' });
      const dayNum = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        .indexOf(day);
      
      if (!days.includes(dayNum)) {
        // Not a work day, find next work day
        return this.findNextWorkDay(time, businessHours);
      }
      
      // Parse business hours
      const [startHour, startMinute] = start_time.split(':').map(Number);
      const [endHour, endMinute] = end_time.split(':').map(Number);
      
      // Get current time components
      const timeStr = time.toLocaleTimeString('en-US', { ...options, hour: '2-digit', minute: '2-digit', hour12: false });
      const [hours, minutes] = timeStr.split(':').map(Number);
      
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
        return this.findNextWorkDay(time, businessHours);
      }
      
      // Within business hours, no adjustment needed
      return time;
    }
    
    // Helper: Find the next work day
    findNextWorkDay(time, businessHours) {
      const { timezone, days, start_time } = businessHours;
      
      // Parse start time
      const [startHour, startMinute] = start_time.split(':').map(Number);
      
      // Start with the next day
      const nextDay = new Date(time);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(startHour, startMinute, 0, 0);
      
      // Check if it's a work day
      const options = { timeZone: timezone };
      const day = nextDay.toLocaleDateString('en-US', { ...options, weekday: 'numeric' });
      const dayNum = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        .indexOf(day);
      
      if (days.includes(dayNum)) {
        return nextDay;
      }
      
      // Recursively find the next work day
      return this.findNextWorkDay(nextDay, businessHours);
    }
  }
  
  // Create a singleton instance
  const workflowEngine = new WorkflowEngine();
  
  module.exports = workflowEngine;
  ```

### 1.2 Update call-queue-manager.js to Use Workflow Engine
- [x] Modify addToQueue method
  ```javascript
  // Add a call to the queue
  async addToQueue(callData) {
    try {
      // Check if this call is part of a workflow
      const workflowId = callData.workflow_id;
      const stepId = callData.step_id;
      
      // Process the call data
      let processedCallData = { ...callData };
      
      // If not part of a workflow, check if there's a matching workflow for new leads
      if (!workflowId && !stepId) {
        const workflowEngine = require('./workflow-engine');
        const workflowResult = await workflowEngine.processNewLead(callData);
        
        // If a workflow was triggered, don't add to queue directly
        if (workflowResult === true) {
          return {
            success: true,
            id: null,
            workflow_triggered: true
          };
        }
      }
      
      // Add to queue as normal
      const result = await store.callQueue.add(processedCallData);
      console.log(`Added call to queue with ID: ${result.id}`);
      
      // Process the queue immediately if not scheduled for later
      if (!processedCallData.scheduled_for) {
        setTimeout(() => this.processQueue(), 1000);
      }
      
      return {
        success: true,
        id: result.id,
        scheduled: !!processedCallData.scheduled_for,
        scheduled_time: processedCallData.scheduled_for
      };
    } catch (error) {
      console.error('Error adding call to queue:', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }
  ```

- [x] Update handleCallStatusUpdate method
  ```javascript
  // Handle call status updates
  async handleCallStatusUpdate(callStatus) {
    try {
      const callSid = callStatus.CallSid;
      const status = callStatus.CallStatus;
      
      console.log(`Call status update for SID ${callSid}: ${status}`);
      
      // Find all calls in the queue
      const calls = await store.callQueue.getAll();
      
      // Find the call with matching SID
      const call = calls.find(c => c.call_sid === callSid);
      
      if (!call) {
        console.log(`No call found in queue with SID ${callSid}`);
        return;
      }
      
      const agentId = call.assigned_to;
      
      // Update call history
      const histories = await store.callHistory.getAll();
      const history = histories.find(h => h.call_sid === callSid);
      
      if (history) {
        await store.callHistory.update(callSid, { call_status: status });
      }
      
      // Handle different call statuses
      if (status === 'completed' || status === 'busy' || status === 'no-answer' || status === 'failed' || status === 'canceled') {
        // Call has ended
        console.log(`Call ${callSid} has ended with status: ${status}`);
        
        // Update call duration if available
        if (callStatus.CallDuration && history) {
          await store.callHistory.update(callSid, {
            duration: parseInt(callStatus.CallDuration),
            end_time: new Date().toISOString()
          });
        }
        
        // Check if this call is part of a workflow
        if (call.workflow_id) {
          // Process the call disposition in the workflow engine
          const workflowEngine = require('./workflow-engine');
          const workflowResult = await workflowEngine.processCallDisposition({
            ...call,
            disposition: status,
            duration: callStatus.CallDuration ? parseInt(callStatus.CallDuration) : 0
          });
          
          console.log(`Workflow processing result: ${workflowResult}`);
        } else {
          // Special handling for no-answer status based on rules
          if (status === 'no-answer') {
            // Process using rules manager if not part of a workflow
            const rulesManager = require('./rules-manager');
            if (rulesManager.rules.noAnswerRetryRule.enabled) {
              console.log(`Processing no-answer call ${call.id} according to retry rules`);
              
              // Get updated call data for retry processing
              const updatedCall = {
                ...call,
                retry_count: call.retry_count || 0,
                status: 'Completed'
              };
              
              // Process the no-answer call according to rules
              const retryCall = rulesManager.processNoAnswerCall(updatedCall);
              
              if (retryCall) {
                console.log(`Rescheduling call ${call.id} for retry at ${retryCall.scheduled_for}`);
                
                // Update the call in the queue with retry information
                await store.callQueue.update(call.id, {
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
                await store.callQueue.updateStatus(call.id, 'Completed');
              }
            } else {
              // For other statuses, mark the call as completed
              await store.callQueue.updateStatus(call.id, 'Completed');
            }
          } else {
            // For other statuses, mark the call as completed
            await store.callQueue.updateStatus(call.id, 'Completed');
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
      console.error('Error handling call status update:', error);
    }
  }
  ```

### 1.3 Update index.js to Start Workflow Engine
- [x] Import workflow engine
  ```javascript
  const workflowEngine = require('./workflow-engine');
  ```

- [x] Start workflow engine with server
  ```javascript
  // Start the call queue manager and workflow engine
  queueManager.start();
  workflowEngine.start();
  ```

- [x] Update shutdown handlers
  ```javascript
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down server...');
    queueManager.stop();
    workflowEngine.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('Shutting down server...');
    queueManager.stop();
    workflowEngine.stop();
    process.exit(0);
  });
  ```

## 2. Add Workflow Timing and Scheduling

### 2.1 Implement Wait Steps with Configurable Delays
- [x] Create a task scheduler in workflow-engine.js
  ```javascript
  // Already implemented in the WorkflowEngine class above
  ```

### 2.2 Add Business Hours Enforcement
- [x] Implement business hours checking
  ```javascript
  // Already implemented in the WorkflowEngine class above
  ```

### 2.3 Create Scheduling Mechanism for Delayed Steps
- [x] Implement task scheduling
  ```javascript
  // Already implemented in the WorkflowEngine class above
  ```

## 3. Implement Conditional Logic

### 3.1 Add Support for Branching Based on Call Disposition
- [x] Implement condition evaluation
  ```javascript
  // Already implemented in the WorkflowEngine class above
  ```

### 3.2 Implement Condition Evaluation
- [x] Create condition evaluator
  ```javascript
  // Already implemented in the WorkflowEngine class above
  ```

### 3.3 Support Multiple Branches in Workflows
- [x] Implement branch following
  ```javascript
  // Already implemented in the WorkflowEngine class above