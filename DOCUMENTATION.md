# Twilio Dialer Web Application - Developer Documentation
Last updated: 3/11/2025, 4:00pm EST

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Data Layer](#data-layer)
5. [Service Layer](#service-layer)
6. [API Layer](#api-layer)
7. [UI Layer](#ui-layer)
8. [Testing Framework](#testing-framework)
9. [Workflows](#workflows)
10. [Deployment](#deployment)
11. [Development Guidelines](#development-guidelines)
12. [Troubleshooting](#troubleshooting)

---

## System Overview

The Twilio Dialer Web Application is a full-featured call center solution that integrates with Twilio's Voice API. It provides a platform for managing outbound and inbound calls with the following capabilities:

- **Agent Dialer Interface**: Browser-based WebRTC dialer
- **Call Queue Management**: Automatic call distribution to available agents
- **Agent Status System**: Tracks agent availability and activity
- **Workflow Automation**: Visual workflow builder for call handling logic
- **Campaign Management**: Organize calls into campaigns
- **Reporting and Analytics**: Track call metrics and agent performance

The system is designed to be modular, allowing for future extensions such as a mobile app interface, additional communication channels (SMS, email), and integration with CRM systems.

---

## Architecture

### System Components

```
twilio-dialer/
├── assets/                      # Static assets
│   └── icons/                   # Application icons
├── background/                  # Chrome extension background scripts
│   └── background.js            # Background service worker
├── config/                      # Configuration files
│   ├── config.js                # Client-side configuration
│   └── config.json              # Configuration values
├── lib/                         # Shared libraries
│   ├── api.js                   # API communication utilities
│   └── twilio.js                # Twilio SDK wrapper
├── popup/                       # Chrome extension popup UI
│   ├── popup.html               # Extension UI
│   ├── popup.css                # Styling
│   └── popup.js                 # UI interaction logic
├── server/                      # Backend server
│   ├── auth.js                  # Authentication system
│   ├── call-queue-manager.js    # Call queue processing
│   ├── config.js                # Server configuration
│   ├── db.js                    # Database connection
│   ├── index.js                 # Main server entry point
│   ├── init-db.js               # Database initialization
│   ├── memory-store.js          # In-memory data storage
│   ├── rules-manager.js         # Call routing rules
│   ├── token-generator.js       # Twilio token generation
│   ├── twiml-handler.js         # TwiML response generation
│   ├── workflow-manager.js      # Workflow execution engine
│   ├── config/                  # Server configuration
│   │   └── feature-flags.json   # Feature toggles
│   ├── docs/                    # API documentation
│   ├── public/                  # Static web files
│   │   ├── admin.html           # Admin dashboard
│   │   ├── dashboard.html       # Agent dashboard
│   │   ├── index.html           # Landing page
│   │   ├── login.html           # Authentication page
│   │   ├── workflow-editor.html # Workflow builder
│   │   └── js/                  # Client-side scripts
│   ├── routes/                  # API routes
│   │   ├── agent-status.js      # Agent status endpoints
│   │   ├── api.js               # General API endpoints
│   │   ├── auth.js              # Authentication endpoints
│   │   ├── campaigns.js         # Campaign management
│   │   ├── contact-centers.js   # Contact center management
│   │   ├── dispositions.js      # Call disposition endpoints
│   │   ├── rules.js             # Call routing rules endpoints
│   │   ├── voice.js             # Voice call handling
│   │   └── workflows.js         # Workflow management
│   ├── services/                # Business logic services
│   │   ├── agent-status-service.js    # Agent status management
│   │   ├── contact-center-service.js  # Contact center operations
│   │   ├── error-service.js           # Error handling
│   │   ├── failure-categorization-service.js # Call failure analysis
│   │   ├── feature-flags.js           # Feature toggle management
│   │   ├── lock-service.js            # Concurrency control
│   │   ├── notification-service.js    # Agent notifications
│   │   ├── retry-service.js           # Call retry logic
│   │   ├── scheduler-service.js       # Task scheduling
│   │   ├── sql-adapter.js             # Database adapter
│   │   ├── status-transition-service.js # Agent status transitions
│   │   └── storage-service.js         # Data persistence
│   └── tests/                   # Unit and integration tests
├── plans/                       # Implementation plans
└── manifest.json                # Chrome extension manifest
```

### Tech Stack

- **Backend**: Node.js, Express.js
- **Frontend**: HTML5, CSS3, JavaScript, WebRTC
- **Database**: In-memory with persistence option (can be switched to PostgreSQL)
- **Authentication**: JWT-based token authentication
- **External APIs**: Twilio Voice API, Twilio Messaging API

### Architecture Principles

The application is built on the following architectural principles:

1. **Service-Oriented Architecture**: Business logic is organized into discrete services
2. **Separation of Concerns**: Clear separation between data, business logic, API, and UI layers
3. **Dependency Injection**: Services receive dependencies through their constructors
4. **Promise-Based Async**: Consistent use of Promises for asynchronous operations
5. **Centralized Error Handling**: Errors are handled through a dedicated error service
6. **Feature Flags**: Gradual rollout of new features via feature flags
7. **Test-Driven Development**: Comprehensive test coverage at multiple levels

---

## Core Components

### Authentication System (auth.js)

The authentication system manages user identity, permissions, and session management.

#### Key Functions:

- `generateToken(user)`: Creates a JWT token for a user with an expiration time
- `isAuthenticated`: Middleware that validates JWT tokens in request headers
- `isAdmin`: Middleware that checks if the authenticated user has admin role
- `isAgent`: Middleware that checks if the user has agent role

#### Usage:

```javascript
// In route definitions
router.get('/secure-endpoint', auth.isAuthenticated, auth.isAdmin, (req, res) => {
  // Only admins can access this endpoint
});
```

### Memory Store (memory-store.js)

The memory store serves as the data layer for the application, providing in-memory storage with an API that can be switched to use a persistent database.

#### Collections:

- `users`: System users (admins and agents)
- `agentStatus`: Agent availability status
- `callQueue`: Queue of calls to be processed
- `callHistory`: History of completed calls
- `dispositions`: Call outcome categories
- `workflows`: Automated workflow definitions
- `campaigns`: Marketing campaign definitions
- `contactCenters`: Contact center configurations

#### Key Methods (per collection):

- `getAll()`: Retrieve all records
- `getById(id)`: Get a specific record by ID
- `add(data)`: Create a new record
- `update(id, data)`: Update an existing record
- `delete(id)`: Remove a record
- Collection-specific methods (e.g., `getByUsername()` for users)

#### Usage:

```javascript
// Get all workflows
const workflows = await store.workflows.getAll();

// Get a specific user
const user = await store.users.getById('user-123');

// Update agent status
await store.agentStatus.updateStatus('agent-456', 'Available');
```

### Call Queue Manager (call-queue-manager.js)

The call queue manager handles the processing of outbound calls, assignment to agents, and call status tracking.

#### Key Functions:

- `start(intervalMs)`: Start queue processing with a specified interval
- `stop()`: Stop queue processing
- `processQueue()`: Process queued calls and assign to available agents
- `addToQueue(callData)`: Add a new call to the queue
- `assignCallToAgent(call, agent)`: Assign a call to a specific agent
- `initiateCall(call, agent)`: Initiate a call through Twilio
- `handleCallStatusUpdate(callStatus)`: Process call status updates from Twilio
- `setAgentAvailable(userId)`: Mark an agent as available
- `setAgentUnavailable(userId, status)`: Mark an agent as unavailable

#### Usage:

```javascript
// Start the queue manager
await callQueueManager.start();

// Add a call to the queue
const result = await callQueueManager.addToQueue({
  phone_number: '+15551234567',
  contact_name: 'John Doe',
  notes: 'Potential customer'
});

// Process a call status update from Twilio
await callQueueManager.handleCallStatusUpdate({
  CallSid: 'CA123456789',
  CallStatus: 'completed',
  CallDuration: '120'
});
```

### Workflow Manager (workflow-manager.js)

The workflow manager executes automated workflows for call handling and lead processing.

#### Key Functions:

- `startWorkflow(workflowIdOrObject, context)`: Start a workflow with context data
- `processStep(step, context)`: Process a specific workflow step
- `processCallDisposition(call)`: Handle a call disposition event
- `processNewLead(leadData)`: Process a new lead through applicable workflows
- `evaluateCondition(condition, context)`: Evaluate workflow conditions
- `isWithinBusinessHours(businessHours)`: Check if current time is within business hours

#### Step Types:

- `start`: Beginning of a workflow
- `end`: End of a workflow
- `call`: Initiate a call
- `wait`: Delay execution
- `condition`: Branching logic
- `sms`: Send an SMS message
- `email`: Send an email
- `campaign`: Add/remove from a campaign

#### Usage:

```javascript
// Start a workflow
await workflowManager.startWorkflow('new-lead-workflow', {
  lead: {
    phone_number: '+15551234567',
    name: 'John Doe',
    email: 'john@example.com'
  }
});

// Process a call disposition
await workflowManager.processCallDisposition({
  id: 'call-123',
  workflow_id: 'wf-456',
  phone_number: '+15551234567',
  disposition: 'no-answer'
});
```

### Rules Manager (rules-manager.js)

The rules manager handles call routing rules and business logic for call processing.

#### Key Functions:

- `getRules()`: Get all defined rules
- `updateRules(rules)`: Update the rules configuration
- `evaluateRules(context)`: Evaluate rules against a context
- `shouldProcessCall(call)`: Determine if a call should be processed based on rules
- `processNoAnswerCall(call)`: Handle calls with no-answer disposition

#### Usage:

```javascript
// Get current rules
const rules = rulesManager.getRules();

// Update rules
await rulesManager.updateRules([
  {
    id: 'business-hours',
    name: 'Business Hours Rule',
    active: true,
    conditions: { /* ... */ },
    actions: { /* ... */ }
  }
]);

// Evaluate rules against a context
const result = await rulesManager.evaluateRules({
  call: { /* call data */ },
  time: new Date()
});
```

### Token Generator (token-generator.js)

The token generator creates Twilio Capability Tokens for WebRTC client connections.

#### Key Functions:

- `generateToken(identity)`: Generate a token for a specific user identity
- `generateClientToken(identity)`: Generate a client-specific token
- `generateWorkerToken(identity)`: Generate a token for TaskRouter workers

#### Usage:

```javascript
// Generate a token for a user
const token = tokenGenerator.generateToken('agent-123');

// Generate a client token with specific capabilities
const clientToken = tokenGenerator.generateClientToken('agent-123');
```

### TwiML Handler (twiml-handler.js)

The TwiML handler generates TwiML responses for Twilio voice interactions.

#### Key Functions:

- `generateOutboundDialResponse(to, from, options)`: Generate TwiML for outbound calls
- `generateInboundCallResponse(callData)`: Generate TwiML for inbound calls
- `generateVoicemailResponse(options)`: Generate TwiML for voicemail handling
- `generateConferenceResponse(roomName, options)`: Generate TwiML for conference calls

#### Usage:

```javascript
// Generate TwiML for an outbound call
const twiml = twimlHandler.generateOutboundDialResponse(
  '+15551234567',
  '+15559876543',
  { timeout: 30 }
);

// Generate TwiML for an inbound call
const twiml = twimlHandler.generateInboundCallResponse({
  to: '+15551234567',
  from: '+15559876543',
  agentId: 'agent-123'
});
```

---

## Data Layer

### Data Models

#### User Model

```javascript
{
  id: string,          // Unique identifier
  username: string,    // Login username
  password: string,    // Hashed password
  full_name: string,   // User's full name
  email: string,       // Email address
  role: string,        // 'admin' or 'agent'
  created_at: string,  // ISO datetime
  updated_at: string   // ISO datetime
}
```

#### Agent Status Model

```javascript
{
  user_id: string,           // Reference to user
  username: string,          // User's username
  status: string,            // 'Available', 'Unavailable', 'Busy', 'After Call Work'
  last_status_change: string, // ISO datetime
  current_call_id: string,   // Current active call (if any)
  custom_status: string      // Optional custom status message
}
```

#### Call Queue Model

```javascript
{
  id: string,                // Unique identifier
  phone_number: string,      // Customer phone number
  contact_name: string,      // Customer name
  notes: string,             // Call notes
  status: string,            // 'Queued', 'In Progress', 'Completed', 'Failed'
  priority: number,          // Call priority (higher = more important)
  scheduled_for: string,     // ISO datetime for scheduled calls
  created_at: string,        // ISO datetime
  assigned_to: string,       // Agent user ID (if assigned)
  call_sid: string,          // Twilio Call SID (if initiated)
  disposition_id: string,    // Call disposition (if completed)
  disposition_name: string,  // Readable disposition name
  retry_count: number,       // Number of retry attempts
  workflow_id: string,       // Associated workflow (if any)
  workflow_step_id: string,  // Current workflow step (if any)
  campaign_id: string        // Associated campaign (if any)
}
```

#### Call History Model

```javascript
{
  id: string,                // Unique identifier
  call_sid: string,          // Twilio Call SID
  user_id: string,           // Agent user ID
  phone_number: string,      // Customer phone number
  contact_name: string,      // Customer name
  direction: string,         // 'inbound' or 'outbound'
  start_time: string,        // ISO datetime
  end_time: string,          // ISO datetime
  duration: number,          // Call duration in seconds
  recording_url: string,     // URL to call recording (if any)
  disposition: string,       // Call disposition
  notes: string,             // Call notes
  workflow_id: string,       // Associated workflow (if any)
  campaign_id: string        // Associated campaign (if any)
}
```

---

## Service Layer

### Agent Status Service (agent-status-service.js)

Manages agent availability and status changes.

#### Key Functions:

- `getAgentStatus(userId)`: Get an agent's current status
- `updateAgentStatus(userId, status)`: Update agent status
- `getAvailableAgents()`: Get all available agents
- `setAgentBusy(userId, callId)`: Mark agent as busy with a call
- `setAgentAfterCallWork(userId)`: Mark agent as in after-call work

#### Status Transition Rules:

```
Available → Unavailable, Busy, After Call Work
Unavailable → Available
Busy → After Call Work, Available, Unavailable
After Call Work → Available, Unavailable
```

### Error Service (error-service.js)

Centralized error handling and logging.

#### Error Types:

- `TWILIO_API_ERROR`: Errors from Twilio API
- `CALL_INITIATION_ERROR`: Errors when initiating calls
- `QUEUE_PROCESSING_ERROR`: Errors during queue processing
- `DATABASE_ERROR`: Database-related errors
- `AUTHENTICATION_ERROR`: Authentication failures
- `VALIDATION_ERROR`: Input validation errors
- `UNKNOWN_ERROR`: Unclassified errors

#### Key Functions:

- `handleError(error, source)`: Process and log an error
- `logError(errorType, message, details)`: Log an error with context
- `isRetryableError(errorType, errorDetails)`: Determine if an error is retryable

#### Usage:

```javascript
try {
  // Some operation that might fail
} catch (error) {
  const errorResult = await errorService.handleError(error, 'call-queue-manager');
  console.log(`Error handled: ${errorResult.message}`);
  
  if (errorResult.retryable) {
    // Attempt retry logic
  }
}
```

### Retry Service (retry-service.js)

Handles retry logic for failed operations.

#### Key Functions:

- `scheduleRetry(itemId, error)`: Schedule a retry for a failed operation
- `processRetries(processor)`: Process all items ready for retry
- `getCallsReadyForRetry()`: Get all calls ready for retry
- `handleFailedCall(callId, error, callback)`: Handle a failed call with retry logic

#### Retry Strategy:

- Exponential backoff (increasing delay between retries)
- Maximum retry count based on error type
- Different retry strategies for different error categories

### Feature Flags Service (feature-flags.js)

Manages feature toggles for gradual rollout of features.

#### Key Functions:

- `isFeatureEnabled(featureName, defaultValue)`: Check if a feature is enabled
- `setFeatureFlag(featureName, value)`: Enable or disable a feature
- `getAllFeatures()`: Get all feature flags and their status

#### Available Feature Flags:

- `errorHandling.enabled`: Enhanced error handling system
- `errorHandling.retryEnabled`: Call retry functionality
- `concurrency.enabled`: Concurrency control for queue processing
- `scheduledCalls.enabled`: Support for scheduled calls
- `loadBalancing.enabled`: Intelligent call distribution
- `abTesting.enabled`: A/B testing capabilities

---

## API Layer

### Authentication Endpoints (auth.js)

- `POST /auth/login`: Authenticate a user
  - Request: `{ username, password }`
  - Response: `{ token, user }`

- `GET /auth/verify`: Verify a token
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ valid, user }`

### Agent Status Endpoints (agent-status.js)

- `GET /api/agent-status`: Get all agent statuses
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ agentStatus: [...] }`

- `PUT /api/agent-status/:userId`: Update an agent's status
  - Headers: `Authorization: Bearer <token>`
  - Request: `{ status, customStatus }`
  - Response: `{ success, status }`

### Call Queue Endpoints (api.js)

- `GET /api/call-queue`: Get calls in the queue
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ calls: [...], total, limit, offset }`

- `POST /api/call-queue`: Add a call to the queue
  - Headers: `Authorization: Bearer <token>`
  - Request: `{ phoneNumber, contactName, notes, priority, scheduledFor }`
  - Response: `{ success, id, scheduled, scheduledTime }`

### Voice Endpoints (voice.js)

- `POST /voice/token`: Get a Twilio voice token
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ token }`

- `POST /voice/outbound`: Initiate an outbound call
  - Headers: `Authorization: Bearer <token>`
  - Request: `{ to, from, callQueueId }`
  - Response: `{ success, callSid }`

- `POST /voice/outgoing`: TwiML for outgoing calls (Twilio webhook)
  - Request: `{ to, from, agentId, callQueueId }`
  - Response: TwiML

- `POST /voice/incoming`: TwiML for incoming calls (Twilio webhook)
  - Request: `{ Called, Caller, ... }` (Twilio parameters)
  - Response: TwiML

### Workflow Endpoints (workflows.js)

- `GET /api/workflows`: Get all workflows
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ workflows: [...] }`

- `POST /api/workflows`: Create a new workflow
  - Headers: `Authorization: Bearer <token>`
  - Request: `{ name, description, triggers, steps, businessHours, active }`
  - Response: `{ workflow: { id, name, ... } }`

- `PUT /api/workflows/:id`: Update a workflow
  - Headers: `Authorization: Bearer <token>`
  - Request: `{ name, description, triggers, steps, businessHours, active }`
  - Response: `{ workflow: { id, name, ... } }`

- `POST /api/workflows/:id/test`: Test a workflow
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ success, message }`

### Rules Endpoints (rules.js)

- `GET /api/rules`: Get call routing rules
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ rules: [...] }`

- `POST /api/rules`: Update call routing rules
  - Headers: `Authorization: Bearer <token>`
  - Request: `{ rules: [...] }`
  - Response: `{ rules: [...] }`

---

## Testing Framework

### Test Structure

```
server/tests/
├── setup.js                     # Test setup for unit/integration tests
├── setup.e2e.js                 # Test setup for end-to-end tests
├── mock-store.js                # Mock data store for tests
├── simple.test.js               # Simple test to verify setup
├── error-service.test.js        # Tests for error service
├── auth.test.js                 # Tests for authentication
├── agent-status-service.test.js # Tests for agent status service
├── rules-manager.test.js        # Tests for rules manager
├── call-queue-manager.integration.test.js # Integration tests for call queue
├── workflow-manager.unit.test.js          # Unit tests for workflow manager
├── workflow-call-queue.integration.test.js # Integration between workflow and queue
├── workflow-end-to-end.test.js   # End-to-end workflow tests
├── end-to-end/                  # End-to-end test directory
│   ├── login-flow.test.js       # Tests for login flow
│   └── dialer-interface.test.js # Tests for dialer interface
└── routes/                      # API route tests
    ├── auth.test.js             # Authentication route tests
    ├── rules.test.js            # Rules API tests
    └── workflows.test.js        # Workflow API tests
```

### Testing Levels

#### Unit Tests

Test individual components in isolation. Use these when testing specific functions or business logic.

```javascript
// Example: Testing error categorization
describe('isRetryableError()', () => {
  it('should identify Twilio API rate limit errors as retryable', () => {
    const isRetryable = errorService.isRetryableError(
      errorService.ErrorTypes.TWILIO_API_ERROR,
      { code: 20429 }
    );
    
    expect(isRetryable).to.be.true;
  });
});
```

#### Integration Tests

Test how components work together. Use these when testing interactions between services.

```javascript
// Example: Testing call assignment
describe('assignCallToAgent()', () => {
  it('should assign a call to an available agent', async () => {
    // Mock data
    const call = { id: 'call-123', phone_number: '+15551234567' };
    const agent = { user_id: 'agent-123', username: 'agent' };
    
    // Execute the function
    await callQueueManager.assignCallToAgent(call, agent);
    
    // Verify the result
    expect(mockStore.callQueue.assignToAgent).to.have.been.calledWith(
      'call-123', 'agent-123'
    );
  });
});
```

#### API Tests

Test API routes and responses. Use these to validate endpoint behavior.

```javascript
// Example: Testing workflow API endpoint
describe('GET /api/workflows', () => {
  it('should return workflows for admin users', async () => {
    const response = await request(app)
      .get('/api/workflows')
      .set('Authorization', `Bearer ${adminToken}`);
    
    expect(response.status).to.equal(200);
    expect(response.body).to.have.property('workflows');
    expect(response.body.workflows).to.be.an('array');
  });
});
```

#### End-to-End Tests

Test complete user flows in a browser-like environment. Use these for testing UI interactions.

```javascript
// Example: Testing the login flow
describe('Login Flow', () => {
  it('should show error for invalid credentials', async () => {
    await page.goto('http://localhost:3000/login.html');
    
    await page.type('#username', 'wronguser');
    await page.type('#password', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    await page.waitForSelector('#error-message[style*="display: block"]');
    
    const errorMessage = await page.$eval('#error-message', el => el.textContent);
    expect(errorMessage).to.equal('Authentication failed');
  });
});
```

### Running Tests

#### Basic Test Commands

```bash
# Run all tests
cd server
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run a specific test file
npm run test:file -- tests/error-service.test.js

# Run all unit tests
npm run test:unit

# Run all integration tests
npm run test:integration

# Run all end-to-end tests
npm run test:e2e
```

### Mocking Strategies

#### Service Mocking

Mock dependencies when testing a service:

```javascript
// Mock the store
const mockStore = {
  callQueue: {
    getQueued: sinon.stub().resolves([]),
    assignToAgent: sinon.stub().resolves(true)
  }
};

// Inject the mock
queueManager.store = mockStore;
```

#### Twilio Mocking

Mock Twilio API in tests:

```javascript
// Mock Twilio client
const mockTwilioClient = {
  calls: {
    create: sinon.stub().resolves({
      sid: 'CA123456789',
      status: 'queued'
    })
  }
};

// Inject the mock
queueManager.twilioClient = mockTwilioClient;
```

### CI/CD Integration

GitHub Actions workflow is configured in `.github/workflows/test.yml` to automatically run tests on code changes.

---

## Workflows

### Key User Workflows

#### Agent Workflow

1. **Login**: Agent logs in at `/login.html`
2. **Status Management**: Agent sets status to "Available"
3. **Call Handling**:
   - **Outbound**: Agent dials or selects from queue
   - **Inbound**: Agent receives call notification
4. **During Call**: Agent can mute, use keypad, hang up
5. **After Call**: Agent completes disposition form
6. **Call History**: Agent can review past calls

#### Admin Workflow

1. **Login**: Admin logs in at `/login.html`
2. **Agent Monitoring**: View agent status and activity
3. **Queue Management**: Manage call queue
4. **Workflow Creation**:
   - Create new workflows in workflow editor
   - Define triggers, steps, and conditions
5. **Reporting**: View call and agent metrics

### Workflow Engine

The workflow engine processes automated call handling sequences:

1. **Trigger**: Event that starts the workflow (new lead, call disposition)
2. **Steps**: Series of actions to execute (call, wait, condition)
3. **Branching**: Conditional logic based on call outcomes
4. **Scheduling**: Time-based execution (business hours, delays)

#### Example Workflow Definition:

```javascript
{
  id: "lead-follow-up",
  name: "Lead Follow-up",
  active: true,
  triggers: [
    { event: "call-completed", filter: { disposition: "no-answer" } }
  ],
  steps: [
    {
      id: "start",
      type: "start",
      next: "wait-60"
    },
    {
      id: "wait-60",
      type: "wait",
      config: { minutes: 60 },
      next: "try-call-again"
    },
    {
      id: "try-call-again",
      type: "call",
      config: { maxRetries: 3 },
      next: "condition-answered"
    },
    {
      id: "condition-answered",
      type: "condition",
      config: {
        condition: { type: "disposition", value: "completed" }
      },
      next: { true: "end-success", false: "end-failure" }
    },
    {
      id: "end-success",
      type: "end"
    },
    {
      id: "end-failure",
      type: "end"
    }
  ],
  business_hours: {
    enabled: true,
    timezone: "America/New_York",
    days: [1, 2, 3, 4, 5], // Monday to Friday
    start_time: "09:00",
    end_time: "17:00"
  }
}
```

---

## Deployment

### Local Development Setup

1. **Install Dependencies**:
   ```bash
   cd server
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the server directory with:
   ```
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   PORT=3000
   SERVER_BASE_URL=http://localhost:3000
   JWT_SECRET=your_jwt_secret
   ```

3. **Initialize Database**:
   ```bash
   node init-db.js
   ```

4. **Start the Server**:
   ```bash
   npm start
   ```

### Chrome Extension Setup

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the root folder of this project

### Production Deployment

1. **Database Configuration**:
   - Update `db.js` to use a persistent database
   - Run migrations if needed

2. **Environment Configuration**:
   - Set `NODE_ENV=production` in environment
   - Configure all necessary environment variables
   - Set up secure JWT secret

3. **Web Server Configuration**:
   - Set up reverse proxy (Nginx, Apache)
   - Configure SSL certificates
   - Set up proper HTTP headers

4. **Monitoring and Logging**:
   - Configure logging service
   - Set up monitoring alerts
   - Enable error tracking

---

## Development Guidelines

### Code Style

- Use consistent indentation (2 spaces)
- Follow ESLint configuration
- Use descriptive variable and function names
- Add JSDoc comments for all functions
- Keep functions small and focused

### Adding New Features

1. **Planning**:
   - Create a detailed plan in the `plans/` directory
   - Define requirements and acceptance criteria

2. **Implementation**:
   - Start with the core business logic in services
   - Create API endpoints for the new feature
   - Implement UI components if needed

3. **Testing**:
   - Write unit tests for new services
   - Create integration tests for API endpoints
   - Add end-to-end tests for UI flows

4. **Documentation**:
   - Update API documentation
   - Add examples to README if needed
   - Document any new config options

### Making Architecture Changes

1. **Discuss and Document**: Create a design document explaining the change
2. **Compatibility**: Ensure backward compatibility or migration path
3. **Testing**: Extensive testing of affected components
4. **Phased Rollout**: Use feature flags for gradual deployment

---

## Troubleshooting

### Common Issues

#### Server Won't Start

- Check if port is already in use
- Verify all required environment variables
- Check for syntax errors in recent changes

#### Twilio Calls Not Working

- Verify Twilio credentials
- Check voice URL configuration in Twilio console
- Make sure server is accessible from internet (for webhooks)
- Check TwiML responses for errors

#### Tests Failing

- Run tests with `--verbose` flag for more details
- Check if mocks are properly configured
- Verify test environment variables

### Debugging Tools

- **Server Logs**: Check `combined.log` and `error.log` files
- **Console Logging**: Look for console.log/error output
- **Browser Dev Tools**: Check network requests and console
- **Test Coverage**: Run `npm run test:coverage` to find untested code

### Getting Help

If you encounter issues not covered in this documentation:

1. Check the existing issues in the repository
2. Review the plans/ directory for implementation details
3. Consult the server/docs/ directory for specific API documentation
4. Look at test files for examples of intended behavior