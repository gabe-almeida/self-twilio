# Test Execution Scripts

This document provides ready-to-use scripts for executing various types of tests in the Twilio Dialer application. These scripts are designed to be copied and pasted directly into your terminal to simplify the testing process.

## Prerequisites

Ensure you have installed all dependencies:

```bash
cd server
npm install
```

## Running Basic Tests

### Run All Tests

To run all tests in the application:

```bash
cd server
npm test
```

### Run Tests in Watch Mode

For development, you may want to run tests in watch mode which automatically reruns tests when files change:

```bash
cd server
npm run test:watch
```

### Generate Coverage Report

To generate a comprehensive coverage report:

```bash
cd server
npm run test:coverage
```

To view the coverage report, open `server/coverage/lcov-report/index.html` in your browser:

```bash
cd server
open coverage/lcov-report/index.html
```

## Targeting Specific Tests

### Run a Specific Test File

To run a single test file:

```bash
cd server
npm run test:file -- tests/error-service.test.js
```

Replace `tests/error-service.test.js` with the path to the test file you want to run.

### Run All Unit Tests

To run all unit tests (files ending with `.unit.test.js`):

```bash
cd server
npm run test:unit
```

### Run All Integration Tests

To run all integration tests (files ending with `.integration.test.js`):

```bash
cd server
npm run test:integration
```

### Run All End-to-End Tests

To run all end-to-end tests:

```bash
cd server
npm run test:e2e
```

Note: End-to-end tests require the server to be running. You can start the server in a separate terminal:

```bash
cd server
npm run dev
```

### Run Tests for a Specific Component

To run tests for a specific component or service:

```bash
# Test all services
cd server
npm run test:services

# Test a specific route
cd server
npx jest tests/routes/auth.test.js

# Test a specific service
cd server
npx jest tests/services/error-service.test.js
```

## Using Test Filters

### Run Tests with a Specific Name

To run only tests whose names match a pattern:

```bash
cd server
npx jest -t "should return 200" tests/routes/auth.test.js
```

This will run only test cases with "should return 200" in their description.

### Skip Certain Tests

To skip a group of tests temporarily:

```bash
cd server
npx jest --testPathIgnorePatterns="end-to-end"
```

This will run all tests except those in the end-to-end directory.

## Debugging Tests

### Run Tests with Verbose Output

For more detailed output:

```bash
cd server
npx jest --verbose tests/error-service.test.js
```

### Debug Tests with Node Inspector

To debug tests using Node's built-in debugger:

```bash
cd server
node --inspect-brk node_modules/.bin/jest --runInBand tests/error-service.test.js
```

Then open Chrome and navigate to `chrome://inspect` to access the debugger.

## CI/CD Integration

### Run Tests for CI Environment

For Continuous Integration environments:

```bash
cd server
npm test -- --ci --coverage --reporters=default --reporters=jest-junit
```

This generates output compatible with CI systems and creates a junit.xml report.

### Lint and Test

To ensure code quality before committing:

```bash
cd server
npm run lint && npm test
```

## Custom Testing Workflows

### Test and Auto-Fix Linting Issues

```bash
cd server
npm run lint -- --fix && npm test
```

### Test with Custom Environment Variables

```bash
cd server
NODE_ENV=test TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx TWILIO_AUTH_TOKEN=your_auth_token npm test
```

### Test with Memory Profiling

To identify memory leaks:

```bash
cd server
node --expose-gc node_modules/.bin/jest --runInBand --logHeapUsage tests/memory-intensive.test.js
```

## Frequently Used Test Combinations

### Quick Smoke Test

For a quick verification of critical functionality:

```bash
cd server
npx jest tests/simple.test.js tests/error-service.test.js tests/routes/auth.test.js
```

### Full Pre-Deployment Test Suite

Before deploying to production:

```bash
cd server
npm run lint && npm run test:coverage && npm run test:e2e
```

## Troubleshooting

### Clear Jest Cache

If you're experiencing strange behavior:

```bash
cd server
npx jest --clearCache
```

### Run a Single Test with Increased Timeout

For tests that take longer than the default timeout:

```bash
cd server
npx jest --testTimeout=30000 tests/slow-test.test.js
```

### Force Exit After Tests

If tests are hanging:

```bash
cd server
npx jest --forceExit
```

## Automated Test Scripts

For convenience, you can create executable scripts that combine multiple test commands. Here's an example shell script to run full test suite:

```bash
#!/bin/bash
# Save as run-tests.sh in the project root

# Change to server directory
cd server

# Clear cache
npx jest --clearCache

# Run linting
echo "Running linting..."
npm run lint

# Run unit and integration tests with coverage
echo "Running unit and integration tests..."
npm run test:coverage

# Run E2E tests if server is available
if curl -s http://localhost:3000 > /dev/null; then
  echo "Running E2E tests..."
  npm run test:e2e
else
  echo "Server not running, skipping E2E tests"
fi

echo "Tests completed!"
```

Make it executable:

```bash
chmod +x run-tests.sh
```

Then run it:

```bash
./run-tests.sh
```

## Conclusion

These script examples should help you efficiently execute tests as part of your development workflow. Choose the most appropriate command based on your current needs - whether you're developing a new feature, fixing a bug, or preparing for deployment.

For more details on the testing strategy and implementation, refer to:
- [Test Coverage Implementation Summary](./test-coverage-implementation-summary.md)
- [Local Test Implementation Guide](./local-test-implementation-guide.md)