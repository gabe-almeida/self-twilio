// Workflow API routes for Twilio Dialer Web App
const express = require('express');
const router = express.Router();
const store = require('../memory-store');
const auth = require('../auth');
const workflowManager = require('../workflow-manager');

// Middleware to check if user is authenticated
router.use(auth.isAuthenticated);

// Get all workflows
router.get('/', auth.isAdmin, async (req, res) => {
  try {
    const workflows = await store.workflows.getAll();
    res.json({ workflows });
  } catch (error) {
    console.error('Error getting workflows:', error);
    res.status(500).json({ error: 'Failed to get workflows' });
  }
});

// Get active workflows
router.get('/active', auth.isAdmin, async (req, res) => {
  try {
    const workflows = await store.workflows.getActive();
    res.json({ workflows });
  } catch (error) {
    console.error('Error getting active workflows:', error);
    res.status(500).json({ error: 'Failed to get active workflows' });
  }
});

// Get workflow by ID
router.get('/:id', auth.isAdmin, async (req, res) => {
  try {
    const workflow = await store.workflows.getById(req.params.id);
    
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    res.json({ workflow });
  } catch (error) {
    console.error('Error getting workflow:', error);
    res.status(500).json({ error: 'Failed to get workflow' });
  }
});

// Create a new workflow
router.post('/', auth.isAdmin, async (req, res) => {
  try {
    const { name, description, triggers, steps, business_hours, active } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const workflow = {
      name,
      description: description || '',
      active: active || false,
      triggers: triggers || [],
      steps: steps || [],
      business_hours: business_hours || {
        enabled: true,
        timezone: 'America/New_York',
        days: [1, 2, 3, 4, 5],
        start_time: '09:00',
        end_time: '17:00'
      }
    };
    
    const result = await store.workflows.create(workflow);
    res.status(201).json({ workflow: result });
  } catch (error) {
    console.error('Error creating workflow:', error);
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

// Update a workflow
router.put('/:id', auth.isAdmin, async (req, res) => {
  try {
    const { name, description, triggers, steps, business_hours, active } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const workflow = {
      name,
      description: description || '',
      active: active !== undefined ? active : undefined,
      triggers: triggers || undefined,
      steps: steps || undefined,
      business_hours: business_hours || undefined
    };
    
    const result = await store.workflows.update(req.params.id, workflow);
    
    if (!result) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    res.json({ workflow: result });
  } catch (error) {
    console.error('Error updating workflow:', error);
    res.status(500).json({ error: 'Failed to update workflow' });
  }
});

// Delete a workflow
router.delete('/:id', auth.isAdmin, async (req, res) => {
  try {
    const result = await store.workflows.delete(req.params.id);
    
    if (!result) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    res.status(500).json({ error: 'Failed to delete workflow' });
  }
});

// Activate a workflow
router.post('/:id/activate', auth.isAdmin, async (req, res) => {
  try {
    const result = await store.workflows.activate(req.params.id);
    
    if (!result) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    res.json({ success: true, workflow: result });
  } catch (error) {
    console.error('Error activating workflow:', error);
    res.status(500).json({ error: 'Failed to activate workflow' });
  }
});

// Deactivate a workflow
router.post('/:id/deactivate', auth.isAdmin, async (req, res) => {
  try {
    const result = await store.workflows.deactivate(req.params.id);
    
    if (!result) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    res.json({ success: true, workflow: result });
  } catch (error) {
    console.error('Error deactivating workflow:', error);
    res.status(500).json({ error: 'Failed to deactivate workflow' });
  }
});

// Test a workflow
router.post('/:id/test', auth.isAdmin, async (req, res) => {
  try {
    const workflow = await store.workflows.getById(req.params.id);
    
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    // Create a test context
    const context = {
      lead: {
        phone_number: '+15555555555',
        contact_name: 'Test Contact',
        notes: 'Test workflow execution'
      },
      call: {
        disposition: 'no-answer'
      }
    };
    
    // Start the workflow with the test context
    const result = await workflowManager.startWorkflow(workflow, context);
    
    res.json({ 
      success: result,
      message: 'Workflow test started. Check logs for execution details.'
    });
  } catch (error) {
    console.error('Error testing workflow:', error);
    res.status(500).json({ error: 'Failed to test workflow' });
  }
});

module.exports = router;