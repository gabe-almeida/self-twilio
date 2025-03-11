// Agent Status Service for Twilio Dialer Web App
/**
 * Agent Status Service
 *
 * This service provides methods for managing agent statuses, including
 * automatic status transitions, status validation, and status tracking.
 * It implements configurable automatic transitions from statuses like
 * "After Call Work" to "Available" after a specified time period.
 */

const store = require('../memory-store');
const errorService = require('./error-service');
const featureFlags = require('./feature-flags');

// Define valid agent statuses
const AgentStatuses = {
  AVAILABLE: 'Available',
  UNAVAILABLE: 'Unavailable',
  OFFLINE: 'Offline',
  BUSY: 'Busy',
  AFTER_CALL_WORK: 'After Call Work'
};

// Define valid status transitions
const ValidStatusTransitions = {
  [AgentStatuses.AVAILABLE]: [AgentStatuses.UNAVAILABLE, AgentStatuses.OFFLINE, AgentStatuses.BUSY, AgentStatuses.AFTER_CALL_WORK],
  [AgentStatuses.UNAVAILABLE]: [AgentStatuses.AVAILABLE, AgentStatuses.OFFLINE, AgentStatuses.BUSY],
  [AgentStatuses.OFFLINE]: [AgentStatuses.AVAILABLE, AgentStatuses.UNAVAILABLE],
  [AgentStatuses.BUSY]: [AgentStatuses.AVAILABLE, AgentStatuses.UNAVAILABLE, AgentStatuses.OFFLINE, AgentStatuses.AFTER_CALL_WORK],
  [AgentStatuses.AFTER_CALL_WORK]: [AgentStatuses.AVAILABLE, AgentStatuses.UNAVAILABLE, AgentStatuses.OFFLINE]
};

// Map to track agents in After Call Work status
const agentsInAfterCallWork = new Map();

/**
 * Initialize the agent status service
 * 
 * @returns {Promise<boolean>} - True if initialization was successful
 */
const initialize = async () => {
  try {
    // Set up automatic status transition timer
    setInterval(checkAfterCallWorkTimeouts, 10000); // Check every 10 seconds
    
    console.log('Agent status service initialized');
    return true;
  } catch (error) {
    errorService.handleError(error, 'agent-status-service.initialize');
    return false;
  }
};

/**
 * Check for agents who have been in After Call Work status for too long
 * and automatically transition them to Available
 */
const checkAfterCallWorkTimeouts = async () => {
  try {
    // Check if automatic transition is enabled
    const autoTransitionEnabled = await featureFlags.isFeatureEnabled('agentStatus.autoTransitionFromACW');
    if (!autoTransitionEnabled) {
      return;
    }
    
    // Get the timeout duration from feature flags (default to 5 minutes)
    const timeoutMinutes = await featureFlags.getFeatureValue('agentStatus.acwTimeoutMinutes', 5);
    const timeoutMs = timeoutMinutes * 60 * 1000;
    
    const now = Date.now();
    
    // Check each agent in After Call Work status
    for (const [userId, startTime] of agentsInAfterCallWork.entries()) {
      // If they've been in ACW for longer than the timeout
      if (now - startTime > timeoutMs) {
        console.log(`Agent ${userId} has been in After Call Work for over ${timeoutMinutes} minutes, automatically transitioning to Available`);
        
        // Transition to Available
        await updateAgentStatus(userId, AgentStatuses.AVAILABLE, true);
      }
    }
  } catch (error) {
    errorService.handleError(error, 'agent-status-service.checkAfterCallWorkTimeouts');
  }
};

/**
 * Update an agent's status
 *
 * @param {string|number} userId - The ID of the agent
 * @param {string} newStatus - The new status to set
 * @param {boolean} isAutomatic - Whether this is an automatic transition
 * @returns {Promise<Object>} - Result of the status update
 */
const updateAgentStatus = async (userId, newStatus, isAutomatic = false) => {
  try {
    // Validate the status
    if (!Object.values(AgentStatuses).includes(newStatus)) {
      throw errorService.createValidationError(`Invalid status: ${newStatus}`);
    }
    
    // Get the agent's current status
    const currentStatusObj = await store.agentStatus.getByUserId(userId);
    const currentStatus = currentStatusObj ? currentStatusObj.status : null;
    
    // If this is a manual update, validate the transition if validation is enabled
    if (!isAutomatic && currentStatus) {
      const statusValidationEnabled = await featureFlags.isFeatureEnabled('agentStatus.statusValidationEnabled');
      
      if (statusValidationEnabled) {
        const validTransitions = ValidStatusTransitions[currentStatus] || [];
        if (!validTransitions.includes(newStatus)) {
          throw errorService.createValidationError(`Invalid status transition from ${currentStatus} to ${newStatus}`);
        }
      }
    }
    
    // Update the status in the database
    const result = await store.agentStatus.updateStatus(userId, newStatus);
    
    // Track agents in After Call Work status
    if (newStatus === AgentStatuses.AFTER_CALL_WORK) {
      agentsInAfterCallWork.set(userId, Date.now());
    } else {
      agentsInAfterCallWork.delete(userId);
    }
    
    // Log the status change
    console.log(`Agent ${userId} status changed from ${currentStatus} to ${newStatus}${isAutomatic ? ' (automatic)' : ''}`);
    
    // Return success
    return {
      success: true,
      userId,
      previousStatus: currentStatus,
      newStatus,
      isAutomatic
    };
  } catch (error) {
    const errorInfo = errorService.handleError(error, 'agent-status-service.updateAgentStatus');
    return {
      success: false,
      error: errorInfo.message
    };
  }
};

/**
 * Get time spent in current status
 * 
 * @param {string|number} userId - The ID of the agent
 * @returns {Promise<Object>} - Time in status information
 */
const getTimeInStatus = async (userId) => {
  try {
    // Get the agent's current status
    const statusObj = await store.agentStatus.getByUserId(userId);
    
    if (!statusObj) {
      return {
        success: false,
        error: 'Agent status not found'
      };
    }
    
    // Calculate time in status
    const lastStatusChange = new Date(statusObj.last_status_change);
    const now = new Date();
    const timeInStatusMs = now - lastStatusChange;
    
    return {
      success: true,
      userId,
      status: statusObj.status,
      timeInStatusMs,
      timeInStatusMinutes: Math.floor(timeInStatusMs / 60000),
      lastStatusChange: statusObj.last_status_change
    };
  } catch (error) {
    const errorInfo = errorService.handleError(error, 'agent-status-service.getTimeInStatus');
    return {
      success: false,
      error: errorInfo.message
    };
  }
};

/**
 * Get agents by status
 * 
 * @param {string} status - The status to filter by
 * @returns {Promise<Array>} - Array of agents with the specified status
 */
const getAgentsByStatus = async (status) => {
  try {
    // Get all agent statuses
    const allStatuses = await store.agentStatus.getAllWithUserInfo();
    
    // Filter by the requested status
    return allStatuses.filter(agent => agent.status === status);
  } catch (error) {
    errorService.handleError(error, 'agent-status-service.getAgentsByStatus');
    return [];
  }
};

/**
 * Get agents who have been in a status for longer than a specified time
 * 
 * @param {string} status - The status to filter by
 * @param {number} minutes - The minimum time in minutes
 * @returns {Promise<Array>} - Array of agents who have been in the status for longer than the specified time
 */
const getAgentsInStatusLongerThan = async (status, minutes) => {
  try {
    // Get agents with the specified status
    const agents = await getAgentsByStatus(status);
    
    // Calculate the cutoff time
    const cutoffTime = new Date(Date.now() - (minutes * 60 * 1000));
    
    // Filter agents who have been in the status longer than the cutoff
    return agents.filter(agent => 
      new Date(agent.last_status_change) < cutoffTime
    );
  } catch (error) {
    errorService.handleError(error, 'agent-status-service.getAgentsInStatusLongerThan');
    return [];
  }
};

module.exports = {
  AgentStatuses,
  ValidStatusTransitions,
  initialize,
  updateAgentStatus,
  getTimeInStatus,
  getAgentsByStatus,
  getAgentsInStatusLongerThan
};