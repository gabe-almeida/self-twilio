// Migration script to migrate data from in-memory storage to the database
/**
 * This script migrates data from the in-memory storage to a SQL database.
 * It reads the data from the memory-store.js file and inserts it into the database.
 * 
 * Usage:
 * node scripts/migrate-to-db.js
 */

require('dotenv').config();
const featureFlags = require('../services/feature-flags');
const storageService = require('../services/storage-service');
const memoryStore = require('../memory-store');

// Enable persistent storage for migration
async function enablePersistentStorage() {
  await featureFlags.updateFeatureFlag('persistentStorage.enabled', true);
  console.log('Persistent storage enabled for migration');
}

// Migrate users
async function migrateUsers() {
  console.log('\n=== Migrating Users ===');
  
  try {
    // Get all users from memory store
    const users = await memoryStore.users.getAll();
    console.log(`Found ${users.length} users in memory store`);
    
    // Insert users into database
    let successCount = 0;
    
    for (const user of users) {
      const result = await storageService.insert('users', user);
      
      if (result.changes > 0) {
        successCount++;
      }
    }
    
    console.log(`Successfully migrated ${successCount} of ${users.length} users`);
    return true;
  } catch (error) {
    console.error('Error migrating users:', error);
    return false;
  }
}

// Migrate agent statuses
async function migrateAgentStatuses() {
  console.log('\n=== Migrating Agent Statuses ===');
  
  try {
    // Get all agent statuses from memory store
    const statuses = await memoryStore.agentStatus.getAllWithUserInfo();
    console.log(`Found ${statuses.length} agent statuses in memory store`);
    
    // Insert agent statuses into database
    let successCount = 0;
    
    for (const status of statuses) {
      // Remove username and full_name fields
      const { username, full_name, ...statusData } = status;
      
      const result = await storageService.insert('agent_status', statusData);
      
      if (result.changes > 0) {
        successCount++;
      }
    }
    
    console.log(`Successfully migrated ${successCount} of ${statuses.length} agent statuses`);
    return true;
  } catch (error) {
    console.error('Error migrating agent statuses:', error);
    return false;
  }
}

// Migrate call queue
async function migrateCallQueue() {
  console.log('\n=== Migrating Call Queue ===');
  
  try {
    // Get all calls from memory store
    const calls = await memoryStore.callQueue.getAll();
    console.log(`Found ${calls.length} calls in memory store`);
    
    // Insert calls into database
    let successCount = 0;
    
    for (const call of calls) {
      // Remove username and agent_name fields
      const { username, agent_name, ...callData } = call;
      
      const result = await storageService.insert('call_queue', callData);
      
      if (result.changes > 0) {
        successCount++;
      }
    }
    
    console.log(`Successfully migrated ${successCount} of ${calls.length} calls`);
    return true;
  } catch (error) {
    console.error('Error migrating call queue:', error);
    return false;
  }
}

// Migrate call history
async function migrateCallHistory() {
  console.log('\n=== Migrating Call History ===');
  
  try {
    // Get all call history from memory store
    const history = await memoryStore.callHistory.getAll();
    console.log(`Found ${history.length} call history records in memory store`);
    
    // Insert call history into database
    let successCount = 0;
    
    for (const record of history) {
      // Remove username and agent_name fields
      const { username, agent_name, ...historyData } = record;
      
      const result = await storageService.insert('call_history', historyData);
      
      if (result.changes > 0) {
        successCount++;
      }
    }
    
    console.log(`Successfully migrated ${successCount} of ${history.length} call history records`);
    return true;
  } catch (error) {
    console.error('Error migrating call history:', error);
    return false;
  }
}

// Migrate dispositions
async function migrateDispositions() {
  console.log('\n=== Migrating Dispositions ===');
  
  try {
    // Get all dispositions from memory store
    const dispositions = await memoryStore.dispositions.getAll();
    console.log(`Found ${dispositions.length} dispositions in memory store`);
    
    // Insert dispositions into database
    let successCount = 0;
    
    for (const disposition of dispositions) {
      const result = await storageService.insert('dispositions', disposition);
      
      if (result.changes > 0) {
        successCount++;
      }
    }
    
    console.log(`Successfully migrated ${successCount} of ${dispositions.length} dispositions`);
    return true;
  } catch (error) {
    console.error('Error migrating dispositions:', error);
    return false;
  }
}

// Migrate workflows
async function migrateWorkflows() {
  console.log('\n=== Migrating Workflows ===');
  
  try {
    // Get all workflows from memory store
    const workflows = await memoryStore.workflows.getAll();
    console.log(`Found ${workflows.length} workflows in memory store`);
    
    // Insert workflows into database
    let successCount = 0;
    
    for (const workflow of workflows) {
      const result = await storageService.insert('workflows', workflow);
      
      if (result.changes > 0) {
        successCount++;
      }
    }
    
    console.log(`Successfully migrated ${successCount} of ${workflows.length} workflows`);
    return true;
  } catch (error) {
    console.error('Error migrating workflows:', error);
    return false;
  }
}

// Migrate campaigns
async function migrateCampaigns() {
  console.log('\n=== Migrating Campaigns ===');
  
  try {
    // Get all campaigns from memory store
    const campaigns = await memoryStore.campaigns.getAll();
    console.log(`Found ${campaigns.length} campaigns in memory store`);
    
    // Insert campaigns into database
    let successCount = 0;
    
    for (const campaign of campaigns) {
      const result = await storageService.insert('campaigns', campaign);
      
      if (result.changes > 0) {
        successCount++;
      }
    }
    
    console.log(`Successfully migrated ${successCount} of ${campaigns.length} campaigns`);
    return true;
  } catch (error) {
    console.error('Error migrating campaigns:', error);
    return false;
  }
}

// Migrate campaign members
async function migrateCampaignMembers() {
  console.log('\n=== Migrating Campaign Members ===');
  
  try {
    // Get all campaigns from memory store
    const campaigns = await memoryStore.campaigns.getAll();
    
    if (campaigns.length === 0) {
      console.log('No campaigns found, skipping campaign members migration');
      return true;
    }
    
    // Get campaign members for each campaign
    let allMembers = [];
    
    for (const campaign of campaigns) {
      const members = await memoryStore.campaignMembers.getByCampaignId(campaign.id);
      allMembers = [...allMembers, ...members];
    }
    
    console.log(`Found ${allMembers.length} campaign members in memory store`);
    
    // Insert campaign members into database
    let successCount = 0;
    
    for (const member of allMembers) {
      const result = await storageService.insert('campaign_members', member);
      
      if (result.changes > 0) {
        successCount++;
      }
    }
    
    console.log(`Successfully migrated ${successCount} of ${allMembers.length} campaign members`);
    return true;
  } catch (error) {
    console.error('Error migrating campaign members:', error);
    return false;
  }
}

// Migrate contact centers
async function migrateContactCenters() {
  console.log('\n=== Migrating Contact Centers ===');
  
  try {
    // Get all contact centers from memory store
    const contactCenters = await memoryStore.contactCenters.getAll();
    console.log(`Found ${contactCenters.length} contact centers in memory store`);
    
    // Insert contact centers into database
    let successCount = 0;
    
    for (const contactCenter of contactCenters) {
      const result = await storageService.insert('contact_centers', contactCenter);
      
      if (result.changes > 0) {
        successCount++;
      }
    }
    
    console.log(`Successfully migrated ${successCount} of ${contactCenters.length} contact centers`);
    return true;
  } catch (error) {
    console.error('Error migrating contact centers:', error);
    return false;
  }
}

// Migrate contact center agents
async function migrateContactCenterAgents() {
  console.log('\n=== Migrating Contact Center Agents ===');
  
  try {
    // Get all contact centers from memory store
    const contactCenters = await memoryStore.contactCenters.getAll();
    
    if (contactCenters.length === 0) {
      console.log('No contact centers found, skipping contact center agents migration');
      return true;
    }
    
    // Get contact center agents for each contact center
    let allAgents = [];
    
    for (const contactCenter of contactCenters) {
      const agents = await memoryStore.contactCenterAgents.getByContactCenterId(contactCenter.id);
      allAgents = [...allAgents, ...agents];
    }
    
    console.log(`Found ${allAgents.length} contact center agents in memory store`);
    
    // Insert contact center agents into database
    let successCount = 0;
    
    for (const agent of allAgents) {
      const result = await storageService.insert('contact_center_agents', agent);
      
      if (result.changes > 0) {
        successCount++;
      }
    }
    
    console.log(`Successfully migrated ${successCount} of ${allAgents.length} contact center agents`);
    return true;
  } catch (error) {
    console.error('Error migrating contact center agents:', error);
    return false;
  }
}

// Migrate contact center phones
async function migrateContactCenterPhones() {
  console.log('\n=== Migrating Contact Center Phones ===');
  
  try {
    // Get all contact centers from memory store
    const contactCenters = await memoryStore.contactCenters.getAll();
    
    if (contactCenters.length === 0) {
      console.log('No contact centers found, skipping contact center phones migration');
      return true;
    }
    
    // Get contact center phones for each contact center
    let allPhones = [];
    
    for (const contactCenter of contactCenters) {
      const phones = await memoryStore.contactCenterPhones.getByContactCenterId(contactCenter.id);
      allPhones = [...allPhones, ...phones];
    }
    
    console.log(`Found ${allPhones.length} contact center phones in memory store`);
    
    // Insert contact center phones into database
    let successCount = 0;
    
    for (const phone of allPhones) {
      const result = await storageService.insert('contact_center_phones', phone);
      
      if (result.changes > 0) {
        successCount++;
      }
    }
    
    console.log(`Successfully migrated ${successCount} of ${allPhones.length} contact center phones`);
    return true;
  } catch (error) {
    console.error('Error migrating contact center phones:', error);
    return false;
  }
}

// Run the migration
async function runMigration() {
  console.log('Starting migration from in-memory storage to database');
  
  try {
    // Enable persistent storage
    await enablePersistentStorage();
    
    // Initialize storage service
    const initialized = await storageService.initialize();
    
    if (!initialized) {
      console.error('Failed to initialize storage service');
      process.exit(1);
    }
    
    // Migrate data
    const usersMigrated = await migrateUsers();
    const agentStatusesMigrated = await migrateAgentStatuses();
    const callQueueMigrated = await migrateCallQueue();
    const callHistoryMigrated = await migrateCallHistory();
    const dispositionsMigrated = await migrateDispositions();
    const workflowsMigrated = await migrateWorkflows();
    const campaignsMigrated = await migrateCampaigns();
    const campaignMembersMigrated = await migrateCampaignMembers();
    const contactCentersMigrated = await migrateContactCenters();
    const contactCenterAgentsMigrated = await migrateContactCenterAgents();
    const contactCenterPhonesMigrated = await migrateContactCenterPhones();
    
    // Print summary
    console.log('\n=== Migration Summary ===');
    console.log(`Users: ${usersMigrated ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Agent Statuses: ${agentStatusesMigrated ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Call Queue: ${callQueueMigrated ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Call History: ${callHistoryMigrated ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Dispositions: ${dispositionsMigrated ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Workflows: ${workflowsMigrated ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Campaigns: ${campaignsMigrated ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Campaign Members: ${campaignMembersMigrated ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Contact Centers: ${contactCentersMigrated ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Contact Center Agents: ${contactCenterAgentsMigrated ? 'SUCCESS' : 'FAILED'}`);
    console.log(`Contact Center Phones: ${contactCenterPhonesMigrated ? 'SUCCESS' : 'FAILED'}`);
    
    // Close storage service
    await storageService.close();
    
    console.log('\nMigration completed');
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration();