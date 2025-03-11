# Load Balancing

## Overview

The load balancing system distributes calls among available agents in a fair and efficient manner, preventing any single agent from being overwhelmed while ensuring optimal call handling. It also includes throttling mechanisms to prevent system overload during high call volumes.

## Features

- **Fair Distribution**: Distributes calls based on agent load and call priority
- **Agent Metrics**: Tracks agent performance and load
- **Cooldown Mechanism**: Places agents in cooldown after consecutive failures
- **System Throttling**: Limits call volume during peak periods
- **Performance Monitoring**: Tracks system-wide metrics

## Architecture

The load balancing system consists of the following components:

1. **Load Balancing Service**: Core service that manages call distribution and metrics
2. **Integration with Call Queue Manager**: Determines how calls are assigned to agents
3. **Integration with Monitoring Service**: Provides metrics for monitoring

## Configuration

The load balancing system is configured through feature flags in `config/feature-flags.json`:

```json
"loadBalancing": {
  "enabled": true,
  "maxCallsPerMinute": 60,
  "agentCooldownMinutes": 5,
  "maxConsecutiveFailures": 3,
  "prioritizeHighPriorityCalls": true,
  "fairDistribution": true
}
```

### Configuration Options

- `enabled`: Enable or disable the load balancing system
- `maxCallsPerMinute`: Maximum number of calls allowed per minute
- `agentCooldownMinutes`: Duration of agent cooldown after consecutive failures
- `maxConsecutiveFailures`: Number of consecutive failures before cooldown
- `prioritizeHighPriorityCalls`: Whether to prioritize high-priority calls
- `fairDistribution`: Whether to use fair distribution algorithm

## Implementation Details

### Load Balancing Service

The load balancing service (`services/load-balancing-service.js`) is responsible for:

1. Distributing calls among available agents
2. Tracking agent metrics and load
3. Managing agent cooldowns
4. Throttling system during high call volumes
5. Providing metrics for monitoring

### Call Distribution Algorithm

The call distribution algorithm takes into account:

- Agent load (number of calls, success rate, etc.)
- Call priority
- Agent status (available, in cooldown, etc.)
- System load (calls per minute, etc.)

The algorithm works as follows:

1. Sort calls by priority (high priority first)
2. Sort agents by load score (lowest load first)
3. Assign calls to agents based on their load score
4. Skip agents in cooldown
5. Limit assignments based on system throttling

### Agent Metrics

The load balancing service tracks the following metrics for each agent:

- Calls processed
- Calls succeeded
- Calls failed
- Average call duration
- Load score
- Consecutive failures
- Cooldown status

### Agent Cooldown

Agents are placed in cooldown after a configurable number of consecutive failures. During cooldown, agents will not receive new calls. Cooldown duration is configurable.

### System Throttling

The system is throttled when the call volume exceeds the configured maximum calls per minute. During throttling, the system will limit the number of calls assigned to agents.

### Integration with Call Queue Manager

The load balancing service integrates with the call queue manager to determine how calls are assigned to agents. The call queue manager uses the load balancing service to:

1. Get call-agent assignments
2. Record call assignments
3. Record call results
4. Check if the system is throttled

### Integration with Monitoring Service

The load balancing service provides metrics to the monitoring service, including:

- System metrics (calls processed, calls per minute, etc.)
- Agent metrics (calls processed, success rate, etc.)

## Example Usage

### Distributing Calls to Agents

```javascript
// Get available agents
const availableAgents = await store.agentStatus.getAvailableAgents();

// Get queued calls
const queuedCalls = await store.callQueue.getQueued();

// Check if load balancing is enabled
const loadBalancingEnabled = await featureFlags.isFeatureEnabled('loadBalancing.enabled', false);

if (loadBalancingEnabled) {
  // Use load balancing service to distribute calls
  console.log('Using load balancing to distribute calls');
  
  // Check if system is throttled
  if (loadBalancingService.isSystemThrottled()) {
    console.log('System is throttled, limiting call distribution');
  }
  
  // Get call-agent assignments from load balancing service
  const assignments = loadBalancingService.distributeCallsToAgents(queuedCalls, availableAgents);
  
  console.log(`Load balancing assigned ${assignments.length} calls to agents`);
  
  // Process each assignment
  for (const { call, agent } of assignments) {
    // Record the assignment in load balancing service
    loadBalancingService.recordCallAssignment(agent.user_id, call);
    
    // Assign the call to the agent
    await this.assignCallToAgent(call, agent);
  }
} else {
  // Use traditional first-come, first-served distribution
  console.log('Using traditional call distribution');
  
  // Process each available agent
  for (const agent of availableAgents) {
    // Check if there are any calls left to process
    if (queuedCalls.length === 0) {
      break;
    }
    
    // Get the next call from the queue
    const nextCall = queuedCalls.shift();
    
    // Assign the call to the agent
    await this.assignCallToAgent(nextCall, agent);
  }
}
```

### Recording Call Results

```javascript
// Record call result in load balancing service if enabled
if (loadBalancingEnabled && agentId) {
  const duration = callStatus.CallDuration ? parseInt(callStatus.CallDuration) : 0;
  const success = status === 'completed';
  loadBalancingService.recordCallResult(agentId, call, success, duration);
}
```

## Agent Load Score Calculation

The agent load score is calculated based on:

- Number of calls processed
- Success rate
- Average call duration
- Time since last call

The formula for calculating the load score is:

```
loadScore = (callsProcessed * 0.5) + (failureRate * 50) + (avgCallDuration * 0.1) - (timeSinceLastCall * 0.01)
```

This formula ensures that:

- Agents who have processed more calls have a higher load score
- Agents with higher failure rates have a higher load score
- Agents with longer average call durations have a higher load score
- Agents who haven't had a call recently have a lower load score

## System Metrics

The load balancing service tracks the following system metrics:

- Total calls processed
- Total calls succeeded
- Total calls failed
- Calls per minute
- Calls in the last minute
- Throttling status
- Maximum calls per minute
- Throttle until timestamp

These metrics are used by the monitoring service to generate alerts and provide dashboard data.

## Best Practices

1. **Configure Appropriate Thresholds**: Set appropriate values for `maxCallsPerMinute`, `agentCooldownMinutes`, and `maxConsecutiveFailures`
2. **Monitor Agent Performance**: Regularly check agent metrics to identify performance issues
3. **Adjust Throttling**: Adjust `maxCallsPerMinute` based on system capacity and call volume
4. **Use with Monitoring**: Use the load balancing system in conjunction with the monitoring system for best results
5. **Test Different Configurations**: Use A/B testing to compare different load balancing configurations

## Troubleshooting

### Calls Not Being Distributed Fairly

- Check that load balancing is enabled in feature flags
- Verify that `fairDistribution` is set to `true`
- Check agent metrics to ensure load scores are being calculated correctly
- Ensure agents are not in cooldown

### System Being Throttled Too Often

- Increase `maxCallsPerMinute` if the system can handle more calls
- Check call volume patterns to identify peak periods
- Consider adding more agents during peak periods
- Implement call scheduling to distribute call volume more evenly

### Agents in Cooldown Too Often

- Check agent performance to identify issues
- Adjust `maxConsecutiveFailures` if needed
- Provide additional training to agents with high failure rates
- Check for system issues that might be causing failures

### Load Scores Not Reflecting Actual Load

- Review the load score calculation formula
- Adjust weights in the formula if needed
- Ensure all metrics are being tracked correctly
- Consider adding additional factors to the load score calculation