/**
 * Monitoring Service for Twilio Dialer Web App
 * 
 * This service provides monitoring and alerting capabilities for the system.
 * It tracks key metrics, provides a dashboard, and sends alerts for anomalies.
 */
const store = require('../memory-store');
const featureFlags = require('./feature-flags');
const errorService = require('./error-service');
const loadBalancingService = require('./load-balancing-service');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class MonitoringService {
  constructor() {
    this.metrics = {
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
    
    this.updateInterval = null;
    this.alertCheckInterval = null;
    this.metricsLogInterval = null;
    this.alertThresholds = {
      highCallFailureRate: 0.3, // 30% failure rate
      highQueueDepth: 20, // 20 calls in queue
      lowAgentAvailability: 0.2, // 20% of agents available
      highCallVolume: 50, // 50 calls per minute
      longWaitTime: 300 // 5 minutes
    };
    
    this.metricsDir = path.join(__dirname, '..', 'data', 'metrics');
    this.metricsFile = path.join(this.metricsDir, 'metrics.json');
  }
  
  /**
   * Initialize the monitoring service
   */
  async initialize() {
    try {
      console.log('Initializing monitoring service');
      
      // Check if monitoring is enabled
      const monitoringEnabled = await featureFlags.isFeatureEnabled('monitoring.enabled');
      
      if (!monitoringEnabled) {
        console.log('Monitoring is disabled');
        return true;
      }
      
      // Load alert thresholds from feature flags
      this.alertThresholds.highCallFailureRate = await featureFlags.getFeatureValue('monitoring.alertThresholds.highCallFailureRate', 0.3);
      this.alertThresholds.highQueueDepth = await featureFlags.getFeatureValue('monitoring.alertThresholds.highQueueDepth', 20);
      this.alertThresholds.lowAgentAvailability = await featureFlags.getFeatureValue('monitoring.alertThresholds.lowAgentAvailability', 0.2);
      this.alertThresholds.highCallVolume = await featureFlags.getFeatureValue('monitoring.alertThresholds.highCallVolume', 50);
      this.alertThresholds.longWaitTime = await featureFlags.getFeatureValue('monitoring.alertThresholds.longWaitTime', 300);
      
      // Get update intervals from feature flags
      const updateIntervalMs = await featureFlags.getFeatureValue('monitoring.updateIntervalMs', 60000); // 1 minute
      const alertCheckIntervalMs = await featureFlags.getFeatureValue('monitoring.alertCheckIntervalMs', 300000); // 5 minutes
      const metricsLogIntervalMs = await featureFlags.getFeatureValue('monitoring.metricsLogIntervalMs', 3600000); // 1 hour
      
      // Create metrics directory if it doesn't exist
      try {
        await fs.mkdir(this.metricsDir, { recursive: true });
      } catch (error) {
        console.error('Error creating metrics directory:', error);
      }
      
      // Start update interval
      this.updateInterval = setInterval(() => {
        this.updateMetrics().catch(error => {
          console.error('Error updating metrics:', error);
        });
      }, updateIntervalMs);
      
      // Start alert check interval
      this.alertCheckInterval = setInterval(() => {
        this.checkAlerts().catch(error => {
          console.error('Error checking alerts:', error);
        });
      }, alertCheckIntervalMs);
      
      // Start metrics log interval
      this.metricsLogInterval = setInterval(() => {
        this.logMetrics().catch(error => {
          console.error('Error logging metrics:', error);
        });
      }, metricsLogIntervalMs);
      
      // Initial update
      await this.updateMetrics();
      
      console.log('Monitoring service initialized');
      
      return true;
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'monitoring-service.initialize');
      console.error('Error initializing monitoring service:', errorInfo);
      return true; // Return true anyway to not block server startup
    }
  }
  
  /**
   * Stop the monitoring service
   */
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
      this.alertCheckInterval = null;
    }
    
    if (this.metricsLogInterval) {
      clearInterval(this.metricsLogInterval);
      this.metricsLogInterval = null;
    }
    
    console.log('Monitoring service stopped');
  }
  
  /**
   * Update system metrics
   */
  async updateMetrics() {
    try {
      // Get system metrics from load balancing service
      const systemMetrics = loadBalancingService.getSystemMetrics();
      
      // Get agent metrics from load balancing service
      const agentMetrics = loadBalancingService.getAllAgentMetrics();
      
      // Get available agents
      const availableAgents = await store.agentStatus.getAvailableAgents();
      
      // Get all agents
      const allAgents = await store.agentStatus.getAllWithUserInfo();
      
      // Get queued calls
      const queuedCalls = await store.callQueue.getQueued();
      
      // Get all calls
      const allCalls = await store.callQueue.getAll();
      
      // Get call history
      const callHistory = await store.callHistory.getAll();
      
      // Calculate uptime
      const now = new Date();
      const startTime = new Date(this.metrics.system.startTime);
      const uptime = Math.floor((now - startTime) / 1000); // in seconds
      
      // Calculate average wait time
      let totalWaitTime = 0;
      let waitTimeCount = 0;
      
      for (const call of queuedCalls) {
        if (call.created_at) {
          const createdAt = new Date(call.created_at);
          const waitTime = Math.floor((now - createdAt) / 1000); // in seconds
          totalWaitTime += waitTime;
          waitTimeCount++;
        }
      }
      
      const avgWaitTime = waitTimeCount > 0 ? totalWaitTime / waitTimeCount : 0;
      
      // Calculate average call duration
      let totalDuration = 0;
      let durationCount = 0;
      
      for (const call of callHistory) {
        if (call.duration) {
          totalDuration += call.duration;
          durationCount++;
        }
      }
      
      const avgCallDuration = durationCount > 0 ? totalDuration / durationCount : 0;
      
      // Update system metrics
      this.metrics.system = {
        ...this.metrics.system,
        uptime,
        callsProcessed: systemMetrics.totalCallsProcessed,
        callsSucceeded: systemMetrics.totalCallsSucceeded,
        callsFailed: systemMetrics.totalCallsFailed,
        callsPerMinute: systemMetrics.callsPerMinute,
        agentsAvailable: availableAgents.length,
        queuedCalls: queuedCalls.length,
        avgWaitTime,
        avgCallDuration,
        lastUpdated: now.toISOString()
      };
      
      // Update agent metrics
      this.metrics.agents = {};
      
      for (const agent of allAgents) {
        const agentId = agent.user_id;
        const agentMetric = agentMetrics.get(agentId);
        
        this.metrics.agents[agentId] = {
          username: agent.username,
          status: agent.status,
          callsProcessed: agentMetric ? agentMetric.callsProcessed : 0,
          callsSucceeded: agentMetric ? agentMetric.callsSucceeded : 0,
          callsFailed: agentMetric ? agentMetric.callsFailed : 0,
          successRate: agentMetric ? agentMetric.callsProcessed > 0 ? agentMetric.callsSucceeded / agentMetric.callsProcessed : 0 : 0,
          avgCallDuration: agentMetric ? agentMetric.avgCallDuration : 0,
          loadScore: agentMetric ? agentMetric.loadScore : 0,
          inCooldown: agentMetric ? loadBalancingService.isAgentInCooldown(agentId) : false
        };
      }
      
      return true;
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'monitoring-service.updateMetrics');
      console.error('Error updating metrics:', errorInfo);
      return false;
    }
  }
  
  /**
   * Check for alert conditions
   */
  async checkAlerts() {
    try {
      // Get system metrics from load balancing service
      const systemMetrics = loadBalancingService.getSystemMetrics();
      
      // Get available agents
      const availableAgents = await store.agentStatus.getAvailableAgents();
      
      // Get all agents
      const allAgents = await store.agentStatus.getAllWithUserInfo();
      
      // Get queued calls
      const queuedCalls = await store.callQueue.getQueued();
      
      // Check for high call failure rate
      if (systemMetrics.totalCallsProcessed > 0) {
        const failureRate = systemMetrics.totalCallsFailed / systemMetrics.totalCallsProcessed;
        
        if (failureRate > this.alertThresholds.highCallFailureRate) {
          this.addAlert('HIGH_FAILURE_RATE', `Call failure rate is ${(failureRate * 100).toFixed(1)}%`);
        }
      }
      
      // Check for high queue depth
      if (queuedCalls.length > this.alertThresholds.highQueueDepth) {
        this.addAlert('HIGH_QUEUE_DEPTH', `Queue depth is ${queuedCalls.length} calls`);
      }
      
      // Check for low agent availability
      if (allAgents.length > 0) {
        const availabilityRate = availableAgents.length / allAgents.length;
        
        if (availabilityRate < this.alertThresholds.lowAgentAvailability) {
          this.addAlert('LOW_AGENT_AVAILABILITY', `Only ${(availabilityRate * 100).toFixed(1)}% of agents are available`);
        }
      }
      
      // Check for high call volume
      if (systemMetrics.callsPerMinute > this.alertThresholds.highCallVolume) {
        this.addAlert('HIGH_CALL_VOLUME', `Call volume is ${systemMetrics.callsPerMinute} calls per minute`);
      }
      
      // Check for long wait time
      if (this.metrics.system.avgWaitTime > this.alertThresholds.longWaitTime) {
        this.addAlert('LONG_WAIT_TIME', `Average wait time is ${Math.floor(this.metrics.system.avgWaitTime / 60)} minutes`);
      }
      
      return true;
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'monitoring-service.checkAlerts');
      console.error('Error checking alerts:', errorInfo);
      return false;
    }
  }
  
  /**
   * Add an alert
   * @param {string} type - The alert type
   * @param {string} message - The alert message
   */
  addAlert(type, message) {
    // Check if a similar alert already exists within the last hour
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);
    
    const existingAlert = this.metrics.alerts.find(alert => 
      alert.type === type && 
      new Date(alert.timestamp) > oneHourAgo
    );
    
    if (existingAlert) {
      // Update the existing alert
      existingAlert.count++;
      existingAlert.timestamp = now.toISOString();
      existingAlert.message = message;
      existingAlert.acknowledged = false;
    } else {
      // Add a new alert
      this.metrics.alerts.push({
        id: uuidv4(),
        type,
        message,
        timestamp: now.toISOString(),
        count: 1,
        acknowledged: false
      });
    }
    
    // Sort alerts by timestamp (newest first)
    this.metrics.alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Limit to 100 alerts
    if (this.metrics.alerts.length > 100) {
      this.metrics.alerts = this.metrics.alerts.slice(0, 100);
    }
    
    console.log(`Alert: ${type} - ${message}`);
  }
  
  /**
   * Acknowledge an alert
   * @param {string} alertId - The alert ID
   * @returns {boolean} Whether the alert was acknowledged
   */
  acknowledgeAlert(alertId) {
    const alert = this.metrics.alerts.find(a => a.id === alertId);
    
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    
    return false;
  }
  
  /**
   * Get alerts
   * @param {boolean} includeAcknowledged - Whether to include acknowledged alerts
   * @returns {Array} The alerts
   */
  getAlerts(includeAcknowledged = true) {
    if (includeAcknowledged) {
      return [...this.metrics.alerts];
    }
    
    return this.metrics.alerts.filter(alert => !alert.acknowledged);
  }
  
  /**
   * Get system metrics
   * @returns {Object} The system metrics
   */
  getSystemMetrics() {
    return { ...this.metrics.system };
  }
  
  /**
   * Get agent metrics
   * @param {string} agentId - The agent ID (optional)
   * @returns {Object} The agent metrics
   */
  getAgentMetrics(agentId) {
    if (agentId) {
      return this.metrics.agents[agentId] || null;
    }
    
    return { ...this.metrics.agents };
  }
  
  /**
   * Log metrics to a file
   */
  async logMetrics() {
    try {
      // Get historical metrics
      const historicalMetrics = await this.getHistoricalMetrics();
      
      // Add current metrics
      const metricsToLog = [
        ...historicalMetrics,
        {
          timestamp: new Date().toISOString(),
          system: { ...this.metrics.system },
          agents: { ...this.metrics.agents }
        }
      ];
      
      // Limit to 1000 entries
      if (metricsToLog.length > 1000) {
        metricsToLog.splice(0, metricsToLog.length - 1000);
      }
      
      // Write to file
      await fs.writeFile(this.metricsFile, JSON.stringify(metricsToLog, null, 2));
      
      console.log('Metrics logged to file');
      
      return true;
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'monitoring-service.logMetrics');
      console.error('Error logging metrics:', errorInfo);
      return false;
    }
  }
  
  /**
   * Get historical metrics from file
   * @returns {Array} The historical metrics
   */
  async getHistoricalMetrics() {
    try {
      const data = await fs.readFile(this.metricsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // If file doesn't exist, return empty array
      if (error.code === 'ENOENT') {
        return [];
      }
      
      const errorInfo = await errorService.handleError(error, 'monitoring-service.getHistoricalMetrics');
      console.error('Error getting historical metrics:', errorInfo);
      return [];
    }
  }
}

// Create a singleton instance
const monitoringService = new MonitoringService();

module.exports = monitoringService;