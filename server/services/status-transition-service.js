// Status Transition Service for Twilio Dialer Web App
/**
 * This service provides a state machine for agent status transitions with hooks
 * for before and after status changes. It centralizes status transition logic
 * and ensures that all transitions are valid according to the defined rules.
 */

const agentStatusService = require('./agent-status-service');
const errorService = require('./error-service');
const featureFlags = require('./feature-flags');
const store = require('../memory-store');

// Define status transition hooks
const beforeTransitionHooks = [];
const afterTransitionHooks = [];

/**
 * Register a hook to run before status transitions
 * 
 * @param {Function} hook - Function to call before a transition
 * @returns {boolean} - True if the hook was registered successfully
 */
const registerBeforeTransitionHook = (hook) => {
  if (typeof hook === 'function') {
    beforeTransitionHooks.push(hook);
    return true;
  }
  return false;
};

/**
 * Register a hook to run after status transitions
 * 
 * @param {Function} hook - Function to call after a transition
 * @returns {boolean} - True if the hook was registered successfully
 */
const registerAfterTransitionHook = (hook) => {
  if (typeof hook === 'function') {
    afterTransitionHooks.push(hook);
    return true;
  }
  return false;
};

/**
 * Execute a status transition with hooks
 * 
 * @param {string|number} userId - The ID of the agent
 * @param {string} fromStatus - The current status
 * @param {string} toStatus - The new status
 * @param {Object} metadata - Additional metadata for the transition (optional)
 * @returns {Promise<Object>} - Result of the status update
 */
const executeTransition = async (userId, fromStatus, toStatus, metadata = {}) => {
  try {
    // Check if status validation is enabled
    const validationEnabled = await featureFlags.isFeatureEnabled('agentStatus.statusValidationEnabled');
    
    // Create transition context
    const context = {
      userId,
      fromStatus,
      toStatus,
      timestamp: new Date().toISOString(),
      metadata,
      canceled: false,
      cancelReason: null
    };
    
    // Run before transition hooks
    for (const hook of beforeTransitionHooks) {
      try {
        await hook(context);
        
        // If a hook canceled the transition, stop processing
        if (context.canceled) {
          console.log(`Status transition from ${fromStatus} to ${toStatus} for agent ${userId} was canceled by a hook`);
          return {
            success: false,
            canceled: true,
            reason: context.cancelReason || 'Canceled by hook'
          };
        }
      } catch (hookError) {
        console.error('Error in before transition hook:', hookError);
        // Continue with other hooks
      }
    }
    
    // Perform the status transition
    const result = await agentStatusService.updateAgentStatus(userId, toStatus);
    
    // If the transition failed, return the error
    if (!result.success) {
      return result;
    }
    
    // Run after transition hooks
    for (const hook of afterTransitionHooks) {
      try {
        await hook({
          ...context,
          success: true,
          result
        });
      } catch (hookError) {
        console.error('Error in after transition hook:', hookError);
        // Continue with other hooks
      }
    }
    
    // Store transition history if enabled
    const storeHistory = await featureFlags.isFeatureEnabled('agentStatus.storeTransitionHistory');
    if (storeHistory) {
      await storeTransitionHistory(userId, fromStatus, toStatus, metadata);
    }
    
    // Return the result
    return result;
  } catch (error) {
    const errorInfo = errorService.handleError(error, 'status-transition-service.executeTransition');
    return {
      success: false,
      error: errorInfo.message
    };
  }
};

/**
 * Store a transition in the history
 * 
 * @param {string|number} userId - The ID of the agent
 * @param {string} fromStatus - The previous status
 * @param {string} toStatus - The new status
 * @param {Object} metadata - Additional metadata for the transition
 * @returns {Promise<boolean>} - True if the history was stored successfully
 */
const storeTransitionHistory = async (userId, fromStatus, toStatus, metadata) => {
  try {
    // In a real implementation, you would store this in a database
    // For now, we'll just log it
    console.log(`[HISTORY] Agent ${userId} transitioned from ${fromStatus} to ${toStatus}`, metadata);
    return true;
  } catch (error) {
    errorService.handleError(error, 'status-transition-service.storeTransitionHistory');
    return false;
  }
};

/**
 * Get transition history for an agent
 * 
 * @param {string|number} userId - The ID of the agent
 * @param {number} limit - Maximum number of history entries to return (optional, default: 10)
 * @returns {Promise<Object>} - The transition history
 */
const getTransitionHistory = async (userId, limit = 10) => {
  try {
    // In a real implementation, you would retrieve this from the database
    // For now, we'll return a placeholder
    return {
      success: true,
      history: []
    };
  } catch (error) {
    const errorInfo = errorService.handleError(error, 'status-transition-service.getTransitionHistory');
    return {
      success: false,
      error: errorInfo.message
    };
  }
};

/**
 * Check if a transition is valid
 * 
 * @param {string} fromStatus - The current status
 * @param {string} toStatus - The new status
 * @returns {boolean} - True if the transition is valid
 */
const isValidTransition = (fromStatus, toStatus) => {
  // If the status is the same, it's always valid
  if (fromStatus === toStatus) {
    return true;
  }
  
  // Check if the transition is defined in the valid transitions map
  const validTransitions = agentStatusService.ValidStatusTransitions[fromStatus] || [];
  return validTransitions.includes(toStatus);
};

/**
 * Get valid transitions for a status
 * 
 * @param {string} status - The current status
 * @returns {Array<string>} - Array of valid next statuses
 */
const getValidTransitions = (status) => {
  return agentStatusService.ValidStatusTransitions[status] || [];
};

// Add default hooks
registerAfterTransitionHook(async (context) => {
  // Log all transitions
  console.log(`Agent ${context.userId} transitioned from ${context.fromStatus} to ${context.toStatus}`);
});

// Add a hook to notify agents when they've been in After Call Work for too long
registerBeforeTransitionHook(async (context) => {
  // Only run for manual transitions from After Call Work to Available
  if (context.fromStatus === agentStatusService.AgentStatuses.AFTER_CALL_WORK && 
      context.toStatus === agentStatusService.AgentStatuses.AVAILABLE &&
      !context.metadata.isAutomatic) {
    
    // Get time in status
    const timeInStatus = await agentStatusService.getTimeInStatus(context.userId);
    
    // If they've been in ACW for more than 10 minutes, log it
    if (timeInStatus.success && timeInStatus.timeInStatusMinutes > 10) {
      console.log(`Agent ${context.userId} was in After Call Work for ${timeInStatus.timeInStatusMinutes} minutes`);
    }
  }
});

module.exports = {
  registerBeforeTransitionHook,
  registerAfterTransitionHook,
  executeTransition,
  getTransitionHistory,
  isValidTransition,
  getValidTransitions
};