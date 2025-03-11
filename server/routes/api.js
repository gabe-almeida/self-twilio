// API routes for Twilio Dialer Web App
const express = require('express');
const router = express.Router();
const config = require('../config');
const { isAuthenticated } = require('../auth');
const store = require('../memory-store');
const workflowManager = require('../workflow-manager');

// Get server configuration
router.get('/config', (req, res) => {
  // Return a subset of the configuration that's safe to expose to clients
  const clientConfig = {
    SERVER_BASE_URL: config.SERVER_BASE_URL,
    DEFAULT_CALLER_ID: config.DEFAULT_CALLER_ID
  };
  
  res.json(clientConfig);
});

// Update call disposition
router.post('/call-history/:callId/disposition', isAuthenticated, async (req, res) => {
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
    
    await store.callHistory.updateById(callId, updatedCall);
    
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

module.exports = router;