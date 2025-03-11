/**
 * Monitoring API Routes for Twilio Dialer Web App
 * 
 * This file contains API routes for the monitoring service, providing access to
 * system metrics, agent metrics, and alerts.
 */
const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../auth');
const monitoringService = require('../services/monitoring-service');
const errorService = require('../services/error-service');

/**
 * @route GET /api/monitoring/system
 * @description Get system metrics
 * @access Admin
 */
router.get('/system', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const metrics = monitoringService.getSystemMetrics();
    
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    const errorInfo = await errorService.handleError(error, 'monitoring.getSystemMetrics');
    console.error('Error getting system metrics:', errorInfo);
    
    res.status(500).json({
      success: false,
      error: 'Error getting system metrics',
      details: errorInfo.message
    });
  }
});

/**
 * @route GET /api/monitoring/agents
 * @description Get all agent metrics
 * @access Admin
 */
router.get('/agents', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const metrics = monitoringService.getAgentMetrics();
    
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    const errorInfo = await errorService.handleError(error, 'monitoring.getAgentMetrics');
    console.error('Error getting agent metrics:', errorInfo);
    
    res.status(500).json({
      success: false,
      error: 'Error getting agent metrics',
      details: errorInfo.message
    });
  }
});

/**
 * @route GET /api/monitoring/agents/:agentId
 * @description Get metrics for a specific agent
 * @access Admin
 */
router.get('/agents/:agentId', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const metrics = monitoringService.getAgentMetrics(agentId);
    
    if (!metrics) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }
    
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    const errorInfo = await errorService.handleError(error, 'monitoring.getAgentMetrics');
    console.error('Error getting agent metrics:', errorInfo);
    
    res.status(500).json({
      success: false,
      error: 'Error getting agent metrics',
      details: errorInfo.message
    });
  }
});

/**
 * @route GET /api/monitoring/alerts
 * @description Get all alerts
 * @access Admin
 */
router.get('/alerts', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const includeAcknowledged = req.query.includeAcknowledged === 'true';
    const alerts = monitoringService.getAlerts(includeAcknowledged);
    
    res.json({
      success: true,
      alerts
    });
  } catch (error) {
    const errorInfo = await errorService.handleError(error, 'monitoring.getAlerts');
    console.error('Error getting alerts:', errorInfo);
    
    res.status(500).json({
      success: false,
      error: 'Error getting alerts',
      details: errorInfo.message
    });
  }
});

/**
 * @route POST /api/monitoring/alerts/:alertId/acknowledge
 * @description Acknowledge an alert
 * @access Admin
 */
router.post('/alerts/:alertId/acknowledge', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const alertId = req.params.alertId;
    const acknowledged = monitoringService.acknowledgeAlert(alertId);
    
    if (!acknowledged) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Alert acknowledged'
    });
  } catch (error) {
    const errorInfo = await errorService.handleError(error, 'monitoring.acknowledgeAlert');
    console.error('Error acknowledging alert:', errorInfo);
    
    res.status(500).json({
      success: false,
      error: 'Error acknowledging alert',
      details: errorInfo.message
    });
  }
});

/**
 * @route GET /api/monitoring/historical
 * @description Get historical metrics
 * @access Admin
 */
router.get('/historical', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const metrics = await monitoringService.getHistoricalMetrics();
    
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    const errorInfo = await errorService.handleError(error, 'monitoring.getHistoricalMetrics');
    console.error('Error getting historical metrics:', errorInfo);
    
    res.status(500).json({
      success: false,
      error: 'Error getting historical metrics',
      details: errorInfo.message
    });
  }
});

/**
 * @route POST /api/monitoring/log
 * @description Manually log current metrics
 * @access Admin
 */
router.post('/log', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const result = await monitoringService.logMetrics();
    
    res.json({
      success: result,
      message: result ? 'Metrics logged successfully' : 'Failed to log metrics'
    });
  } catch (error) {
    const errorInfo = await errorService.handleError(error, 'monitoring.logMetrics');
    console.error('Error logging metrics:', errorInfo);
    
    res.status(500).json({
      success: false,
      error: 'Error logging metrics',
      details: errorInfo.message
    });
  }
});

module.exports = router;