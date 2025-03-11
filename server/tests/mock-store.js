// Mock store implementation for testing
const mockStore = {
  // Mock call queue
  callQueue: [],
  
  // Mock workflows
  workflows: [],
  
  // Mock dispositions
  dispositions: [],
  
  // Mock campaigns - missing implementation causing test failures
  campaigns: {
    getById: async (id) => {
      console.log(`Mock campaigns.getById called with ID: ${id}`);
      return {
        id,
        name: `Test Campaign ${id}`,
        description: 'Mock campaign for testing',
        is_active: true,
        created_at: new Date().toISOString()
      };
    },
    refresh: async (id) => {
      console.log(`Mock campaigns.refresh called with ID: ${id}`);
      return true;
    }
  },
  
  // Mock campaign members - missing implementation causing test failures
  campaignMembers: {
    getByLeadId: async (leadId) => {
      console.log(`Mock campaignMembers.getByLeadId called with ID: ${leadId}`);
      return []; // Return empty array by default for testing
    },
    add: async (data) => {
      console.log(`Mock campaignMembers.add called with data:`, data);
      return { ...data, id: `campaign_member_${Date.now()}` };
    },
    remove: async (campaignId, leadId) => {
      console.log(`Mock campaignMembers.remove called for campaign ${campaignId}, lead ${leadId}`);
      return true;
    }
  },
  
  // Mock ID counter
  nextId: {
    workflows: 1,
    callQueue: 1
  }
};

module.exports = mockStore;