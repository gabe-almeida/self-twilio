// Voice routes for Twilio Dialer Web App
const express = require('express');
const router = express.Router();
const twimlHandler = require('../twiml-handler');
const store = require('../memory-store');
const queueManager = require('../call-queue-manager');

// Handle incoming voice calls
router.post('/incoming', (req, res) => {
  try {
    const twiml = twimlHandler.handleIncomingCall(req.body);
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('Error handling incoming call:', error);
    res.status(500).json({ error: error.message });
  }
});

// Handle voice menu selections
router.post('/menu', (req, res) => {
  try {
    const twiml = twimlHandler.handleVoiceMenu(req.body);
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('Error handling voice menu:', error);
    res.status(500).json({ error: error.message });
  }
});

// Handle voicemail recordings
router.post('/voicemail', (req, res) => {
  try {
    const twiml = twimlHandler.handleVoicemail(req.body);
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('Error handling voicemail:', error);
    res.status(500).json({ error: error.message });
  }
});

// Handle outgoing voice calls
router.post('/outgoing', (req, res) => {
  try {
    console.log('==================== OUTGOING CALL REQUEST ====================');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Query params:', JSON.stringify(req.query, null, 2));
    
    // Log raw request data
    console.log('Raw request data:');
    console.log('- Content-Type:', req.get('Content-Type'));
    console.log('- Body keys:', Object.keys(req.body));
    
    // If params object exists, log its contents
    if (req.body.params) {
      console.log('Params object:', JSON.stringify(req.body.params, null, 2));
    }
    
    // Log all possible phone number locations
    console.log('PHONE NUMBER DEBUGGING:');
    console.log('- req.body.To:', req.body.To);
    console.log('- req.body.to:', req.body.to);
    console.log('- req.query.to:', req.query.to);
    console.log('- req.body.params?.To:', req.body.params?.To);
    console.log('- req.body.params?.to:', req.body.params?.to);
    
    // Log all properties that might contain a phone number
    console.log('ALL PROPERTIES THAT MIGHT CONTAIN A PHONE NUMBER:');
    const findPhoneNumbers = (obj, prefix = '') => {
      if (!obj || typeof obj !== 'object') return;
      
      Object.entries(obj).forEach(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        
        // Check if the value looks like a phone number
        if (typeof value === 'string' && /^\+?[0-9]{10,15}$/.test(value)) {
          console.log(`- ${path}: ${value}`);
        }
        
        // Recursively check nested objects
        if (value && typeof value === 'object') {
          findPhoneNumbers(value, path);
        }
      });
    };
    
    findPhoneNumbers(req.body);
    findPhoneNumbers(req.query);
    
    // Check for required parameters, including inside params object
    if (!req.body.To && !req.body.to && !req.query.to &&
        !(req.body.params && (req.body.params.To || req.body.params.to))) {
      console.error('MISSING DESTINATION NUMBER IN REQUEST');
      console.error('Request body:', JSON.stringify(req.body, null, 2));
      
      // Try to extract any potential phone number from the request
      const potentialNumbers = [];
      const extractNumbers = (obj) => {
        if (!obj) return;
        Object.entries(obj).forEach(([key, value]) => {
          if (typeof value === 'string' && /^\+?[0-9]{10,15}$/.test(value)) {
            potentialNumbers.push({ key, value });
          } else if (typeof value === 'object') {
            extractNumbers(value);
          }
        });
      };
      
      extractNumbers(req.body);
      extractNumbers(req.query);
      
      if (potentialNumbers.length > 0) {
        console.log('Potential phone numbers found in request:', potentialNumbers);
      }
      
      const twilio = require('twilio');
      const errorTwiml = new twilio.twiml.VoiceResponse();
      errorTwiml.say('Error: Missing destination number');
      res.type('text/xml');
      return res.send(errorTwiml.toString());
    }
    
    // Extract params from request body if present
    const params = req.body.params || {};
    
    const twiml = twimlHandler.handleOutgoingCall({
      ...req.body,
      ...req.query, // Include query parameters
      params, // Include params object
      connectToBrowser: true, // Flag to indicate this is a browser-initiated call
      debug: true // Enable extra debugging
    });
    
    console.log('Generated TwiML:', twiml.toString());
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('Error handling outgoing call:', error);
    // Return a proper TwiML response even on error
    const twilio = require('twilio');
    const errorTwiml = new twilio.twiml.VoiceResponse();
    errorTwiml.say(`Error processing call: ${error.message}`);
    res.type('text/xml');
    res.send(errorTwiml.toString());
  }
});

// Handle call ended
router.post('/call-ended', (req, res) => {
  try {
    const twiml = twimlHandler.handleCallEnded({
      ...req.body,
      ...req.query
    });
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('Error handling call ended:', error);
    res.status(500).json({ error: error.message });
  }
});

// Handle agent answered event for contact center calls
router.post('/agent-answered', (req, res) => {
  try {
    const twiml = twimlHandler.handleAgentAnswered({
      ...req.body,
      ...req.query
    });
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('Error handling agent answered event:', error);
    res.status(500).json({ error: error.message });
  }
});

// Handle call answered event for contact center calls
router.post('/call-answered', (req, res) => {
  try {
    const twiml = twimlHandler.handleCallAnswered({
      ...req.body,
      ...req.query
    });
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('Error handling call answered event:', error);
    res.status(500).json({ error: error.message });
  }
});

// Handle transcription callbacks
router.post('/transcription', async (req, res) => {
  try {
    const transcriptionText = req.body.TranscriptionText;
    const recordingUrl = req.body.RecordingUrl;
    const callSid = req.body.CallSid;
    
    console.log(`Transcription received for call ${callSid}:`, transcriptionText);
    console.log(`Recording URL: ${recordingUrl}`);
    
    // In a real implementation, you would save this to your database
    // and notify agents of the new voicemail with transcription
    
    res.status(200).send();
  } catch (error) {
    console.error('Error handling transcription:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate a token for client
router.post('/token', async (req, res) => {
  try {
    const tokenGenerator = require('../token-generator');
    const twilio = require('twilio');
    
    // Create Twilio client
    const twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    
    const { callerId } = req.body;
    const token = await tokenGenerator.generateToken(twilioClient, callerId);
    res.json({ token, ttl: 3600 });
  } catch (error) {
    console.error('Error generating token:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;