/**
 * Auth Routes Tests
 * 
 * These tests verify the authentication routes work correctly,
 * including login, token validation, and user authorization.
 */

const request = require('supertest');
const express = require('express');
const sinon = require('sinon');

// Import modules to test
const authRoutes = require('../../routes/auth');
const auth = require('../../auth');

describe('Auth Routes', () => {
  let app;
  let sandbox;
  let mockStore;
  
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Create a simple express app for testing
    app = express();
    app.use(express.json());
    
    // Create mock store operations
    mockStore = {
      users: {
        getByUsername: sandbox.stub(),
        getById: sandbox.stub()
      },
      verifyPassword: sandbox.stub()
    };
    
    // Mock auth middleware and functions
    sandbox.stub(auth, 'isAuthenticated').callsFake((req, res, next) => {
      req.user = { id: 1, username: 'testuser', role: 'agent' };
      next();
    });
    
    sandbox.stub(auth, 'generateToken').returns('test-jwt-token');
    
    // Apply routes to the test app
    app.use('/auth', authRoutes);
  });
  
  afterEach(() => {
    sandbox.restore();
  });
  
  describe('POST /auth/login', () => {
    it('should return 200 and JWT token when credentials are valid', async () => {
      // Setup mock responses
      mockStore.users.getByUsername.resolves({
        id: 1,
        username: 'testuser',
        password: 'hashedpassword',
        role: 'agent'
      });
      
      mockStore.verifyPassword.returns(true);
      
      // Test API call
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'password123'
        });
      
      // Assertions
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('token');
      expect(response.body.token).to.equal('test-jwt-token');
      expect(response.body).to.have.property('user');
      expect(response.body.user).to.have.property('username', 'testuser');
      
      // Verify store methods were called
      expect(mockStore.users.getByUsername).to.have.been.calledWith('testuser');
      expect(mockStore.verifyPassword).to.have.been.called;
    });
    
    it('should return 401 when username is not found', async () => {
      // Setup mock to return null (user not found)
      mockStore.users.getByUsername.resolves(null);
      
      // Test API call
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: 'nonexistentuser',
          password: 'password123'
        });
      
      // Assertions
      expect(response.status).to.equal(401);
      expect(response.body).to.have.property('error', true);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.include('Authentication failed');
    });
    
    it('should return 401 when password is incorrect', async () => {
      // Setup mocks
      mockStore.users.getByUsername.resolves({
        id: 1,
        username: 'testuser',
        password: 'hashedpassword'
      });
      
      // Return false to simulate password verification failure
      mockStore.verifyPassword.returns(false);
      
      // Test API call
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword'
        });
      
      // Assertions
      expect(response.status).to.equal(401);
      expect(response.body).to.have.property('error', true);
      expect(response.body.message).to.include('Authentication failed');
    });
  });

  describe('GET /auth/verify', () => {
    it('should return 200 and user info when token is valid', async () => {
      // Mock getById to return a user
      mockStore.users.getById.resolves({
        id: 1,
        username: 'testuser',
        role: 'agent'
      });
      
      // Test API call with the verify endpoint
      const response = await request(app)
        .get('/auth/verify')
        .set('Authorization', 'Bearer test-jwt-token');
      
      // Assertions
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('valid', true);
      expect(response.body).to.have.property('user');
      expect(response.body.user).to.have.property('username', 'testuser');
    });
  });
});