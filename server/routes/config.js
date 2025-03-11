/**
 * Configuration API Routes
 * 
 * This module provides endpoints for managing system configuration,
 * particularly Twilio credentials and server settings.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const twilio = require('twilio');
const { requireAuth, requireAdmin } = require('../auth');

// Config file path
const CONFIG_FILE_PATH = path.join(__dirname, '../config/config.json');

/**
 * GET /api/config
 * Retrieves the current system configuration with sensitive information masked
 */
router.get('/', requireAuth, requireAdmin, function(req, res) {
  try {
    // Read the configuration file
    let config = {};
    
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const configData = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
      config = JSON.parse(configData);
    } else {
      // If config file doesn't exist, create a default structure
      config = {
        twilio: {
          accountSid: '',
          twimlAppSid: '',
          apiKey: ''
        },
        server: {
          baseUrl: '',
          defaultCallerId: ''
        }
      };
    }
    
    // Create a sanitized version without actual secret values (but indicate they exist)
    const sanitizedConfig = {
      twilio: {
        accountSid: config.twilio?.accountSid || '',
        authToken: config.twilio?.authToken ? '[MASKED]' : '',
        twimlAppSid: config.twilio?.twimlAppSid || '',
        apiKey: config.twilio?.apiKey || '',
        apiSecret: config.twilio?.apiSecret ? '[MASKED]' : ''
      },
      server: {
        baseUrl: config.server?.baseUrl || '',
        defaultCallerId: config.server?.defaultCallerId || ''
      }
    };
    
    return res.json({
      success: true,
      config: sanitizedConfig
    });
  } catch (error) {
    console.error('Error retrieving configuration:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving configuration',
      error: error.message
    });
  }
});

/**
 * POST /api/config
 * Updates the system configuration
 */
router.post('/', requireAuth, requireAdmin, function(req, res) {
  try {
    // Validate the request
    const { twilio, server } = req.body;
    
    if (!twilio || !twilio.accountSid) {
      return res.status(400).json({
        success: false,
        message: 'Twilio Account SID is required'
      });
    }
    
    // Read the existing configuration if it exists
    let config = {
      twilio: {},
      server: {}
    };
    
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const configData = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
      config = JSON.parse(configData);
    }
    
    // Update the configuration, preserving fields that weren't included
    // Twilio credentials
    config.twilio.accountSid = twilio.accountSid;
    
    // Only update secrets if they were provided (to avoid overwriting with empty values)
    if (twilio.authToken) config.twilio.authToken = twilio.authToken;
    if (twilio.twimlAppSid) config.twilio.twimlAppSid = twilio.twimlAppSid;
    if (twilio.apiKey) config.twilio.apiKey = twilio.apiKey;
    if (twilio.apiSecret) config.twilio.apiSecret = twilio.apiSecret;
    
    // Server settings
    if (server) {
      if (server.baseUrl !== undefined) config.server.baseUrl = server.baseUrl;
      if (server.defaultCallerId !== undefined) config.server.defaultCallerId = server.defaultCallerId;
    }
    
    // Create the config directory if it doesn't exist
    const configDir = path.dirname(CONFIG_FILE_PATH);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Write the updated configuration to the file
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(config, null, 2), 'utf8');
    
    return res.json({
      success: true,
      message: 'Configuration updated successfully'
    });
  } catch (error) {
    console.error('Error updating configuration:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating configuration',
      error: error.message
    });
  }
});

/**
 * POST /api/config/test-twilio
 * Tests the Twilio connection using the stored credentials
 */
router.post('/test-twilio', requireAuth, requireAdmin, async function(req, res) {
  try {
    // Read the configuration file
    if (!fs.existsSync(CONFIG_FILE_PATH)) {
      return res.status(404).json({
        success: false,
        message: 'Configuration file not found'
      });
    }
    
    const configData = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
    const config = JSON.parse(configData);
    
    if (!config.twilio || !config.twilio.accountSid || !config.twilio.authToken) {
      return res.status(400).json({
        success: false,
        message: 'Twilio credentials are not configured'
      });
    }
    
    // Initialize Twilio client with the stored credentials
    const client = twilio(config.twilio.accountSid, config.twilio.authToken);
    
    // Test the connection by fetching account info
    const account = await client.api.accounts(config.twilio.accountSid).fetch();
    
    return res.json({
      success: true,
      message: 'Twilio connection successful',
      accountName: account.friendlyName,
      accountType: account.type,
      accountStatus: account.status
    });
  } catch (error) {
    console.error('Error testing Twilio connection:', error);
    
    // Handle common Twilio errors
    if (error.code === 20003) {
      return res.status(401).json({
        success: false,
        message: 'Authentication error: Invalid Twilio credentials'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Error testing Twilio connection',
      error: error.message
    });
  }
});

// Export the router
module.exports = router;