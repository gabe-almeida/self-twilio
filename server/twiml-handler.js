// TwiML handler for Twilio Dialer Web App
const twilio = require('twilio');
const store = require('./memory-store');
const queueManager = require('./call-queue-manager');
const contactCenterService = require('./services/contact-center-service');
const agentStatusService = require('./services/agent-status-service');

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
  
  // Check if an agent ID is specified
  const agentId = params.agentId || params.agent_id;
  
  if (agentId) {
    // Route to a specific agent
    console.log(`Routing incoming call to agent ${agentId}`);
    
    twiml.dial({
      answerOnBridge: true,
      timeout: 60, // Give more time to answer
      callerId: from
    }).client(`agent-${agentId}`);
  } else {
    // No agent specified, check if this is for a contact center
    return contactCenterService.findContactCenterByPhoneNumber(to)
      .then(contactCenter => {
        if (contactCenter) {
          // This call is for a contact center
          console.log(`Incoming call to contact center: ${contactCenter.name}`);
          
          // Get available agents in this contact center
          return contactCenterService.getAvailableContactCenterAgents(contactCenter.id)
            .then(availableAgents => {
              if (availableAgents.length > 0) {
                // Ring all available agents
                console.log(`Ringing ${availableAgents.length} available agents in contact center ${contactCenter.name}`);
                
                const dial = twiml.dial({
                  answerOnBridge: true,
                  timeout: 60, // Give agents time to answer
                  callerId: from,
                  action: `${process.env.SERVER_BASE_URL || 'http://localhost:3000'}/voice/call-answered?contactCenterId=${contactCenter.id}`,
                  method: 'POST'
                });
                
                // Add each available agent to the dial
                availableAgents.forEach(agent => {
                  dial.client(`agent-${agent.user_id}`, {
                    statusCallbackEvent: ['answered'],
                    statusCallback: `${process.env.SERVER_BASE_URL || 'http://localhost:3000'}/voice/agent-answered?agentId=${agent.user_id}&contactCenterId=${contactCenter.id}`,
                    statusCallbackMethod: 'POST'
                  });
                });
                
                return twiml;
              } else {
                // No available agents, use the existing IVR flow
                twiml.say({ voice: 'alice' }, 'Welcome to our contact center. All agents are currently busy. Please wait or leave a message.');
                
                // Add a gather to allow caller to press keys
                const gather = twiml.gather({
                  numDigits: 1,
                  action: `${process.env.SERVER_BASE_URL || 'http://localhost:3000'}/voice/menu`,
                  method: 'POST',
                  timeout: 10
                });
                
                gather.say({ voice: 'alice' }, 'Press 1 to wait for the next available agent. Press 2 to leave a voicemail.');
                
                // If no input, try again
                twiml.redirect(`${process.env.SERVER_BASE_URL || 'http://localhost:3000'}/voice/incoming`);
                
                return twiml;
              }
            });
        } else {
          // Not for a contact center, use the existing IVR flow
          twiml.say({ voice: 'alice' }, 'Welcome to the Twilio Dialer. Please wait while we connect you to an agent.');
          
          // Add a gather to allow caller to press keys
          const gather = twiml.gather({
            numDigits: 1,
            action: `${process.env.SERVER_BASE_URL || 'http://localhost:3000'}/voice/menu`,
            method: 'POST',
            timeout: 10
          });
          
          gather.say({ voice: 'alice' }, 'Press 1 to speak with the next available agent. Press 2 to leave a voicemail.');
          
          // If no input, try again
          twiml.redirect(`${process.env.SERVER_BASE_URL || 'http://localhost:3000'}/voice/incoming`);
          
          return twiml;
        }
      })
      .catch(error => {
        console.error('Error handling incoming call:', error);
        
        // Fallback to the existing IVR flow
        twiml.say({ voice: 'alice' }, 'Welcome to the Twilio Dialer. Please wait while we connect you to an agent.');
        
        // Add a gather to allow caller to press keys
        const gather = twiml.gather({
          numDigits: 1,
          action: `${process.env.SERVER_BASE_URL || 'http://localhost:3000'}/voice/menu`,
          method: 'POST',
          timeout: 10
        });
        
        gather.say({ voice: 'alice' }, 'Press 1 to speak with the next available agent. Press 2 to leave a voicemail.');
        
        // If no input, try again
        twiml.redirect(`${process.env.SERVER_BASE_URL || 'http://localhost:3000'}/voice/incoming`);
        
        return twiml;
      });
  }
  
  return twiml;
}

/**
 * Handle voice menu selections
 * @param {Object} params - The request parameters from Twilio
 * @returns {Object} - The TwiML response
 */
function handleVoiceMenu(params) {
  const twiml = new twilio.twiml.VoiceResponse();
  const digits = params.Digits;
  
  if (digits === '1') {
    // Connect to an available agent
    twiml.say({ voice: 'alice' }, 'Connecting you to the next available agent. Please wait.');
    
    // In a real implementation, you would query for available agents and route accordingly
    // For now, we'll just connect to the default client
    twiml.dial({
      answerOnBridge: true,
      timeout: 60,
      callerId: params.From
    }).client('twilio-dialer-user');
  } else if (digits === '2') {
    // Record a voicemail
    twiml.say({ voice: 'alice' }, 'Please leave a message after the tone. Press pound when finished.');
    
    twiml.record({
      action: `${process.env.SERVER_BASE_URL || 'http://localhost:3000'}/voice/voicemail`,
      method: 'POST',
      maxLength: 120,
      finishOnKey: '#',
      transcribe: true,
      transcribeCallback: `${process.env.SERVER_BASE_URL || 'http://localhost:3000'}/voice/transcription`
    });
    
    twiml.say({ voice: 'alice' }, 'No message recorded. Goodbye.');
  } else {
    // Invalid option
    twiml.say({ voice: 'alice' }, 'Sorry, that\'s not a valid option.');
    twiml.redirect(`${process.env.SERVER_BASE_URL || 'http://localhost:3000'}/voice/incoming`);
  }
  
  return twiml;
}

/**
 * Handle voicemail recordings
 * @param {Object} params - The request parameters from Twilio
 * @returns {Object} - The TwiML response
 */
function handleVoicemail(params) {
  const twiml = new twilio.twiml.VoiceResponse();
  
  // Get the recording URL
  const recordingUrl = params.RecordingUrl;
  
  if (recordingUrl) {
    console.log(`Voicemail recorded: ${recordingUrl}`);
    
    // In a real implementation, you would save this to your database
    // and notify agents of the new voicemail
    
    twiml.say({ voice: 'alice' }, 'Thank you for your message. An agent will get back to you soon. Goodbye.');
  } else {
    twiml.say({ voice: 'alice' }, 'No message recorded. Goodbye.');
  }
  
  return twiml;
}

/**
 * Handle outgoing voice calls - works with both browser-initiated and server-initiated calls
 * @param {Object} params - The request parameters from Twilio
 * @returns {Object} - The TwiML response
 */
function handleOutgoingCall(params) {
  const twiml = new twilio.twiml.VoiceResponse();
  
  console.log('==================== TWIML HANDLER: OUTGOING CALL ====================');
  console.log('Timestamp:', new Date().toISOString());
  
  // Log complete request parameters for debugging
  console.log('Outgoing call request params:', JSON.stringify(params, null, 2));
  
  // Extract parameters from various sources, including inside params object
  let to = params.To || params.to ||
           (params.params && (params.params.To || params.params.to)) ||
           (params.Digits ? params.Digits : '');
  const from = params.From || params.from ||
               (params.params && (params.params.From || params.params.from)) ||
               params.callerId || process.env.DEFAULT_CALLER_ID || '+19788785223';
  
  // Add detailed logging for debugging
  console.log('==================== PARAMETER EXTRACTION ====================');
  console.log(`Extracted destination number: "${to}"`);
  console.log(`Extracted from number: "${from}"`);
  
  // Log all possible parameter locations
  console.log('Parameter locations:');
  console.log(`- params.To: ${params.To || 'undefined'}`);
  console.log(`- params.to: ${params.to || 'undefined'}`);
  console.log(`- params.params?.To: ${params.params?.To || 'undefined'}`);
  console.log(`- params.params?.to: ${params.params?.to || 'undefined'}`);
  console.log(`- params.Digits: ${params.Digits || 'undefined'}`);
  
  console.log(`- params.From: ${params.From || 'undefined'}`);
  console.log(`- params.from: ${params.from || 'undefined'}`);
  console.log(`- params.params?.From: ${params.params?.From || 'undefined'}`);
  console.log(`- params.params?.from: ${params.params?.from || 'undefined'}`);
  console.log(`- params.callerId: ${params.callerId || 'undefined'}`);
  
  // Log the entire params object structure
  console.log('Full params object structure:');
  const logObjectStructure = (obj, prefix = '') => {
    if (!obj) return;
    Object.entries(obj).forEach(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value === null) {
        console.log(`- ${path}: null`);
      } else if (typeof value === 'object') {
        console.log(`- ${path}: [Object]`);
        logObjectStructure(value, path);
      } else {
        console.log(`- ${path}: ${typeof value === 'string' ? `"${value}"` : value}`);
      }
    });
  };
  logObjectStructure(params);
  
  // If destination number is missing, log a clear error
  if (!to) {
    console.error('==================== DESTINATION NUMBER MISSING ====================');
    console.error('[ERROR] Missing destination number in outgoing call request');
    console.error('[ERROR] Parameters received:', JSON.stringify(params));
    
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
    
    extractNumbers(params);
    
    if (potentialNumbers.length > 0) {
      console.log('Potential phone numbers found in request:', potentialNumbers);
      
      // Try to use the first potential number found
      const firstNumber = potentialNumbers[0].value;
      console.log(`Using potential number: ${firstNumber}`);
      
      // Update the 'to' variable
      to = firstNumber;
    } else {
      // Create an error response
      twiml.say({ voice: 'alice' }, 'Error: Missing destination number');
      return twiml;
    }
  }
  const callId = params.CallSid || 'unknown';
  const agentId = params.agentId || params.agent_id;
  const callQueueId = params.callQueueId || params.call_queue_id;
  
  // Add detailed diagnostic information
  console.log(`Handling outgoing call [${callId}] - To: ${to}, From: ${from}`);
  console.log('Call direction:', params.Direction || 'unknown');
  console.log('Client name:', params.ClientName || params.client || 'unknown');
  console.log('Call status:', params.CallStatus || 'unknown');
  console.log('Agent ID:', agentId || 'none');
  console.log('Call Queue ID:', callQueueId || 'none');
  
  try {
    // Check if this is a call from the browser client
    if (params.ClientName || params.client || params.Caller && params.Caller.startsWith('client:')) {
      console.log(`Call [${callId}]: Browser-initiated call, connecting to destination`);
      
      // Create a dial verb that connects the browser to the destination number
      // For browser-initiated calls, use the callerId parameter instead of 'from'
      // since 'from' will be the client identifier (e.g., 'client:twilio-dialer-user')
      const dial = twiml.dial({
        callerId: params.callerId || process.env.DEFAULT_CALLER_ID || '+19788785223',
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
    // Check if this is a call that needs to be connected to a specific agent
    else if (agentId) {
      console.log(`Call [${callId}]: Connecting call to agent ${agentId}`);
      
      // Connect the call to the specified agent
      const dial = twiml.dial({
        answerOnBridge: true,
        callerId: from,
        timeout: 60, // Longer timeout to allow browser to connect
        action: `${process.env.SERVER_BASE_URL || 'http://localhost:3000'}/voice/call-ended?callId=${callId}&agentId=${agentId}&callQueueId=${callQueueId || ''}`,
        method: 'POST'
      });
      
      // Connect to the agent's client
      dial.client(`agent-${agentId}`);
      
      console.log(`Call [${callId}]: Connecting to agent-${agentId}`);
    }
    // Default case - connect to the default client
    else {
      console.log(`Call [${callId}]: Connecting call to default client`);
      
      // This is the key part - connect the incoming call to the browser client
      const dial = twiml.dial({
        answerOnBridge: true,
        callerId: from,
        timeout: 60 // Longer timeout to allow browser to connect
      });
      
      // Connect to the browser client
      dial.client('twilio-dialer-user');
      
      console.log(`Call [${callId}]: Connecting to default client`);
    }
    
    return twiml;
  } catch (error) {
    console.error(`Call [${callId}]: Error generating dial instructions:`, error);
    twiml.say({ voice: 'alice' }, 'There was an error processing your call. Please try again.');
    return twiml;
  }
}

/**
 * Handle call ended events
 * @param {Object} params - The request parameters from Twilio
 * @returns {Object} - The TwiML response
 */
function handleCallEnded(params) {
  const twiml = new twilio.twiml.VoiceResponse();
  const callId = params.callId;
  const agentId = params.agentId;
  const callQueueId = params.callQueueId;
  const callStatus = params.DialCallStatus;
  const callDuration = params.DialCallDuration;
  
  console.log(`Call ${callId} ended with status: ${callStatus}`);
  console.log('Call duration:', callDuration, 'seconds');
  
  // If this was a queued call, update the queue
  if (callQueueId) {
    console.log(`Updating call queue entry ${callQueueId}`);
    
    // In a real implementation, you would update the call queue entry
    // with the call result and duration
    store.callQueue.complete(callQueueId, {
      duration: callDuration,
      status: callStatus
    }).catch(err => {
      console.error(`Error updating call queue entry ${callQueueId}:`, err);
    });
  }
  
  // If this was an agent call, update the agent status
  if (agentId) {
    console.log(`Updating agent ${agentId} status after call`);
    
    // Set the agent to "After Call Work" status
    // The agent-status-service will automatically transition back to Available after the configured timeout
    agentStatusService.updateAgentStatus(agentId, agentStatusService.AgentStatuses.AFTER_CALL_WORK).catch(err => {
      console.error(`Error updating agent ${agentId} status:`, err);
    });
  }
  
  return twiml;
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
  
  // Forward the status update to the queue manager
  queueManager.handleCallStatusUpdate(params).catch(err => {
    console.error(`Error handling call status update in queue manager:`, err);
  });
}

/**
 * Handle agent answered event for contact center calls
 * @param {Object} params - The request parameters from Twilio
 * @returns {Object} - The TwiML response
 */
function handleAgentAnswered(params) {
  const twiml = new twilio.twiml.VoiceResponse();
  const agentId = params.agentId;
  const contactCenterId = params.contactCenterId;
  const callSid = params.CallSid;
  
  console.log(`Agent ${agentId} answered call ${callSid} for contact center ${contactCenterId}`);
  
  // Update agent status to "Busy" (On Call)
  agentStatusService.updateAgentStatus(agentId, agentStatusService.AgentStatuses.BUSY).catch(err => {
    console.error(`Error updating agent ${agentId} status:`, err);
  });
  
  // In a real implementation, you would notify other agents that the call has been answered
  // This could be done through a WebSocket connection or by updating a shared state
  
  return twiml;
}

/**
 * Handle call answered event for contact center calls
 * @param {Object} params - The request parameters from Twilio
 * @returns {Object} - The TwiML response
 */
function handleCallAnswered(params) {
  const twiml = new twilio.twiml.VoiceResponse();
  const contactCenterId = params.contactCenterId;
  const callSid = params.CallSid;
  const dialCallStatus = params.DialCallStatus;
  const dialCallSid = params.DialCallSid;
  
  console.log(`Call ${callSid} for contact center ${contactCenterId} was ${dialCallStatus}`);
  
  // If the call was answered, we don't need to do anything special
  // If the call was not answered by any agent, we can redirect to voicemail
  if (dialCallStatus !== 'completed' && dialCallStatus !== 'answered') {
    console.log(`No agent answered the call ${callSid}, redirecting to voicemail`);
    
    twiml.say({ voice: 'alice' }, 'All agents are currently unavailable. Please leave a message after the tone.');
    
    twiml.record({
      action: `${process.env.SERVER_BASE_URL || 'http://localhost:3000'}/voice/voicemail?contactCenterId=${contactCenterId}`,
      method: 'POST',
      maxLength: 120,
      finishOnKey: '#',
      transcribe: true,
      transcribeCallback: `${process.env.SERVER_BASE_URL || 'http://localhost:3000'}/voice/transcription?contactCenterId=${contactCenterId}`
    });
    
    twiml.say({ voice: 'alice' }, 'No message recorded. Goodbye.');
  }
  
  return twiml;
}

module.exports = {
  handleIncomingCall,
  handleOutgoingCall,
  handleCallStatus,
  handleVoiceMenu,
  handleVoicemail,
  handleCallEnded,
  handleAgentAnswered,
  handleCallAnswered
};