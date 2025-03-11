/**
 * Authentication Service Tests
 * 
 * These tests validate the authentication and authorization functionality,
 * including token generation, user authentication, and role-based access control.
 */

const sinon = require('sinon');
const jwt = require('jsonwebtoken');
const auth = require('../auth');
const store = require('../memory-store');

describe('Authentication Service', () => {
  let sandbox;
  
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });
  
  afterEach(() => {
    sandbox.restore();
  });
  
  describe('generateToken()', () => {
    it('should generate a valid JWT token with user information', () => {
      // Mock jwt.sign to verify parameters
      const jwtSignStub = sandbox.stub(jwt, 'sign').returns('test-token');
      
      // Create test user
      const user = {
        id: 1,
        username: 'testuser',
        role: 'agent'
      };
      
      // Generate token
      const token = auth.generateToken(user);
      
      // Verify token is returned
      expect(token).to.equal('test-token');
      
      // Verify jwt.sign was called with correct parameters
      expect(jwtSignStub).to.have.been.calledOnce;
      expect(jwtSignStub).to.have.been.calledWith(
        {
          id: 1,
          username: 'testuser',
          role: 'agent'
        },
        sinon.match.any,  // JWT_SECRET is internal to auth module
        { expiresIn: '24h' }
      );
    });
    
    it('should generate different tokens for different users', () => {
      // Use real JWT implementation for this test
      sandbox.restore();
      
      // Create test users
      const agent = {
        id: 1,
        username: 'agent1',
        role: 'agent'
      };
      
      const admin = {
        id: 2,
        username: 'admin1',
        role: 'admin'
      };
      
      // Generate tokens
      const agentToken = auth.generateToken(agent);
      const adminToken = auth.generateToken(admin);
      
      // Verify tokens are different
      expect(agentToken).to.not.equal(adminToken);
      
      // Verify tokens contain expected payload by decoding them
      const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
      const agentPayload = jwt.verify(agentToken, JWT_SECRET);
      const adminPayload = jwt.verify(adminToken, JWT_SECRET);
      
      expect(agentPayload.id).to.equal(1);
      expect(agentPayload.role).to.equal('agent');
      
      expect(adminPayload.id).to.equal(2);
      expect(adminPayload.role).to.equal('admin');
    });
  });
  
  describe('isAdmin() middleware', () => {
    it('should allow access for admin users', () => {
      // Create mock request with admin user
      const req = {
        user: { id: 1, role: 'admin' }
      };
      
      // Create mock response
      const res = {
        status: sandbox.stub().returnsThis(),
        json: sandbox.stub()
      };
      
      // Create mock next function
      const next = sandbox.stub();
      
      // Call middleware
      auth.isAdmin(req, res, next);
      
      // Verify next was called (allowed access)
      expect(next).to.have.been.calledOnce;
      
      // Verify res.status was not called (no error)
      expect(res.status).not.to.have.been.called;
    });
    
    it('should deny access for non-admin users', () => {
      // Create mock request with agent user
      const req = {
        user: { id: 2, role: 'agent' }
      };
      
      // Create mock response
      const res = {
        status: sandbox.stub().returnsThis(),
        json: sandbox.stub()
      };
      
      // Create mock next function
      const next = sandbox.stub();
      
      // Call middleware
      auth.isAdmin(req, res, next);
      
      // Verify next was not called (denied access)
      expect(next).not.to.have.been.called;
      
      // Verify response was an error
      expect(res.status).to.have.been.calledWith(403);
      expect(res.json).to.have.been.calledWith(
        sinon.match({ message: sinon.match.string })
      );
    });
    
    it('should deny access when user is not authenticated', () => {
      // Create mock request with no user
      const req = {};
      
      // Create mock response
      const res = {
        status: sandbox.stub().returnsThis(),
        json: sandbox.stub()
      };
      
      // Create mock next function
      const next = sandbox.stub();
      
      // Call middleware
      auth.isAdmin(req, res, next);
      
      // Verify next was not called (denied access)
      expect(next).not.to.have.been.called;
      
      // Verify response was an error
      expect(res.status).to.have.been.calledWith(403);
      expect(res.json).to.have.been.calledWith(
        sinon.match({ message: sinon.match.string })
      );
    });
  });
  
  describe('isAgent() middleware', () => {
    it('should allow access for agent users', () => {
      // Create mock request with agent user
      const req = {
        user: { id: 2, role: 'agent' }
      };
      
      // Create mock response
      const res = {
        status: sandbox.stub().returnsThis(),
        json: sandbox.stub()
      };
      
      // Create mock next function
      const next = sandbox.stub();
      
      // Call middleware
      auth.isAgent(req, res, next);
      
      // Verify next was called (allowed access)
      expect(next).to.have.been.calledOnce;
      
      // Verify res.status was not called (no error)
      expect(res.status).not.to.have.been.called;
    });
    
    it('should allow access for admin users', () => {
      // Create mock request with admin user
      const req = {
        user: { id: 1, role: 'admin' }
      };
      
      // Create mock response
      const res = {
        status: sandbox.stub().returnsThis(),
        json: sandbox.stub()
      };
      
      // Create mock next function
      const next = sandbox.stub();
      
      // Call middleware
      auth.isAgent(req, res, next);
      
      // Verify next was called (allowed access)
      expect(next).to.have.been.calledOnce;
      
      // Verify res.status was not called (no error)
      expect(res.status).not.to.have.been.called;
    });
    
    it('should deny access for non-agent, non-admin users', () => {
      // Create mock request with regular user
      const req = {
        user: { id: 3, role: 'user' }
      };
      
      // Create mock response
      const res = {
        status: sandbox.stub().returnsThis(),
        json: sandbox.stub()
      };
      
      // Create mock next function
      const next = sandbox.stub();
      
      // Call middleware
      auth.isAgent(req, res, next);
      
      // Verify next was not called (denied access)
      expect(next).not.to.have.been.called;
      
      // Verify response was an error
      expect(res.status).to.have.been.calledWith(403);
      expect(res.json).to.have.been.calledWith(
        sinon.match({ message: sinon.match.string })
      );
    });
  });
  
  describe('isSelfOrAdmin() middleware', () => {
    it('should allow access for a user accessing their own data', () => {
      // Create mock request with user accessing own data
      const req = {
        user: { id: 5, role: 'agent' },
        params: { userId: '5' }
      };
      
      // Create mock response
      const res = {
        status: sandbox.stub().returnsThis(),
        json: sandbox.stub()
      };
      
      // Create mock next function
      const next = sandbox.stub();
      
      // Call middleware
      auth.isSelfOrAdmin(req, res, next);
      
      // Verify next was called (allowed access)
      expect(next).to.have.been.calledOnce;
      
      // Verify res.status was not called (no error)
      expect(res.status).not.to.have.been.called;
    });
    
    it('should allow access for admin users accessing any data', () => {
      // Create mock request with admin accessing other user's data
      const req = {
        user: { id: 1, role: 'admin' },
        params: { userId: '5' }
      };
      
      // Create mock response
      const res = {
        status: sandbox.stub().returnsThis(),
        json: sandbox.stub()
      };
      
      // Create mock next function
      const next = sandbox.stub();
      
      // Call middleware
      auth.isSelfOrAdmin(req, res, next);
      
      // Verify next was called (allowed access)
      expect(next).to.have.been.calledOnce;
      
      // Verify res.status was not called (no error)
      expect(res.status).not.to.have.been.called;
    });
    
    it('should deny access for users accessing others\' data', () => {
      // Create mock request with user accessing another user's data
      const req = {
        user: { id: 2, role: 'agent' },
        params: { userId: '5' }
      };
      
      // Create mock response
      const res = {
        status: sandbox.stub().returnsThis(),
        json: sandbox.stub()
      };
      
      // Create mock next function
      const next = sandbox.stub();
      
      // Call middleware
      auth.isSelfOrAdmin(req, res, next);
      
      // Verify next was not called (denied access)
      expect(next).not.to.have.been.called;
      
      // Verify response was an error
      expect(res.status).to.have.been.calledWith(403);
      expect(res.json).to.have.been.calledWith(
        sinon.match({ message: sinon.match.string })
      );
    });
  });
});