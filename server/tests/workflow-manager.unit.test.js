// Unit tests for workflow-manager.js
const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const { expect } = chai;
chai.use(sinonChai);

// Import modules to test
const workflowManager = require('../workflow-manager');
const store = require('../memory-store');

describe('WorkflowManager - Unit Tests', () => {
  // Jest doesn't use this.timeout, it has its own timeout configuration
  jest.setTimeout(5000);

  // Setup and teardown
  let sandbox;
  
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Mock store methods to prevent actual data operations
    sandbox.stub(store.workflows, 'getById');
    sandbox.stub(store.workflows, 'getActive');
    sandbox.stub(store.workflows, 'getAll');
    sandbox.stub(store.workflows, 'create');
    sandbox.stub(store.workflows, 'update');
    sandbox.stub(store.workflows, 'delete');
    sandbox.stub(store.workflows, 'activate');
    sandbox.stub(store.workflows, 'deactivate');
    
    // Initial stubs with default behavior
    store.workflows.getById.resolves(null);
    store.workflows.getActive.resolves([]);
    store.workflows.getAll.resolves([]);
  });
  
  afterEach(() => {
    sandbox.restore();
  });
  
  describe('Start and Stop Functions', () => {
    it('should start the workflow manager', () => {
      const clearIntervalSpy = sandbox.spy(global, 'clearInterval');
      const setIntervalSpy = sandbox.spy(global, 'setInterval');
      
      // Process scheduled tasks is called on start, so we need to stub it
      sandbox.stub(workflowManager, 'processScheduledTasks').resolves();
      
      workflowManager.start();
      
      expect(setIntervalSpy).to.have.been.calledOnce;
      
      // Now stop the manager to clean up
      workflowManager.stop();
      
      expect(clearIntervalSpy).to.have.been.calledOnce;
    });
    
    it('should stop the workflow manager', () => {
      const clearIntervalSpy = sandbox.spy(global, 'clearInterval');
      
      // First start it
      sandbox.stub(workflowManager, 'processScheduledTasks').resolves();
      workflowManager.start();
      
      // Then stop it
      workflowManager.stop();
      
      expect(clearIntervalSpy).to.have.been.calledOnce;
    });
  });
  
  describe('Task Scheduling and Execution', () => {
    it('should schedule a task', () => {
      const taskId = workflowManager.scheduleTask('workflow1', 'step1', { data: 'test' }, new Date());
      
      expect(taskId).to.be.a('string');
      expect(taskId).to.include('workflow1_step1_');
      expect(workflowManager.scheduledTasks.size).to.be.greaterThan(0);
      
      // Clean up
      workflowManager.scheduledTasks.clear();
    });
    
    it('should process scheduled tasks when they are due', async () => {
      // Setup a task that is due
      const executeTime = new Date(Date.now() - 1000); // 1 second ago
      const executeTaskStub = sandbox.stub(workflowManager, 'executeTask').resolves();
      
      workflowManager.scheduleTask('workflow1', 'step1', { data: 'test' }, executeTime);
      
      // Process tasks
      await workflowManager.processScheduledTasks();
      
      expect(executeTaskStub).to.have.been.calledOnce;
      expect(workflowManager.scheduledTasks.size).to.equal(0);
      
      // Clean up
      workflowManager.scheduledTasks.clear();
    });
    
    it('should not process tasks that are not due yet', async () => {
      // Setup a task that is not due yet
      const futureTime = new Date(Date.now() + 60000); // 1 minute in the future
      const executeTaskStub = sandbox.stub(workflowManager, 'executeTask').resolves();
      
      const taskId = workflowManager.scheduleTask('workflow1', 'step1', { data: 'test' }, futureTime);
      
      // Process tasks
      await workflowManager.processScheduledTasks();
      
      expect(executeTaskStub).not.to.have.been.called;
      expect(workflowManager.scheduledTasks.size).to.equal(1);
      
      // Clean up
      workflowManager.scheduledTasks.clear();
    });
  });
  
  describe('Context Field Access and Condition Evaluation', () => {
    it('should get field values from context correctly', () => {
      const context = {
        lead: {
          name: 'Test Lead',
          phone: '123456789'
        },
        call: {
          disposition: 'no-answer'
        }
      };
      
      expect(workflowManager.getFieldFromContext(context, 'lead.name')).to.equal('Test Lead');
      expect(workflowManager.getFieldFromContext(context, 'call.disposition')).to.equal('no-answer');
      expect(workflowManager.getFieldFromContext(context, 'lead.email')).to.be.undefined;
      expect(workflowManager.getFieldFromContext(context, 'unknown.field')).to.be.undefined;
    });
    
    it('should evaluate conditions correctly', () => {
      // Test equals
      expect(workflowManager.evaluateCondition('test', 'equals', 'test')).to.be.true;
      expect(workflowManager.evaluateCondition('test', 'equals', 'not-test')).to.be.false;
      
      // Test not_equals
      expect(workflowManager.evaluateCondition('test', 'not_equals', 'test')).to.be.false;
      expect(workflowManager.evaluateCondition('test', 'not_equals', 'not-test')).to.be.true;
      
      // Test contains
      expect(workflowManager.evaluateCondition('test string', 'contains', 'test')).to.be.true;
      expect(workflowManager.evaluateCondition('test string', 'contains', 'xyz')).to.be.false;
      
      // Test greater_than and less_than
      expect(workflowManager.evaluateCondition(10, 'greater_than', 5)).to.be.true;
      expect(workflowManager.evaluateCondition(5, 'greater_than', 10)).to.be.false;
      expect(workflowManager.evaluateCondition(5, 'less_than', 10)).to.be.true;
      expect(workflowManager.evaluateCondition(10, 'less_than', 5)).to.be.false;
      
      // Test in
      expect(workflowManager.evaluateCondition('test', 'in', ['test', 'other'])).to.be.true;
      expect(workflowManager.evaluateCondition('xyz', 'in', ['test', 'other'])).to.be.false;
    });
  });
  
  describe('Business Hours Functions', () => {
    let clock;
    
    afterEach(() => {
      if (clock) {
        clock.restore();
      }
    });
    
    it('should check if current time is within business hours', () => {
      // Create a fixed time: Wednesday (3) at 10:00 AM
      clock = sandbox.useFakeTimers(new Date(2025, 2, 5, 10, 0, 0).getTime());
      
      const businessHours = {
        enabled: true,
        days: [1, 2, 3, 4, 5], // Monday to Friday
        start_time: '09:00',
        end_time: '17:00'
      };
      
      expect(workflowManager.isWithinBusinessHours(businessHours)).to.be.true;
      
      // Change to Saturday (6)
      clock.restore();
      clock = sandbox.useFakeTimers(new Date(2025, 2, 8, 10, 0, 0).getTime());
      expect(workflowManager.isWithinBusinessHours(businessHours)).to.be.false;
      
      // Change to Wednesday, but before business hours
      clock.restore();
      clock = sandbox.useFakeTimers(new Date(2025, 2, 5, 8, 0, 0).getTime());
      expect(workflowManager.isWithinBusinessHours(businessHours)).to.be.false;
      
      // Change to Wednesday, but after business hours
      clock.restore();
      clock = sandbox.useFakeTimers(new Date(2025, 2, 5, 18, 0, 0).getTime());
      expect(workflowManager.isWithinBusinessHours(businessHours)).to.be.false;
    });
    
    it('should adjust time for business hours', () => {
      // Start with Wednesday (3) at 8:00 AM (before business hours)
      const businessHours = {
        enabled: true,
        days: [1, 2, 3, 4, 5], // Monday to Friday
        start_time: '09:00',
        end_time: '17:00'
      };
      
      const beforeHours = new Date(2025, 2, 5, 8, 0, 0);
      const adjusted1 = workflowManager.adjustForBusinessHours(beforeHours, businessHours);
      
      // Should be adjusted to 9:00 AM same day
      expect(adjusted1.getHours()).to.equal(9);
      expect(adjusted1.getMinutes()).to.equal(0);
      expect(adjusted1.getDate()).to.equal(5);
      
      // Try with a time after business hours
      const afterHours = new Date(2025, 2, 5, 18, 0, 0);
      
      // Mock the getNextBusinessHoursStartTime function for testing
      const nextDayAt9 = new Date(2025, 2, 6, 9, 0, 0);
      sandbox.stub(workflowManager, 'getNextBusinessHoursStartTime').returns(nextDayAt9);
      
      const adjusted2 = workflowManager.adjustForBusinessHours(afterHours, businessHours);
      
      // Should be adjusted to 9:00 AM next day
      expect(adjusted2.getDate()).to.equal(6);
      expect(adjusted2.getHours()).to.equal(9);
      expect(adjusted2.getMinutes()).to.equal(0);
    });
  });
  
  describe('Step Execution', () => {
    // Sample workflow and steps for testing
    const sampleWorkflow = {
      id: 'test-workflow',
      name: 'Test Workflow',
      active: true,
      steps: [
        {
          id: 'start',
          type: 'start',
          name: 'Start',
          isStart: true,
          next_step: 'step1'
        },
        {
          id: 'step1',
          type: 'call',
          name: 'Make Call',
          properties: { priority: 2 },
          next_step: 'end'
        },
        {
          id: 'end',
          type: 'end',
          name: 'End'
        }
      ]
    };
    
    beforeEach(() => {
      // Set up stubs for various step execution methods
      sandbox.stub(workflowManager, 'executeCallStep').resolves(true);
      sandbox.stub(workflowManager, 'executeWaitStep').resolves(true);
      sandbox.stub(workflowManager, 'executeConditionStep').resolves(true);
      sandbox.stub(workflowManager, 'executeSmsStep').resolves(true);
      sandbox.stub(workflowManager, 'executeCampaignAction').resolves(true);
      sandbox.stub(workflowManager, 'executeEndStep').resolves(true);
      sandbox.stub(workflowManager, 'executeNextStep').resolves(true);
    });
    
    it('should execute a workflow step based on type', async () => {
      const callStep = sampleWorkflow.steps[1]; // The call step
      const context = { lead: { phone_number: '123456789' } };
      
      const result = await workflowManager.executeWorkflowStep(sampleWorkflow, callStep, context);
      
      expect(result).to.be.true;
      expect(workflowManager.executeCallStep).to.have.been.calledWith(sampleWorkflow, callStep, context);
    });
    
    it('should execute the next step in a workflow', async () => {
      const startStep = sampleWorkflow.steps[0]; // The start step
      const context = {};
      
      // Stub the find method of the steps array
      sandbox.stub(sampleWorkflow.steps, 'find').returns(sampleWorkflow.steps[1]);
      
      const result = await workflowManager.executeNextStep(sampleWorkflow, startStep, context);
      
      expect(result).to.be.true;
      expect(workflowManager.executeWorkflowStep).to.have.been.called;
    });
    
    it('should handle a missing next step gracefully', async () => {
      const endStep = sampleWorkflow.steps[2]; // The end step with no next_step
      const context = {};
      
      const result = await workflowManager.executeNextStep(sampleWorkflow, endStep, context);
      
      expect(result).to.be.true;
      expect(workflowManager.executeWorkflowStep).not.to.have.been.called;
    });
  });
  
  describe('Trigger Processing', () => {
    // Sample workflows for testing
    const sampleWorkflows = [
      {
        id: 'workflow1',
        name: 'New Lead Workflow',
        active: true,
        triggers: [
          { type: 'new_lead', priority: 3 }
        ],
        steps: [
          { id: 'start', type: 'start', isStart: true, next_step: 'end' },
          { id: 'end', type: 'end' }
        ]
      },
      {
        id: 'workflow2',
        name: 'Call Disposition Workflow',
        active: true,
        triggers: [
          { type: 'call_disposition', disposition: 'no-answer' }
        ],
        steps: [
          { id: 'start', type: 'start', isStart: true, next_step: 'end' },
          { id: 'end', type: 'end' }
        ]
      }
    ];
    
    beforeEach(() => {
      // Stub the startWorkflow method
      sandbox.stub(workflowManager, 'startWorkflow').resolves(true);
    });
    
    it('should process a new lead trigger', async () => {
      // Set up store stubs
      store.workflows.getActive.resolves(sampleWorkflows);
      
      const leadData = {
        phone_number: '123456789',
        contact_name: 'Test Lead'
      };
      
      const result = await workflowManager.processNewLead(leadData);
      
      expect(result).to.be.true;
      expect(workflowManager.startWorkflow).to.have.been.calledWith(sampleWorkflows[0], { lead: leadData });
    });
    
    it('should process a call disposition trigger', async () => {
      // Set up store stubs
      store.workflows.getActive.resolves(sampleWorkflows);
      
      const callData = {
        disposition: 'no-answer',
        phone_number: '123456789'
      };
      
      const result = await workflowManager.processCallDisposition(callData);
      
      expect(result).to.be.true;
      expect(workflowManager.startWorkflow).to.have.been.calledWith(sampleWorkflows[1], sinon.match.object);
    });
    
    it('should return null when no matching workflows are found', async () => {
      // Set up store stubs
      store.workflows.getActive.resolves([]);
      
      const result = await workflowManager.processNewLead({ phone_number: '123456789' });
      
      expect(result).to.be.null;
      expect(workflowManager.startWorkflow).not.to.have.been.called;
    });
  });
  
  describe('Workflow Starting and Execution', () => {
    const sampleWorkflow = {
      id: 'test-workflow',
      name: 'Test Workflow',
      active: true,
      steps: [
        {
          id: 'start',
          type: 'start',
          name: 'Start',
          isStart: true,
          next_step: 'step1'
        },
        {
          id: 'step1',
          type: 'call',
          name: 'Make Call',
          properties: { priority: 2 },
          next_step: 'end'
        },
        {
          id: 'end',
          type: 'end',
          name: 'End'
        }
      ]
    };
    
    it('should start a workflow and execute the start step', async () => {
      // Stub the executeWorkflowStep method
      sandbox.stub(workflowManager, 'executeWorkflowStep').resolves(true);
      
      const context = { lead: { phone_number: '123456789' } };
      const result = await workflowManager.startWorkflow(sampleWorkflow, context);
      
      expect(result).to.be.true;
      expect(workflowManager.executeWorkflowStep).to.have.been.calledWith(
        sampleWorkflow, 
        sampleWorkflow.steps[0], 
        context
      );
    });
    
    it('should return false when a workflow has no start step', async () => {
      // Create a workflow with no start step
      const badWorkflow = {
        id: 'bad-workflow',
        name: 'Bad Workflow',
        active: true,
        steps: [
          {
            id: 'step1',
            type: 'call',
            name: 'Make Call',
            next_step: 'end'
          },
          {
            id: 'end',
            type: 'end',
            name: 'End'
          }
        ]
      };
      
      // Stub the executeWorkflowStep method
      sandbox.stub(workflowManager, 'executeWorkflowStep').resolves(true);
      
      const context = { lead: { phone_number: '123456789' } };
      const result = await workflowManager.startWorkflow(badWorkflow, context);
      
      expect(result).to.be.false;
      expect(workflowManager.executeWorkflowStep).not.to.have.been.called;
    });
  });
});