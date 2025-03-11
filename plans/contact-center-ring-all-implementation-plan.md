# Contact Center "Ring All" Feature Implementation Plan

This document outlines the implementation plan for adding a "ring all" feature to the contact center system, where incoming calls will ring for all available agents in a contact center and stop ringing for others when one agent answers.

## Overview

The current system has the following components:
- Agent status management (Available, Unavailable, Offline, Busy, After Call Work)
- Call queue management for outbound calls
- Twilio integration for voice calls
- Browser-based call handling UI

However, it lacks:
- Contact center grouping for agents
- Simultaneous ringing for multiple agents
- Multiple phone number management for inbound/outbound calls

## 1. Data Model Updates

### 1.1 Create Contact Center Model

First, we need to create a data model for contact centers:

```javascript
// server/models/contact-center.js
const contactCenterSchema = {
  id: 'string', // UUID
  name: 'string', // Display name
  description: 'string', // Optional description
  created_at: 'timestamp',
  updated_at: 'timestamp',
  active: 'boolean', // Whether the contact center is active
  settings: 'object' // JSON object for contact center settings
};

// Add to memory-store.js
store.contactCenters = {
  async getAll() {
    // Implementation
  },
  async getById(id) {
    // Implementation
  },
  async create(data) {
    // Implementation
  },
  async update(id, data) {
    // Implementation
  },
  async delete(id) {
    // Implementation
  }
};
```

### 1.2 Create Contact Center Agent Membership Model

Next, we need to associate agents with contact centers:

```javascript
// server/models/contact-center-agent.js
const contactCenterAgentSchema = {
  id: 'string', // UUID
  contact_center_id: 'string', // Reference to contact center
  user_id: 'string', // Reference to user/agent
  role: 'string', // Role within the contact center (agent, supervisor, admin)
  created_at: 'timestamp',
  updated_at: 'timestamp',
  active: 'boolean' // Whether the membership is active
};

// Add to memory-store.js
store.contactCenterAgents = {
  async getAll() {
    // Implementation
  },
  async getByContactCenterId(contactCenterId) {
    // Implementation
  },
  async getByUserId(userId) {
    // Implementation
  },
  async create(data) {
    // Implementation
  },
  async update(id, data) {
    // Implementation
  },
  async delete(id) {
    // Implementation
  }
};
```

### 1.3 Create Contact Center Phone Number Model

We need to manage multiple phone numbers for each contact center:

```javascript
// server/models/contact-center-phone.js
const contactCenterPhoneSchema = {
  id: 'string', // UUID
  contact_center_id: 'string', // Reference to contact center
  phone_number: 'string', // E.164 formatted phone number
  friendly_name: 'string', // Display name for the phone number
  direction: 'string', // 'inbound', 'outbound', or 'both'
  is_default: 'boolean', // Whether this is the default number for the contact center
  created_at: 'timestamp',
  updated_at: 'timestamp',
  active: 'boolean' // Whether the phone number is active
};

// Add to memory-store.js
store.contactCenterPhones = {
  async getAll() {
    // Implementation
  },
  async getByContactCenterId(contactCenterId) {
    // Implementation
  },
  async getByPhoneNumber(phoneNumber) {
    // Implementation
  },
  async create(data) {
    // Implementation
  },
  async update(id, data) {
    // Implementation
  },
  async delete(id) {
    // Implementation
  }
};
```

### 1.4 Update Agent Status Model

Extend the agent status model to include contact center information:

```javascript
// Update agent status schema in memory-store.js
const agentStatusSchema = {
  // Existing fields
  user_id: 'string',
  status: 'string',
  last_status_change: 'timestamp',
  
  // New fields
  available_for_calls: 'boolean', // Whether the agent is available to receive calls
  contact_center_ids: 'array' // Array of contact center IDs the agent is currently active in
};
```

## 2. Create Contact Center Service

### 2.1 Implement Contact Center Service

Create a service to manage contact centers:

```javascript
// server/services/contact-center-service.js
const store = require('../memory-store');
const errorService = require('./error-service');

class ContactCenterService {
  // Get all contact centers
  async getAllContactCenters() {
    try {
      return await store.contactCenters.getAll();
    } catch (error) {
      errorService.handleError(error, 'contact-center-service.getAllContactCenters');
      return [];
    }
  }
  
  // Get a contact center by ID
  async getContactCenterById(id) {
    try {
      return await store.contactCenters.getById(id);
    } catch (error) {
      errorService.handleError(error, 'contact-center-service.getContactCenterById');
      return null;
    }
  }
  
  // Create a new contact center
  async createContactCenter(data) {
    try {
      return await store.contactCenters.create({
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        active: true
      });
    } catch (error) {
      errorService.handleError(error, 'contact-center-service.createContactCenter');
      throw error;
    }
  }
  
  // Update a contact center
  async updateContactCenter(id, data) {
    try {
      return await store.contactCenters.update(id, {
        ...data,
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      errorService.handleError(error, 'contact-center-service.updateContactCenter');
      throw error;
    }
  }
  
  // Delete a contact center
  async deleteContactCenter(id) {
    try {
      return await store.contactCenters.delete(id);
    } catch (error) {
      errorService.handleError(error, 'contact-center-service.deleteContactCenter');
      throw error;
    }
  }
  
  // Get all agents in a contact center
  async getContactCenterAgents(contactCenterId) {
    try {
      const memberships = await store.contactCenterAgents.getByContactCenterId(contactCenterId);
      
      // Get full user details for each agent
      const agentDetails = [];
      for (const membership of memberships) {
        const user = await store.users.getById(membership.user_id);
        if (user) {
          agentDetails.push({
            ...user,
            role: membership.role,
            membership_id: membership.id,
            active: membership.active
          });
        }
      }
      
      return agentDetails;
    } catch (error) {
      errorService.handleError(error, 'contact-center-service.getContactCenterAgents');
      return [];
    }
  }
  
  // Get available agents in a contact center
  async getAvailableContactCenterAgents(contactCenterId) {
    try {
      const allAgents = await this.getContactCenterAgents(contactCenterId);
      const availableAgents = [];
      
      for (const agent of allAgents) {
        // Skip inactive memberships
        if (!agent.active) continue;
        
        // Get agent status
        const status = await store.agentStatus.getByUserId(agent.id);
        
        // Check if agent is available
        if (status && status.status === 'Available' && status.available_for_calls) {
          availableAgents.push({
            ...agent,
            status
          });
        }
      }
      
      return availableAgents;
    } catch (error) {
      errorService.handleError(error, 'contact-center-service.getAvailableContactCenterAgents');
      return [];
    }
  }
  
  // Add an agent to a contact center
  async addAgentToContactCenter(contactCenterId, userId, role = 'agent') {
    try {
      // Check if the agent is already in the contact center
      const existing = await store.contactCenterAgents.getByContactCenterId(contactCenterId);
      const alreadyMember = existing.some(m => m.user_id === userId);
      
      if (alreadyMember) {
        return { success: false, error: 'Agent is already a member of this contact center' };
      }
      
      // Add the agent to the contact center
      const result = await store.contactCenterAgents.create({
        contact_center_id: contactCenterId,
        user_id: userId,
        role,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        active: true
      });
      
      return { success: true, membership: result };
    } catch (error) {
      errorService.handleError(error, 'contact-center-service.addAgentToContactCenter');
      return { success: false, error: error.message };
    }
  }
  
  // Remove an agent from a contact center
  async removeAgentFromContactCenter(contactCenterId, userId) {
    try {
      // Find the membership
      const memberships = await store.contactCenterAgents.getByContactCenterId(contactCenterId);
      const membership = memberships.find(m => m.user_id === userId);
      
      if (!membership) {
        return { success: false, error: 'Agent is not a member of this contact center' };
      }
      
      // Delete the membership
      await store.contactCenterAgents.delete(membership.id);
      
      return { success: true };
    } catch (error) {
      errorService.handleError(error, 'contact-center-service.removeAgentFromContactCenter');
      return { success: false, error: error.message };
    }
  }
  
  // Get all phone numbers for a contact center
  async getContactCenterPhoneNumbers(contactCenterId) {
    try {
      return await store.contactCenterPhones.getByContactCenterId(contactCenterId);
    } catch (error) {
      errorService.handleError(error, 'contact-center-service.getContactCenterPhoneNumbers');
      return [];
    }
  }
  
  // Add a phone number to a contact center
  async addPhoneNumberToContactCenter(contactCenterId, phoneData) {
    try {
      // Format the phone number to E.164 if needed
      let formattedNumber = phoneData.phone_number;
      if (!formattedNumber.startsWith('+') && formattedNumber.replace(/\D/g, '').length === 10) {
        formattedNumber = `+1${formattedNumber.replace(/\D/g, '')}`;
      }
      
      // Check if this is the first number for this contact center
      const existing = await store.contactCenterPhones.getByContactCenterId(contactCenterId);
      const isDefault = existing.length === 0 ? true : !!phoneData.is_default;
      
      // If this is being set as default, unset any existing defaults
      if (isDefault) {
        for (const phone of existing) {
          if (phone.is_default) {
            await store.contactCenterPhones.update(phone.id, { is_default: false });
          }
        }
      }
      
      // Add the phone number
      const result = await store.contactCenterPhones.create({
        contact_center_id: contactCenterId,
        phone_number: formattedNumber,
        friendly_name: phoneData.friendly_name || formattedNumber,
        direction: phoneData.direction || 'both',
        is_default: isDefault,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        active: true
      });
      
      return { success: true, phone: result };
    } catch (error) {
      errorService.handleError(error, 'contact-center-service.addPhoneNumberToContactCenter');
      return { success: false, error: error.message };
    }
  }
  
  // Find contact center by phone number
  async findContactCenterByPhoneNumber(phoneNumber) {
    try {
      // Format the phone number to E.164 if needed
      let formattedNumber = phoneNumber;
      if (!formattedNumber.startsWith('+') && formattedNumber.replace(/\D/g, '').length === 10) {
        formattedNumber = `+1${formattedNumber.replace(/\D/g, '')}`;
      }
      
      // Find the phone number
      const phone = await store.contactCenterPhones.getByPhoneNumber(formattedNumber);
      
      if (!phone) {
        return null;
      }
      
      // Get the contact center
      return await store.contactCenters.getById(phone.contact_center_id);
    } catch (error) {
      errorService.handleError(error, 'contact-center-service.findContactCenterByPhoneNumber');
      return null;
    }
  }
}

module.exports = new ContactCenterService();
```

## 3. Implement Incoming Call Handling

### 3.1 Update TwiML Handler for Ring All

Modify the TwiML handler to support ringing all available agents in a contact center:

```javascript
// server/twiml-handler.js - Update handleIncomingCall function

const contactCenterService = require('./services/contact-center-service');

function handleIncomingCall(params) {
  const twiml = new twilio.twiml.VoiceResponse();
  
  // Extract call parameters
  const from = params.From || '';
  const to = params.To || '';
  
  console.log(`Incoming call from ${from} to ${to}`);
  
  // Check if a specific agent ID is specified
  const agentId = params.agentId || params.agent_id;
  
  if (agentId) {
    // Route to a specific agent (existing code)
    console.log(`Routing incoming call to agent ${agentId}`);
    
    twiml.dial({
      answerOnBridge: true,
      timeout: 60,
      callerId: from
    }).client(`agent-${agentId}`);
  } else {
    // No agent specified, check if this is for a contact center
    contactCenterService.findContactCenterByPhoneNumber(to)
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
                  dial.client(`agent-${agent.id}`, {
                    statusCallbackEvent: ['answered'],
                    statusCallback: `${process.env.SERVER_BASE_URL || 'http://localhost:3000'}/voice/agent-answered?agentId=${agent.id}&contactCenterId=${contactCenter.id}`,
                    statusCallbackMethod: 'POST'
                  });
                });
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
      });
  }
  
  return twiml;
}
```

### 3.2 Add Agent Answered Handler

Create a new route to handle when an agent answers a call:

```javascript
// server/routes/voice.js - Add new route

// Handle agent answered event
router.post('/agent-answered', (req, res) => {
  try {
    const agentId = req.query.agentId;
    const contactCenterId = req.query.contactCenterId;
    
    console.log(`Agent ${agentId} answered call for contact center ${contactCenterId}`);
    
    // Notify other agents that the call has been answered
    // This will be implemented in the real-time notification system
    
    res.status(200).send();
  } catch (error) {
    console.error('Error handling agent answered event:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### 3.3 Add Call Answered Handler

Create a new route to handle when a call is answered:

```javascript
// server/routes/voice.js - Add new route

// Handle call answered event
router.post('/call-answered', (req, res) => {
  try {
    const contactCenterId = req.query.contactCenterId;
    const dialCallStatus = req.body.DialCallStatus;
    const dialCallSid = req.body.DialCallSid;
    
    console.log(`Call for contact center ${contactCenterId} was ${dialCallStatus}`);
    
    // Generate TwiML response
    const twiml = new twilio.twiml.VoiceResponse();
    
    if (dialCallStatus === 'answered') {
      // Call was answered by an agent, nothing more to do
      console.log(`Call ${dialCallSid} was answered by an agent`);
    } else if (dialCallStatus === 'busy') {
      // All agents were busy
      twiml.say({ voice: 'alice' }, 'All agents are currently busy. Please leave a message after the tone.');
      
      twiml.record({
        action: `${process.env.SERVER_BASE_URL || 'http://localhost:3000'}/voice/voicemail`,
        method: 'POST',
        maxLength: 120,
        finishOnKey: '#',
        transcribe: true,
        transcribeCallback: `${process.env.SERVER_BASE_URL || 'http://localhost:3000'}/voice/transcription`
      });
    } else if (dialCallStatus === 'no-answer') {
      // No agents answered
      twiml.say({ voice: 'alice' }, 'No agents are available to take your call. Please leave a message after the tone.');
      
      twiml.record({
        action: `${process.env.SERVER_BASE_URL || 'http://localhost:3000'}/voice/voicemail`,
        method: 'POST',
        maxLength: 120,
        finishOnKey: '#',
        transcribe: true,
        transcribeCallback: `${process.env.SERVER_BASE_URL || 'http://localhost:3000'}/voice/transcription`
      });
    } else {
      // Other status (failed, canceled, etc.)
      twiml.say({ voice: 'alice' }, 'There was a problem connecting you to an agent. Please try your call again later.');
    }
    
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('Error handling call answered event:', error);
    res.status(500).json({ error: error.message });
  }
});
```

## 4. Implement Real-Time Notifications

### 4.1 Create WebSocket Server

Set up a WebSocket server for real-time notifications:

```javascript
// server/websocket-server.js
const WebSocket = require('ws');
const http = require('http');
const jwt = require('jsonwebtoken');

class WebSocketServer {
  constructor(server) {
    this.wss = new WebSocket.Server({ server });
    this.clients = new Map(); // Map of client connections by user ID
    
    this.setupEventHandlers();
    
    console.log('WebSocket server initialized');
  }
  
  setupEventHandlers() {
    this.wss.on('connection', (ws, req) => {
      console.log('New WebSocket connection');
      
      // Extract token from query string
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('token');
      
      if (!token) {
        console.log('WebSocket connection rejected: No token provided');
        ws.close(1008, 'Authentication required');
        return;
      }
      
      // Verify the token
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;
        
        console.log(`WebSocket authenticated for user ${userId}`);
        
        // Store the connection
        if (!this.clients.has(userId)) {
          this.clients.set(userId, []);
        }
        
        this.clients.get(userId).push(ws);
        
        // Set up event handlers for this connection
        ws.on('message', (message) => {
          this.handleMessage(userId, message, ws);
        });
        
        ws.on('close', () => {
          console.log(`WebSocket closed for user ${userId}`);
          
          // Remove this connection
          const connections = this.clients.get(userId);
          const index = connections.indexOf(ws);
          
          if (index !== -1) {
            connections.splice(index, 1);
          }
          
          if (connections.length === 0) {
            this.clients.delete(userId);
          }
        });
        
        // Send a welcome message
        ws.send(JSON.stringify({
          type: 'connected',
          userId
        }));
      } catch (error) {
        console.error('WebSocket authentication error:', error);
        ws.close(1008, 'Authentication failed');
      }
    });
  }
  
  handleMessage(userId, message, ws) {
    try {
      const data = JSON.parse(message);
      
      console.log(`Received message from user ${userId}:`, data);
      
      // Handle different message types
      switch (data.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
          
        default:
          console.log(`Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }
  
  // Send a message to a specific user
  sendToUser(userId, message) {
    if (!this.clients.has(userId)) {
      console.log(`No active connections for user ${userId}`);
      return false;
    }
    
    const connections = this.clients.get(userId);
    
    for (const ws of connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    }
    
    return true;
  }
  
  // Send a message to all users in a contact center
  sendToContactCenter(contactCenterId, message, excludeUserId = null) {
    // Get all agents in the contact center
    const store = require('./memory-store');
    
    store.contactCenterAgents.getByContactCenterId(contactCenterId)
      .then(memberships => {
        for (const membership of memberships) {
          // Skip the excluded user
          if (excludeUserId && membership.user_id === excludeUserId) {
            continue;
          }
          
          // Send to this user
          this.sendToUser(membership.user_id, message);
        }
      })
      .catch(error => {
        console.error('Error sending to contact center:', error);
      });
  }
  
  // Send a message to all connected clients
  broadcast(message) {
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }
}

// Create and export the WebSocket server
let wsServer = null;

module.exports = {
  initialize(server) {
    if (!wsServer) {
      wsServer = new WebSocketServer(server);
    }
    return wsServer;
  },
  
  getInstance() {
    return wsServer;
  }
};
```

### 4.2 Initialize WebSocket Server

Update the main server file to initialize the WebSocket server:

```javascript
// server/index.js - Add WebSocket initialization

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
const wsServer = require('./websocket-server').initialize(server);

// Start the server
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

### 4.3 Update Agent Answered Handler

Update the agent answered handler to notify other agents:

```javascript
// server/routes/voice.js - Update agent-answered route

// Handle agent answered event
router.post('/agent-answered', (req, res) => {
  try {
    const agentId = req.query.agentId;
    const contactCenterId = req.query.contactCenterId;
    
    console.log(`Agent ${agentId} answered call for contact center ${contactCenterId}`);
    
    // Get the agent's name
    store.users.getById(agentId)
      .then(agent => {
        const agentName = agent ? (agent.full_name || agent.username) : `Agent ${agentId}`;
        
        // Notify other agents that the call has been answered
        const wsServer = require('../websocket-server').getInstance();
        
        wsServer.sendToContactCenter(contactCenterId, {
          type: 'call_answered',
          contactCenterId,
          agentId,
          agentName,
          timestamp: new Date().toISOString()
        }, agentId); // Exclude the agent who answered
        
        res.status(200).send();
      })
      .catch(error => {
        console.error('Error getting agent details:', error);
        res.status(500).json({ error: error.message });
      });
  } catch (error) {
    console.error('Error handling agent answered event:', error);
    res.status(500).json({ error: error.message });
  }
});
```

## 5. Update Browser UI for Incoming Calls

### 5.1 Update Twilio Client Initialization

Update the Twilio client initialization to include contact center information:

```javascript
// lib/twilio.js - Update initialize method

async initialize(microphoneId = null, contactCenterIds = []) {
  if (!window.Twilio) {
    throw new Error('Twilio SDK not loaded');
  }

  try {
    // Store the selected microphone ID
    this.selectedMicrophoneId = microphoneId;
    
    // Store the contact center IDs
    this.contactCenterIds = contactCenterIds;
    
    // Get a token from the server with contact center info
    const token = await this.getToken(contactCenterIds);
    
    // Create device options with audio constraints
    const deviceOptions = {
      // Log level for debugging
      logLevel: 'debug',
      // Audio constraints for the microphone
      audioConstraints: this.getAudioConstraints()
    };
    
    console.log('Initializing Twilio device with options:', deviceOptions);
    
    // Initialize the device
    this.device = new Twilio.Device(token, deviceOptions);
    
    // Set up event listeners
    this.setupDeviceListeners();
    
    // Mark as initialized
    this.isInitialized = true;
    
    console.log('Twilio device initialized successfully');
    
    // Request microphone permission explicitly
    await this.requestMicrophonePermission();
    
    return this.device;
  } catch (error) {
    console.error('Error initializing Twilio device:', error);
    throw error;
  }
}

// Update getToken method to include contact center IDs
async getToken(contactCenterIds = []) {
  // Check if we have a valid token
  if (this.token && this.tokenExpiration && this.tokenExpiration > Date.now()) {
    return this.token;
  }
  
  try {
    // Get a new token from the server
    const response = await fetch('http://localhost:3000/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contactCenterIds
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get token: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Store the token and expiration
    this.token = data.token;
    this.tokenExpiration = Date.now() + (data.ttl || 3600) * 1000;
    
    return this.token;
  } catch (error) {
    console.error('Error getting token:', error);
    throw error;
  }
}
```

### 5.2 Update Token Generator

Update the token generator to include contact center information:

```javascript
// server/token-generator.js - Update generateToken function

function generateToken(twilioClient, callerId, contactCenterIds = []) {
  // Use the default caller ID from environment variables if not provided
  const defaultCallerId = process.env.DEFAULT_CALLER_ID || '+19788785223';
  callerId = callerId || defaultCallerId;
  
  // Clean the caller ID to ensure it's properly formatted
  callerId = callerId.replace(/[^+0-9]/g, '');
  
  console.log('Generating token with caller ID:', callerId);
  console.log('Contact center IDs:', contactCenterIds);
  
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
      applicationSid: twimlAppSid,
      // Include contact center IDs
      contactCenterIds: contactCenterIds.join(',')
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
```

### 5.3 Update Popup UI for Incoming Calls

Update the popup UI to handle incoming calls:

```javascript
// popup/popup.js - Add to DialerController class

constructor() {
  // Existing code...
  
  // Add incoming call UI elements
  this.incomingCallContainer = document.getElementById('incoming-call-container');
  this.incomingCaller = document.getElementById('incoming-caller');
  this.incomingNumber = document.getElementById('incoming-number');
  this.answerBtn = document.getElementById('answer-btn');
  this.declineBtn = document.getElementById('decline-btn');
  
  // Initialize WebSocket connection
  this.initializeWebSocket();
}

// Initialize WebSocket connection
initializeWebSocket() {
  // Get the token from storage
  chrome.storage.local.get(['authToken'], (result) => {
    if (result.authToken) {
      // Connect to WebSocket server
      this.ws = new WebSocket(`ws://localhost:3000/ws?token=${result.authToken}`);
      
      // Set up event handlers
      this.ws.onopen = () => {
        console.log('WebSocket connection established');
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket connection closed');
        
        // Reconnect after a delay
        setTimeout(() => this.initializeWebSocket(), 5000);
      };
    }
  });
}

// Handle WebSocket messages
handleWebSocketMessage(message) {
  console.log('Received WebSocket message:', message);
  
  switch (message.type) {
    case 'call_answered':
      // Another agent answered the call
      this.handleCallAnsweredByOtherAgent(message);
      break;
      
    default:
      console.log(`Unknown message type: ${message.type}`);
  }
}

// Handle call answered by another agent
handleCallAnsweredByOtherAgent(message) {
  // Hide the incoming call UI if it's visible
  if (this.incomingCallContainer.style.display !== 'none') {
    this.incomingCallContainer.style.display = 'none';
    
    // Show a notification
    this.updateStatus(`Call answered by ${message.agentName}`);
    
    // Play a sound to indicate the call was answered
    const audio = new Audio(chrome.runtime.getURL('assets/sounds/call-answered.mp3'));
    audio.play();
  }
}

// Set up Twilio event listeners
setupTwilioEventListeners() {
  // Add a listener for incoming calls
  window.TwilioClient.addListener((event, ...args) => {
    switch (event) {
      case 'incomingCall':
        this.handleIncomingCall(args[0]);
        break;
        
      case 'callAccepted':
        this.handleCallAccepted(args[0]);
        break;
        
      case 'callEnded':
        this.handleCallEnded(args[0]);
        break;
        
      case 'callRejected':
        this.handleCallRejected(args[0]);
        break;
    }
  });
}

// Handle incoming call
handleIncomingCall(call) {
  console.log('Incoming call:', call);
  
  // Extract call information
  const from = call.parameters.From || 'Unknown';
  const contactCenterId = call.parameters.contactCenterId;
  
  // Store the current call
  this.incomingCall = call;
  
  // Update the UI
  this.incomingCaller.textContent = 'Incoming Call';
  this.incomingNumber.textContent = from;
  
  // Show the incoming call container
  this.incomingCallContainer.style.display = 'block';
  
  // Play a ringtone
  this.playRingtone();
  
  // Set up event listeners for answer/decline buttons
  this.setupIncomingCallButtons();
}

// Play ringtone
playRingtone() {
  // Create an audio element for the ringtone
  this.ringtone = new Audio(chrome.runtime.getURL('assets/sounds/ringtone.mp3'));
  this.ringtone.loop = true;
  this.ringtone.play();
}

// Stop ringtone
stopRingtone() {
  if (this.ringtone) {
    this.ringtone.pause();
    this.ringtone.currentTime = 0;
    this.ringtone = null;
  }
}

// Set up incoming call buttons
setupIncomingCallButtons() {
  // Answer button
  this.answerBtn.addEventListener('click', () => {
    if (this.incomingCall) {
      // Accept the call
      this.incomingCall.accept();
      
      // Stop the ringtone
      this.stopRingtone();
      
      // Hide the incoming call container
      this.incomingCallContainer.style.display = 'none';
    }
  });
  
  // Decline button
  this.declineBtn.addEventListener('click', () => {
    if (this.incomingCall) {
      // Reject the call
      this.incomingCall.reject();
      
      // Stop the ringtone
      this.stopRingtone();
      
      // Hide the incoming call container
      this.incomingCallContainer.style.display = 'none';
      
      // Clear the incoming call
      this.incomingCall = null;
    }
  });
}

// Handle call accepted
handleCallAccepted(call) {
  console.log('Call accepted:', call);
  
  // Stop the ringtone
  this.stopRingtone();
  
  // Hide the incoming call container
  this.incomingCallContainer.style.display = 'none';
  
  // Show the call in progress UI
  this.simulateCallStart();
}

// Handle call rejected
handleCallRejected(call) {
  console.log('Call rejected:', call);
  
  // Stop the ringtone
  this.stopRingtone();
  
  // Hide the incoming call container
  this.incomingCallContainer.style.display = 'none';
  
  // Clear the incoming call
  this.incomingCall = null;
}

// Handle call ended
handleCallEnded(call) {
  console.log('Call ended:', call);
  
  // Stop the ringtone
  this.stopRingtone();
  
  // Hide the incoming call container
  this.incomingCallContainer.style.display = 'none';
  
  // Clear the incoming call
  this.incomingCall = null;
  
  // Update the UI
  this.simulateCallEnd();
}
```

## 6. Create Admin UI for Contact Centers

### 6.1 Create Contact Center Admin Page

Create a new admin page for managing contact centers at `server/public/contact-centers.html`. This page will allow administrators to:

- Create and manage contact centers
- Add and remove agents from contact centers
- Add and manage phone numbers for contact centers

### 6.2 Create API Routes for Contact Center Management

Add new routes to the API for managing contact centers:

```javascript
// server/routes/api.js - Add contact center routes

const contactCenterService = require('../services/contact-center-service');

// Get all contact centers
router.get('/contact-centers', auth.isAdmin, async (req, res) => {
  try {
    const contactCenters = await contactCenterService.getAllContactCenters();
    
    // Get additional information for each contact center
    const enrichedCenters = [];
    
    for (const center of contactCenters) {
      const agents = await contactCenterService.getContactCenterAgents(center.id);
      const phones = await contactCenterService.getContactCenterPhoneNumbers(center.id);
      
      enrichedCenters.push({
        ...center,
        agentCount: agents.length,
        phoneCount: phones.length
      });
    }
    
    res.json({
      success: true,
      contactCenters: enrichedCenters
    });
  } catch (error) {
    console.error('Error getting contact centers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create a new contact center
router.post('/contact-centers', auth.isAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }
    
    const result = await contactCenterService.createContactCenter({
      name,
      description,
      settings: {}
    });
    
    res.json({
      success: true,
      contactCenter: result
    });
  } catch (error) {
    console.error('Error creating contact center:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update a contact center
router.put('/contact-centers/:id', auth.isAdmin, async (req, res) => {
  try {
    const { name, description, active } = req.body;
    const id = req.params.id;
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }
    
    const result = await contactCenterService.updateContactCenter(id, {
      name,
      description,
      active: active !== undefined ? active : true
    });
    
    res.json({
      success: true,
      contactCenter: result
    });
  } catch (error) {
    console.error('Error updating contact center:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a contact center
router.delete('/contact-centers/:id', auth.isAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    
    await contactCenterService.deleteContactCenter(id);
    
    res.json({
      success: true
    });
  } catch (error) {
    console.error('Error deleting contact center:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all agents in a contact center
router.get('/contact-centers/:id/agents', auth.isAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    
    const agents = await contactCenterService.getContactCenterAgents(id);
    
    res.json({
      success: true,
      agents
    });
  } catch (error) {
    console.error('Error getting contact center agents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add an agent to a contact center
router.post('/contact-centers/:id/agents', auth.isAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const { userId, role } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }
    
    const result = await contactCenterService.addAgentToContactCenter(id, userId, role || 'agent');
    
    res.json(result);
  } catch (error) {
    console.error('Error adding agent to contact center:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remove an agent from a contact center
router.delete('/contact-centers/:id/agents/:userId', auth.isAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.params.userId;
    
    const result = await contactCenterService.removeAgentFromContactCenter(id, userId);
    
    res.json(result);
  } catch (error) {
    console.error('Error removing agent from contact center:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all phone numbers for a contact center
router.get('/contact-centers/:id/phones', auth.isAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    
    const phones = await contactCenterService.getContactCenterPhoneNumbers(id);
    
    res.json({
      success: true,
      phones
    });
  } catch (error) {
    console.error('Error getting contact center phone numbers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add a phone number to a contact center
router.post('/contact-centers/:id/phones', auth.isAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const { phone_number, friendly_name, direction, is_default } = req.body;
    
    if (!phone_number) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }
    
    const result = await contactCenterService.addPhoneNumberToContactCenter(id, {
      phone_number,
      friendly_name,
      direction,
      is_default
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error adding phone number to contact center:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remove a phone number from a contact center
router.delete('/contact-centers/phones/:id', auth.isAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    
    const result = await contactCenterService.removePhoneNumberFromContactCenter(id);
    
    res.json(result);
  } catch (error) {
    console.error('Error removing phone number from contact center:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

## 7. Implementation Plan

### Phase 1: Data Model and Backend Services

1. Create the contact center data models in memory-store.js
2. Implement the contact center service
3. Update the agent status model to include contact center information
4. Create API routes for contact center management

### Phase 2: Incoming Call Handling

1. Update the TwiML handler to support ringing all available agents
2. Add agent answered and call answered handlers
3. Implement WebSocket server for real-time notifications
4. Update the token generator to include contact center information

### Phase 3: Browser UI Updates

1. Update the Twilio client initialization to include contact center information
2. Update the popup UI to handle incoming calls
3. Add WebSocket connection for real-time notifications
4. Implement UI for call answered by other agent notification

### Phase 4: Admin UI

1. Create the contact center admin page
2. Implement UI for managing contact centers
3. Implement UI for managing agents in contact centers
4. Implement UI for managing phone numbers for contact centers

## 8. Testing Plan

1. Test contact center creation and management
2. Test adding and removing agents from contact centers
3. Test adding and removing phone numbers from contact centers
4. Test incoming calls to contact centers
5. Test simultaneous ringing for multiple agents
6. Test call answered notification for other agents
7. Test voicemail when no agents are available

## 9. Conclusion

This implementation plan provides a comprehensive approach to adding a "ring all" feature to the contact center system. By following this plan, you will be able to:

1. Create and manage contact centers
2. Assign agents to contact centers
3. Add multiple phone numbers for inbound/outbound calls
4. Ring all available agents in a contact center for incoming calls
5. Stop ringing for other agents when one agent answers
6. Provide real-time notifications for call events
7. Manage the entire system through an admin UI

This feature will significantly improve the call handling capabilities of the system, making it more suitable for contact center operations.
