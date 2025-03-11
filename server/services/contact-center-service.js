// Contact Center Service for Twilio Dialer Web App
const store = require('../memory-store');
const errorService = require('./error-service');

/**
 * Contact Center Service
 * 
 * This service provides methods for managing contact centers, contact center agents,
 * and contact center phone numbers. It also includes methods for finding available
 * agents in a contact center and finding a contact center by phone number.
 */
class ContactCenterService {
  /**
   * Get all contact centers
   * 
   * @returns {Promise<Array>} Array of all contact centers
   */
  async getAllContactCenters() {
    try {
      const contactCenters = await store.contactCenters.getAll();
      
      // Enrich with agent and phone counts
      const enrichedCenters = [];
      
      for (const center of contactCenters) {
        const agents = await this.getContactCenterAgents(center.id);
        const phones = await this.getContactCenterPhoneNumbers(center.id);
        
        enrichedCenters.push({
          ...center,
          agentCount: agents.length,
          phoneCount: phones.length
        });
      }
      
      return enrichedCenters;
    } catch (error) {
      errorService.handleError(error, 'contact-center-service.getAllContactCenters');
      return [];
    }
  }
  
  /**
   * Get a contact center by ID
   * 
   * @param {string} id - The contact center ID
   * @returns {Promise<Object|null>} The contact center or null if not found
   */
  async getContactCenterById(id) {
    try {
      const contactCenter = await store.contactCenters.getById(id);
      
      if (!contactCenter) {
        return null;
      }
      
      // Enrich with agent and phone counts
      const agents = await this.getContactCenterAgents(id);
      const phones = await this.getContactCenterPhoneNumbers(id);
      
      return {
        ...contactCenter,
        agentCount: agents.length,
        phoneCount: phones.length
      };
    } catch (error) {
      errorService.handleError(error, 'contact-center-service.getContactCenterById');
      return null;
    }
  }
  
  /**
   * Create a new contact center
   * 
   * @param {Object} data - The contact center data
   * @returns {Promise<Object>} The created contact center
   */
  async createContactCenter(data) {
    try {
      if (!data.name) {
        throw new Error('Contact center name is required');
      }
      
      const result = await store.contactCenters.create({
        name: data.name,
        description: data.description || '',
        settings: data.settings || {}
      });
      
      return result;
    } catch (error) {
      errorService.handleError(error, 'contact-center-service.createContactCenter');
      throw error;
    }
  }
  
  /**
   * Update a contact center
   * 
   * @param {string} id - The contact center ID
   * @param {Object} data - The updated contact center data
   * @returns {Promise<Object|null>} The updated contact center or null if not found
   */
  async updateContactCenter(id, data) {
    try {
      const result = await store.contactCenters.update(id, data);
      return result;
    } catch (error) {
      errorService.handleError(error, 'contact-center-service.updateContactCenter');
      throw error;
    }
  }
  
  /**
   * Delete a contact center
   * 
   * @param {string} id - The contact center ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteContactCenter(id) {
    try {
      return await store.contactCenters.delete(id);
    } catch (error) {
      errorService.handleError(error, 'contact-center-service.deleteContactCenter');
      throw error;
    }
  }
  
  /**
   * Get all agents in a contact center
   * 
   * @param {string} contactCenterId - The contact center ID
   * @returns {Promise<Array>} Array of agents in the contact center
   */
  async getContactCenterAgents(contactCenterId) {
    try {
      const memberships = await store.contactCenterAgents.getByContactCenterId(contactCenterId);
      
      // Get full user details for each agent
      const agentDetails = [];
      for (const membership of memberships) {
        const user = await store.users.getById(membership.user_id);
        if (user) {
          // Get agent status
          const status = await store.agentStatus.getByUserId(user.id);
          
          agentDetails.push({
            ...user,
            role: membership.role,
            membership_id: membership.id,
            active: membership.active,
            status: status ? status.status : 'Unknown',
            last_status_change: status ? status.last_status_change : null
          });
        }
      }
      
      return agentDetails;
    } catch (error) {
      errorService.handleError(error, 'contact-center-service.getContactCenterAgents');
      return [];
    }
  }
  
  /**
   * Get available agents in a contact center
   * 
   * @param {string} contactCenterId - The contact center ID
   * @returns {Promise<Array>} Array of available agents in the contact center
   */
  async getAvailableContactCenterAgents(contactCenterId) {
    try {
      return await store.contactCenterAgents.getAvailable(contactCenterId);
    } catch (error) {
      errorService.handleError(error, 'contact-center-service.getAvailableContactCenterAgents');
      return [];
    }
  }
  
  /**
   * Add an agent to a contact center
   * 
   * @param {string} contactCenterId - The contact center ID
   * @param {string} userId - The user ID
   * @param {string} role - The role (default: 'agent')
   * @returns {Promise<Object>} Result object with success flag
   */
  async addAgentToContactCenter(contactCenterId, userId, role = 'agent') {
    try {
      // Check if the contact center exists
      const contactCenter = await store.contactCenters.getById(contactCenterId);
      if (!contactCenter) {
        return { success: false, error: 'Contact center not found' };
      }
      
      // Check if the user exists
      const user = await store.users.getById(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }
      
      // Add the agent to the contact center
      const result = await store.contactCenterAgents.add(contactCenterId, userId, role);
      
      if (!result) {
        return { success: false, error: 'Agent is already a member of this contact center' };
      }
      
      return { success: true, membership: result };
    } catch (error) {
      errorService.handleError(error, 'contact-center-service.addAgentToContactCenter');
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Remove an agent from a contact center
   * 
   * @param {string} contactCenterId - The contact center ID
   * @param {string} userId - The user ID
   * @returns {Promise<Object>} Result object with success flag
   */
  async removeAgentFromContactCenter(contactCenterId, userId) {
    try {
      const result = await store.contactCenterAgents.remove(contactCenterId, userId);
      
      if (!result) {
        return { success: false, error: 'Agent is not a member of this contact center' };
      }
      
      return { success: true };
    } catch (error) {
      errorService.handleError(error, 'contact-center-service.removeAgentFromContactCenter');
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get all phone numbers for a contact center
   * 
   * @param {string} contactCenterId - The contact center ID
   * @returns {Promise<Array>} Array of phone numbers for the contact center
   */
  async getContactCenterPhoneNumbers(contactCenterId) {
    try {
      return await store.contactCenterPhones.getByContactCenterId(contactCenterId);
    } catch (error) {
      errorService.handleError(error, 'contact-center-service.getContactCenterPhoneNumbers');
      return [];
    }
  }
  
  /**
   * Add a phone number to a contact center
   * 
   * @param {string} contactCenterId - The contact center ID
   * @param {Object} phoneData - The phone number data
   * @returns {Promise<Object>} Result object with success flag
   */
  async addPhoneNumberToContactCenter(contactCenterId, phoneData) {
    try {
      // Check if the contact center exists
      const contactCenter = await store.contactCenters.getById(contactCenterId);
      if (!contactCenter) {
        return { success: false, error: 'Contact center not found' };
      }
      
      // Validate phone number
      if (!phoneData.phone_number) {
        return { success: false, error: 'Phone number is required' };
      }
      
      // Add the phone number
      const result = await store.contactCenterPhones.add(contactCenterId, phoneData);
      
      if (!result) {
        return { success: false, error: 'Phone number already exists for another contact center' };
      }
      
      return { success: true, phone: result };
    } catch (error) {
      errorService.handleError(error, 'contact-center-service.addPhoneNumberToContactCenter');
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Remove a phone number from a contact center
   * 
   * @param {string} phoneId - The phone number ID
   * @returns {Promise<Object>} Result object with success flag
   */
  async removePhoneNumberFromContactCenter(phoneId) {
    try {
      const result = await store.contactCenterPhones.remove(phoneId);
      
      if (!result) {
        return { success: false, error: 'Phone number not found' };
      }
      
      return { success: true };
    } catch (error) {
      errorService.handleError(error, 'contact-center-service.removePhoneNumberFromContactCenter');
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Find a contact center by phone number
   * 
   * @param {string} phoneNumber - The phone number
   * @returns {Promise<Object|null>} The contact center or null if not found
   */
  async findContactCenterByPhoneNumber(phoneNumber) {
    try {
      return await store.contactCenters.findByPhoneNumber(phoneNumber);
    } catch (error) {
      errorService.handleError(error, 'contact-center-service.findContactCenterByPhoneNumber');
      return null;
    }
  }
}

// Create a singleton instance
const contactCenterService = new ContactCenterService();

module.exports = contactCenterService;