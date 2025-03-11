# Twilio Dialer Web Application

A comprehensive call center application powered by Twilio, enabling outbound and inbound call management, agent status tracking, workflow automation, and campaign management.

## System Overview

The Twilio Dialer Web Application is a full-featured call center solution that integrates with Twilio's Voice API to provide a complete platform for managing outbound and inbound calls. The system includes agent dashboards, admin interfaces, automated workflow processing, and campaign management capabilities.

## System Architecture

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
│   │       ├── agent-status.js  # Agent status management
│   │       └── call-countdown.js # Call countdown timer
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

## Core Components

### 1. Memory Store (Data Layer)

The `memory-store.js` module serves as the central data repository for the application. It provides an in-memory database with the following key features:

- **Data Collections**: Manages users, agent statuses, call queue, call history, dispositions, workflows, campaigns, and contact centers
- **CRUD Operations**: Provides methods for creating, reading, updating, and deleting data
- **Promise-based API**: All methods return promises for consistent async handling
- **Data Relationships**: Maintains relationships between different data entities

The memory store is designed to be replaceable with a persistent database solution while maintaining the same API interface.

### 2. Workflow Manager (Business Logic)

The `workflow-manager.js` module is the heart of the automation system, responsible for:

- **Workflow Execution**: Processes workflows step by step
- **Trigger Handling**: Responds to events like new leads, call dispositions, and campaign changes
- **Step Execution**: Implements different types of workflow steps:
  - Start/End steps for workflow boundaries
  - Call steps for initiating calls
  - Wait steps for scheduling delays
  - Condition steps for branching logic
  - SMS steps for sending messages
  - Campaign steps for lead management
- **Business Hours**: Enforces time-based constraints on when actions can be performed
- **Scheduling**: Manages delayed execution of workflow steps

### 3. Call Queue Manager (Call Processing)

The `call-queue-manager.js` module handles the outbound call queue:

- **Queue Management**: Adds, updates, and processes calls in the queue
- **Agent Assignment**: Matches available agents with queued calls
- **Call Initiation**: Interfaces with Twilio to place calls
- **Status Tracking**: Monitors call progress and updates status
- **Retry Logic**: Handles failed calls with configurable retry policies

### 4. Agent Status System (Agent Management)

The agent status system consists of several services:

- **Agent Status Service**: Manages agent availability states and transitions
- **Status Transition Service**: Provides hooks for status change events
- **Notification Service**: Alerts agents about important events

This system ensures proper agent state management with features like:
- Valid status transitions enforcement
- Automatic status changes (e.g., after call work timeouts)
- Status duration tracking
- Status-based routing

### 5. Error Handling System (Reliability)

The error handling system provides robust error management:

- **Error Service**: Centralizes error handling and logging
- **Retry Service**: Implements exponential backoff for failed operations
- **Failure Categorization**: Classifies errors for better reporting and handling
- **Feature Flags**: Enables gradual rollout of new features

## Key Workflows

### 1. Outbound Call Flow

1. **Call Creation**: A call is added to the queue (manually or via workflow)
2. **Queue Processing**: The call queue manager processes the queue
3. **Agent Assignment**: An available agent is assigned to the call
4. **Call Initiation**: Twilio initiates the call to the customer
5. **Call Handling**: The agent handles the call using the web interface
6. **Call Completion**: The agent completes the call and selects a disposition
7. **After Call Work**: The agent enters notes and completes after-call tasks
8. **Workflow Continuation**: Based on the disposition, workflows may trigger additional steps

### 2. Workflow Execution Flow

1. **Trigger Event**: An event (new lead, call disposition, etc.) triggers a workflow
2. **Start Step**: The workflow begins with the start step
3. **Step Execution**: Each step is executed based on its type:
   - Call steps initiate calls
   - Wait steps delay execution
   - Condition steps evaluate branching logic
   - SMS steps send messages
   - Campaign steps manage campaign membership
4. **Branching**: Based on conditions, the workflow follows different paths
5. **Scheduling**: Some steps may schedule future actions
6. **End Step**: The workflow completes at an end step

### 3. Agent Status Flow

1. **Login**: Agent logs into the system
2. **Status Selection**: Agent selects their status (Available, Unavailable, etc.)
3. **Call Assignment**: When Available, the agent may be assigned calls
4. **Status Transitions**: During calls, the agent's status changes automatically:
   - Available → Busy (during call)
   - Busy → After Call Work (after call)
   - After Call Work → Available (after timeout or manual change)
5. **Notifications**: The agent receives notifications about status-related events

## User Interfaces

### 1. Agent Dashboard

The agent dashboard (`dashboard.html`) provides:

- **Status Controls**: Change agent availability status
- **Dialer**: Make outbound calls with a phone keypad
- **Call Controls**: Answer, hang up, mute, and send DTMF tones
- **Call Queue**: View and process queued calls
- **Call History**: Review past calls with dispositions
- **Notifications**: Receive alerts about important events

### 2. Admin Dashboard

The admin dashboard (`admin.html`) offers:

- **Agent Monitoring**: View agent status and activity
- **Call Queue Management**: Add, prioritize, and assign calls
- **Call History**: Review all call activity
- **System Configuration**: Configure system settings

### 3. Workflow Editor

The workflow editor (`workflow-editor.html`) allows admins to:

- **Create Workflows**: Build new automated workflows
- **Add Steps**: Configure different types of workflow steps
- **Set Conditions**: Define branching logic
- **Configure Timing**: Set wait times and business hours
- **Test Workflows**: Validate workflow execution

## API Structure

The API is organized into RESTful endpoints:

- **/api/agent-status**: Agent status management
- **/api/call-queue**: Call queue operations
- **/api/call-history**: Call history access
- **/api/dispositions**: Call disposition management
- **/api/workflows**: Workflow CRUD operations
- **/api/campaigns**: Campaign management
- **/api/contact-centers**: Contact center configuration
- **/auth**: Authentication endpoints
- **/voice**: Twilio voice integration endpoints

## Security Model

The application implements a comprehensive security model:

- **Authentication**: JWT-based token authentication
- **Authorization**: Role-based access control (admin vs. agent)
- **Password Security**: Secure password hashing with salt
- **Input Validation**: Validation of all user inputs
- **Error Handling**: Secure error responses that don't leak sensitive information

## Error Handling Strategy

The error handling system provides:

- **Centralized Logging**: All errors are logged with context
- **Error Categorization**: Errors are categorized by type and source
- **Retry Mechanism**: Automatic retry for transient failures
- **Graceful Degradation**: System continues to function even when components fail
- **User Feedback**: Appropriate error messages for different user roles

## Deployment and Configuration

The application is designed for flexible deployment:

- **Environment Variables**: Configuration via environment variables
- **Feature Flags**: Feature toggles for gradual rollout
- **Business Hours**: Configurable business hours for call operations
- **Twilio Integration**: Configurable Twilio account settings

## Development Workflow

The project follows a structured development workflow:

1. **Planning**: Create implementation plans in the `plans/` directory
2. **Service Implementation**: Develop core business logic in service modules
3. **API Development**: Create API endpoints in route handlers
4. **UI Implementation**: Build user interfaces with HTML, CSS, and JavaScript
5. **Testing**: Write unit and integration tests
6. **Documentation**: Update API and user documentation

## Getting Started

### Prerequisites

- Node.js (v14+)
- Twilio account with Voice capabilities
- Chrome browser (for extension)

### Server Setup

1. Navigate to the server directory:
   ```
   cd server
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Configure environment variables in `.env`:
   ```
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   PORT=3000
   SERVER_BASE_URL=http://localhost:3000
   ```

4. Initialize the database:
   ```
   node init-db.js
   ```

5. Start the server:
   ```
   npm start
   ```

### Chrome Extension Setup

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the root folder of this project
4. The extension should now appear in your Chrome toolbar

## Usage

### Agent Dashboard

1. Log in with agent credentials (default: username: `agent`, password: `agent123`)
2. Set your status to "Available" to receive calls
3. Use the dialer to make outbound calls
4. Process calls from the queue
5. View your call history

### Admin Dashboard

1. Log in with admin credentials (default: username: `admin`, password: `admin123`)
2. Monitor agent status and activity
3. Manage the call queue
4. Create and edit workflows
5. Configure contact centers and campaigns

### Workflow Builder

1. Create a new workflow or edit an existing one
2. Add steps (call, wait, condition, SMS, etc.)
3. Configure step properties and connections
4. Set business hours constraints
5. Save and activate the workflow

## Testing

Run the test suite:
```
cd server
npm test
```

## Architecture Decisions

### 1. Service-Oriented Architecture

The application uses a service-oriented architecture with clear separation of concerns:

- **Data Layer**: Memory store provides data access
- **Service Layer**: Business logic encapsulated in service modules
- **API Layer**: Express routes handle HTTP requests
- **UI Layer**: HTML/CSS/JS for user interfaces

This approach makes the code more maintainable and testable, with each service having a specific responsibility.

### 2. In-Memory Store with Persistence Option

The system uses an in-memory data store for simplicity and performance, with the option to persist data to a database. This hybrid approach provides flexibility while maintaining good performance.

### 3. Workflow Engine Design

The workflow engine is designed to be:

- **Extensible**: New step types can be added easily
- **Declarative**: Workflows are defined as data structures
- **Stateless**: Workflow state is stored in the database
- **Resilient**: Failures in one workflow don't affect others

### 4. Error Handling Strategy

The comprehensive error handling strategy includes:

- **Centralized Logging**: All errors go through the error service
- **Retry Mechanism**: Automatic retry with exponential backoff
- **Failure Categorization**: Errors are categorized for better handling
- **Feature Flags**: Gradual rollout of new features

### 5. Agent Status System

The agent status system is designed to:

- **Enforce Valid Transitions**: Prevent invalid status changes
- **Automate Status Changes**: Handle automatic transitions
- **Track Status Duration**: Monitor time spent in each status
- **Notify Agents**: Alert agents about status-related events