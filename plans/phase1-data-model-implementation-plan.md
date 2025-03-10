# Phase 1: Data Model and Backend Foundation - Detailed Implementation Plan

## 1. Workflow Data Model Design

### 1.1 Define Workflow Schema
- [x] Create basic workflow structure
  ```javascript
  {
    id: String,              // Unique identifier
    name: String,            // Display name
    description: String,     // Description
    active: Boolean,         // Whether workflow is active
    created_at: Date,        // Creation timestamp
    updated_at: Date,        // Last update timestamp
    triggers: Array,         // What activates this workflow
    steps: Array,            // Workflow steps
    business_hours: Object   // Business hours configuration
  }
  ```

- [x] Define trigger types
  ```javascript
  {
    type: String,            // "new_lead", "scheduled", "manual"
    priority: Number,        // Priority level (1-3)
    conditions: Array        // Optional conditions for trigger
  }
  ```

- [x] Define step structure
  ```javascript
  {
    id: String,              // Unique step identifier
    type: String,            // "call", "wait", "condition", "sms", etc.
    name: String,            // Display name
    properties: Object,      // Step-specific properties
    next_step: String,       // ID of next step (for linear flows)
    position: {x: Number, y: Number} // Position in visual editor
  }
  ```

- [x] Define condition step structure
  ```javascript
  {
    id: String,
    type: "condition",
    condition: {
      field: String,         // Field to check
      operator: String,      // "equals", "not_equals", "contains", etc.
      value: Any             // Value to compare against
    },
    true_branch: String,     // Step ID for true condition
    false_branch: String     // Step ID for false condition
  }
  ```

- [x] Define wait step structure
  ```javascript
  {
    id: String,
    type: "wait",
    properties: {
      minutes: Number,       // Minutes to wait
      respect_hours: Boolean // Whether to respect business hours
    }
  }
  ```

### 1.2 Design Storage Structure in memory-store.js
- [x] Add workflows array to MemoryStore class
  ```javascript
  this.workflows = [
    // Sample default workflow
    {
      id: "default",
      name: "Default Lead Follow-up",
      description: "Default workflow for new leads",
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      triggers: [
        { type: "new_lead", priority: 3 }
      ],
      steps: [
        // Sample steps
      ],
      business_hours: {
        enabled: true,
        timezone: "America/New_York",
        days: [1, 2, 3, 4, 5],
        start_time: "09:00",
        end_time: "17:00"
      }
    }
  ];
  ```

- [x] Add workflow CRUD methods to MemoryStore
  ```javascript
  // Get all workflows
  getAllWorkflows() { ... }
  
  // Get workflow by ID
  getWorkflowById(id) { ... }
  
  // Create workflow
  createWorkflow(workflow) { ... }
  
  // Update workflow
  updateWorkflow(id, workflow) { ... }
  
  // Delete workflow
  deleteWorkflow(id) { ... }
  
  // Activate/deactivate workflow
  setWorkflowActive(id, active) { ... }
  ```

- [x] Add nextId for workflows
  ```javascript
  this.nextId = {
    // ... existing IDs
    workflows: 1
  };
  ```

## 2. Enhance rules-manager.js to Support Multiple Workflows

### 2.1 Add Workflow Storage and Retrieval Methods
- [x] Create WorkflowManager class
  ```javascript
  class WorkflowManager {
    constructor() {
      // Initialize with store reference
    }
    
    // Get all workflows
    getWorkflows() { ... }
    
    // Get active workflows
    getActiveWorkflows() { ... }
    
    // Get workflow by ID
    getWorkflow(id) { ... }
    
    // Create workflow
    createWorkflow(workflow) { ... }
    
    // Update workflow
    updateWorkflow(id, workflow) { ... }
    
    // Delete workflow
    deleteWorkflow(id) { ... }
    
    // Activate workflow
    activateWorkflow(id) { ... }
    
    // Deactivate workflow
    deactivateWorkflow(id) { ... }
  }
  ```

### 2.2 Implement Workflow Execution Engine
- [x] Create WorkflowExecutor class
  ```javascript
  class WorkflowExecutor {
    constructor() {
      // Initialize with store and queue manager references
    }
    
    // Process a trigger event
    processTrigger(triggerType, data) { ... }
    
    // Find workflows matching a trigger
    findMatchingWorkflows(triggerType, data) { ... }
    
    // Execute a workflow
    executeWorkflow(workflow, data) { ... }
    
    // Execute a single step
    executeStep(step, context) { ... }
    
    // Handle different step types
    executeCallStep(step, context) { ... }
    executeWaitStep(step, context) { ... }
    executeConditionStep(step, context) { ... }
    executeSmsStep(step, context) { ... }
    // etc.
  }
  ```

### 2.3 Add Support for Timing and Scheduling
- [x] Create WorkflowScheduler class
  ```javascript
  class WorkflowScheduler {
    constructor() {
      this.scheduledTasks = new Map();
    }
    
    // Schedule a task for future execution
    scheduleTask(taskId, timestamp, task) { ... }
    
    // Cancel a scheduled task
    cancelTask(taskId) { ... }
    
    // Process due tasks
    processDueTasks() { ... }
    
    // Check if time is within business hours
    isWithinBusinessHours(time, businessHours) { ... }
    
    // Calculate next execution time respecting business hours
    calculateNextExecutionTime(delay, businessHours) { ... }
  }
  ```

- [x] Add interval to check for scheduled tasks
  ```javascript
  setInterval(() => {
    workflowScheduler.processDueTasks();
  }, 60000); // Check every minute
  ```

## 3. Create Workflow API Endpoints

### 3.1 Create routes/workflows.js
- [x] Set up basic router
  ```javascript
  const express = require('express');
  const router = express.Router();
  const workflowManager = require('../workflow-manager');
  const auth = require('../auth');
  
  // Middleware to check if user is authenticated
  router.use(auth.isAuthenticated);
  
  // Export router
  module.exports = router;
  ```

### 3.2 Implement GET /api/workflows
- [x] Add route to get all workflows
  ```javascript
  // Get all workflows
  router.get('/', auth.isAdmin, async (req, res) => {
    try {
      const workflows = await workflowManager.getWorkflows();
      res.json({ workflows });
    } catch (error) {
      console.error('Error getting workflows:', error);
      res.status(500).json({ error: 'Failed to get workflows' });
    }
  });
  ```

### 3.3 Implement GET /api/workflows/:id
- [x] Add route to get a specific workflow
  ```javascript
  // Get workflow by ID
  router.get('/:id', auth.isAdmin, async (req, res) => {
    try {
      const workflow = await workflowManager.getWorkflow(req.params.id);
      
      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' });
      }
      
      res.json({ workflow });
    } catch (error) {
      console.error('Error getting workflow:', error);
      res.status(500).json({ error: 'Failed to get workflow' });
    }
  });
  ```

### 3.4 Implement POST /api/workflows
- [x] Add route to create a new workflow
  ```javascript
  // Create a new workflow
  router.post('/', auth.isAdmin, async (req, res) => {
    try {
      const { name, description, triggers, steps, business_hours } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }
      
      const workflow = {
        name,
        description: description || '',
        active: false, // Default to inactive
        triggers: triggers || [],
        steps: steps || [],
        business_hours: business_hours || {
          enabled: false,
          timezone: 'America/New_York',
          days: [1, 2, 3, 4, 5],
          start_time: '09:00',
          end_time: '17:00'
        }
      };
      
      const result = await workflowManager.createWorkflow(workflow);
      res.status(201).json({ workflow: result });
    } catch (error) {
      console.error('Error creating workflow:', error);
      res.status(500).json({ error: 'Failed to create workflow' });
    }
  });
  ```

### 3.5 Implement PUT /api/workflows/:id
- [x] Add route to update a workflow
  ```javascript
  // Update a workflow
  router.put('/:id', auth.isAdmin, async (req, res) => {
    try {
      const { name, description, triggers, steps, business_hours } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }
      
      const workflow = {
        name,
        description: description || '',
        triggers: triggers || [],
        steps: steps || [],
        business_hours: business_hours || {
          enabled: false,
          timezone: 'America/New_York',
          days: [1, 2, 3, 4, 5],
          start_time: '09:00',
          end_time: '17:00'
        },
        updated_at: new Date().toISOString()
      };
      
      const result = await workflowManager.updateWorkflow(req.params.id, workflow);
      
      if (!result) {
        return res.status(404).json({ error: 'Workflow not found' });
      }
      
      res.json({ workflow: result });
    } catch (error) {
      console.error('Error updating workflow:', error);
      res.status(500).json({ error: 'Failed to update workflow' });
    }
  });
  ```

### 3.6 Implement DELETE /api/workflows/:id
- [x] Add route to delete a workflow
  ```javascript
  // Delete a workflow
  router.delete('/:id', auth.isAdmin, async (req, res) => {
    try {
      const result = await workflowManager.deleteWorkflow(req.params.id);
      
      if (!result) {
        return res.status(404).json({ error: 'Workflow not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting workflow:', error);
      res.status(500).json({ error: 'Failed to delete workflow' });
    }
  });
  ```

### 3.7 Implement POST /api/workflows/:id/activate
- [x] Add route to activate a workflow
  ```javascript
  // Activate a workflow
  router.post('/:id/activate', auth.isAdmin, async (req, res) => {
    try {
      const result = await workflowManager.activateWorkflow(req.params.id);
      
      if (!result) {
        return res.status(404).json({ error: 'Workflow not found' });
      }
      
      res.json({ success: true, workflow: result });
    } catch (error) {
      console.error('Error activating workflow:', error);
      res.status(500).json({ error: 'Failed to activate workflow' });
    }
  });
  ```

### 3.8 Implement POST /api/workflows/:id/deactivate
- [x] Add route to deactivate a workflow
  ```javascript
  // Deactivate a workflow
  router.post('/:id/deactivate', auth.isAdmin, async (req, res) => {
    try {
      const result = await workflowManager.deactivateWorkflow(req.params.id);
      
      if (!result) {
        return res.status(404).json({ error: 'Workflow not found' });
      }
      
      res.json({ success: true, workflow: result });
    } catch (error) {
      console.error('Error deactivating workflow:', error);
      res.status(500).json({ error: 'Failed to deactivate workflow' });
    }
  });
  ```

### 3.9 Update index.js to Use Workflow Routes
- [x] Import workflow routes
  ```javascript
  const workflowRoutes = require('./routes/workflows');
  ```

- [x] Add workflow routes to app
  ```javascript
  app.use('/api/workflows', workflowRoutes);