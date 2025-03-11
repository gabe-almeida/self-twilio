// Background script for the Twilio Dialer extension
// Runs as a service worker in Manifest V3

// Background state
let state = {
  isInitialized: false,
  hasActiveCall: false,
  incomingCall: null,
  callStatus: 'idle', // 'idle', 'connecting', 'connected', 'incoming'
};

// Handle extension installation or update
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed/updated:', details.reason);
  
  // Initialize default settings on install
  if (details.reason === 'install') {
    // Set default caller ID
    chrome.storage.local.set({
      callerIds: ['+19788785223'],
      selectedCallerId: '+19788785223',
    });
    
    // Load configuration
    fetch(chrome.runtime.getURL('config/config.json'))
      .then(response => response.json())
      .then(config => {
        // Store config in global variable for access from other parts of the extension
        window.CONFIG = config;
        
        // Show the onboarding page
        chrome.tabs.create({
          url: `${config.SERVER_URL}/onboarding`,
        });
      })
      .catch(error => {
        console.error('Error loading configuration:', error);
        // Fallback to a default URL if config can't be loaded
        chrome.tabs.create({
          url: 'http://localhost:3000/onboarding',
        });
      });
  }
});

// Handle messages from the popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  // Handle different message types
  switch (request.action) {
    case 'ping':
      // Simple ping to check if background is running
      sendResponse({ success: true });
      break;
      
    case 'getState':
      // Return the current state
      sendResponse({ success: true, state });
      break;
      
    case 'updateState':
      // Update the background state
      if (request.state) {
        state = { ...state, ...request.state };
        sendResponse({ success: true, state });
      } else {
        sendResponse({ success: false, error: 'Invalid state update' });
      }
      break;
      
    case 'showNotification':
      // Show a Chrome notification
      showNotification(request.title, request.message, request.options);
      sendResponse({ success: true });
      break;
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
  
  // Return true to indicate we will send a response asynchronously
  return true;
});

/**
 * Show a Chrome notification
 * @param {string} title - The notification title
 * @param {string} message - The notification message
 * @param {Object} options - Additional notification options
 */
function showNotification(title, message, options = {}) {
  const notificationOptions = {
    type: 'basic',
    iconUrl: '../assets/icons/icon128.png',
    title,
    message,
    priority: 2,
    ...options,
  };
  
  chrome.notifications.create('', notificationOptions, (notificationId) => {
    console.log('Notification created with ID:', notificationId);
    
    // Handle notification click if needed
    if (options.onClick) {
      chrome.notifications.onClicked.addListener((clickedId) => {
        if (clickedId === notificationId) {
          options.onClick();
        }
      });
    }
  });
}

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  console.log('Notification button clicked:', notificationId, buttonIndex);
  
  // Check if it's an incoming call notification
  if (state.callStatus === 'incoming' && state.incomingCall) {
    // Button index 0 is Answer, 1 is Decline
    if (buttonIndex === 0) {
      // Open the popup to answer the call
      chrome.action.openPopup();
    } else if (buttonIndex === 1) {
      // Decline the call without opening the popup
      state.callStatus = 'idle';
      state.incomingCall = null;
    }
  }
});

// Listen for browser shutdown to clean up if needed
chrome.runtime.onSuspend.addListener(() => {
  console.log('Extension being suspended');
  // Perform any cleanup needed before the extension is unloaded
});

console.log('Twilio Dialer background script loaded');