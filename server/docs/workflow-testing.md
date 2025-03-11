# Workflow Engine Testing Documentation

This document outlines the testing framework for the workflow engine component of the Twilio Dialer application. The tests are organized into three categories: unit tests, integration tests, and end-to-end tests.

## Test Categories

### 1. Unit Tests

Unit tests focus on testing individual components in isolation. The workflow manager unit tests verify that each function works correctly on its own.

**File**: `tests/workflow-manager.unit.test.js`

**Key Areas Tested**:
- Start/stop functionality
- Task scheduling and execution
- Context field access and condition evaluation
- Business hours functions
- Step execution logic
- Trigger processing

### 2. Integration Tests

Integration tests verify that different components work together correctly. These tests focus on the interaction between the workflow manager and call queue manager.

**File**: `tests/workflow-call-queue.integration.test.js`

**Key Areas Tested**:
- New lead processing
- Call step execution
- Call disposition handling
- End-to-end workflow execution
- Task scheduling with business hours
- Error handling and recovery

### 3. End-to-End Tests

End-to-end tests simulate real user interaction with the system through the API endpoints.

**File**: `tests/workflow-end-to-end.test.js`

**Key Areas Tested**:
- Authentication and authorization
- CRUD operations on workflows
- Workflow activation/deactivation
- Workflow execution through API
- Complete workflow lifecycle

## Running the Tests

### Installing Dependencies

Make sure all required testing dependencies are installed:

```bash
npm install --save-dev mocha chai sinon sinon-chai supertest
```

### Running All Tests

To run all tests, use the npm test command:

```bash
npm test
```

This will execute all test files in the `tests` directory.

### Running Specific Test Categories

To run specific test files:

```bash
# Run unit tests only
npx mocha tests/workflow-manager.unit.test.js

# Run integration tests only
npx mocha tests/workflow-call-queue.integration.test.js

# Run end-to-end tests only
npx mocha tests/workflow-end-to-end.test.js
```

## Test Configuration

The tests use the following tools and libraries:

- **Mocha**: Test runner
- **Chai**: Assertion library
- **Sinon**: Mocking and stubbing
- **Sinon-Chai**: Chai assertions for Sinon
- **Supertest**: HTTP assertions for API testing

## Mocking Strategy

The tests use a combination of mocking approaches:

1. **Sandbox**: Each test uses a Sinon sandbox to isolate mocks and stubs
2. **Store Mocking**: The in-memory store is mocked to avoid affecting real data
3. **Twilio Client**: The Twilio client is mocked to prevent real API calls
4. **Time Manipulation**: For time-dependent tests, Sinon's fake timers are used

## Test Data

Test data is created in each test suite to provide a controlled environment. This includes:

- Test workflows with different triggers and steps
- Mock call data
- Mock API requests

## Maintenance and Extending Tests

When adding new functionality to the workflow engine:

1. Add unit tests for new methods or functions
2. Update integration tests to verify interaction with other components
3. Add or update end-to-end tests to ensure the API works correctly

## Best Practices

1. **Isolation**: Ensure each test is isolated and doesn't depend on other tests
2. **Cleanup**: Always clean up resources in `afterEach` or `after` hooks
3. **Deterministic**: Avoid non-deterministic behavior like random values
4. **Readability**: Use descriptive test names and organize tests logically
5. **Coverage**: Aim for high test coverage, particularly for critical paths

## Common Issues and Solutions

- **Time-dependent tests**: Use Sinon's fake timers to control time
- **Async operations**: Use `async/await` and proper error handling
- **Database interactions**: Mock the store to avoid real database operations
- **JWT issues**: For end-to-end tests, ensure the JWT secret is consistent

## Continuous Integration

These tests can be integrated into a CI/CD pipeline to ensure code quality:

```yaml
# Example GitHub Actions workflow
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Use Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test