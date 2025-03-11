# A/B Testing

## Overview

The A/B testing system enables comparing different implementations of features side-by-side to determine which performs better. This allows for data-driven decision making when introducing new features or optimizing existing ones.

## Features

- **Variant Selection**: Consistently assign users or entities to specific variants
- **Result Recording**: Track performance metrics for each variant
- **Test Configuration**: Define tests and their variants through feature flags
- **API Access**: Access test configurations and results through RESTful endpoints

## Architecture

The A/B testing system consists of the following components:

1. **A/B Testing Service**: Core service that manages test variants and results
2. **API Routes**: RESTful endpoints for accessing test data
3. **Integration Points**: Integration with other services like call distribution

## Configuration

The A/B testing system is configured through feature flags in `config/feature-flags.json`:

```json
"abTesting": {
  "enabled": true,
  "tests": {
    "callDistribution": {
      "enabled": true,
      "variants": {
        "traditional": 0.5,
        "loadBalanced": 0.5
      }
    },
    "retryStrategy": {
      "enabled": true,
      "variants": {
        "fixed": 0.3,
        "exponential": 0.7
      }
    }
  }
}
```

### Configuration Options

- `enabled`: Enable or disable the A/B testing system
- `tests`: Configuration for individual tests
  - `enabled`: Enable or disable a specific test
  - `variants`: The variants for the test with their weights

## API Endpoints

### Get Tests

```
GET /api/ab-testing/tests
```

**Response:**
```json
{
  "success": true,
  "tests": {
    "callDistribution": {
      "enabled": true,
      "variants": {
        "traditional": 0.5,
        "loadBalanced": 0.5
      },
      "totalWeight": 1.0
    },
    "retryStrategy": {
      "enabled": true,
      "variants": {
        "fixed": 0.3,
        "exponential": 0.7
      },
      "totalWeight": 1.0
    }
  }
}
```

### Get Results

```
GET /api/ab-testing/results
```

**Response:**
```json
{
  "success": true,
  "results": {
    "callDistribution": {
      "traditional": {
        "calls": 100,
        "successes": 80,
        "failures": 20,
        "avgDuration": 60,
        "totalDuration": 4800
      },
      "loadBalanced": {
        "calls": 100,
        "successes": 90,
        "failures": 10,
        "avgDuration": 55,
        "totalDuration": 4950
      }
    },
    "retryStrategy": {
      "fixed": {
        "retries": 30,
        "successes": 20,
        "failures": 10,
        "avgAttempts": 2.5,
        "totalAttempts": 75
      },
      "exponential": {
        "retries": 70,
        "successes": 60,
        "failures": 10,
        "avgAttempts": 2.2,
        "totalAttempts": 154
      }
    }
  }
}
```

### Get Variant

```
GET /api/ab-testing/variant/:test?entityId=123
```

**Response:**
```json
{
  "success": true,
  "variant": "loadBalanced"
}
```

### Record Result

```
POST /api/ab-testing/record
```

**Request Body:**
```json
{
  "testName": "callDistribution",
  "variant": "loadBalanced",
  "success": true,
  "metrics": {
    "duration": 60
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Test result recorded"
}
```

## Implementation Details

### A/B Testing Service

The A/B testing service (`services/ab-testing-service.js`) is responsible for:

1. Managing test configurations
2. Assigning entities to variants
3. Recording test results
4. Providing access to test data

### Variant Selection

Variants are selected based on:

- The test configuration
- The entity ID (if provided)
- Random assignment (if no entity ID is provided)

For consistent assignment, entity IDs are hashed to ensure the same entity always gets the same variant.

### Result Recording

Results are recorded for each variant, including:

- Success/failure counts
- Custom metrics (e.g., duration, attempts)

### Integration with Other Services

The A/B testing system integrates with:

- **Call Queue Manager**: For testing different call distribution strategies
- **Retry Service**: For testing different retry strategies

## Example: Call Distribution A/B Test

The call distribution A/B test compares two different strategies for distributing calls to agents:

1. **Traditional**: First-come, first-served distribution
2. **Load Balanced**: Distribution based on agent load and call priority

### Configuration

```json
"abTesting": {
  "enabled": true,
  "tests": {
    "callDistribution": {
      "enabled": true,
      "variants": {
        "traditional": 0.5,
        "loadBalanced": 0.5
      }
    }
  }
}
```

### Implementation

In `call-queue-manager.js`:

```javascript
// Check if A/B testing is enabled for call distribution
const abTestingEnabled = await featureFlags.isFeatureEnabled('abTesting.enabled', false);
const callDistributionTestEnabled = await featureFlags.isFeatureEnabled('abTesting.tests.callDistribution.enabled', false);

// Get the variant to use (loadBalanced or traditional)
let distributionVariant = 'loadBalanced'; // Default to load balanced

if (abTestingEnabled && callDistributionTestEnabled) {
  // Generate a unique ID for this distribution round
  const distributionId = `dist-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  // Get the variant from A/B testing service
  const variant = abTestingService.getVariant('callDistribution', distributionId);
  
  if (variant) {
    distributionVariant = variant;
    console.log(`A/B testing selected ${distributionVariant} distribution variant`);
  }
}

// Use the selected distribution method
if (distributionVariant === 'loadBalanced') {
  // Use load balancing service to distribute calls
  // ...
} else {
  // Use traditional first-come, first-served distribution
  // ...
}
```

### Recording Results

```javascript
// Record the assignment in A/B testing service if enabled
if (abTestingEnabled && callDistributionTestEnabled) {
  abTestingService.recordResult('callDistribution', 'loadBalanced', true, {
    agentId: agent.user_id,
    callId: call.id
  });
}
```

## Best Practices

1. **Define Clear Metrics**: Decide what metrics you want to compare before starting the test
2. **Use Consistent Entity IDs**: Use consistent entity IDs to ensure the same entity always gets the same variant
3. **Run Tests Long Enough**: Allow tests to run long enough to gather statistically significant data
4. **Monitor Results Regularly**: Check test results regularly to identify clear winners
5. **Implement One Test at a Time**: Avoid running multiple tests that might interfere with each other

## Troubleshooting

### Variant Selection Not Working

- Check that the A/B testing service is enabled in feature flags
- Verify that the specific test is enabled
- Check that the variant weights sum to a non-zero value
- Ensure entity IDs are consistent if using consistent assignment

### Results Not Being Recorded

- Check that the A/B testing service is initialized in `server/index.js`
- Verify that the test and variant names match the configuration
- Check the server logs for any errors related to result recording

### API Endpoints Not Working

- Check that the A/B testing API routes are registered in `server/index.js`
- Verify that the user has the necessary permissions to access the endpoints
- Check the server logs for any errors related to the API endpoints