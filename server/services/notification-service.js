// Notification service for Twilio Dialer Web App
/**
 * This service manages agent notifications, particularly for status-related events.
 * It provides methods to create, retrieve, and dismiss notifications, as well as
 * automatic notification generation for events like being in After Call Work status
 * for too long.
 */

const errorService = require('./error-service');
const featureFlags = require('./feature-flags');
const agentStatusService = require('./agent-status-service');

// In-memory store for active notifications
const activeNotifications = new Map();

/**
 * Initialize the notification service
 * 
 * @returns {Promise<boolean>} - True if initialization was successful
 */
const initialize = async () => {
  try {
    // Set up notification check timer
    setInterval(checkForNotifications, 30000); // Check every 30 seconds
    
    console.log('Notification service initialized');
    return true;
  } catch (error) {
    errorService.handleError(error, 'notification-service.initialize');
    return false;
  }
};

/**
 * Check for notifications that need to be sent
 * This is called periodically to check for conditions that should trigger notifications
 */
const checkForNotifications = async () => {
  try {
    // Check if status notifications are enabled
    const notificationsEnabled = await featureFlags.isFeatureEnabled('agentStatus.statusNotificationsEnabled');
    if (!notificationsEnabled) {
      return;
    }
    
    // Get the reminder threshold from feature flags (default to 3 minutes)
    const reminderThresholdMinutes = await featureFlags.getFeatureValue('agentStatus.acwReminderMinutes', 3);
    
    // Get agents who have been in After Call Work status for longer than the threshold
    const agentsInACW = await agentStatusService.getAgentsInStatusLongerThan(
      agentStatusService.AgentStatuses.AFTER_CALL_WORK,
      reminderThresholdMinutes
    );
    
    // For each agent, create a notification if one doesn't already exist
    for (const agent of agentsInACW) {
      const notificationKey = `acw-reminder-${agent.user_id}`;
      
      // Skip if we already have an active notification for this agent
      if (activeNotifications.has(notificationKey)) {
        continue;
      }
      
      // Create a notification
      const notification = {
        id: notificationKey,
        type: 'acw-reminder',
        userId: agent.user_id,
        username: agent.username || `Agent ${agent.user_id}`,
        message: `You have been in After Call Work status for over ${reminderThresholdMinutes} minutes`,
        createdAt: new Date().toISOString(),
        timeInStatus: await agentStatusService.getTimeInStatus(agent.user_id)
      };
      
      // Store the notification
      activeNotifications.set(notificationKey, notification);
      
      // Log the notification
      console.log(`Created ACW reminder notification for agent ${agent.user_id} (${notification.username})`);
    }
  } catch (error) {
    errorService.handleError(error, 'notification-service.checkForNotifications');
  }
};

/**
 * Get active notifications for a user
 * 
 * @param {string|number} userId - The ID of the user
 * @returns {Promise<Object>} - Object containing notifications
 */
const getNotificationsForUser = async (userId) => {
  try {
    const userNotifications = [];
    
    // Find all notifications for this user
    for (const [key, notification] of activeNotifications.entries()) {
      if (notification.userId == userId) { // Use loose equality for string/number comparison
        userNotifications.push(notification);
      }
    }
    
    return {
      success: true,
      notifications: userNotifications
    };
  } catch (error) {
    const errorInfo = errorService.handleError(error, 'notification-service.getNotificationsForUser');
    return {
      success: false,
      error: errorInfo.message
    };
  }
};

/**
 * Dismiss a notification
 * 
 * @param {string|number} userId - The ID of the user
 * @param {string} notificationId - The ID of the notification to dismiss
 * @returns {Promise<Object>} - Result of the dismissal
 */
const dismissNotification = async (userId, notificationId) => {
  try {
    // Check if the notification exists
    if (!activeNotifications.has(notificationId)) {
      return {
        success: false,
        error: 'Notification not found'
      };
    }
    
    // Check if the notification belongs to the user
    const notification = activeNotifications.get(notificationId);
    if (notification.userId != userId) { // Use loose equality for string/number comparison
      return {
        success: false,
        error: 'Notification does not belong to this user'
      };
    }
    
    // Remove the notification
    activeNotifications.delete(notificationId);
    
    return {
      success: true,
      notificationId
    };
  } catch (error) {
    const errorInfo = errorService.handleError(error, 'notification-service.dismissNotification');
    return {
      success: false,
      error: errorInfo.message
    };
  }
};

/**
 * Create a custom notification
 * 
 * @param {string|number} userId - The ID of the user
 * @param {string} message - The notification message
 * @param {string} type - The notification type (optional, default: 'custom')
 * @param {Object} metadata - Additional metadata for the notification (optional)
 * @returns {Promise<Object>} - Result of the notification creation
 */
const createNotification = async (userId, message, type = 'custom', metadata = {}) => {
  try {
    // Generate a unique ID
    const notificationId = `${type}-${userId}-${Date.now()}`;
    
    // Create the notification
    const notification = {
      id: notificationId,
      type,
      userId,
      message,
      createdAt: new Date().toISOString(),
      metadata
    };
    
    // Store the notification
    activeNotifications.set(notificationId, notification);
    
    return {
      success: true,
      notification
    };
  } catch (error) {
    const errorInfo = errorService.handleError(error, 'notification-service.createNotification');
    return {
      success: false,
      error: errorInfo.message
    };
  }
};

/**
 * Dismiss all notifications for a user
 * 
 * @param {string|number} userId - The ID of the user
 * @returns {Promise<Object>} - Result of the dismissal
 */
const dismissAllNotificationsForUser = async (userId) => {
  try {
    let count = 0;
    
    // Find and remove all notifications for this user
    for (const [key, notification] of activeNotifications.entries()) {
      if (notification.userId == userId) { // Use loose equality for string/number comparison
        activeNotifications.delete(key);
        count++;
      }
    }
    
    return {
      success: true,
      count
    };
  } catch (error) {
    const errorInfo = errorService.handleError(error, 'notification-service.dismissAllNotificationsForUser');
    return {
      success: false,
      error: errorInfo.message
    };
  }
};

/**
 * Get all notifications (admin only)
 * 
 * @returns {Promise<Object>} - Object containing all notifications
 */
const getAllNotifications = async () => {
  try {
    const notifications = Array.from(activeNotifications.values());
    
    return {
      success: true,
      notifications
    };
  } catch (error) {
    const errorInfo = errorService.handleError(error, 'notification-service.getAllNotifications');
    return {
      success: false,
      error: errorInfo.message
    };
  }
};

module.exports = {
  initialize,
  getNotificationsForUser,
  dismissNotification,
  createNotification,
  dismissAllNotificationsForUser,
  getAllNotifications
};