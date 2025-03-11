// Configuration settings for the Twilio Dialer extension

const CONFIG = {
  // Backend service URL - IMPORTANT: This must match your server URL
  SERVER_URL: 'https://89bd-2600-4040-5f87-5900-30cd-b863-962-b04c.ngrok-free.app',
  
  // Default caller ID
  DEFAULT_CALLER_ID: '+19788785223',
  
  // Twilio settings
  TWILIO: {
    // How often to refresh the token (in milliseconds)
    TOKEN_REFRESH_INTERVAL: 3600000, // 1 hour
    
    // TwiML App SID from console.twilio.com
    TWIML_APP_SID: 'AP813c95f0727252f9de71a194ad51f630',
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

// Log config for debugging
console.log('Twilio Dialer CONFIG loaded:', CONFIG);