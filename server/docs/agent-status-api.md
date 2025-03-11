# Agent Status API Documentation

This document describes the API for the agent status management services.

## Agent Status Service

The Agent Status Service manages agent statuses and transitions.

### Methods

#### `initialize()`

Initializes the agent status service and starts the automatic status transition timer.

**Returns:** Promise resolving to a boolean indicating success

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
- `status`: The status to filter by (optional, returns all agents if not provided)

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
      fromStatus: "Available",
      toStatus: "After Call Work",
      timestamp: "2023-01-01T12:00:00Z"
    }
  ]
}
```

#### `isValidTransition(fromStatus, toStatus)`

Checks if a transition is valid.

**Parameters:**
- `fromStatus`: The current status
- `toStatus`: The new status

**Returns:** Boolean indicating if the transition is valid

#### `getValidTransitions(status)`

Gets valid transitions for a status.

**Parameters:**
- `status`: The current status

**Returns:** Array of valid next statuses

## Notification Service

The Notification Service manages agent notifications.

### Methods

#### `initialize()`

Initializes the notification service and starts the notification check timer.

**Returns:** Promise resolving to a boolean indicating success

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

#### `dismissAllNotificationsForUser(userId)`

Dismisses all notifications for a user.

**Parameters:**
- `userId`: The ID of the user

**Returns:**
```javascript
{
  success: true,
  count: 3 // Number of notifications dismissed
}
```

#### `getAllNotifications()`

Gets all notifications (admin only).

**Returns:**
```javascript
{
  success: true,
  notifications: [
    // Array of all notifications
  ]
}
```

## REST API Endpoints

### Agent Status Endpoints

#### `GET /api/agent-status`

Gets all agent statuses.

**Response:**
```javascript
{
  success: true,
  data: [
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

#### `GET /api/agent-status/me`

Gets the current user's status and time in status.

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

#### `PUT /api/agent-status/me`

Updates the current user's status.

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

#### `GET /api/agent-status/by-status/:status`

Gets agents by status.

**Response:**
```javascript
{
  success: true,
  data: [
    // Array of agents with the specified status
  ]
}
```

#### `GET /api/agent-status/available`

Gets available agents.

**Response:**
```javascript
{
  success: true,
  data: [
    // Array of available agents
  ]
}
```

#### `GET /api/agent-status/in-status-longer-than/:status/:minutes`

Gets agents who have been in a status for longer than specified minutes.

**Response:**
```javascript
{
  success: true,
  data: [
    // Array of agents in the status for longer than specified minutes
  ]
}
```

#### `GET /api/agent-status/history`

Gets status transition history for the current user.

**Response:**
```javascript
{
  success: true,
  history: [
    // Array of status transitions
  ]
}
```

#### `GET /api/agent-status/valid-transitions/:status`

Gets valid transitions for a status.

**Response:**
```javascript
{
  success: true,
  status: "Available",
  validTransitions: [
    "Unavailable",
    "Offline",
    "Busy",
    "After Call Work"
  ]
}
```

#### `PUT /api/agent-status/:userId`

Updates an agent's status (admin only).

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

### Notification Endpoints

#### `GET /api/notifications`

Gets active notifications for the current user.

**Response:**
```javascript
{
  success: true,
  notifications: [
    // Array of notifications
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

#### `POST /api/notifications/dismiss-all`

Dismisses all notifications for the current user.

**Response:**
```javascript
{
  success: true,
  count: 3 // Number of notifications dismissed
}
```

#### `GET /api/admin/notifications`

Gets all notifications (admin only).

**Response:**
```javascript
{
  success: true,
  notifications: [
    // Array of all notifications
  ]
}
```

#### `POST /api/admin/notifications`

Creates a notification for a user (admin only).

**Request Body:**
```javascript
{
  userId: 123,
  message: "Important notification",
  type: "admin",
  metadata: {}
}
```

**Response:**
```javascript
{
  success: true,
  notification: {
    // Created notification
  }
}
```

## Client-Side Integration

The agent status services are integrated with the dashboard UI through the `agent-status.js` module, which provides:

1. Status timer display showing how long an agent has been in their current status
2. Notifications display showing active notifications
3. Automatic status transitions based on configured rules
4. Visual indicators for status changes and notifications

### Example Usage

```javascript
// Initialize the agent status manager
const agentStatusManager = new AgentStatusManager();
agentStatusManager.initialize();

// The manager will automatically:
// - Display the status timer
// - Poll for notifications
// - Update the UI when status changes
// - Handle notification dismissal