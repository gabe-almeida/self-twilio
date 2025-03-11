// Retry service for Twilio Dialer Web App
const errorService = require('./error-service');
const featureFlags = require('./feature-flags');

/**
 * This service manages call retry scheduling and processing.
 * It implements exponential backoff for retries and provides
 * methods to schedule retries and retrieve calls ready for retry.
 */

/**
 * Calculates the next retry time using exponential backoff
 * @param {number} retryCount - The current retry count
 * @returns {Date} The time to retry
 */
const calculateRetryTime = async (retryCount) => {
  // Get base delay and max delay from feature flags or use defaults
  const baseDelayMinutes = await featureFlags.getFeatureValue('errorHandling.baseDelayMinutes', 1);
  const maxDelayMinutes = await featureFlags.getFeatureValue('errorHandling.maxDelayMinutes', 60);
  
  // Convert to milliseconds
  const baseDelayMs = baseDelayMinutes * 60 * 1000;
  const maxDelayMs = maxDelayMinutes * 60 * 1000;
  
  // Calculate delay with exponential backoff: baseDelay * 2^retryCount
  let delayMs = baseDelayMs * Math.pow(2, retryCount);
  
  // Add some jitter to prevent thundering herd problem (75% to 125% of calculated delay)
  delayMs = delayMs * (0.75 + Math.random() * 0.5);
  
  // Cap at maximum delay
  delayMs = Math.min(delayMs, maxDelayMs);
  
  // Return the time to retry
  return new Date(Date.now() + delayMs);
};

/**
 * Schedules a call for retry
 * @param {number} callId - The ID of the call to retry
 * @param {Object} errorInfo - Information about the error that caused the retry
 * @returns {Promise<boolean>} Whether the retry was scheduled successfully
 */
const scheduleRetry = async (callId, errorInfo) => {
  try {
    // Check if retry is enabled in feature flags
    const retryEnabled = await featureFlags.isFeatureEnabled('errorHandling.retryEnabled');
    if (!retryEnabled) {
      errorService.logError(
        errorService.ErrorTypes.QUEUE_PROCESSING_ERROR,
        `Retry not scheduled for call ${callId}: Retry feature is disabled`,
        { errorInfo }
      );
      return false;
    }
    
    // Get the call from the queue
    const store = require('../memory-store');
    const call = await store.callQueue.getById(callId);
    
    if (!call) {
      errorService.logError(
        errorService.ErrorTypes.QUEUE_PROCESSING_ERROR,
        `Cannot schedule retry: Call ${callId} not found`
      );
      return false;
    }
    
    // Get max retries from feature flags or use default
    const maxRetries = await featureFlags.getFeatureValue('errorHandling.maxRetries', 3);
    
    // Check if we've exceeded max retries
    if (call.retry_count >= maxRetries) {
      await store.callQueue.updateStatus(callId, 'Failed');
      errorService.logError(
        errorService.ErrorTypes.CALL_INITIATION_ERROR,
        `Call ${callId} failed after ${call.retry_count} retries`,
        { phone_number: call.phone_number, failure_reason: errorInfo.message }
      );
      return false;
    }
    
    // Calculate next retry time
    const retryAfter = await calculateRetryTime(call.retry_count);
    
    // Update call with retry information
    await store.callQueue.updateRetryInfo(callId, {
      status: 'Retry Scheduled',
      retry_count: call.retry_count + 1,
      last_retry: new Date().toISOString(),
      retry_after: retryAfter.toISOString(),
      failure_reason: errorInfo.message,
      failure_type: errorInfo.type,
      error_id: errorInfo.id
    });
    
    errorService.logError(
      errorService.ErrorTypes.CALL_INITIATION_ERROR,
      `Scheduled retry ${call.retry_count + 1}/${maxRetries} for call ${callId} at ${retryAfter.toISOString()}`,
      { phone_number: call.phone_number, error: errorInfo }
    );
    
    return true;
  } catch (error) {
    errorService.handleError(error, 'retry-service.scheduleRetry');
    return false;
  }
};

/**
 * Gets all calls that are ready for retry
 * @returns {Promise<Array>} Array of call objects ready for retry
 */
const getCallsReadyForRetry = async () => {
  try {
    // Check if retry is enabled in feature flags
    const retryEnabled = await featureFlags.isFeatureEnabled('errorHandling.retryEnabled');
    if (!retryEnabled) {
      return [];
    }
    
    const store = require('../memory-store');
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

/**
 * Processes all calls that are ready for retry
 * @param {Function} processQueueFn - Function to call to process the queue
 * @returns {Promise<number>} Number of calls processed
 */
const processRetries = async (processQueueFn) => {
  try {
    // Check if retry is enabled in feature flags
    const retryEnabled = await featureFlags.isFeatureEnabled('errorHandling.retryEnabled');
    if (!retryEnabled) {
      return 0;
    }
    
    // Get calls ready for retry
    const retriableCalls = await getCallsReadyForRetry();
    
    if (retriableCalls.length === 0) {
      return 0;
    }
    
    console.log(`Processing ${retriableCalls.length} calls ready for retry`);
    
    // Update calls to Queued status so they can be processed
    const store = require('../memory-store');
    for (const call of retriableCalls) {
      await store.callQueue.updateStatus(call.id, 'Queued');
    }
    
    // Process the queue
    if (processQueueFn && typeof processQueueFn === 'function') {
      await processQueueFn();
    }
    
    return retriableCalls.length;
  } catch (error) {
    errorService.handleError(error, 'retry-service.processRetries');
    return 0;
  }
};

module.exports = {
  scheduleRetry,
  getCallsReadyForRetry,
  calculateRetryTime,
  processRetries
};