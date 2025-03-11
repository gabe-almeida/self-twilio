// Contact Center Routes for Twilio Dialer Web App
const express = require('express');
const router = express.Router();
const contactCenterService = require('../services/contact-center-service');
const auth = require('../auth');

/**
 * @route   GET /api/contact-centers
 * @desc    Get all contact centers
 * @access  Admin
 */
router.get('/', auth.isAdmin, async (req, res) => {
  try {
    const contactCenters = await contactCenterService.getAllContactCenters();
    
    res.json({
      success: true,
      contactCenters
    });
  } catch (error) {
    console.error('Error getting contact centers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/contact-centers/:id
 * @desc    Get a contact center by ID
 * @access  Admin
 */
router.get('/:id', auth.isAdmin, async (req, res) => {
  try {
    const contactCenter = await contactCenterService.getContactCenterById(req.params.id);
    
    if (!contactCenter) {
      return res.status(404).json({ success: false, error: 'Contact center not found' });
    }
    
    res.json({
      success: true,
      contactCenter
    });
  } catch (error) {
    console.error('Error getting contact center:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/contact-centers
 * @desc    Create a new contact center
 * @access  Admin
 */
router.post('/', auth.isAdmin, async (req, res) => {
  try {
    const { name, description, settings } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }
    
    const contactCenter = await contactCenterService.createContactCenter({
      name,
      description,
      settings
    });
    
    res.status(201).json({
      success: true,
      contactCenter
    });
  } catch (error) {
    console.error('Error creating contact center:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   PUT /api/contact-centers/:id
 * @desc    Update a contact center
 * @access  Admin
 */
router.put('/:id', auth.isAdmin, async (req, res) => {
  try {
    const { name, description, active, settings } = req.body;
    const id = req.params.id;
    
    // Check if contact center exists
    const existingCenter = await contactCenterService.getContactCenterById(id);
    if (!existingCenter) {
      return res.status(404).json({ success: false, error: 'Contact center not found' });
    }
    
    // Update the contact center
    const updatedCenter = await contactCenterService.updateContactCenter(id, {
      name,
      description,
      active,
      settings
    });
    
    res.json({
      success: true,
      contactCenter: updatedCenter
    });
  } catch (error) {
    console.error('Error updating contact center:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   DELETE /api/contact-centers/:id
 * @desc    Delete a contact center
 * @access  Admin
 */
router.delete('/:id', auth.isAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    
    // Check if contact center exists
    const existingCenter = await contactCenterService.getContactCenterById(id);
    if (!existingCenter) {
      return res.status(404).json({ success: false, error: 'Contact center not found' });
    }
    
    // Delete the contact center
    await contactCenterService.deleteContactCenter(id);
    
    res.json({
      success: true,
      message: 'Contact center deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting contact center:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/contact-centers/:id/agents
 * @desc    Get all agents in a contact center
 * @access  Admin
 */
router.get('/:id/agents', auth.isAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    
    // Check if contact center exists
    const existingCenter = await contactCenterService.getContactCenterById(id);
    if (!existingCenter) {
      return res.status(404).json({ success: false, error: 'Contact center not found' });
    }
    
    // Get agents in the contact center
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

/**
 * @route   POST /api/contact-centers/:id/agents
 * @desc    Add an agent to a contact center
 * @access  Admin
 */
router.post('/:id/agents', auth.isAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const { userId, role } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }
    
    // Add the agent to the contact center
    const result = await contactCenterService.addAgentToContactCenter(id, userId, role || 'agent');
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Error adding agent to contact center:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   DELETE /api/contact-centers/:id/agents/:userId
 * @desc    Remove an agent from a contact center
 * @access  Admin
 */
router.delete('/:id/agents/:userId', auth.isAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.params.userId;
    
    // Remove the agent from the contact center
    const result = await contactCenterService.removeAgentFromContactCenter(id, userId);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error removing agent from contact center:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/contact-centers/:id/phones
 * @desc    Get all phone numbers for a contact center
 * @access  Admin
 */
router.get('/:id/phones', auth.isAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    
    // Check if contact center exists
    const existingCenter = await contactCenterService.getContactCenterById(id);
    if (!existingCenter) {
      return res.status(404).json({ success: false, error: 'Contact center not found' });
    }
    
    // Get phone numbers for the contact center
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

/**
 * @route   POST /api/contact-centers/:id/phones
 * @desc    Add a phone number to a contact center
 * @access  Admin
 */
router.post('/:id/phones', auth.isAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const { phone_number, friendly_name, direction, is_default } = req.body;
    
    if (!phone_number) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }
    
    // Add the phone number to the contact center
    const result = await contactCenterService.addPhoneNumberToContactCenter(id, {
      phone_number,
      friendly_name,
      direction,
      is_default
    });
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Error adding phone number to contact center:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   DELETE /api/contact-centers/phones/:id
 * @desc    Remove a phone number from a contact center
 * @access  Admin
 */
router.delete('/phones/:id', auth.isAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    
    // Remove the phone number
    const result = await contactCenterService.removePhoneNumberFromContactCenter(id);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error removing phone number from contact center:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/contact-centers/:id/available-agents
 * @desc    Get available agents in a contact center
 * @access  Admin
 */
router.get('/:id/available-agents', auth.isAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    
    // Check if contact center exists
    const existingCenter = await contactCenterService.getContactCenterById(id);
    if (!existingCenter) {
      return res.status(404).json({ success: false, error: 'Contact center not found' });
    }
    
    // Get available agents in the contact center
    const agents = await contactCenterService.getAvailableContactCenterAgents(id);
    
    res.json({
      success: true,
      agents
    });
  } catch (error) {
    console.error('Error getting available contact center agents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;