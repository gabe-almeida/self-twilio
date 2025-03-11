/**
 * Rules API Routes Tests
 * 
 * These tests validate the rules API endpoints, including authentication,
 * authorization, and the core functionality of getting and updating rules.
 */

const request = require('supertest');
const express = require('express');
const sinon = require('sinon');

// Import modules to test and their dependencies
const rulesRouter = require('../../routes/rules');
const rulesManager = require('../../rules-manager');
const auth = require('../../auth');

describe('Rules API Routes', () => {
  let app;
  let sandbox;
  
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Create a test Express app
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware
    sandbox.stub(auth, 'isAuthenticated').callsFake((req, res, next) => {
      // Set a mock user on the request
      req.user = { id: 1, username: 'admin', role: 'admin' };
      next();
    });
    
    // Mock admin authorization middleware
    sandbox.stub(auth, 'isAdmin').callsFake((req, res, next) => {
      // If the request has a user with admin role, pass through
      if (req.user && req.user.role === 'admin') {
        return next();
      }
      // Otherwise, return an authorization error
      return res.status(403).json({ message: 'Access denied. Admin role required.' });
    });
    
    // Mock the rules manager
    sandbox.stub(rulesManager, 'getRules').returns([
      {
        id: 'business-hours',
        name: 'Business Hours',
        description: 'Only call during business hours',
        active: true,
        conditions: {
          time: {
            dayOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
            startTime: '09:00',
            endTime: '17:00'
          }
        },
        actions: {
          schedule: {
            delay: 'next-business-day'
          }
        }
      }
    ]);
    
    sandbox.stub(rulesManager, 'updateRules').callsFake(rules => rules);
    
    // Apply the rules router to the test app
    app.use('/api/rules', rulesRouter);
  });
  
  afterEach(() => {
    sandbox.restore();
  });
  
  describe('GET /api/rules', () => {
    it('should return rules for authenticated admin users', async () => {
      // Make the request
      const response = await request(app)
        .get('/api/rules');
      
      // Verify the response
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('rules');
      expect(response.body.rules).to.be.an('array');
      expect(response.body.rules).to.have.lengthOf(1);
      expect(response.body.rules[0]).to.have.property('id', 'business-hours');
      
      // Verify rulesManager.getRules was called
      expect(rulesManager.getRules).to.have.been.calledOnce;
    });
    
    it('should return 403 for non-admin users', async () => {
      // Make auth.isAdmin fail for this test
      auth.isAdmin.callsFake((req, res, next) => {
        return res.status(403).json({ message: 'Access denied. Admin role required.' });
      });
      
      // Make the request
      const response = await request(app)
        .get('/api/rules');
      
      // Verify the response
      expect(response.status).to.equal(403);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.include('Access denied');
      
      // Verify rulesManager.getRules was not called
      expect(rulesManager.getRules).not.to.have.been.called;
    });
    
    it('should handle errors during rules retrieval', async () => {
      // Make rulesManager.getRules throw an error
      rulesManager.getRules.throws(new Error('Failed to retrieve rules'));
      
      // Make the request
      const response = await request(app)
        .get('/api/rules');
      
      // Verify the response
      expect(response.status).to.equal(500);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.equal('Failed to retrieve rules');
    });
  });
  
  describe('POST /api/rules', () => {
    it('should update rules for authenticated admin users', async () => {
      // Create test rules data
      const updatedRules = [
        {
          id: 'business-hours',
          name: 'Extended Business Hours',
          description: 'Call during extended business hours',
          active: true,
          conditions: {
            time: {
              dayOfWeek: [1, 2, 3, 4, 5],
              startTime: '08:00',
              endTime: '18:00'
            }
          },
          actions: {
            schedule: {
              delay: 'next-business-day'
            }
          }
        },
        {
          id: 'new-rule',
          name: 'New Rule',
          description: 'A new test rule',
          active: true,
          conditions: {
            location: {
              timezone: 'America/New_York'
            }
          },
          actions: {
            priority: 'high'
          }
        }
      ];
      
      // Make the request
      const response = await request(app)
        .post('/api/rules')
        .send({ rules: updatedRules });
      
      // Verify the response
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('rules');
      expect(response.body.rules).to.be.an('array');
      expect(response.body.rules).to.have.lengthOf(2);
      
      // Verify rulesManager.updateRules was called with the provided rules
      expect(rulesManager.updateRules).to.have.been.calledWith(updatedRules);
    });
    
    it('should return 400 for missing rules data', async () => {
      // Make the request without rules data
      const response = await request(app)
        .post('/api/rules')
        .send({});
      
      // Verify the response
      expect(response.status).to.equal(400);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.equal('Rules data is required');
      
      // Verify rulesManager.updateRules was not called
      expect(rulesManager.updateRules).not.to.have.been.called;
    });
    
    it('should return 403 for non-admin users', async () => {
      // Make auth.isAdmin fail for this test
      auth.isAdmin.callsFake((req, res, next) => {
        return res.status(403).json({ message: 'Access denied. Admin role required.' });
      });
      
      // Create test rules data
      const updatedRules = [
        {
          id: 'business-hours',
          name: 'Extended Business Hours',
          active: true
        }
      ];
      
      // Make the request
      const response = await request(app)
        .post('/api/rules')
        .send({ rules: updatedRules });
      
      // Verify the response
      expect(response.status).to.equal(403);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.include('Access denied');
      
      // Verify rulesManager.updateRules was not called
      expect(rulesManager.updateRules).not.to.have.been.called;
    });
    
    it('should handle errors during rules update', async () => {
      // Make rulesManager.updateRules throw an error
      rulesManager.updateRules.throws(new Error('Failed to update rules'));
      
      // Create test rules data
      const updatedRules = [
        {
          id: 'business-hours',
          name: 'Extended Business Hours',
          active: true
        }
      ];
      
      // Make the request
      const response = await request(app)
        .post('/api/rules')
        .send({ rules: updatedRules });
      
      // Verify the response
      expect(response.status).to.equal(500);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.equal('Failed to update rules');
    });
  });
  
  describe('Authentication and Authorization', () => {
    it('should verify authentication middleware is called', async () => {
      // Make the request
      await request(app).get('/api/rules');
      
      // Verify authentication middleware was called
      expect(auth.isAuthenticated).to.have.been.calledOnce;
    });
    
    it('should verify authorization middleware is called', async () => {
      // Make the request
      await request(app).get('/api/rules');
      
      // Verify authorization middleware was called
      expect(auth.isAdmin).to.have.been.calledOnce;
    });
    
    it('should return 401 when user is not authenticated', async () => {
      // Make auth.isAuthenticated fail for this test
      auth.isAuthenticated.callsFake((req, res, next) => {
        return res.status(401).json({ message: 'Authentication required' });
      });
      
      // Make the request
      const response = await request(app).get('/api/rules');
      
      // Verify the response
      expect(response.status).to.equal(401);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.include('Authentication required');
      
      // Verify authorization middleware was not called
      expect(auth.isAdmin).not.to.have.been.called;
      
      // Verify rulesManager.getRules was not called
      expect(rulesManager.getRules).not.to.have.been.called;
    });
  });
});