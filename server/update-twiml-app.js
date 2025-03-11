// Script to update TwiML application configuration
require('dotenv').config();
const twilio = require('twilio');
const config = require('./config');

// Create Twilio client
const twilioClient = twilio(
  config.TWILIO.ACCOUNT_SID,
  config.TWILIO.AUTH_TOKEN
);

// Get the TwiML App SID from configuration
const twimlAppSid = config.TWILIO.TWIML_APP_SID;
const serverBaseUrl = config.SERVER_BASE_URL;

if (!twimlAppSid) {
  console.error('TWILIO_TWIML_APP_SID is not set in .env file');
  process.exit(1);
}

if (!serverBaseUrl) {
  console.error('SERVER_BASE_URL is not set in .env file');
  process.exit(1);
}

// Update the TwiML application with the ngrok URL
async function updateTwimlApp() {
  try {
    console.log(`Updating TwiML application ${twimlAppSid} with URL ${serverBaseUrl}/voice/outgoing`);
    
    // Update the TwiML application
    const app = await twilioClient.applications(twimlAppSid).update({
      voiceUrl: `${serverBaseUrl}/voice/outgoing`,
      voiceMethod: 'POST'
    });
    
    console.log(`TwiML application updated successfully: ${app.friendlyName}`);
    console.log(`Voice URL: ${app.voiceUrl}`);
    console.log(`Voice Method: ${app.voiceMethod}`);
    
    return app;
  } catch (error) {
    console.error('Error updating TwiML application:', error);
    throw error;
  }
}

// Run the update
updateTwimlApp()
  .then(() => {
    console.log('Update completed successfully');
  })
  .catch(error => {
    console.error('Update failed:', error);
    process.exit(1);
  });