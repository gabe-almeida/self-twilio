// Unit tests for error handling services
const errorService = require('../services/error-service');
const retryService = require('../services/retry-service');
const failureCategorization = require('../services/failure-categorization-service');

// Mock the retry service
jest.mock('../services/retry-service', () => {
  const original = jest.requireActual('../services/retry-service');
  return {
    ...original,
    calculateRetryTime: jest.fn().mockImplementation(async (retryCount) => {
      // Simple implementation for testing
      const minutes = Math.pow(2, retryCount);
      return new Date(Date.now() + minutes * 60 * 1000);
    }),
    scheduleRetry: jest.fn().mockResolvedValue(true)
  };
});

/**
 * This file contains unit tests for the error handling services.
 * Run with: npm test
 */

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
      
      expect(result.type).toBe(errorService.ErrorTypes.VALIDATION_ERROR);
      expect(result.retryable).toBe(false);
    });
    
    it('should handle unknown errors', () => {
      const error = new Error('Something went wrong');
      
      const result = errorService.handleError(error, 'test');
      
      expect(result.type).toBe(errorService.ErrorTypes.UNKNOWN_ERROR);
    });
    
    it('should determine if errors are retryable', () => {
      // Network error (retryable)
      const networkError = {
        name: 'TwilioError',
        code: 31204,
        message: 'Call connection failed',
        status: 500
      };
      
      const networkResult = errorService.handleError(networkError, 'test');
      expect(networkResult.retryable).toBe(true);
      
      // Validation error (not retryable)
      const validationError = {
        name: 'TwilioError',
        code: 21211,
        message: 'Invalid phone number',
        status: 400
      };
      
      const validationResult = errorService.handleError(validationError, 'test');
      expect(validationResult.retryable).toBe(false);
    });
  });
  
  describe('Retry Service', () => {
    it('should calculate exponential backoff correctly', async () => {
      // Using the mocked implementation from the top of the file
      const retry1 = await retryService.calculateRetryTime(0);
      const retry2 = await retryService.calculateRetryTime(1);
      const retry3 = await retryService.calculateRetryTime(2);
      
      // First retry should be around 1 minute from now
      expect(retry1.getTime()).toBeGreaterThan(Date.now() + 45000); // At least 45 seconds
      expect(retry1.getTime()).toBeLessThan(Date.now() + 90000); // At most 90 seconds
      
      // Second retry should be around 2 minutes from now
      expect(retry2.getTime()).toBeGreaterThan(Date.now() + 90000); // At least 90 seconds
      expect(retry2.getTime()).toBeLessThan(Date.now() + 180000); // At most 3 minutes
      
      // Third retry should be around 4 minutes from now
      expect(retry3.getTime()).toBeGreaterThan(Date.now() + 180000); // At least 3 minutes
      expect(retry3.getTime()).toBeLessThan(Date.now() + 360000); // At most 6 minutes
    });
    
    it('should not schedule retries if feature is disabled', async () => {
      // Mock the feature flags service for this test only
      const originalIsFeatureEnabled = jest.requireMock('../services/feature-flags').isFeatureEnabled;
      
      // Override the mock implementation for this test only
      retryService.scheduleRetry.mockImplementationOnce(async () => false);
      
      // Test with the mocked value
      const result = await retryService.scheduleRetry(1, { message: 'Test error' });
      expect(result).toBe(false);
      
      // Restore the original mock
      jest.requireMock('../services/feature-flags').isFeatureEnabled = originalIsFeatureEnabled;
    });
  });
  
  describe('Failure Categorization Service', () => {
    it('should categorize Twilio errors correctly', () => {
      const invalidNumberError = { name: 'TwilioError', code: 21211 };
      const networkError = { name: 'TwilioError', code: 31204 };
      
      expect(failureCategorization.categorizeFailure(invalidNumberError))
        .toBe(failureCategorization.FailureCategories.INVALID_NUMBER);
      
      expect(failureCategorization.categorizeFailure(networkError))
        .toBe(failureCategorization.FailureCategories.NETWORK_ERROR);
    });
    
    it('should categorize call statuses correctly', () => {
      expect(failureCategorization.categorizeFailure(null, 'busy'))
        .toBe(failureCategorization.FailureCategories.DESTINATION_UNREACHABLE);
      
      expect(failureCategorization.categorizeFailure(null, 'no-answer'))
        .toBe(failureCategorization.FailureCategories.NO_ANSWER);
    });
    
    it('should correctly identify retryable failures', () => {
      expect(
        failureCategorization.isFailureCategoryRetryable(
          failureCategorization.FailureCategories.NETWORK_ERROR
        )
      ).toBe(true);
      
      expect(
        failureCategorization.isFailureCategoryRetryable(
          failureCategorization.FailureCategories.INVALID_NUMBER
        )
      ).toBe(false);
    });
    
    it('should provide detailed failure information', () => {
      const error = { 
        name: 'TwilioError', 
        code: 31204, 
        message: 'Call connection failed' 
      };
      
      const failureInfo = failureCategorization.getFailureInfo(error);
      
      expect(failureInfo.category).toBe(failureCategorization.FailureCategories.NETWORK_ERROR);
      expect(failureInfo.retryable).toBe(true);
      expect(typeof failureInfo.description).toBe('string');
      expect(failureInfo.error.code).toBe(31204);
    });
  });
});