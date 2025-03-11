/**
 * Error Service Tests
 *
 * This file contains tests for the Error Service, which provides
 * error handling, categorization, and logging capabilities.
 */

const sinon = require('sinon');
// Using Node's assert through the global expect helper defined in setup.js

// Import module to test
const errorService = require('../services/error-service');
const winston = require('winston');

describe('Error Service', () => {
  let sandbox;
  let loggerStub;
  let consoleErrorStub;
  let originalEnv;
  
  beforeEach(() => {
    // Store original NODE_ENV before each test
    originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    sandbox = sinon.createSandbox();
    
    // Mock logger to prevent actual logging during tests
    loggerStub = {
      error: sandbox.stub()
    };
    
    // Replace the actual logger with our stub
    sandbox.stub(winston, 'createLogger').returns(loggerStub);
    
    // Stub console.error to prevent console output during tests
    consoleErrorStub = sandbox.stub(console, 'error');
  });
  
  afterEach(() => {
    // Restore all stubs
    sandbox.restore();
    
    // Restore original NODE_ENV
    process.env.NODE_ENV = originalEnv;
  });
  
  describe('ErrorTypes', () => {
    it('should export error type constants', () => {
      expect(errorService.ErrorTypes).to.be.an('object');
      expect(errorService.ErrorTypes.TWILIO_API_ERROR).to.equal('TWILIO_API_ERROR');
      expect(errorService.ErrorTypes.CALL_INITIATION_ERROR).to.equal('CALL_INITIATION_ERROR');
      expect(errorService.ErrorTypes.VALIDATION_ERROR).to.equal('VALIDATION_ERROR');
      expect(errorService.ErrorTypes.UNKNOWN_ERROR).to.equal('UNKNOWN_ERROR');
    });
  });
  
  describe('isRetryableError()', () => {
    it('should identify Twilio API rate limit errors as retryable', () => {
      const isRetryable = errorService.isRetryableError(
        errorService.ErrorTypes.TWILIO_API_ERROR,
        { code: 20429 }
      );
      
      expect(isRetryable).to.be.true;
    });
    
    it('should identify connection errors as retryable', () => {
      const isRetryable = errorService.isRetryableError(
        errorService.ErrorTypes.CALL_INITIATION_ERROR,
        { code: 31204 }
      );
      
      expect(isRetryable).to.be.true;
    });
    
    it('should identify queue processing errors as retryable', () => {
      const isRetryable = errorService.isRetryableError(
        errorService.ErrorTypes.QUEUE_PROCESSING_ERROR,
        {}
      );
      
      expect(isRetryable).to.be.true;
    });
    
    it('should identify validation errors as non-retryable', () => {
      const isRetryable = errorService.isRetryableError(
        errorService.ErrorTypes.VALIDATION_ERROR,
        {}
      );
      
      expect(isRetryable).to.be.false;
    });
    
    it('should identify authentication errors as non-retryable', () => {
      const isRetryable = errorService.isRetryableError(
        errorService.ErrorTypes.AUTHENTICATION_ERROR,
        {}
      );
      
      expect(isRetryable).to.be.false;
    });
    
    it('should treat unknown error types as non-retryable', () => {
      const isRetryable = errorService.isRetryableError(
        'NON_EXISTENT_ERROR_TYPE',
        {}
      );
      
      expect(isRetryable).to.be.false;
    });
    
    it('should identify database connection errors as retryable', () => {
      const isRetryable = errorService.isRetryableError(
        errorService.ErrorTypes.DATABASE_ERROR,
        { isConnectionError: true }
      );
      
      expect(isRetryable).to.be.true;
    });
    
    it('should identify database non-connection errors as non-retryable', () => {
      const isRetryable = errorService.isRetryableError(
        errorService.ErrorTypes.DATABASE_ERROR,
        { isConnectionError: false }
      );
      
      expect(isRetryable).to.be.false;
    });
  });
  
  describe('logError()', () => {
    it('should log an error with the correct level and details', () => {
      const errorType = errorService.ErrorTypes.TWILIO_API_ERROR;
      const message = 'Test error message';
      const details = { code: 20429, moreInfo: 'Rate limit exceeded' };
      
      // Redefine the sandbox for winston and console to ensure our stubs work
      sandbox.restore();
      sandbox = sinon.createSandbox();
      
      // Re-stub the logger and console
      loggerStub = { error: sandbox.stub() };
      consoleErrorStub = sandbox.stub(console, 'error');
      
      // Stub the actual logger in the error service module
      sandbox.stub(winston, 'createLogger').returns(loggerStub);
      
      const result = errorService.logError(errorType, message, details);
      
      // Verify the error was logged
      expect(loggerStub.error).to.have.been.calledOnce;
      expect(loggerStub.error).to.have.been.calledWith(
        sinon.match({
          type: errorType,
          message: message,
          details: details
        })
      );
      
      // Verify console.error was called in development
      expect(consoleErrorStub).to.have.been.calledOnce;
      
      // Verify return value
      expect(result).to.be.an('object');
      expect(result.type).to.equal(errorType);
      expect(result.message).to.equal(message);
      expect(result.details).to.equal(details);
      expect(result.timestamp).to.be.a('string');
    });
    
    it('should not log to console in production environment', () => {
      // Set NODE_ENV to production for this test
      process.env.NODE_ENV = 'production';
      
      // Redefine the sandbox for winston and console to ensure our stubs work
      sandbox.restore();
      sandbox = sinon.createSandbox();
      
      // Re-stub the logger and console
      loggerStub = { error: sandbox.stub() };
      consoleErrorStub = sandbox.stub(console, 'error');
      
      // Stub the actual logger in the error service module
      sandbox.stub(winston, 'createLogger').returns(loggerStub);
      
      errorService.logError(
        errorService.ErrorTypes.TWILIO_API_ERROR,
        'Test error message'
      );
      
      // Verify the error was logged to the logger
      expect(loggerStub.error).to.have.been.calledOnce;
      
      // Verify console.error was not called in production
      expect(consoleErrorStub).not.to.have.been.called;
    });
  });
  
  describe('handleError()', () => {
    it('should handle a generic error correctly', () => {
      // Redefine the sandbox for winston and console to ensure our stubs work
      sandbox.restore();
      sandbox = sinon.createSandbox();
      
      // Re-stub the logger and console
      loggerStub = { error: sandbox.stub() };
      consoleErrorStub = sandbox.stub(console, 'error');
      
      // Stub the actual logger in the error service module
      sandbox.stub(winston, 'createLogger').returns(loggerStub);
      
      const error = new Error('Generic error message');
      const source = 'test-source';
      
      const result = errorService.handleError(error, source);
      
      expect(result).to.be.an('object');
      expect(result.error).to.be.true;
      expect(result.type).to.equal(errorService.ErrorTypes.UNKNOWN_ERROR);
      expect(result.message).to.equal('Generic error message');
      expect(result.retryable).to.be.false;
      expect(result.id).to.be.a('string');
      
      // Verify the error was logged
      expect(loggerStub.error).to.have.been.calledOnce;
      expect(loggerStub.error).to.have.been.calledWith(
        sinon.match({
          source: 'test-source'
        })
      );
    });
    
    it('should handle a Twilio error correctly', () => {
      // Redefine the sandbox for winston and console to ensure our stubs work
      sandbox.restore();
      sandbox = sinon.createSandbox();
      
      // Re-stub the logger and console
      loggerStub = { error: sandbox.stub() };
      consoleErrorStub = sandbox.stub(console, 'error');
      
      // Stub the actual logger in the error service module
      sandbox.stub(winston, 'createLogger').returns(loggerStub);
      
      const twilioError = new Error('Rate limit exceeded');
      twilioError.name = 'TwilioError';
      twilioError.code = 20429;
      twilioError.status = 429;
      twilioError.moreInfo = 'https://www.twilio.com/docs/errors/20429';
      
      const result = errorService.handleError(twilioError);
      
      expect(result).to.be.an('object');
      expect(result.error).to.be.true;
      expect(result.type).to.equal(errorService.ErrorTypes.TWILIO_API_ERROR);
      expect(result.message).to.equal('Rate limit exceeded');
      expect(result.retryable).to.be.true;
      
      // Verify the error was logged with the correct details
      expect(loggerStub.error).to.have.been.calledOnce;
      expect(loggerStub.error).to.have.been.calledWith(
        sinon.match({
          details: sinon.match({
            code: 20429,
            status: 429,
            moreInfo: 'https://www.twilio.com/docs/errors/20429'
          })
        })
      );
    });
    
    it('should handle a validation error correctly', () => {
      // Redefine the sandbox for winston and console to ensure our stubs work
      sandbox.restore();
      sandbox = sinon.createSandbox();
      
      // Re-stub the logger and console
      loggerStub = { error: sandbox.stub() };
      consoleErrorStub = sandbox.stub(console, 'error');
      
      // Stub the actual logger in the error service module
      sandbox.stub(winston, 'createLogger').returns(loggerStub);
      
      const validationError = new Error('Invalid phone number');
      validationError.name = 'ValidationError';
      validationError.details = { field: 'phone_number', constraint: 'format' };
      
      const result = errorService.handleError(validationError);
      
      expect(result).to.be.an('object');
      expect(result.error).to.be.true;
      expect(result.type).to.equal(errorService.ErrorTypes.VALIDATION_ERROR);
      expect(result.message).to.equal('Invalid phone number');
      expect(result.retryable).to.be.false;
      
      // Verify the error was logged with the correct details
      expect(loggerStub.error).to.have.been.calledOnce;
      expect(loggerStub.error).to.have.been.calledWith(
        sinon.match({
          details: sinon.match({
            validation: { field: 'phone_number', constraint: 'format' }
          })
        })
      );
    });
    
    it('should handle a database error correctly', () => {
      // Redefine the sandbox for winston and console to ensure our stubs work
      sandbox.restore();
      sandbox = sinon.createSandbox();
      
      // Re-stub the logger and console
      loggerStub = { error: sandbox.stub() };
      consoleErrorStub = sandbox.stub(console, 'error');
      
      // Stub the actual logger in the error service module
      sandbox.stub(winston, 'createLogger').returns(loggerStub);
      
      const dbError = new Error('Database connection failed');
      dbError.name = 'DatabaseError';
      dbError.query = 'SELECT * FROM calls';
      
      const result = errorService.handleError(dbError);
      
      expect(result).to.be.an('object');
      expect(result.error).to.be.true;
      expect(result.type).to.equal(errorService.ErrorTypes.DATABASE_ERROR);
      expect(result.message).to.equal('Database connection failed');
      expect(result.retryable).to.be.true; // Connection errors are retryable
      
      // Verify the error was logged with the correct details
      expect(loggerStub.error).to.have.been.calledOnce;
      expect(loggerStub.error).to.have.been.calledWith(
        sinon.match({
          details: sinon.match({
            isConnectionError: true,
            query: 'SELECT * FROM calls'
          })
        })
      );
    });
    
    it('should handle missing error message gracefully', () => {
      // Redefine the sandbox for winston and console to ensure our stubs work
      sandbox.restore();
      sandbox = sinon.createSandbox();
      
      // Re-stub the logger and console
      loggerStub = { error: sandbox.stub() };
      consoleErrorStub = sandbox.stub(console, 'error');
      
      // Stub the actual logger in the error service module
      sandbox.stub(winston, 'createLogger').returns(loggerStub);
      
      const emptyError = new Error();
      emptyError.message = undefined;
      
      const result = errorService.handleError(emptyError);
      
      expect(result).to.be.an('object');
      expect(result.message).to.equal('An unknown error occurred');
    });
  });
});