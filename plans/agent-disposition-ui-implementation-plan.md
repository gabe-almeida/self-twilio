# Agent Disposition UI Implementation Plan

## Overview

The current outbound call system is missing a critical component: a UI for agents to set dispositions after calls. When a call ends in `dashboard.html`, the system automatically sets the agent status to "After Call Work" but doesn't prompt the agent to select a disposition. This is a significant gap because the system relies on dispositions to determine next steps in workflows, and without agent input, the system can't properly categorize call outcomes.

## Current State

- [x] Disposition system is implemented in the backend (`memory-store.js`)
- [x] Admin UI for managing dispositions exists in `admin.html`
- [x] API routes for dispositions are implemented in `routes/dispositions.js`
- [x] Dispositions are integrated with the workflow engine
- [x] Agent UI for selecting dispositions after calls is implemented

## Goals

1. Implement a UI for agents to select dispositions after calls
2. Ensure disposition selection is mandatory before returning to "Available" status
3. Integrate the selected disposition with the workflow engine
4. Maintain DRY principles by using the global disposition system

## Implementation Steps

### 1. Create Disposition Selection Modal

- [x] Add HTML for a disposition selection modal in `dashboard.html`
- [x] Style the modal to match the existing UI
- [x] Include a dropdown or radio buttons for selecting dispositions
- [x] Add a notes field for additional context
- [x] Add a submit button to save the disposition

### 2. Fetch Active Dispositions

- [x] Add a function to fetch active dispositions from the server
- [x] Cache dispositions to avoid unnecessary API calls
- [x] Populate the disposition selection dropdown/radio buttons with active dispositions
- [x] Highlight "final" dispositions differently (if applicable)

### 3. Modify Call End Handling

- [x] Update the `handleCallEnded` function in `dashboard.html` to show the disposition modal
- [x] Prevent agents from taking new calls until a disposition is selected
- [x] Add validation to ensure a disposition is selected before submission

### 4. API Integration

- [x] Add a function to submit the selected disposition to the server
- [x] Create an API endpoint in `routes/api.js` to handle disposition updates for calls
- [x] Update the call record in the database with the selected disposition
- [x] Trigger any associated workflow actions based on the disposition

### 5. Status Management

- [x] Modify the agent status flow to require disposition selection before returning to "Available"
- [x] Add a visual indicator showing that disposition selection is pending
- [x] Update the status management UI to reflect the new flow

### 6. Testing

- [x] Test the disposition selection UI with various dispositions
- [x] Verify that dispositions are correctly saved to the database
- [x] Test the workflow triggers based on different dispositions
- [x] Verify that agents cannot return to "Available" without selecting a disposition

## Backend Changes

### 1. Add New API Endpoint

Add a new endpoint to `routes/api.js` to handle call disposition updates:

```javascript
// Update call disposition
router.post('/call-history/:callId/disposition', authenticateToken, async (req, res) => {
  try {
    const callId = req.params.callId;
    const { disposition_id, notes } = req.body;
    
    if (!disposition_id) {
      return res.status(400).json({ message: 'Disposition ID is required' });
    }
    
    // Get the disposition details
    const disposition = await store.dispositions.getById(disposition_id);
    
    if (!disposition) {
      return res.status(404).json({ message: 'Disposition not found' });
    }
    
    // Get the call from history
    const call = await store.callHistory.getById(callId);
    
    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }
    
    // Update the call with the disposition
    const updatedCall = {
      ...call,
      disposition_id,
      disposition_name: disposition.name,
      notes: notes || call.notes,
      updated_at: new Date().toISOString()
    };
    
    await store.callHistory.update(callId, updatedCall);
    
    // If this call is part of a workflow, process the disposition
    if (call.workflow_id) {
      await workflowManager.processCallDisposition({
        ...updatedCall,
        disposition: disposition_id,
        disposition_data: disposition
      });
    }
    
    res.json({
      success: true,
      call: updatedCall
    });
  } catch (error) {
    console.error('Error updating call disposition:', error);
    res.status(500).json({ message: 'Error updating call disposition' });
  }
});
```

### 2. Add Method to Call History Store

Add a method to `memory-store.js` to update call history with disposition:

```javascript
// Update call history with disposition
updateCallWithDisposition(callId, dispositionData) {
  const callIndex = this.callHistory.findIndex(call => call.id === callId);
  
  if (callIndex === -1) {
    return { changes: 0 };
  }
  
  this.callHistory[callIndex] = {
    ...this.callHistory[callIndex],
    disposition_id: dispositionData.disposition_id,
    disposition_name: dispositionData.disposition_name,
    notes: dispositionData.notes || this.callHistory[callIndex].notes,
    updated_at: new Date().toISOString()
  };
  
  return { changes: 1 };
}
```

### 3. Update Agent Status Management

Modify the agent status management in `memory-store.js` to track disposition pending state:

```javascript
// Update agent status
updateAgentStatus(userId, status, dispositionPending = false) {
  const statusIndex = this.agentStatus.findIndex(s => s.user_id === userId);
  
  if (statusIndex === -1) {
    // Create new status
    const newStatus = {
      id: this.nextId.agentStatus++,
      user_id: userId,
      status,
      disposition_pending: dispositionPending,
      last_status_change: new Date().toISOString()
    };
    
    this.agentStatus.push(newStatus);
    return { changes: 1 };
  } else {
    // Update existing status
    this.agentStatus[statusIndex].status = status;
    this.agentStatus[statusIndex].disposition_pending = dispositionPending;
    this.agentStatus[statusIndex].last_status_change = new Date().toISOString();
    return { changes: 1 };
  }
}
```

## API Requirements

### New Endpoint: Update Call Disposition

```
POST /api/call-history/:callId/disposition
```

**Request Body:**
```json
{
  "disposition_id": "string",
  "notes": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "call": {
    "id": "number",
    "disposition_id": "string",
    "disposition_name": "string",
    "notes": "string",
    "updated_at": "string (ISO date)"
  }
}
```

## UI Components

### Disposition Modal

```html
<div class="modal fade" id="dispositionModal" tabindex="-1" aria-labelledby="dispositionModalLabel" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="dispositionModalLabel">Call Disposition</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <form id="disposition-form">
          <input type="hidden" id="disposition-call-id">
          <div class="mb-3">
            <label for="disposition-select" class="form-label">Disposition</label>
            <select class="form-select" id="disposition-select" required>
              <option value="">Select a disposition</option>
              <!-- Dispositions will be added here dynamically -->
            </select>
          </div>
          <div class="mb-3">
            <label for="disposition-notes" class="form-label">Notes</label>
            <textarea class="form-control" id="disposition-notes" rows="3"></textarea>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-primary" id="save-disposition-btn">Save Disposition</button>
      </div>
    </div>
  </div>
</div>
```

### JavaScript Functions

```javascript
// Fetch active dispositions
async function loadActiveDispositions() {
  try {
    const response = await fetch('/api/dispositions/active', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to get active dispositions');
    }
    
    const data = await response.json();
    return data.dispositions;
  } catch (error) {
    console.error('Error loading dispositions:', error);
    return [];
  }
}

// Show disposition modal after call ends
function showDispositionModal(callId) {
  // Set the call ID in the hidden field
  document.getElementById('disposition-call-id').value = callId;
  
  // Load dispositions into the select dropdown
  loadActiveDispositions().then(dispositions => {
    const select = document.getElementById('disposition-select');
    select.innerHTML = '<option value="">Select a disposition</option>';
    
    dispositions.forEach(disposition => {
      const option = document.createElement('option');
      option.value = disposition.id;
      option.textContent = disposition.name;
      option.dataset.isFinal = disposition.is_final;
      select.appendChild(option);
    });
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('dispositionModal'));
    modal.show();
  });
}

// Save disposition
async function saveCallDisposition() {
  const callId = document.getElementById('disposition-call-id').value;
  const dispositionId = document.getElementById('disposition-select').value;
  const notes = document.getElementById('disposition-notes').value;
  
  if (!dispositionId) {
    alert('Please select a disposition');
    return;
  }
  
  try {
    const response = await fetch(`/api/call-history/${callId}/disposition`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        disposition_id: dispositionId,
        notes: notes
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to save disposition');
    }
    
    // Close the modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('dispositionModal'));
    modal.hide();
    
    // Now the agent can return to Available status
    enableStatusChange();
    
    // Refresh call history
    loadHistoryData();
  } catch (error) {
    console.error('Error saving disposition:', error);
    alert(`Error saving disposition: ${error.message}`);
  }
}
```

### Modify handleCallEnded Function

```javascript
// Handle call ended
function handleCallEnded() {
  // Update UI
  callBtn.style.display = 'block';
  hangupBtn.style.display = 'none';
  callControls.style.display = 'none';
  
  // Stop call timer
  clearInterval(durationInterval);
  callDuration.textContent = '00:00';
  
  // Stop audio level monitoring
  clearInterval(audioVisualizerInterval);
  resetAudioVisualizer();
  
  // Reset mute button
  muteBtn.innerHTML = '<i class="bi bi-mic-fill"></i> Mute';
  muteBtn.classList.remove('btn-danger');
  muteBtn.classList.add('btn-secondary');
  
  // Get call ID from current call
  const callId = currentCall ? currentCall.parameters.CallSid : null;
  
  // Clear current call
  currentCall = null;
  
  // Update agent status to After Call Work and mark disposition as pending
  updateAgentStatus('After Call Work', true);
  
  // Disable status change until disposition is selected
  disableStatusChange();
  
  // Show disposition modal if we have a call ID
  if (callId) {
    showDispositionModal(callId);
  }
  
  // Refresh call history
  setTimeout(() => {
    loadHistoryData();
  }, 2000);
}
```

### Status Management Functions

```javascript
// Disable status change
function disableStatusChange() {
  // Add a visual indicator to the status dropdown
  const statusDropdown = document.getElementById('statusDropdown');
  statusDropdown.classList.add('disposition-pending');
  
  // Add a tooltip
  statusDropdown.setAttribute('title', 'Please select a call disposition first');
  
  // Disable status options except After Call Work
  document.querySelectorAll('.status-option').forEach(option => {
    if (option.getAttribute('data-status') !== 'After Call Work') {
      option.classList.add('disabled');
      option.style.pointerEvents = 'none';
    }
  });
}

// Enable status change
function enableStatusChange() {
  // Remove visual indicator
  const statusDropdown = document.getElementById('statusDropdown');
  statusDropdown.classList.remove('disposition-pending');
  
  // Remove tooltip
  statusDropdown.removeAttribute('title');
  
  // Enable all status options
  document.querySelectorAll('.status-option').forEach(option => {
    option.classList.remove('disabled');
    option.style.pointerEvents = 'auto';
  });
}
```

## CSS Styles

Add these styles to the existing CSS in `dashboard.html`:

```css
/* Disposition pending indicator */
.disposition-pending {
  border: 2px solid #ffc107 !important;
  position: relative;
}

.disposition-pending::after {
  content: "⚠️";
  position: absolute;
  top: -5px;
  right: -5px;
  background-color: #ffc107;
  color: #000;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Disabled status options */
.status-option.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Final disposition highlighting */
option[data-is-final="true"] {
  font-weight: bold;
  color: #dc3545;
}
```

## Dependencies

- Bootstrap 5 (already included in the project)
- Existing disposition system in `memory-store.js`
- API routes for dispositions

## Timeline

- Development: 2-3 days
- Testing: 1 day
- Deployment: 1 day

## Success Criteria

- Agents are prompted to select a disposition after each call
- Dispositions are correctly saved to the database
- Workflows are triggered based on the selected dispositions
- Agents cannot return to "Available" status without selecting a disposition
- The UI is intuitive and easy to use

## Future Enhancements

- Add disposition-specific follow-up questions
- Implement disposition shortcuts for common outcomes
- Add disposition analytics to track call outcomes
- Integrate with CRM systems for better lead tracking

## Implementation Checklist

- [x] Backend changes
  - [x] Add new API endpoint for updating call dispositions
  - [x] Add method to call history store for updating dispositions
  - [x] Update agent status management to track disposition pending state
  
- [x] Frontend changes
  - [x] Add disposition modal HTML to dashboard.html
  - [x] Add CSS styles for disposition UI
  - [x] Implement JavaScript functions for disposition handling
  - [x] Modify handleCallEnded function
  - [x] Add status management functions
  
- [x] Testing
  - [x] Test disposition selection UI
  - [x] Test API integration
  - [x] Test workflow triggers
  - [x] Test status management
  
- [x] Documentation
  - [x] Update API documentation
  - [x] Add user guide for agents
  - [x] Add admin guide for managing dispositions