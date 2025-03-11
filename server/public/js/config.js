/**
 * Client-side configuration that loads settings from the server
 * This ensures we only need to update the server URL in one place (.env file)
 */

// Configuration object
const CONFIG = {
  // Default values (will be overridden by server config)
  SERVER_URL: 'http://localhost:3000',
  DEFAULT_CALLER_ID: '+19788785223',
  
  // Twilio settings
  TWILIO: {
    // How often to refresh the token (in milliseconds)
    TOKEN_REFRESH_INTERVAL: 3600000, // 1 hour
  },
  
  // UI settings
  UI: {
    // How often to update the call duration display (in milliseconds)
    DURATION_UPDATE_INTERVAL: 1000, // 1 second
    
    // Show debug info by default
    SHOW_DEBUG: true
  },
  
  // Storage keys
  STORAGE: {
    TOKEN: 'twilioToken',
    CALLER_IDS: 'callerIds',
    CALL_HISTORY: 'callHistory',
  },
  
  // Enable verbose debugging
  DEBUG: true
};

// Function to load configuration from the server
async function loadServerConfig() {
  try {
    // Get the current script's URL to determine the server base URL
    const scriptElement = document.currentScript;
    const scriptUrl = scriptElement ? scriptElement.src : '';
    const serverUrl = scriptUrl.substring(0, scriptUrl.indexOf('/js/config.js'));
    
    // Set the server URL based on the script URL
    CONFIG.SERVER_URL = serverUrl;
    
    // Attempt to fetch additional configuration from the server
    try {
      const response = await fetch(`${CONFIG.SERVER_URL}/api/config`);
      if (response.ok) {
        const serverConfig = await response.json();
        
        // Update configuration with server values
        if (serverConfig.SERVER_BASE_URL) {
          CONFIG.SERVER_URL = serverConfig.SERVER_BASE_URL;
        }
        
        if (serverConfig.DEFAULT_CALLER_ID) {
          CONFIG.DEFAULT_CALLER_ID = serverConfig.DEFAULT_CALLER_ID;
        }
        
        console.log('Configuration loaded from server:', serverConfig);
      }
    } catch (error) {
      console.warn('Could not load server configuration, using defaults:', error);
    }
    
    // Log the final configuration
    console.log('Twilio Dialer CONFIG loaded:', CONFIG);
    
    // Dispatch an event to notify that config is loaded
    window.dispatchEvent(new CustomEvent('configLoaded', { detail: CONFIG }));
    
    return CONFIG;
  } catch (error) {
    console.error('Error loading configuration:', error);
    return CONFIG;
  }
}

// Load the configuration
const configPromise = loadServerConfig();

// Export the configuration
window.CONFIG = CONFIG;