// Main server for the Twilio Dialer Chrome extension
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
const tokenGenerator = require('./token-generator');
const twimlHandler = require('./twiml-handler');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Configure middleware
app.use(cors({
  origin: '*', // Allow all origins for development
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Add logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID || 'AC1ca93006ce71b64875e83739904abd75',
  process.env.TWILIO_AUTH_TOKEN || 'd3a025d142f7bf2dd173cb85c6c4e3b8'
);

// Log Twilio client initialization
console.log(`Initializing Twilio client with Account SID: ${process.env.TWILIO_ACCOUNT_SID || 'AC1ca93006ce71b64875e83739904abd75'}`);

// Verify the Twilio client is working
twilioClient.api.accounts(process.env.TWILIO_ACCOUNT_SID || 'AC1ca93006ce71b64875e83739904abd75')
  .fetch()
  .then(account => {
    console.log(`Successfully connected to Twilio account: ${account.friendlyName} (${account.status})`);
    console.log(`Account type: ${account.type}`);
  })
  .catch(error => {
    console.error('Error connecting to Twilio account:', error.message);
  });

// Serve static files from the public directory
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

// Log serving directory for debugging
console.log('Serving static files from:', path.join(__dirname, 'public'));

// Routes
app.get('/', (req, res) => {
  res.send('Twilio Dialer Server is running');
});

// Generate access token
app.post('/token', async (req, res) => {
  try {
    const { callerId } = req.body;
    const token = await tokenGenerator.generateToken(twilioClient, callerId);
    res.json({ token, ttl: 3600 });
  } catch (error) {
    console.error('Error generating token:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get available caller IDs
app.get('/caller-ids', async (req, res) => {
  try {
    // Try to get verified caller IDs from Twilio
    try {
      const outgoingCallerIds = await twilioClient.outgoingCallerIds.list();
      const verifiedNumbers = outgoingCallerIds.map(id => id.phoneNumber);
      console.log('Verified caller IDs:', verifiedNumbers);
      
      if (verifiedNumbers.length > 0) {
        return res.json(verifiedNumbers);
      }
    } catch (err) {
      console.error('Error fetching verified caller IDs:', err);
    }
    
    // Fallback to static list
    const callerIds = ['+19788785223']; 
    res.json(callerIds);
  } catch (error) {
    console.error('Error fetching caller IDs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Handle incoming voice calls
app.post('/voice/incoming', (req, res) => {
  try {
    const twiml = twimlHandler.handleIncomingCall(req.body);
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('Error handling incoming call:', error);
    res.status(500).json({ error: error.message });
  }
});

// Handle outgoing voice calls - This is the main endpoint for browser-initiated calls
app.post('/voice/outgoing', (req, res) => {
  try {
    console.log('Outgoing voice call request received:', req.body);
    const twiml = twimlHandler.handleOutgoingCall({
      ...req.body,
      connectToBrowser: true // Flag to indicate this is a browser-initiated call
    });
    
    console.log('Generated TwiML:', twiml.toString());
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('Error handling outgoing call:', error);
    res.status(500).json({ error: error.message });
  }
});

// Handle call ended
app.post('/voice/call-ended', (req, res) => {
  try {
    const { callId } = req.query;
    const callData = req.body;
    
    console.log(`Call ${callId} ended with status:`, callData.DialCallStatus);
    console.log('Call duration:', callData.DialCallDuration, 'seconds');
    
    const twiml = new twilio.twiml.VoiceResponse();
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('Error handling call ended:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new call
app.post('/api/calls', async (req, res) => {
  try {
    // Get the default caller ID from environment variables
    const defaultCallerId = process.env.DEFAULT_CALLER_ID || '+19788785223';
    console.log(`Using default caller ID: ${defaultCallerId}`);
    
    // Extract parameters from request
    const { to, from = defaultCallerId } = req.body;
    
    if (!to) {
      return res.status(400).json({ error: 'Destination number is required' });
    }
    
    console.log(`Making call from ${from} to ${to}`);
    
    // Format the destination number if needed
    let formattedNumber = to;
    if (!to.startsWith('+') && to.replace(/\D/g, '').length === 10) {
      formattedNumber = `+1${to.replace(/\D/g, '')}`;
    }
    
    // For WebRTC calls, we need to use a different approach
    // Instead of using TwiML directly, we'll use the Twilio Client approach
    
    // First, create a call to the destination number
    const callOptions = {
      to: formattedNumber,
      from: from,
      // Use the TwiML App to handle the call
      url: `${process.env.SERVER_BASE_URL || 'http://localhost:3000'}/voice/outgoing?to=${encodeURIComponent(formattedNumber)}`,
      statusCallback: `${process.env.SERVER_BASE_URL || 'http://localhost:3000'}/api/call-status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST'
    };
    
    console.log('Creating call with options:', JSON.stringify(callOptions, null, 2));
    
    console.log('Call options:', JSON.stringify(callOptions, null, 2));
    
    // Create the call using Twilio REST API
    const call = await twilioClient.calls.create(callOptions);
    
    console.log(`Call initiated with SID: ${call.sid}`);
    
    // Return call information to the client
    res.json({
      success: true,
      callId: call.sid,
      callSid: call.sid,
      status: call.status
    });
  } catch (error) {
    console.error('Error creating call:', error);
    res.status(500).json({
      error: error.message,
      success: false
    });
  }
});

// Cancel an active call
app.delete('/api/calls/:callSid', async (req, res) => {
  try {
    const { callSid } = req.params;
    
    if (!callSid) {
      return res.status(400).json({ error: 'Call SID is required' });
    }
    
    console.log(`Cancelling call with SID: ${callSid}`);
    const call = await twilioClient.calls(callSid)
      .update({ status: 'completed' });
    
    res.json({
      success: true,
      callSid: callSid,
      status: call.status
    });
  } catch (error) {
    console.error('Error cancelling call:', error);
    res.status(500).json({
      error: error.message,
      success: false
    });
  }
});

// Handle call status updates
app.post('/api/call-status', (req, res) => {
  try {
    // Use the new handler from twiml-handler.js
    twimlHandler.handleCallStatus(req.body);
    
    // Log more detailed status information for audio issues
    if (req.body.CallStatus === 'in-progress') {
      console.log('Active call details:', {
        callSid: req.body.CallSid,
        direction: req.body.Direction,
        fromNumber: req.body.From,
        toNumber: req.body.To,
        duration: req.body.CallDuration,
        audioCodec: req.body.MediaCodec,
        audioLevel: req.body.AudioLevel,
        jitter: req.body.Jitter,
        latency: req.body.Latency,
        packetLoss: req.body.PacketLoss
      });
    }
    
    res.status(200).send();
  } catch (error) {
    console.error('Error handling call status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Log call data
app.post('/log-call', (req, res) => {
  try {
    const callData = req.body;
    console.log('Call logged:', callData);
    res.json({ success: true });
  } catch (error) {
    console.error('Error logging call:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});