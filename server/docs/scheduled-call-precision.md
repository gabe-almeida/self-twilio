# Scheduled Call Precision Documentation

This document provides an overview of the scheduled call precision system implemented in the Twilio Dialer Web App.

## Overview

The scheduled call precision system replaces the fixed interval queue processing with a dynamic approach that:

1. Uses a priority queue sorted by scheduled time
2. Wakes up at the exact time calls need to be made
3. Optimizes scheduling based on call density and agent availability

This approach ensures that calls are made at the exact time they are scheduled, rather than waiting for the next queue processing interval.

## Scheduler Service

The scheduler service (`server/services/scheduler-service.js`) provides the following features:

- **Precise Scheduling**: Calls are scheduled to be made at the exact time specified, rather than waiting for the next queue processing interval.
- **Priority Queue**: Calls are sorted by scheduled time and priority, ensuring that higher priority calls are made first when multiple calls are scheduled for the same time.
- **Batch Processing**: Calls scheduled close together are processed in batches to optimize resource usage.
- **Schedule Optimization**: The service can optimize the schedule based on call density and agent availability.
- **Timezone Awareness**: The service respects the configured timezone for scheduling.

## Configuration

The scheduler service is configured through the feature flags system. The following configuration options are available:

- `scheduledCalls.enabled`: Whether the scheduler service is enabled
- `scheduledCalls.batchSize`: The maximum number of calls to process in a batch
- `scheduledCalls.batchTimeWindow`: The time window (in milliseconds) for batching calls
- `scheduledCalls.optimizationEnabled`: Whether schedule optimization is enabled
- `scheduledCalls.timezone`: The timezone to use for scheduling

## Usage

### Scheduling a Call

When a call is added to the queue with a `scheduled_for` time, the scheduler service will automatically schedule it to be processed at the specified time:

```javascript
// Add a call to the queue with a scheduled time
const result = await queueManager.addToQueue({
  phone_number: '+19785551234',
  contact_name: 'John Smith',
  notes: 'Follow-up call',
  priority: 2,
  scheduled_for: new Date('2023-06-01T14:30:00Z')
});

console.log(`Call scheduled for ${result.scheduled_time}`);
```

### Rescheduling a Call

To reschedule a call, update the call in the queue with a new `scheduled_for` time:

```javascript
// Reschedule a call
await store.callQueue.update(callId, {
  scheduled_for: new Date('2023-06-01T16:30:00Z')
});

// The scheduler service will automatically pick up the change
```

### Canceling a Scheduled Call

To cancel a scheduled call, either remove it from the queue or update its status:

```javascript
// Cancel a scheduled call by updating its status
await store.callQueue.updateStatus(callId, 'Canceled');

// The scheduler service will no longer process this call
```

## Schedule Optimization

The scheduler service can optimize the schedule based on call density and agent availability. This is useful for distributing calls more evenly throughout the day, avoiding periods of high call volume that might overwhelm available agents.

To optimize the schedule for a specific time range:

```javascript
// Optimize the schedule for the next 24 hours
const startTime = new Date();
const endTime = new Date(startTime.getTime() + 24 * 60 * 60 * 1000);

const result = await schedulerService.optimizeSchedule(startTime, endTime);
console.log(`Optimized schedule: ${result.changes} calls redistributed`);
```

## Schedule Density Visualization

The scheduler service provides a method to visualize the schedule density for a specific time range. This is useful for identifying periods of high call volume:

```javascript
// Get the schedule density for the next 24 hours
const startTime = new Date();
const endTime = new Date(startTime.getTime() + 24 * 60 * 60 * 1000);

const result = await schedulerService.getScheduleDensity(startTime, endTime, 15); // 15-minute intervals
console.log('Schedule density:', result.density);
```

The result includes the number of calls scheduled for each interval and the call IDs, which can be used to display a schedule density chart in the admin UI.

## Implementation Details

### ScheduledCallQueue Class

The `ScheduledCallQueue` class is responsible for managing the scheduled calls. It provides methods to:

- Add a call to the queue
- Remove a call from the queue
- Get all scheduled calls
- Get calls that are due to be processed
- Get the next scheduled call
- Get the time until the next scheduled call
- Sort the queue by scheduled time and priority
- Clear all scheduled timers

### SchedulerService Class

The `SchedulerService` class is responsible for processing scheduled calls. It provides methods to:

- Initialize the service
- Start and stop the service
- Schedule a call
- Cancel a scheduled call
- Reschedule a call
- Get all scheduled calls
- Get scheduled calls for a specific time range
- Get the schedule density for a specific time range
- Optimize the schedule based on call density and agent availability

## Integration with Call Queue Manager

The scheduler service is integrated with the call queue manager to ensure that scheduled calls are processed at the exact time they are scheduled. When a call is added to the queue with a `scheduled_for` time, the call queue manager will:

1. Add the call to the database
2. Schedule the call using the scheduler service
3. The scheduler service will wake up at the exact time the call is scheduled
4. The scheduler service will process the call by removing the `scheduled_for` time and triggering the queue processing

## Best Practices

1. **Use Realistic Scheduling**: Schedule calls during business hours and avoid scheduling too many calls at the same time.
2. **Consider Agent Availability**: Schedule calls based on expected agent availability to avoid overwhelming agents during peak times.
3. **Use Priority**: Assign appropriate priority to calls to ensure that important calls are processed first when multiple calls are scheduled for the same time.
4. **Monitor Schedule Density**: Regularly check the schedule density to identify periods of high call volume and optimize the schedule if needed.
5. **Use Timezone Awareness**: Configure the correct timezone for scheduling to ensure that calls are made at the appropriate local time.

## Future Improvements

1. **Agent Scheduling**: Integrate with agent scheduling to ensure that calls are scheduled when agents are available.
2. **Machine Learning Optimization**: Use machine learning to optimize the schedule based on historical call data and agent performance.
3. **Calendar Integration**: Integrate with calendar systems to schedule calls based on agent availability.
4. **Recurring Schedules**: Support recurring schedules for regular follow-up calls.
5. **Advanced Batching**: Implement more sophisticated batching algorithms to optimize resource usage.