/**
 * Test setup file for end-to-end browser tests
 * 
 * This file runs before end-to-end tests to set up the testing environment,
 * configure timeouts, and set up any global hooks needed for browser testing.
 */

// Set longer timeout for E2E tests since they involve actual browser interactions
jest.setTimeout(30000);

// Global state to store test artifacts like screenshots
global.testArtifacts = {
  screenshots: []
};

// Before all E2E tests
beforeAll(async () => {
  console.log('Starting E2E test suite...');
  
  // Any additional setup needed before running E2E tests
  // For example, you might want to start your server here if it's not already running
  // or set up a clean database state
});

// After all E2E tests
afterAll(async () => {
  console.log('E2E test suite completed');
  
  // Any cleanup needed after running all E2E tests
});

// Before each test
beforeEach(async () => {
  // Reset the test artifacts
  global.testArtifacts.screenshots = [];
  
  // Configure the browser for the test
  // These settings can be used in the tests via the global page object
  if (global.page) {
    // Set default navigation timeout (can be overridden in individual tests)
    await global.page.setDefaultNavigationTimeout(10000);
    
    // Set viewport size
    await global.page.setViewport({ width: 1280, height: 800 });
    
    // Clear localStorage and cookies before each test
    await global.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await global.page.deleteCookie(...(await global.page.cookies()));
  }
});

// After each test
afterEach(async () => {
  // Save a screenshot on test failure
  if (global.testFailed && global.page) {
    const screenshotPath = `screenshots/failure-${Date.now()}.png`;
    await global.page.screenshot({ path: screenshotPath });
    console.error(`Test failed, screenshot saved to ${screenshotPath}`);
  }
  
  // Additional test cleanup if needed
});

// Helper functions that can be used in E2E tests
global.helpers = {
  // Wait for a specific duration
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Take a named screenshot
  takeScreenshot: async (name) => {
    if (global.page) {
      const path = `screenshots/${name}-${Date.now()}.png`;
      await global.page.screenshot({ path });
      global.testArtifacts.screenshots.push(path);
      return path;
    }
    return null;
  }
};