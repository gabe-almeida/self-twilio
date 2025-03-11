/**
 * Login Flow End-to-End Tests
 * 
 * These tests simulate a real user interacting with the login page and validate
 * that the authentication flow works correctly, including redirects to appropriate
 * dashboards based on user roles.
 * 
 * Requirements:
 * - npm install --save-dev jest puppeteer jest-puppeteer
 * - Add to jest.config.js: preset: 'jest-puppeteer'
 */

const puppeteer = require('puppeteer');
const { expect } = require('chai');

describe('Login Flow End-to-End Tests', () => {
  let browser;
  let page;
  
  // Setup before tests
  beforeAll(async () => {
    // Launch browser in headless mode for CI environments
    // Use { headless: false } during development to see the browser
    browser = await puppeteer.launch({ 
      headless: 'new',  // Use new headless mode
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
    
    // Set viewport size
    await page.setViewport({ width: 1280, height: 800 });
    
    // Set default navigation timeout
    page.setDefaultNavigationTimeout(10000);
    
    // Clear localStorage to ensure clean state
    await page.evaluateOnNewDocument(() => {
      localStorage.clear();
    });
  });
  
  afterAll(async () => {
    await browser.close();
  });
  
  // Helper function to wait for a specific duration
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  it('should redirect to login page from index when not logged in', async () => {
    // Visit the index page
    await page.goto('http://localhost:3000/');
    
    // Click the login button
    await page.click('a.btn-primary');
    
    // Wait for navigation to complete
    await page.waitForNavigation();
    
    // Check if redirected to login page
    const url = page.url();
    expect(url).to.include('/login.html');
  });
  
  it('should show validation error when submitting empty form', async () => {
    // Go to login page
    await page.goto('http://localhost:3000/login.html');
    
    // Submit the form without entering credentials
    await page.click('button[type="submit"]');
    
    // Wait for error message to appear
    await page.waitForSelector('#error-message[style*="display: block"]');
    
    // Verify error message
    const errorMessage = await page.$eval('#error-message', el => el.textContent);
    expect(errorMessage).to.equal('Username and password are required');
  });
  
  it('should show error for invalid credentials', async () => {
    // Go to login page
    await page.goto('http://localhost:3000/login.html');
    
    // Fill in invalid credentials
    await page.type('#username', 'wronguser');
    await page.type('#password', 'wrongpassword');
    
    // Mock the fetch response for invalid credentials
    await page.setRequestInterception(true);
    page.once('request', request => {
      if (request.url().includes('/auth/login') && request.method() === 'POST') {
        request.respond({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Authentication failed' })
        });
      } else {
        request.continue();
      }
    });
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    // Wait for error message to appear
    await page.waitForSelector('#error-message[style*="display: block"]');
    
    // Verify error message
    const errorMessage = await page.$eval('#error-message', el => el.textContent);
    expect(errorMessage).to.equal('Authentication failed');
    
    // Disable request interception
    await page.setRequestInterception(false);
  });
  
  it('should redirect agent to dashboard after successful login', async () => {
    // Go to login page
    await page.goto('http://localhost:3000/login.html');
    
    // Fill in valid agent credentials
    await page.type('#username', 'agent');
    await page.type('#password', 'password');
    
    // Mock the fetch response for successful agent login
    await page.setRequestInterception(true);
    page.once('request', request => {
      if (request.url().includes('/auth/login') && request.method() === 'POST') {
        request.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Authentication successful',
            token: 'fake-jwt-token',
            user: {
              id: 2,
              username: 'agent',
              full_name: 'Test Agent',
              email: 'agent@example.com',
              role: 'agent'
            }
          })
        });
      } else {
        request.continue();
      }
    });
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    // Wait for redirect
    await wait(1000); // Give time for the JS to process and redirect
    
    // Verify localStorage was set correctly
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).to.equal('fake-jwt-token');
    
    const user = await page.evaluate(() => JSON.parse(localStorage.getItem('user')));
    expect(user.role).to.equal('agent');
    
    // Verify URL (cannot fully test redirect since we're mocking the response)
    // But we can verify the JS tried to redirect
    const redirectAttempt = await page.evaluate(() => window.location.href);
    expect(redirectAttempt).to.include('dashboard.html');
    
    // Disable request interception
    await page.setRequestInterception(false);
  });
  
  it('should redirect admin to admin dashboard after successful login', async () => {
    // Go to login page
    await page.goto('http://localhost:3000/login.html');
    
    // Fill in valid admin credentials
    await page.type('#username', 'admin');
    await page.type('#password', 'adminpassword');
    
    // Mock the fetch response for successful admin login
    await page.setRequestInterception(true);
    page.once('request', request => {
      if (request.url().includes('/auth/login') && request.method() === 'POST') {
        request.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Authentication successful',
            token: 'fake-admin-jwt-token',
            user: {
              id: 1,
              username: 'admin',
              full_name: 'Admin User',
              email: 'admin@example.com',
              role: 'admin'
            }
          })
        });
      } else {
        request.continue();
      }
    });
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    // Wait for redirect
    await wait(1000); // Give time for the JS to process and redirect
    
    // Verify localStorage was set correctly
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).to.equal('fake-admin-jwt-token');
    
    const user = await page.evaluate(() => JSON.parse(localStorage.getItem('user')));
    expect(user.role).to.equal('admin');
    
    // Verify URL (cannot fully test redirect since we're mocking the response)
    // But we can verify the JS tried to redirect
    const redirectAttempt = await page.evaluate(() => window.location.href);
    expect(redirectAttempt).to.include('admin.html');
    
    // Disable request interception
    await page.setRequestInterception(false);
  });
  
  it('should automatically redirect logged-in user from index page', async () => {
    // Set localStorage to simulate already logged in user
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-jwt-token');
      localStorage.setItem('user', JSON.stringify({
        id: 2,
        username: 'agent',
        full_name: 'Test Agent',
        email: 'agent@example.com',
        role: 'agent'
      }));
    });
    
    // Go to index page
    await page.goto('http://localhost:3000/index.html');
    
    // Wait for redirect
    await wait(1000);
    
    // Verify redirect attempt
    const redirectAttempt = await page.evaluate(() => window.location.href);
    expect(redirectAttempt).to.include('dashboard.html');
    
    // Clear localStorage
    await page.evaluate(() => localStorage.clear());
  });
  
  it('should redirect to admin dashboard for logged-in admin from index page', async () => {
    // Set localStorage to simulate already logged in admin
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-admin-jwt-token');
      localStorage.setItem('user', JSON.stringify({
        id: 1,
        username: 'admin',
        full_name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin'
      }));
    });
    
    // Go to index page
    await page.goto('http://localhost:3000/index.html');
    
    // Wait for redirect
    await wait(1000);
    
    // Verify redirect attempt
    const redirectAttempt = await page.evaluate(() => window.location.href);
    expect(redirectAttempt).to.include('admin.html');
    
    // Clear localStorage
    await page.evaluate(() => localStorage.clear());
  });
});