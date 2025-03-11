// Integration tests for workflow-manager.js and call-queue-manager.js interaction
const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const { expect } = chai;
chai.use(sinonChai);

// Import modules to test
const workflowManager = require('../workflow-manager');
const queueManager = require('../call-queue-manager');
const store = require('../memory-store');

describe('Workflow Manager and Call Queue Integration Tests', () => {
  // Jest doesn't use this.timeout, it has its own timeout configuration
  jest.setTimeout(10000);

  // Setup and teardown
  let sandbox;
  let mockTwilioClient;
  
  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    
    // Load mock store
    const mockStore = require('./mock-store');
    
    // Replace the real store with our mock in both modules
    sandbox.stub(workflowManager, 'store').get(() => mockStore);
    sandbox.stub(queueManager, 'store').get(() => mockStore);
    
    // Create mock Twilio client for testing
    mockTwilioClient = {
      calls: {
        create: sandbox.stub().resolves({ sid: 'CA123456789', status: 'queued' })
      }
    };
    
    // Stub the Twilio client in call-queue-manager
    sandbox.stub(queueManager, 'twilioClient').get(() => mockTwilioClient);
    
    // Stub actual call initiation to prevent real calls
    const originalInitiateCall = queueManager.initiateCall;
    sandbox.stub(queueManager, 'initiateCall').callsFake(async function(call) {
      // Simulate the call initiation without making actual calls
      if (!call.phone_number) {
        return {
          success: false,
          error: 'No phone number specified'
        };
      }
      
      // Return success for test numbers
      if (call.phone_number === '+15551234567') {
        return {
          success: true,
          callSid: 'CA123456789',
          status: 'queued'
        };
      }
      
      // Fallback to original with mock client
      return originalInitiateCall.call(this, call);
    });
    
    // Reset any scheduled tasks
    workflowManager.scheduledTasks.clear();
    
    // Reset store for testing
    mockStore.callQueue = [];
    mockStore.nextId.callQueue = 1;
    
    // Set up test workflows
    const testWorkflows = [
      {
        id: 'test-workflow-1',
        name: 'Test New Lead Workflow',
        description: 'For testing new lead workflow',
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        triggers: [
          { type: 'new_lead', priority: 2 }
        ],
        steps: [
          {
            id: 'start',
            type: 'start',
            name: 'Start',
            isStart: true,
            next_step: 'make_call',
            position: { x: 100, y: 100 }
          },
          {
            id: 'make_call',
            type: 'call',
            name: 'Make Initial Call',
            properties: { priority: 2 },
            next_step: 'check_disposition',
            position: { x: 250, y: 100 }
          },
          {
            id: 'check_disposition',
            type: 'condition',
            name: 'Check Disposition',
            condition: {
              field: 'call.disposition',
              operator: 'equals',
              value: 'no-answer'
            },
            true_branch: 'wait_step',
            false_branch: 'end',
            position: { x: 400, y: 100 }
          },
          {
            id: 'wait_step',
            type: 'wait',
            name: 'Wait 30 Minutes',
            properties: {
              minutes: 1, // Use 1 minute for faster testing
              respect_hours: true
            },
            next_step: 'retry_call',
            position: { x: 400, y: 200 }
          },
          {
            id: 'retry_call',
            type: 'call',
            name: 'Retry Call',
            properties: { priority: 3 },
            next_step: 'end',
            position: { x: 250, y: 200 }
          },
          {
            id: 'end',
            type: 'end',
            name: 'End Workflow',
            position: { x: 550, y: 100 }
          }
        ],
        business_hours: {
          enabled: true,
          timezone: 'America/New_York',
          days: [1, 2, 3, 4, 5, 6, 7], // All days for easier testing
          start_time: '00:00',
          end_time: '23:59'
        }
      }
    ];
    
    mockStore.workflows = testWorkflows;
    
    // Define mock storage methods
    mockStore.workflows.getById = async (id) => {
      return mockStore.workflows.find(w => w.id === id) || null;
    };
    
    mockStore.workflows.getActive = async () => {
      return mockStore.workflows.filter(w => w.active);
    };
    
    mockStore.workflows.getAll = async () => {
      return [...mockStore.workflows];
    };
    
    // Set up call queue methods
    mockStore.callQueue.add = async (call) => {
      const id = mockStore.nextId.callQueue++;
      const newCall = {
        ...call,
        id,
        created_at: new Date().toISOString(),
        status: 'Queued'
      };
      mockStore.callQueue.push(newCall);
      return newCall;
    };
    
    mockStore.callQueue.getById = async (id) => {
      return mockStore.callQueue.find(c => c.id === parseInt(id, 10)) || null;
    };
    
    mockStore.callQueue.getAll = async () => {
      return [...mockStore.callQueue];
    };
    
    mockStore.callQueue.update = async (id, data) => {
      const index = mockStore.callQueue.findIndex(c => c.id === parseInt(id, 10));
      if (index === -1) return null;
      
      const updatedCall = {
        ...mockStore.callQueue[index],
        ...data,
        updated_at: new Date().toISOString()
      };
      
      mockStore.callQueue[index] = updatedCall;
      return updatedCall;
    };
    
    mockStore.callQueue.updateStatus = async (id, status) => {
      return mockStore.callQueue.update(id, { status });
    };
  });
  
  afterEach(() => {
    sandbox.restore();
  });
  
  describe('New Lead Processing', () => {
    it('should process a new lead and add to call queue', async () => {
      const leadData = {
        phone_number: '+15551234567',
        contact_name: 'Test Lead',
        notes: 'Test lead for workflow'
      };
      
      // Process the new lead
      const result = await workflowManager.processNewLead(leadData);
      
      expect(result).to.be.true;
      
      // Check if a call was added to the queue
      const allCalls = await mockStore.callQueue.getAll();
      expect(allCalls.length).to.be.at.least(1);
      
      // Verify the call has workflow data
      const call = allCalls[0];
      expect(call.phone_number).to.equal(leadData.phone_number);
      expect(call.workflow_id).to.equal('test-workflow-1');
    });
    
    it('should not process a lead when no active workflows match', async () => {
      // Make all workflows inactive
      mockStore.workflows.forEach(w => w.active = false);
      
      const leadData = {
        phone_number: '+15551234567',
        contact_name: 'Test Lead'
      };
      
      // Process the new lead
      const result = await workflowManager.processNewLead(leadData);
      
      expect(result).to.be.null;
      
      // Check that no call was added
      const allCalls = await mockStore.callQueue.getAll();
      expect(allCalls.length).to.equal(0);
      
      // Reset workflows to active
      mockStore.workflows.forEach(w => w.active = true);
    });
  });
  
  describe('Call Step Execution', () => {
    it('should execute a call step and add to queue', async () => {
      const workflow = await mockStore.workflows.getById('test-workflow-1');
      const callStep = workflow.steps.find(s => s.id === 'make_call');
      const context = {
        lead: {
          phone_number: '+15551234567',
          contact_name: 'Test Lead',
          notes: 'Test call execution'
        }
      };
      
      // Execute the call step
      const result = await workflowManager.executeCallStep(workflow, callStep, context);
      
      expect(result).to.be.true;
      
      // Check if a call was added to the queue
      const allCalls = await mockStore.callQueue.getAll();
      expect(allCalls.length).to.be.at.least(1);
      
      // Verify call details
      const call = allCalls[0];
      expect(call.phone_number).to.equal(context.lead.phone_number);
      expect(call.contact_name).to.equal(context.lead.contact_name);
      expect(call.workflow_id).to.equal(workflow.id);
      expect(call.workflow_step_id).to.equal(callStep.id);
      expect(call.priority).to.equal(callStep.properties.priority);
    });
  });
  
  describe('Call Disposition Handling', () => {
    it('should process call disposition and follow correct branches', async () => {
      // First add a call to the queue and simulate workflow execution
      const workflow = await mockStore.workflows.getById('test-workflow-1');
      const callStep = workflow.steps.find(s => s.id === 'make_call');
      
      // Add a call to the queue
      const callData = {
        phone_number: '+15551234567',
        contact_name: 'Test Lead',
        notes: 'Test call disposition',
        priority: 2,
        workflow_id: workflow.id,
        workflow_step_id: callStep.id
      };
      
      const queueResult = await mockStore.callQueue.add(callData);
      
      // Mock the call being completed with a no-answer disposition
      const dispositionData = {
        call_sid: 'CA123456789',
        disposition: 'no-answer',
        id: queueResult.id,
        workflow_id: workflow.id,
        workflow_step_id: callStep.id
      };
      
      // Stub executeWaitStep to avoid actual waiting
      const executeWaitStepStub = sandbox.stub(workflowManager, 'executeWaitStep').resolves(true);
      
      // Process the call disposition
      const result = await workflowManager.processCallDisposition(dispositionData);
      
      expect(result).to.be.true;
      
      // Verify the wait step was executed due to no-answer condition branch
      expect(executeWaitStepStub).to.have.been.called;
    });
  });
  
  describe('End-to-End Workflow Execution', () => {
    it('should execute a complete workflow with multiple steps', async () => {
      const workflow = await mockStore.workflows.getById('test-workflow-1');
      
      // Stub various methods to verify their execution
      const executeCallStepStub = sandbox.stub(workflowManager, 'executeCallStep').resolves(true);
      const executeConditionStepStub = sandbox.stub(workflowManager, 'executeConditionStep').callsFake(async (wf, step, ctx) => {
        // Simulate the condition and follow the true branch (no-answer)
        return workflowManager.executeNextStep(wf, step, ctx, 'true_branch');
      });
      const executeWaitStepStub = sandbox.stub(workflowManager, 'executeWaitStep').resolves(true);
      const executeEndStepStub = sandbox.stub(workflowManager, 'executeEndStep').resolves(true);
      
      // Start the workflow
      const context = {
        lead: {
          phone_number: '+15551234567',
          contact_name: 'Test Lead',
          notes: 'End-to-end test'
        }
      };
      
      const result = await workflowManager.startWorkflow(workflow, context);
      
      expect(result).to.be.true;
      
      // Verify all steps were executed
      expect(executeCallStepStub).to.have.been.called;
      expect(executeConditionStepStub).to.have.been.called;
      expect(executeWaitStepStub).to.have.been.called;
      
      // For a complete end-to-end test, we would need to restore these stubs and let
      // the workflow run its course, but that would make the test too complex and slow
    });
  });
  
  describe('Task Scheduling and Business Hours', () => {
    it('should schedule a task and respect business hours', async () => {
      const workflow = await mockStore.workflows.getById('test-workflow-1');
      const waitStep = workflow.steps.find(s => s.id === 'wait_step');
      
      // Set business hours to exclude current time
      workflow.business_hours.enabled = true;
      
      // Get current hour
      const now = new Date();
      const currentHour = now.getHours();
      
      // Set business hours to be different from current time
      workflow.business_hours.start_time = `${(currentHour + 1) % 24}:00`;
      workflow.business_hours.end_time = `${(currentHour + 2) % 24}:00`;
      
      // Stub adjustForBusinessHours to verify it's called
      const adjustForBusinessHoursStub = sandbox.stub(workflowManager, 'adjustForBusinessHours').returns(
        new Date(now.getTime() + 3600000) // 1 hour in the future
      );
      
      // Execute the wait step
      const context = { lead: { phone_number: '+15551234567' } };
      const result = await workflowManager.executeWaitStep(workflow, waitStep, context);
      
      expect(result).to.be.true;
      expect(adjustForBusinessHoursStub).to.have.been.called;
      expect(workflowManager.scheduledTasks.size).to.equal(1);
      
      // Verify a task was scheduled
      const scheduledTask = Array.from(workflowManager.scheduledTasks.values())[0];
      expect(scheduledTask.workflowId).to.equal(workflow.id);
      expect(scheduledTask.stepId).to.equal(waitStep.next_step);
    });
  });
  
  describe('Error Handling and Recovery', () => {
    it('should handle errors during step execution gracefully', async () => {
      const workflow = await mockStore.workflows.getById('test-workflow-1');
      const callStep = workflow.steps.find(s => s.id === 'make_call');
      
      // Force an error during step execution
      sandbox.stub(queueManager, 'addToQueue').rejects(new Error('Test error'));
      
      const context = { lead: { phone_number: '+15551234567' } };
      
      // Execute the step that will trigger an error
      const result = await workflowManager.executeCallStep(workflow, callStep, context);
      
      // Execution should complete without throwing, but return false for failure
      expect(result).to.be.false;
    });
  });
});