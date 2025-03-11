// In-memory data store for Twilio Dialer Web App
const crypto = require('crypto');

// Simple password hashing function using crypto
const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

// Verify password
const verifyPassword = (password, hashedPassword) => {
  const [salt, hash] = hashedPassword.split(':');
  const calculatedHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === calculatedHash;
};

// Initialize store with default data
const users = [
  {
    id: 1,
    username: 'admin',
    password: hashPassword('admin123'),
    full_name: 'System Administrator',
    email: 'admin@example.com',
    role: 'admin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 2,
    username: 'agent',
    password: hashPassword('agent123'),
    full_name: 'Test Agent',
    email: 'agent@example.com',
    role: 'agent',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

const agentStatusData = [
  {
    id: 1,
    user_id: 2,
    status: 'Offline',
    last_status_change: new Date().toISOString()
  }
];

const callQueueData = [
  {
    id: 1,
    phone_number: '+19785551234',
    contact_name: 'John Smith',
    notes: 'Interested in premium plan',
    priority: 2,
    status: 'Queued',
    created_at: new Date().toISOString(),
    scheduled_for: null,
    assigned_to: null,
    completed_at: null,
    call_sid: null,
    call_duration: null,
    call_status: null
  },
  {
    id: 2,
    phone_number: '+19785552345',
    contact_name: 'Jane Doe',
    notes: 'Follow up on previous call',
    priority: 1,
    status: 'Queued',
    created_at: new Date().toISOString(),
    scheduled_for: null,
    assigned_to: null,
    completed_at: null,
    call_sid: null,
    call_duration: null,
    call_status: null
  },
  {
    id: 3,
    phone_number: '+19785553456',
    contact_name: 'Bob Johnson',
    notes: 'New lead from website',
    priority: 3,
    status: 'Queued',
    created_at: new Date().toISOString(),
    scheduled_for: null,
    assigned_to: null,
    completed_at: null,
    call_sid: null,
    call_duration: null,
    call_status: null
  }
];

const callHistoryData = [];

// Initialize dispositions with default values
const dispositionsData = [
  {
    id: 'completed',
    name: 'Completed',
    description: 'Call was completed successfully',
    is_final: true,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'no-answer',
    name: 'No Answer',
    description: 'Call was not answered',
    is_final: false,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'busy',
    name: 'Busy',
    description: 'Line was busy',
    is_final: false,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'wrong-number',
    name: 'Wrong Number',
    description: 'Called the wrong number',
    is_final: true,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'not-interested',
    name: 'Not Interested',
    description: 'Contact is not interested',
    is_final: true,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'callback',
    name: 'Callback',
    description: 'Contact requested a callback',
    is_final: false,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// Initialize workflows with a default workflow
const workflowsData = [
  {
    id: 'default',
    name: 'Default Lead Follow-up',
    description: 'Default workflow for new leads',
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    triggers: [
      { type: 'new_lead', priority: 3 }
    ],
    steps: [
      {
        id: 'start',
        type: 'start',
        name: 'Start',
        isStart: true,
        next_step: 'call',
        position: { x: 100, y: 100 }
      },
      {
        id: 'call',
        type: 'call',
        name: 'Make Call',
        properties: { priority: 3 },
        next_step: 'condition',
        position: { x: 300, y: 100 }
      },
      {
        id: 'condition',
        type: 'condition',
        name: 'Check Disposition',
        condition: {
          field: 'call.disposition',
          operator: 'equals',
          value: 'no-answer'
        },
        true_branch: 'wait',
        false_branch: 'end',
        position: { x: 500, y: 100 }
      },
      {
        id: 'wait',
        type: 'wait',
        name: 'Wait 30 Minutes',
        properties: {
          minutes: 30,
          respect_hours: true
        },
        next_step: 'call2',
        position: { x: 500, y: 250 }
      },
      {
        id: 'call2',
        type: 'call',
        name: 'Retry Call',
        properties: { priority: 2 },
        next_step: 'end',
        position: { x: 300, y: 250 }
      },
      {
        id: 'end',
        type: 'end',
        name: 'End',
        position: { x: 700, y: 100 }
      }
    ],
    business_hours: {
      enabled: true,
      timezone: 'America/New_York',
      days: [1, 2, 3, 4, 5],
      start_time: '09:00',
      end_time: '17:00'
    }
  }
];

// Initialize campaigns array
const campaignsData = [];

// Initialize campaign membership array
const campaignMembersData = [];

// Initialize contact centers with sample data
const contactCentersData = [
  {
    id: 'cc_1',
    name: 'Main Contact Center',
    description: 'Primary contact center for customer support',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    active: true,
    settings: {
      business_hours: {
        timezone: 'America/New_York',
        days: [1, 2, 3, 4, 5], // Monday to Friday
        start_time: '09:00',
        end_time: '17:00'
      },
      voicemail_enabled: true,
      welcome_message: 'Welcome to our contact center. Please wait while we connect you to an agent.'
    }
  },
  {
    id: 'cc_2',
    name: 'Sales Contact Center',
    description: 'Contact center for sales inquiries',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    active: true,
    settings: {
      business_hours: {
        timezone: 'America/New_York',
        days: [1, 2, 3, 4, 5], // Monday to Friday
        start_time: '08:00',
        end_time: '18:00'
      },
      voicemail_enabled: true,
      welcome_message: 'Thank you for calling our sales department. An agent will be with you shortly.'
    }
  }
];

// Initialize contact center agents with sample data
const contactCenterAgentsData = [
  {
    id: 'cca_1',
    contact_center_id: 'cc_1',
    user_id: 2, // Test agent
    role: 'agent',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    active: true
  },
  {
    id: 'cca_2',
    contact_center_id: 'cc_2',
    user_id: 2, // Test agent
    role: 'supervisor',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    active: true
  }
];

// Initialize contact center phone numbers with sample data
const contactCenterPhonesData = [
  {
    id: 'ccp_1',
    contact_center_id: 'cc_1',
    phone_number: '+19785551000',
    friendly_name: 'Main Support Line',
    direction: 'both',
    is_default: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    active: true
  },
  {
    id: 'ccp_2',
    contact_center_id: 'cc_2',
    phone_number: '+19785552000',
    friendly_name: 'Sales Line',
    direction: 'both',
    is_default: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    active: true
  }
];

const nextId = {
  users: 3,
  agentStatus: 2,
  callQueue: 4,
  callHistory: 1,
  workflows: 1,
  campaigns: 1,
  campaignMembers: 1,
  contactCenters: 1,
  contactCenterAgents: 1,
  contactCenterPhones: 1
};

// User methods
const usersModule = {
  // Get a user by username
  getUserByUsername: (username) => {
    return users.find(user => user.username === username);
  },

  // Get a user by ID
  getUserById: (id) => {
    return users.find(user => user.id === id);
  },

  // Create a new user
  createUser: (user) => {
    const newUser = {
      id: nextId.users++,
      username: user.username,
      password: user.password,
      full_name: user.full_name,
      email: user.email,
      role: user.role || 'agent',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    users.push(newUser);

    // Initialize agent status if role is agent
    if (newUser.role === 'agent') {
      agentStatusModule.updateAgentStatus(newUser.id, 'Offline');
    }

    return { id: newUser.id };
  },

  // Update a user
  updateUser: (id, userData) => {
    const userIndex = users.findIndex(user => user.id === id);
    
    if (userIndex === -1) {
      return { changes: 0 };
    }

    const user = users[userIndex];
    
    if (userData.password) {
      user.password = userData.password;
    }
    
    if (userData.full_name) {
      user.full_name = userData.full_name;
    }
    
    if (userData.email) {
      user.email = userData.email;
    }
    
    if (userData.role) {
      user.role = userData.role;
    }
    
    user.updated_at = new Date().toISOString();
    
    users[userIndex] = user;
    
    return { changes: 1 };
  },

  // Get all users
  getAllUsers: () => {
    return users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  },

  // Get all agents
  getAllAgents: () => {
    return users
      .filter(user => user.role === 'agent')
      .map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
  }
};

// Agent status methods
const agentStatusModule = {
  // Get status for a specific agent
  getAgentStatus: (userId) => {
    return agentStatusData.find(status => status.user_id === userId);
  },

  // Update agent status
  updateAgentStatus: (userId, status) => {
    const statusIndex = agentStatusData.findIndex(s => s.user_id === userId);
    
    if (statusIndex === -1) {
      // Create new status
      const newStatus = {
        id: nextId.agentStatus++,
        user_id: userId,
        status,
        last_status_change: new Date().toISOString()
      };
      
      agentStatusData.push(newStatus);
      return { changes: 1 };
    } else {
      // Update existing status
      agentStatusData[statusIndex].status = status;
      agentStatusData[statusIndex].last_status_change = new Date().toISOString();
      return { changes: 1 };
    }
  },

  // Get all agent statuses with user info
  getAllAgentStatuses: () => {
    return agentStatusData.map(status => {
      const user = usersModule.getUserById(status.user_id);
      return {
        ...status,
        username: user ? user.username : null,
        full_name: user ? user.full_name : null
      };
    });
  },

  // Get available agents
  getAvailableAgents: () => {
    return agentStatusData
      .filter(status => status.status === 'Available')
      .map(status => {
        const user = usersModule.getUserById(status.user_id);
        return {
          user_id: status.user_id,
          last_status_change: status.last_status_change,
          username: user ? user.username : null,
          full_name: user ? user.full_name : null
        };
      })
      .sort((a, b) => new Date(a.last_status_change) - new Date(b.last_status_change));
  }
};

// Call queue methods
const callQueueModule = {
  // Add a call to the queue
  addToQueue: (call) => {
    const newCall = {
      id: nextId.callQueue++,
      phone_number: call.phone_number,
      contact_name: call.contact_name || null,
      notes: call.notes || null,
      priority: call.priority || 1,
      status: call.status || 'Queued',
      created_at: new Date().toISOString(),
      scheduled_for: call.scheduled_for || null,
      assigned_to: null,
      completed_at: null,
      call_sid: null,
      call_duration: null,
      call_status: null,
      retry_count: call.retry_count || 0,
      last_retry: call.last_retry || null,
      retry_after: call.retry_after || null,
      failure_reason: call.failure_reason || null,
      failure_type: call.failure_type || null,
      failure_category: call.failure_category || null,
      failure_description: call.failure_description || null,
      error_id: call.error_id || null
    };
    
    callQueueData.push(newCall);
    
    return { id: newCall.id };
  },
  
  // Update retry information for a call
  updateRetryInfo: (callId, retryInfo) => {
    const callIndex = callQueueData.findIndex(call => call.id === callId);
    
    if (callIndex === -1) {
      return { changes: 0 };
    }
    
    // Update retry-related fields
    if (retryInfo.status !== undefined) {
      callQueueData[callIndex].status = retryInfo.status;
    }
    
    if (retryInfo.retry_count !== undefined) {
      callQueueData[callIndex].retry_count = retryInfo.retry_count;
    }
    
    if (retryInfo.last_retry !== undefined) {
      callQueueData[callIndex].last_retry = retryInfo.last_retry;
    }
    
    if (retryInfo.retry_after !== undefined) {
      callQueueData[callIndex].retry_after = retryInfo.retry_after;
    }
    
    if (retryInfo.failure_reason !== undefined) {
      callQueueData[callIndex].failure_reason = retryInfo.failure_reason;
    }
    
    if (retryInfo.failure_type !== undefined) {
      callQueueData[callIndex].failure_type = retryInfo.failure_type;
    }
    
    if (retryInfo.failure_category !== undefined) {
      callQueueData[callIndex].failure_category = retryInfo.failure_category;
    }
    
    if (retryInfo.failure_description !== undefined) {
      callQueueData[callIndex].failure_description = retryInfo.failure_description;
    }
    
    if (retryInfo.error_id !== undefined) {
      callQueueData[callIndex].error_id = retryInfo.error_id;
    }
    
    return { changes: 1 };
  },

  // Get all queued calls
  getQueuedCalls: () => {
    const now = new Date();
    
    return callQueueData
      .filter(call => 
        call.status === 'Queued' && 
        (!call.scheduled_for || new Date(call.scheduled_for) <= now)
      )
      .sort((a, b) => {
        // Sort by priority (higher first) then by created_at (older first)
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return new Date(a.created_at) - new Date(b.created_at);
      });
  },

  // Get next call in queue
  getNextCall: () => {
    const queuedCalls = callQueueModule.getQueuedCalls();
    return queuedCalls.length > 0 ? queuedCalls[0] : null;
  },

  // Assign a call to an agent
  assignCallToAgent: (callId, userId) => {
    const callIndex = callQueueData.findIndex(call => call.id === callId);
    
    if (callIndex === -1 || callQueueData[callIndex].status !== 'Queued') {
      return { changes: 0 };
    }
    
    callQueueData[callIndex].status = 'In Progress';
    callQueueData[callIndex].assigned_to = userId;
    
    return { changes: 1 };
  },

  // Update call status
  updateCallStatus: (callId, status, callSid = null) => {
    const callIndex = callQueueData.findIndex(call => call.id === callId);
    
    if (callIndex === -1) {
      return { changes: 0 };
    }
    
    callQueueData[callIndex].status = status;
    
    if (callSid) {
      callQueueData[callIndex].call_sid = callSid;
    }
    
    if (status === 'Completed') {
      callQueueData[callIndex].completed_at = new Date().toISOString();
    }
    
    return { changes: 1 };
  },

  // Complete a call
  completeCall: (callId, callData) => {
    const callIndex = callQueueData.findIndex(call => call.id === callId);
    
    if (callIndex === -1) {
      return { changes: 0 };
    }
    
    callQueueData[callIndex].status = 'Completed';
    callQueueData[callIndex].completed_at = new Date().toISOString();
    callQueueData[callIndex].call_duration = callData.duration || 0;
    callQueueData[callIndex].call_status = callData.status || 'completed';
    
    return { changes: 1 };
  },
  
  // Update a call
  updateCall: (callId, callData) => {
    const callIndex = callQueueData.findIndex(call => call.id === callId);
    
    if (callIndex === -1) {
      return { changes: 0 };
    }
    
    // Update all provided fields
    Object.keys(callData).forEach(key => {
      callQueueData[callIndex][key] = callData[key];
    });
    
    return { changes: 1 };
  },

  // Get call by ID
  getCallById: (id) => {
    return callQueueData.find(call => call.id === id);
  },

  // Get all calls
  getAllCalls: (limit = 100, offset = 0) => {
    return callQueueData
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(offset, offset + limit)
      .map(call => {
        if (call.assigned_to) {
          const user = usersModule.getUserById(call.assigned_to);
          return {
            ...call,
            username: user ? user.username : null,
            agent_name: user ? user.full_name : null
          };
        }
        return call;
      });
  },

  // Get calls assigned to a specific agent
  getCallsByAgent: (userId) => {
    return callQueueData
      .filter(call => call.assigned_to === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  // Get active call for an agent
  getActiveCallForAgent: (userId) => {
    return callQueueData.find(call =>
      call.assigned_to === userId && call.status === 'In Progress'
    );
  }
};

// Disposition methods
const dispositionsModule = {
  // Get all dispositions
  getAllDispositions: () => {
    return dispositionsData;
  },

  // Get active dispositions
  getActiveDispositions: () => {
    return dispositionsData.filter(disposition => disposition.active);
  },

  // Get disposition by ID
  getDispositionById: (id) => {
    return dispositionsData.find(disposition => disposition.id === id);
  },

  // Create a new disposition
  createDisposition: (disposition) => {
    const newDisposition = {
      id: disposition.id || disposition.name.toLowerCase().replace(/\s+/g, '-'),
      name: disposition.name,
      description: disposition.description || '',
      is_final: disposition.is_final || false,
      active: disposition.active !== undefined ? disposition.active : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Check if disposition with same ID already exists
    if (dispositionsData.some(d => d.id === newDisposition.id)) {
      // Generate a unique ID by appending a number
      let counter = 1;
      let uniqueId = `${newDisposition.id}-${counter}`;
      while (dispositionsData.some(d => d.id === uniqueId)) {
        counter++;
        uniqueId = `${newDisposition.id}-${counter}`;
      }
      newDisposition.id = uniqueId;
    }

    dispositionsData.push(newDisposition);
    return newDisposition;
  },

  // Update a disposition
  updateDisposition: (id, disposition) => {
    const index = dispositionsData.findIndex(d => d.id === id);
    
    if (index === -1) {
      return null;
    }

    const updatedDisposition = {
      ...dispositionsData[index],
      name: disposition.name || dispositionsData[index].name,
      description: disposition.description !== undefined ? disposition.description : dispositionsData[index].description,
      is_final: disposition.is_final !== undefined ? disposition.is_final : dispositionsData[index].is_final,
      active: disposition.active !== undefined ? disposition.active : dispositionsData[index].active,
      updated_at: new Date().toISOString()
    };

    dispositionsData[index] = updatedDisposition;

    // If disposition is set to inactive or final, update all workflows that use it
    if ((disposition.active === false || disposition.is_final === true) &&
        dispositionsData[index].active === true &&
        dispositionsData[index].is_final === false) {
      // Find all workflows with triggers that use this disposition
      workflowsData.forEach(workflow => {
        const triggers = workflow.triggers || [];
        triggers.forEach(trigger => {
          if (trigger.type === 'call_disposition' && trigger.disposition === id) {
            // If disposition is now inactive or final, mark the workflow as inactive
            if (disposition.active === false || disposition.is_final === true) {
              workflow.active = false;
              workflow.updated_at = new Date().toISOString();
            }
          }
        });
      });
    }

    return updatedDisposition;
  },

  // Delete a disposition
  deleteDisposition: (id) => {
    const index = dispositionsData.findIndex(d => d.id === id);
    
    if (index === -1) {
      return false;
    }

    // Check if this disposition is used in any workflows
    const isUsed = workflowsData.some(workflow => {
      return (workflow.triggers || []).some(trigger =>
        trigger.type === 'call_disposition' && trigger.disposition === id
      );
    });

    if (isUsed) {
      // If used, just mark as inactive instead of deleting
      dispositionsData[index].active = false;
      dispositionsData[index].updated_at = new Date().toISOString();
      return true;
    }

    // If not used, delete it
    dispositionsData.splice(index, 1);
    return true;
  }
};

// Workflow methods
const workflowsModule = {
  // Get all workflows
  getAllWorkflows: () => {
    return workflowsData;
  },

  // Get active workflows
  getActiveWorkflows: () => {
    return workflowsData.filter(workflow => workflow.active);
  },

  // Get workflow by ID
  getWorkflowById: (id) => {
    return workflowsData.find(workflow => workflow.id === id);
  },

  // Create a new workflow
  createWorkflow: (workflow) => {
    const newWorkflow = {
      id: workflow.id || `workflow_${nextId.workflows++}`,
      name: workflow.name,
      description: workflow.description || '',
      active: workflow.active || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      triggers: workflow.triggers || [],
      steps: workflow.steps || [],
      business_hours: workflow.business_hours || {
        enabled: true,
        timezone: 'America/New_York',
        days: [1, 2, 3, 4, 5],
        start_time: '09:00',
        end_time: '17:00'
      }
    };

    workflowsData.push(newWorkflow);
    return newWorkflow;
  },

  // Update a workflow
  updateWorkflow: (id, workflow) => {
    const index = workflowsData.findIndex(w => w.id === id);
    
    if (index === -1) {
      return null;
    }

    const updatedWorkflow = {
      ...workflowsData[index],
      name: workflow.name || workflowsData[index].name,
      description: workflow.description !== undefined ? workflow.description : workflowsData[index].description,
      active: workflow.active !== undefined ? workflow.active : workflowsData[index].active,
      updated_at: new Date().toISOString()
    };

    if (workflow.triggers) {
      updatedWorkflow.triggers = workflow.triggers;
    }

    if (workflow.steps) {
      updatedWorkflow.steps = workflow.steps;
    }

    if (workflow.business_hours) {
      updatedWorkflow.business_hours = workflow.business_hours;
    }

    workflowsData[index] = updatedWorkflow;
    return updatedWorkflow;
  },

  // Delete a workflow
  deleteWorkflow: (id) => {
    const index = workflowsData.findIndex(w => w.id === id);
    
    if (index === -1) {
      return false;
    }

    workflowsData.splice(index, 1);
    return true;
  },

  // Activate a workflow
  activateWorkflow: (id) => {
    const workflow = workflowsModule.getWorkflowById(id);
    
    if (!workflow) {
      return null;
    }

    workflow.active = true;
    workflow.updated_at = new Date().toISOString();
    return workflow;
  },

  // Deactivate a workflow
  deactivateWorkflow: (id) => {
    const workflow = workflowsModule.getWorkflowById(id);
    
    if (!workflow) {
      return null;
    }

    workflow.active = false;
    workflow.updated_at = new Date().toISOString();
    return workflow;
  }
};

// Call history methods
const callHistoryModule = {
  // Add a call to history
  addToHistory: (call) => {
    const newCall = {
      id: nextId.callHistory++,
      user_id: call.user_id,
      phone_number: call.phone_number,
      contact_name: call.contact_name || null,
      direction: call.direction,
      start_time: call.start_time || new Date().toISOString(),
      end_time: call.end_time || null,
      duration: call.duration || null,
      call_sid: call.call_sid || null,
      call_status: call.call_status || null,
      notes: call.notes || null,
      recording_url: call.recording_url || null,
      disposition_id: call.disposition_id || null,
      disposition_name: call.disposition_name || null,
      updated_at: call.updated_at || new Date().toISOString()
    };
    
    callHistoryData.push(newCall);
    
    return { id: newCall.id };
  },

  // Get call history by ID
  getCallHistoryById: (id) => {
    return callHistoryData.find(call => call.id === id || call.call_sid === id);
  },

  // Update call history
  updateCallHistory: (callSid, callData) => {
    const callIndex = callHistoryData.findIndex(call => call.call_sid === callSid);
    
    if (callIndex === -1) {
      return { changes: 0 };
    }
    
    if (callData.end_time) {
      callHistoryData[callIndex].end_time = callData.end_time;
    }
    
    if (callData.duration) {
      callHistoryData[callIndex].duration = callData.duration;
    }
    
    if (callData.call_status) {
      callHistoryData[callIndex].call_status = callData.call_status;
    }
    
    if (callData.recording_url) {
      callHistoryData[callIndex].recording_url = callData.recording_url;
    }
    
    return { changes: 1 };
  },

  // Update call history by ID
  updateCallHistoryById: (id, callData) => {
    const callIndex = callHistoryData.findIndex(call => call.id === id || call.call_sid === id);
    
    if (callIndex === -1) {
      return { changes: 0 };
    }
    
    // Update all provided fields
    Object.keys(callData).forEach(key => {
      callHistoryData[callIndex][key] = callData[key];
    });
    
    // Update the updated_at timestamp
    callHistoryData[callIndex].updated_at = new Date().toISOString();
    
    return { changes: 1 };
  },

  // Get call history for a specific user
  getCallHistoryByUser: (userId, limit = 50) => {
    return callHistoryData
      .filter(call => call.user_id === userId)
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
      .slice(0, limit);
  },

  // Get all call history
  getAllCallHistory: (limit = 100, offset = 0) => {
    return callHistoryData
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
      .slice(offset, offset + limit)
      .map(call => {
        const user = usersModule.getUserById(call.user_id);
        return {
          ...call,
          username: user ? user.username : null,
          agent_name: user ? user.full_name : null
        };
      });
  }
};

// Campaign methods
const campaignsModule = {
  // Get all campaigns
  getAllCampaigns: () => {
    return campaignsData;
  },

  // Get campaign by ID
  getCampaignById: (id) => {
    return campaignsData.find(campaign => campaign.id === id);
  },

  // Create a new campaign
  createCampaign: (campaign) => {
    const newCampaign = {
      id: campaign.id || `campaign_${nextId.campaigns++}`,
      name: campaign.name,
      description: campaign.description || '',
      criteria: campaign.criteria || [],
      is_dynamic: campaign.is_dynamic !== undefined ? campaign.is_dynamic : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: campaign.created_by,
      lead_count: 0,
      last_refreshed: new Date().toISOString(),
      access_control: campaign.access_control || {
        read: [],
        write: []
      }
    };

    campaignsData.push(newCampaign);
    return newCampaign;
  },

  // Update a campaign
  updateCampaign: (id, campaignData) => {
    const index = campaignsData.findIndex(c => c.id === id);
    
    if (index === -1) {
      return null;
    }

    const updatedCampaign = {
      ...campaignsData[index],
      name: campaignData.name || campaignsData[index].name,
      description: campaignData.description !== undefined ? campaignData.description : campaignsData[index].description,
      updated_at: new Date().toISOString()
    };

    if (campaignData.criteria !== undefined) {
      updatedCampaign.criteria = campaignData.criteria;
    }

    if (campaignData.is_dynamic !== undefined) {
      updatedCampaign.is_dynamic = campaignData.is_dynamic;
    }

    if (campaignData.lead_count !== undefined) {
      updatedCampaign.lead_count = campaignData.lead_count;
    }

    if (campaignData.last_refreshed !== undefined) {
      updatedCampaign.last_refreshed = campaignData.last_refreshed;
    }

    if (campaignData.access_control !== undefined) {
      updatedCampaign.access_control = campaignData.access_control;
    }

    campaignsData[index] = updatedCampaign;
    return updatedCampaign;
  },

  // Delete a campaign
  deleteCampaign: (id) => {
    const index = campaignsData.findIndex(c => c.id === id);
    
    if (index === -1) {
      return false;
    }

    // Delete all campaign members first
    campaignMembersData = campaignMembersData.filter(member => member.campaign_id !== id);
    
    // Delete the campaign
    campaignsData.splice(index, 1);
    return true;
  },

  // Refresh a campaign
  refreshCampaign: async (campaignId) => {
    const campaign = campaignsModule.getCampaignById(campaignId);
    
    if (!campaign) {
      throw new Error('Campaign not found');
    }
    
    // Skip if not dynamic
    if (!campaign.is_dynamic) {
      return { changes: 0 };
    }
    
    // Get all leads (from call queue for now, as we don't have a separate leads table)
    const leads = callQueueData;
    
    // Get current campaign members
    const currentMembers = campaignMembersModule.getCampaignMembers(campaignId);
    const currentMemberIds = new Set(currentMembers.filter(m => m.is_active).map(m => m.lead_id));
    
    // Evaluate each lead against criteria
    const matchingLeads = leads.filter(lead => campaignsModule.evaluateCriteria(lead, campaign.criteria));
    const matchingLeadIds = new Set(matchingLeads.map(lead => lead.id));
    
    // Find leads to add and remove
    const leadsToAdd = matchingLeads.filter(lead => !currentMemberIds.has(lead.id));
    const leadsToRemove = currentMembers.filter(member =>
      member.is_active && !matchingLeadIds.has(member.lead_id)
    );
    
    // Add new matching leads
    for (const lead of leadsToAdd) {
      campaignMembersModule.addCampaignMember({
        campaign_id: campaignId,
        lead_id: lead.id,
        added_at: new Date().toISOString(),
        added_by: null, // Automatic addition
        is_active: true
      });
    }
    
    // Remove non-matching leads
    for (const member of leadsToRemove) {
      campaignMembersModule.removeCampaignMember(campaignId, member.lead_id);
    }
    
    // Update campaign
    campaignsModule.updateCampaign(campaignId, {
      lead_count: matchingLeadIds.size,
      last_refreshed: new Date().toISOString()
    });
    
    return {
      added: leadsToAdd.length,
      removed: leadsToRemove.length,
      total: matchingLeadIds.size
    };
  },

  // Evaluate criteria
  evaluateCriteria: (lead, criteria) => {
    // Handle empty criteria (match all)
    if (!criteria || criteria.length === 0) {
      return true;
    }
    
    let result = true;
    let previousLogic = 'and';
    
    for (const criterion of criteria) {
      const { field, operator, value, logic } = criterion;
      
      // Get the field value from the lead
      const fieldValue = campaignsModule.getFieldValue(lead, field);
      
      // Evaluate the condition
      const conditionResult = campaignsModule.evaluateCondition(fieldValue, operator, value);
      
      // Combine with previous result based on logic
      if (previousLogic === 'and') {
        result = result && conditionResult;
      } else {
        result = result || conditionResult;
      }
      
      // Store logic for next iteration
      previousLogic = logic || 'and';
    }
    
    return result;
  },

  // Get field value
  getFieldValue: (obj, field) => {
    const parts = field.split('.');
    let value = obj;
    
    for (const part of parts) {
      if (value === undefined || value === null) {
        return undefined;
      }
      value = value[part];
    }
    
    return value;
  },

  // Evaluate condition
  evaluateCondition: (fieldValue, operator, compareValue) => {
    switch (operator) {
      case 'equals':
        return fieldValue === compareValue;
      case 'not_equals':
        return fieldValue !== compareValue;
      case 'contains':
        return String(fieldValue).includes(String(compareValue));
      case 'greater_than':
        return fieldValue > compareValue;
      case 'less_than':
        return fieldValue < compareValue;
      case 'in':
        return Array.isArray(compareValue) && compareValue.includes(fieldValue);
      default:
        console.error(`Unknown operator: ${operator}`);
        return false;
    }
  }
};

// Campaign membership methods
const campaignMembersModule = {
  // Get campaign members
  getCampaignMembers: (campaignId) => {
    return campaignMembersData.filter(member => member.campaign_id === campaignId);
  },

  // Get campaign members by lead ID
  getCampaignMembersByLeadId: (leadId) => {
    return campaignMembersData.filter(member => member.lead_id === leadId && member.is_active);
  },

  // Add a campaign member
  addCampaignMember: (member) => {
    // Check if member already exists
    const existingIndex = campaignMembersData.findIndex(
      m => m.campaign_id === member.campaign_id && m.lead_id === member.lead_id
    );

    if (existingIndex !== -1) {
      // Update existing member
      campaignMembersData[existingIndex].is_active = true;
      campaignMembersData[existingIndex].added_at = member.added_at || new Date().toISOString();
      campaignMembersData[existingIndex].added_by = member.added_by;
      return campaignMembersData[existingIndex];
    }

    // Create new member
    const newMember = {
      id: nextId.campaignMembers++,
      campaign_id: member.campaign_id,
      lead_id: member.lead_id,
      added_at: member.added_at || new Date().toISOString(),
      added_by: member.added_by,
      is_active: member.is_active !== undefined ? member.is_active : true
    };

    campaignMembersData.push(newMember);

    // Update campaign lead count
    const campaign = campaignsModule.getCampaignById(member.campaign_id);
    if (campaign) {
      campaign.lead_count = campaignMembersModule.getCampaignMembers(member.campaign_id)
        .filter(m => m.is_active).length;
      campaign.updated_at = new Date().toISOString();
    }

    return newMember;
  },

  // Remove a campaign member
  removeCampaignMember: (campaignId, leadId) => {
    const memberIndex = campaignMembersData.findIndex(
      member => member.campaign_id === campaignId && member.lead_id === leadId
    );

    if (memberIndex === -1) {
      return false;
    }

    // Set is_active to false instead of removing
    campaignMembersData[memberIndex].is_active = false;

    // Update campaign lead count
    const campaign = campaignsModule.getCampaignById(campaignId);
    if (campaign) {
      campaign.lead_count = campaignMembersModule.getCampaignMembers(campaignId)
        .filter(m => m.is_active).length;
      campaign.updated_at = new Date().toISOString();
    }

    return true;
  }
};

// Contact center methods
const contactCentersModule = {
  // Get all contact centers
  getAllContactCenters: () => {
    return contactCentersData;
  },

  // Get contact center by ID
  getContactCenterById: (id) => {
    return contactCentersData.find(center => center.id === id);
  },

  // Create a new contact center
  createContactCenter: (data) => {
    const newContactCenter = {
      id: data.id || `cc_${nextId.contactCenters++}`,
      name: data.name,
      description: data.description || '',
      created_at: data.created_at || new Date().toISOString(),
      updated_at: data.updated_at || new Date().toISOString(),
      active: data.active !== undefined ? data.active : true,
      settings: data.settings || {}
    };

    contactCentersData.push(newContactCenter);
    return newContactCenter;
  },

  // Update a contact center
  updateContactCenter: (id, data) => {
    const index = contactCentersData.findIndex(center => center.id === id);
    
    if (index === -1) {
      return null;
    }

    const updatedCenter = {
      ...contactCentersData[index],
      ...data,
      updated_at: new Date().toISOString()
    };

    contactCentersData[index] = updatedCenter;
    return updatedCenter;
  },

  // Delete a contact center
  deleteContactCenter: (id) => {
    const index = contactCentersData.findIndex(center => center.id === id);
    
    if (index === -1) {
      return false;
    }

    // Delete all associated agents and phone numbers
    contactCenterAgentsData = contactCenterAgentsData.filter(agent => agent.contact_center_id !== id);
    contactCenterPhonesData = contactCenterPhonesData.filter(phone => phone.contact_center_id !== id);

    // Delete the contact center
    contactCentersData.splice(index, 1);
    return true;
  },

  // Find contact center by phone number
  findContactCenterByPhoneNumber: (phoneNumber) => {
    const phone = contactCenterPhonesModule.getContactCenterPhoneByNumber(phoneNumber);
    
    if (!phone) {
      return null;
    }
    
    return contactCentersModule.getContactCenterById(phone.contact_center_id);
  }
};

// Contact center agent methods
const contactCenterAgentsModule = {
  // Get contact center agents
  getContactCenterAgents: (contactCenterId) => {
    return contactCenterAgentsData.filter(agent => agent.contact_center_id === contactCenterId);
  },

  // Get contact center agents by user ID
  getContactCenterAgentsByUserId: (userId) => {
    return contactCenterAgentsData.filter(agent => agent.user_id === userId && agent.active);
  },

  // Add an agent to a contact center
  addAgentToContactCenter: (contactCenterId, userId, role = 'agent') => {
    // Check if the agent is already in the contact center
    const existing = contactCenterAgentsData.find(
      agent => agent.contact_center_id === contactCenterId && agent.user_id === userId
    );

    if (existing) {
      // If already exists but inactive, reactivate
      if (!existing.active) {
        existing.active = true;
        existing.updated_at = new Date().toISOString();
        return existing;
      }
      return null; // Already active
    }

    // Create new membership
    const newAgent = {
      id: `cca_${nextId.contactCenterAgents++}`,
      contact_center_id: contactCenterId,
      user_id: userId,
      role: role,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      active: true
    };

    contactCenterAgentsData.push(newAgent);
    return newAgent;
  },

  // Remove an agent from a contact center
  removeAgentFromContactCenter: (contactCenterId, userId) => {
    const index = contactCenterAgentsData.findIndex(
      agent => agent.contact_center_id === contactCenterId && agent.user_id === userId
    );

    if (index === -1) {
      return false;
    }

    // Set to inactive instead of removing
    contactCenterAgentsData[index].active = false;
    contactCenterAgentsData[index].updated_at = new Date().toISOString();
    return true;
  },

  // Update a contact center agent
  updateContactCenterAgent: (contactCenterId, userId, data) => {
    const index = contactCenterAgentsData.findIndex(
      agent => agent.contact_center_id === contactCenterId && agent.user_id === userId
    );

    if (index === -1) {
      return null;
    }

    const updatedAgent = {
      ...contactCenterAgentsData[index],
      ...data,
      updated_at: new Date().toISOString()
    };

    contactCenterAgentsData[index] = updatedAgent;
    return updatedAgent;
  },

  // Get available agents in a contact center
  getAvailableContactCenterAgents: (contactCenterId) => {
    const agents = contactCenterAgentsModule.getContactCenterAgents(contactCenterId).filter(agent => agent.active);
    const availableAgents = [];
    
    for (const agent of agents) {
      const status = agentStatusModule.getAgentStatus(agent.user_id);
      
      // Check if agent is available
      if (status && status.status === 'Available') {
        const user = usersModule.getUserById(agent.user_id);
        if (user) {
          availableAgents.push({
            ...agent,
            status,
            username: user.username,
            full_name: user.full_name
          });
        }
      }
    }
    
    return availableAgents;
  }
};

// Contact center phone methods
const contactCenterPhonesModule = {
  // Get contact center phones
  getContactCenterPhones: (contactCenterId) => {
    return contactCenterPhonesData.filter(phone => phone.contact_center_id === contactCenterId);
  },

  // Get contact center phone by number
  getContactCenterPhoneByNumber: (phoneNumber) => {
    // Format the phone number to E.164 if needed
    let formattedNumber = phoneNumber;
    if (!formattedNumber.startsWith('+') && formattedNumber.replace(/\D/g, '').length === 10) {
      formattedNumber = `+1${formattedNumber.replace(/\D/g, '')}`;
    }
    
    return contactCenterPhonesData.find(phone => phone.phone_number === formattedNumber && phone.active);
  },

  // Add a phone to a contact center
  addPhoneToContactCenter: (contactCenterId, phoneData) => {
    // Format the phone number to E.164 if needed
    let formattedNumber = phoneData.phone_number;
    if (!formattedNumber.startsWith('+') && formattedNumber.replace(/\D/g, '').length === 10) {
      formattedNumber = `+1${formattedNumber.replace(/\D/g, '')}`;
    }
    
    // Check if this phone number already exists
    const existing = contactCenterPhonesData.find(
      phone => phone.phone_number === formattedNumber
    );

    if (existing) {
      // If it exists for a different contact center, return null
      if (existing.contact_center_id !== contactCenterId) {
        return null;
      }
      
      // If it exists for this contact center but inactive, reactivate
      if (!existing.active) {
        existing.active = true;
        existing.updated_at = new Date().toISOString();
        return existing;
      }
      
      return null; // Already active
    }

    // Check if this is the first number for this contact center
    const existingPhones = contactCenterPhonesModule.getContactCenterPhones(contactCenterId);
    const isDefault = existingPhones.length === 0 ? true : !!phoneData.is_default;
    
    // If this is being set as default, unset any existing defaults
    if (isDefault) {
      for (const phone of existingPhones) {
        if (phone.is_default) {
          phone.is_default = false;
          phone.updated_at = new Date().toISOString();
        }
      }
    }

    // Create new phone number
    const newPhone = {
      id: `ccp_${nextId.contactCenterPhones++}`,
      contact_center_id: contactCenterId,
      phone_number: formattedNumber,
      friendly_name: phoneData.friendly_name || formattedNumber,
      direction: phoneData.direction || 'both',
      is_default: isDefault,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      active: true
    };

    contactCenterPhonesData.push(newPhone);
    return newPhone;
  },

  // Remove a phone from a contact center
  removePhoneFromContactCenter: (phoneId) => {
    const index = contactCenterPhonesData.findIndex(phone => phone.id === phoneId);
    
    if (index === -1) {
      return false;
    }

    const phone = contactCenterPhonesData[index];
    
    // Set to inactive instead of removing
    phone.active = false;
    phone.updated_at = new Date().toISOString();
    
    // If this was the default, set a new default if there are other active numbers
    if (phone.is_default) {
      const otherActivePhones = contactCenterPhonesData.filter(
        p => p.contact_center_id === phone.contact_center_id && p.active && p.id !== phoneId
      );
      
      if (otherActivePhones.length > 0) {
        otherActivePhones[0].is_default = true;
        otherActivePhones[0].updated_at = new Date().toISOString();
      }
    }
    
    return true;
  },

  // Update a contact center phone
  updateContactCenterPhone: (phoneId, data) => {
    const index = contactCenterPhonesData.findIndex(phone => phone.id === phoneId);
    
    if (index === -1) {
      return null;
    }

    const phone = contactCenterPhonesData[index];
    const contactCenterId = phone.contact_center_id;
    
    // If setting as default, unset any existing defaults
    if (data.is_default && !phone.is_default) {
      const otherPhones = contactCenterPhonesData.filter(
        p => p.contact_center_id === contactCenterId && p.active && p.id !== phoneId
      );
      
      for (const otherPhone of otherPhones) {
        if (otherPhone.is_default) {
          otherPhone.is_default = false;
          otherPhone.updated_at = new Date().toISOString();
        }
      }
    }

    const updatedPhone = {
      ...phone,
      ...data,
      updated_at: new Date().toISOString()
    };

    contactCenterPhonesData[index] = updatedPhone;
    return updatedPhone;
  }
};

// Helper methods
const run = (sql, params = []) => {
  console.log('Memory store run:', sql, params);
  return Promise.resolve({ id: 0, changes: 0 });
};

const get = (sql, params = []) => {
  console.log('Memory store get:', sql, params);
  return Promise.resolve(null);
};

const all = (sql, params = []) => {
  console.log('Memory store all:', sql, params);
  return Promise.resolve([]);
};

// Export the modules
module.exports = {
  users: {
    getByUsername: (username) => Promise.resolve(usersModule.getUserByUsername(username)),
    getById: (id) => Promise.resolve(usersModule.getUserById(id)),
    create: (user) => Promise.resolve(usersModule.createUser(user)),
    update: (id, userData) => Promise.resolve(usersModule.updateUser(id, userData)),
    getAll: () => Promise.resolve(usersModule.getAllUsers()),
    getAllAgents: () => Promise.resolve(usersModule.getAllAgents())
  },
  agentStatus: {
    getByUserId: (userId) => Promise.resolve(agentStatusModule.getAgentStatus(userId)),
    updateStatus: (userId, status) => Promise.resolve(agentStatusModule.updateAgentStatus(userId, status)),
    getAllWithUserInfo: () => Promise.resolve(agentStatusModule.getAllAgentStatuses()),
    getAvailableAgents: () => Promise.resolve(agentStatusModule.getAvailableAgents())
  },
  dispositions: {
    getAll: () => Promise.resolve(dispositionsModule.getAllDispositions()),
    getActive: () => Promise.resolve(dispositionsModule.getActiveDispositions()),
    getById: (id) => Promise.resolve(dispositionsModule.getDispositionById(id)),
    create: (disposition) => Promise.resolve(dispositionsModule.createDisposition(disposition)),
    update: (id, disposition) => Promise.resolve(dispositionsModule.updateDisposition(id, disposition)),
    delete: (id) => Promise.resolve(dispositionsModule.deleteDisposition(id))
  },
  workflows: {
    getAll: () => Promise.resolve(workflowsModule.getAllWorkflows()),
    getActive: () => Promise.resolve(workflowsModule.getActiveWorkflows()),
    getById: (id) => Promise.resolve(workflowsModule.getWorkflowById(id)),
    create: (workflow) => Promise.resolve(workflowsModule.createWorkflow(workflow)),
    update: (id, workflow) => Promise.resolve(workflowsModule.updateWorkflow(id, workflow)),
    delete: (id) => Promise.resolve(workflowsModule.deleteWorkflow(id)),
    activate: (id) => Promise.resolve(workflowsModule.activateWorkflow(id)),
    deactivate: (id) => Promise.resolve(workflowsModule.deactivateWorkflow(id))
  },
  callQueue: {
    add: (call) => Promise.resolve(callQueueModule.addToQueue(call)),
    getQueued: () => Promise.resolve(callQueueModule.getQueuedCalls()),
    getNext: () => Promise.resolve(callQueueModule.getNextCall()),
    assignToAgent: (callId, userId) => Promise.resolve(callQueueModule.assignCallToAgent(callId, userId)),
    updateStatus: (callId, status, callSid) => Promise.resolve(callQueueModule.updateCallStatus(callId, status, callSid)),
    complete: (callId, callData) => Promise.resolve(callQueueModule.completeCall(callId, callData)),
    update: (callId, callData) => Promise.resolve(callQueueModule.updateCall(callId, callData)),
    getById: (id) => Promise.resolve(callQueueModule.getCallById(id)),
    getAll: (limit, offset) => Promise.resolve(callQueueModule.getAllCalls(limit, offset)),
    getByAgent: (userId) => Promise.resolve(callQueueModule.getCallsByAgent(userId)),
    getActiveCallForAgent: (userId) => Promise.resolve(callQueueModule.getActiveCallForAgent(userId)),
    updateRetryInfo: (callId, retryInfo) => Promise.resolve(callQueueModule.updateRetryInfo(callId, retryInfo))
  },
  callHistory: {
    add: (call) => Promise.resolve(callHistoryModule.addToHistory(call)),
    update: (callSid, callData) => Promise.resolve(callHistoryModule.updateCallHistory(callSid, callData)),
    getById: (id) => Promise.resolve(callHistoryModule.getCallHistoryById(id)),
    updateById: (id, callData) => Promise.resolve(callHistoryModule.updateCallHistoryById(id, callData)),
    getByUser: (userId, limit) => Promise.resolve(callHistoryModule.getCallHistoryByUser(userId, limit)),
    getAll: (limit, offset) => Promise.resolve(callHistoryModule.getAllCallHistory(limit, offset))
  },
  campaigns: {
    getAll: () => Promise.resolve(campaignsModule.getAllCampaigns()),
    getById: (id) => Promise.resolve(campaignsModule.getCampaignById(id)),
    create: (campaign) => Promise.resolve(campaignsModule.createCampaign(campaign)),
    update: (id, campaignData) => Promise.resolve(campaignsModule.updateCampaign(id, campaignData)),
    delete: (id) => Promise.resolve(campaignsModule.deleteCampaign(id)),
    refresh: (id) => campaignsModule.refreshCampaign(id)
  },
  campaignMembers: {
    getByCampaignId: (campaignId) => Promise.resolve(campaignMembersModule.getCampaignMembers(campaignId)),
    getByLeadId: (leadId) => Promise.resolve(campaignMembersModule.getCampaignMembersByLeadId(leadId)),
    add: (member) => Promise.resolve(campaignMembersModule.addCampaignMember(member)),
    remove: (campaignId, leadId) => Promise.resolve(campaignMembersModule.removeCampaignMember(campaignId, leadId))
  },
  contactCenters: {
    getAll: () => Promise.resolve(contactCentersModule.getAllContactCenters()),
    getById: (id) => Promise.resolve(contactCentersModule.getContactCenterById(id)),
    create: (data) => Promise.resolve(contactCentersModule.createContactCenter(data)),
    update: (id, data) => Promise.resolve(contactCentersModule.updateContactCenter(id, data)),
    delete: (id) => Promise.resolve(contactCentersModule.deleteContactCenter(id)),
    findByPhoneNumber: (phoneNumber) => Promise.resolve(contactCentersModule.findContactCenterByPhoneNumber(phoneNumber))
  },
  contactCenterAgents: {
    getByContactCenterId: (contactCenterId) => Promise.resolve(contactCenterAgentsModule.getContactCenterAgents(contactCenterId)),
    getByUserId: (userId) => Promise.resolve(contactCenterAgentsModule.getContactCenterAgentsByUserId(userId)),
    add: (contactCenterId, userId, role) => Promise.resolve(contactCenterAgentsModule.addAgentToContactCenter(contactCenterId, userId, role)),
    remove: (contactCenterId, userId) => Promise.resolve(contactCenterAgentsModule.removeAgentFromContactCenter(contactCenterId, userId)),
    update: (contactCenterId, userId, data) => Promise.resolve(contactCenterAgentsModule.updateContactCenterAgent(contactCenterId, userId, data)),
    getAvailable: (contactCenterId) => Promise.resolve(contactCenterAgentsModule.getAvailableContactCenterAgents(contactCenterId))
  },
  contactCenterPhones: {
    getByContactCenterId: (contactCenterId) => Promise.resolve(contactCenterPhonesModule.getContactCenterPhones(contactCenterId)),
    getByPhoneNumber: (phoneNumber) => Promise.resolve(contactCenterPhonesModule.getContactCenterPhoneByNumber(phoneNumber)),
    add: (contactCenterId, phoneData) => Promise.resolve(contactCenterPhonesModule.addPhoneToContactCenter(contactCenterId, phoneData)),
    remove: (phoneId) => Promise.resolve(contactCenterPhonesModule.removePhoneFromContactCenter(phoneId)),
    update: (phoneId, data) => Promise.resolve(contactCenterPhonesModule.updateContactCenterPhone(phoneId, data))
  },
  run: (sql, params) => Promise.resolve(run(sql, params)),
  get: (sql, params) => Promise.resolve(get(sql, params)),
  all: (sql, params) => Promise.resolve(all(sql, params)),
  hashPassword,
  verifyPassword
};
