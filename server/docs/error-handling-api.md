# Error Handling API Documentation

This document describes the API for the new error handling services.

## Error Service

The Error Service provides centralized error handling and logging.

### Methods

#### `handleError(error, source)`

Processes an error and returns a standardized error object.

**Parameters:**
- `error`: The error object to handle
- `source`: A string identifying where the error occurred

**Returns:**
```javascript
{
  error: true,
  type: "ERROR_TYPE", // One of the ErrorTypes constants
  message: "Error message",
  retryable: true/false, // Whether this error can be retried
  id: "timestamp" // Unique identifier for the error
}
```

#### `logError(errorType, message, details)`

Logs an error with the specified details.

**Parameters:**
- `errorType`: One of the ErrorTypes constants
- `message`: Error message
- `details`: Additional error details (optional)

**Returns:** The logged error object

#### `isRetryableError(errorType, errorDetails)`

Determines if an error is retryable.

**Parameters:**
- `errorType`: One of the ErrorTypes constants
- `errorDetails`: Additional error details

**Returns:** Boolean indicating if the error is retryable

### Constants

#### `ErrorTypes`

```javascript
{
  TWILIO_API_ERROR: 'TWILIO_API_ERROR',
  CALL_INITIATION_ERROR: 'CALL_INITIATION_ERROR',
  QUEUE_PROCESSING_ERROR: 'QUEUE_PROCESSING_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
}
```

## Retry Service

The Retry Service manages call retry scheduling and processing.

### Methods

#### `scheduleRetry(callId, errorInfo)`

Schedules a call for retry.

**Parameters:**
- `callId`: The ID of the call to retry
- `errorInfo`: Information about the error that caused the retry

**Returns:** Boolean indicating success

#### `getCallsReadyForRetry()`

Gets all calls that are ready to be retried.

**Returns:** Array of call objects

#### `calculateRetryTime(retryCount)`

Calculates the next retry time using exponential backoff.

**Parameters:**
- `retryCount`: The current retry count

**Returns:** Date object representing when to retry

#### `processRetries(processQueueFn)`

Processes all calls that are ready for retry.

**Parameters:**
- `processQueueFn`: Function to call to process the queue

**Returns:** Number of calls processed

## Failure Categorization Service

The Failure Categorization Service categorizes call failures.

### Methods

#### `categorizeFailure(error, callStatus)`

Categorizes a failure based on error or call status.

**Parameters:**
- `error`: The error object (optional)
- `callStatus`: The call status string (optional)

**Returns:** One of the FailureCategories constants

#### `getFailureDescription(category)`

Gets a human-readable description of a failure category.

**Parameters:**
- `category`: One of the FailureCategories constants

**Returns:** String description

#### `isFailureCategoryRetryable(category)`

Determines if a failure category is retryable.

**Parameters:**
- `category`: One of the FailureCategories constants

**Returns:** Boolean indicating if the category is retryable

#### `getFailureInfo(error, callStatus)`

Gets detailed failure information for an error.

**Parameters:**
- `error`: The error object
- `callStatus`: The call status (optional)

**Returns:** Object with failure details

### Constants

#### `FailureCategories`

```javascript
{
  INVALID_NUMBER: 'INVALID_NUMBER',
  NETWORK_ERROR: 'NETWORK_ERROR',
  DESTINATION_UNREACHABLE: 'DESTINATION_UNREACHABLE',
  CALL_REJECTED: 'CALL_REJECTED',
  NO_ANSWER: 'NO_ANSWER',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  UNKNOWN: 'UNKNOWN'
}
```

## Feature Flags Service

The Feature Flags Service manages feature flags for gradual rollout.

### Methods

#### `isFeatureEnabled(featurePath)`

Checks if a feature is enabled.

**Parameters:**
- `featurePath`: Dot-notation path to the feature (e.g., 'errorHandling.retryEnabled')

**Returns:** Boolean indicating if the feature is enabled

#### `getFeatureValue(featurePath, defaultValue)`

Gets a feature flag value.

**Parameters:**
- `featurePath`: Dot-notation path to the feature
- `defaultValue`: Value to return if the feature is not found (optional)

**Returns:** The feature value or the default value

#### `enableFeature(featurePath)`

Enables a feature.

**Parameters:**
- `featurePath`: Dot-notation path to the feature

**Returns:** Boolean indicating success

#### `disableFeature(featurePath)`

Disables a feature.

**Parameters:**
- `featurePath`: Dot-notation path to the feature

**Returns:** Boolean indicating success

#### `getAllFeatureFlags()`

Gets all feature flags.

**Returns:** Object containing all feature flags

#### `loadFeatureFlags(force)`

Loads feature flags from file.

**Parameters:**
- `force`: Whether to force reload from disk (optional)

**Returns:** Object containing loaded feature flags

#### `saveFeatureFlags(flags)`

Saves feature flags to file.

**Parameters:**
- `flags`: The flags to save

**Returns:** Boolean indicating success

## Integration with Call Queue Manager

The error handling services are integrated with the Call Queue Manager to provide retry functionality and better error handling.

### Key Integration Points

1. **Error Handling**: All errors in the Call Queue Manager are now handled by the Error Service, providing standardized error responses and logging.

2. **Retry Scheduling**: Failed calls can be scheduled for retry based on the error type and retry policy.

3. **Failure Categorization**: Call failures are categorized to provide better insights and determine appropriate retry strategies.

4. **Feature Flags**: All new functionality can be enabled/disabled via feature flags for gradual rollout.

### Example Usage

```javascript
// Handle an error
try {
  // Some code that might throw an error
} catch (error) {
  const errorInfo = errorService.handleError(error, 'call-queue-manager.processQueue');
  console.error('Error processing call queue:', errorInfo);
  
  // Check if the error is retryable
  if (errorInfo.retryable) {
    // Schedule the call for retry
    await retryService.scheduleRetry(callId, errorInfo);
  }
}

// Process retries
await retryService.processRetries(() => callQueueManager.processQueue());

// Get failure information
const failureInfo = failureCategorization.getFailureInfo(error, callStatus);
console.log(`Call failed with category: ${failureInfo.category} - ${failureInfo.description}`);

// Check if a feature is enabled
const retryEnabled = await featureFlags.isFeatureEnabled('errorHandling.retryEnabled');
if (retryEnabled) {
  // Use retry functionality
}