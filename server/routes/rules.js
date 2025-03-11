// Rules API routes for Twilio Dialer Web App
const express = require('express');
const router = express.Router();
const rulesManager = require('../rules-manager');
const auth = require('../auth');

// Get rules
router.get('/', auth.isAuthenticated, auth.isAdmin, (req, res) => {
  try {
    const rules = rulesManager.getRules();
    res.json({ rules });
  } catch (error) {
    console.error('Error getting rules:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update rules
router.post('/', auth.isAuthenticated, auth.isAdmin, (req, res) => {
  try {
    const { rules } = req.body;
    
    if (!rules) {
      return res.status(400).json({ error: 'Rules data is required' });
    }
    
    const updatedRules = rulesManager.updateRules(rules);
    res.json({ rules: updatedRules });
  } catch (error) {
    console.error('Error updating rules:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;