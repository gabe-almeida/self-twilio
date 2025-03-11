// Agent Status Routes for Twilio Dialer Web App
/**
 * This module provides API routes for managing agent statuses.
 * It allows agents to update their status, get their current status,
 * and get information about time spent in status.
 */

const express = require('express');
const router = express.Router();
const passport = require('passport');
const agentStatusService = require('../services/agent-status-service');
const statusTransitionService = require('../services/status-transition-service');
const errorService = require('../services/error-service');

// Middleware to ensure user is authenticated
const authenticate = passport.authenticate('jwt', { session: false });

/**
 * @route GET /api/agent-status
 * @description Get all agent statuses
 * @access Private (Admin only)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Admin access required'
      });
    }
    
    // Get all agent statuses
    const statuses = await agentStatusService.getAgentsByStatus();
    
    return res.json({
      success: true,
      data: statuses
    });
  } catch (error) {
    errorService.handleError(error, 'agent-status-routes.getAll');
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @route GET /api/agent-status/me
 * @description Get current user's status
 * @access Private
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get time in status information
    const statusInfo = await agentStatusService.getTimeInStatus(userId);
    
    return res.json(statusInfo);
  } catch (error) {
    errorService.handleError(error, 'agent-status-routes.getMe');
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @route PUT /api/agent-status/me
 * @description Update current user's status
 * @access Private
 */
router.put('/me', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }
    
    // Validate status
    const validStatuses = Object.values(agentStatusService.AgentStatuses);
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }
    
    // Get current status
    const currentStatusObj = await agentStatusService.getTimeInStatus(userId);
    const currentStatus = currentStatusObj.success ? currentStatusObj.status : null;
    
    // Execute the transition
    const result = await statusTransitionService.executeTransition(
      userId,
      currentStatus,
      status,
      { source: 'api', userAgent: req.headers['user-agent'] }
    );
    
    if (result.success) {
      res.json({ success: true, status, previousStatus: currentStatus });
    } else if (result.canceled) {
      res.status(403).json({ error: result.reason });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    errorService.handleError(error, 'agent-status-routes.updateMe');
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @route GET /api/agent-status/by-status/:status
 * @description Get agents by status
 * @access Private (Admin only)
 */
router.get('/by-status/:status', authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Admin access required'
      });
    }
    
    const { status } = req.params;
    
    // Get agents with the specified status
    const agents = await agentStatusService.getAgentsByStatus(status);
    
    return res.json({
      success: true,
      data: agents
    });
  } catch (error) {
    errorService.handleError(error, 'agent-status-routes.getByStatus');
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @route GET /api/agent-status/available
 * @description Get available agents
 * @access Private (Admin only)
 */
router.get('/available', authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Admin access required'
      });
    }
    
    // Get agents with Available status
    const agents = await agentStatusService.getAgentsByStatus(agentStatusService.AgentStatuses.AVAILABLE);
    
    return res.json({
      success: true,
      data: agents
    });
  } catch (error) {
    errorService.handleError(error, 'agent-status-routes.getAvailable');
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @route GET /api/agent-status/in-status-longer-than/:status/:minutes
 * @description Get agents who have been in a status for longer than specified minutes
 * @access Private (Admin only)
 */
router.get('/in-status-longer-than/:status/:minutes', authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Admin access required'
      });
    }
    
    const { status, minutes } = req.params;
    
    // Get agents who have been in the status for longer than specified minutes
    const agents = await agentStatusService.getAgentsInStatusLongerThan(status, parseInt(minutes, 10));
    
    return res.json({
      success: true,
      data: agents
    });
  } catch (error) {
    errorService.handleError(error, 'agent-status-routes.getInStatusLongerThan');
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @route GET /api/agent-status/history
 * @description Get status transition history for the current user
 * @access Private
 */
router.get('/history', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;
    
    // Get transition history
    const history = await statusTransitionService.getTransitionHistory(userId, limit);
    
    return res.json(history);
  } catch (error) {
    errorService.handleError(error, 'agent-status-routes.getHistory');
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @route GET /api/agent-status/valid-transitions/:status
 * @description Get valid transitions for a status
 * @access Private
 */
router.get('/valid-transitions/:status', authenticate, async (req, res) => {
  try {
    const { status } = req.params;
    
    // Validate status
    const validStatuses = Object.values(agentStatusService.AgentStatuses);
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }
    
    // Get valid transitions
    const validTransitions = statusTransitionService.getValidTransitions(status);
    
    return res.json({
      success: true,
      status,
      validTransitions
    });
  } catch (error) {
    errorService.handleError(error, 'agent-status-routes.getValidTransitions');
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

/**
 * @route PUT /api/agent-status/:userId
 * @description Update an agent's status (admin only)
 * @access Private (Admin only)
 */
router.put('/:userId', authenticate, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Admin access required'
      });
    }
    
    const { userId } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }
    
    // Validate status
    const validStatuses = Object.values(agentStatusService.AgentStatuses);
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }
    
    // Get current status
    const currentStatusObj = await agentStatusService.getTimeInStatus(parseInt(userId, 10));
    const currentStatus = currentStatusObj.success ? currentStatusObj.status : null;
    
    // Execute the transition
    const result = await statusTransitionService.executeTransition(
      parseInt(userId, 10),
      currentStatus,
      status,
      { source: 'admin', adminId: req.user.id }
    );
    
    if (result.success) {
      res.json({ success: true, status, previousStatus: currentStatus });
    } else if (result.canceled) {
      res.status(403).json({ error: result.reason });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    errorService.handleError(error, 'agent-status-routes.updateUser');
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

module.exports = router;