/**
 * Campaign Management API Routes
 * 
 * This module provides API endpoints for managing campaigns and campaign memberships.
 * It implements CRUD operations for campaigns, campaign membership management,
 * and campaign refresh functionality.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated, isAdmin } = require('../auth');

/**
 * Middleware to check campaign access permissions
 * This enforces the access control rules defined in the campaign's access_control field
 * 
 * @param {string} accessType - The type of access to check ('read' or 'write')
 * @returns {Function} Express middleware function
 */
function checkCampaignAccess(accessType = 'read') {
  return async (req, res, next) => {
    try {
      const campaignId = req.params.id;
      
      // Skip for admins - they have full access to all campaigns
      if (req.user.role === 'admin') {
        return next();
      }
      
      // Get the campaign
      const campaign = await db.campaigns.getById(campaignId);
      
      if (!campaign) {
        return res.status(404).json({ message: 'Campaign not found' });
      }
      
      // Check access
      const { access_control } = campaign;
      const userId = req.user.id;
      
      if (accessType === 'write') {
        // Check write access
        if (access_control.write.length > 0 && !access_control.write.includes(userId)) {
          return res.status(403).json({ message: 'You do not have write access to this campaign' });
        }
      } else {
        // Check read access
        if (access_control.read.length > 0 && !access_control.read.includes(userId)) {
          return res.status(403).json({ message: 'You do not have read access to this campaign' });
        }
      }
      
      next();
    } catch (error) {
      console.error('Error checking campaign access:', error);
      res.status(500).json({ message: 'Error checking campaign access' });
    }
  };
}

/**
 * GET /api/campaigns
 * Get all campaigns the user has access to
 */
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const campaigns = await db.campaigns.getAll();
    
    // Filter campaigns based on user access
    const filteredCampaigns = campaigns.map(campaign => {
      // Determine user's access level for this campaign
      let access = 'none';
      
      // Admins have write access to all campaigns
      if (req.user.role === 'admin') {
        access = 'write';
      } else {
        // Check if user has write access
        if (campaign.access_control.write.length === 0 || 
            campaign.access_control.write.includes(req.user.id)) {
          access = 'write';
        } 
        // Check if user has read access
        else if (campaign.access_control.read.length === 0 || 
                 campaign.access_control.read.includes(req.user.id)) {
          access = 'read';
        }
      }
      
      // Only include campaigns the user has access to
      if (access !== 'none') {
        return {
          id: campaign.id,
          name: campaign.name,
          description: campaign.description,
          lead_count: campaign.lead_count,
          last_refreshed: campaign.last_refreshed,
          created_at: campaign.created_at,
          created_by: campaign.created_by,
          is_dynamic: campaign.is_dynamic,
          access
        };
      }
      
      return null;
    }).filter(Boolean); // Remove null entries
    
    res.json({ campaigns: filteredCampaigns });
  } catch (error) {
    console.error('Error getting campaigns:', error);
    res.status(500).json({ message: 'Error getting campaigns' });
  }
});

/**
 * GET /api/campaigns/:id
 * Get a specific campaign by ID
 */
router.get('/:id', isAuthenticated, checkCampaignAccess('read'), async (req, res) => {
  try {
    const campaign = await db.campaigns.getById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    res.json(campaign);
  } catch (error) {
    console.error('Error getting campaign:', error);
    res.status(500).json({ message: 'Error getting campaign' });
  }
});

/**
 * POST /api/campaigns
 * Create a new campaign
 */
router.post('/', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { name, description, criteria, is_dynamic, access_control } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Campaign name is required' });
    }
    
    const campaign = await db.campaigns.create({
      name,
      description,
      criteria,
      is_dynamic,
      access_control,
      created_by: req.user.id
    });
    
    res.status(201).json(campaign);
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ message: 'Error creating campaign' });
  }
});

/**
 * PUT /api/campaigns/:id
 * Update a campaign
 */
router.put('/:id', isAuthenticated, checkCampaignAccess('write'), async (req, res) => {
  try {
    const { name, description, criteria, is_dynamic, access_control } = req.body;
    const campaignId = req.params.id;
    
    // Get the existing campaign
    const existingCampaign = await db.campaigns.getById(campaignId);
    
    if (!existingCampaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    // Update the campaign
    const updatedCampaign = await db.campaigns.update(campaignId, {
      name,
      description,
      criteria,
      is_dynamic,
      access_control
    });
    
    // If the campaign is dynamic and criteria changed, refresh it
    if (is_dynamic && criteria && 
        JSON.stringify(criteria) !== JSON.stringify(existingCampaign.criteria)) {
      // Refresh in the background
      db.campaigns.refresh(campaignId).catch(err => {
        console.error(`Error refreshing campaign ${campaignId}:`, err);
      });
    }
    
    res.json(updatedCampaign);
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({ message: 'Error updating campaign' });
  }
});

/**
 * DELETE /api/campaigns/:id
 * Delete a campaign
 */
router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const result = await db.campaigns.delete(req.params.id);
    
    if (!result) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ message: 'Error deleting campaign' });
  }
});

/**
 * POST /api/campaigns/:id/refresh
 * Refresh a campaign's membership based on criteria
 */
router.post('/:id/refresh', isAuthenticated, checkCampaignAccess('write'), async (req, res) => {
  try {
    const campaignId = req.params.id;
    
    // Get the campaign
    const campaign = await db.campaigns.getById(campaignId);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    // Only dynamic campaigns can be refreshed
    if (!campaign.is_dynamic) {
      return res.status(400).json({ message: 'Only dynamic campaigns can be refreshed' });
    }
    
    // Refresh the campaign
    const result = await db.campaigns.refresh(campaignId);
    
    res.json({
      message: 'Campaign refreshed successfully',
      added: result.added,
      removed: result.removed,
      total: result.total
    });
  } catch (error) {
    console.error('Error refreshing campaign:', error);
    res.status(500).json({ message: 'Error refreshing campaign' });
  }
});

/**
 * GET /api/campaigns/:id/leads
 * Get all leads in a campaign
 */
router.get('/:id/leads', isAuthenticated, checkCampaignAccess('read'), async (req, res) => {
  try {
    const campaignId = req.params.id;
    
    // Get the campaign members
    const members = await db.campaignMembers.getByCampaignId(campaignId);
    
    // Only include active members
    const activeMembers = members.filter(member => member.is_active);
    
    // Get the lead details for each member
    const leads = await Promise.all(
      activeMembers.map(async member => {
        const lead = await db.callQueue.getById(member.lead_id);
        
        if (!lead) {
          return null;
        }
        
        return {
          id: lead.id,
          phone_number: lead.phone_number,
          contact_name: lead.contact_name,
          added_at: member.added_at,
          added_by: member.added_by,
          is_active: member.is_active
        };
      })
    );
    
    // Filter out null leads (in case some leads were deleted)
    const validLeads = leads.filter(Boolean);
    
    res.json({ leads: validLeads });
  } catch (error) {
    console.error('Error getting campaign leads:', error);
    res.status(500).json({ message: 'Error getting campaign leads' });
  }
});

/**
 * POST /api/campaigns/:id/leads
 * Add a lead to a campaign
 */
router.post('/:id/leads', isAuthenticated, checkCampaignAccess('write'), async (req, res) => {
  try {
    const campaignId = req.params.id;
    const { lead_id } = req.body;
    
    if (!lead_id) {
      return res.status(400).json({ message: 'Lead ID is required' });
    }
    
    // Check if the campaign exists
    const campaign = await db.campaigns.getById(campaignId);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    // Check if the lead exists
    const lead = await db.callQueue.getById(lead_id);
    
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }
    
    // Add the lead to the campaign
    const member = await db.campaignMembers.add({
      campaign_id: campaignId,
      lead_id,
      added_at: new Date().toISOString(),
      added_by: req.user.id,
      is_active: true
    });
    
    res.status(201).json(member);
  } catch (error) {
    console.error('Error adding lead to campaign:', error);
    res.status(500).json({ message: 'Error adding lead to campaign' });
  }
});

/**
 * DELETE /api/campaigns/:id/leads/:leadId
 * Remove a lead from a campaign
 */
router.delete('/:id/leads/:leadId', isAuthenticated, checkCampaignAccess('write'), async (req, res) => {
  try {
    const { id: campaignId, leadId } = req.params;
    
    // Remove the lead from the campaign
    const result = await db.campaignMembers.remove(campaignId, parseInt(leadId));
    
    if (!result) {
      return res.status(404).json({ message: 'Lead not found in campaign' });
    }
    
    res.json({ message: 'Lead removed from campaign successfully' });
  } catch (error) {
    console.error('Error removing lead from campaign:', error);
    res.status(500).json({ message: 'Error removing lead from campaign' });
  }
});

module.exports = router;