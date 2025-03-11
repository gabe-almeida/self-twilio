// Central configuration file for server settings
require('dotenv').config();

// Export configuration values
module.exports = {
  // Server base URL (from .env file)
  SERVER_BASE_URL: process.env.SERVER_BASE_URL || 'http://localhost:3000',
  
  // Twilio configuration
  TWILIO: {
    ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWIML_APP_SID: process.env.TWILIO_TWIML_APP_SID,
    API_KEY: process.env.TWILIO_API_KEY,
    API_SECRET: process.env.TWILIO_API_SECRET
  },
  
  // Default caller ID
  DEFAULT_CALLER_ID: process.env.DEFAULT_CALLER_ID || '+19788785223',
  
  // Port for the server
  PORT: process.env.PORT || 3000
};