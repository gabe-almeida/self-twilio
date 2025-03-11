/**
 * Dialer Interface End-to-End Tests
 * 
 * These tests validate the critical user flows in the agent dialer interface,
 * focusing on the core call handling functionality.
 */

const puppeteer = require('puppeteer');

describe('Dialer Interface', () => {
  let browser;
  let page;
  
  beforeAll(async () => {
    browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
    
    // Set a larger viewport for better visibility
    await page.setViewport({ width: 1280, height: 800 });
    
    // Set default navigation timeout
    page.setDefaultNavigationTimeout(10000);
    
    // Mock agent user in localStorage for testing
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('token', 'fake-jwt-token');
      localStorage.setItem('user', JSON.stringify({
        id: 2,
        username: 'agent',
        full_name: 'Test Agent',
        email: 'agent@example.com',
        role: 'agent'
      }));
    });
  });
  
  afterAll(async () => {
    await browser.close();
  });
  
  // Helper functions
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  const mockFetchResponse = async (url, response) => {
    await page.setRequestInterception(true);
    page.once('request', request => {
      if (request.url().includes(url)) {
        request.respond(response);
      } else {
        request.continue();
      }
    });
  };
  
  const takeScreenshot = async (name) => {
    const path = `tests/screenshots/${name}-${Date.now()}.png`;
    await page.screenshot({ path });
    return path;
  };
  
  describe('Dialer Loading', () => {
    it('should load the dialer interface for authenticated agent', async () => {
      // Navigate to the dialer page
      await page.goto('http://localhost:3000/dialer.html');
      
      // Wait for dialer interface to load
      await page.waitForSelector('.dialer-container');
      
      // Verify agent name is displayed
      const agentName = await page.$eval('.agent-info .name', el => el.textContent);
      expect(agentName).to.include('Test Agent');
      
      // Verify call controls are present
      const callButton = await page.$('.call-button');
      const hangupButton = await page.$('.hangup-button');
      
      expect(callButton).not.to.be.null;
      expect(hangupButton).not.to.be.null;
      
      // Take screenshot for verification
      await takeScreenshot('dialer-loaded');
    });
  });
  
  describe('Agent Status', () => {
    it('should allow agent to change status', async () => {
      // Mock the API response for status change
      await mockFetchResponse('/api/agent-status', {
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          success: true, 
          status: 'Available',
          user_id: 2
        })
      });
      
      // Click on status dropdown
      await page.click('.agent-status-selector');
      
      // Wait for dropdown to open
      await wait(500);
      
      // Select "Available" status
      await page.click('.status-option[data-status="Available"]');
      
      // Wait for status to update
      await wait(500);
      
      // Verify status was updated in UI
      const statusText = await page.$eval('.agent-status', el => el.textContent);
      expect(statusText).to.include('Available');
      
      // Take screenshot for verification
      await takeScreenshot('agent-status-available');
    });
  });
  
  describe('Call Handling', () => {
    it('should display incoming call notification', async () => {
      // Mock an incoming call event via WebSocket
      await page.evaluate(() => {
        // Create a custom event to simulate incoming call
        const incomingCallEvent = new CustomEvent('incomingCall', {
          detail: {
            callSid: 'CA123456789',
            from: '+15551234567',
            to: '+15559876543',
            callerName: 'John Doe',
            callType: 'inbound'
          }
        });
        // Dispatch the event
        window.dispatchEvent(incomingCallEvent);
      });
      
      // Wait for call notification to appear
      await page.waitForSelector('.incoming-call-notification');
      
      // Verify caller information is displayed
      const callerInfo = await page.$eval('.caller-info', el => el.textContent);
      expect(callerInfo).to.include('John Doe');
      expect(callerInfo).to.include('+15551234567');
      
      // Verify answer and reject buttons are present
      const answerButton = await page.$('.answer-call-button');
      const rejectButton = await page.$('.reject-call-button');
      
      expect(answerButton).not.to.be.null;
      expect(rejectButton).not.to.be.null;
      
      // Take screenshot for verification
      await takeScreenshot('incoming-call');
    });
    
    it('should handle outbound call initiation', async () => {
      // Mock API responses for making an outbound call
      await mockFetchResponse('/api/voice/outbound', {
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          success: true, 
          callSid: 'CA987654321'
        })
      });
      
      // Enter phone number in dialer
      await page.type('#phone-number-input', '5551234567');
      
      // Click call button
      await page.click('.call-button');
      
      // Wait for call status to update
      await page.waitForSelector('.call-status.connecting');
      
      // Verify call status is displayed
      const callStatus = await page.$eval('.call-status', el => el.textContent);
      expect(callStatus).to.include('Connecting');
      
      // Verify call timer starts
      await page.waitForSelector('.call-timer');
      
      // Verify hangup button is enabled during call
      const hangupButton = await page.$('.hangup-button:not([disabled])');
      expect(hangupButton).not.to.be.null;
      
      // Take screenshot for verification
      await takeScreenshot('outbound-call');
    });
    
    it('should handle call hangup', async () => {
      // Mock API responses for hanging up a call
      await mockFetchResponse('/api/voice/hangup', {
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          success: true
        })
      });
      
      // Click hangup button
      await page.click('.hangup-button');
      
      // Wait for call status to update
      await page.waitForSelector('.call-status.idle', { timeout: 2000 });
      
      // Verify call status is updated
      const callStatus = await page.$eval('.call-status', el => el.textContent);
      expect(callStatus).to.include('Idle');
      
      // Verify call timer is hidden
      const callTimer = await page.$('.call-timer');
      expect(callTimer).to.be.null;
      
      // Take screenshot for verification
      await takeScreenshot('call-ended');
    });
  });
  
  describe('Disposition Form', () => {
    it('should display disposition form after call ends', async () => {
      // Mock call ending event
      await page.evaluate(() => {
        // Create a custom event to simulate call ending
        const callEndedEvent = new CustomEvent('callEnded', {
          detail: {
            callSid: 'CA987654321',
            duration: 120,
            direction: 'outbound',
            phoneNumber: '+15551234567',
            contactName: 'John Doe'
          }
        });
        // Dispatch the event
        window.dispatchEvent(callEndedEvent);
      });
      
      // Wait for disposition form to appear
      await page.waitForSelector('.disposition-form');
      
      // Verify call details are displayed in the form
      const callDetails = await page.$eval('.call-details', el => el.textContent);
      expect(callDetails).to.include('John Doe');
      expect(callDetails).to.include('+15551234567');
      
      // Select a disposition
      await page.click('.disposition-option[value="completed"]');
      
      // Add notes
      await page.type('.call-notes-textarea', 'Customer is interested in the premium plan. Follow up next week.');
      
      // Mock API responses for submitting disposition
      await mockFetchResponse('/api/dispositions/submit', {
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          success: true
        })
      });
      
      // Submit disposition form
      await page.click('.submit-disposition-button');
      
      // Wait for form to close
      await wait(500);
      
      // Verify form is closed
      const dispositionForm = await page.$('.disposition-form');
      expect(dispositionForm).to.be.null;
      
      // Take screenshot for verification
      await takeScreenshot('disposition-submitted');
    });
  });
  
  describe('Call History', () => {
    it('should display call history with recent calls', async () => {
      // Mock API responses for call history
      await mockFetchResponse('/api/call-history', {
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          calls: [
            {
              id: 'hist-1',
              call_sid: 'CA987654321',
              phone_number: '+15551234567',
              contact_name: 'John Doe',
              direction: 'outbound',
              start_time: new Date(Date.now() - 600000).toISOString(),
              end_time: new Date(Date.now() - 480000).toISOString(),
              duration: 120,
              disposition: 'completed',
              notes: 'Customer is interested in the premium plan. Follow up next week.'
            },
            {
              id: 'hist-2',
              call_sid: 'CA123456789',
              phone_number: '+15559876543',
              contact_name: 'Jane Smith',
              direction: 'inbound',
              start_time: new Date(Date.now() - 3600000).toISOString(),
              end_time: new Date(Date.now() - 3300000).toISOString(),
              duration: 300,
              disposition: 'no-answer',
              notes: 'No answer, try again later'
            }
          ]
        })
      });
      
      // Click on history tab
      await page.click('.history-tab');
      
      // Wait for history to load
      await page.waitForSelector('.call-history-list');
      
      // Verify call history entries
      const historyItems = await page.$$('.call-history-item');
      expect(historyItems.length).to.be.at.least(2);
      
      // Verify first history item has correct information
      const firstItemText = await page.$eval('.call-history-item:first-child', el => el.textContent);
      expect(firstItemText).to.include('John Doe');
      expect(firstItemText).to.include('completed');
      
      // Click on a history item to view details
      await page.click('.call-history-item:first-child');
      
      // Wait for details to load
      await page.waitForSelector('.call-details-modal');
      
      // Verify details include notes
      const detailsText = await page.$eval('.call-details-modal', el => el.textContent);
      expect(detailsText).to.include('Customer is interested');
      
      // Take screenshot for verification
      await takeScreenshot('call-history');
    });
  });
});