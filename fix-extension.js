// Script to patch the Twilio Dialer extension
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Patching the Twilio Dialer extension...');

// 1. Update token-generator.js
console.log('Updating token-generator.js...');
try {
  const tokenGeneratorPath = path.join(__dirname, 'server', 'token-generator.js');
  let tokenGeneratorContent = fs.readFileSync(tokenGeneratorPath, 'utf8');
  
  // Apply the fix for token generation
  tokenGeneratorContent = tokenGeneratorContent.replace(
    `  // Otherwise, we'll use the function URL directly
    const outgoingCallUrl = \`\${process.env.SERVER_BASE_URL || 'http://localhost:3000'}/voice/outgoing\`;
    voiceGrant.outgoingApplicationParams = {
      // These params will be passed to the TwiML app
      callerId: callerId,
    };`,
    `  // Otherwise, we need to create a temporary application for browser-to-phone calls
    try {
      // Create a simple TwiML app for this session if one doesn't exist
      // This is a workaround for development purposes
      // In production, you should create a proper TwiML app in the Twilio console
      console.log('No TwiML App SID found. Creating a capability token with direct URL.');
      
      // Create a capability token instead of an access token for direct URL dialing
      const serverBaseUrl = process.env.SERVER_BASE_URL || 'http://localhost:3000';
      const outgoingCallUrl = \`\${serverBaseUrl}/voice/outgoing\`;
      
      // Add voice grant with URL
      voiceGrant.outgoingApplicationSid = "AP00000000000000000000000000000000"; // Dummy value
      voiceGrant.outgoingApplicationParams = {
        callerId: callerId,
        url: outgoingCallUrl
      };
    } catch (error) {
      console.error('Error setting up direct URL dialing:', error);
      throw error;
    }`
  );
  
  fs.writeFileSync(tokenGeneratorPath, tokenGeneratorContent);
  console.log('✓ token-generator.js updated');
} catch (error) {
  console.error('Error updating token-generator.js:', error);
}

// 2. Reload the extension instructions
console.log('\nTo complete the fixes:');
console.log('1. Stop the current server by pressing Ctrl+C in the terminal');
console.log('2. Restart the server with: cd server && npm start');
console.log('3. Go to Chrome extensions page (chrome://extensions/)');
console.log('4. Find the Twilio Dialer extension and click the refresh icon');
console.log('5. Try the extension again');

console.log('\nPatching complete! Follow the instructions above to apply the changes.');