/**
 * Test setup file for unit and integration tests
 *
 * This file runs before each test file to set up the test environment,
 * configure testing libraries, and set up global mocks.
 */

// Use Node's assert library instead of Chai for now
const assert = require('assert');
const sinon = require('sinon');

// Make assertions available globally
global.assert = assert;
global.expect = function(actual) {
  const to = {
    equal: (expected) => assert.strictEqual(actual, expected),
    deep: {
      equal: (expected) => assert.deepStrictEqual(actual, expected)
    },
    be: {
      true: () => assert.strictEqual(actual, true),
      false: () => assert.strictEqual(actual, false),
      a: (type) => {
        if (type === 'string') assert(typeof actual === 'string');
        else if (type === 'number') assert(typeof actual === 'number');
        else if (type === 'boolean') assert(typeof actual === 'boolean');
        else if (type === 'object') assert(typeof actual === 'object' && actual !== null);
        else if (type === 'array') assert(Array.isArray(actual));
        else assert.strictEqual(typeof actual, type);
        return to;
      },
      an: (type) => to.be.a(type)
    },
    have: {
      property: (prop) => {
        assert(Object.prototype.hasOwnProperty.call(actual, prop));
        return to;
      },
      lengthOf: (len) => assert.strictEqual(actual.length, len)
    },
    include: (item) => {
      if (typeof actual === 'string') {
        assert(actual.includes(item));
      } else if (Array.isArray(actual)) {
        assert(actual.includes(item));
      } else if (typeof actual === 'object' && actual !== null) {
        const entries = Object.entries(item);
        entries.forEach(([key, value]) => {
          assert.deepStrictEqual(actual[key], value);
        });
      }
      return to;
    }
  };

  // Handle sinon assertions
  if (actual && typeof actual === 'function' && actual.called !== undefined) {
    // It's a sinon spy or stub
    to.have.been = {
      called: () => assert(actual.called, 'Expected spy to have been called'),
      calledOnce: () => assert(actual.calledOnce, 'Expected spy to be called once'),
      calledTwice: () => assert(actual.calledTwice, 'Expected spy to be called twice'),
      calledWith: (...args) => {
        assert(actual.calledWith(...args), `Expected spy to be called with ${JSON.stringify(args)}`);
        return to;
      }
    };
    to.not = {
      to: {
        have: {
          been: {
            called: () => assert(!actual.called, 'Expected spy not to have been called')
          }
        }
      }
    };
  }

  // Make chainable
  to.not = {
    to: {
      have: {
        been: {
          called: () => assert(!actual.called, 'Expected spy not to have been called')
        }
      }
    }
  };

  return { to };
};

// Add sinon matcher support
global.sinon = sinon;
global.sinon.match = sinon.match;

// Global mocks that might be used across tests
global.mocks = {
  // Add any global mocks here that might be used in multiple test files
};

// Mock specific environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

// Reset mocks between tests
beforeEach(() => {
  if (global.jest) {
    jest.resetAllMocks();
  }
});

// Reset sinon sandboxes between tests (you should still create your own sandbox in tests)
afterEach(() => {
  sinon.restore();
});

// Silence console output during tests unless in verbose mode
if (process.env.TEST_VERBOSE !== 'true') {
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  
  // Keep the original functions so we can restore them or use them selectively
  global.__originalConsole = {
    log: originalConsoleLog,
    error: originalConsoleError,
    warn: originalConsoleWarn
  };
  
  // Only show errors by default, silence other console output
  console.log = () => {};
  console.warn = () => {};
  
  // Keep error output for debugging failing tests
  // console.error = (...args) => {
  //   if (process.env.TEST_DEBUG === 'true') {
  //     originalConsoleError(...args);
  //   }
  // };
}