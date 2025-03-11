/**
 * Agent Status Service Tests
 * 
 * This file contains tests for the Agent Status Service, which provides
 * functionality for managing agent statuses, transitions, and tracking.
 */

const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const { expect } = chai;
chai.use(sinonChai);

// Import module to test
const agentStatusService = require('../services/agent-status-service');
const store = require('../memory-store');
const errorService = require('../services/error-service');
const featureFlags = require('../services/feature-flags');

describe('Agent Status Service', () => {
  let sandbox;
  let clock;
  
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Mock store methods
    sandbox.stub(store.agentStatus, 'getByUserId');
    sandbox.stub(store.agentStatus, 'updateStatus');
    sandbox.stub(store.agentStatus, 'getAllWithUserInfo');
    
    // Mock error service
    sandbox.stub(errorService, 'handleError').returns({
      message: 'Error handled'
    });
    sandbox.stub(errorService, 'createValidationError').callsFake((message) => {
      const error = new Error(message);
      error.name = 'ValidationError';
      return error;
    });
    
    // Mock feature flags service
    sandbox.stub(featureFlags, 'isFeatureEnabled');
    sandbox.stub(featureFlags, 'getFeatureValue');
    
    // Mock console.log to prevent noise in tests
    sandbox.stub(console, 'log');
    
    // Clear any agents in after call work from previous tests
    // This is a trick to reset the Map in the agent-status-service module
    const agentsInAfterCallWork = agentStatusService.getAfterCallWorkAgents?.() || new Map();
    agentsInAfterCallWork.clear();
  });
  
  afterEach(() => {
    if (clock) {
      clock.restore();
    }
    sandbox.restore();
  });
  
  describe('Constants', () => {
    it('should export agent status constants', () => {
      expect(agentStatusService.AgentStatuses).to.be.an('object');
      expect(agentStatusService.AgentStatuses.AVAILABLE).to.equal('Available');
      expect(agentStatusService.AgentStatuses.UNAVAILABLE).to.equal('Unavailable');
      expect(agentStatusService.AgentStatuses.OFFLINE).to.equal('Offline');
      expect(agentStatusService.AgentStatuses.BUSY).to.equal('Busy');
      expect(agentStatusService.AgentStatuses.AFTER_CALL_WORK).to.equal('After Call Work');
    });
    
    it('should export valid status transitions', () => {
      expect(agentStatusService.ValidStatusTransitions).to.be.an('object');
      
      const availableTransitions = agentStatusService.ValidStatusTransitions[agentStatusService.AgentStatuses.AVAILABLE];
      expect(availableTransitions).to.be.an('array');
      expect(availableTransitions).to.include(agentStatusService.AgentStatuses.UNAVAILABLE);
      expect(availableTransitions).to.include(agentStatusService.AgentStatuses.BUSY);
    });
  });
  
  describe('initialize()', () => {
    beforeEach(() => {
      // Stub setInterval to prevent actual timer creation
      sandbox.stub(global, 'setInterval').returns(123);
    });
    
    it('should initialize the agent status service', async () => {
      const result = await agentStatusService.initialize();
      
      expect(result).to.be.true;
      expect(global.setInterval).to.have.been.calledOnce;
      expect(global.setInterval).to.have.been.calledWith(
        sinon.match.func,
        10000
      );
      expect(console.log).to.have.been.calledWith('Agent status service initialized');
    });
    
    it('should handle initialization errors', async () => {
      // Make setInterval throw an error
      global.setInterval.throws(new Error('Initialization error'));
      
      const result = await agentStatusService.initialize();
      
      expect(result).to.be.false;
      expect(errorService.handleError).to.have.been.calledOnce;
      expect(errorService.handleError).to.have.been.calledWith(
        sinon.match.instanceOf(Error),
        'agent-status-service.initialize'
      );
    });
  });
  
  describe('updateAgentStatus()', () => {
    it('should update agent status successfully', async () => {
      // Mock current status
      store.agentStatus.getByUserId.resolves({
        user_id: '123',
        status: agentStatusService.AgentStatuses.AVAILABLE,
        last_status_change: new Date().toISOString()
      });
      
      // Mock feature flag
      featureFlags.isFeatureEnabled.resolves(true);
      
      // Mock store update
      store.agentStatus.updateStatus.resolves({
        user_id: '123',
        status: agentStatusService.AgentStatuses.BUSY,
        last_status_change: new Date().toISOString()
      });
      
      const result = await agentStatusService.updateAgentStatus('123', agentStatusService.AgentStatuses.BUSY);
      
      expect(result).to.be.an('object');
      expect(result.success).to.be.true;
      expect(result.userId).to.equal('123');
      expect(result.previousStatus).to.equal(agentStatusService.AgentStatuses.AVAILABLE);
      expect(result.newStatus).to.equal(agentStatusService.AgentStatuses.BUSY);
      expect(result.isAutomatic).to.be.false;
      
      expect(store.agentStatus.updateStatus).to.have.been.calledWith('123', agentStatusService.AgentStatuses.BUSY);
    });
    
    it('should reject invalid status', async () => {
      errorService.createValidationError.returns(new Error('Invalid status'));
      
      const result = await agentStatusService.updateAgentStatus('123', 'InvalidStatus');
      
      expect(result).to.be.an('object');
      expect(result.success).to.be.false;
      expect(result.error).to.equal('Error handled');
      expect(errorService.handleError).to.have.been.calledOnce;
    });
    
    it('should validate status transitions when enabled', async () => {
      // Mock current status
      store.agentStatus.getByUserId.resolves({
        user_id: '123',
        status: agentStatusService.AgentStatuses.OFFLINE,
        last_status_change: new Date().toISOString()
      });
      
      // Enable status validation
      featureFlags.isFeatureEnabled.resolves(true);
      
      // Try an invalid transition (OFFLINE -> BUSY)
      const result = await agentStatusService.updateAgentStatus('123', agentStatusService.AgentStatuses.BUSY);
      
      expect(result.success).to.be.false;
      expect(errorService.createValidationError).to.have.been.calledWith(
        sinon.match.string.and(sinon.match(/Invalid status transition/))
      );
    });
    
    it('should bypass transition validation for automatic transitions', async () => {
      // Mock current status
      store.agentStatus.getByUserId.resolves({
        user_id: '123',
        status: agentStatusService.AgentStatuses.OFFLINE,
        last_status_change: new Date().toISOString()
      });
      
      // Enable status validation
      featureFlags.isFeatureEnabled.resolves(true);
      
      // Mock store update
      store.agentStatus.updateStatus.resolves({
        user_id: '123',
        status: agentStatusService.AgentStatuses.BUSY,
        last_status_change: new Date().toISOString()
      });
      
      // Try the same invalid transition but mark it as automatic
      const result = await agentStatusService.updateAgentStatus('123', agentStatusService.AgentStatuses.BUSY, true);
      
      expect(result.success).to.be.true;
      expect(result.isAutomatic).to.be.true;
      expect(store.agentStatus.updateStatus).to.have.been.calledWith('123', agentStatusService.AgentStatuses.BUSY);
    });
    
    it('should skip transition validation when disabled', async () => {
      // Mock current status
      store.agentStatus.getByUserId.resolves({
        user_id: '123',
        status: agentStatusService.AgentStatuses.OFFLINE,
        last_status_change: new Date().toISOString()
      });
      
      // Disable status validation
      featureFlags.isFeatureEnabled.resolves(false);
      
      // Mock store update
      store.agentStatus.updateStatus.resolves({
        user_id: '123',
        status: agentStatusService.AgentStatuses.BUSY,
        last_status_change: new Date().toISOString()
      });
      
      // Try an invalid transition, but validation is disabled
      const result = await agentStatusService.updateAgentStatus('123', agentStatusService.AgentStatuses.BUSY);
      
      expect(result.success).to.be.true;
      expect(store.agentStatus.updateStatus).to.have.been.calledWith('123', agentStatusService.AgentStatuses.BUSY);
    });
    
    it('should track agents in After Call Work', async () => {
      // Mock current status
      store.agentStatus.getByUserId.resolves({
        user_id: '123',
        status: agentStatusService.AgentStatuses.BUSY,
        last_status_change: new Date().toISOString()
      });
      
      // Mock feature flag
      featureFlags.isFeatureEnabled.resolves(true);
      
      // Mock store update
      store.agentStatus.updateStatus.resolves({
        user_id: '123',
        status: agentStatusService.AgentStatuses.AFTER_CALL_WORK,
        last_status_change: new Date().toISOString()
      });
      
      // Create a fake timer to control Date.now()
      clock = sinon.useFakeTimers(new Date('2025-01-01T12:00:00Z'));
      
      await agentStatusService.updateAgentStatus('123', agentStatusService.AgentStatuses.AFTER_CALL_WORK);
      
      // Since we don't have direct access to the agentsInAfterCallWork Map, we need to test
      // the behavior indirectly by triggering the checkAfterCallWorkTimeouts method
      // and observing its effects
      
      // Set up auto-transition
      featureFlags.isFeatureEnabled.withArgs('agentStatus.autoTransitionFromACW').resolves(true);
      featureFlags.getFeatureValue.withArgs('agentStatus.acwTimeoutMinutes', 5).resolves(5);
      
      // Make the time advance past the timeout
      clock.tick(6 * 60 * 1000); // 6 minutes
      
      // Call the check method (normally called by setInterval)
      await agentStatusService.checkAfterCallWorkTimeouts?.();
      
      // Verify that updateStatus was called to transition the agent to Available
      expect(store.agentStatus.updateStatus).to.have.been.calledWith(
        '123', 
        agentStatusService.AgentStatuses.AVAILABLE
      );
    });
  });
  
  describe('checkAfterCallWorkTimeouts()', () => {
    beforeEach(() => {
      // Create a fake timer to control Date.now()
      clock = sinon.useFakeTimers(new Date('2025-01-01T12:00:00Z'));
    });
    
    it('should not transition agents when feature is disabled', async () => {
      // Set up feature flags
      featureFlags.isFeatureEnabled.withArgs('agentStatus.autoTransitionFromACW').resolves(false);
      
      // Set up a spy on updateAgentStatus
      const updateSpy = sandbox.spy(agentStatusService, 'updateAgentStatus');
      
      // Call the check method
      await agentStatusService.checkAfterCallWorkTimeouts();
      
      // Verify updateAgentStatus was not called
      expect(updateSpy).not.to.have.been.called;
    });
    
    it('should transition agents who exceed the timeout', async () => {
      // Set up feature flags
      featureFlags.isFeatureEnabled.withArgs('agentStatus.autoTransitionFromACW').resolves(true);
      featureFlags.getFeatureValue.withArgs('agentStatus.acwTimeoutMinutes', 5).resolves(5);
      
      // Mock store methods for updateAgentStatus
      store.agentStatus.getByUserId.resolves({
        user_id: '123',
        status: agentStatusService.AgentStatuses.AFTER_CALL_WORK,
        last_status_change: new Date().toISOString()
      });
      
      store.agentStatus.updateStatus.resolves({
        user_id: '123',
        status: agentStatusService.AgentStatuses.AVAILABLE,
        last_status_change: new Date().toISOString()
      });
      
      // Set up a test agent in ACW (directly call the method to bypass private variable)
      await agentStatusService.updateAgentStatus('123', agentStatusService.AgentStatuses.AFTER_CALL_WORK);
      
      // Advance time past the timeout
      clock.tick(6 * 60 * 1000); // 6 minutes
      
      // Call the check method
      await agentStatusService.checkAfterCallWorkTimeouts();
      
      // Verify the agent was transitioned to Available
      expect(store.agentStatus.updateStatus).to.have.been.calledWith(
        '123', 
        agentStatusService.AgentStatuses.AVAILABLE
      );
    });
    
    it('should not transition agents who have not exceeded the timeout', async () => {
      // Set up feature flags
      featureFlags.isFeatureEnabled.withArgs('agentStatus.autoTransitionFromACW').resolves(true);
      featureFlags.getFeatureValue.withArgs('agentStatus.acwTimeoutMinutes', 5).resolves(5);
      
      // Set up a spy on updateAgentStatus
      const updateSpy = sandbox.spy(agentStatusService, 'updateAgentStatus');
      
      // Set up a test agent in ACW (directly call the method to bypass private variable)
      await agentStatusService.updateAgentStatus('123', agentStatusService.AgentStatuses.AFTER_CALL_WORK);
      
      // Reset the spy to clear the call from the setup
      updateSpy.resetHistory();
      
      // Advance time, but not past the timeout
      clock.tick(4 * 60 * 1000); // 4 minutes
      
      // Call the check method
      await agentStatusService.checkAfterCallWorkTimeouts();
      
      // Verify the agent was NOT transitioned
      expect(updateSpy).not.to.have.been.calledWith(
        '123', 
        agentStatusService.AgentStatuses.AVAILABLE,
        true
      );
    });
    
    it('should handle errors during timeout checking', async () => {
      // Set up feature flags
      featureFlags.isFeatureEnabled.withArgs('agentStatus.autoTransitionFromACW').resolves(true);
      featureFlags.getFeatureValue.throws(new Error('Feature flag error'));
      
      // Call the check method
      await agentStatusService.checkAfterCallWorkTimeouts();
      
      // Verify error was handled
      expect(errorService.handleError).to.have.been.calledWith(
        sinon.match.instanceOf(Error),
        'agent-status-service.checkAfterCallWorkTimeouts'
      );
    });
  });
  
  describe('getTimeInStatus()', () => {
    beforeEach(() => {
      // Create a fake timer to control Date.now()
      clock = sinon.useFakeTimers(new Date('2025-01-01T12:30:00Z'));
    });
    
    it('should calculate time in status correctly', async () => {
      // Mock agent status
      store.agentStatus.getByUserId.resolves({
        user_id: '123',
        status: agentStatusService.AgentStatuses.BUSY,
        last_status_change: new Date('2025-01-01T12:00:00Z').toISOString() // 30 minutes ago
      });
      
      const result = await agentStatusService.getTimeInStatus('123');
      
      expect(result).to.be.an('object');
      expect(result.success).to.be.true;
      expect(result.userId).to.equal('123');
      expect(result.status).to.equal(agentStatusService.AgentStatuses.BUSY);
      expect(result.timeInStatusMs).to.equal(30 * 60 * 1000); // 30 minutes in ms
      expect(result.timeInStatusMinutes).to.equal(30);
    });
    
    it('should handle agent not found', async () => {
      // Mock agent status not found
      store.agentStatus.getByUserId.resolves(null);
      
      const result = await agentStatusService.getTimeInStatus('unknown');
      
      expect(result).to.be.an('object');
      expect(result.success).to.be.false;
      expect(result.error).to.equal('Agent status not found');
    });
    
    it('should handle errors', async () => {
      // Make getByUserId throw an error
      store.agentStatus.getByUserId.rejects(new Error('Database error'));
      
      const result = await agentStatusService.getTimeInStatus('123');
      
      expect(result).to.be.an('object');
      expect(result.success).to.be.false;
      expect(result.error).to.equal('Error handled');
      expect(errorService.handleError).to.have.been.calledWith(
        sinon.match.instanceOf(Error),
        'agent-status-service.getTimeInStatus'
      );
    });
  });
  
  describe('getAgentsByStatus()', () => {
    it('should return agents with the specified status', async () => {
      // Mock getAllWithUserInfo
      const mockAgents = [
        { user_id: '1', name: 'Agent 1', status: 'Available' },
        { user_id: '2', name: 'Agent 2', status: 'Busy' },
        { user_id: '3', name: 'Agent 3', status: 'Available' }
      ];
      store.agentStatus.getAllWithUserInfo.resolves(mockAgents);
      
      const result = await agentStatusService.getAgentsByStatus('Available');
      
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(2);
      expect(result[0].user_id).to.equal('1');
      expect(result[1].user_id).to.equal('3');
    });
    
    it('should return empty array when no agents match', async () => {
      // Mock getAllWithUserInfo
      const mockAgents = [
        { user_id: '1', name: 'Agent 1', status: 'Available' },
        { user_id: '2', name: 'Agent 2', status: 'Busy' }
      ];
      store.agentStatus.getAllWithUserInfo.resolves(mockAgents);
      
      const result = await agentStatusService.getAgentsByStatus('Offline');
      
      expect(result).to.be.an('array');
      expect(result).to.be.empty;
    });
    
    it('should handle errors', async () => {
      // Make getAllWithUserInfo throw an error
      store.agentStatus.getAllWithUserInfo.rejects(new Error('Database error'));
      
      const result = await agentStatusService.getAgentsByStatus('Available');
      
      expect(result).to.be.an('array');
      expect(result).to.be.empty;
      expect(errorService.handleError).to.have.been.calledWith(
        sinon.match.instanceOf(Error),
        'agent-status-service.getAgentsByStatus'
      );
    });
  });
  
  describe('getAgentsInStatusLongerThan()', () => {
    beforeEach(() => {
      // Create a fake timer to control Date.now()
      clock = sinon.useFakeTimers(new Date('2025-01-01T12:30:00Z'));
    });
    
    it('should return agents in status longer than specified time', async () => {
      // Mock getAgentsByStatus
      sandbox.stub(agentStatusService, 'getAgentsByStatus').resolves([
        { user_id: '1', name: 'Agent 1', status: 'Busy', last_status_change: new Date('2025-01-01T12:00:00Z').toISOString() }, // 30 min
        { user_id: '2', name: 'Agent 2', status: 'Busy', last_status_change: new Date('2025-01-01T12:20:00Z').toISOString() }, // 10 min
        { user_id: '3', name: 'Agent 3', status: 'Busy', last_status_change: new Date('2025-01-01T11:30:00Z').toISOString() }  // 60 min
      ]);
      
      const result = await agentStatusService.getAgentsInStatusLongerThan('Busy', 15);
      
      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(2);
      expect(result[0].user_id).to.equal('1'); // 30 min
      expect(result[1].user_id).to.equal('3'); // 60 min
    });
    
    it('should return empty array when no agents exceed time threshold', async () => {
      // Mock getAgentsByStatus
      sandbox.stub(agentStatusService, 'getAgentsByStatus').resolves([
        { user_id: '1', name: 'Agent 1', status: 'Busy', last_status_change: new Date('2025-01-01T12:20:00Z').toISOString() }, // 10 min
        { user_id: '2', name: 'Agent 2', status: 'Busy', last_status_change: new Date('2025-01-01T12:25:00Z').toISOString() }  // 5 min
      ]);
      
      const result = await agentStatusService.getAgentsInStatusLongerThan('Busy', 15);
      
      expect(result).to.be.an('array');
      expect(result).to.be.empty;
    });
    
    it('should handle errors', async () => {
      // Make getAgentsByStatus throw an error
      sandbox.stub(agentStatusService, 'getAgentsByStatus').throws(new Error('Service error'));
      
      const result = await agentStatusService.getAgentsInStatusLongerThan('Busy', 15);
      
      expect(result).to.be.an('array');
      expect(result).to.be.empty;
      expect(errorService.handleError).to.have.been.calledWith(
        sinon.match.instanceOf(Error),
        'agent-status-service.getAgentsInStatusLongerThan'
      );
    });
  });
});