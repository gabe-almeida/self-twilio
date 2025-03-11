# Agent Status Management Implementation Plan

This document provides a detailed implementation plan for improving agent status management in the outbound call system, with a focus on maintaining DRY principles and preserving existing functionality.

## 1. Implement Configurable Automatic Status Transitions

### Implementation Steps

- [x] **Create a new file `server/services/agent-status-service.js`**

```javascript
// Agent status service for Twilio Dialer Web App
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

// Initialize the service
const initialize = async () => {
  // Set up automatic status transition timer
  setInterval(checkAfterCallWorkTimeouts, 10000); // Check every 10 seconds
  
  console.log('Agent status service initialized');
  return true;
};

// Check for agents who have been in After Call Work status for too long
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

// Update an agent's status
const updateAgentStatus = async (userId, newStatus, isAutomatic = false) => {
  try {
    // Validate the status
    if (!Object.values(AgentStatuses).includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }
    
    // Get the agent's current status
    const currentStatusObj = await store.agentStatus.getByUserId(userId);
    const currentStatus = currentStatusObj ? currentStatusObj.status : null;
    
    // If this is a manual update, validate the transition
    if (!isAutomatic && currentStatus) {
      const validTransitions = ValidStatusTransitions[currentStatus] || [];
      if (!validTransitions.includes(newStatus)) {
        throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
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

// Get time spent in current status
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

// Get agents by status
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

// Get agents who have been in a status for longer than a specified time
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
```

- [x] **Update feature flags configuration to include agent status settings**

Update `server/config/feature-flags.json`:

```json
{
  "errorHandling": {
    "enabled": true,
    "retryEnabled": true,
    "maxRetries": 3,
    "failureCategorization": true
  },
  "logging": {
    "detailedErrors": true,
    "callStatusLogging": true
  },
  "agentStatus": {
    "autoTransitionFromACW": true,
    "acwTimeoutMinutes": 5,
    "statusValidationEnabled": true,
    "statusNotificationsEnabled": true
  }
}
```

- [x] **Modify `twiml-handler.js` to use the agent status service**

Update the `handleCallEnded` function in `server/twiml-handler.js`:

```javascript
// Add import at the top
const agentStatusService = require('./services/agent-status-service');

// Modify the handleCallEnded function
function handleCallEnded(params) {
  const twiml = new twilio.twiml.VoiceResponse();
  const callId = params.callId;
  const agentId = params.agentId;
  const callQueueId = params.callQueueId;
  const callStatus = params.DialCallStatus;
  const callDuration = params.DialCallDuration;
  
  console.log(`Call ${callId} ended with status: ${callStatus}`);
  console.log('Call duration:', callDuration, 'seconds');
  
  // If this was a queued call, update the queue
  if (callQueueId) {
    console.log(`Updating call queue entry ${callQueueId}`);
    
    // In a real implementation, you would update the call queue entry
    // with the call result and duration
    store.callQueue.complete(callQueueId, {
      duration: callDuration,
      status: callStatus
    }).catch(err => {
      console.error(`Error updating call queue entry ${callQueueId}:`, err);
    });
  }
  
  // If this was an agent call, update the agent status
  if (agentId) {
    console.log(`Updating agent ${agentId} status after call`);
    
    // Use the agent status service to set the agent to After Call Work
    agentStatusService.updateAgentStatus(
      agentId, 
      agentStatusService.AgentStatuses.AFTER_CALL_WORK
    ).catch(err => {
      console.error(`Error updating agent ${agentId} status:`, err);
    });
  }
  
  return twiml;
}
```

- [x] **Initialize the agent status service in `server/index.js`**

```javascript
// Add import at the top
const agentStatusService = require('./services/agent-status-service');

// Add after initializing the server
// Initialize the agent status service
agentStatusService.initialize()
  .then(() => {
    console.log('Agent status service initialized successfully');
  })
  .catch(error => {
    console.error('Error initializing agent status service:', error);
  });
```

## 2. Create a Status Transition Service

### Implementation Steps

- [x] **Create a new file `server/services/status-transition-service.js`**

```javascript
// Status transition service for Twilio Dialer Web App
const agentStatusService = require('./agent-status-service');
const errorService = require('./error-service');
const featureFlags = require('./feature-flags');
const store = require('../memory-store');

// Define status transition hooks
const beforeTransitionHooks = [];
const afterTransitionHooks = [];

// Register a hook to run before status transitions
const registerBeforeTransitionHook = (hook) => {
  if (typeof hook === 'function') {
    beforeTransitionHooks.push(hook);
    return true;
  }
  return false;
};

// Register a hook to run after status transitions
const registerAfterTransitionHook = (hook) => {
  if (typeof hook === 'function') {
    afterTransitionHooks.push(hook);
    return true;
  }
  return false;
};

// Execute a status transition with hooks
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
      canceled: false
    };
    
    // Run before transition hooks
    for (const hook of beforeTransitionHooks) {
      try {
        await hook(context);
        
        // If a hook canceled the transition, stop processing
        if (context.canceled) {
          console.log(`Status transition from ${fromStatus} to ${toStatus} for agent ${userId} was canceled by a hook`);
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
```

- [x] **Update feature flags configuration to include agent status settings**

Update `server/config/feature-flags.json`:

```json
{
  "errorHandling": {
    "enabled": true,
    "retryEnabled": true,
    "maxRetries": 3,
    "failureCategorization": true
  },
  "logging": {
    "detailedErrors": true,
    "callStatusLogging": true
  },
  "agentStatus": {
    "autoTransitionFromACW": true,
    "acwTimeoutMinutes": 5,
    "statusValidationEnabled": true,
    "statusNotificationsEnabled": true
  }
}
```

- [x] **Modify `twiml-handler.js` to use the agent status service**

Update the `handleCallEnded` function in `server/twiml-handler.js`:

```javascript
// Add import at the top
const agentStatusService = require('./services/agent-status-service');

// Modify the handleCallEnded function
function handleCallEnded(params) {
  const twiml = new twilio.twiml.VoiceResponse();
  const callId = params.callId;
  const agentId = params.agentId;
  const callQueueId = params.callQueueId;
  const callStatus = params.DialCallStatus;
  const callDuration = params.DialCallDuration;
  
  console.log(`Call ${callId} ended with status: ${callStatus}`);
  console.log('Call duration:', callDuration, 'seconds');
  
  // If this was a queued call, update the queue
  if (callQueueId) {
    console.log(`Updating call queue entry ${callQueueId}`);
    
    // In a real implementation, you would update the call queue entry
    // with the call result and duration
    store.callQueue.complete(callQueueId, {
      duration: callDuration,
      status: callStatus
    }).catch(err => {
      console.error(`Error updating call queue entry ${callQueueId}:`, err);
    });
  }
  
  // If this was an agent call, update the agent status
  if (agentId) {
    console.log(`Updating agent ${agentId} status after call`);
    
    // Use the agent status service to set the agent to After Call Work
    agentStatusService.updateAgentStatus(
      agentId,
      agentStatusService.AgentStatuses.AFTER_CALL_WORK
    ).catch(err => {
      console.error(`Error updating agent ${agentId} status:`, err);
    });
  }
  
  return twiml;
}
```

- [x] **Initialize the agent status service in `server/index.js`**

```javascript
// Add import at the top
const agentStatusService = require('./services/agent-status-service');

// Add after initializing the server
// Initialize the agent status service
agentStatusService.initialize()
  .then(() => {
    console.log('Agent status service initialized successfully');
  })
  .catch(error => {
    console.error('Error initializing agent status service:', error);
  });
```

## 2. Create a Status Transition Service

### Implementation Steps

- [x] **Create a new file `server/services/status-transition-service.js`**

```javascript
// Status transition service for Twilio Dialer Web App
const agentStatusService = require('./agent-status-service');
const errorService = require('./error-service');
const featureFlags = require('./feature-flags');
const store = require('../memory-store');

// Define status transition hooks
const beforeTransitionHooks = [];
const afterTransitionHooks = [];

// Register a hook to run before status transitions
const registerBeforeTransitionHook = (hook) => {
  if (typeof hook === 'function') {
    beforeTransitionHooks.push(hook);
    return true;
  }
  return false;
};

// Register a hook to run after status transitions
const registerAfterTransitionHook = (hook) => {
  if (typeof hook === 'function') {
    afterTransitionHooks.push(hook);
    return true;
  }
  return false;
};

// Execute a status transition with hooks
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
      canceled: false
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

// Get transition history for an agent
const getTransitionHistory = async (userId, limit = 10) => {
  try {
    // In a real implementation, you would store transition history in the database
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

// Add default hooks
registerAfterTransitionHook(async (context) => {
  // Log all transitions
  console.log(`Agent ${context.userId} transitioned from ${context.fromStatus} to ${context.toStatus}`);
});

module.exports = {
  registerBeforeTransitionHook,
  registerAfterTransitionHook,
  executeTransition,
  getTransitionHistory
};
```

- [x] **Update `routes/api.js` to use the status transition service**

```javascript
// Add imports at the top
const statusTransitionService = require('../services/status-transition-service');
const agentStatusService = require('../services/agent-status-service');

// Modify the agent status update endpoint
router.post('/agent-status', auth.isAgent, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    
    // Validate status
    const validStatuses = Object.values(agentStatusService.AgentStatuses);
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    // Get current status
    const currentStatusObj = await store.agentStatus.getByUserId(req.user.id);
    const currentStatus = currentStatusObj ? currentStatusObj.status : null;
    
    // Execute the transition
    const result = await statusTransitionService.executeTransition(
      req.user.id,
      currentStatus,
      status,
      { source: 'api', userAgent: req.headers['user-agent'] }
    );
    
    if (result.success) {
      res.json({ success: true, status, previousStatus: currentStatus });
    } else if (result.canceled) {
      res.status(403).json({ error: result.reason });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error updating agent status:', error);
    res.status(500).json({ error: 'Failed to update agent status' });
  }
});

// Add a new endpoint to get agent status history
router.get('/agent-status/history', auth.isAgent, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const history = await statusTransitionService.getTransitionHistory(req.user.id, limit);
    
    res.json(history);
  } catch (error) {
    console.error('Error getting agent status history:', error);
    res.status(500).json({ error: 'Failed to get agent status history' });
  }
});

// Add a new endpoint to get time in current status
router.get('/agent-status/time', auth.isAgent, async (req, res) => {
  try {
    const result = await agentStatusService.getTimeInStatus(req.user.id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error getting time in status:', error);
    res.status(500).json({ error: 'Failed to get time in status' });
  }
});
```

## 3. Enhance Agent Status Notifications

### Implementation Steps

- [x] **Create a new file `server/services/notification-service.js`**

```javascript
// Notification service for Twilio Dialer Web App
const errorService = require('./error-service');
const featureFlags = require('./feature-flags');
const agentStatusService = require('./agent-status-service');

// In-memory store for active notifications
const activeNotifications = new Map();

// Initialize the service
const initialize = async () => {
  // Set up notification check timer
  setInterval(checkForNotifications, 30000); // Check every 30 seconds
  
  console.log('Notification service initialized');
  return true;
};

// Check for notifications that need to be sent
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
        username: agent.username,
        message: `You have been in After Call Work status for over ${reminderThresholdMinutes} minutes`,
        createdAt: new Date().toISOString(),
        timeInStatus: await agentStatusService.getTimeInStatus(agent.user_id)
      };
      
      // Store the notification
      activeNotifications.set(notificationKey, notification);
      
      // Log the notification
      console.log(`Created ACW reminder notification for agent ${agent.user_id} (${agent.username})`);
    }
  } catch (error) {
    errorService.handleError(error, 'notification-service.checkForNotifications');
  }
};

// Get active notifications for a user
const getNotificationsForUser = async (userId) => {
  try {
    const userNotifications = [];
    
    // Find all notifications for this user
    for (const [key, notification] of activeNotifications.entries()) {
      if (notification.userId === userId) {
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

// Dismiss a notification
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
    if (notification.userId !== userId) {
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

// Create a custom notification
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

module.exports = {
  initialize,
  getNotificationsForUser,
  dismissNotification,
  createNotification
};
```

- [x] **Add notification endpoints to `routes/api.js`**

```javascript
// Add import at the top
const notificationService = require('../services/notification-service');

// Add notification endpoints
router.get('/notifications', auth.isAuthenticated, async (req, res) => {
  try {
    const result = await notificationService.getNotificationsForUser(req.user.id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

router.post('/notifications/dismiss/:id', auth.isAuthenticated, async (req, res) => {
  try {
    const notificationId = req.params.id;
    
    const result = await notificationService.dismissNotification(req.user.id, notificationId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error dismissing notification:', error);
    res.status(500).json({ error: 'Failed to dismiss notification' });
  }
});
```

- [x] **Initialize the notification service in `server/index.js`**

```javascript
// Add import at the top
const notificationService = require('./services/notification-service');

// Add after initializing the agent status service
// Initialize the notification service
notificationService.initialize()
  .then(() => {
    console.log('Notification service initialized successfully');
  })
  .catch(error => {
    console.error('Error initializing notification service:', error);
  });
```

## 4. Update the UI to Display Status Information and Notifications

### Implementation Steps

- [x] **Add status timer to `server/public/dashboard.html`**

```html
<!-- Add this to the agent status section -->
<div class="status-timer" id="statusTimer">
  <span id="statusTimerValue">00:00:00</span>
  <span id="statusLabel">in current status</span>
</div>

<!-- Add this to the JavaScript section -->
<script>
  // Status timer functionality
  let statusTimerInterval;
  let statusStartTime;
  
  function updateStatusTimer() {
    // Fetch the current time in status
    fetch('/api/agent-status/time')
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Store the start time
          statusStartTime = new Date(new Date() - data.timeInStatusMs);
          
          // Update the timer display
          updateTimerDisplay();
          
          // Start the timer interval
          if (statusTimerInterval) {
            clearInterval(statusTimerInterval);
          }
          
          statusTimerInterval = setInterval(updateTimerDisplay, 1000);
        }
      })
      .catch(error => {
        console.error('Error fetching status time:', error);
      });
  }
  
  function updateTimerDisplay() {
    const now = new Date();
    const diff = now - statusStartTime;
    
    // Format the time difference
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    // Update the display
    document.getElementById('statusTimerValue').textContent = 
      `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Highlight the timer if it's been too long
    if (hours > 0 || minutes >= 5) {
      document.getElementById('statusTimer').classList.add('status-timer-warning');
    } else {
      document.getElementById('statusTimer').classList.remove('status-timer-warning');
    }
  }
  
  // Call this when the page loads and when status changes
  updateStatusTimer();
  
  // Add to the status change event handler
  function updateAgentStatus(status) {
    // Existing code...
    
    // Update the status timer
    updateStatusTimer();
  }
</script>

<!-- Add this to the CSS section -->
<style>
  .status-timer {
    margin-top: 10px;
    font-size: 14px;
    color: #666;
  }
  
  #statusTimerValue {
    font-weight: bold;
    font-family: monospace;
  }
  
  .status-timer-warning {
    color: #f44336;
  }
</style>
```

- [x] **Add notifications UI to `server/public/dashboard.html`**

```html
<!-- Add this to the main content area -->
<div class="notifications-container" id="notificationsContainer">
  <div class="notifications-header">
    <h3>Notifications</h3>
    <span class="notification-count" id="notificationCount">0</span>
  </div>
  <div class="notifications-list" id="notificationsList">
    <!-- Notifications will be added here dynamically -->
  </div>
</div>

<!-- Add this to the JavaScript section -->
<script>
  // Notifications functionality
  function loadNotifications() {
    fetch('/api/notifications')
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Update the notification count
          document.getElementById('notificationCount').textContent = data.notifications.length;
          
          // Clear the current notifications
          const notificationsList = document.getElementById('notificationsList');
          notificationsList.innerHTML = '';
          
          // Add each notification
          data.notifications.forEach(notification => {
            const notificationElement = document.createElement('div');
            notificationElement.className = `notification notification-${notification.type}`;
            notificationElement.innerHTML = `
              <div class="notification-content">
                <div class="notification-message">${notification.message}</div>
                <div class="notification-time">${formatTimeAgo(new Date(notification.createdAt))}</div>
              </div>
              <button class="notification-dismiss" data-id="${notification.id}">
                <i class="fas fa-times"></i>
              </button>
            `;
            
            notificationsList.appendChild(notificationElement);
          });
          
          // Add event listeners to dismiss buttons
          document.querySelectorAll('.notification-dismiss').forEach(button => {
            button.addEventListener('click', dismissNotification);
          });
          
          // Show or hide the container based on whether there are notifications
          if (data.notifications.length > 0) {
            document.getElementById('notificationsContainer').style.display = 'block';
          } else {
            document.getElementById('notificationsContainer').style.display = 'none';
          }
        }
      })
      .catch(error => {
        console.error('Error loading notifications:', error);
      });
  }
  
  function dismissNotification(event) {
    const notificationId = event.currentTarget.dataset.id;
    
    fetch(`/api/notifications/dismiss/${notificationId}`, {
      method: 'POST'
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Reload notifications
          loadNotifications();
        }
      })
      .catch(error => {
        console.error('Error dismissing notification:', error);
      });
  }
  
  function formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    
    if (diffSec < 60) {
      return 'just now';
    } else if (diffMin < 60) {
      return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
    } else if (diffHour < 24) {
      return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
  
  // Load notifications when the page loads
  loadNotifications();
  
  // Set up a timer to refresh notifications
  setInterval(loadNotifications, 30000); // Every 30 seconds
</script>

<!-- Add this to the CSS section -->
<style>
  .notifications-container {
    margin-top: 20px;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 10px;
    display: none; /* Hidden by default */
  }
  
  .notifications-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  
  .notifications-header h3 {
    margin: 0;
  }
  
  .notification-count {
    background-color: #f44336;
    color: white;
    border-radius: 50%;
    padding: 2px 6px;
    font-size: 12px;
  }
  
  .notification {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    border-bottom: 1px solid #eee;
  }
  
  .notification:last-child {
    border-bottom: none;
  }
  
  .notification-acw-reminder {
    background-color: #fff3e0;
  }
  
  .notification-message {
    font-weight: bold;
  }
  
  .notification-time {
    font-size: 12px;
    color: #666;
    margin-top: 5px;
  }
  
  .notification-dismiss {
    background: none;
    border: none;
    cursor: pointer;
    color: #999;
  }
  
  .notification-dismiss:hover {
    color: #f44336;
  }
</style>
```

## 5. Create an Admin Dashboard for Agent Status Monitoring

### Implementation Steps

- [x] **Add agent status monitoring to `server/public/admin.html`**

```html
<!-- Add this to the main content area -->
<div class="agent-status-dashboard">
  <h2>Agent Status Dashboard</h2>
  
  <div class="status-summary">
    <div class="status-card status-available">
      <div class="status-count" id="availableCount">0</div>
      <div class="status-label">Available</div>
    </div>
    <div class="status-card status-unavailable">
      <div class="status-count" id="unavailableCount">0</div>
      <div class="status-label">Unavailable</div>
    </div>
    <div class="status-card status-acw">
      <div class="status-count" id="acwCount">0</div>
      <div class="status-label">After Call Work</div>
    </div>
    <div class="status-card status-busy">
      <div class="status-count" id="busyCount">0</div>
      <div class="status-label">Busy</div>
    </div>
    <div class="status-card status-offline">
      <div class="status-count" id="offlineCount">0</div>
      <div class="status-label">Offline</div>
    </div>
  </div>
  
  <div class="agent-list-container">
    <h3>Agent Status List</h3>
    <table class="agent-status-table">
      <thead>
        <tr>
          <th>Agent</th>
          <th>Status</th>
          <th>Time in Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="agentStatusTableBody">
        <!-- Agent status rows will be added here dynamically -->
      </tbody>
    </table>
  </div>
</div>

<!-- Add this to the JavaScript section -->
<script>
  // Agent status dashboard functionality
  function loadAgentStatuses() {
    fetch('/api/agent-status')
      .then(response => response.json())
      .then(data => {
        // Reset counters
        let availableCount = 0;
        let unavailableCount = 0;
        let acwCount = 0;
        let busyCount = 0;
        let offlineCount = 0;
        
        // Clear the table
        const tableBody = document.getElementById('agentStatusTableBody');
        tableBody.innerHTML = '';
        
        // Process each agent status
        data.statuses.forEach(agent => {
          // Update counters
          switch (agent.status) {
            case 'Available':
              availableCount++;
              break;
            case 'Unavailable':
              unavailableCount++;
              break;
            case 'After Call Work':
              acwCount++;
              break;
            case 'Busy':
              busyCount++;
              break;
            case 'Offline':
              offlineCount++;
              break;
          }
          
          // Calculate time in status
          const lastStatusChange = new Date(agent.last_status_change);
          const now = new Date();
          const timeInStatus = now - lastStatusChange;
          const hours = Math.floor(timeInStatus / (1000 * 60 * 60));
          const minutes = Math.floor((timeInStatus % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((timeInStatus % (1000 * 60)) / 1000);
          const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
          
          // Create the table row
          const row = document.createElement('tr');
          row.className = `status-row status-${agent.status.toLowerCase().replace(/\s+/g, '-')}`;
          
          row.innerHTML = `
            <td>${agent.full_name || agent.username}</td>
            <td>${agent.status}</td>
            <td class="time-in-status" data-timestamp="${agent.last_status_change}">${timeString}</td>
            <td>
              <button class="action-button set-available" data-user-id="${agent.user_id}">Set Available</button>
              <button class="action-button set-unavailable" data-user-id="${agent.user_id}">Set Unavailable</button>
            </td>
          `;
          
          tableBody.appendChild(row);
        });
        
        // Update the summary counts
        document.getElementById('availableCount').textContent = availableCount;
        document.getElementById('unavailableCount').textContent = unavailableCount;
        document.getElementById('acwCount').textContent = acwCount;
        document.getElementById('busyCount').textContent = busyCount;
        document.getElementById('offlineCount').textContent = offlineCount;
        
        // Add event listeners to action buttons
        document.querySelectorAll('.set-available').forEach(button => {
          button.addEventListener('click', () => setAgentStatus(button.dataset.userId, 'Available'));
        });
        
        document.querySelectorAll('.set-unavailable').forEach(button => {
          button.addEventListener('click', () => setAgentStatus(button.dataset.userId, 'Unavailable'));
        });
      })
      .catch(error => {
        console.error('Error loading agent statuses:', error);
      });
  }
  
  function setAgentStatus(userId, status) {
    fetch('/api/admin/agent-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        status
      })
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Reload agent statuses
          loadAgentStatuses();
        } else {
          alert(`Error setting agent status: ${data.error}`);
        }
      })
      .catch(error => {
        console.error('Error setting agent status:', error);
        alert('Error setting agent status. See console for details.');
      });
  }
  
  // Update time in status for all agents
  function updateTimeInStatus() {
    document.querySelectorAll('.time-in-status').forEach(cell => {
      const timestamp = cell.dataset.timestamp;
      const lastStatusChange = new Date(timestamp);
      const now = new Date();
      const timeInStatus = now - lastStatusChange;
      const hours = Math.floor(timeInStatus / (1000 * 60 * 60));
      const minutes = Math.floor((timeInStatus % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeInStatus % (1000 * 60)) / 1000);
      cell.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      // Highlight long durations
      if (hours > 0 || minutes >= 5) {
        cell.classList.add('long-duration');
      } else {
        cell.classList.remove('long-duration');
      }
    });
  }
  
  // Load agent statuses when the page loads
  loadAgentStatuses();
  
  // Set up timers to refresh data
  setInterval(loadAgentStatuses, 60000); // Refresh full data every minute
  setInterval(updateTimeInStatus, 1000); // Update time displays every second
</script>

<!-- Add this to the CSS section -->
<style>
  .agent-status-dashboard {
    margin-top: 20px;
  }
  
  .status-summary {
    display: flex;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  
  .status-card {
    flex: 1;
    margin: 0 10px;
    padding: 15px;
    border-radius: 4px;
    text-align: center;
    color: white;
  }
  
  .status-count {
    font-size: 24px;
    font-weight: bold;
  }
  
  .status-label {
    margin-top: 5px;
  }
  
  .status-available {
    background-color: #4caf50;
  }
  
  .status-unavailable {
    background-color: #ff9800;
  }
  
  .status-acw {
    background-color: #2196f3;
  }
  
  .status-busy {
    background-color: #f44336;
  }
  
  .status-offline {
    background-color: #9e9e9e;
  }
  
  .agent-status-table {
    width: 100%;
    border-collapse: collapse;
  }
  
  .agent-status-table th,
  .agent-status-table td {
    padding: 10px;
    border-bottom: 1px solid #ddd;
    text-align: left;
  }
  
  .agent-status-table th {
    background-color: #f5f5f5;
  }
  
  .status-row.status-available {
    background-color: rgba(76, 175, 80, 0.1);
  }
  
  .status-row.status-unavailable {
    background-color: rgba(255, 152, 0, 0.1);
  }
  
  .status-row.status-after-call-work {
    background-color: rgba(33, 150, 243, 0.1);
  }
  
  .status-row.status-busy {
    background-color: rgba(244, 67, 54, 0.1);
  }
  
  .status-row.status-offline {
    background-color: rgba(158, 158, 158, 0.1);
  }
  
  .action-button {
    padding: 5px 10px;
    margin-right: 5px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .set-available {
    background-color: #4caf50;
    color: white;
  }
  
  .set-unavailable {
    background-color: #ff9800;
    color: white;
  }
  
  .long-duration {
    color: #f44336;
    font-weight: bold;
  }
</style>
```

- [x] **Add admin API endpoint for setting agent status**

```javascript
// Add to routes/api.js
router.post('/admin/agent-status', auth.isAdmin, async (req, res) => {
  try {
    const { userId, status } = req.body;
    
    if (!userId || !status) {
      return res.status(400).json({ error: 'User ID and status are required' });
    }
    
    // Validate status
    const validStatuses = Object.values(agentStatusService.AgentStatuses);
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    // Get current status
    const currentStatusObj = await store.agentStatus.getByUserId(userId);
    const currentStatus = currentStatusObj ? currentStatusObj.status : null;
    
    // Execute the transition
    const result = await statusTransitionService.executeTransition(
      userId,
      currentStatus,
      status,
      { source: 'admin', adminId: req.user.id }
    );
    
    if (result.success) {
      res.json({ success: true, status, previousStatus: currentStatus });
    } else if (result.canceled) {
      res.status(403).json({ error: result.reason });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error updating agent status:', error);
    res.status(500).json({ error: 'Failed to update agent status' });
  }
});
```

## 6. Integration and Testing

### Implementation Steps

- [x] **Create unit tests for the new services**

Create a new file `server/tests/agent-status.test.js`:

```javascript
// Unit tests for agent status services
const assert = require('assert');
const agentStatusService = require('../services/agent-status-service');
const statusTransitionService = require('../services/status-transition-service');
const notificationService = require('../services/notification-service');

describe('Agent Status Services', () => {
  describe('Agent Status Service', () => {
    it('should validate status transitions', async () => {
      // Mock the store
      const originalStore = require('../memory-store');
      const mockStore = {
        agentStatus: {
          getByUserId: async () => ({ status: 'Available' }),
          updateStatus: async () => ({ changes: 1 })
        }
      };
      
      // Replace the store temporarily
      require('../services/agent-status-service').store = mockStore;
      
      // Test valid transition
      const validResult = await agentStatusService.updateAgentStatus(1, 'After Call Work');
      assert.strictEqual(validResult.success, true);
      assert.strictEqual(validResult.newStatus, 'After Call Work');
      
      // Test invalid transition (would need to modify the mock)
      
      // Restore the original store
      require('../services/agent-status-service').store = originalStore;
    });
    
    it('should calculate time in status correctly', async () => {
      // Mock the store with a status change from 5 minutes ago
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const mockStore = {
        agentStatus: {
          getByUserId: async () => ({ 
            status: 'Available',
            last_status_change: fiveMinutesAgo
          })
        }
      };
      
      // Replace the store temporarily
      require('../services/agent-status-service').store = mockStore;
      
      // Test time calculation
      const result = await agentStatusService.getTimeInStatus(1);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 'Available');
      assert(result.timeInStatusMinutes >= 4); // Allow for slight timing differences
      assert(result.timeInStatusMinutes <= 6);
      
      // Restore the original store
      require('../services/agent-status-service').store = originalStore;
    });
  });
  
  describe('Status Transition Service', () => {
    it('should execute hooks during transitions', async () => {
      let hookExecuted = false;
      
      // Register a test hook
      statusTransitionService.registerAfterTransitionHook((context) => {
        hookExecuted = true;
        assert.strictEqual(context.fromStatus, 'Available');
        assert.strictEqual(context.toStatus, 'Unavailable');
      });
      
      // Mock the agent status service
      const originalUpdateStatus = agentStatusService.updateAgentStatus;
      agentStatusService.updateAgentStatus = async () => ({
        success: true,
        previousStatus: 'Available',
        newStatus: 'Unavailable'
      });
      
      // Execute a transition
      await statusTransitionService.executeTransition(1, 'Available', 'Unavailable');
      
      // Verify the hook was executed
      assert.strictEqual(hookExecuted, true);
      
      // Restore the original function
      agentStatusService.updateAgentStatus = originalUpdateStatus;
    });
  });
  
  describe('Notification Service', () => {
    it('should create and retrieve notifications', async () => {
      // Create a test notification
      const createResult = await notificationService.createNotification(
        1,
        'Test notification',
        'test',
        { testData: true }
      );
      
      assert.strictEqual(createResult.success, true);
      assert.strictEqual(createResult.notification.message, 'Test notification');
      
      // Get notifications for the user
      const getResult = await notificationService.getNotificationsForUser(1);
      
      assert.strictEqual(getResult.success, true);
      assert(getResult.notifications.length > 0);
      assert(getResult.notifications.some(n => n.message === 'Test notification'));
      
      // Dismiss the notification
      const dismissResult = await notificationService.dismissNotification(
        1,
        createResult.notification.id
      );
      
      assert.strictEqual(dismissResult.success, true);
      
      // Verify it was dismissed
      const getAfterDismissResult = await notificationService.getNotificationsForUser(1);
      assert(!getAfterDismissResult.notifications.some(n => n.id === createResult.notification.id));
    });
  });
});
```

- [x] **Update `package.json` to include test script**

```json
"scripts": {
  "test": "mocha server/tests/*.test.js",
  "start": "node server/index.js",
  "dev": "nodemon server/index.js"
}
```

- [x] **Create integration tests**

Create a new file `server/tests/agent-status-integration.test.js`:

```javascript
// Integration tests for agent status
const assert = require('assert');
const request = require('supertest');
const app = require('../index');
const store = require('../memory-store');
const agentStatusService = require('../services/agent-status-service');
const statusTransitionService = require('../services/status-transition-service');
const notificationService = require('../services/notification-service');

describe('Agent Status Integration', function() {
  // These tests might take some time
  this.timeout(10000);
  
  // Test user credentials
  const testUser = {
    username: 'agent',
    password: 'agent123'
  };
  
  let authToken;
  
  // Before all tests, log in to get an auth token
  before(async () => {
    const response = await request(app)
      .post('/auth/login')
      .send(testUser);
    
    authToken = response.body.token;
  });
  
  it('should update agent status via API', async () => {
    // Set status to Available
    const response1 = await request(app)
      .post('/api/agent-status')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'Available' });
    
    assert.strictEqual(response1.status, 200);
    assert.strictEqual(response1.body.success, true);
    assert.strictEqual(response1.body.status, 'Available');
    
    // Verify the status was updated
    const agentStatus = await store.agentStatus.getByUserId(2); // Agent user ID
    assert.strictEqual(agentStatus.status, 'Available');
    
    // Set status to After Call Work
    const response2 = await request(app)
      .post('/api/agent-status')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'After Call Work' });
    
    assert.strictEqual(response2.status, 200);
    assert.strictEqual(response2.body.success, true);
    assert.strictEqual(response2.body.status, 'After Call Work');
    
    // Verify the status was updated
    const updatedAgentStatus = await store.agentStatus.getByUserId(2);
    assert.strictEqual(updatedAgentStatus.status, 'After Call Work');
  });
  
  it('should get time in status via API', async () => {
    // Set a known status
    await store.agentStatus.updateStatus(2, 'Available');
    
    // Wait a moment to ensure some time passes
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get time in status
    const response = await request(app)
      .get('/api/agent-status/time')
      .set('Authorization', `Bearer ${authToken}`);
    
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
    assert.strictEqual(response.body.status, 'Available');
    assert(response.body.timeInStatusMs > 0);
  });
  
  it('should create and retrieve notifications', async () => {
    // Create a notification for the test user
    await notificationService.createNotification(
      2, // Agent user ID
      'Test notification for integration test',
      'test'
    );
    
    // Get notifications
    const response = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${authToken}`);
    
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
    assert(response.body.notifications.length > 0);
    assert(response.body.notifications.some(n => 
      n.message === 'Test notification for integration test'
    ));
    
    // Dismiss the notification
    const notificationId = response.body.notifications.find(n => 
      n.message === 'Test notification for integration test'
    ).id;
    
    const dismissResponse = await request(app)
      .post(`/api/notifications/dismiss/${notificationId}`)
      .set('Authorization', `Bearer ${authToken}`);
    
    assert.strictEqual(dismissResponse.status, 200);
    assert.strictEqual(dismissResponse.body.success, true);
  });
});
```

## 7. Documentation

### Implementation Steps

- [x] **Create API documentation for new services**

Create a file `server/docs/agent-status-api.md`:

```markdown
# Agent Status API Documentation

This document describes the API for the new agent status management services.

## Agent Status Service

The Agent Status Service manages agent statuses and transitions.

### Methods

#### `updateAgentStatus(userId, newStatus, isAutomatic)`

Updates an agent's status.

**Parameters:**
- `userId`: The ID of the agent
- `newStatus`: The new status to set
- `isAutomatic`: Boolean indicating if this is an automatic transition (optional, default: false)

**Returns:**
```javascript
{
  success: true,
  userId: 123,
  previousStatus: "Available",
  newStatus: "After Call Work",
  isAutomatic: false
}
```

#### `getTimeInStatus(userId)`

Gets the time an agent has spent in their current status.

**Parameters:**
- `userId`: The ID of the agent

**Returns:**
```javascript
{
  success: true,
  userId: 123,
  status: "After Call Work",
  timeInStatusMs: 300000, // 5 minutes in milliseconds
  timeInStatusMinutes: 5,
  lastStatusChange: "2023-01-01T12:00:00Z"
}
```

#### `getAgentsByStatus(status)`

Gets all agents with a specific status.

**Parameters:**
- `status`: The status to filter by

**Returns:** Array of agent objects

#### `getAgentsInStatusLongerThan(status, minutes)`

Gets agents who have been in a status for longer than a specified time.

**Parameters:**
- `status`: The status to filter by
- `minutes`: The minimum time in minutes

**Returns:** Array of agent objects

### Constants

#### `AgentStatuses`

```javascript
{
  AVAILABLE: 'Available',
  UNAVAILABLE: 'Unavailable',
  OFFLINE: 'Offline',
  BUSY: 'Busy',
  AFTER_CALL_WORK: 'After Call Work'
}
```

#### `ValidStatusTransitions`

```javascript
{
  'Available': ['Unavailable', 'Offline', 'Busy', 'After Call Work'],
  'Unavailable': ['Available', 'Offline', 'Busy'],
  'Offline': ['Available', 'Unavailable'],
  'Busy': ['Available', 'Unavailable', 'Offline', 'After Call Work'],
  'After Call Work': ['Available', 'Unavailable', 'Offline']
}
```

## Status Transition Service

The Status Transition Service manages status transitions with hooks.

### Methods

#### `registerBeforeTransitionHook(hook)`

Registers a hook to run before status transitions.

**Parameters:**
- `hook`: Function to call before a transition

**Returns:** Boolean indicating success

#### `registerAfterTransitionHook(hook)`

Registers a hook to run after status transitions.

**Parameters:**
- `hook`: Function to call after a transition

**Returns:** Boolean indicating success

#### `executeTransition(userId, fromStatus, toStatus, metadata)`

Executes a status transition with hooks.

**Parameters:**
- `userId`: The ID of the agent
- `fromStatus`: The current status
- `toStatus`: The new status
- `metadata`: Additional metadata for the transition (optional)

**Returns:**
```javascript
{
  success: true,
  userId: 123,
  previousStatus: "Available",
  newStatus: "After Call Work",
  isAutomatic: false
}
```

#### `getTransitionHistory(userId, limit)`

Gets the transition history for an agent.

**Parameters:**
- `userId`: The ID of the agent
- `limit`: Maximum number of history entries to return (optional, default: 10)

**Returns:**
```javascript
{
  success: true,
  history: [
    {
      userId: 123,
      fromStatus: "Available",
      toStatus: "After Call Work",
      timestamp: "2023-01-01T12:00:00Z",
      metadata: { source: "api" }
    }
  ]
}
```

## Notification Service

The Notification Service manages agent notifications.

### Methods

#### `getNotificationsForUser(userId)`

Gets active notifications for a user.

**Parameters:**
- `userId`: The ID of the user

**Returns:**
```javascript
{
  success: true,
  notifications: [
    {
      id: "acw-reminder-123",
      type: "acw-reminder",
      userId: 123,
      message: "You have been in After Call Work status for over 3 minutes",
      createdAt: "2023-01-01T12:00:00Z"
    }
  ]
}
```

#### `dismissNotification(userId, notificationId)`

Dismisses a notification.

**Parameters:**
- `userId`: The ID of the user
- `notificationId`: The ID of the notification to dismiss

**Returns:**
```javascript
{
  success: true,
  notificationId: "acw-reminder-123"
}
```

#### `createNotification(userId, message, type, metadata)`

Creates a custom notification.

**Parameters:**
- `userId`: The ID of the user
- `message`: The notification message
- `type`: The notification type (optional, default: 'custom')
- `metadata`: Additional metadata for the notification (optional)

**Returns:**
```javascript
{
  success: true,
  notification: {
    id: "custom-123-1672574400000",
    type: "custom",
    userId: 123,
    message: "Custom notification",
    createdAt: "2023-01-01T12:00:00Z",
    metadata: {}
  }
}
```

## REST API Endpoints

### Agent Status Endpoints

#### `GET /api/agent-status`

Gets all agent statuses.

**Response:**
```javascript
{
  statuses: [
    {
      id: 1,
      user_id: 123,
      status: "Available",
      last_status_change: "2023-01-01T12:00:00Z",
      username: "agent1",
      full_name: "Agent One"
    }
  ]
}
```

#### `POST /api/agent-status`

Updates the current agent's status.

**Request Body:**
```javascript
{
  status: "Available"
}
```

**Response:**
```javascript
{
  success: true,
  status: "Available",
  previousStatus: "After Call Work"
}
```

#### `GET /api/agent-status/time`

Gets the time the current agent has spent in their current status.

**Response:**
```javascript
{
  success: true,
  userId: 123,
  status: "Available",
  timeInStatusMs: 300000,
  timeInStatusMinutes: 5,
  lastStatusChange: "2023-01-01T12:00:00Z"
}
```

#### `GET /api/agent-status/history`

Gets the status transition history for the current agent.

**Response:**
```javascript
{
  success: true,
  history: [
    {
      fromStatus: "Available",
      toStatus: "After Call Work",
      timestamp: "2023-01-01T12:00:00Z"
    }
  ]
}
```

### Notification Endpoints

#### `GET /api/notifications`

Gets active notifications for the current user.

**Response:**
```javascript
{
  success: true,
  notifications: [
    {
      id: "acw-reminder-123",
      type: "acw-reminder",
      userId: 123,
      message: "You have been in After Call Work status for over 3 minutes",
      createdAt: "2023-01-01T12:00:00Z"
    }
  ]
}
```

#### `POST /api/notifications/dismiss/:id`

Dismisses a notification.

**Response:**
```javascript
{
  success: true,
  notificationId: "acw-reminder-123"
}
```

### Admin Endpoints

#### `POST /api/admin/agent-status`

Updates an agent's status (admin only).

**Request Body:**
```javascript
{
  userId: 123,
  status: "Available"
}
```

**Response:**
```javascript
{
  success: true,
  status: "Available",
  previousStatus: "After Call Work"
}
```
```

## 8. Summary

This implementation plan provides a comprehensive approach to improving agent status management in the outbound call system. By following these steps, we will:

1. Implement configurable automatic status transitions
2. Create a status transition service with hooks
3. Enhance agent status notifications
4. Update the UI to display status information and notifications
5. Create an admin dashboard for agent status monitoring
6. Add comprehensive testing
7. Provide detailed documentation

