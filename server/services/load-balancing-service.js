/**
 * Load Balancing Service for Twilio Dialer Web App
 * 
 * This service provides load balancing functionality for distributing calls among agents.
 * It tracks agent load metrics, implements a fair distribution algorithm, and provides
 * throttling mechanisms to prevent system overload.
 */
const store = require('../memory-store');
const errorService = require('./error-service');
const featureFlags = require('./feature-flags');

class LoadBalancingService {
  constructor() {
    this.agentMetrics = new Map(); // Map to track agent metrics
    this.systemMetrics = {
      totalCallsProcessed: 0,
      totalCallsSucceeded: 0,
      totalCallsFailed: 0,
      callsPerMinute: 0,
      lastCalculationTime: Date.now(),
      callsInLastMinute: 0,
      throttlingEnabled: false,
      maxCallsPerMinute: 60, // Default: 1 call per second
      throttleUntil: null
    };
    
    // Start metrics calculation interval
    this.metricsInterval = setInterval(() => this.calculateMetrics(), 60000); // Every minute
  }
  
  /**
   * Initialize the load balancing service
   */
  async initialize() {
    try {
      console.log('Initializing load balancing service');
      
      // Load initial agent metrics
      const agents = await store.agentStatus.getAll();
      
      for (const agent of agents) {
        this.initializeAgentMetrics(agent.user_id);
      }
      
      // Load system configuration
      const maxCallsPerMinute = await featureFlags.getFeatureValue('loadBalancing.maxCallsPerMinute', 60);
      this.systemMetrics.maxCallsPerMinute = maxCallsPerMinute;
      
      console.log(`Load balancing service initialized with max calls per minute: ${maxCallsPerMinute}`);
      return true;
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'load-balancing-service.initialize');
      console.error('Error initializing load balancing service:', errorInfo);
      return false;
    }
  }
  
  /**
   * Stop the load balancing service
   */
  stop() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }
  
  /**
   * Initialize metrics for a new agent
   * @param {string} agentId - The agent's user ID
   */
  initializeAgentMetrics(agentId) {
    if (!this.agentMetrics.has(agentId)) {
      this.agentMetrics.set(agentId, {
        callsProcessed: 0,
        callsSucceeded: 0,
        callsFailed: 0,
        avgCallDuration: 0,
        totalCallDuration: 0,
        lastCallTime: null,
        callsInLastHour: 0,
        loadScore: 0, // 0-100 score representing agent load
        consecutiveFailures: 0,
        cooldownUntil: null
      });
    }
  }
  
  /**
   * Calculate and update metrics
   */
  async calculateMetrics() {
    try {
      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      
      // Calculate calls per minute
      const callsPerMinute = this.systemMetrics.callsInLastMinute;
      this.systemMetrics.callsPerMinute = callsPerMinute;
      this.systemMetrics.callsInLastMinute = 0;
      this.systemMetrics.lastCalculationTime = now;
      
      // Check if we need to throttle
      if (callsPerMinute > this.systemMetrics.maxCallsPerMinute) {
        console.log(`System throttling activated: ${callsPerMinute} calls/min exceeds limit of ${this.systemMetrics.maxCallsPerMinute}`);
        this.systemMetrics.throttlingEnabled = true;
        this.systemMetrics.throttleUntil = new Date(now + 60000); // Throttle for 1 minute
      } else if (this.systemMetrics.throttleUntil && new Date(this.systemMetrics.throttleUntil) < new Date()) {
        // Throttling period has ended
        console.log('System throttling deactivated');
        this.systemMetrics.throttlingEnabled = false;
        this.systemMetrics.throttleUntil = null;
      }
      
      // Update agent metrics
      for (const [agentId, metrics] of this.agentMetrics.entries()) {
        // Reset cooldown if it has expired
        if (metrics.cooldownUntil && new Date(metrics.cooldownUntil) < new Date()) {
          metrics.cooldownUntil = null;
          metrics.consecutiveFailures = 0;
        }
        
        // Calculate load score based on recent activity
        // This is a simple algorithm that considers:
        // 1. Number of calls in the last hour
        // 2. Time since last call
        // 3. Success/failure ratio
        
        // Decay the load score over time
        if (metrics.lastCallTime) {
          const timeSinceLastCall = now - new Date(metrics.lastCallTime).getTime();
          const hourInMs = 3600000;
          
          // Decay load score based on time since last call (full reset after 1 hour)
          if (timeSinceLastCall > hourInMs) {
            metrics.loadScore = 0;
            metrics.callsInLastHour = 0;
          } else {
            // Linear decay
            const decayFactor = 1 - (timeSinceLastCall / hourInMs);
            metrics.loadScore = Math.max(0, Math.floor(metrics.loadScore * decayFactor));
          }
        }
        
        // Update the metrics in the map
        this.agentMetrics.set(agentId, metrics);
      }
      
      // Log current system metrics
      console.log(`System metrics: ${callsPerMinute} calls/min, throttling: ${this.systemMetrics.throttlingEnabled}`);
      
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'load-balancing-service.calculateMetrics');
      console.error('Error calculating metrics:', errorInfo);
    }
  }
  
  /**
   * Record a call assignment to an agent
   * @param {string} agentId - The agent's user ID
   * @param {object} call - The call object
   */
  recordCallAssignment(agentId, call) {
    try {
      // Initialize agent metrics if needed
      this.initializeAgentMetrics(agentId);
      
      // Get agent metrics
      const metrics = this.agentMetrics.get(agentId);
      
      // Update metrics
      metrics.callsProcessed++;
      metrics.lastCallTime = new Date().toISOString();
      metrics.callsInLastHour++;
      
      // Increase load score (0-100)
      metrics.loadScore = Math.min(100, metrics.loadScore + 10);
      
      // Update system metrics
      this.systemMetrics.totalCallsProcessed++;
      this.systemMetrics.callsInLastMinute++;
      
      // Update the metrics in the map
      this.agentMetrics.set(agentId, metrics);
      
      return true;
    } catch (error) {
      console.error('Error recording call assignment:', error);
      return false;
    }
  }
  
  /**
   * Record a call result
   * @param {string} agentId - The agent's user ID
   * @param {object} call - The call object
   * @param {boolean} success - Whether the call was successful
   * @param {number} duration - The call duration in seconds
   */
  recordCallResult(agentId, call, success, duration = 0) {
    try {
      // Initialize agent metrics if needed
      this.initializeAgentMetrics(agentId);
      
      // Get agent metrics
      const metrics = this.agentMetrics.get(agentId);
      
      // Update metrics
      if (success) {
        metrics.callsSucceeded++;
        this.systemMetrics.totalCallsSucceeded++;
        metrics.consecutiveFailures = 0;
        
        // Update average call duration
        if (duration > 0) {
          metrics.totalCallDuration += duration;
          metrics.avgCallDuration = Math.round(metrics.totalCallDuration / metrics.callsSucceeded);
        }
      } else {
        metrics.callsFailed++;
        this.systemMetrics.totalCallsFailed++;
        metrics.consecutiveFailures++;
        
        // If agent has too many consecutive failures, put them in cooldown
        if (metrics.consecutiveFailures >= 3) {
          console.log(`Agent ${agentId} placed in cooldown due to ${metrics.consecutiveFailures} consecutive failures`);
          metrics.cooldownUntil = new Date(Date.now() + 300000).toISOString(); // 5 minute cooldown
        }
      }
      
      // Update the metrics in the map
      this.agentMetrics.set(agentId, metrics);
      
      return true;
    } catch (error) {
      console.error('Error recording call result:', error);
      return false;
    }
  }
  
  /**
   * Check if the system is currently throttled
   * @returns {boolean} - Whether the system is throttled
   */
  isSystemThrottled() {
    return this.systemMetrics.throttlingEnabled;
  }
  
  /**
   * Check if an agent is in cooldown
   * @param {string} agentId - The agent's user ID
   * @returns {boolean} - Whether the agent is in cooldown
   */
  isAgentInCooldown(agentId) {
    if (!this.agentMetrics.has(agentId)) {
      return false;
    }
    
    const metrics = this.agentMetrics.get(agentId);
    return metrics.cooldownUntil && new Date(metrics.cooldownUntil) > new Date();
  }
  
  /**
   * Get agent load score
   * @param {string} agentId - The agent's user ID
   * @returns {number} - The agent's load score (0-100)
   */
  getAgentLoadScore(agentId) {
    if (!this.agentMetrics.has(agentId)) {
      return 0;
    }
    
    return this.agentMetrics.get(agentId).loadScore;
  }
  
  /**
   * Get all agent metrics
   * @returns {Map} - Map of agent metrics
   */
  getAllAgentMetrics() {
    return this.agentMetrics;
  }
  
  /**
   * Get system metrics
   * @returns {object} - System metrics
   */
  getSystemMetrics() {
    return { ...this.systemMetrics };
  }
  
  /**
   * Distribute calls to agents using a fair algorithm
   * @param {Array} calls - Array of calls to distribute
   * @param {Array} agents - Array of available agents
   * @returns {Array} - Array of {call, agent} pairs
   */
  distributeCallsToAgents(calls, agents) {
    if (!calls.length || !agents.length) {
      return [];
    }
    
    try {
      // Check if system is throttled
      if (this.isSystemThrottled()) {
        console.log('System is throttled, limiting call distribution');
        // When throttled, only process high-priority calls
        calls = calls.filter(call => call.priority >= 3);
        
        if (!calls.length) {
          return [];
        }
      }
      
      // Filter out agents in cooldown
      const availableAgents = agents.filter(agent => !this.isAgentInCooldown(agent.user_id));
      
      if (!availableAgents.length) {
        return [];
      }
      
      // Sort agents by load score (ascending)
      availableAgents.sort((a, b) => {
        const scoreA = this.getAgentLoadScore(a.user_id);
        const scoreB = this.getAgentLoadScore(b.user_id);
        return scoreA - scoreB;
      });
      
      // Sort calls by priority (descending)
      calls.sort((a, b) => (b.priority || 1) - (a.priority || 1));
      
      // Distribute calls
      const assignments = [];
      const assignedAgents = new Set();
      
      // First pass: assign high-priority calls to least loaded agents
      for (const call of calls) {
        if ((call.priority || 1) >= 3) { // High priority
          // Find the least loaded agent who isn't already assigned
          for (const agent of availableAgents) {
            if (!assignedAgents.has(agent.user_id)) {
              assignments.push({ call, agent });
              assignedAgents.add(agent.user_id);
              break;
            }
          }
        }
      }
      
      // Second pass: assign remaining calls to remaining agents
      const remainingCalls = calls.filter(call => 
        !assignments.some(assignment => assignment.call.id === call.id)
      );
      
      const remainingAgents = availableAgents.filter(agent => 
        !assignedAgents.has(agent.user_id)
      );
      
      // Assign remaining calls to remaining agents
      for (let i = 0; i < Math.min(remainingCalls.length, remainingAgents.length); i++) {
        assignments.push({
          call: remainingCalls[i],
          agent: remainingAgents[i]
        });
      }
      
      return assignments;
    } catch (error) {
      console.error('Error distributing calls to agents:', error);
      return [];
    }
  }
}

// Create a singleton instance
const loadBalancingService = new LoadBalancingService();

module.exports = loadBalancingService;