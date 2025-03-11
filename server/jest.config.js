/**
 * Jest configuration for unit and integration tests
 */

module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'services/**/*.js',
    'routes/**/*.js',
    '*.js',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!setup-ngrok.js',
    '!update-twiml-app.js',
    '!update-config.js',
    '!**/tests/**'
  ],
  coverageThreshold: {
    global: {
      statements: 75,
      branches: 70,
      functions: 80,
      lines: 75
    }
  },
  testMatch: ['**/__tests__/**/*.js', '**/tests/**/?(*.)+(spec|test).js'],
  setupFilesAfterEnv: ['./tests/setup.js'],
  verbose: true
};