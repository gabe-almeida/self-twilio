// Error handling service for Twilio Dialer Web App
const winston = require('winston'); // We'll use Winston for logging

/**
 * This service provides centralized error handling and logging for the application.
 * It standardizes error types, determines if errors are retryable, and provides
 * consistent logging across the application.
 */

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

/**
 * Maps Twilio error codes to our standardized error types
 * @param {Object} twilioError - The error object from Twilio
 * @returns {string} The mapped error type
 */
const mapTwilioErrorToType = (twilioError) => {
  const errorCode = twilioError.code;
  
  // Map common Twilio error codes to our error types
  switch (errorCode) {
    case 21211: // Invalid 'To' phone number
    case 21214: // 'To' phone number cannot be reached
    case 21217: // Phone number does not appear to be valid
    case 21219: // 'To' phone number is not a valid mobile number
      return ErrorTypes.VALIDATION_ERROR;
    case 20003: // Authentication error
    case 20006: // Account not active
      return ErrorTypes.AUTHENTICATION_ERROR;
    case 20404: // Resource not found
    case 20429: // Too many requests
      return ErrorTypes.TWILIO_API_ERROR;
    case 31204: // Call connection failed
    case 31205: // Call dropped
    case 31208: // Connection timed out
      return ErrorTypes.CALL_INITIATION_ERROR;
    default:
      return ErrorTypes.CALL_INITIATION_ERROR;
  }
};

/**
 * Determines if an error is retryable based on its type and details
 * @param {string} errorType - One of the ErrorTypes constants
 * @param {Object} errorDetails - Additional details about the error
 * @returns {boolean} Whether the error is retryable
 */
const isRetryableError = (errorType, errorDetails) => {
  switch (errorType) {
    case ErrorTypes.TWILIO_API_ERROR:
      // Retry rate limiting or temporary API issues
      return errorDetails.code === 20429 || errorDetails.code === 20001;
    case ErrorTypes.CALL_INITIATION_ERROR:
      // Retry network or temporary issues, but not validation errors
      return errorDetails.code === 31204 || errorDetails.code === 31208;
    case ErrorTypes.QUEUE_PROCESSING_ERROR:
      // Always retry queue processing errors
      return true;
    case ErrorTypes.DATABASE_ERROR:
      // Retry connection issues but not validation errors
      return errorDetails.isConnectionError;
    case ErrorTypes.VALIDATION_ERROR:
      // Never retry validation errors
      return false;
    case ErrorTypes.AUTHENTICATION_ERROR:
      // Never retry authentication errors
      return false;
    default:
      return false;
  }
};

/**
 * Logs an error with appropriate level and details
 * @param {string} errorType - One of the ErrorTypes constants
 * @param {string} message - Error message
 * @param {Object} details - Additional error details
 * @returns {Object} The logged error info
 */
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

/**
 * Handles an error and returns a standardized response
 * @param {Error} error - The error object
 * @param {string} source - Where the error occurred
 * @returns {Object} Standardized error response
 */
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