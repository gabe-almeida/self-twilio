# Outbound Call Countdown Feature

This document outlines the implementation plan for adding a 5-second countdown feature before initiating outbound calls. This feature will show agents information about the lead they'll be calling and give them a brief moment to prepare before the call begins.

## Overview

Currently, the system initiates outbound calls immediately when assigned to an agent. The new feature will:

1. Display a 5-second countdown timer to the agent
2. Show lead information during the countdown
3. Automatically initiate the call when the countdown reaches zero
4. Allow the agent to cancel the call during the countdown if needed

## 1. Update Call Queue Manager

### 1.1 Modify the Call Assignment Process

Update the `assignCallToAgent` method in `server/call-queue-manager.js` to include a preparation step:

```javascript
// server/call-queue-manager.js - Update assignCallToAgent method

async assignCallToAgent(call, agent) {
  try {
    console.log(`Assigning call ${call.id} to agent ${agent.user_id} (${agent.username})`);
    
    // Update the call in the database
    await store.callQueue.assignToAgent(call.id, agent.user_id);
    
    // Mark the agent as having a call in progress
    this.callInProgress.set(agent.user_id, call.id);
    
    // Send a notification to the agent about the upcoming call
    const wsServer = require('./websocket-server').getInstance();
    
    if (wsServer) {
      wsServer.sendToUser(agent.user_id, {
        type: 'outbound_call_preparation',
        callId: call.id,
        leadInfo: {
          name: call.contact_name || 'Unknown',
          phoneNumber: call.phone_number,
          notes: call.notes || '',
          // Include any other relevant lead information
          company: call.company || '',
          email: call.email || '',
          lastContact: call.last_contact || '',
          callHistory: call.call_history || []
        },
        countdownSeconds: 5
      });
      
      // Wait for the countdown period (5 seconds) before initiating the call
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check if the call was canceled during the countdown
      if (!this.callInProgress.has(agent.user_id) || this.callInProgress.get(agent.user_id) !== call.id) {
        console.log(`Call ${call.id} was canceled during countdown`);
        return;
      }
      
      // Notify the agent that the call is now starting
      wsServer.sendToUser(agent.user_id, {
        type: 'outbound_call_starting',
        callId: call.id
      });
    }
    
    // Initiate the call
    const result = await this.initiateCall(call, agent);
    
    if (result.success) {
      console.log(`Call ${call.id} successfully initiated with SID: ${result.callSid}`);
      
      // Update the call with the Twilio call SID
      await store.callQueue.updateStatus(call.id, 'In Progress', result.callSid);
      
      // Add to call history
      await store.callHistory.add({
        user_id: agent.user_id,
        phone_number: call.phone_number,
        contact_name: call.contact_name,
        direction: 'outbound',
        start_time: new Date().toISOString(),
        call_sid: result.callSid,
        call_status: 'initiated',
        notes: call.notes
      });
    } else {
      console.error(`Failed to initiate call ${call.id}:`, result.error);
      
      // Mark the call as failed
      await store.callQueue.updateStatus(call.id, 'Failed');
      
      // Remove from in-progress tracking
      this.callInProgress.delete(agent.user_id);
    }
  } catch (error) {
    console.error(`Error assigning call ${call.id} to agent ${agent.user_id}:`, error);
    
    // Mark the call as failed
    await store.callQueue.updateStatus(call.id, 'Failed');
    
    // Remove from in-progress tracking
    this.callInProgress.delete(agent.user_id);
  }
}
```

### 1.2 Add Call Cancellation Endpoint

Add a new API endpoint to allow agents to cancel a call during the countdown:

```javascript
// server/routes/api.js - Add new endpoint

// Cancel an outbound call during countdown
router.post('/calls/:id/cancel', auth.isAgent, async (req, res) => {
  try {
    const callId = req.params.id;
    const userId = req.user.id;
    
    // Get the call queue manager
    const queueManager = require('../call-queue-manager');
    
    // Check if this agent has this call in progress
    if (!queueManager.callInProgress.has(userId) || queueManager.callInProgress.get(userId) !== callId) {
      return res.status(400).json({
        success: false,
        error: 'Call not found or not assigned to this agent'
      });
    }
    
    // Remove from in-progress tracking
    queueManager.callInProgress.delete(userId);
    
    // Update the call status
    await store.callQueue.updateStatus(callId, 'Canceled');
    
    // Log the cancellation
    console.log(`Call ${callId} canceled by agent ${userId} during countdown`);
    
    res.json({
      success: true,
      message: 'Call canceled successfully'
    });
  } catch (error) {
    console.error('Error canceling call:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

## 2. Update Browser UI for Countdown

### 2.1 Add Countdown UI to Popup

Update the popup UI to show the countdown and lead information:

```javascript
// popup/popup.js - Add to DialerController class

// Handle WebSocket messages
handleWebSocketMessage(message) {
  console.log('Received WebSocket message:', message);
  
  switch (message.type) {
    case 'call_answered':
      // Another agent answered the call
      this.handleCallAnsweredByOtherAgent(message);
      break;
      
    case 'outbound_call_preparation':
      // Upcoming outbound call notification
      this.handleOutboundCallPreparation(message);
      break;
      
    case 'outbound_call_starting':
      // Outbound call is now starting
      this.handleOutboundCallStarting(message);
      break;
      
    default:
      console.log(`Unknown message type: ${message.type}`);
  }
}

// Handle outbound call preparation
handleOutboundCallPreparation(message) {
  // Create or show the countdown UI
  if (!this.countdownContainer) {
    this.createCountdownUI();
  }
  
  // Store the call ID
  this.upcomingCallId = message.callId;
  
  // Update the lead information
  this.updateLeadInfo(message.leadInfo);
  
  // Start the countdown
  this.startCountdown(message.countdownSeconds || 5);
  
  // Show the countdown container
  this.countdownContainer.style.display = 'block';
  
  // Play a notification sound
  const audio = new Audio(chrome.runtime.getURL('assets/sounds/countdown-start.mp3'));
  audio.play();
}

// Handle outbound call starting
handleOutboundCallStarting(message) {
  // Hide the countdown container
  if (this.countdownContainer) {
    this.countdownContainer.style.display = 'none';
  }
  
  // Clear the upcoming call ID
  this.upcomingCallId = null;
  
  // Update the status
  this.updateStatus('Call starting...');
}

// Create the countdown UI
createCountdownUI() {
  // Create the container
  this.countdownContainer = document.createElement('div');
  this.countdownContainer.className = 'countdown-container';
  this.countdownContainer.style.display = 'none';
  
  // Create the header
  const header = document.createElement('div');
  header.className = 'countdown-header';
  header.innerHTML = '<h3>Upcoming Call</h3>';
  
  // Create the lead info section
  const leadInfo = document.createElement('div');
  leadInfo.className = 'lead-info';
  
  // Name
  this.leadName = document.createElement('div');
  this.leadName.className = 'lead-name';
  leadInfo.appendChild(this.leadName);
  
  // Phone
  this.leadPhone = document.createElement('div');
  this.leadPhone.className = 'lead-phone';
  leadInfo.appendChild(this.leadPhone);
  
  // Company
  this.leadCompany = document.createElement('div');
  this.leadCompany.className = 'lead-company';
  leadInfo.appendChild(this.leadCompany);
  
  // Notes
  this.leadNotes = document.createElement('div');
  this.leadNotes.className = 'lead-notes';
  leadInfo.appendChild(this.leadNotes);
  
  // Create the countdown timer
  this.countdownTimer = document.createElement('div');
  this.countdownTimer.className = 'countdown-timer';
  
  // Create the actions section
  const actions = document.createElement('div');
  actions.className = 'countdown-actions';
  
  // Cancel button
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'cancel-btn';
  cancelBtn.textContent = 'Cancel Call';
  cancelBtn.addEventListener('click', () => this.cancelUpcomingCall());
  actions.appendChild(cancelBtn);
  
  // Assemble the container
  this.countdownContainer.appendChild(header);
  this.countdownContainer.appendChild(leadInfo);
  this.countdownContainer.appendChild(this.countdownTimer);
  this.countdownContainer.appendChild(actions);
  
  // Add to the document
  document.querySelector('.dialer-container').appendChild(this.countdownContainer);
  
  // Add CSS
  const style = document.createElement('style');
  style.textContent = `
    .countdown-container {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(255, 255, 255, 0.95);
      z-index: 1000;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    
    .countdown-header {
      margin-bottom: 20px;
      text-align: center;
    }
    
    .countdown-header h3 {
      margin: 0;
      color: #333;
    }
    
    .lead-info {
      margin-bottom: 20px;
      width: 100%;
      max-width: 300px;
    }
    
    .lead-name {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    
    .lead-phone {
      font-size: 16px;
      margin-bottom: 5px;
    }
    
    .lead-company {
      font-size: 14px;
      margin-bottom: 5px;
    }
    
    .lead-notes {
      font-size: 14px;
      margin-top: 10px;
      padding: 10px;
      background-color: #f5f5f5;
      border-radius: 4px;
      max-height: 100px;
      overflow-y: auto;
    }
    
    .countdown-timer {
      font-size: 48px;
      font-weight: bold;
      margin: 20px 0;
      color: #4CAF50;
    }
    
    .countdown-actions {
      margin-top: 20px;
    }
    
    .cancel-btn {
      padding: 10px 20px;
      background-color: #f44336;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
    }
    
    .cancel-btn:hover {
      background-color: #d32f2f;
    }
  `;
  document.head.appendChild(style);
}

// Update lead information
updateLeadInfo(leadInfo) {
  if (!leadInfo) return;
  
  this.leadName.textContent = leadInfo.name || 'Unknown';
  this.leadPhone.textContent = leadInfo.phoneNumber || '';
  this.leadCompany.textContent = leadInfo.company || '';
  this.leadNotes.textContent = leadInfo.notes || 'No notes available';
}

// Start the countdown
startCountdown(seconds) {
  // Clear any existing interval
  if (this.countdownInterval) {
    clearInterval(this.countdownInterval);
  }
  
  // Set the initial time
  let timeLeft = seconds;
  this.countdownTimer.textContent = timeLeft;
  
  // Start the interval
  this.countdownInterval = setInterval(() => {
    timeLeft--;
    
    // Update the timer
    this.countdownTimer.textContent = timeLeft;
    
    // Play a tick sound
    if (timeLeft > 0) {
      const audio = new Audio(chrome.runtime.getURL('assets/sounds/tick.mp3'));
      audio.play();
    }
    
    // Check if the countdown is complete
    if (timeLeft <= 0) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
      
      // Play a call starting sound
      const audio = new Audio(chrome.runtime.getURL('assets/sounds/call-starting.mp3'));
      audio.play();
    }
  }, 1000);
}

// Cancel the upcoming call
cancelUpcomingCall() {
  if (!this.upcomingCallId) return;
  
  // Stop the countdown
  if (this.countdownInterval) {
    clearInterval(this.countdownInterval);
    this.countdownInterval = null;
  }
  
  // Hide the countdown container
  this.countdownContainer.style.display = 'none';
  
  // Send a request to cancel the call
  fetch(`http://localhost:3000/api/calls/${this.upcomingCallId}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        console.log('Call canceled successfully');
        this.updateStatus('Call canceled');
      } else {
        console.error('Error canceling call:', data.error);
        this.updateStatus('Error canceling call');
      }
    })
    .catch(error => {
      console.error('Error canceling call:', error);
      this.updateStatus('Error canceling call');
    });
  
  // Clear the upcoming call ID
  this.upcomingCallId = null;
}
```

### 2.2 Add Sound Assets

Add the following sound files to the extension:

1. `assets/sounds/countdown-start.mp3` - A gentle notification sound for the start of the countdown
2. `assets/sounds/tick.mp3` - A subtle tick sound for each second of the countdown
3. `assets/sounds/call-starting.mp3` - A more prominent sound for when the call is about to start

## 3. Implementation Steps

1. **Update Call Queue Manager**
   - Modify the `assignCallToAgent` method to include the countdown logic
   - Add WebSocket notifications for call preparation and call starting

2. **Add API Endpoint**
   - Create a new endpoint for canceling calls during the countdown

3. **Update Browser UI**
   - Create the countdown UI component
   - Implement the countdown timer
   - Add lead information display
   - Add call cancellation functionality

4. **Add Sound Assets**
   - Create or source appropriate sound files
   - Add them to the extension's assets directory

## 4. Testing Plan

1. Test the countdown timer accuracy
2. Verify that lead information is displayed correctly
3. Test call cancellation during the countdown
4. Ensure the call is properly initiated after the countdown
5. Test with different types of lead information (complete vs. partial)
6. Verify that sound effects play correctly

## 5. Benefits

This feature provides several benefits:

1. **Agent Preparation**: Gives agents a moment to review lead information before the call starts
2. **Reduced Anxiety**: Provides a predictable start time for outbound calls
3. **Improved Call Quality**: Agents can be better prepared for the conversation
4. **Cancellation Option**: Allows agents to cancel calls if they need more time or notice issues with the lead information
5. **Enhanced User Experience**: The countdown and sound effects create a more polished experience

## 6. Integration with Contact Center Feature

This outbound call countdown feature will work seamlessly with the contact center "ring all" feature. The countdown will be shown to agents when they are assigned outbound calls through the contact center system.