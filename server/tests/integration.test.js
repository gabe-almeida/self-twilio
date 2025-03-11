// Integration tests for error handling
const assert = require('assert');
const store = require('../memory-store');
const errorService = require('../services/error-service');
const retryService = require('../services/retry-service');
const failureCategorization = require('../services/failure-categorization-service');

/**
 * This file contains integration tests for the error handling services.
 * It tests the interaction between the different services and the call queue manager.
 * Run with: npm test
 */

// Mock call queue manager for testing
const mockQueueManager = {
  twilioClient: {
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
  },
  
  // Mock methods
  addToQueue: async (call) => {
    return store.callQueue.add(call);
  },
  
  processQueue: async () => {
    console.log('Processing queue...');
    return true;
  },
  
  initiateCall: async (call) => {
    try {
      // Use the mock Twilio client to simulate call initiation
      const result = await mockQueueManager.twilioClient.calls.create({
        to: call.phone_number,
        from: '+19788785223',
        url: 'http://example.com/twiml'
      });
      
      return {
        success: true,
        callSid: result.sid,
        status: result.status
      };
    } catch (error) {
      const errorInfo = errorService.handleError(error, 'mockQueueManager.initiateCall');
      
      return {
        success: false,
        error: errorInfo.message,
        retryable: errorInfo.retryable,
        errorType: errorInfo.type
      };
    }
  }
};

describe('Error Handling Integration', () => {
  // Jest doesn't use this.timeout, it has its own timeout configuration
  jest.setTimeout(10000);
  
  // Clear the call queue before each test
  beforeEach(async () => {
    // Reset the call queue
    store.callQueue = [];
    store.nextId = store.nextId || {};
    store.nextId.callQueue = 1;
  });
  
  it('should successfully initiate a call with valid number', async () => {
    // Add a call with a valid number
    const callResult = await mockQueueManager.addToQueue({
      phone_number: '+15551234567',
      contact_name: 'Test User',
      notes: 'Test call'
    });
    
    assert(callResult.id);
    
    // Get the call from the queue
    const call = await store.callQueue.getById(callResult.id);
    
    // Initiate the call
    const result = await mockQueueManager.initiateCall(call);
    
    // Verify the call was initiated
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.callSid, 'CA123456');
  });
  
  it('should handle invalid phone numbers', async () => {
    // Add a call with an invalid number
    const callResult = await mockQueueManager.addToQueue({
      phone_number: '+15559876543',
      contact_name: 'Invalid User',
      notes: 'Invalid number test'
    });
    
    assert(callResult.id);
    
    // Get the call from the queue
    const call = await store.callQueue.getById(callResult.id);
    
    // Initiate the call
    const result = await mockQueueManager.initiateCall(call);
    
    // Verify the call failed with the correct error type
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.retryable, false);
    assert.strictEqual(result.errorType, errorService.ErrorTypes.VALIDATION_ERROR);
  });
  
  it('should schedule retries for retryable errors', async () => {
    // Add a call that will trigger a rate limit error (retryable)
    const callResult = await mockQueueManager.addToQueue({
      phone_number: '+15555555555',
      contact_name: 'Retry User',
      notes: 'Retry test'
    });
    
    assert(callResult.id);
    
    // Get the call from the queue
    const call = await store.callQueue.getById(callResult.id);
    
    // Initiate the call
    const result = await mockQueueManager.initiateCall(call);
    
    // Verify the call failed with a retryable error
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.retryable, true);
    assert.strictEqual(result.errorType, errorService.ErrorTypes.TWILIO_API_ERROR);
    
    // Schedule a retry
    const retryResult = await retryService.scheduleRetry(callResult.id, result);
    
    // Verify the retry was scheduled
    assert.strictEqual(retryResult, true);
    
    // Get the updated call
    const updatedCall = await store.callQueue.getById(callResult.id);
    
    // Verify the call was scheduled for retry
    assert.strictEqual(updatedCall.status, 'Retry Scheduled');
    assert.strictEqual(updatedCall.retry_count, 1);
    assert(updatedCall.retry_after);
    assert(updatedCall.last_retry);
  });
  
  it('should categorize failures correctly', async () => {
    // Test with a Twilio error
    const twilioError = {
      name: 'RestException',
      code: 21211,
      message: 'Invalid phone number',
      status: 400
    };
    
    const category = failureCategorization.categorizeFailure(twilioError);
    assert.strictEqual(category, failureCategorization.FailureCategories.INVALID_NUMBER);
    
    // Test with a call status
    const noAnswerCategory = failureCategorization.categorizeFailure(null, 'no-answer');
    assert.strictEqual(noAnswerCategory, failureCategorization.FailureCategories.NO_ANSWER);
    
    // Test with an error from the error service
    const errorServiceResult = errorService.handleError(twilioError, 'test');
    const errorServiceCategory = failureCategorization.categorizeFailure(errorServiceResult);
    assert.strictEqual(errorServiceCategory, failureCategorization.FailureCategories.VALIDATION_ERROR);
  });
  
  it('should process retries when they are ready', async () => {
    // Add a call that will be retried
    const callResult = await mockQueueManager.addToQueue({
      phone_number: '+15555555555',
      contact_name: 'Retry User 2',
      notes: 'Retry processing test'
    });
    
    // Get the call from the queue
    const call = await store.callQueue.getById(callResult.id);
    
    // Initiate the call to trigger the initial failure
    const result = await mockQueueManager.initiateCall(call);
    
    // Schedule a retry
    await retryService.scheduleRetry(callResult.id, result);
    
    // Update the retry_after to now
    await store.callQueue.updateRetryInfo(callResult.id, {
      retry_after: new Date(Date.now() - 1000).toISOString() // 1 second ago
    });
    
    // Get calls ready for retry
    const retriableCalls = await retryService.getCallsReadyForRetry();
    
    // Verify our call is in the list
    assert(retriableCalls.some(c => c.id === callResult.id));
    
    // Process the retries
    const processed = await retryService.processRetries(mockQueueManager.processQueue);
    
    // Verify retries were processed
    assert.strictEqual(processed, 1);
    
    // Get the updated call
    const updatedCall = await store.callQueue.getById(callResult.id);
    
    // Verify the call status was updated to Queued
    assert.strictEqual(updatedCall.status, 'Queued');
  });
});