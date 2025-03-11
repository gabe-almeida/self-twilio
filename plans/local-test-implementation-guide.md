# Local Test Implementation Guide

This guide provides practical, step-by-step instructions for implementing and running tests on your local development environment. It covers setting up your testing tools, creating different types of tests, and integrating testing into your development workflow.

## Setting Up Your Test Environment

### 1. Install Testing Dependencies

```bash
cd server
npm install --save-dev jest chai sinon sinon-chai supertest puppeteer jest-puppeteer
```

### 2. Set Up Jest Configuration

Create or update `jest.config.js` in the server directory:

```javascript
module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'services/**/*.js',
    'routes/**/*.js',
    '*.js',
    '!**/node_modules/**',
    '!**/coverage/**'
  ],
  setupFilesAfterEnv: ['./tests/setup.js'],
  verbose: true
};
```

### 3. Configure Package.json Scripts

Add these scripts to your `package.json`:

```json
"scripts": {
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "test:file": "jest",
  "test:unit": "jest '.*\\.unit\\.test\\.js'",
  "test:integration": "jest '.*\\.integration\\.test\\.js'",
  "test:e2e": "jest --config=jest.e2e.config.js"
}
```

### 4. Create Test Setup File

Create `tests/setup.js`:

```javascript
const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

chai.use(sinonChai);

// Reset mocks between tests
beforeEach(() => {
  jest.resetAllMocks();
});
```

## Creating Your First Test

### Unit Test Example: Error Service

1. Create a new file at `server/tests/error-service.test.js`
2. Basic test structure:

```javascript
const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const { expect } = chai;
chai.use(sinonChai);

const errorService = require('../services/error-service');

describe('Error Service', () => {
  let sandbox;
  
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    // Set up any stubs you need
  });
  
  afterEach(() => {
    sandbox.restore();
  });
  
  describe('handleError()', () => {
    it('should return a standardized error response', () => {
      const error = new Error('Test error');
      const result = errorService.handleError(error, 'test-source');
      
      expect(result).to.be.an('object');
      expect(result.error).to.be.true;
      expect(result.message).to.equal('Test error');
      expect(result.type).to.equal(errorService.ErrorTypes.UNKNOWN_ERROR);
    });
    
    // More tests...
  });
});
```

3. Run your test:

```bash
npm run test:file -- tests/error-service.test.js
```

## Working with Mocks and Stubs

### 1. Mocking Dependencies

When testing a module with dependencies, use sinon to create stubs for those dependencies:

```javascript
describe('Agent Status Service', () => {
  let sandbox;
  
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Mock the store
    sandbox.stub(store.agentStatus, 'getByUserId');
    sandbox.stub(store.agentStatus, 'updateStatus');
    
    // Mock feature flags service
    sandbox.stub(featureFlags, 'isFeatureEnabled');
  });
  
  afterEach(() => {
    sandbox.restore();
  });
  
  it('should update agent status', async () => {
    // Configure stubs for this test
    store.agentStatus.getByUserId.resolves({ status: 'Offline' });
    store.agentStatus.updateStatus.resolves({ success: true });
    featureFlags.isFeatureEnabled.resolves(false); // Disable validation
    
    // Test the function
    const result = await agentStatusService.updateAgentStatus('123', 'Available');
    
    // Verify expectations
    expect(result.success).to.be.true;
    expect(store.agentStatus.updateStatus).to.have.been.calledWith('123', 'Available');
  });
});
```

### 2. Mocking Time

For time-sensitive tests, use sinon's fake timers:

```javascript
describe('Timeout Tests', () => {
  let clock;
  
  beforeEach(() => {
    // Create a fake timer
    clock = sinon.useFakeTimers(new Date('2025-01-01'));
  });
  
  afterEach(() => {
    // Restore real timers
    clock.restore();
  });
  
  it('should detect timeouts correctly', () => {
    // Start a process
    const process = new SomeTimeoutProcess(5000); // 5 second timeout
    
    // Fast-forward time
    clock.tick(6000); // Advance 6 seconds
    
    // Check if timeout occurred
    expect(process.isTimedOut()).to.be.true;
  });
});
```

## Testing API Routes

### Route Testing Example

1. Create a test file for routes:

```javascript
const request = require('supertest');
const express = require('express');
const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const { expect } = chai;
chai.use(sinonChai);

const authRoutes = require('../../routes/auth');
const auth = require('../../auth');
const store = require('../../memory-store');

describe('Auth Routes', () => {
  let app;
  let sandbox;
  
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Create test express app
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware
    sandbox.stub(auth, 'isAuthenticated').callsFake((req, res, next) => {
      req.user = { id: 1, username: 'testuser', role: 'agent' };
      next();
    });
    
    // Mock store
    sandbox.stub(store.users, 'getByUsername');
    
    // Apply routes
    app.use('/auth', authRoutes);
  });
  
  afterEach(() => {
    sandbox.restore();
  });
  
  describe('POST /auth/login', () => {
    it('should return token when credentials are valid', async () => {
      // Configure store mock
      store.users.getByUsername.resolves({
        id: 1,
        username: 'testuser',
        password: 'hashed-password'
      });
      
      // Mock password verification
      sandbox.stub(store, 'verifyPassword').returns(true);
      
      // Mock token generation
      sandbox.stub(auth, 'generateToken').returns('test-token');
      
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'password'
        });
      
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('token', 'test-token');
    });
  });
});
```

## Integration Testing

Integration tests verify that components work together correctly.

```javascript
describe('Workflow Integration', () => {
  // For integration tests, use the actual implementations
  // but mock external services
  
  beforeEach(async () => {
    // Set up test database
    await setupTestDatabase();
    
    // Mock Twilio API
    sandbox.stub(twilioClient.calls, 'create').resolves({
      sid: 'CA123456789',
      status: 'queued'
    });
  });
  
  afterEach(async () => {
    await cleanupTestDatabase();
    sandbox.restore();
  });
  
  it('should process a lead through the entire workflow', async () => {
    // Create test data
    const lead = await createTestLead({
      phone_number: '+15551234567',
      name: 'Test Lead'
    });
    
    // Start the workflow
    await workflowManager.startWorkflow('new-lead', { leadId: lead.id });
    
    // Verify the lead was processed
    const updatedLead = await getTestLead(lead.id);
    expect(updatedLead.status).to.equal('processed');
    
    // Verify a call was created
    expect(twilioClient.calls.create).to.have.been.calledOnce;
    expect(twilioClient.calls.create).to.have.been.calledWith(
      sinon.match({ to: '+15551234567' })
    );
  });
});
```

## End-to-End Testing

For end-to-end tests, we'll use Puppeteer to automate browser interactions.

### Setup for E2E Tests

1. Create `jest.e2e.config.js`:

```javascript
module.exports = {
  preset: 'jest-puppeteer',
  testMatch: ['**/tests/end-to-end/**/*.test.js'],
  testTimeout: 30000
};
```

2. Create an E2E test file:

```javascript
const puppeteer = require('puppeteer');
const { expect } = require('chai');

describe('Login Flow', () => {
  let browser;
  let page;
  
  beforeAll(async () => {
    browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
  });
  
  afterAll(async () => {
    await browser.close();
  });
  
  it('should display login form', async () => {
    await page.goto('http://localhost:3000/login.html');
    
    const usernameInput = await page.$('#username');
    const passwordInput = await page.$('#password');
    const submitButton = await page.$('button[type="submit"]');
    
    expect(usernameInput).to.not.be.null;
    expect(passwordInput).to.not.be.null;
    expect(submitButton).to.not.be.null;
  });
  
  it('should show error for invalid credentials', async () => {
    await page.goto('http://localhost:3000/login.html');
    
    await page.type('#username', 'wronguser');
    await page.type('#password', 'wrongpass');
    await page.click('button[type="submit"]');
    
    // Wait for error message
    await page.waitForSelector('#error-message[style*="display: block"]');
    
    const errorMessage = await page.$eval('#error-message', el => el.textContent);
    expect(errorMessage).to.include('Authentication failed');
  });
});
```

## Testing Environment Variables

For tests that involve sensitive configuration:

1. Create a `.env.test` file:

```
JWT_SECRET=test-secret-key
DATABASE_URL=memory:test
TWILIO_ACCOUNT_SID=AC000000000000000000000000000000
TWILIO_AUTH_TOKEN=test_auth_token
```

2. Load in your tests:

```javascript
// In setup.js
const dotenv = require('dotenv');
dotenv.config({ path: '.env.test' });
```

## Code Coverage

Generate and view coverage reports:

```bash
npm run test:coverage
```

The coverage report will be generated in the `coverage` directory. Open `coverage/lcov-report/index.html` in your browser to view a detailed report.

## Testing Specific Components

Here are some specific guidelines for testing different parts of the application:

### Testing Error Handling

Ensure you test both success and error paths:

```javascript
it('should handle database errors gracefully', async () => {
  // Force a database error
  store.users.getByUsername.rejects(new Error('Database connection failed'));
  
  // Call the function under test
  const result = await userService.authenticateUser('testuser', 'password');
  
  // Verify it handled the error properly
  expect(result.success).to.be.false;
  expect(result.error).to.include('Database connection failed');
  expect(errorService.handleError).to.have.been.calledOnce;
});
```

### Testing Twilio Integration

Use mocks for Twilio APIs:

```javascript
it('should make an outbound call', async () => {
  // Mock Twilio API
  twilioClient.calls.create.resolves({
    sid: 'CA123456789',
    status: 'queued'
  });
  
  const result = await callService.makeCall('+15551234567');
  
  expect(result.success).to.be.true;
  expect(twilioClient.calls.create).to.have.been.calledWith(
    sinon.match({
      to: '+15551234567',
      from: sinon.match.any,
      url: sinon.match.string
    })
  );
});
```

### Testing WebRTC Client

For client-side WebRTC:

```javascript
// Mock the Twilio Device object
global.Twilio = {
  Device: class MockDevice {
    constructor() {
      this.callbacks = {};
    }
    
    on(event, callback) {
      this.callbacks[event] = callback;
      return this;
    }
    
    connect(params) {
      // Return a mock connection
      return {
        mute: sinon.stub(),
        disconnect: sinon.stub()
      };
    }
    
    // Trigger an event for testing
    _triggerEvent(event, data) {
      if (this.callbacks[event]) {
        this.callbacks[event](data);
      }
    }
  }
};
```

## Common Testing Patterns

### Testing Asynchronous Code

```javascript
it('should resolve after a delay', async () => {
  const clock = sinon.useFakeTimers();
  
  const promise = delayFunction(1000);
  
  // Fast-forward time
  clock.tick(1000);
  
  // Wait for promise to resolve
  const result = await promise;
  
  expect(result).to.equal('completed');
  
  clock.restore();
});
```

### Testing Event Emitters

```javascript
it('should emit events when status changes', () => {
  const eventEmitter = new EventEmitter();
  const statusService = new StatusService(eventEmitter);
  
  // Create a spy to track events
  const statusChangeSpy = sinon.spy();
  eventEmitter.on('statusChange', statusChangeSpy);
  
  // Trigger status change
  statusService.updateStatus('online');
  
  expect(statusChangeSpy).to.have.been.calledOnce;
  expect(statusChangeSpy).to.have.been.calledWith('online');
});
```

## Debugging Tests

If a test is failing and you need to debug:

1. Use Node's debugger:

```bash
node --inspect-brk ./node_modules/.bin/jest --runInBand tests/failing-test.js
```

2. Open Chrome and navigate to `chrome://inspect`

3. Click "Open dedicated DevTools for Node"

4. Use the debugger to step through your test

## Conclusion

This guide provides practical examples for implementing tests in your local development environment. Follow these patterns to create comprehensive test coverage for the Twilio Dialer application. Remember to run tests frequently during development to catch issues early.

For more advanced testing scenarios, refer to the comprehensive Test Coverage Implementation Plan document.