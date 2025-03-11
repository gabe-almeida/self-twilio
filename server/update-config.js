// Script to update configuration files when the ngrok URL changes
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const config = require('./config');

// Get the server base URL from the config
const serverBaseUrl = config.SERVER_BASE_URL;

console.log(`Updating configuration files with server URL: ${serverBaseUrl}`);

// Update the extension's config.json file
const extensionConfigPath = path.join(__dirname, '..', 'config', 'config.json');
try {
  // Read the current config
  const extensionConfig = JSON.parse(fs.readFileSync(extensionConfigPath, 'utf8'));
  
  // Update the server URL
  extensionConfig.SERVER_URL = serverBaseUrl;
  
  // Write the updated config
  fs.writeFileSync(extensionConfigPath, JSON.stringify(extensionConfig, null, 2));
  console.log(`✅ Updated extension config at ${extensionConfigPath}`);
} catch (error) {
  console.error(`❌ Error updating extension config: ${error.message}`);
}

// Update the TwiML application
const updateTwimlApp = async () => {
  try {
    const twilio = require('twilio');
    
    // Create Twilio client
    const twilioClient = twilio(
      config.TWILIO.ACCOUNT_SID,
      config.TWILIO.AUTH_TOKEN
    );
    
    // Get the TwiML App SID from configuration
    const twimlAppSid = config.TWILIO.TWIML_APP_SID;
    
    console.log(`Updating TwiML application ${twimlAppSid} with URL ${serverBaseUrl}/voice/outgoing`);
    
    // Update the TwiML application
    const app = await twilioClient.applications(twimlAppSid).update({
      voiceUrl: `${serverBaseUrl}/voice/outgoing`,
      voiceMethod: 'POST'
    });
    
    console.log(`✅ TwiML application updated successfully: ${app.friendlyName}`);
    console.log(`Voice URL: ${app.voiceUrl}`);
    console.log(`Voice Method: ${app.voiceMethod}`);
  } catch (error) {
    console.error(`❌ Error updating TwiML application: ${error.message}`);
  }
};

// Run the TwiML app update
updateTwimlApp();

console.log('Configuration update completed');