/**
 * Rules Manager Tests
 * 
 * This file contains tests for the Rules Manager, which handles
 * call center rules, schedules, and business logic for call processing.
 */

const chai = require('chai');
const sinon = require('sinon');
const { expect } = chai;

// Import module to test
const rulesManager = require('../rules-manager');
const store = require('../memory-store');

describe('Rules Manager', () => {
  let sandbox;
  let clock;
  let originalRules;
  
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Save original rules to restore later
    originalRules = { ...rulesManager.rules };
    
    // Mock store methods if needed
    sandbox.stub(store, 'calls');
  });
  
  afterEach(() => {
    if (clock) {
      clock.restore();
    }
    
    sandbox.restore();
    
    // Restore original rules after each test
    rulesManager.rules = { ...originalRules };
  });
  
  describe('getRules()', () => {
    it('should return a copy of all rules', () => {
      const rules = rulesManager.getRules();
      
      // Verify it's a copy (not a reference)
      expect(rules).to.deep.equal(rulesManager.rules);
      expect(rules).to.not.equal(rulesManager.rules);
      
      // Verify the structure of the rules
      expect(rules).to.have.property('newLeadRule');
      expect(rules).to.have.property('noAnswerRetryRule');
      expect(rules).to.have.property('callCenterHours');
    });
  });
  
  describe('updateRules()', () => {
    it('should update rules correctly', () => {
      const newRules = {
        newLeadRule: {
          enabled: true,
          priority: 5
        }
      };
      
      const result = rulesManager.updateRules(newRules);
      
      // Verify rules were updated
      expect(rulesManager.rules.newLeadRule.enabled).to.equal(true);
      expect(rulesManager.rules.newLeadRule.priority).to.equal(5);
      
      // Verify other rules remain unchanged
      expect(rulesManager.rules.noAnswerRetryRule).to.deep.equal(originalRules.noAnswerRetryRule);
      
      // Verify return value is updated rules
      expect(result).to.equal(rulesManager.rules);
    });
    
    it('should merge with existing rules', () => {
      const newRules = {
        noAnswerRetryRule: {
          retryDelayMinutes: 45
        }
      };
      
      rulesManager.updateRules(newRules);
      
      // Verify only specified properties were updated
      expect(rulesManager.rules.noAnswerRetryRule.retryDelayMinutes).to.equal(45);
      expect(rulesManager.rules.noAnswerRetryRule.enabled).to.equal(originalRules.noAnswerRetryRule.enabled);
      expect(rulesManager.rules.noAnswerRetryRule.maxRetries).to.equal(originalRules.noAnswerRetryRule.maxRetries);
    });
  });
  
  describe('isWithinCallCenterHours()', () => {
    it('should return true when call center hours are disabled', () => {
      // Disable call center hours
      rulesManager.updateRules({
        callCenterHours: {
          enabled: false
        }
      });
      
      const result = rulesManager.isWithinCallCenterHours();
      
      expect(result).to.be.true;
    });
    
    it('should return true when current time is within call center hours', () => {
      // Configure call center hours
      rulesManager.updateRules({
        callCenterHours: {
          enabled: true,
          timezone: 'America/New_York',
          workDays: [1, 2, 3, 4, 5], // Monday to Friday
          startTime: '09:00',
          endTime: '17:00'
        }
      });
      
      // Set a fake date/time: Wednesday (3) at 2 PM
      const wednesday2PM = new Date('2025-01-08T14:00:00-05:00'); // A Wednesday in EST
      clock = sinon.useFakeTimers(wednesday2PM);
      
      // Create stubs for date methods to ensure consistent behavior
      const dayStub = sandbox.stub(Date.prototype, 'toLocaleDateString');
      dayStub.returns('Wednesday'); // 3 = Wednesday
      
      const timeStub = sandbox.stub(Date.prototype, 'toLocaleTimeString');
      timeStub.returns('14:00'); // 2 PM
      
      const result = rulesManager.isWithinCallCenterHours();
      
      expect(result).to.be.true;
    });
    
    it('should return false when current time is outside call center hours', () => {
      // Configure call center hours
      rulesManager.updateRules({
        callCenterHours: {
          enabled: true,
          timezone: 'America/New_York',
          workDays: [1, 2, 3, 4, 5], // Monday to Friday
          startTime: '09:00',
          endTime: '17:00'
        }
      });
      
      // Set a fake date/time: Wednesday at 8 PM
      const wednesday8PM = new Date('2025-01-08T20:00:00-05:00');
      clock = sinon.useFakeTimers(wednesday8PM);
      
      // Create stubs for date methods to ensure consistent behavior
      const dayStub = sandbox.stub(Date.prototype, 'toLocaleDateString');
      dayStub.returns('Wednesday');
      
      const timeStub = sandbox.stub(Date.prototype, 'toLocaleTimeString');
      timeStub.returns('20:00'); // 8 PM
      
      const result = rulesManager.isWithinCallCenterHours();
      
      expect(result).to.be.false;
    });
    
    it('should return false when current day is not a work day', () => {
      // Configure call center hours
      rulesManager.updateRules({
        callCenterHours: {
          enabled: true,
          timezone: 'America/New_York',
          workDays: [1, 2, 3, 4, 5], // Monday to Friday
          startTime: '09:00',
          endTime: '17:00'
        }
      });
      
      // Set a fake date/time: Sunday at 10 AM
      const sunday10AM = new Date('2025-01-05T10:00:00-05:00');
      clock = sinon.useFakeTimers(sunday10AM);
      
      // Create stubs for date methods to ensure consistent behavior
      const dayStub = sandbox.stub(Date.prototype, 'toLocaleDateString');
      dayStub.returns('Sunday');
      
      const timeStub = sandbox.stub(Date.prototype, 'toLocaleTimeString');
      timeStub.returns('10:00'); // 10 AM
      
      const result = rulesManager.isWithinCallCenterHours();
      
      expect(result).to.be.false;
    });
  });
  
  describe('isTimeWithinCallCenterHours()', () => {
    it('should return true when call center hours are disabled', () => {
      // Disable call center hours
      rulesManager.updateRules({
        callCenterHours: {
          enabled: false
        }
      });
      
      const time = new Date();
      const result = rulesManager.isTimeWithinCallCenterHours(time);
      
      expect(result).to.be.true;
    });
    
    it('should return true when specified time is within call center hours', () => {
      // Configure call center hours
      rulesManager.updateRules({
        callCenterHours: {
          enabled: true,
          timezone: 'America/New_York',
          workDays: [1, 2, 3, 4, 5], // Monday to Friday
          startTime: '09:00',
          endTime: '17:00'
        }
      });
      
      // Create a test time: Wednesday at 2 PM
      const wednesday2PM = new Date('2025-01-08T14:00:00-05:00');
      
      // Create stubs for date methods to ensure consistent behavior
      const dayStub = sandbox.stub(Date.prototype, 'toLocaleDateString');
      dayStub.returns('Wednesday');
      
      const timeStub = sandbox.stub(Date.prototype, 'toLocaleTimeString');
      timeStub.returns('14:00'); // 2 PM
      
      const result = rulesManager.isTimeWithinCallCenterHours(wednesday2PM);
      
      expect(result).to.be.true;
    });
    
    it('should return false when specified time is outside call center hours', () => {
      // Configure call center hours
      rulesManager.updateRules({
        callCenterHours: {
          enabled: true,
          timezone: 'America/New_York',
          workDays: [1, 2, 3, 4, 5], // Monday to Friday
          startTime: '09:00',
          endTime: '17:00'
        }
      });
      
      // Create a test time: Wednesday at 8 PM
      const wednesday8PM = new Date('2025-01-08T20:00:00-05:00');
      
      // Create stubs for date methods to ensure consistent behavior
      const dayStub = sandbox.stub(Date.prototype, 'toLocaleDateString');
      dayStub.returns('Wednesday');
      
      const timeStub = sandbox.stub(Date.prototype, 'toLocaleTimeString');
      timeStub.returns('20:00'); // 8 PM
      
      const result = rulesManager.isTimeWithinCallCenterHours(wednesday8PM);
      
      expect(result).to.be.false;
    });
    
    it('should return false when specified day is not a work day', () => {
      // Configure call center hours
      rulesManager.updateRules({
        callCenterHours: {
          enabled: true,
          timezone: 'America/New_York',
          workDays: [1, 2, 3, 4, 5], // Monday to Friday
          startTime: '09:00',
          endTime: '17:00'
        }
      });
      
      // Create a test time: Sunday at 10 AM
      const sunday10AM = new Date('2025-01-05T10:00:00-05:00');
      
      // Create stubs for date methods to ensure consistent behavior
      const dayStub = sandbox.stub(Date.prototype, 'toLocaleDateString');
      dayStub.returns('Sunday');
      
      const timeStub = sandbox.stub(Date.prototype, 'toLocaleTimeString');
      timeStub.returns('10:00'); // 10 AM
      
      const result = rulesManager.isTimeWithinCallCenterHours(sunday10AM);
      
      expect(result).to.be.false;
    });
  });
  
  describe('getNextCallCenterStartTime()', () => {
    beforeEach(() => {
      // Configure call center hours
      rulesManager.updateRules({
        callCenterHours: {
          enabled: true,
          timezone: 'America/New_York',
          workDays: [1, 2, 3, 4, 5], // Monday to Friday
          startTime: '09:00',
          endTime: '17:00'
        }
      });
    });
    
    it('should return next day at start time when current day is a work day', () => {
      // Create a test time: Wednesday at 2 PM
      const wednesday2PM = new Date('2025-01-08T14:00:00-05:00');
      
      // Set up Thurs 9 AM for next day
      const expectedTime = new Date('2025-01-09T09:00:00-05:00');
      
      // Stub for toLocaleDateString to handle timezone determination
      const dayStub = sandbox.stub(Date.prototype, 'toLocaleDateString');
      dayStub.onCall(0).returns('Thursday'); // Next day is Thursday
      
      const result = rulesManager.getNextCallCenterStartTime(wednesday2PM);
      
      expect(result.getHours()).to.equal(9);
      expect(result.getMinutes()).to.equal(0);
      expect(result.getDate()).to.equal(wednesday2PM.getDate() + 1);
    });
    
    it('should skip weekend and return Monday when starting from Friday', () => {
      // Create a test time: Friday at 5 PM
      const friday5PM = new Date('2025-01-10T17:00:00-05:00');
      
      // Stubs to simulate weekend and Monday
      const dayStub = sandbox.stub(Date.prototype, 'toLocaleDateString');
      
      // Saturday -> Should be skipped
      dayStub.onCall(0).returns('Saturday');
      
      // Sunday -> Should be skipped
      dayStub.onCall(1).returns('Sunday');
      
      // Monday -> Should be returned
      dayStub.onCall(2).returns('Monday');
      
      const result = rulesManager.getNextCallCenterStartTime(friday5PM);
      
      // Verify the result is Monday at 9 AM (3 days after Friday)
      expect(result.getDate()).to.equal(friday5PM.getDate() + 3);
      expect(result.getHours()).to.equal(9);
      expect(result.getMinutes()).to.equal(0);
    });
  });
  
  describe('calculateNextRetryTime()', () => {
    beforeEach(() => {
      // Configure default rules
      rulesManager.updateRules({
        noAnswerRetryRule: {
          enabled: true,
          retryDelayMinutes: 30,
          maxRetries: 3,
          respectCallCenterHours: true
        },
        callCenterHours: {
          enabled: true,
          timezone: 'America/New_York',
          workDays: [1, 2, 3, 4, 5], // Monday to Friday
          startTime: '09:00',
          endTime: '17:00'
        }
      });
      
      // Set up fake time
      clock = sinon.useFakeTimers(new Date('2025-01-08T14:00:00-05:00')); // Wednesday 2 PM
    });
    
    it('should add retry delay when within call center hours', () => {
      // Stub isTimeWithinCallCenterHours to always return true
      sandbox.stub(rulesManager, 'isTimeWithinCallCenterHours').returns(true);
      
      const call = { id: 'call123', retry_count: 0 };
      const result = rulesManager.calculateNextRetryTime(call);
      
      // Verify result is 30 minutes in the future
      const now = new Date();
      const expectedTime = new Date(now.getTime() + 30 * 60 * 1000);
      
      expect(result.getTime()).to.equal(expectedTime.getTime());
    });
    
    it('should schedule for next call center start time when retry would be outside hours', () => {
      // Configure for end of day test
      clock = sinon.useFakeTimers(new Date('2025-01-08T16:45:00-05:00')); // Wednesday 4:45 PM
      
      // Stub isTimeWithinCallCenterHours
      const isTimeWithinCallCenterHoursStub = sandbox.stub(rulesManager, 'isTimeWithinCallCenterHours');
      isTimeWithinCallCenterHoursStub.onCall(0).returns(false); // First check fails (30 min later = 5:15 PM)
      
      // Stub getNextCallCenterStartTime
      const nextStartTime = new Date('2025-01-09T09:00:00-05:00'); // Thursday 9 AM
      const getNextCallCenterStartTimeStub = sandbox.stub(rulesManager, 'getNextCallCenterStartTime');
      getNextCallCenterStartTimeStub.returns(nextStartTime);
      
      const call = { id: 'call123', retry_count: 0 };
      const result = rulesManager.calculateNextRetryTime(call);
      
      // Verify result is next day at 9 AM
      expect(result.getTime()).to.equal(nextStartTime.getTime());
    });
    
    it('should not adjust time when respectCallCenterHours is false', () => {
      // Update rules to not respect call center hours
      rulesManager.updateRules({
        noAnswerRetryRule: {
          respectCallCenterHours: false
        }
      });
      
      // Even with this stub returning false, the time should not be adjusted
      sandbox.stub(rulesManager, 'isTimeWithinCallCenterHours').returns(false);
      
      const call = { id: 'call123', retry_count: 0 };
      const result = rulesManager.calculateNextRetryTime(call);
      
      // Verify result is exactly 30 minutes in the future
      const now = new Date();
      const expectedTime = new Date(now.getTime() + 30 * 60 * 1000);
      
      expect(result.getTime()).to.equal(expectedTime.getTime());
    });
  });
  
  describe('processNewLead()', () => {
    beforeEach(() => {
      // Set a default time for testing
      clock = sinon.useFakeTimers(new Date('2025-01-08T14:00:00-05:00')); // Wednesday 2 PM
    });
    
    it('should return null when newLeadRule is disabled', () => {
      // Ensure rule is disabled
      rulesManager.updateRules({
        newLeadRule: {
          enabled: false
        }
      });
      
      const leadData = { phone_number: '+15551234567', name: 'Test Lead' };
      const result = rulesManager.processNewLead(leadData);
      
      expect(result).to.be.null;
    });
    
    it('should add priority when within call center hours', () => {
      // Enable rule
      rulesManager.updateRules({
        newLeadRule: {
          enabled: true,
          priority: 5
        }
      });
      
      // Ensure we're within call center hours
      sandbox.stub(rulesManager, 'isWithinCallCenterHours').returns(true);
      
      const leadData = { phone_number: '+15551234567', name: 'Test Lead' };
      const result = rulesManager.processNewLead(leadData);
      
      expect(result).to.include(leadData);
      expect(result.priority).to.equal(5);
      expect(result).to.not.have.property('scheduled_for');
    });
    
    it('should schedule for next call center start time when outside hours', () => {
      // Enable rule
      rulesManager.updateRules({
        newLeadRule: {
          enabled: true,
          priority: 5
        },
        callCenterHours: {
          enabled: true
        }
      });
      
      // Configure to be outside call center hours
      sandbox.stub(rulesManager, 'isWithinCallCenterHours').returns(false);
      
      // Set up next start time
      const nextStartTime = new Date('2025-01-09T09:00:00-05:00'); // Thursday 9 AM
      sandbox.stub(rulesManager, 'getNextCallCenterStartTime').returns(nextStartTime);
      
      const leadData = { phone_number: '+15551234567', name: 'Test Lead' };
      const result = rulesManager.processNewLead(leadData);
      
      expect(result).to.include(leadData);
      expect(result.priority).to.equal(5);
      expect(result.scheduled_for).to.equal(nextStartTime.toISOString());
    });
    
    it('should ignore call center hours when they are disabled', () => {
      // Enable lead rule but disable call center hours
      rulesManager.updateRules({
        newLeadRule: {
          enabled: true,
          priority: 5
        },
        callCenterHours: {
          enabled: false
        }
      });
      
      const leadData = { phone_number: '+15551234567', name: 'Test Lead' };
      const result = rulesManager.processNewLead(leadData);
      
      expect(result).to.include(leadData);
      expect(result.priority).to.equal(5);
      expect(result).to.not.have.property('scheduled_for');
    });
  });
  
  describe('processNoAnswerCall()', () => {
    beforeEach(() => {
      // Set a default time for testing
      clock = sinon.useFakeTimers(new Date('2025-01-08T14:00:00-05:00')); // Wednesday 2 PM
    });
    
    it('should return null when noAnswerRetryRule is disabled', () => {
      // Ensure rule is disabled
      rulesManager.updateRules({
        noAnswerRetryRule: {
          enabled: false
        }
      });
      
      const call = { id: 'call123', phone_number: '+15551234567', disposition: 'no-answer' };
      const result = rulesManager.processNoAnswerCall(call);
      
      expect(result).to.be.null;
    });
    
    it('should return null when max retries reached', () => {
      // Enable rule with max retries = 3
      rulesManager.updateRules({
        noAnswerRetryRule: {
          enabled: true,
          maxRetries: 3
        }
      });
      
      // Call that has already been retried 3 times
      const call = { 
        id: 'call123', 
        phone_number: '+15551234567', 
        disposition: 'no-answer',
        retry_count: 3 
      };
      
      const result = rulesManager.processNoAnswerCall(call);
      
      expect(result).to.be.null;
    });
    
    it('should increment retry count and schedule next attempt', () => {
      // Enable rule
      rulesManager.updateRules({
        noAnswerRetryRule: {
          enabled: true,
          retryDelayMinutes: 45,
          maxRetries: 3
        }
      });
      
      // Set up the next retry time (45 minutes later)
      const now = new Date();
      const nextRetryTime = new Date(now.getTime() + 45 * 60 * 1000);
      sandbox.stub(rulesManager, 'calculateNextRetryTime').returns(nextRetryTime);
      
      const call = { 
        id: 'call123', 
        phone_number: '+15551234567', 
        disposition: 'no-answer',
        retry_count: 1 
      };
      
      const result = rulesManager.processNoAnswerCall(call);
      
      expect(result).to.include({
        id: 'call123',
        phone_number: '+15551234567',
        disposition: 'no-answer',
        status: 'Queued',
        retry_count: 2
      });
      
      expect(result.scheduled_for).to.equal(nextRetryTime.toISOString());
      expect(result.last_retry).to.be.a('string');
    });
    
    it('should handle undefined retry_count', () => {
      // Enable rule
      rulesManager.updateRules({
        noAnswerRetryRule: {
          enabled: true,
          maxRetries: 3
        }
      });
      
      // Set up next retry time stub
      const nextRetryTime = new Date(new Date().getTime() + 30 * 60 * 1000);
      sandbox.stub(rulesManager, 'calculateNextRetryTime').returns(nextRetryTime);
      
      // Call with no retry_count specified
      const call = { 
        id: 'call123', 
        phone_number: '+15551234567', 
        disposition: 'no-answer'
      };
      
      const result = rulesManager.processNoAnswerCall(call);
      
      expect(result.retry_count).to.equal(1);
    });
  });
});