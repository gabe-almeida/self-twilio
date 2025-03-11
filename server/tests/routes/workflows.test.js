/**
 * Workflows API Routes Tests
 * 
 * These tests validate the workflows API endpoints, including CRUD operations,
 * workflow activation/deactivation, and testing workflow execution.
 */

const request = require('supertest');
const express = require('express');
const sinon = require('sinon');

// Import modules to test and their dependencies
const workflowsRouter = require('../../routes/workflows');
const workflowManager = require('../../workflow-manager');
const store = require('../../memory-store');
const auth = require('../../auth');

describe('Workflows API Routes', () => {
  let app;
  let sandbox;
  let mockWorkflows;
  
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
    
    // Create mock workflows
    mockWorkflows = [
      {
        id: 'wf-123',
        name: 'New Lead Workflow',
        description: 'Process new leads',
        active: true,
        triggers: [
          { event: 'new-lead' }
        ],
        steps: [
          {
            id: 'step-1',
            type: 'call',
            config: { maxRetries: 3 }
          }
        ],
        business_hours: {
          enabled: true,
          timezone: 'America/New_York',
          days: [1, 2, 3, 4, 5],
          start_time: '09:00',
          end_time: '17:00'
        },
        created_at: '2025-01-01T12:00:00.000Z',
        updated_at: '2025-01-01T12:00:00.000Z'
      },
      {
        id: 'wf-456',
        name: 'Follow-up Workflow',
        description: 'Follow up with leads after no answer',
        active: false,
        triggers: [
          { event: 'call-completed', filter: { disposition: 'no-answer' } }
        ],
        steps: [
          {
            id: 'step-1',
            type: 'delay',
            config: { minutes: 60 }
          },
          {
            id: 'step-2',
            type: 'call',
            config: { maxRetries: 2 }
          }
        ],
        business_hours: {
          enabled: true,
          timezone: 'America/New_York',
          days: [1, 2, 3, 4, 5],
          start_time: '09:00',
          end_time: '17:00'
        },
        created_at: '2025-01-02T12:00:00.000Z',
        updated_at: '2025-01-02T12:00:00.000Z'
      }
    ];
    
    // Mock the store methods
    sandbox.stub(store.workflows, 'getAll').resolves(mockWorkflows);
    sandbox.stub(store.workflows, 'getActive').resolves([mockWorkflows[0]]);
    sandbox.stub(store.workflows, 'getById').callsFake(id => {
      const workflow = mockWorkflows.find(w => w.id === id);
      return Promise.resolve(workflow || null);
    });
    sandbox.stub(store.workflows, 'create').callsFake(workflow => {
      const newWorkflow = { 
        id: `wf-${Date.now()}`, 
        ...workflow,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      return Promise.resolve(newWorkflow);
    });
    sandbox.stub(store.workflows, 'update').callsFake((id, updates) => {
      const workflow = mockWorkflows.find(w => w.id === id);
      if (!workflow) return Promise.resolve(null);
      
      const updatedWorkflow = { 
        ...workflow, 
        ...updates,
        updated_at: new Date().toISOString()
      };
      return Promise.resolve(updatedWorkflow);
    });
    sandbox.stub(store.workflows, 'delete').callsFake(id => {
      const workflow = mockWorkflows.find(w => w.id === id);
      return Promise.resolve(workflow ? true : false);
    });
    sandbox.stub(store.workflows, 'activate').callsFake(id => {
      const workflow = mockWorkflows.find(w => w.id === id);
      if (!workflow) return Promise.resolve(null);
      
      const activatedWorkflow = { ...workflow, active: true };
      return Promise.resolve(activatedWorkflow);
    });
    sandbox.stub(store.workflows, 'deactivate').callsFake(id => {
      const workflow = mockWorkflows.find(w => w.id === id);
      if (!workflow) return Promise.resolve(null);
      
      const deactivatedWorkflow = { ...workflow, active: false };
      return Promise.resolve(deactivatedWorkflow);
    });
    
    // Mock workflow manager
    sandbox.stub(workflowManager, 'startWorkflow').resolves(true);
    
    // Apply the workflows router to the test app
    app.use('/api/workflows', workflowsRouter);
  });
  
  afterEach(() => {
    sandbox.restore();
  });
  
  describe('GET /api/workflows', () => {
    it('should return all workflows for admin users', async () => {
      // Make the request
      const response = await request(app)
        .get('/api/workflows');
      
      // Verify the response
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('workflows');
      expect(response.body.workflows).to.be.an('array');
      expect(response.body.workflows).to.have.lengthOf(2);
      
      // Verify store method was called
      expect(store.workflows.getAll).to.have.been.calledOnce;
    });
    
    it('should handle errors when fetching workflows', async () => {
      // Make store.workflows.getAll throw an error
      store.workflows.getAll.rejects(new Error('Database error'));
      
      // Make the request
      const response = await request(app)
        .get('/api/workflows');
      
      // Verify the response
      expect(response.status).to.equal(500);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.equal('Failed to get workflows');
    });
  });
  
  describe('GET /api/workflows/active', () => {
    it('should return only active workflows', async () => {
      // Make the request
      const response = await request(app)
        .get('/api/workflows/active');
      
      // Verify the response
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('workflows');
      expect(response.body.workflows).to.be.an('array');
      expect(response.body.workflows).to.have.lengthOf(1);
      expect(response.body.workflows[0].active).to.be.true;
      expect(response.body.workflows[0].id).to.equal('wf-123');
      
      // Verify store method was called
      expect(store.workflows.getActive).to.have.been.calledOnce;
    });
  });
  
  describe('GET /api/workflows/:id', () => {
    it('should return a specific workflow by ID', async () => {
      // Make the request
      const response = await request(app)
        .get('/api/workflows/wf-123');
      
      // Verify the response
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('workflow');
      expect(response.body.workflow).to.be.an('object');
      expect(response.body.workflow.id).to.equal('wf-123');
      expect(response.body.workflow.name).to.equal('New Lead Workflow');
      
      // Verify store method was called with correct ID
      expect(store.workflows.getById).to.have.been.calledWith('wf-123');
    });
    
    it('should return 404 when workflow does not exist', async () => {
      // Make the request with non-existent ID
      const response = await request(app)
        .get('/api/workflows/non-existent-id');
      
      // Verify the response
      expect(response.status).to.equal(404);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.equal('Workflow not found');
    });
  });
  
  describe('POST /api/workflows', () => {
    it('should create a new workflow with valid data', async () => {
      // Workflow data to create
      const newWorkflow = {
        name: 'Customer Satisfaction Workflow',
        description: 'Follow up with customers after completed calls',
        active: true,
        triggers: [
          { event: 'call-completed', filter: { disposition: 'completed' } }
        ],
        steps: [
          {
            id: 'step-1',
            type: 'delay',
            config: { days: 1 }
          },
          {
            id: 'step-2',
            type: 'call',
            config: { maxRetries: 3 }
          }
        ]
      };
      
      // Make the request
      const response = await request(app)
        .post('/api/workflows')
        .send(newWorkflow);
      
      // Verify the response
      expect(response.status).to.equal(201);
      expect(response.body).to.have.property('workflow');
      expect(response.body.workflow).to.have.property('id');
      expect(response.body.workflow.name).to.equal('Customer Satisfaction Workflow');
      
      // Verify store method was called with correct data
      expect(store.workflows.create).to.have.been.calledWith(
        sinon.match(newWorkflow)
      );
    });
    
    it('should return 400 when name is missing', async () => {
      // Make the request with missing name
      const response = await request(app)
        .post('/api/workflows')
        .send({
          description: 'Invalid workflow without name',
          active: true
        });
      
      // Verify the response
      expect(response.status).to.equal(400);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.equal('Name is required');
      
      // Verify store method was not called
      expect(store.workflows.create).not.to.have.been.called;
    });
  });
  
  describe('PUT /api/workflows/:id', () => {
    it('should update an existing workflow', async () => {
      // Workflow updates
      const updates = {
        name: 'Updated Lead Workflow',
        description: 'Updated description',
        active: false
      };
      
      // Make the request
      const response = await request(app)
        .put('/api/workflows/wf-123')
        .send(updates);
      
      // Verify the response
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('workflow');
      expect(response.body.workflow.name).to.equal('Updated Lead Workflow');
      expect(response.body.workflow.description).to.equal('Updated description');
      expect(response.body.workflow.active).to.be.false;
      
      // Verify store method was called with correct ID and updates
      expect(store.workflows.update).to.have.been.calledWith(
        'wf-123',
        sinon.match(updates)
      );
    });
    
    it('should return 404 when updating non-existent workflow', async () => {
      // Make the request with non-existent ID
      const response = await request(app)
        .put('/api/workflows/non-existent-id')
        .send({
          name: 'Updated Workflow',
          description: 'Updated description'
        });
      
      // Verify the response
      expect(response.status).to.equal(404);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.equal('Workflow not found');
    });
    
    it('should return 400 when name is missing in update', async () => {
      // Make the request with missing name
      const response = await request(app)
        .put('/api/workflows/wf-123')
        .send({
          description: 'Updated description',
          active: true
        });
      
      // Verify the response
      expect(response.status).to.equal(400);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.equal('Name is required');
    });
  });
  
  describe('DELETE /api/workflows/:id', () => {
    it('should delete an existing workflow', async () => {
      // Make the request
      const response = await request(app)
        .delete('/api/workflows/wf-123');
      
      // Verify the response
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('success', true);
      
      // Verify store method was called with correct ID
      expect(store.workflows.delete).to.have.been.calledWith('wf-123');
    });
    
    it('should return 404 when deleting non-existent workflow', async () => {
      // Make the request with non-existent ID
      const response = await request(app)
        .delete('/api/workflows/non-existent-id');
      
      // Verify the response
      expect(response.status).to.equal(404);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.equal('Workflow not found');
    });
  });
  
  describe('POST /api/workflows/:id/activate', () => {
    it('should activate an inactive workflow', async () => {
      // Make the request (using an inactive workflow)
      const response = await request(app)
        .post('/api/workflows/wf-456/activate');
      
      // Verify the response
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('workflow');
      expect(response.body.workflow.active).to.be.true;
      
      // Verify store method was called with correct ID
      expect(store.workflows.activate).to.have.been.calledWith('wf-456');
    });
    
    it('should return 404 when activating non-existent workflow', async () => {
      // Make the request with non-existent ID
      const response = await request(app)
        .post('/api/workflows/non-existent-id/activate');
      
      // Verify the response
      expect(response.status).to.equal(404);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.equal('Workflow not found');
    });
  });
  
  describe('POST /api/workflows/:id/deactivate', () => {
    it('should deactivate an active workflow', async () => {
      // Make the request (using an active workflow)
      const response = await request(app)
        .post('/api/workflows/wf-123/deactivate');
      
      // Verify the response
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('workflow');
      expect(response.body.workflow.active).to.be.false;
      
      // Verify store method was called with correct ID
      expect(store.workflows.deactivate).to.have.been.calledWith('wf-123');
    });
    
    it('should return 404 when deactivating non-existent workflow', async () => {
      // Make the request with non-existent ID
      const response = await request(app)
        .post('/api/workflows/non-existent-id/deactivate');
      
      // Verify the response
      expect(response.status).to.equal(404);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.equal('Workflow not found');
    });
  });
  
  describe('POST /api/workflows/:id/test', () => {
    it('should successfully test a workflow', async () => {
      // Make the request
      const response = await request(app)
        .post('/api/workflows/wf-123/test');
      
      // Verify the response
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.include('Workflow test started');
      
      // Verify workflowManager.startWorkflow was called
      expect(workflowManager.startWorkflow).to.have.been.calledOnce;
    });
    
    it('should return 404 when testing non-existent workflow', async () => {
      // Make the request with non-existent ID
      const response = await request(app)
        .post('/api/workflows/non-existent-id/test');
      
      // Verify the response
      expect(response.status).to.equal(404);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.equal('Workflow not found');
      
      // Verify workflowManager.startWorkflow was not called
      expect(workflowManager.startWorkflow).not.to.have.been.called;
    });
    
    it('should handle errors during workflow testing', async () => {
      // Make workflowManager.startWorkflow throw an error
      workflowManager.startWorkflow.rejects(new Error('Workflow execution error'));
      
      // Make the request
      const response = await request(app)
        .post('/api/workflows/wf-123/test');
      
      // Verify the response
      expect(response.status).to.equal(500);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.equal('Failed to test workflow');
    });
  });
  
  describe('Authorization', () => {
    it('should deny access for non-admin users', async () => {
      // Mock non-admin user
      auth.isAdmin.callsFake((req, res, next) => {
        return res.status(403).json({ message: 'Access denied. Admin role required.' });
      });
      
      // Test each endpoint
      const endpoints = [
        { method: 'get', url: '/api/workflows' },
        { method: 'get', url: '/api/workflows/active' },
        { method: 'get', url: '/api/workflows/wf-123' },
        { method: 'post', url: '/api/workflows', data: { name: 'Test Workflow' } },
        { method: 'put', url: '/api/workflows/wf-123', data: { name: 'Updated Workflow' } },
        { method: 'delete', url: '/api/workflows/wf-123' },
        { method: 'post', url: '/api/workflows/wf-123/activate' },
        { method: 'post', url: '/api/workflows/wf-123/deactivate' },
        { method: 'post', url: '/api/workflows/wf-123/test' }
      ];
      
      for (const endpoint of endpoints) {
        const req = request(app)[endpoint.method](endpoint.url);
        
        if (endpoint.data) {
          req.send(endpoint.data);
        }
        
        const response = await req;
        
        // Verify the response
        expect(response.status).to.equal(403);
        expect(response.body).to.have.property('message');
        expect(response.body.message).to.include('Access denied');
      }
    });
  });
});