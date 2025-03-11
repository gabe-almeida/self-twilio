/**
 * Monitoring Service Tests
 * 
 * This file contains tests for the monitoring service, which is responsible for
 * tracking system metrics, providing a dashboard, and sending alerts for anomalies.
 */

const assert = require('assert');
const monitoringService = require('../services/monitoring-service');
const featureFlags = require('../services/feature-flags');
const errorService = require('../services/error-service');
const fs = require('fs').promises;
const path = require('path');

// Mock dependencies
jest.mock('../memory-store', () => ({
  agentStatus: {
    getAll: jest.fn().mockResolvedValue([
      { user_id: 'agent1', username: 'Agent 1', status: 'Available' },
      { user_id: 'agent2', username: 'Agent 2', status: 'Unavailable' },
      { user_id: 'agent3', username: 'Agent 3', status: 'Available' }
    ]),
    getAvailableAgents: jest.fn().mockResolvedValue([
      { user_id: 'agent1', username: 'Agent 1', status: 'Available' },
      { user_id: 'agent3', username: 'Agent 3', status: 'Available' }
    ])
  },
  callQueue: {
    getQueued: jest.fn().mockResolvedValue([
      { id: 'call1', phone_number: '123456789', created_at: new Date(Date.now() - 60000).toISOString() },
      { id: 'call2', phone_number: '987654321', created_at: new Date(Date.now() - 120000).toISOString() }
    ]),
    getAll: jest.fn().mockResolvedValue([
      { id: 'call1', phone_number: '123456789', status: 'Queued', created_at: new Date(Date.now() - 60000).toISOString() },
      { id: 'call2', phone_number: '987654321', status: 'Queued', created_at: new Date(Date.now() - 120000).toISOString() },
      { id: 'call3', phone_number: '555555555', status: 'Completed', created_at: new Date(Date.now() - 180000).toISOString() }
    ])
  },
  callHistory: {
    getAll: jest.fn().mockResolvedValue([
      { 
        id: 'history1', 
        call_sid: 'sid1', 
        user_id: 'agent1', 
        start_time: new Date(Date.now() - 300000).toISOString(),
        end_time: new Date(Date.now() - 240000).toISOString(),
        duration: 60
      },
      { 
        id: 'history2', 
        call_sid: 'sid2', 
        user_id: 'agent2', 
        start_time: new Date(Date.now() - 600000).toISOString(),
        end_time: new Date(Date.now() - 500000).toISOString(),
        duration: 100
      }
    ])
  }
}));

jest.mock('../services/load-balancing-service', () => ({
  getSystemMetrics: jest.fn().mockReturnValue({
    totalCallsProcessed: 100,
    totalCallsSucceeded: 80,
    totalCallsFailed: 20,
    callsPerMinute: 5,
    callsInLastMinute: 5,
    throttlingEnabled: false,
    maxCallsPerMinute: 60,
    throttleUntil: null
  }),
  getAllAgentMetrics: jest.fn().mockReturnValue(new Map([
    ['agent1', {
      callsProcessed: 50,
      callsSucceeded: 45,
      callsFailed: 5,
      avgCallDuration: 60,
      loadScore: 30,
      consecutiveFailures: 0,
      cooldownUntil: null
    }],
    ['agent2', {
      callsProcessed: 30,
      callsSucceeded: 20,
      callsFailed: 10,
      avgCallDuration: 90,
      loadScore: 60,
      consecutiveFailures: 1,
      cooldownUntil: null
    }],
    ['agent3', {
      callsProcessed: 20,
      callsSucceeded: 15,
      callsFailed: 5,
      avgCallDuration: 45,
      loadScore: 20,
      consecutiveFailures: 0,
      cooldownUntil: null
    }]
  ])),
  isAgentInCooldown: jest.fn().mockImplementation((agentId) => {
    return agentId === 'agent2';
  })
}));

jest.mock('../services/feature-flags', () => ({
  isFeatureEnabled: jest.fn().mockResolvedValue(true),
  getFeatureValue: jest.fn().mockImplementation((path, defaultValue) => {
    if (path === 'monitoring.alertThresholds.highCallFailureRate') return Promise.resolve(0.3);
    if (path === 'monitoring.alertThresholds.highQueueDepth') return Promise.resolve(20);
    if (path === 'monitoring.alertThresholds.lowAgentAvailability') return Promise.resolve(0.2);
    if (path === 'monitoring.alertThresholds.highCallVolume') return Promise.resolve(50);
    if (path === 'monitoring.alertThresholds.longWaitTime') return Promise.resolve(300);
    if (path === 'monitoring.updateIntervalMs') return Promise.resolve(60000);
    if (path === 'monitoring.alertCheckIntervalMs') return Promise.resolve(300000);
    if (path === 'monitoring.metricsLogIntervalMs') return Promise.resolve(3600000);
    return Promise.resolve(defaultValue);
  })
}));

jest.mock('../services/error-service', () => ({
  handleError: jest.fn().mockResolvedValue({
    message: 'Test error',
    type: 'TEST_ERROR',
    retryable: false
  })
}));

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockImplementation((path) => {
      if (path.includes('metrics.json')) {
        return Promise.resolve(JSON.stringify([
          {
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            system: {
              callsProcessed: 90,
              callsSucceeded: 75,
              callsFailed: 15,
              callsPerMinute: 4
            }
          },
          {
            timestamp: new Date(Date.now() - 7200000).toISOString(),
            system: {
              callsProcessed: 80,
              callsSucceeded: 70,
              callsFailed: 10,
              callsPerMinute: 3
            }
          }
        ]));
      }
      return Promise.reject(new Error('File not found'));
    }),
    writeFile: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('Monitoring Service', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Reset service state
    monitoringService.metrics = {
      system: {
        startTime: new Date().toISOString(),
        uptime: 0,
        callsProcessed: 0,
        callsSucceeded: 0,
        callsFailed: 0,
        callsPerMinute: 0,
        agentsAvailable: 0,
        queuedCalls: 0,
        avgWaitTime: 0,
        avgCallDuration: 0,
        lastUpdated: new Date().toISOString()
      },
      agents: {},
      alerts: []
    };
  });
  
  describe('initialize()', () => {
    it('should initialize the monitoring service', async () => {
      const result = await monitoringService.initialize();
      
      expect(result).toBe(true);
      expect(featureFlags.getFeatureValue).toHaveBeenCalledWith('monitoring.alertThresholds.highCallFailureRate', 0.3);
      expect(featureFlags.getFeatureValue).toHaveBeenCalledWith('monitoring.updateIntervalMs', 60000);
    });
    
    it('should handle errors during initialization', async () => {
      // Mock fs.mkdir to throw an error
      fs.promises.mkdir.mockRejectedValueOnce(new Error('Test error'));
      
      const result = await monitoringService.initialize();
      
      expect(result).toBe(true); // Should still return true as this is a non-critical error
      expect(errorService.handleError).not.toHaveBeenCalled(); // Error is handled internally
    });
  });
  
  describe('updateMetrics()', () => {
    it('should update system metrics', async () => {
      const result = await monitoringService.updateMetrics();
      
      expect(result).toBe(true);
      
      // Check that system metrics were updated
      expect(monitoringService.metrics.system.callsProcessed).toBe(100);
      expect(monitoringService.metrics.system.callsSucceeded).toBe(80);
      expect(monitoringService.metrics.system.callsFailed).toBe(20);
      expect(monitoringService.metrics.system.callsPerMinute).toBe(5);
      expect(monitoringService.metrics.system.agentsAvailable).toBe(2);
      expect(monitoringService.metrics.system.queuedCalls).toBe(2);
      
      // Check that agent metrics were updated
      expect(Object.keys(monitoringService.metrics.agents)).toHaveLength(3);
      expect(monitoringService.metrics.agents.agent1.callsProcessed).toBe(50);
      expect(monitoringService.metrics.agents.agent1.successRate).toBeCloseTo(0.9, 2);
      expect(monitoringService.metrics.agents.agent2.inCooldown).toBe(true);
    });
    
    it('should handle errors during metrics update', async () => {
      // Mock store.agentStatus.getAll to throw an error
      require('../memory-store').agentStatus.getAll.mockRejectedValueOnce(new Error('Test error'));
      
      const result = await monitoringService.updateMetrics();
      
      expect(result).toBe(false);
      expect(errorService.handleError).toHaveBeenCalled();
    });
  });
  
  describe('checkAlerts()', () => {
    it('should check for alert conditions', async () => {
      // Set up conditions that should trigger alerts
      require('../load-balancing-service').getSystemMetrics.mockReturnValueOnce({
        totalCallsProcessed: 100,
        totalCallsSucceeded: 60, // 40% failure rate, above the 30% threshold
        totalCallsFailed: 40,
        callsPerMinute: 60, // Above the 50 threshold
        callsInLastMinute: 60,
        throttlingEnabled: false,
        maxCallsPerMinute: 60,
        throttleUntil: null
      });
      
      // Set a high average wait time
      monitoringService.metrics.system.avgWaitTime = 400; // Above the 300 threshold
      
      const result = await monitoringService.checkAlerts();
      
      expect(result).toBe(true);
      
      // Should have triggered 3 alerts
      expect(monitoringService.metrics.alerts).toHaveLength(3);
      
      // Check alert types
      const alertTypes = monitoringService.metrics.alerts.map(alert => alert.type);
      expect(alertTypes).toContain('HIGH_FAILURE_RATE');
      expect(alertTypes).toContain('HIGH_CALL_VOLUME');
      expect(alertTypes).toContain('LONG_WAIT_TIME');
    });
    
    it('should not create duplicate alerts within an hour', async () => {
      // Add an existing alert
      monitoringService.addAlert('HIGH_FAILURE_RATE', 'Call failure rate is 40.0%');
      
      // Clear the alerts array to start fresh
      const existingAlertCount = monitoringService.metrics.alerts.length;
      
      // Set up conditions that should trigger the same alert
      require('../load-balancing-service').getSystemMetrics.mockReturnValueOnce({
        totalCallsProcessed: 100,
        totalCallsSucceeded: 60, // 40% failure rate, above the 30% threshold
        totalCallsFailed: 40,
        callsPerMinute: 5,
        callsInLastMinute: 5,
        throttlingEnabled: false,
        maxCallsPerMinute: 60,
        throttleUntil: null
      });
      
      const result = await monitoringService.checkAlerts();
      
      expect(result).toBe(true);
      
      // Should not have added a duplicate alert
      expect(monitoringService.metrics.alerts).toHaveLength(existingAlertCount);
    });
    
    it('should handle errors during alert checking', async () => {
      // Mock store.agentStatus.getAll to throw an error
      require('../memory-store').agentStatus.getAll.mockRejectedValueOnce(new Error('Test error'));
      
      const result = await monitoringService.checkAlerts();
      
      expect(result).toBe(false);
      expect(errorService.handleError).toHaveBeenCalled();
    });
  });
  
  describe('logMetrics()', () => {
    it('should log metrics to a file', async () => {
      const result = await monitoringService.logMetrics();
      
      expect(result).toBe(true);
      expect(fs.promises.writeFile).toHaveBeenCalled();
      
      // Check that the written data includes the current metrics
      const writeFileCall = fs.promises.writeFile.mock.calls[0];
      const writtenData = JSON.parse(writeFileCall[1]);
      
      expect(writtenData).toHaveLength(3); // 2 existing + 1 new
      expect(writtenData[2].system.callsProcessed).toBe(0); // Default value from beforeEach
    });
    
    it('should handle errors during metrics logging', async () => {
      // Mock fs.writeFile to throw an error
      fs.promises.writeFile.mockRejectedValueOnce(new Error('Test error'));
      
      const result = await monitoringService.logMetrics();
      
      expect(result).toBe(false);
      expect(errorService.handleError).toHaveBeenCalled();
    });
  });
  
  describe('getHistoricalMetrics()', () => {
    it('should get historical metrics from file', async () => {
      const metrics = await monitoringService.getHistoricalMetrics();
      
      expect(metrics).toHaveLength(2);
      expect(metrics[0].system.callsProcessed).toBe(90);
      expect(metrics[1].system.callsProcessed).toBe(80);
    });
    
    it('should handle file not found error', async () => {
      // Mock fs.readFile to throw a file not found error
      fs.promises.readFile.mockRejectedValueOnce({ code: 'ENOENT' });
      
      const metrics = await monitoringService.getHistoricalMetrics();
      
      expect(metrics).toEqual([]);
      expect(errorService.handleError).not.toHaveBeenCalled(); // This is an expected error
    });
    
    it('should handle other errors', async () => {
      // Mock fs.readFile to throw a different error
      fs.promises.readFile.mockRejectedValueOnce(new Error('Test error'));
      
      const metrics = await monitoringService.getHistoricalMetrics();
      
      expect(metrics).toEqual([]);
      expect(errorService.handleError).toHaveBeenCalled();
    });
  });
  
  describe('acknowledgeAlert()', () => {
    it('should acknowledge an alert', () => {
      // Add an alert
      monitoringService.addAlert('TEST_ALERT', 'Test alert message');
      const alertId = monitoringService.metrics.alerts[0].id;
      
      const result = monitoringService.acknowledgeAlert(alertId);
      
      expect(result).toBe(true);
      expect(monitoringService.metrics.alerts[0].acknowledged).toBe(true);
    });
    
    it('should return false for non-existent alert', () => {
      const result = monitoringService.acknowledgeAlert('non-existent-id');
      
      expect(result).toBe(false);
    });
  });
  
  describe('getAlerts()', () => {
    it('should get all alerts when includeAcknowledged is true', () => {
      // Add alerts
      monitoringService.addAlert('TEST_ALERT_1', 'Test alert 1');
      monitoringService.addAlert('TEST_ALERT_2', 'Test alert 2');
      
      // Acknowledge one alert
      const alertId = monitoringService.metrics.alerts[0].id;
      monitoringService.acknowledgeAlert(alertId);
      
      const alerts = monitoringService.getAlerts(true);
      
      expect(alerts).toHaveLength(2);
    });
    
    it('should get only unacknowledged alerts when includeAcknowledged is false', () => {
      // Add alerts
      monitoringService.addAlert('TEST_ALERT_1', 'Test alert 1');
      monitoringService.addAlert('TEST_ALERT_2', 'Test alert 2');
      
      // Acknowledge one alert
      const alertId = monitoringService.metrics.alerts[0].id;
      monitoringService.acknowledgeAlert(alertId);
      
      const alerts = monitoringService.getAlerts(false);
      
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('TEST_ALERT_2');
    });
  });
});