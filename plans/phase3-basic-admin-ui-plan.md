# Phase 3: Basic Admin UI for Workflows - Detailed Implementation Plan

## 1. Create Workflow List Page

### 1.1 Add Workflows Section to admin.html
- [x] Add navigation link for workflows
  ```html
  <li class="nav-item">
      <a class="nav-link" href="#" data-section="workflows-section">
          <i class="bi bi-diagram-3"></i> Workflows
      </a>
  </li>
  ```

- [x] Add workflows section container
  ```html
  <!-- Workflows Section -->
  <div id="workflows-section" class="section">
      <div class="row">
          <div class="col-md-12">
              <div class="card">
                  <div class="card-body">
                      <h5 class="card-title">Call Queue Workflows</h5>
                      <div class="mb-3">
                          <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#addWorkflowModal">
                              <i class="bi bi-plus-circle"></i> Create Workflow
                          </button>
                      </div>
                      <div class="table-responsive">
                          <table class="table table-striped table-hover">
                              <thead>
                                  <tr>
                                      <th>Name</th>
                                      <th>Description</th>
                                      <th>Triggers</th>
                                      <th>Steps</th>
                                      <th>Status</th>
                                      <th>Actions</th>
                                  </tr>
                              </thead>
                              <tbody id="workflows-table-body">
                                  <!-- Workflows will be added here dynamically -->
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>
          </div>
      </div>
  </div>
  ```

### 1.2 Add Create Workflow Modal
- [x] Create modal for adding new workflows
  ```html
  <!-- Add Workflow Modal -->
  <div class="modal fade" id="addWorkflowModal" tabindex="-1" aria-labelledby="addWorkflowModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-lg">
          <div class="modal-content">
              <div class="modal-header">
                  <h5 class="modal-title" id="addWorkflowModalLabel">Create Workflow</h5>
                  <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                  <form id="add-workflow-form">
                      <div class="mb-3">
                          <label for="workflow-name" class="form-label">Workflow Name</label>
                          <input type="text" class="form-control" id="workflow-name" required>
                      </div>
                      <div class="mb-3">
                          <label for="workflow-description" class="form-label">Description</label>
                          <textarea class="form-control" id="workflow-description" rows="2"></textarea>
                      </div>
                      <div class="mb-3">
                          <label class="form-label">Trigger Type</label>
                          <div class="form-check">
                              <input class="form-check-input" type="radio" name="trigger-type" id="trigger-new-lead" value="new_lead" checked>
                              <label class="form-check-label" for="trigger-new-lead">
                                  New Lead
                              </label>
                          </div>
                          <div class="form-check">
                              <input class="form-check-input" type="radio" name="trigger-type" id="trigger-call-disposition" value="call_disposition">
                              <label class="form-check-label" for="trigger-call-disposition">
                                  Call Disposition
                              </label>
                          </div>
                          <div class="form-check">
                              <input class="form-check-input" type="radio" name="trigger-type" id="trigger-scheduled" value="scheduled">
                              <label class="form-check-label" for="trigger-scheduled">
                                  Scheduled
                              </label>
                          </div>
                      </div>
                      <div id="trigger-details" class="mb-3">
                          <!-- Trigger-specific fields will be added here dynamically -->
                      </div>
                  </form>
              </div>
              <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                  <button type="button" class="btn btn-primary" id="create-workflow-btn">Create Workflow</button>
              </div>
          </div>
      </div>
  </div>
  ```

### 1.3 Implement JavaScript for Workflow Listing
- [x] Add loadWorkflowsData function
  ```javascript
  // Load workflows data
  async function loadWorkflowsData() {
      try {
          const response = await fetch('/api/workflows', {
              headers: {
                  'Authorization': `Bearer ${token}`
              }
          });
          
          if (!response.ok) {
              throw new Error('Failed to get workflows');
          }
          
          const data = await response.json();
          
          // Update workflows table
          const workflowsTableBody = document.getElementById('workflows-table-body');
          workflowsTableBody.innerHTML = '';
          
          data.workflows.forEach(workflow => {
              const row = document.createElement('tr');
              
              // Format triggers
              let triggersText = 'None';
              if (workflow.triggers && workflow.triggers.length > 0) {
                  triggersText = workflow.triggers.map(trigger => {
                      switch (trigger.type) {
                          case 'new_lead':
                              return 'New Lead';
                          case 'call_disposition':
                              return `Call Disposition: ${trigger.disposition}`;
                          case 'scheduled':
                              return 'Scheduled';
                          default:
                              return trigger.type;
                      }
                  }).join(', ');
              }
              
              // Format steps count
              const stepsCount = workflow.steps ? workflow.steps.length : 0;
              
              // Format status
              const statusClass = workflow.active ? 'text-success' : 'text-secondary';
              const statusText = workflow.active ? 'Active' : 'Inactive';
              
              row.innerHTML = `
                  <td>${workflow.name}</td>
                  <td>${workflow.description || '-'}</td>
                  <td>${triggersText}</td>
                  <td>${stepsCount} steps</td>
                  <td><span class="${statusClass}">${statusText}</span></td>
                  <td>
                      <button class="btn btn-sm btn-primary edit-workflow-btn" data-id="${workflow.id}">
                          <i class="bi bi-pencil"></i>
                      </button>
                      ${workflow.active ? 
                          `<button class="btn btn-sm btn-warning deactivate-workflow-btn" data-id="${workflow.id}">
                              <i class="bi bi-pause-fill"></i>
                          </button>` : 
                          `<button class="btn btn-sm btn-success activate-workflow-btn" data-id="${workflow.id}">
                              <i class="bi bi-play-fill"></i>
                          </button>`
                      }
                      <button class="btn btn-sm btn-danger delete-workflow-btn" data-id="${workflow.id}">
                          <i class="bi bi-trash"></i>
                      </button>
                  </td>
              `;
              
              workflowsTableBody.appendChild(row);
          });
          
          // Add event listeners to workflow action buttons
          document.querySelectorAll('.edit-workflow-btn').forEach(button => {
              button.addEventListener('click', () => {
                  const id = button.getAttribute('data-id');
                  editWorkflow(id);
              });
          });
          
          document.querySelectorAll('.activate-workflow-btn').forEach(button => {
              button.addEventListener('click', () => {
                  const id = button.getAttribute('data-id');
                  activateWorkflow(id);
              });
          });
          
          document.querySelectorAll('.deactivate-workflow-btn').forEach(button => {
              button.addEventListener('click', () => {
                  const id = button.getAttribute('data-id');
                  deactivateWorkflow(id);
              });
          });
          
          document.querySelectorAll('.delete-workflow-btn').forEach(button => {
              button.addEventListener('click', () => {
                  const id = button.getAttribute('data-id');
                  deleteWorkflow(id);
              });
          });
      } catch (error) {
          console.error('Error loading workflows data:', error);
      }
  }
  ```

### 1.4 Add Create Workflow Functionality
- [x] Implement createWorkflow function
  ```javascript
  // Create workflow
  async function createWorkflow() {
      const name = document.getElementById('workflow-name').value.trim();
      const description = document.getElementById('workflow-description').value.trim();
      const triggerType = document.querySelector('input[name="trigger-type"]:checked').value;
      
      if (!name) {
          alert('Please enter a workflow name');
          return;
      }
      
      try {
          // Build trigger based on selected type
          let trigger = { type: triggerType };
          
          if (triggerType === 'new_lead') {
              const priority = document.getElementById('trigger-priority').value;
              trigger.priority = parseInt(priority);
          } else if (triggerType === 'call_disposition') {
              const disposition = document.getElementById('trigger-disposition').value;
              trigger.disposition = disposition;
          } else if (triggerType === 'scheduled') {
              // Add scheduled trigger details
          }
          
          // Create default steps
          const steps = [
              {
                  id: 'start',
                  type: 'start',
                  name: 'Start',
                  isStart: true,
                  next_step: 'end',
                  position: { x: 100, y: 100 }
              },
              {
                  id: 'end',
                  type: 'end',
                  name: 'End',
                  position: { x: 400, y: 100 }
              }
          ];
          
          // Create workflow object
          const workflow = {
              name,
              description,
              triggers: [trigger],
              steps,
              business_hours: {
                  enabled: true,
                  timezone: 'America/New_York',
                  days: [1, 2, 3, 4, 5], // Monday to Friday
                  start_time: '09:00',
                  end_time: '17:00'
              }
          };
          
          // Send to server
          const response = await fetch('/api/workflows', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(workflow)
          });
          
          if (!response.ok) {
              throw new Error('Failed to create workflow');
          }
          
          // Clear form
          document.getElementById('workflow-name').value = '';
          document.getElementById('workflow-description').value = '';
          document.getElementById('trigger-new-lead').checked = true;
          
          // Close modal
          const modal = bootstrap.Modal.getInstance(document.getElementById('addWorkflowModal'));
          modal.hide();
          
          // Refresh workflows data
          loadWorkflowsData();
          
          alert('Workflow created successfully');
      } catch (error) {
          console.error('Error creating workflow:', error);
          alert(`Error creating workflow: ${error.message}`);
      }
  }
  ```

### 1.5 Add Trigger Type Change Handler
- [x] Implement trigger type change handler
  ```javascript
  // Handle trigger type change
  function handleTriggerTypeChange() {
      const triggerType = document.querySelector('input[name="trigger-type"]:checked').value;
      const triggerDetails = document.getElementById('trigger-details');
      
      // Clear previous content
      triggerDetails.innerHTML = '';
      
      // Add fields based on trigger type
      if (triggerType === 'new_lead') {
          triggerDetails.innerHTML = `
              <label for="trigger-priority" class="form-label">Priority</label>
              <select class="form-select" id="trigger-priority">
                  <option value="1">Normal</option>
                  <option value="2">High</option>
                  <option value="3" selected>Urgent</option>
              </select>
              <div class="form-text">Set the priority for new lead calls.</div>
          `;
      } else if (triggerType === 'call_disposition') {
          triggerDetails.innerHTML = `
              <label for="trigger-disposition" class="form-label">Disposition</label>
              <select class="form-select" id="trigger-disposition">
                  <option value="no-answer" selected>No Answer</option>
                  <option value="busy">Busy</option>
                  <option value="failed">Failed</option>
                  <option value="completed">Completed</option>
                  <option value="canceled">Canceled</option>
              </select>
              <div class="form-text">Select the call disposition that triggers this workflow.</div>
          `;
      } else if (triggerType === 'scheduled') {
          triggerDetails.innerHTML = `
              <p class="form-text">This workflow will be triggered according to a schedule.</p>
              <div class="alert alert-info">
                  Scheduling options will be configured in the workflow editor.
              </div>
          `;
      }
  }
  ```

### 1.6 Add Event Listeners for Workflow Management
- [x] Add event listeners in setupEventListeners function
  ```javascript
  // Add to setupEventListeners function
  // Create workflow button
  document.getElementById('create-workflow-btn').addEventListener('click', () => {
      createWorkflow();
  });
  
  // Trigger type change
  document.querySelectorAll('input[name="trigger-type"]').forEach(radio => {
      radio.addEventListener('change', handleTriggerTypeChange);
  });
  
  // Initialize trigger details
  handleTriggerTypeChange();
  ```

### 1.7 Add Workflow Management Functions
- [x] Implement workflow management functions
  ```javascript
  // Edit workflow
  async function editWorkflow(id) {
      // Redirect to workflow editor
      window.location.href = `/workflow-editor.html?id=${id}`;
  }
  
  // Activate workflow
  async function activateWorkflow(id) {
      try {
          const response = await fetch(`/api/workflows/${id}/activate`, {
              method: 'POST',
              headers: {
                  'Authorization': `Bearer ${token}`
              }
          });
          
          if (!response.ok) {
              throw new Error('Failed to activate workflow');
          }
          
          // Refresh workflows data
          loadWorkflowsData();
          
          alert('Workflow activated successfully');
      } catch (error) {
          console.error('Error activating workflow:', error);
          alert(`Error activating workflow: ${error.message}`);
      }
  }
  
  // Deactivate workflow
  async function deactivateWorkflow(id) {
      try {
          const response = await fetch(`/api/workflows/${id}/deactivate`, {
              method: 'POST',
              headers: {
                  'Authorization': `Bearer ${token}`
              }
          });
          
          if (!response.ok) {
              throw new Error('Failed to deactivate workflow');
          }
          
          // Refresh workflows data
          loadWorkflowsData();
          
          alert('Workflow deactivated successfully');
      } catch (error) {
          console.error('Error deactivating workflow:', error);
          alert(`Error deactivating workflow: ${error.message}`);
      }
  }
  
  // Delete workflow
  async function deleteWorkflow(id) {
      if (!confirm('Are you sure you want to delete this workflow?')) {
          return;
      }
      
      try {
          const response = await fetch(`/api/workflows/${id}`, {
              method: 'DELETE',
              headers: {
                  'Authorization': `Bearer ${token}`
              }
          });
          
          if (!response.ok) {
              throw new Error('Failed to delete workflow');
          }
          
          // Refresh workflows data
          loadWorkflowsData();
          
          alert('Workflow deleted successfully');
      } catch (error) {
          console.error('Error deleting workflow:', error);
          alert(`Error deleting workflow: ${error.message}`);
      }
  }
  ```

## 2. Build Basic Workflow Editor

### 2.1 Create workflow-editor.html
- [x] Create basic workflow editor page
  ```html
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Twilio Dialer - Workflow Editor</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.3/font/bootstrap-icons.css">
      <style>
          body {
              min-height: 100vh;
              background-color: #f8f9fa;
          }
          .navbar {
              box-shadow: 0 2px 4px rgba(0, 0, 0, .1);
          }
          .step-card {
              border: 1px solid #ddd;
              border-radius: 8px;
              padding: 15px;
              margin-bottom: 15px;
              background-color: white;
          }
          .step-card.selected {
              border-color: #0d6efd;
              box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
          }
          .step-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 10px;
          }
          .step-type-badge {
              font-size: 0.8rem;
              padding: 0.25rem 0.5rem;
          }
          .step-actions {
              display: flex;
              gap: 5px;
          }
          .add-step-btn {
              width: 100%;
              border: 1px dashed #ddd;
              background-color: #f8f9fa;
              padding: 10px;
              border-radius: 8px;
              margin-bottom: 15px;
          }
          .add-step-btn:hover {
              background-color: #e9ecef;
          }
      </style>
  </head>
  <body>
      <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
          <div class="container-fluid">
              <a class="navbar-brand" href="#">Twilio Dialer Workflow Editor</a>
              <div class="d-flex align-items-center">
                  <button class="btn btn-outline-light me-2" id="back-btn">
                      <i class="bi bi-arrow-left"></i> Back to Admin
                  </button>
                  <div class="dropdown ms-3">
                      <button class="btn btn-outline-light dropdown-toggle" type="button" id="userDropdown" data-bs-toggle="dropdown" aria-expanded="false">
                          <i class="bi bi-person-circle"></i> <span id="user-name">Admin</span>
                      </button>
                      <ul class="dropdown-menu" aria-labelledby="userDropdown">
                          <li><a class="dropdown-item" href="#" id="logout-link"><i class="bi bi-box-arrow-right"></i> Logout</a></li>
                      </ul>
                  </div>
              </div>
          </div>
      </nav>
  
      <div class="container-fluid mt-4">
          <div class="row">
              <div class="col-md-8">
                  <div class="card mb-4">
                      <div class="card-body">
                          <div class="d-flex justify-content-between align-items-center mb-3">
                              <h5 class="card-title mb-0" id="workflow-name-display">Workflow Editor</h5>
                              <div>
                                  <button class="btn btn-success me-2" id="save-workflow-btn">
                                      <i class="bi bi-save"></i> Save
                                  </button>
                                  <button class="btn btn-primary" id="test-workflow-btn">
                                      <i class="bi bi-play"></i> Test
                                  </button>
                              </div>
                          </div>
                          <div class="mb-3">
                              <input type="text" class="form-control form-control-lg" id="workflow-name" placeholder="Workflow Name">
                          </div>
                          <div class="mb-3">
                              <textarea class="form-control" id="workflow-description" rows="2" placeholder="Workflow Description"></textarea>
                          </div>
                      </div>
                  </div>
  
                  <div class="card mb-4">
                      <div class="card-header">
                          <h5 class="card-title mb-0">Workflow Steps</h5>
                      </div>
                      <div class="card-body">
                          <div id="workflow-steps">
                              <!-- Steps will be added here dynamically -->
                          </div>
                          <button class="add-step-btn" id="add-step-btn">
                              <i class="bi bi-plus-circle"></i> Add Step
                          </button>
                      </div>
                  </div>
              </div>
  
              <div class="col-md-4">
                  <div class="card mb-4">
                      <div class="card-header">
                          <h5 class="card-title mb-0">Step Properties</h5>
                      </div>
                      <div class="card-body">
                          <div id="step-properties">
                              <div class="alert alert-info">
                                  Select a step to edit its properties.
                              </div>
                          </div>
                      </div>
                  </div>
  
                  <div class="card mb-4">
                      <div class="card-header">
                          <h5 class="card-title mb-0">Business Hours</h5>
                      </div>
                      <div class="card-body">
                          <div class="form-check form-switch mb-3">
                              <input class="form-check-input" type="checkbox" id="business-hours-enabled" checked>
                              <label class="form-check-label" for="business-hours-enabled">Enable Business Hours</label>
                          </div>
                          
                          <div class="mb-3">
                              <label for="timezone" class="form-label">Timezone</label>
                              <select class="form-select" id="timezone">
                                  <option value="America/New_York" selected>Eastern Time (ET)</option>
                                  <option value="America/Chicago">Central Time (CT)</option>
                                  <option value="America/Denver">Mountain Time (MT)</option>
                                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                              </select>
                          </div>
                          
                          <div class="row">
                              <div class="col-md-6">
                                  <div class="mb-3">
                                      <label for="start-time" class="form-label">Start Time</label>
                                      <input type="time" class="form-control" id="start-time" value="09:00">
                                  </div>
                              </div>
                              
                              <div class="col-md-6">
                                  <div class="mb-3">
                                      <label for="end-time" class="form-label">End Time</label>
                                      <input type="time" class="form-control" id="end-time" value="17:00">
                                  </div>
                              </div>
                          </div>
                          
                          <div class="mb-3">
                              <label class="form-label">Work Days</label>
                              <div class="d-flex flex-wrap">
                                  <div class="form-check me-3">
                                      <input class="form-check-input workday-check" type="checkbox" value="0" id="sunday">
                                      <label class="form-check-label" for="sunday">Sun</label>
                                  </div>
                                  <div class="form-check me-3">
                                      <input class="form-check-input workday-check" type="checkbox" value="1" id="monday" checked>
                                      <label class="form-check-label" for="monday">Mon</label>
                                  </div>
                                  <div class="form-check me-3">
                                      <input class="form-check-input workday-check" type="checkbox" value="2" id="tuesday" checked>
                                      <label class="form-check-label" for="tuesday">Tue</label>
                                  </div>
                                  <div class="form-check me-3">
                                      <input class="form-check-input workday-check" type="checkbox" value="3" id="wednesday" checked>
                                      <label class="form-check-label" for="wednesday">Wed</label>
                                  </div>
                                  <div class="form-check me-3">
                                      <input class="form-check-input workday-check" type="checkbox" value="4" id="thursday" checked>
                                      <label class="form-check-label" for="thursday">Thu</label>
                                  </div>
                                  <div class="form-check me-3">
                                      <input class="form-check-input workday-check" type="checkbox" value="5" id="friday" checked>
                                      <label class="form-check-label" for="friday">Fri</label>
                                  </div>
                                  <div class="form-check">
                                      <input class="form-check-input workday-check" type="checkbox" value="6" id="saturday">
                                      <label class="form-check-label" for="saturday">Sat</label>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </div>
  
      <!-- Add Step Modal -->
      <div class="modal fade" id="addStepModal" tabindex="-1" aria-labelledby="addStepModalLabel" aria-hidden="true">
          <div class="modal-dialog">
              <div class="modal-content">
                  <div class="modal-header">
                      <h5 class="modal-title" id="addStepModalLabel">Add Step</h5>
                      <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                  </div>
                  <div class="modal-body">
                      <div class="mb-3">
                          <label for="step-type" class="form-label">Step Type</label>
                          <select class="form-select" id="step-type">
                              <option value="call">Make Call</option>
                              <option value="wait">Wait</option>
                              <option value="condition">Condition</option>
                              <option value="sms">Send SMS</option>
                              <option value="end">End Workflow</option>
                          </select>
                      </div>
                      <div class="mb-3">
                          <label for="step-name" class="form-label">Step Name</label>
                          <input type="text" class="form-control" id="step-name" placeholder="Enter a name for this step">
                      </div>
                  </div>
                  <div class="modal-footer">
                      <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                      <button type="button" class="btn btn-primary" id="add-step-confirm-btn">Add Step</button>
                  </div>
              </div>
          </div>
      </div>
  
      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/js/bootstrap.bundle.min.js"></script>
      <script>
          // Global variables
          let token;
          let user;
          let workflowId;
          let workflow;
          let selectedStepId;
          
          // Initialize the application
          document.addEventListener('DOMContentLoaded', async function() {
              // Check if user is logged in
              token = localStorage.getItem('token');
              const userJson = localStorage.getItem('user');
              
              if (!token || !userJson) {
                  // Redirect to login page if not logged in
                  window.location.href = '/login.html';
                  return;
              }
              
              try {
                  user = JSON.parse(userJson);
                  
                  // Check if user is admin
                  if (user.role !== 'admin') {
                      alert('You do not have permission to access the workflow editor');
                      window.location.href = '/dashboard.html';
                      return;
                  }
                  
                  document.getElementById('user-name').textContent = user.full_name || user.username;
                  
                  // Get workflow ID from URL
                  const urlParams = new URLSearchParams(window.location.search);
                  workflowId = urlParams.get('id');
                  
                  if (workflowId) {
                      // Load existing workflow
                      await loadWorkflow(workflowId);
                  } else {
                      // Create new workflow template
                      createNewWorkflowTemplate();
                  }
                  
                  // Set up event listeners
                  setupEventListeners();
              } catch (error) {
                  console.error('Error initializing application:', error);
                  alert('Error initializing application. Please try logging in again.');
              }
          });
          
          // Set up event listeners
          function setupEventListeners() {
              // Back button
              document.getElementById('back-btn').addEventListener('click', () => {
                  window.location.href = '/admin.html';
              });
              
              // Logout link
              document.getElementById('logout-link').addEventListener('click', (e) => {
                  e.preventDefault();
                  logout();
              });
              
              // Save workflow button
              document.getElementById('save-workflow-btn').addEventListener('click', () => {
                  saveWorkflow();
              });
              
              // Test workflow button
              document.getElementById('test-workflow-btn').addEventListener('click', () => {
                  testWorkflow();
              });
              
              // Add step button
              document.getElementById('add-step-btn').addEventListener('click', () => {
                  showAddStepModal();
              });
              
              // Add step confirm button
              document.getElementById('add-step-confirm-btn').addEventListener('click', () => {
                  addStep();
              });
          }
          
          // Load workflow
          async function loadWorkflow(id) {
              try {
                  const response = await fetch(`/api/workflows/${id}`, {
                      headers: {
                          'Authorization': `Bearer ${token}`
                      }
                  });
                  
                  if (!response.ok) {
                      throw new Error('Failed to get workflow');
                  }
                  
                  const data = await response.json();
                  workflow = data.workflow;
                  
                  // Update UI with workflow data
                  document.getElementById('workflow-name-display').textContent = workflow.name;
                  document.getElementById('workflow-name').value = workflow.name;
                  document.getElementById('workflow-description').value = workflow.description || '';
                  
                  // Update business hours
                  if (workflow.business_hours) {
                      document.getElementById('business-hours-enabled').checked = workflow.business_hours.enabled;
                      document.getElementById('timezone').value = workflow.business_hours.timezone;
                      document.getElementById('start-time').value = workflow.business_hours.start_time;
                      document.getElementById('end-time').value = workflow.business_hours.end_time;
                      
                      // Update work days
                      document.querySelectorAll('.workday-check').forEach(checkbox => {
                          const day = parseInt(checkbox.value);
                          checkbox.checked = workflow.business_hours.days.includes(day);
                      });
                  }
                  
                  // Render workflow steps
                  renderWorkflowSteps();
              } catch (error) {
                  console.error('Error loading workflow:', error);
                  alert(`Error loading workflow: ${error.message}`);
              }
          }
          
          // Create new workflow template
          function createNewWorkflowTemplate() {
              workflow = {
                  name: 'New Workflow',
                  description: '',
                  triggers: [
                      { type: 'new_lead', priority: 3 }
                  ],
                  steps: [
                      {
                          id: 'start',
                          type: 'start',
                          name: 'Start',
                          isStart: true,
                          next_step: 'end',
                          position: { x: 100, y: 100 }
                      },
                      {
                          id: 'end',
                          type: 'end',
                          name: 'End',
                          position: { x: 400, y: 100 }
                      }
                  ],
                  business_hours: {
                      enabled: true,
                      timezone: 'America/New_York',
                      days: [1, 2, 3, 4, 5],
                      start_time: '09:00',
                      end_time: '17:00'
                  }
              };
              
              // Update UI with workflow data
              document.getElementById('workflow-name-display').textContent = workflow.name;
              document.getElementById('workflow-name').value = workflow.name;
              
              // Render workflow steps
              renderWorkflowSteps();
          }
          
          // Render workflow steps
          function renderWorkflowSteps() {
              const stepsContainer = document.getElementById('workflow-steps');
              stepsContainer.innerHTML = '';
              
              workflow.steps.forEach(step => {
                  const stepCard = document.createElement('div');
                  stepCard.className = `step-card ${selectedStepId === step.id ? 'selected' : ''}`;
                  stepCard.setAttribute('data-step-id', step.id);
                  
                  // Get step type display name and badge class
                  let typeDisplay = step.type.charAt(0).toUpperCase() + step.type.slice(1);
                  let badgeClass = 'bg-secondary';
                  
                  switch (step.type) {
                      case 'start':
                          badgeClass = 'bg-primary';
                          break;
                      case 'call':
                          badgeClass = 'bg-success';
                          break;
                      case 'wait':
                          badgeClass = 'bg-warning';
                          break;
                      case 'condition':
                          badgeClass = 'bg-info';
                          break;
                      case 'sms':
                          badgeClass = 'bg-primary';
                          break;
                      case 'end':
                          badgeClass = 'bg-danger';
                          break;
                  }
                  
                  // Create step card content
                  stepCard.innerHTML = `
                      <div class="step-header">
                          <div>
                              <span class="badge ${badgeClass} step-type-badge">${typeDisplay}</span>
                              <strong>${step.name}</strong>
                          </div>
                          <div class="step-actions">
                              ${step.type !== 'start' && step.type !== 'end' ? 
                                  `<button class="btn btn-sm btn-outline-danger delete-step-btn" data-step-id="${step.id}">
                                      <i class="bi bi-trash"></i>
                                  </button>` : ''
                              }
                          </div>
                      </div>
                      <div class="step-content">
                          ${getStepContentPreview(step)}
                      </div>
                  `;
                  
                  stepsContainer.appendChild(stepCard);
                  
                  // Add click event to select step
                  stepCard.addEventListener('click', () => {
                      selectStep(step.id);
                  });
                  
                  // Add delete button event
                  const deleteBtn = stepCard.querySelector('.delete-step-btn');
                  if (deleteBtn) {
                      deleteBtn.addEventListener('click', (e) => {
                          e.stopPropagation();
                          deleteStep(step.id);
                      });
                  }
              });
              
              // If a step is selected, show its properties
              if (selectedStepId) {
                  showStepProperties(selectedStepId);
              }
          }
          
          // Get step content preview
          function getStepContentPreview(step) {
              switch (step.type) {
                  case 'start':
                      return '<p class="text-muted mb-0">Workflow starting point</p>';
                  case 'call':
                      const priority = step.properties?.priority || 1;
                      let priorityText = 'Normal';
                      if (priority === 2) priorityText = 'High';
                      if (priority === 3) priorityText = 'Urgent';
                      return `<p class="text-muted mb-0">Make call with ${priorityText} priority</p>`;
                  case 'wait':
                      const minutes = step.properties?.minutes || 0;
                      const respectHours = step.properties?.respect_hours ? 'respecting business hours' : '';
                      return `<p class="text-muted mb-0">Wait for ${minutes} minutes ${respectHours}</p>`;
                  case 'condition':
                      const field = step.condition?.field || '';
                      const operator = step.condition?.operator || '';
                      const value = step.condition?.value || '';
                      return `<p class="text-muted mb-0">If ${field} ${operator} ${value}</p>`;
                  case 'sms':
                      return `<p class="text-muted mb-0">Send SMS message</p>`;
                  case 'end':
                      return '<p class="text-muted mb-0">End of workflow</p>';
                  default:
                      return '';
              }
          }
          
          // Select a step
          function selectStep(stepId) {
              selectedStepId = stepId;
              
              // Update UI to show selected step
              document.querySelectorAll('.step-card').forEach(card => {
                  card.classList.remove('selected');
                  if (card.getAttribute('data-step-id') === stepId) {
                      card.classList.add('selected');
                  }
              });
              
              // Show step properties
              showStepProperties(stepId);
          }
          
          // Show step properties
          function showStepProperties(stepId) {
              const step = workflow.steps.find(s => s.id === stepId);
              if (!step) return;
              
              const propertiesContainer = document.getElementById('step-properties');
              propertiesContainer.innerHTML = '';
              
              // Create properties form based on step type
              switch (step.type) {
                  case 'start':
                      propertiesContainer.innerHTML = `
                          <div class="alert alert-info">
                              This is the starting point of your workflow.
                              <br>
                              It is triggered when a new lead is created.
                          </div>
                      `;
                      break;
                  case 'call':
                      propertiesContainer.innerHTML = `
                          <div class="mb-3">
                              <label for="call-priority" class="form-label">Call Priority</label>
                              <select class="form-select" id="call-priority">
                                  <option value="1" ${(step.properties?.priority || 1) === 1 ? 'selected' : ''}>Normal</option>
                                  <option value="2" ${(step.properties?.priority || 1) === 2 ? 'selected' : ''}>High</option>
                                  <option value="3" ${(step.properties?.priority || 1) === 3 ? 'selected' : ''}>Urgent</option>
                              </select>
                          </div>
                          <div class="mb-3">
                              <label for="next-step" class="form-label">Next Step</label>
                              <select class="form-select" id="next-step">
                                  ${getNextStepOptions(step.next_step)}
                              </select>
                          </div>
                          <button class="btn btn-primary" onclick="updateStepProperties('${step.id}')">
                              Update Properties
                          </button>
                      `;
                      break;
                  case 'wait':
                      propertiesContainer.innerHTML = `
                          <div class="mb-3">
                              <label for="wait-minutes" class="form-label">Wait Time (minutes)</label>
                              <input type="number" class="form-control" id="wait-minutes" value="${step.properties?.minutes || 30}" min="1">
                          </div>
                          <div class="form-check mb-3">
                              <input class="form-check-input" type="checkbox" id="respect-hours" ${step.properties?.respect_hours ? 'checked' : ''}>
                              <label class="form-check-label" for="respect-hours">
                                  Respect Business Hours
                              </label>
                          </div>
                          <div class="mb-3">
                              <label for="next-step" class="form-label">Next Step</label>
                              <select class="form-select" id="next-step">
                                  ${getNextStepOptions(step.next_step)}
                              </select>
                          </div>
                          <button class="btn btn-primary" onclick="updateStepProperties('${step.id}')">
                              Update Properties
                          </button>
                      `;
                      break;
                  case 'condition':
                      propertiesContainer.innerHTML = `
                          <div class="mb-3">
                              <label for="condition-field" class="form-label">Field</label>
                              <select class="form-select" id="condition-field">
                                  <option value="call.disposition" ${(step.condition?.field || '') === 'call.disposition' ? 'selected' : ''}>Call Disposition</option>
                                  <option value="lead.priority" ${(step.condition?.field || '') === 'lead.priority' ? 'selected' : ''}>Lead Priority</option>
                              </select>
                          </div>
                          <div class="mb-3">
                              <label for="condition-operator" class="form-label">Operator</label>
                              <select class="form-select" id="condition-operator">
                                  <option value="equals" ${(step.condition?.operator || '') === 'equals' ? 'selected' : ''}>Equals</option>
                                  <option value="not_equals" ${(step.condition?.operator || '') === 'not_equals' ? 'selected' : ''}>Not Equals</option>
                                  <option value="contains" ${(step.condition?.operator || '') === 'contains' ? 'selected' : ''}>Contains</option>
                              </select>
                          </div>
                          <div class="mb-3">
                              <label for="condition-value" class="form-label">Value</label>
                              <input type="text" class="form-control" id="condition-value" value="${step.condition?.value || ''}">
                          </div>
                          <div class="mb-3">
                              <label for="true-branch" class="form-label">If True, Go To</label>
                              <select class="form-select" id="true-branch">
                                  ${getNextStepOptions(step.true_branch)}
                              </select>
                          </div>
                          <div class="mb-3">
                              <label for="false-branch" class="form-label">If False, Go To</label>
                              <select class="form-select" id="false-branch">
                                  ${getNextStepOptions(step.false_branch)}
                              </select>
                          </div>
                          <button class="btn btn-primary" onclick="updateStepProperties('${step.id}')">
                              Update Properties
                          </button>
                      `;
                      break;
                  case 'sms':
                      propertiesContainer.innerHTML = `
                          <div class="mb-3">
                              <label for="sms-message" class="form-label">Message</label>
                              <textarea class="form-control" id="sms-message" rows="3">${step.properties?.message || ''}</textarea>
                          </div>
                          <div class="mb-3">
                              <label for="next-step" class="form-label">Next Step</label>
                              <select class="form-select" id="next-step">
                                  ${getNextStepOptions(step.next_step)}
                              </select>
                          </div>
                          <button class="btn btn-primary" onclick="updateStepProperties('${step.id}')">
                              Update Properties
                          </button>
                      `;
                      break;
                  case 'end':
                      propertiesContainer.innerHTML = `
                          <div class="alert alert-info">
                              This is the end of your workflow.
                              <br>
                              No further steps will be executed after this.
                          </div>
                      `;
                      break;
              }
          }
          
          // Get options for next step dropdown
          function getNextStepOptions(selectedStepId) {
              let options = '';
              
              workflow.steps.forEach(step => {
                  // Don't include start step as a next step
                  if (step.type !== 'start') {
                      options += `<option value="${step.id}" ${selectedStepId === step.id ? 'selected' : ''}>${step.name}</option>`;
                  }
              });
              
              return options;
          }
          
          // Update step properties
          function updateStepProperties(stepId) {
              const step = workflow.steps.find(s => s.id === stepId);
              if (!step) return;
              
              switch (step.type) {
                  case 'call':
                      step.properties = {
                          ...step.properties,
                          priority: parseInt(document.getElementById('call-priority').value)
                      };
                      step.next_step = document.getElementById('next-step').value;
                      break;
                  case 'wait':
                      step.properties = {
                          ...step.properties,
                          minutes: parseInt(document.getElementById('wait-minutes').value),
                          respect_hours: document.getElementById('respect-hours').checked
                      };
                      step.next_step = document.getElementById('next-step').value;
                      break;
                  case 'condition':
                      step.condition = {
                          field: document.getElementById('condition-field').value,
                          operator: document.getElementById('condition-operator').value,
                          value: document.getElementById('condition-value').value
                      };
                      step.true_branch = document.getElementById('true-branch').value;
                      step.false_branch = document.getElementById('false-branch').value;
                      break;
                  case 'sms':
                      step.properties = {
                          ...step.properties,
                          message: document.getElementById('sms-message').value
                      };
                      step.next_step = document.getElementById('next-step').value;
                      break;
              }
              
              // Re-render workflow steps
              renderWorkflowSteps();
              
              alert('Step properties updated');
          }
          
          // Show add step modal
          function showAddStepModal() {
              // Reset form
              document.getElementById('step-type').value = 'call';
              document.getElementById('step-name').value = '';
              
              // Show modal
              const modal = new bootstrap.Modal(document.getElementById('addStepModal'));
              modal.show();
          }
          
          // Add step
          function addStep() {
              const type = document.getElementById('step-type').value;
              const name = document.getElementById('step-name').value.trim() || `New ${type.charAt(0).toUpperCase() + type.slice(1)} Step`;
              
              // Generate unique ID
              const id = `step_${Date.now()}`;
              
              // Create step based on type
              let step = {
                  id,
                  type,
                  name,
                  position: { x: 100, y: 100 + workflow.steps.length * 50 }
              };
              
              // Add type-specific properties
              switch (type) {
                  case 'call':
                      step.properties = { priority: 2 };
                      step.next_step = 'end';
                      break;
                  case 'wait':
                      step.properties = { minutes: 30, respect_hours: true };
                      step.next_step = 'end';
                      break;
                  case 'condition':
                      step.condition = { field: 'call.disposition', operator: 'equals', value: 'no-answer' };
                      step.true_branch = 'end';
                      step.false_branch = 'end';
                      break;
                  case 'sms':
                      step.properties = { message: 'Hello, this is a test message.' };
                      step.next_step = 'end';
                      break;
              }
              
              // Add step to workflow
              workflow.steps.push(step);
              
              // Update start step to point to this step if it's currently pointing to end
              const startStep = workflow.steps.find(s => s.type === 'start');
              if (startStep && startStep.next_step === 'end') {
                  startStep.next_step = id;
              }
              
              // Close modal
              const modal = bootstrap.Modal.getInstance(document.getElementById('addStepModal'));
              modal.hide();
              
              // Re-render workflow steps
              renderWorkflowSteps();
              
              // Select the new step
              selectStep(id);
          }
          
          // Delete step
          function deleteStep(stepId) {
              if (!confirm('Are you sure you want to delete this step?')) {
                  return;
              }
              
              // Find step index
              const stepIndex = workflow.steps.findIndex(s => s.id === stepId);
              if (stepIndex === -1) return;
              
              // Remove step
              workflow.steps.splice(stepIndex, 1);
              
              // Update references to this step
              workflow.steps.forEach(step => {
                  if (step.next_step === stepId) {
                      step.next_step = 'end';
                  }
                  if (step.true_branch === stepId) {
                      step.true_branch = 'end';
                  }
                  if (step.false_branch === stepId) {
                      step.false_branch = 'end';
                  }
              });
              
              // Clear selected step if it was the deleted one
              if (selectedStepId === stepId) {
                  selectedStepId = null;
                  document.getElementById('step-properties').innerHTML = `
                      <div class="alert alert-info">
                          Select a step to edit its properties.
                      </div>
                  `;
              }
              
              // Re-render workflow steps
              renderWorkflowSteps();
          }
          
          // Save workflow
          async function saveWorkflow() {
              try {
                  // Update workflow data from form
                  workflow.name = document.getElementById('workflow-name').value.trim();
                  workflow.description = document.getElementById('workflow-description').value.trim();
                  
                  // Update business hours
                  workflow.business_hours = {
                      enabled: document.getElementById('business-hours-enabled').checked,
                      timezone: document.getElementById('timezone').value,
                      start_time: document.getElementById('start-time').value,
                      end_time: document.getElementById('end-time').value,
                      days: []
                  };
                  
                  // Get selected work days
                  document.querySelectorAll('.workday-check:checked').forEach(checkbox => {
                      workflow.business_hours.days.push(parseInt(checkbox.value));
                  });
                  
                  // Validate workflow
                  if (!workflow.name) {
                      alert('Please enter a workflow name');
                      return;
                  }
                  
                  // Send to server
                  const url = workflowId ? 
                      `/api/workflows/${workflowId}` : 
                      '/api/workflows';
                  
                  const method = workflowId ? 'PUT' : 'POST';
                  
                  const response = await fetch(url, {
                      method,
                      headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify(workflow)
                  });
                  
                  if (!response.ok) {
                      throw new Error('Failed to save workflow');
                  }
                  
                  const data = await response.json();
                  
                  // Update workflow ID if new
                  if (!workflowId) {
                      workflowId = data.workflow.id;
                      // Update URL without reloading
                      window.history.pushState({}, '', `/workflow-editor.html?id=${workflowId}`);
                  }
                  
                  // Update workflow name display
                  document.getElementById('workflow-name-display').textContent = workflow.name;
                  
                  alert('Workflow saved successfully');
              } catch (error) {
                  console.error('Error saving workflow:', error);
                  alert(`Error saving workflow: ${error.message}`);
              }
          }
          
          // Test workflow
          function testWorkflow() {
              alert('Workflow testing is not implemented yet');
          }
          
          // Logout
          function logout() {
              // Clear local storage
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              
              // Redirect to login page
              window.location.href = '/login.html';
          }
      </script>
  </body>
  </html>
  ```

### 2.2 Update admin.html to Include Workflows in Refresh Interval
- [x] Add workflows section to refresh interval
  ```javascript
  // Add to refresh interval switch statement
  case 'workflows-section':
      loadWorkflowsData();
      break;
  ```

### 2.3 Add loadWorkflowsData to Initial Data Loading
- [x] Add loadWorkflowsData to initial data loading
  ```javascript
  // Add to initial data loading
  loadWorkflowsData();