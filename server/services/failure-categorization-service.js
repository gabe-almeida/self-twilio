// Failure categorization service for Twilio Dialer Web App
const errorService = require('./error-service');

/**
 * This service categorizes call failures to provide better insights
 * and determine appropriate retry strategies.
 */

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

/**
 * Maps Twilio error codes to failure categories
 * @param {Object} twilioError - The error object from Twilio
 * @returns {string} The failure category
 */
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

/**
 * Maps call status to failure category
 * @param {string} callStatus - The call status from Twilio
 * @returns {string} The failure category
 */
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

/**
 * Categorizes a failure based on error or call status
 * @param {Object} error - The error object (optional)
 * @param {string} callStatus - The call status (optional)
 * @returns {string} The failure category
 */
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

/**
 * Gets a human-readable description of a failure category
 * @param {string} category - One of the FailureCategories constants
 * @returns {string} Human-readable description
 */
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

/**
 * Determines if a failure category is retryable
 * @param {string} category - One of the FailureCategories constants
 * @returns {boolean} Whether the category is retryable
 */
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

/**
 * Gets detailed failure information for an error
 * @param {Object} error - The error object
 * @param {string} callStatus - The call status (optional)
 * @returns {Object} Detailed failure information
 */
const getFailureInfo = (error, callStatus = null) => {
  const category = categorizeFailure(error, callStatus);
  const description = getFailureDescription(category);
  const retryable = isFailureCategoryRetryable(category);
  
  return {
    category,
    description,
    retryable,
    error: error ? {
      message: error.message,
      code: error.code,
      status: error.status,
      name: error.name
    } : null,
    callStatus
  };
};

module.exports = {
  FailureCategories,
  categorizeFailure,
  getFailureDescription,
  isFailureCategoryRetryable,
  getFailureInfo
};