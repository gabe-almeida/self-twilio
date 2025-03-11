# Monitoring and Alerting

## Overview

The monitoring and alerting system provides real-time visibility into the health and performance of the Twilio Dialer Web App. It tracks key metrics, generates alerts for anomalies, and provides a dashboard for visualizing system performance.

## Features

- **Real-time Metrics**: Tracks call volume, success rates, agent availability, and more
- **Customizable Alerts**: Configurable thresholds for various alert conditions
- **Historical Data**: Stores and displays historical performance data
- **Dashboard**: Visual representation of system metrics and alerts
- **Alert Management**: Acknowledge and manage alerts through the dashboard

## Architecture

The monitoring system consists of the following components:

1. **Monitoring Service**: Core service that collects and processes metrics
2. **API Routes**: RESTful endpoints for accessing monitoring data
3. **Dashboard**: Web interface for viewing metrics and managing alerts

## Configuration

The monitoring system is configured through feature flags in `config/feature-flags.json`:

```json
"monitoring": {
  "enabled": true,
  "updateIntervalMs": 60000,
  "alertCheckIntervalMs": 300000,
  "metricsLogIntervalMs": 3600000,
  "alertThresholds": {
    "highCallFailureRate": 0.3,
    "highQueueDepth": 20,
    "lowAgentAvailability": 0.2,
    "highCallVolume": 50,
    "longWaitTime": 300
  }
}
```

### Configuration Options

- `enabled`: Enable or disable the monitoring system
- `updateIntervalMs`: How often metrics are updated (in milliseconds)
- `alertCheckIntervalMs`: How often alerts are checked (in milliseconds)
- `metricsLogIntervalMs`: How often metrics are logged to disk (in milliseconds)
- `alertThresholds`: Thresholds for various alert conditions

## API Endpoints

### Get System Metrics

```
GET /api/monitoring/system
```

**Response:**
```json
{
  "success": true,
  "metrics": {
    "uptime": 3600,
    "callsProcessed": 100,
    "callsSucceeded": 80,
    "callsFailed": 20,
    "callsPerMinute": 5,
    "agentsAvailable": 3,
    "queuedCalls": 10,
    "avgWaitTime": 45,
    "avgCallDuration": 120,
    "lastUpdated": "2025-03-09T20:00:00.000Z"
  }
}
```

### Get Agent Metrics

```
GET /api/monitoring/agents
```

**Response:**
```json
{
  "success": true,
  "metrics": {
    "agent1": {
      "username": "Agent 1",
      "status": "Available",
      "callsProcessed": 50,
      "callsSucceeded": 45,
      "callsFailed": 5,
      "successRate": 0.9,
      "avgCallDuration": 60,
      "loadScore": 30,
      "inCooldown": false
    },
    "agent2": {
      "username": "Agent 2",
      "status": "Unavailable",
      "callsProcessed": 30,
      "callsSucceeded": 20,
      "callsFailed": 10,
      "successRate": 0.67,
      "avgCallDuration": 90,
      "loadScore": 60,
      "inCooldown": true
    }
  }
}
```

### Get Alerts

```
GET /api/monitoring/alerts?includeAcknowledged=false
```

**Response:**
```json
{
  "success": true,
  "alerts": [
    {
      "id": "alert-123",
      "type": "HIGH_FAILURE_RATE",
      "message": "Call failure rate is 30.0%",
      "timestamp": "2025-03-09T19:45:00.000Z",
      "count": 1,
      "acknowledged": false
    },
    {
      "id": "alert-124",
      "type": "HIGH_QUEUE_DEPTH",
      "message": "Queue depth is 25 calls",
      "timestamp": "2025-03-09T19:50:00.000Z",
      "count": 1,
      "acknowledged": false
    }
  ]
}
```

### Acknowledge Alert

```
POST /api/monitoring/alerts/:alertId/acknowledge
```

**Response:**
```json
{
  "success": true,
  "message": "Alert acknowledged"
}
```

### Get Historical Metrics

```
GET /api/monitoring/historical
```

**Response:**
```json
{
  "success": true,
  "metrics": [
    {
      "timestamp": "2025-03-09T19:00:00.000Z",
      "system": {
        "callsProcessed": 90,
        "callsSucceeded": 75,
        "callsFailed": 15,
        "callsPerMinute": 4
      }
    },
    {
      "timestamp": "2025-03-09T18:00:00.000Z",
      "system": {
        "callsProcessed": 80,
        "callsSucceeded": 70,
        "callsFailed": 10,
        "callsPerMinute": 3
      }
    }
  ]
}
```

## Dashboard

The monitoring dashboard is available at `/monitoring-dashboard.html` and provides a visual representation of system metrics and alerts.

### Features

- **System Overview**: Key metrics like calls processed, success rate, and agent availability
- **Agent Metrics**: Detailed metrics for each agent
- **Charts**: Visual representation of metrics over time
- **Alerts**: List of active alerts with acknowledgement functionality
- **Historical Data**: View historical performance data

## Alert Types

The monitoring system can generate the following types of alerts:

- **HIGH_FAILURE_RATE**: Call failure rate exceeds the configured threshold
- **HIGH_QUEUE_DEPTH**: Number of queued calls exceeds the configured threshold
- **LOW_AGENT_AVAILABILITY**: Percentage of available agents falls below the configured threshold
- **HIGH_CALL_VOLUME**: Call volume exceeds the configured threshold
- **LONG_WAIT_TIME**: Average wait time exceeds the configured threshold

## Implementation Details

### Monitoring Service

The monitoring service (`services/monitoring-service.js`) is responsible for:

1. Collecting metrics from various sources
2. Checking for alert conditions
3. Storing historical metrics
4. Providing access to current and historical metrics

### Metrics Collection

Metrics are collected from:

- **Load Balancing Service**: Call volume, success rates, agent metrics
- **Memory Store**: Agent status, queued calls, call history
- **System**: Uptime, timestamps

### Alert Generation

Alerts are generated when:

- Call failure rate exceeds the configured threshold
- Number of queued calls exceeds the configured threshold
- Percentage of available agents falls below the configured threshold
- Call volume exceeds the configured threshold
- Average wait time exceeds the configured threshold

### Historical Data

Historical metrics are stored in JSON files in the `data/metrics` directory. The metrics are logged at the configured interval and can be accessed through the API.

## Best Practices

1. **Set Appropriate Thresholds**: Configure alert thresholds based on your specific requirements
2. **Monitor Alert Frequency**: If you're getting too many alerts, adjust the thresholds
3. **Acknowledge Alerts**: Acknowledge alerts once they've been addressed
4. **Review Historical Data**: Use historical data to identify trends and patterns
5. **Check Dashboard Regularly**: Make the dashboard part of your regular operations

## Troubleshooting

### No Metrics Showing

- Check that the monitoring service is enabled in feature flags
- Verify that the monitoring service is initialized in `server/index.js`
- Check the server logs for any errors related to the monitoring service

### No Alerts Generated

- Check that alert thresholds are configured correctly
- Verify that the alert check interval is not too long
- Check the server logs for any errors related to alert generation

### Dashboard Not Loading

- Check that the monitoring dashboard HTML file is in the correct location
- Verify that the monitoring API routes are registered in `server/index.js`
- Check the browser console for any JavaScript errors