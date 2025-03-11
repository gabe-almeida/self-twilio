/**
 * Jest configuration for end-to-end browser tests
 */

module.exports = {
  preset: 'jest-puppeteer',
  testEnvironment: 'node',
  testMatch: ['**/tests/end-to-end/**/*.test.js'],
  setupFilesAfterEnv: ['./tests/setup.e2e.js'],
  testTimeout: 30000,
  verbose: true
};