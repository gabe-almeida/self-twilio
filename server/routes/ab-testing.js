/**
 * A/B Testing API Routes for Twilio Dialer Web App
 * 
 * This file contains API routes for the A/B testing service, providing access to
 * test configurations and results.
 */
const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../auth');
const abTestingService = require('../services/ab-testing-service');
const errorService = require('../services/error-service');

/**
 * @route GET /api/ab-testing/tests
 * @description Get A/B test configurations
 * @access Admin
 */
router.get('/tests', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const tests = abTestingService.getTests();
    
    res.json({
      success: true,
      tests
    });
  } catch (error) {
    const errorInfo = await errorService.handleError(error, 'ab-testing.getTests');
    console.error('Error getting A/B tests:', errorInfo);
    
    res.status(500).json({
      success: false,
      error: 'Error getting A/B tests',
      details: errorInfo.message
    });
  }
});

/**
 * @route GET /api/ab-testing/results
 * @description Get A/B test results
 * @access Admin
 */
router.get('/results', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const results = abTestingService.getResults();
    
    res.json({
      success: true,
      results
    });
  } catch (error) {
    const errorInfo = await errorService.handleError(error, 'ab-testing.getResults');
    console.error('Error getting A/B test results:', errorInfo);
    
    res.status(500).json({
      success: false,
      error: 'Error getting A/B test results',
      details: errorInfo.message
    });
  }
});

/**
 * @route POST /api/ab-testing/record
 * @description Record a test result
 * @access Admin
 */
router.post('/record', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { testName, variant, success, metrics } = req.body;
    
    if (!testName || !variant) {
      return res.status(400).json({
        success: false,
        error: 'Test name and variant are required'
      });
    }
    
    abTestingService.recordResult(testName, variant, success, metrics);
    
    res.json({
      success: true,
      message: 'Test result recorded'
    });
  } catch (error) {
    const errorInfo = await errorService.handleError(error, 'ab-testing.recordResult');
    console.error('Error recording test result:', errorInfo);
    
    res.status(500).json({
      success: false,
      error: 'Error recording test result',
      details: errorInfo.message
    });
  }
});

/**
 * @route GET /api/ab-testing/variant/:test
 * @description Get a variant for a test
 * @access Admin
 */
router.get('/variant/:test', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const testName = req.params.test;
    const entityId = req.query.entityId;
    
    if (!testName) {
      return res.status(400).json({
        success: false,
        error: 'Test name is required'
      });
    }
    
    const variant = abTestingService.getVariant(testName, entityId);
    
    res.json({
      success: true,
      variant
    });
  } catch (error) {
    const errorInfo = await errorService.handleError(error, 'ab-testing.getVariant');
    console.error('Error getting variant:', errorInfo);
    
    res.status(500).json({
      success: false,
      error: 'Error getting variant',
      details: errorInfo.message
    });
  }
});

module.exports = router;