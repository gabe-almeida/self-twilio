# Error Handling Implementation Plan

This document provides a detailed implementation plan for improving error handling in the outbound call system, with a focus on maintaining DRY principles and preserving existing functionality.

## 1. Create a Centralized Error Handling Service

### Implementation Steps

- [x] **Create a new file `server/services/error-service.js`**

```javascript
// Error handling service for Twilio Dialer Web App
const winston = require('winston'); // We'll use Winston for logging

// Define standard error types
const ErrorTypes = {
  TWILIO_API_ERROR: 'TWILIO_API_ERROR',
  CALL_INITIATION_ERROR: 'CALL_INITIATION_ERROR',
  QUEUE_PROCESSING_ERROR: 'QUEUE_PROCESSING_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'twilio-dialer' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Map Twilio error codes to our error types
const mapTwilioErrorToType = (twilioError) => {
  const errorCode = twilioError.code;
  
  // Map common Twilio error codes to our error types
  switch (errorCode) {
    case 21211: // Invalid 'To' phone number
    case 21214: // 'To' phone number cannot be reached
      return ErrorTypes.VALIDATION_ERROR;
    case 20003: // Authentication error
      return ErrorTypes.AUTHENTICATION_ERROR;
    case 20404: // Resource not found
    case 20429: // Too many requests
      return ErrorTypes.TWILIO_API_ERROR;
    default:
      return ErrorTypes.CALL_INITIATION_ERROR;
  }
};

// Determine if an error is retryable
const isRetryableError = (errorType, errorDetails) => {
  switch (errorType) {
    case ErrorTypes.TWILIO_API_ERROR:
      // Retry rate limiting or temporary API issues
      return errorDetails.code === 20429 || errorDetails.code === 20001;
    case ErrorTypes.CALL_INITIATION_ERROR:
      // Retry network or temporary issues
      return !errorDetails.permanent;
    case ErrorTypes.QUEUE_PROCESSING_ERROR:
      // Always retry queue processing errors
      return true;
    case ErrorTypes.DATABASE_ERROR:
      // Retry connection issues but not validation errors
      return errorDetails.isConnectionError;
    default:
      return false;
  }
};

// Log error with appropriate level and details
const logError = (errorType, message, details = {}) => {
  const errorInfo = {
    type: errorType,
    message,
    details,
    timestamp: new Date().toISOString()
  };
  
  logger.error(errorInfo);
  
  // Also log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${errorType}] ${message}`, details);
  }
  
  return errorInfo;
};

// Handle error and return standardized response
const handleError = (error, source = 'unknown') => {
  let errorType = ErrorTypes.UNKNOWN_ERROR;
  let errorDetails = {};
  let errorMessage = error.message || 'An unknown error occurred';
  
  // Determine error type and details
  if (error.name === 'TwilioError' || error.name === 'RestException') {
    errorType = mapTwilioErrorToType(error);
    errorDetails = {
      code: error.code,
      status: error.status,
      moreInfo: error.moreInfo,
      details: error.details
    };
  } else if (error.name === 'ValidationError') {
    errorType = ErrorTypes.VALIDATION_ERROR;
    errorDetails = { validation: error.details };
  } else if (error.name === 'DatabaseError') {
    errorType = ErrorTypes.DATABASE_ERROR;
    errorDetails = { 
      isConnectionError: error.message.includes('connection'),
      query: error.query
    };
  }
  
  // Log the error
  const loggedError = logError(errorType, errorMessage, {
    ...errorDetails,
    source,
    stack: error.stack
  });
  
  // Determine if error is retryable
  const retryable = isRetryableError(errorType, errorDetails);
  
  return {
    error: true,
    type: errorType,
    message: errorMessage,
    retryable,
    id: loggedError.timestamp // Use timestamp as a unique identifier
  };
};

module.exports = {
  ErrorTypes,
  handleError,
  logError,
  isRetryableError
};
```

- [x] **Install required dependencies**

```bash
npm install winston --save
```

- [x] **Update package.json to include the new dependency**

## 2. Implement Call Retry Mechanism

### Implementation Steps

- [x] **Modify the database schema to include retry fields**

Update `memory-store.js` to include retry fields in the call queue:

```javascript
// In the addToQueue method
addToQueue(call) {
  const newCall = {
    id: this.nextId.callQueue++,
    phone_number: call.phone_number,
    contact_name: call.contact_name || null,
    notes: call.notes || null,
    priority: call.priority || 1,
    status: call.status || 'Queued',
    created_at: new Date().toISOString(),
    scheduled_for: call.scheduled_for || null,
    assigned_to: null,
    completed_at: null,
    call_sid: null,
    call_duration: null,
    call_status: null,
    // Add new retry fields
    retry_count: 0,
    max_retries: call.max_retries || 3,
    last_retry: null,
    retry_after: null,
    failure_reason: null
  };
  
  this.callQueue.push(newCall);
  
  return { id: newCall.id };
}
```

- [x] **Create a retry service in `server/services/retry-service.js`**

```javascript
// Retry service for Twilio Dialer Web App
const errorService = require('./error-service');

// Calculate next retry time with exponential backoff
const calculateRetryTime = (retryCount) => {
  // Base delay is 1 minute, with exponential increase
  const baseDelayMs = 60 * 1000; // 1 minute
  const maxDelayMs = 60 * 60 * 1000; // 1 hour
  
  // Calculate delay with exponential backoff: 1min, 2min, 4min, 8min, etc.
  let delayMs = baseDelayMs * Math.pow(2, retryCount);
  
  // Add some jitter to prevent thundering herd problem
  delayMs = delayMs * (0.75 + Math.random() * 0.5);
  
  // Cap at maximum delay
  delayMs = Math.min(delayMs, maxDelayMs);
  
  // Return the time to retry
  return new Date(Date.now() + delayMs);
};

// Schedule a call for retry
const scheduleRetry = async (store, callId, errorInfo) => {
  try {
    // Get the call from the queue
    const call = await store.callQueue.getById(callId);
    
    if (!call) {
      errorService.logError(
        errorService.ErrorTypes.QUEUE_PROCESSING_ERROR,
        `Cannot schedule retry: Call ${callId} not found`
      );
      return false;
    }
    
    // Check if we've exceeded max retries
    if (call.retry_count >= call.max_retries) {
      await store.callQueue.updateStatus(callId, 'Failed');
      errorService.logError(
        errorService.ErrorTypes.CALL_INITIATION_ERROR,
        `Call ${callId} failed after ${call.retry_count} retries`,
        { phone_number: call.phone_number, failure_reason: errorInfo.message }
      );
      return false;
    }
    
    // Calculate next retry time
    const retryAfter = calculateRetryTime(call.retry_count);
    
    // Update call with retry information
    await store.callQueue.updateRetryInfo(callId, {
      status: 'Retry Scheduled',
      retry_count: call.retry_count + 1,
      last_retry: new Date().toISOString(),
      retry_after: retryAfter.toISOString(),
      failure_reason: errorInfo.message
    });
    
    errorService.logError(
      errorService.ErrorTypes.CALL_INITIATION_ERROR,
      `Scheduled retry ${call.retry_count + 1}/${call.max_retries} for call ${callId} at ${retryAfter.toISOString()}`,
      { phone_number: call.phone_number, error: errorInfo }
    );
    
    return true;
  } catch (error) {
    errorService.handleError(error, 'retry-service.scheduleRetry');
    return false;
  }
};

// Get calls that are ready for retry
const getCallsReadyForRetry = async (store) => {
  try {
    const now = new Date();
    const allCalls = await store.callQueue.getAll();
    
    return allCalls.filter(call => 
      call.status === 'Retry Scheduled' && 
      call.retry_after && 
      new Date(call.retry_after) <= now
    );
  } catch (error) {
    errorService.handleError(error, 'retry-service.getCallsReadyForRetry');
    return [];
  }
};

module.exports = {
  scheduleRetry,
  getCallsReadyForRetry,
  calculateRetryTime
};
```

- [x] **Update `memory-store.js` to add retry-related methods**

```javascript
// Add to the MemoryStore class
updateRetryInfo(callId, retryInfo) {
  const callIndex = this.callQueue.findIndex(call => call.id === callId);
  
  if (callIndex === -1) {
    return { changes: 0 };
  }
  
  this.callQueue[callIndex].status = retryInfo.status;
  this.callQueue[callIndex].retry_count = retryInfo.retry_count;
  this.callQueue[callIndex].last_retry = retryInfo.last_retry;
  this.callQueue[callIndex].retry_after = retryInfo.retry_after;
  this.callQueue[callIndex].failure_reason = retryInfo.failure_reason;
  
  return { changes: 1 };
}

// Add to the module.exports
module.exports = {
  // ... existing exports
  callQueue: {
    // ... existing methods
    updateRetryInfo: (callId, retryInfo) => Promise.resolve(store.updateRetryInfo(callId, retryInfo))
  }
}
```

- [x] **Modify `call-queue-manager.js` to handle retries**

```javascript
// Add imports at the top
const errorService = require('./services/error-service');
const retryService = require('./services/retry-service');

// Modify the processQueue method to include retry handling
async processQueue() {
  // Prevent concurrent processing
  if (this.isProcessing) {
    return;
  }
  
  this.isProcessing = true;
  
  try {
    // Get available agents
    const availableAgents = await store.agentStatus.getAvailableAgents();
    
    if (availableAgents.length === 0) {
      console.log('No available agents to process call queue');
      return;
    }
    
    // Get queued calls
    const queuedCalls = await store.callQueue.getQueued();
    
    // Get calls ready for retry
    const retriableCalls = await retryService.getCallsReadyForRetry(store);
    
    // Combine queued and retriable calls, with retriable calls at the front
    const allCalls = [...retriableCalls, ...queuedCalls];
    
    if (allCalls.length === 0) {
      console.log('No calls in queue to process');
      return;
    }
    
    console.log(`Processing call queue: ${allCalls.length} calls (${retriableCalls.length} retries), ${availableAgents.length} available agents`);
    
    // Process each available agent
    for (const agent of availableAgents) {
      // Skip if agent already has a call in progress
      if (this.callInProgress.has(agent.user_id)) {
        continue;
      }
      
      // Check if there are any calls left to process
      if (allCalls.length === 0) {
        break;
      }
      
      // Get the next call from the queue
      const nextCall = allCalls.shift();
      
      // Assign the call to the agent
      await this.assignCallToAgent(nextCall, agent);
    }
  } catch (error) {
    const errorInfo = errorService.handleError(error, 'call-queue-manager.processQueue');
    console.error('Error processing call queue:', errorInfo);
  } finally {
    this.isProcessing = false;
  }
}

// Modify the assignCallToAgent method to use the error service and retry service
async assignCallToAgent(call, agent) {
  try {
    console.log(`Assigning call ${call.id} to agent ${agent.user_id} (${agent.username})`);
    
    // Update the call in the database
    await store.callQueue.assignToAgent(call.id, agent.user_id);
    
    // Mark the agent as having a call in progress
    this.callInProgress.set(agent.user_id, call.id);
    
    // Initiate the call
    const result = await this.initiateCall(call, agent);
    
    if (result.success) {
      console.log(`Call ${call.id} successfully initiated with SID: ${result.callSid}`);
      
      // Update the call with the Twilio call SID
      await store.callQueue.updateStatus(call.id, 'In Progress', result.callSid);
      
      // Add to call history
      await store.callHistory.add({
        user_id: agent.user_id,
        phone_number: call.phone_number,
        contact_name: call.contact_name,
        direction: 'outbound',
        start_time: new Date().toISOString(),
        call_sid: result.callSid,
        call_status: 'initiated',
        notes: call.notes
      });
    } else {
      console.error(`Failed to initiate call ${call.id}:`, result.error);
      
      // Check if the error is retryable
      if (result.retryable) {
        // Schedule the call for retry
        await retryService.scheduleRetry(store, call.id, result);
      } else {
        // Mark the call as failed
        await store.callQueue.updateStatus(call.id, 'Failed');
        
        // Log the permanent failure
        errorService.logError(
          errorService.ErrorTypes.CALL_INITIATION_ERROR,
          `Permanent failure for call ${call.id}`,
          { phone_number: call.phone_number, error: result.error }
        );
      }
      
      // Remove from in-progress tracking
      this.callInProgress.delete(agent.user_id);
    }
  } catch (error) {
    const errorInfo = errorService.handleError(error, 'call-queue-manager.assignCallToAgent');
    console.error(`Error assigning call ${call.id} to agent ${agent.user_id}:`, errorInfo);
    
    // Mark the call as failed
    await store.callQueue.updateStatus(call.id, 'Failed');
    
    // Remove from in-progress tracking
    this.callInProgress.delete(agent.user_id);
  }
}

// Modify the initiateCall method to use the error service
async initiateCall(call, agent) {
  try {
    // Get the default caller ID from environment variables
    const defaultCallerId = process.env.DEFAULT_CALLER_ID || '+19788785223';
    
    // Format the destination number if needed
    let formattedNumber = call.phone_number;
    if (!formattedNumber.startsWith('+') && formattedNumber.replace(/\D/g, '').length === 10) {
      formattedNumber = `+1${formattedNumber.replace(/\D/g, '')}`;
    }
    
    // Get the server base URL
    const serverBaseUrl = process.env.SERVER_BASE_URL || 'http://localhost:3000';
    
    // Create call options
    const callOptions = {
      to: formattedNumber,
      from: defaultCallerId,
      url: `${serverBaseUrl}/voice/outgoing?to=${encodeURIComponent(formattedNumber)}&agentId=${agent.user_id}&callQueueId=${call.id}`,
      statusCallback: `${serverBaseUrl}/api/call-status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST'
    };
    
    console.log('Creating call with options:', JSON.stringify(callOptions, null, 2));
    
    // Create the call using Twilio REST API
    const twilioCall = await twilioClient.calls.create(callOptions);
    
    return {
      success: true,
      callSid: twilioCall.sid,
      status: twilioCall.status
    };
  } catch (error) {
    const errorInfo = errorService.handleError(error, 'call-queue-manager.initiateCall');
    console.error('Error initiating call:', errorInfo);
    
    return {
      success: false,
      error: errorInfo.message,
      retryable: errorInfo.retryable,
      errorType: errorInfo.type
    };
  }
}
```

## 3. Add Call Failure Categorization

### Implementation Steps

- [x] **Create a failure categorization service in `server/services/failure-categorization-service.js`**

```javascript
// Failure categorization service for Twilio Dialer Web App
const errorService = require('./error-service');

// Define failure categories
const FailureCategories = {
  INVALID_NUMBER: 'INVALID_NUMBER',
  NETWORK_ERROR: 'NETWORK_ERROR',
  DESTINATION_UNREACHABLE: 'DESTINATION_UNREACHABLE',
  CALL_REJECTED: 'CALL_REJECTED',
  NO_ANSWER: 'NO_ANSWER',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  UNKNOWN: 'UNKNOWN'
};

// Map Twilio error codes to failure categories
const mapTwilioErrorToCategory = (twilioError) => {
  const errorCode = twilioError.code;
  
  switch (errorCode) {
    // Invalid number errors
    case 21211: // Invalid 'To' phone number
    case 21214: // 'To' phone number cannot be reached
    case 21217: // Phone number does not appear to be valid
    case 21219: // 'To' phone number is not a valid mobile number
      return FailureCategories.INVALID_NUMBER;
    
    // Network errors
    case 31204: // Call connection failed
    case 31205: // Call dropped
    case 31208: // Connection timed out
      return FailureCategories.NETWORK_ERROR;
    
    // Destination unreachable
    case 21216: // 'To' phone number is not reachable via MMS
    case 21231: // 'To' phone number is not currently reachable via SMS
    case 21232: // 'To' phone number is not currently reachable via voice
      return FailureCategories.DESTINATION_UNREACHABLE;
    
    // Call rejected
    case 21610: // Caller is not authorized to call this number
    case 21612: // The call was rejected
      return FailureCategories.CALL_REJECTED;
    
    // No answer
    case 31003: // No answer
    case 31004: // Application took too long to respond
      return FailureCategories.NO_ANSWER;
    
    // Authentication errors
    case 20003: // Authentication error
    case 20006: // Account not active
      return FailureCategories.AUTHENTICATION_ERROR;
    
    // System errors
    case 20001: // Internal server error
    case 20002: // Service unavailable
    case 20429: // Too many requests
      return FailureCategories.SYSTEM_ERROR;
    
    default:
      return FailureCategories.UNKNOWN;
  }
};

// Map call status to failure category
const mapCallStatusToCategory = (callStatus) => {
  switch (callStatus) {
    case 'busy':
      return FailureCategories.DESTINATION_UNREACHABLE;
    case 'no-answer':
      return FailureCategories.NO_ANSWER;
    case 'failed':
      return FailureCategories.SYSTEM_ERROR;
    case 'canceled':
      return FailureCategories.CALL_REJECTED;
    default:
      return FailureCategories.UNKNOWN;
  }
};

// Categorize a failure based on error or call status
const categorizeFailure = (error, callStatus = null) => {
  // If we have a Twilio error, use that for categorization
  if (error && (error.name === 'TwilioError' || error.name === 'RestException')) {
    return mapTwilioErrorToCategory(error);
  }
  
  // If we have a call status, use that
  if (callStatus && callStatus !== 'completed' && callStatus !== 'in-progress') {
    return mapCallStatusToCategory(callStatus);
  }
  
  // If we have an error type from our error service, map that
  if (error && error.type) {
    switch (error.type) {
      case errorService.ErrorTypes.VALIDATION_ERROR:
        return FailureCategories.INVALID_NUMBER;
      case errorService.ErrorTypes.AUTHENTICATION_ERROR:
        return FailureCategories.AUTHENTICATION_ERROR;
      case errorService.ErrorTypes.TWILIO_API_ERROR:
      case errorService.ErrorTypes.CALL_INITIATION_ERROR:
        return FailureCategories.SYSTEM_ERROR;
      default:
        return FailureCategories.UNKNOWN;
    }
  }
  
  return FailureCategories.UNKNOWN;
};

// Get a human-readable description of a failure category
const getFailureDescription = (category) => {
  switch (category) {
    case FailureCategories.INVALID_NUMBER:
      return 'The phone number is invalid or malformed';
    case FailureCategories.NETWORK_ERROR:
      return 'A network error occurred while connecting the call';
    case FailureCategories.DESTINATION_UNREACHABLE:
      return 'The destination number is currently unreachable';
    case FailureCategories.CALL_REJECTED:
      return 'The call was rejected by the recipient';
    case FailureCategories.NO_ANSWER:
      return 'The call was not answered';
    case FailureCategories.SYSTEM_ERROR:
      return 'A system error occurred while processing the call';
    case FailureCategories.AUTHENTICATION_ERROR:
      return 'Authentication failed with the Twilio service';
    case FailureCategories.UNKNOWN:
    default:
      return 'An unknown error occurred';
  }
};

// Determine if a failure category is retryable
const isFailureCategoryRetryable = (category) => {
  switch (category) {
    case FailureCategories.NETWORK_ERROR:
    case FailureCategories.DESTINATION_UNREACHABLE:
    case FailureCategories.NO_ANSWER:
    case FailureCategories.SYSTEM_ERROR:
      return true;
    case FailureCategories.INVALID_NUMBER:
    case FailureCategories.CALL_REJECTED:
    case FailureCategories.AUTHENTICATION_ERROR:
    case FailureCategories.UNKNOWN:
      return false;
    default:
      return false;
  }
};

module.exports = {
  FailureCategories,
  categorizeFailure,
  getFailureDescription,
  isFailureCategoryRetryable
};
```

- [x] **Update `call-queue-manager.js` to use the failure categorization service**

```javascript
// Add import at the top
const failureCategorization = require('./services/failure-categorization-service');

// Modify the handleCallStatusUpdate method to use failure categorization
async handleCallStatusUpdate(callStatus) {
  try {
    const callSid = callStatus.CallSid;
    const status = callStatus.CallStatus;
    
    console.log(`Call status update for SID ${callSid}: ${status}`);
    
    // Find all calls in the queue
    const calls = await store.callQueue.getAll();
    
    // Find the call with matching SID
    const call = calls.find(c => c.call_sid === callSid);
    
    if (!call) {
      console.log(`No call found in queue with SID ${callSid}`);
      return;
    }
    
    const agentId = call.assigned_to;
    
    // Update call history
    const histories = await store.callHistory.getAll();
    const history = histories.find(h => h.call_sid === callSid);
    
    if (history) {
      await store.callHistory.update(callSid, { call_status: status });
    }
    
    // Handle different call statuses
    if (status === 'completed' || status === 'busy' || status === 'no-answer' || status === 'failed' || status === 'canceled') {
      // Call has ended
      console.log(`Call ${callSid} has ended with status: ${status}`);
      
      // Update call duration if available
      if (callStatus.CallDuration && history) {
        await store.callHistory.update(callSid, {
          duration: parseInt(callStatus.CallDuration),
          end_time: new Date().toISOString()
        });
      }
      
      // If the call was not completed successfully, categorize the failure
      if (status !== 'completed') {
        const failureCategory = failureCategorization.categorizeFailure(null, status);
        const failureDescription = failureCategorization.getFailureDescription(failureCategory);
        
        console.log(`Call ${callSid} failed with category: ${failureCategory} - ${failureDescription}`);
        
        // Check if this failure is retryable
        const isRetryable = failureCategorization.isFailureCategoryRetryable(failureCategory);
        
        if (isRetryable && call.retry_count < call.max_retries) {
          // Schedule for retry
          await retryService.scheduleRetry(store, call.id, {
            message: failureDescription,
            category: failureCategory
          });
          
          console.log(`Scheduled retry for call ${call.id} due to ${failureCategory}`);
        } else {
          // Mark as permanently failed
          await store.callQueue.updateStatus(call.id, 'Failed');
          
          // Log the permanent failure
          errorService.logError(
            errorService.ErrorTypes.CALL_INITIATION_ERROR,
            `Call ${call.id} permanently failed with status ${status}`,
            { 
              category: failureCategory,
              description: failureDescription,
              retryCount: call.retry_count,
              maxRetries: call.max_retries
            }
          );
        }
      } else {
        // Mark the call as completed in the queue
        await store.callQueue.updateStatus(call.id, 'Completed');
      }
      
      // Remove from in-progress tracking
      if (agentId) {
        this.callInProgress.delete(agentId);
      }
      
      // Process the queue again to assign new calls
      setTimeout(() => this.processQueue(), 1000);
    }
  } catch (error) {
    const errorInfo = errorService.handleError(error, 'call-queue-manager.handleCallStatusUpdate');
    console.error('Error handling call status update:', errorInfo);
  }
}
```

## 4. Integration and Testing

### Implementation Steps

- [x] **Create unit tests for the new services**

Create a new file `server/tests/error-handling.test.js`:

```javascript
// Unit tests for error handling services
const assert = require('assert');
const errorService = require('../services/error-service');
const retryService = require('../services/retry-service');
const failureCategorization = require('../services/failure-categorization-service');

describe('Error Handling Services', () => {
  describe('Error Service', () => {
    it('should correctly identify Twilio errors', () => {
      const twilioError = {
        name: 'RestException',
        code: 21211,
        message: 'Invalid phone number',
        status: 400
      };
      
      const result = errorService.handleError(twilioError, 'test');
      
      assert.strictEqual(result.type, errorService.ErrorTypes.VALIDATION_ERROR);
      assert.strictEqual(result.retryable, false);
    });
    
    it('should handle unknown errors', () => {
      const error = new Error('Something went wrong');
      
      const result = errorService.handleError(error, 'test');
      
      assert.strictEqual(result.type, errorService.ErrorTypes.UNKNOWN_ERROR);
    });
  });
  
  describe('Retry Service', () => {
    it('should calculate exponential backoff correctly', () => {
      const retry1 = retryService.calculateRetryTime(0);
      const retry2 = retryService.calculateRetryTime(1);
      const retry3 = retryService.calculateRetryTime(2);
      
      // First retry should be around 1 minute from now
      assert(retry1 > new Date(Date.now() + 45000)); // At least 45 seconds
      assert(retry1 < new Date(Date.now() + 90000)); // At most 90 seconds
      
      // Second retry should be around 2 minutes from now
      assert(retry2 > new Date(Date.now() + 90000)); // At least 90 seconds
      assert(retry2 < new Date(Date.now() + 180000)); // At most 3 minutes
      
      // Third retry should be around 4 minutes from now
      assert(retry3 > new Date(Date.now() + 180000)); // At least 3 minutes
      assert(retry3 < new Date(Date.now() + 360000)); // At most 6 minutes
    });
  });
  
  describe('Failure Categorization Service', () => {
    it('should categorize Twilio errors correctly', () => {
      const invalidNumberError = { name: 'TwilioError', code: 21211 };
      const networkError = { name: 'TwilioError', code: 31204 };
      
      assert.strictEqual(
        failureCategorization.categorizeFailure(invalidNumberError),
        failureCategorization.FailureCategories.INVALID_NUMBER
      );
      
      assert.strictEqual(
        failureCategorization.categorizeFailure(networkError),
        failureCategorization.FailureCategories.NETWORK_ERROR
      );
    });
    
    it('should categorize call statuses correctly', () => {
      assert.strictEqual(
        failureCategorization.categorizeFailure(null, 'busy'),
        failureCategorization.FailureCategories.DESTINATION_UNREACHABLE
      );
      
      assert.strictEqual(
        failureCategorization.categorizeFailure(null, 'no-answer'),
        failureCategorization.FailureCategories.NO_ANSWER
      );
    });
    
    it('should correctly identify retryable failures', () => {
      assert.strictEqual(
        failureCategorization.isFailureCategoryRetryable(
          failureCategorization.FailureCategories.NETWORK_ERROR
        ),
        true
      );
      
      assert.strictEqual(
        failureCategorization.isFailureCategoryRetryable(
          failureCategorization.FailureCategories.INVALID_NUMBER
        ),
        false
      );
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

- [x] **Install testing dependencies**

```bash
npm install mocha --save-dev
```

- [x] **Create integration tests**

Create a new file `server/tests/integration.test.js`:

```javascript
// Integration tests for error handling
const assert = require('assert');
const store = require('../memory-store');
const queueManager = require('../call-queue-manager');
const retryService = require('../services/retry-service');

// Mock Twilio client for testing
const mockTwilioClient = {
  calls: {
    create: async (options) => {
      // Simulate different scenarios based on the phone number
      if (options.to === '+15551234567') {
        return { sid: 'CA123456', status: 'queued' };
      } else if (options.to === '+15559876543') {
        throw {
          name: 'RestException',
          code: 21211,
          message: 'Invalid phone number',
          status: 400
        };
      } else if (options.to === '+15555555555') {
        throw {
          name: 'RestException',
          code: 20429,
          message: 'Too many requests',
          status: 429
        };
      } else {
        throw new Error('Unknown error');
      }
    }
  }
};

describe('Error Handling Integration', function() {
  // These tests might take some time
  this.timeout(10000);
  
  // Replace the real Twilio client with our mock
  before(() => {
    queueManager.twilioClient = mockTwilioClient;
  });
  
  // Restore the original Twilio client after tests
  after(() => {
    queueManager.twilioClient = require('twilio')(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  });
  
  it('should successfully initiate a call with valid number', async () => {
    // Add a test agent
    await store.agentStatus.updateStatus(2, 'Available');
    
    // Add a call with a valid number
    const callResult = await queueManager.addToQueue({
      phone_number: '+15551234567',
      contact_name: 'Test User',
      notes: 'Test call'
    });
    
    assert(callResult.success);
    
    // Process the queue
    await queueManager.processQueue();
    
    // Get the call from the queue
    const call = await store.callQueue.getById(callResult.id);
    
    // Verify the call was initiated
    assert.strictEqual(call.status, 'In Progress');
    assert(call.call_sid);
  });
  
  it('should handle invalid phone numbers', async () => {
    // Add a call with an invalid number
    const callResult = await queueManager.addToQueue({
      phone_number: '+15559876543',
      contact_name: 'Invalid User',
      notes: 'Invalid number test'
    });
    
    assert(callResult.success);
    
    // Process the queue
    await queueManager.processQueue();
    
    // Get the call from the queue
    const call = await store.callQueue.getById(callResult.id);
    
    // Verify the call was marked as failed (non-retryable)
    assert.strictEqual(call.status, 'Failed');
  });
  
  it('should schedule retries for retryable errors', async () => {
    // Add a call that will trigger a rate limit error (retryable)
    const callResult = await queueManager.addToQueue({
      phone_number: '+15555555555',
      contact_name: 'Retry User',
      notes: 'Retry test'
    });
    
    assert(callResult.success);
    
    // Process the queue
    await queueManager.processQueue();
    
    // Get the call from the queue
    const call = await store.callQueue.getById(callResult.id);
    
    // Verify the call was scheduled for retry
    assert.strictEqual(call.status, 'Retry Scheduled');
    assert.strictEqual(call.retry_count, 1);
    assert(call.retry_after);
    assert(call.last_retry);
  });
  
  it('should process retryable calls when they are ready', async () => {
    // Add a call that will be retried
    const callResult = await queueManager.addToQueue({
      phone_number: '+15555555555',
      contact_name: 'Retry User 2',
      notes: 'Retry processing test'
    });
    
    // Process the queue to trigger the initial failure
    await queueManager.processQueue();
    
    // Get the call and manually set the retry_after to now
    const calls = await store.callQueue.getAll();
    const call = calls.find(c => c.id === callResult.id);
    
    // Update the retry_after to now
    await store.callQueue.updateRetryInfo(call.id, {
      ...call,
      retry_after: new Date(Date.now() - 1000).toISOString() // 1 second ago
    });
    
    // Get calls ready for retry
    const retriableCalls = await retryService.getCallsReadyForRetry(store);
    
    // Verify our call is in the list
    assert(retriableCalls.some(c => c.id === call.id));
    
    // Process the queue again
    await queueManager.processQueue();
    
    // Get the updated call
    const updatedCall = await store.callQueue.getById(call.id);
    
    // Verify the retry count was incremented
    assert.strictEqual(updatedCall.retry_count, 2);
  });
});
```

## 5. Feature Flag Implementation

### Implementation Steps

- [x] **Create a feature flag service in `server/services/feature-flags.js`**

```javascript
// Feature flags service for Twilio Dialer Web App
const fs = require('fs').promises;
const path = require('path');

// Default feature flags configuration
const defaultFlags = {
  errorHandling: {
    enabled: false,
    retryEnabled: false,
    maxRetries: 3,
    failureCategorization: false
  },
  logging: {
    detailedErrors: false,
    callStatusLogging: true
  }
};

// In-memory cache of feature flags
let featureFlags = { ...defaultFlags };
let lastLoaded = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

// Path to feature flags file
const flagsFilePath = path.join(__dirname, '..', 'config', 'feature-flags.json');

// Load feature flags from file
const loadFeatureFlags = async (force = false) => {
  try {
    // Check if we need to reload
    const now = Date.now();
    if (!force && now - lastLoaded < CACHE_TTL) {
      return featureFlags;
    }
    
    // Try to read the file
    const data = await fs.readFile(flagsFilePath, 'utf8');
    const loadedFlags = JSON.parse(data);
    
    // Merge with defaults to ensure all properties exist
    featureFlags = {
      ...defaultFlags,
      ...loadedFlags
    };
    
    lastLoaded = now;
    console.log('Feature flags loaded:', featureFlags);
    
    return featureFlags;
  } catch (error) {
    // If file doesn't exist or has invalid JSON, use defaults
    if (error.code === 'ENOENT' || error instanceof SyntaxError) {
      console.log('No feature flags file found or invalid JSON, using defaults');
      
      // Create the directory if it doesn't exist
      try {
        await fs.mkdir(path.dirname(flagsFilePath), { recursive: true });
      } catch (mkdirError) {
        console.error('Error creating config directory:', mkdirError);
      }
      
      // Write default flags to file for future use
      try {
        await fs.writeFile(flagsFilePath, JSON.stringify(defaultFlags, null, 2));
        console.log('Created default feature flags file');
      } catch (writeError) {
        console.error('Error writing default feature flags:', writeError);
      }
      
      return defaultFlags;
    }
    
    console.error('Error loading feature flags:', error);
    return defaultFlags;
  }
};

// Save feature flags to file
const saveFeatureFlags = async (flags) => {
  try {
    // Merge with current flags
    const updatedFlags = {
      ...featureFlags,
      ...flags
    };
    
    // Write to file
    await fs.writeFile(flagsFilePath, JSON.stringify(updatedFlags, null, 2));
    
    // Update in-memory cache
    featureFlags = updatedFlags;
    lastLoaded = Date.now();
    
    console.log('Feature flags saved:', updatedFlags);
    return true;
  } catch (error) {
    console.error('Error saving feature flags:', error);
    return false;
  }
};

// Check if a feature is enabled
const isFeatureEnabled = async (featurePath) => {
  // Load flags (uses cache if available)
  await loadFeatureFlags();
  
  // Split the path into parts (e.g., 'errorHandling.retryEnabled')
  const parts = featurePath.split('.');
  
  // Navigate the object
  let current = featureFlags;
  for (const part of parts) {
    if (current === undefined || current === null) {
      return false;
    }
    current = current[part];
  }
  
  // Return the value, defaulting to false if undefined
  return Boolean(current);
};

// Get a feature flag value
const getFeatureValue = async (featurePath, defaultValue = null) => {
  // Load flags (uses cache if available)
  await loadFeatureFlags();
  
  // Split the path into parts
  const parts = featurePath.split('.');
  
  // Navigate the object
  let current = featureFlags;
  for (const part of parts) {
    if (current === undefined || current === null) {
      return defaultValue;
    }
    current = current[part];
  }
  
  // Return the value or default
  return current !== undefined ? current : defaultValue;
};

// Enable a feature
const enableFeature = async (featurePath) => {
  // Load current flags
  await loadFeatureFlags();
  
  // Split the path
  const parts = featurePath.split('.');
  
  // Create a new object with the updated path
  const updateObj = {};
  let current = updateObj;
  
  // Build the nested structure
  for (let i = 0; i < parts.length - 1; i++) {
    current[parts[i]] = {};
    current = current[parts[i]];
  }
  
  // Set the final property to true
  current[parts[parts.length - 1]] = true;
  
  // Save the updated flags
  return saveFeatureFlags(updateObj);
};

// Disable a feature
const disableFeature = async (featurePath) => {
  // Load current flags
  await loadFeatureFlags();
  
  // Split the path
  const parts = featurePath.split('.');
  
  // Create a new object with the updated path
  const updateObj = {};
  let current = updateObj;
  
  // Build the nested structure
  for (let i = 0; i < parts.length - 1; i++) {
    current[parts[i]] = {};
    current = current[parts[i]];
  }
  
  // Set the final property to false
  current[parts[parts.length - 1]] = false;
  
  // Save the updated flags
  return saveFeatureFlags(updateObj);
};

// Get all feature flags
const getAllFeatureFlags = async () => {
  await loadFeatureFlags();
  return { ...featureFlags };
};

module.exports = {
  isFeatureEnabled,
  getFeatureValue,
  enableFeature,
  disableFeature,
  getAllFeatureFlags,
  loadFeatureFlags
};
```

- [x] **Create a configuration directory and default feature flags file**

```bash
mkdir -p server/config
```

Create `server/config/feature-flags.json`:

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
  }
}
```

- [x] **Update `call-queue-manager.js` to use feature flags**

```javascript
// Add import at the top
const featureFlags = require('./services/feature-flags');

// Modify the processQueue method to check feature flags
async processQueue() {
  // Prevent concurrent processing
  if (this.isProcessing) {
    return;
  }
  
  this.isProcessing = true;
  
  try {
    // Get available agents
    const availableAgents = await store.agentStatus.getAvailableAgents();
    
    if (availableAgents.length === 0) {
      console.log('No available agents to process call queue');
      return;
    }
    
    // Get queued calls
    const queuedCalls = await store.callQueue.getQueued();
    
    // Check if retry feature is enabled
    const retryEnabled = await featureFlags.isFeatureEnabled('errorHandling.retryEnabled');
    
    let retriableCalls = [];
    if (retryEnabled) {
      // Get calls ready for retry
      retriableCalls = await retryService.getCallsReadyForRetry(store);
    }
    
    // Combine queued and retriable calls, with retriable calls at the front
    const allCalls = [...retriableCalls, ...queuedCalls];
    
    if (allCalls.length === 0) {
      console.log('No calls in queue to process');
      return;
    }
    
    console.log(`Processing call queue: ${allCalls.length} calls (${retriableCalls.length} retries), ${availableAgents.length} available agents`);
    
    // Process each available agent
    for (const agent of availableAgents) {
      // Skip if agent already has a call in progress
      if (this.callInProgress.has(agent.user_id)) {
        continue;
      }
      
      // Check if there are any calls left to process
      if (allCalls.length === 0) {
        break;
      }
      
      // Get the next call from the queue
      const nextCall = allCalls.shift();
      
      // Assign the call to the agent
      await this.assignCallToAgent(nextCall, agent);
    }
  } catch (error) {
    // Check if enhanced error handling is enabled
    const errorHandlingEnabled = await featureFlags.isFeatureEnabled('errorHandling.enabled');
    
    if (errorHandlingEnabled) {
      const errorInfo = errorService.handleError(error, 'call-queue-manager.processQueue');
      console.error('Error processing call queue:', errorInfo);
    } else {
      console.error('Error processing call queue:', error);
    }
  } finally {
    this.isProcessing = false;
  }
}
```

## 6. Deployment Strategy

### Implementation Steps

- [x] **Create a deployment plan document**

Create a file `server/docs/error-handling-deployment.md`:

```markdown
# Error Handling Deployment Plan

This document outlines the strategy for deploying the new error handling features to production.

## Phase 1: Preparation (Week 1)

1. Set up monitoring and alerting for call failures
   - Implement logging to track current failure rates
   - Create dashboards for call success/failure metrics
   - Establish baseline metrics for comparison

2. Create feature flag configuration
   - All new features disabled by default
   - Configure staging environment with features enabled

3. Deploy code to staging environment
   - Deploy all new services and modifications
   - Keep features disabled via feature flags

## Phase 2: Testing (Week 2)

1. Enable features in staging environment
   - Test with simulated failures
   - Verify retry mechanism works as expected
   - Validate failure categorization accuracy

2. Conduct load testing
   - Simulate high call volume
   - Verify concurrency control
   - Test system under stress conditions

3. Perform security review
   - Ensure error messages don't leak sensitive information
   - Verify logging doesn't contain PII
   - Check for potential DoS vectors

## Phase 3: Gradual Rollout (Week 3-4)

1. Deploy to production with features disabled
   - Deploy code changes
   - Keep all feature flags disabled
   - Monitor for any unexpected issues

2. Enable basic error logging
   - Enable `logging.detailedErrors` feature flag
   - Monitor for any issues
   - Collect data on current error patterns

3. Enable failure categorization
   - Enable `errorHandling.failureCategorization` feature flag
   - Monitor categorization accuracy
   - Make adjustments as needed

4. Enable retry mechanism for a subset of users
   - Enable `errorHandling.retryEnabled` for 10% of traffic
   - Monitor success rates and system performance
   - Gradually increase to 25%, 50%, and 100%

## Phase 4: Full Deployment (Week 5)

1. Enable all features for all users
   - Set all feature flags to enabled
   - Continue monitoring

2. Conduct post-deployment review
   - Analyze metrics before and after deployment
   - Document improvements in call success rates
   - Identify any remaining issues

3. Plan for future improvements
   - Gather feedback from agents and administrators
   - Identify additional error scenarios to handle
   - Plan next phase of improvements

## Rollback Plan

If issues are detected during deployment:

1. Disable the problematic feature flag immediately
2. If issues persist, roll back the code deployment
3. Conduct root cause analysis
4. Fix issues and restart deployment process

## Success Metrics

The deployment will be considered successful if:

1. Call success rate improves by at least 5%
2. Failed calls with retry attempts have at least a 25% recovery rate
3. No new errors are introduced
4. System performance (call processing time) is not degraded by more than 10%
```

## 7. Documentation

### Implementation Steps

- [x] **Create API documentation for new services**

Create a file `server/docs/error-handling-api.md`:

```markdown
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

#### `scheduleRetry(store, callId, errorInfo)`

Schedules a call for retry.

**Parameters:**
- `store`: The data store instance
- `callId`: The ID of the call to retry
- `errorInfo`: Information about the error that caused the retry

**Returns:** Boolean indicating success

#### `getCallsReadyForRetry(store)`

Gets all calls that are ready to be retried.

**Parameters:**
- `store`: The data store instance

**Returns:** Array of call objects

#### `calculateRetryTime(retryCount)`

Calculates the next retry time using exponential backoff.

**Parameters:**
- `retryCount`: The current retry count

**Returns:** Date object representing when to retry

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
```

## 8. Summary

This implementation plan provides a comprehensive approach to improving error handling in the outbound call system. By following these steps, we will:

1. Create a centralized error handling service
2. Implement a call retry mechanism
3. Add call failure categorization
4. Integrate with feature flags for gradual rollout
5. Add comprehensive testing
6. Provide detailed documentation

These improvements will make the system more robust, increase call success rates, and provide better visibility into call failures, all while maintaining DRY principles and preserving existing functionality.
