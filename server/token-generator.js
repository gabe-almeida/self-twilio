// Token generator for Twilio Dialer server
const twilio = require('twilio');

/**
 * Generate a Twilio access token for client authentication
 * @param {Object} twilioClient - The Twilio client instance
 * @param {string} callerId - The outgoing caller ID to use
 * @returns {string} - The access token
 */
function generateToken(twilioClient, callerId) {
  // Use the default caller ID from environment variables if not provided
  const defaultCallerId = process.env.DEFAULT_CALLER_ID || '+19788785223';
  callerId = callerId || defaultCallerId;
  
  // Clean the caller ID to ensure it's properly formatted
  callerId = callerId.replace(/[^+0-9]/g, '');
  
  console.log('Generating token with caller ID:', callerId);
  
  // Use API Key and Secret for better security
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKey = process.env.TWILIO_API_KEY;
  const apiSecret = process.env.TWILIO_API_SECRET;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;
  
  // Validate required credentials
  if (!accountSid || !apiKey || !apiSecret) {
    console.error('Missing required Twilio credentials');
    throw new Error('Missing required Twilio credentials. Please check your environment variables.');
  }
  
  console.log('Using API Key:', apiKey);
  
  console.log('Using credentials - AccountSid:', accountSid.substring(0, 10) + '...');
  
  try {
    // Create an access token
    const accessToken = new twilio.jwt.AccessToken(
      accountSid,
      apiKey,
      apiSecret,
      { ttl: 3600, identity: 'twilio-dialer-user' }
    );
    
    console.log('Access token created successfully');
    
    // Create a Voice grant for this token
    const voiceGrant = new twilio.jwt.AccessToken.VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true, // Allow this client to receive incoming calls
      outgoingAllow: true  // Allow this client to make outgoing calls
    });
    
    if (!twimlAppSid) {
      throw new Error('TwiML App SID is required for voice functionality');
    }
    
    // Get the server URL for endpoints
    const serverBaseUrl = process.env.SERVER_BASE_URL || 'http://localhost:3000';
    console.log('Server base URL:', serverBaseUrl);
    
    // Configure voice grant with all necessary parameters
    console.log('Configuring voice grant with TwiML App SID:', twimlAppSid);
    voiceGrant.outgoingApplicationParams = {
      // These params will be passed to the TwiML app
      callerId: callerId,
      applicationSid: twimlAppSid
    };
    
    // Log voice grant configuration
    console.log('Voice grant configuration:', {
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true,
      outgoingAllow: true,
      params: voiceGrant.outgoingApplicationParams
    });
    
    // Add the voice grant to the access token
    accessToken.addGrant(voiceGrant);
    console.log('Voice grant added to token');
    
    // Generate the token
    const token = accessToken.toJwt();
    console.log('Token generated successfully, length:', token.length);
    
    return token;
  } catch (error) {
    console.error('Error generating token:', error);
    throw error;
  }
}

module.exports = {
  generateToken,
};