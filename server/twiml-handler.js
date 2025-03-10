// TwiML handler for Twilio Dialer server
const twilio = require('twilio');

/**
 * Handle incoming voice calls
 * @param {Object} params - The request parameters from Twilio
 * @returns {Object} - The TwiML response
 */
function handleIncomingCall(params) {
  const twiml = new twilio.twiml.VoiceResponse();
  
  // Extract call parameters
  const from = params.From || '';
  const to = params.To || '';
  
  console.log(`Incoming call from ${from} to ${to}`);
  
  // Create a client for browser to answer
  twiml.dial({
    answerOnBridge: true,
    timeout: 60 // Give more time to answer
  }).client('twilio-dialer-user');
  
  return twiml;
}

/**
 * Handle outgoing voice calls - works with both browser-initiated and server-initiated calls
 * @param {Object} params - The request parameters from Twilio
 * @returns {Object} - The TwiML response
 */
function handleOutgoingCall(params) {
  const twiml = new twilio.twiml.VoiceResponse();
  
  // Log complete request parameters for debugging
  console.log('Outgoing call request params:', JSON.stringify(params, null, 2));
  
  // Extract parameters from various sources
  const to = params.To || params.to || (params.Digits ? params.Digits : '');
  const from = params.From || params.from || params.callerId || '+19788785223';
  const callId = params.CallSid || 'unknown';
  
  // Add detailed diagnostic information
  console.log(`Handling outgoing call [${callId}] - To: ${to}, From: ${from}`);
  console.log('Call direction:', params.Direction || 'unknown');
  console.log('Client name:', params.ClientName || params.client || 'unknown');
  console.log('Call status:', params.CallStatus || 'unknown');
  
  try {
    // Check if this is a call from the browser client
    if (params.ClientName || params.client || params.Caller === 'client:twilio-dialer-user') {
      console.log(`Call [${callId}]: Browser-initiated call, connecting to destination`);
      
      // Create a dial verb that connects the browser to the destination number
      const dial = twiml.dial({
        callerId: from,
        timeout: 60, // Longer timeout
        answerOnBridge: true,
        record: 'do-not-record',
        timeLimit: 14400,
        action: `${process.env.SERVER_BASE_URL || 'http://localhost:3000'}/voice/call-ended?callId=${callId}`,
        method: 'POST'
      });
      
      // Format the destination number
      let formattedNumber = to.replace(/[^\d+]/g, '');
      if (!formattedNumber.startsWith('+') && formattedNumber.length === 10) {
        formattedNumber = `+1${formattedNumber}`;
      }
      
      // Dial the destination number with additional parameters for better audio quality
      dial.number({
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallback: `${process.env.SERVER_BASE_URL || 'http://localhost:3000'}/api/call-status`,
        statusCallbackMethod: 'POST'
      }, formattedNumber);
      
      console.log(`Call [${callId}]: Dialing ${formattedNumber} from browser client with enhanced audio monitoring`);
    }
    // Check if this is a call that needs to be connected to the browser
    else {
      console.log(`Call [${callId}]: Connecting call to browser client`);
      
      // This is the key part - connect the incoming call to the browser client
      const dial = twiml.dial({
        answerOnBridge: true,
        callerId: from,
        timeout: 60 // Longer timeout to allow browser to connect
      });
      
      // Connect to the browser client
      dial.client('twilio-dialer-user');
      
      console.log(`Call [${callId}]: Connecting to browser client`);
    }
    
    return twiml;
  } catch (error) {
    console.error(`Call [${callId}]: Error generating dial instructions:`, error);
    twiml.say({ voice: 'alice' }, 'There was an error processing your call. Please try again.');
    return twiml;
  }
}

/**
 * Handle call status updates
 * @param {Object} params - The request parameters from Twilio
 */
function handleCallStatus(params) {
  const callSid = params.CallSid || 'unknown';
  const callStatus = params.CallStatus || 'unknown';
  const sequenceNumber = params.SequenceNumber || 0;
  
  console.log(`Call [${callSid}] Status Update #${sequenceNumber}: ${callStatus}`);
  
  // Log detailed call information for debugging audio issues
  if (params.CallStatus === 'in-progress') {
    console.log(`Call [${callSid}] Details:`, {
      direction: params.Direction,
      fromNumber: params.From,
      toNumber: params.To,
      duration: params.CallDuration,
      codecName: params.MediaCodec,
      warningCodes: params.WarningCodes || 'none'
    });
  }
  
  // Log any warning codes that might affect audio quality
  if (params.WarningCodes) {
    console.warn(`Call [${callSid}] Warnings:`, params.WarningCodes);
  }
}

module.exports = {
  handleIncomingCall,
  handleOutgoingCall,
  handleCallStatus,
};