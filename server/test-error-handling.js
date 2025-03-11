// Test script for error handling and retry functionality
require('dotenv').config();
const errorService = require('./services/error-service');
const retryService = require('./services/retry-service');
const failureCategorization = require('./services/failure-categorization-service');
const featureFlags = require('./services/feature-flags');
const callQueueManager = require('./call-queue-manager');
const store = require('./memory-store');

/**
 * This test script demonstrates the error handling and retry functionality.
 * It simulates different error scenarios and shows how the system handles them.
 */

// Helper function to wait for a specified time
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test function to enable error handling features
async function enableErrorHandlingFeatures() {
  console.log('Enabling error handling features...');
  
  // Enable error handling
  await featureFlags.enableFeature('errorHandling.enabled');
  
  // Enable retry functionality
  await featureFlags.enableFeature('errorHandling.retryEnabled');
  
  // Enable failure categorization
  await featureFlags.enableFeature('errorHandling.failureCategorization');
  
  // Set max retries to 3
  await featureFlags.saveFeatureFlags({
    errorHandling: {
      maxRetries: 3,
      baseDelayMinutes: 0.05, // 3 seconds for testing
      maxDelayMinutes: 0.2 // 12 seconds for testing
    }
  });
  
  // Verify feature flags
  const flags = await featureFlags.getAllFeatureFlags();
  console.log('Feature flags:', JSON.stringify(flags.errorHandling, null, 2));
}

// Test function to simulate a call with a network error
async function testNetworkError() {
  console.log('\n--- Testing Network Error ---');
  
  // Add a test call to the queue
  const call = {
    phone_number: '+19785551234',
    contact_name: 'Test Network Error',
    notes: 'Testing network error handling'
  };
  
  const result = await store.callQueue.add(call);
  console.log(`Added call to queue with ID: ${result.id}`);
  
  // Simulate a network error
  const error = new Error('Network connection failed');
  error.code = 31204;
  error.name = 'TwilioError';
  
  // Handle the error
  const errorInfo = await errorService.handleError(error, 'test-error-handling.testNetworkError');
  console.log('Error info:', errorInfo);
  
  // Get failure categorization
  const failureInfo = failureCategorization.getFailureInfo(error);
  console.log('Failure info:', failureInfo);
  
  // Schedule a retry
  const retryResult = await retryService.scheduleRetry(result.id, errorInfo);
  console.log('Retry result:', retryResult);
  
  // Wait for the retry to be processed
  console.log('Waiting for retry to be processed...');
  await wait(5000); // Wait 5 seconds
  
  // Process retries
  await retryService.processRetries(() => callQueueManager.processQueue());
  
  // Get the updated call
  const updatedCall = await store.callQueue.getById(result.id);
  console.log('Updated call:', updatedCall);
  
  return result.id;
}

// Test function to simulate a call with an invalid number
async function testInvalidNumber() {
  console.log('\n--- Testing Invalid Number ---');
  
  // Add a test call to the queue
  const call = {
    phone_number: '+1invalid',
    contact_name: 'Test Invalid Number',
    notes: 'Testing invalid number handling'
  };
  
  const result = await store.callQueue.add(call);
  console.log(`Added call to queue with ID: ${result.id}`);
  
  // Simulate an invalid number error
  const error = new Error('Invalid phone number');
  error.code = 21211;
  error.name = 'TwilioError';
  
  // Handle the error
  const errorInfo = await errorService.handleError(error, 'test-error-handling.testInvalidNumber');
  console.log('Error info:', errorInfo);
  
  // Get failure categorization
  const failureInfo = failureCategorization.getFailureInfo(error);
  console.log('Failure info:', failureInfo);
  
  // Try to schedule a retry (should not be retryable)
  const retryResult = await retryService.scheduleRetry(result.id, errorInfo);
  console.log('Retry result:', retryResult);
  
  // Get the updated call
  const updatedCall = await store.callQueue.getById(result.id);
  console.log('Updated call:', updatedCall);
  
  return result.id;
}

// Test function to simulate a call with a no-answer status
async function testNoAnswer() {
  console.log('\n--- Testing No Answer ---');
  
  // Add a test call to the queue
  const call = {
    phone_number: '+19785553456',
    contact_name: 'Test No Answer',
    notes: 'Testing no-answer handling'
  };
  
  const result = await store.callQueue.add(call);
  console.log(`Added call to queue with ID: ${result.id}`);
  
  // Update the call with a call SID
  await store.callQueue.updateStatus(result.id, 'In Progress', 'CA123456789');
  
  // Simulate a call status update
  const callStatus = {
    CallSid: 'CA123456789',
    CallStatus: 'no-answer'
  };
  
  // Handle the call status update
  await callQueueManager.handleCallStatusUpdate(callStatus);
  
  // Wait for the retry to be processed
  console.log('Waiting for retry to be processed...');
  await wait(5000); // Wait 5 seconds
  
  // Get the updated call
  const updatedCall = await store.callQueue.getById(result.id);
  console.log('Updated call:', updatedCall);
  
  return result.id;
}

// Main test function
async function runTests() {
  try {
    console.log('Starting error handling tests...');
    
    // Enable error handling features
    await enableErrorHandlingFeatures();
    
    // Test network error
    const networkErrorCallId = await testNetworkError();
    
    // Test invalid number
    const invalidNumberCallId = await testInvalidNumber();
    
    // Test no-answer
    const noAnswerCallId = await testNoAnswer();
    
    console.log('\n--- Test Results ---');
    console.log(`Network Error Call ID: ${networkErrorCallId}`);
    console.log(`Invalid Number Call ID: ${invalidNumberCallId}`);
    console.log(`No Answer Call ID: ${noAnswerCallId}`);
    
    console.log('\nTests completed successfully!');
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

// Run the tests
runTests();