# Phase 4: Advanced Visual Workflow Builder - Detailed Implementation Plan

## 1. Set Up Drag-and-Drop Environment

### 1.1 Select and Integrate Appropriate Library
- [x] Research and evaluate drag-and-drop libraries
  - [x] React Flow - Node-based editors and workflows
  - [x] jsPlumb - Connecting elements with visual links
  - [x] Flume - Node-based editors
  - [x] Rete.js - Visual programming editor
- [x] Select the most appropriate library (React Flow recommended)
- [x] Install and configure the selected library
  ```bash
  npm install reactflow
  ```
- [x] Create basic integration with the workflow editor

### 1.2 Create Canvas for Workflow Building
- [x] Create a new workflow-editor-visual.html file
  ```html
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Twilio Dialer - Visual Workflow Editor</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.3/font/bootstrap-icons.css">
      <!-- React Flow CSS -->
      <link href="https://unpkg.com/reactflow/dist/style.css" rel="stylesheet">
      <style>
          body {
              margin: 0;
              padding: 0;
              font-family: sans-serif;
              height: 100vh;
          }
          .workflow-editor {
              display: flex;
              height: calc(100vh - 56px);
          }
          .sidebar {
              width: 250px;
              background-color: #f8f9fa;
              border-right: 1px solid #dee2e6;
              padding: 15px;
              overflow-y: auto;
          }
          .canvas-container {
              flex-grow: 1;
              position: relative;
          }
          .properties-panel {
              width: 300px;
              background-color: #f8f9fa;
              border-left: 1px solid #dee2e6;
              padding: 15px;
              overflow-y: auto;
          }
          .node-item {
              padding: 10px;
              margin-bottom: 8px;
              background-color: white;
              border: 1px solid #dee2e6;
              border-radius: 4px;
              cursor: grab;
          }
          .node-item:hover {
              background-color: #e9ecef;
          }
          .react-flow__node {
              padding: 10px;
              border-radius: 5px;
              width: 150px;
              font-size: 12px;
              text-align: center;
          }
          .react-flow__node-start {
              background-color: #007bff;
              color: white;
          }
          .react-flow__node-call {
              background-color: #28a745;
              color: white;
          }
          .react-flow__node-wait {
              background-color: #ffc107;
              color: black;
          }
          .react-flow__node-condition {
              background-color: #17a2b8;
              color: white;
          }
          .react-flow__node-sms {
              background-color: #6f42c1;
              color: white;
          }
          .react-flow__node-end {
              background-color: #dc3545;
              color: white;
          }
      </style>
  </head>
  <body>
      <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
          <div class="container-fluid">
              <a class="navbar-brand" href="#">Twilio Dialer Visual Workflow Editor</a>
              <div class="d-flex align-items-center">
                  <button class="btn btn-outline-light me-2" id="save-workflow-btn">
                      <i class="bi bi-save"></i> Save
                  </button>
                  <button class="btn btn-outline-light me-2" id="back-btn">
                      <i class="bi bi-arrow-left"></i> Back
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
  
      <div class="workflow-editor">
          <div class="sidebar">
              <h5>Elements</h5>
              <div class="mb-3">
                  <div class="node-item" data-node-type="call">
                      <i class="bi bi-telephone"></i> Make Call
                  </div>
                  <div class="node-item" data-node-type="wait">
                      <i class="bi bi-hourglass"></i> Wait
                  </div>
                  <div class="node-item" data-node-type="condition">
                      <i class="bi bi-question-diamond"></i> Condition
                  </div>
                  <div class="node-item" data-node-type="sms">
                      <i class="bi bi-chat"></i> Send SMS
                  </div>
                  <div class="node-item" data-node-type="end">
                      <i class="bi bi-stop-circle"></i> End
                  </div>
              </div>
              <h5>Workflow Settings</h5>
              <div class="mb-3">
                  <label for="workflow-name" class="form-label">Name</label>
                  <input type="text" class="form-control" id="workflow-name">
              </div>
              <div class="mb-3">
                  <label for="workflow-description" class="form-label">Description</label>
                  <textarea class="form-control" id="workflow-description" rows="2"></textarea>
              </div>
              <div class="form-check form-switch mb-3">
                  <input class="form-check-input" type="checkbox" id="workflow-active">
                  <label class="form-check-label" for="workflow-active">Active</label>
              </div>
          </div>
  
          <div class="canvas-container" id="react-flow-canvas"></div>
  
          <div class="properties-panel" id="properties-panel">
              <h5>Properties</h5>
              <div class="alert alert-info">
                  Select a node to edit its properties.
              </div>
          </div>
      </div>
  
      <!-- React and React Flow -->
      <script src="https://unpkg.com/react@17/umd/react.production.min.js"></script>
      <script src="https://unpkg.com/react-dom@17/umd/react-dom.production.min.js"></script>
      <script src="https://unpkg.com/reactflow/dist/reactflow.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/js/bootstrap.bundle.min.js"></script>
      
      <script>
          // Global variables
          let token;
          let user;
          let workflowId;
          let workflow;
          let reactFlowInstance;
          let selectedNode;
          
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
                  
                  // Initialize React Flow
                  initReactFlow();
                  
                  // Set up event listeners
                  setupEventListeners();
              } catch (error) {
                  console.error('Error initializing application:', error);
                  alert('Error initializing application. Please try logging in again.');
              }
          });
          
          // Initialize React Flow
          function initReactFlow() {
              // Implementation will depend on the chosen library
              // This is a placeholder for the actual implementation
              console.log('Initializing React Flow');
          }
          
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
              
              // Make elements draggable
              document.querySelectorAll('.node-item').forEach(item => {
                  item.addEventListener('dragstart', handleDragStart);
                  item.setAttribute('draggable', 'true');
              });
          }
          
          // Handle drag start
          function handleDragStart(event) {
              const nodeType = event.target.getAttribute('data-node-type');
              event.dataTransfer.setData('application/reactflow', nodeType);
              event.dataTransfer.effectAllowed = 'move';
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
                  document.getElementById('workflow-name').value = workflow.name;
                  document.getElementById('workflow-description').value = workflow.description || '';
                  document.getElementById('workflow-active').checked = workflow.active;
                  
                  // Convert workflow steps to React Flow nodes and edges
                  // This will be implemented based on the chosen library
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
                  active: false,
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
              document.getElementById('workflow-name').value = workflow.name;
              document.getElementById('workflow-description').value = workflow.description;
              document.getElementById('workflow-active').checked = workflow.active;
          }
          
          // Save workflow
          async function saveWorkflow() {
              try {
                  // Update workflow data from form
                  workflow.name = document.getElementById('workflow-name').value.trim();
                  workflow.description = document.getElementById('workflow-description').value.trim();
                  workflow.active = document.getElementById('workflow-active').checked;
                  
                  // Update steps from React Flow nodes and edges
                  // This will be implemented based on the chosen library
                  
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
                      window.history.pushState({}, '', `/workflow-editor-visual.html?id=${workflowId}`);
                  }
                  
                  alert('Workflow saved successfully');
              } catch (error) {
                  console.error('Error saving workflow:', error);
                  alert(`Error saving workflow: ${error.message}`);
              }
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

### 1.3 Implement Element Dragging and Connecting
- [x] Create custom node components for each step type
  ```javascript
  // Custom node components
  const nodeTypes = {
    start: StartNode,
    call: CallNode,
    wait: WaitNode,
    condition: ConditionNode,
    sms: SmsNode,
    end: EndNode
  };
  
  // Example custom node component
  function CallNode({ data }) {
    return (
      <div className="custom-node call-node">
        <div className="node-header">
          <i className="bi bi-telephone"></i> {data.label}
        </div>
        <div className="node-content">
          Priority: {data.priority || 'Normal'}
        </div>
      </div>
    );
  }
  ```

- [x] Implement drag-and-drop functionality
  ```javascript
  // Handle drop event
  function onDrop(event) {
    event.preventDefault();
    
    const reactFlowBounds = document.getElementById('react-flow-canvas').getBoundingClientRect();
    const type = event.dataTransfer.getData('application/reactflow');
    
    // Get position
    const position = reactFlowInstance.project({
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top
    });
    
    // Create new node
    const newNode = {
      id: `${type}_${Date.now()}`,
      type,
      position,
      data: { label: `${type.charAt(0).toUpperCase() + type.slice(1)} Step` }
    };
    
    // Add node to React Flow
    const newNodes = [...reactFlowInstance.getNodes(), newNode];
    reactFlowInstance.setNodes(newNodes);
  }
  ```

- [x] Implement node connection handling
  ```javascript
  // Handle edge creation
  function onConnect(params) {
    // Create new edge
    const newEdge = {
      id: `e${params.source}-${params.target}`,
      source: params.source,
      target: params.target,
      type: 'smoothstep'
    };
    
    // Add edge to React Flow
    const newEdges = [...reactFlowInstance.getEdges(), newEdge];
    reactFlowInstance.setEdges(newEdges);
    
    // Update workflow steps
    updateWorkflowFromFlow();
  }
  ```

## 2. Build Workflow Element Library

### 2.1 Create Trigger Elements
- [x] Implement New Lead trigger
  ```javascript
  function NewLeadTrigger({ data, selected }) {
    return (
      <div className={`trigger-node ${selected ? 'selected' : ''}`}>
        <div className="trigger-header">
          <i className="bi bi-person-plus"></i> New Lead
        </div>
        <div className="trigger-content">
          Priority: {data.priority || 'Normal'}
        </div>
      </div>
    );
  }
  ```

- [x] Implement Call Disposition trigger
  ```javascript
  function CallDispositionTrigger({ data, selected }) {
    return (
      <div className={`trigger-node ${selected ? 'selected' : ''}`}>
        <div className="trigger-header">
          <i className="bi bi-telephone-x"></i> Call Disposition
        </div>
        <div className="trigger-content">
          Disposition: {data.disposition || 'Any'}
        </div>
      </div>
    );
  }
  ```

- [x] Implement Scheduled trigger
  ```javascript
  function ScheduledTrigger({ data, selected }) {
    return (
      <div className={`trigger-node ${selected ? 'selected' : ''}`}>
        <div className="trigger-header">
          <i className="bi bi-calendar"></i> Scheduled
        </div>
        <div className="trigger-content">
          Schedule: {data.schedule || 'Not set'}
        </div>
      </div>
    );
  }
  ```

### 2.2 Implement Action Elements
- [x] Create Call action element
  ```javascript
  function CallNode({ data, selected }) {
    return (
      <div className={`action-node call-node ${selected ? 'selected' : ''}`}>
        <div className="node-header">
          <i className="bi bi-telephone"></i> Make Call
        </div>
        <div className="node-content">
          Priority: {data.priority || 'Normal'}
        </div>
        <div className="node-ports">
          <div className="node-port node-port-out"></div>
        </div>
      </div>
    );
  }
  ```

- [x] Create SMS action element
  ```javascript
  function SmsNode({ data, selected }) {
    return (
      <div className={`action-node sms-node ${selected ? 'selected' : ''}`}>
        <div className="node-header">
          <i className="bi bi-chat"></i> Send SMS
        </div>
        <div className="node-content">
          Message: {data.message ? data.message.substring(0, 20) + '...' : 'Not set'}
        </div>
        <div className="node-ports">
          <div className="node-port node-port-out"></div>
        </div>
      </div>
    );
  }
  ```

- [x] Create Update Record action element
  ```javascript
  function UpdateRecordNode({ data, selected }) {
    return (
      <div className={`action-node update-node ${selected ? 'selected' : ''}`}>
        <div className="node-header">
          <i className="bi bi-pencil"></i> Update Record
        </div>
        <div className="node-content">
          Fields: {data.fields ? Object.keys(data.fields).length : 0} to update
        </div>
        <div className="node-ports">
          <div className="node-port node-port-out"></div>
        </div>
      </div>
    );
  }
  ```

### 2.3 Add Condition Elements
- [x] Create Disposition Equals condition
  ```javascript
  function DispositionConditionNode({ data, selected }) {
    return (
      <div className={`condition-node ${selected ? 'selected' : ''}`}>
        <div className="node-header">
          <i className="bi bi-question-diamond"></i> Disposition Check
        </div>
        <div className="node-content">
          {data.disposition || 'Any'} = {data.value || 'Not set'}
        </div>
        <div className="node-ports">
          <div className="node-port node-port-true">True</div>
          <div className="node-port node-port-false">False</div>
        </div>
      </div>
    );
  }
  ```

- [x] Create Time of Day condition
  ```javascript
  function TimeConditionNode({ data, selected }) {
    return (
      <div className={`condition-node ${selected ? 'selected' : ''}`}>
        <div className="node-header">
          <i className="bi bi-clock"></i> Time Check
        </div>
        <div className="node-content">
          Between {data.startTime || '00:00'} and {data.endTime || '23:59'}
        </div>
        <div className="node-ports">
          <div className="node-port node-port-true">True</div>
          <div className="node-port node-port-false">False</div>
        </div>
      </div>
    );
  }
  ```

### 2.4 Create Flow Control Elements
- [x] Implement Wait element
  ```javascript
  function WaitNode({ data, selected }) {
    return (
      <div className={`flow-node wait-node ${selected ? 'selected' : ''}`}>
        <div className="node-header">
          <i className="bi bi-hourglass"></i> Wait
        </div>
        <div className="node-content">
          {data.minutes || 0} minutes
          {data.respectHours ? ' (respecting hours)' : ''}
        </div>
        <div className="node-ports">
          <div className="node-port node-port-out"></div>
        </div>
      </div>
    );
  }
  ```

- [x] Implement Branch element
  ```javascript
  function BranchNode({ data, selected }) {
    return (
      <div className={`flow-node branch-node ${selected ? 'selected' : ''}`}>
        <div className="node-header">
          <i className="bi bi-diagram-3"></i> Branch
        </div>
        <div className="node-content">
          {data.condition || 'No condition set'}
        </div>
        <div className="node-ports">
          <div className="node-port node-port-true">True</div>
          <div className="node-port node-port-false">False</div>
        </div>
      </div>
    );
  }
  ```

- [x] Implement End element
  ```javascript
  function EndNode({ data, selected }) {
    return (
      <div className={`flow-node end-node ${selected ? 'selected' : ''}`}>
        <div className="node-header">
          <i className="bi bi-stop-circle"></i> End
        </div>
        <div className="node-content">
          Workflow complete
        </div>
      </div>
    );
  }
  ```

## 3. Develop Element Configuration Panels

### 3.1 Build Properties Sidebar
- [x] Create properties panel container
  ```javascript
  function PropertiesPanel({ selectedNode, onUpdate }) {
    if (!selectedNode) {
      return (
        <div className="properties-panel">
          <h5>Properties</h5>
          <div className="alert alert-info">
            Select a node to edit its properties.
          </div>
        </div>
      );
    }
    
    // Render different properties based on node type
    switch (selectedNode.type) {
      case 'call':
        return <CallProperties node={selectedNode} onUpdate={onUpdate} />;
      case 'wait':
        return <WaitProperties node={selectedNode} onUpdate={onUpdate} />;
      case 'condition':
        return <ConditionProperties node={selectedNode} onUpdate={onUpdate} />;
      case 'sms':
        return <SmsProperties node={selectedNode} onUpdate={onUpdate} />;
      default:
        return (
          <div className="properties-panel">
            <h5>Properties</h5>
            <div className="alert alert-info">
              No editable properties for this node type.
            </div>
          </div>
        );
    }
  }
  ```

### 3.2 Implement Validation for Element Properties
- [x] Add validation for Call properties
  ```javascript
  function validateCallProperties(properties) {
    const errors = {};
    
    if (!properties.priority) {
      errors.priority = 'Priority is required';
    }
    
    return errors;
  }
  ```

- [x] Add validation for Wait properties
  ```javascript
  function validateWaitProperties(properties) {
    const errors = {};
    
    if (!properties.minutes) {
      errors.minutes = 'Minutes is required';
    } else if (properties.minutes <= 0) {
      errors.minutes = 'Minutes must be greater than 0';
    }
    
    return errors;
  }
  ```

- [x] Add validation for Condition properties
  ```javascript
  function validateConditionProperties(properties) {
    const errors = {};
    
    if (!properties.field) {
      errors.field = 'Field is required';
    }
    
    if (!properties.operator) {
      errors.operator = 'Operator is required';
    }
    
    return errors;
  }
  ```

### 3.3 Add Support for Dynamic Properties
- [x] Implement dynamic field rendering based on node type
  ```javascript
  function renderDynamicFields(nodeType, properties, onChange) {
    switch (nodeType) {
      case 'call':
        return (
          <>
            <div className="mb-3">
              <label htmlFor="priority" className="form-label">Priority</label>
              <select 
                className="form-select" 
                id="priority" 
                value={properties.priority || 1}
                onChange={(e) => onChange('priority', parseInt(e.target.value))}
              >
                <option value={1}>Normal</option>
                <option value={2}>High</option>
                <option value={3}>Urgent</option>
              </select>
            </div>
          </>
        );
      
      case 'wait':
        return (
          <>
            <div className="mb-3">
              <label htmlFor="minutes" className="form-label">Minutes</label>
              <input 
                type="number" 
                className="form-control" 
                id="minutes" 
                value={properties.minutes || 30}
                onChange={(e) => onChange('minutes', parseInt(e.target.value))}
                min={1}
              />
            </div>
            <div className="form-check mb-3">
              <input 
                className="form-check-input" 
                type="checkbox" 
                id="respectHours" 
                checked={properties.respectHours || false}
                onChange={(e) => onChange('respectHours', e.target.checked)}
              />
              <label className="form-check-label" htmlFor="respectHours">
                Respect Business Hours
              </label>
            </div>
          </>
        );
      
      // Add cases for other node types
      
      default:
        return null;
    }
  }
  ```

## 4. Workflow Conversion and Persistence

### 4.1 Convert Visual Flow to Workflow Model
- [x] Implement conversion from React Flow to workflow model
  ```javascript
  function convertFlowToWorkflow(nodes, edges) {
    // Create steps array
    const steps = nodes.map(node => {
      const step = {
        id: node.id,
        type: node.type,
        name: node.data.label,
        position: node.position
      };
      
      // Add type-specific properties
      switch (node.type) {
        case 'call':
          step.properties = {
            priority: node.data.priority || 1
          };
          break;
        case 'wait':
          step.properties = {
            minutes: node.data.minutes || 30,
            respect_hours: node.data.respectHours || false
          };
          break;
        case 'condition':
          step.condition = {
            field: node.data.field || '',
            operator: node.data.operator || '',
            value: node.data.value || ''
          };
          break;
        case 'sms':
          step.properties = {
            message: node.data.message || ''
          };
          break;
      }
      
      return step;
    });
    
    // Process edges to set next steps
    edges.forEach(edge => {
      const sourceStep = steps.find(step => step.id === edge.source);
      const targetStep = steps.find(step => step.id === edge.target);
      
      if (sourceStep && targetStep) {
        if (sourceStep.type === 'condition') {
          // For condition nodes, set true_branch or false_branch based on the handle
          if (edge.sourceHandle === 'true') {
            sourceStep.true_branch = targetStep.id;
          } else if (edge.sourceHandle === 'false') {
            sourceStep.false_branch = targetStep.id;
          }
        } else {
          // For other nodes, set next_step
          sourceStep.next_step = targetStep.id;
        }
      }
    });
    
    return steps;
  }
  ```

### 4.2 Convert Workflow Model to Visual Flow
- [x] Implement conversion from workflow model to React Flow
  ```javascript
  function convertWorkflowToFlow(workflow) {
    // Create nodes
    const nodes = workflow.steps.map(step => {
      const node = {
        id: step.id,
        type: step.type,
        position: step.position || { x: 0, y: 0 },
        data: { label: step.name }
      };
      
      // Add type-specific data
      switch (step.type) {
        case 'call':
          node.data.priority = step.properties?.priority || 1;
          break;
        case 'wait':
          node.data.minutes = step.properties?.minutes || 30;
          node.data.respectHours = step.properties?.respect_hours || false;
          break;
        case 'condition':
          node.data.field = step.condition?.field || '';
          node.data.operator = step.condition?.operator || '';
          node.data.value = step.condition?.value || '';
          break;
        case 'sms':
          node.data.message = step.properties?.message || '';
          break;
      }
      
      return node;
    });
    
    // Create edges
    const edges = [];
    
    workflow.steps.forEach(step => {
      if (step.next_step) {
        edges.push({
          id: `e${step.id}-${step.next_step}`,
          source: step.id,
          target: step.next_step,
          type: 'smoothstep'
        });
      }
      
      if (step.true_branch) {
        edges.push({
          id: `e${step.id}-${step.true_branch}-true`,
          source: step.id,
          target: step.true_branch,
          sourceHandle: 'true',
          type: 'smoothstep'
        });
      }
      
      if (step.false_branch) {
        edges.push({
          id: `e${step.id}-${step.false_branch}-false`,
          source: step.id,
          target: step.false_branch,
          sourceHandle: 'false',
          type: 'smoothstep'
        });
      }
    });
    
    return { nodes, edges };
  }
  ```

### 4.3 Implement Save and Load Functionality
- [x] Add save functionality
  ```javascript
  async function saveWorkflow() {
    try {
      // Get current nodes and edges
      const nodes = reactFlowInstance.getNodes();
      const edges = reactFlowInstance.getEdges();
      
      // Update workflow data
      workflow.name = document.getElementById('workflow-name').value.trim();
      workflow.description = document.getElementById('workflow-description').value.trim();
      workflow.active = document.getElementById('workflow-active').checked;
      
      // Convert flow to workflow steps
      workflow.steps = convertFlowToWorkflow(nodes, edges);
      
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
          window.history.pushState({}, '', `/workflow-editor-visual.html?id=${workflowId}`);
      }
      
      alert('Workflow saved successfully');
    } catch (error) {
      console.error('Error saving workflow:', error);
      alert(`Error saving workflow: ${error.message}`);
    }
  }
  ```

- [x] Add load functionality
  ```javascript
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
      document.getElementById('workflow-name').value = workflow.name;
      document.getElementById('workflow-description').value = workflow.description || '';
      document.getElementById('workflow-active').checked = workflow.active;
      
      // Convert workflow to flow
      const { nodes, edges } = convertWorkflowToFlow(workflow);
      
      // Set nodes and edges in React Flow
      reactFlowInstance.setNodes(nodes);
      reactFlowInstance.setEdges(edges);
      
      // Fit view to see all nodes
      reactFlowInstance.fitView();
    } catch (error) {
      console.error('Error loading workflow:', error);
      alert(`Error loading workflow: ${error.message}`);
    }
  }