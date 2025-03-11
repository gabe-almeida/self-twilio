# Campaign Management Implementation Plan

## Overview

The current system needs a campaign management feature that allows administrators to create and manage lists of leads based on specific criteria such as age of creation or disposition status. This feature will enable more targeted outreach and follow-up strategies by organizing leads into logical groups that can be referenced in workflows.

## Goals

1. Create a flexible campaign management system that allows admins to define lead groups based on various criteria
2. Implement access control for campaigns, allowing admins to restrict agent access
3. Integrate campaigns with the workflow engine to enable automated processing
4. Maintain DRY principles by leveraging existing components and creating reusable abstractions

## Current State

- [x] Lead management system exists
- [x] Disposition system is implemented
- [x] Workflow engine is operational
- [x] User roles (admin/agent) are defined
- [ ] Campaign management system is missing
- [ ] Campaign-based workflow triggers are missing
- [ ] Campaign access control is missing

## Data Model

### Campaign Entity

```javascript
{
  id: "string", // Unique identifier
  name: "string", // Display name
  description: "string", // Optional description
  criteria: [
    {
      field: "string", // e.g., "created_at", "disposition_id", "last_contact"
      operator: "string", // e.g., "equals", "greater_than", "in", "contains"
      value: "any", // The value to compare against
      logic: "string" // "and" or "or" (for combining with next criteria)
    }
  ],
  is_dynamic: boolean, // Whether to automatically update based on criteria
  created_at: "ISO date",
  updated_at: "ISO date",
  created_by: "user_id",
  lead_count: number, // Cached count of leads
  last_refreshed: "ISO date", // When the campaign was last refreshed
  access_control: {
    read: ["user_id"], // Users with read access (empty means all)
    write: ["user_id"] // Users with write access (empty means all)
  }
}
```

### Campaign Membership Entity

```javascript
{
  campaign_id: "string",
  lead_id: "string",
  added_at: "ISO date",
  added_by: "user_id", // User who added the lead (null if automatic)
  is_active: boolean // Whether the lead is active in the campaign
}
```

## Implementation Steps

### 1. Backend Implementation

#### 1.1 Create Campaign Store

- [ ] Add campaign data structure to memory-store.js
- [ ] Implement CRUD operations for campaigns
- [ ] Implement campaign membership management
- [ ] Create methods for evaluating lead criteria
- [ ] Implement campaign refresh functionality

#### 1.2 Create Campaign API Routes

- [ ] Create routes for campaign management (CRUD operations)
- [ ] Create routes for campaign membership management
- [ ] Implement access control middleware
- [ ] Create route for refreshing campaign data

#### 1.3 Integrate with Workflow Engine

- [ ] Add campaign-based triggers to workflow engine
- [ ] Implement campaign membership evaluation in workflow conditions
- [ ] Create actions for adding/removing leads from campaigns

### 2. Admin UI Implementation

#### 2.1 Campaign Management UI

- [ ] Create campaign list view in admin.html
- [ ] Implement campaign creation form with criteria builder
- [ ] Create campaign detail view with lead list
- [ ] Implement campaign edit functionality
- [ ] Add campaign deletion with confirmation

#### 2.2 Campaign Criteria Builder

- [ ] Create UI for building complex criteria
- [ ] Implement field selection based on lead properties
- [ ] Create operator selection based on field type
- [ ] Implement value input based on operator
- [ ] Add ability to combine criteria with AND/OR logic

#### 2.3 Campaign Access Control UI

- [ ] Create UI for managing campaign access
- [ ] Implement user selection for read/write access
- [ ] Add bulk permission management

### 3. Agent UI Implementation

#### 3.1 Campaign View

- [ ] Add campaigns tab to dashboard.html
- [ ] Create campaign list view with access control
- [ ] Implement lead list view for each campaign
- [ ] Add campaign statistics

#### 3.2 Campaign Integration in Dialer

- [ ] Add campaign filter to call queue
- [ ] Implement campaign-based dialing
- [ ] Create UI for manually adding leads to campaigns

### 4. Workflow Integration

#### 4.1 Campaign Triggers

- [ ] Implement trigger for lead added to campaign
- [ ] Create trigger for lead removed from campaign
- [ ] Add trigger for campaign refreshed

#### 4.2 Campaign Conditions

- [ ] Add condition for lead in campaign
- [ ] Implement condition for lead campaign count
- [ ] Create condition for campaign membership duration

#### 4.3 Campaign Actions

- [ ] Implement action to add lead to campaign
- [ ] Create action to remove lead from campaign
- [ ] Add action to refresh campaign

## API Requirements

### Campaign Management API

#### Create Campaign
```
POST /api/campaigns
```

**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "criteria": [
    {
      "field": "string",
      "operator": "string",
      "value": "any",
      "logic": "string"
    }
  ],
  "is_dynamic": true,
  "access_control": {
    "read": ["user_id"],
    "write": ["user_id"]
  }
}
```

**Response:**
```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "criteria": [...],
  "is_dynamic": true,
  "created_at": "ISO date",
  "updated_at": "ISO date",
  "created_by": "user_id",
  "lead_count": 0,
  "last_refreshed": "ISO date",
  "access_control": {
    "read": ["user_id"],
    "write": ["user_id"]
  }
}
```

#### Get Campaigns
```
GET /api/campaigns
```

**Response:**
```json
{
  "campaigns": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "lead_count": 0,
      "last_refreshed": "ISO date",
      "created_at": "ISO date",
      "created_by": "user_id",
      "is_dynamic": true,
      "access": "read" | "write" | "none"
    }
  ]
}
```

#### Get Campaign Detail
```
GET /api/campaigns/:id
```

**Response:**
```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "criteria": [...],
  "is_dynamic": true,
  "created_at": "ISO date",
  "updated_at": "ISO date",
  "created_by": "user_id",
  "lead_count": 0,
  "last_refreshed": "ISO date",
  "access_control": {
    "read": ["user_id"],
    "write": ["user_id"]
  }
}
```

#### Update Campaign
```
PUT /api/campaigns/:id
```

**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "criteria": [...],
  "is_dynamic": true,
  "access_control": {
    "read": ["user_id"],
    "write": ["user_id"]
  }
}
```

#### Delete Campaign
```
DELETE /api/campaigns/:id
```

#### Refresh Campaign
```
POST /api/campaigns/:id/refresh
```

#### Get Campaign Leads
```
GET /api/campaigns/:id/leads
```

**Response:**
```json
{
  "leads": [
    {
      "id": "string",
      "phone_number": "string",
      "contact_name": "string",
      "added_at": "ISO date",
      "added_by": "user_id",
      "is_active": true
    }
  ]
}
```

#### Add Lead to Campaign
```
POST /api/campaigns/:id/leads
```

**Request Body:**
```json
{
  "lead_id": "string"
}
```

#### Remove Lead from Campaign
```
DELETE /api/campaigns/:id/leads/:leadId
```

## UI Components

### Campaign Criteria Builder

```html
<div class="criteria-builder">
  <div class="criteria-group">
    <div class="criteria-row">
      <div class="form-group">
        <label>Field</label>
        <select class="form-select field-select">
          <option value="created_at">Created Date</option>
          <option value="disposition_id">Disposition</option>
          <option value="last_contact">Last Contact Date</option>
          <!-- More fields -->
        </select>
      </div>
      
      <div class="form-group">
        <label>Operator</label>
        <select class="form-select operator-select">
          <option value="equals">Equals</option>
          <option value="not_equals">Not Equals</option>
          <option value="greater_than">Greater Than</option>
          <option value="less_than">Less Than</option>
          <option value="contains">Contains</option>
          <option value="in">In</option>
        </select>
      </div>
      
      <div class="form-group value-container">
        <!-- Dynamic input based on field and operator -->
      </div>
      
      <div class="form-group">
        <label>Logic</label>
        <select class="form-select logic-select">
          <option value="and">AND</option>
          <option value="or">OR</option>
        </select>
      </div>
      
      <button class="btn btn-sm btn-danger remove-criteria">
        <i class="bi bi-trash"></i>
      </button>
    </div>
    <!-- More criteria rows -->
  </div>
  
  <button class="btn btn-sm btn-primary add-criteria">
    <i class="bi bi-plus"></i> Add Criteria
  </button>
</div>
```

### Campaign List View

```html
<div class="card">
  <div class="card-header d-flex justify-content-between align-items-center">
    <h5 class="card-title mb-0">Campaigns</h5>
    <button class="btn btn-primary" id="create-campaign-btn">
      <i class="bi bi-plus"></i> Create Campaign
    </button>
  </div>
  <div class="card-body">
    <div class="table-responsive">
      <table class="table table-striped">
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Leads</th>
            <th>Dynamic</th>
            <th>Last Refreshed</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="campaign-table-body">
          <!-- Campaigns will be added here dynamically -->
        </tbody>
      </table>
    </div>
  </div>
</div>
```

### Campaign Detail View

```html
<div class="card">
  <div class="card-header">
    <h5 class="card-title" id="campaign-name">Campaign Name</h5>
    <p class="card-text" id="campaign-description">Campaign description</p>
  </div>
  <div class="card-body">
    <ul class="nav nav-tabs" id="campaignTabs" role="tablist">
      <li class="nav-item" role="presentation">
        <button class="nav-link active" id="leads-tab" data-bs-toggle="tab" data-bs-target="#leads" type="button" role="tab">
          Leads
        </button>
      </li>
      <li class="nav-item" role="presentation">
        <button class="nav-link" id="criteria-tab" data-bs-toggle="tab" data-bs-target="#criteria" type="button" role="tab">
          Criteria
        </button>
      </li>
      <li class="nav-item" role="presentation">
        <button class="nav-link" id="access-tab" data-bs-toggle="tab" data-bs-target="#access" type="button" role="tab">
          Access Control
        </button>
      </li>
    </ul>
    
    <div class="tab-content p-3" id="campaignTabsContent">
      <div class="tab-pane fade show active" id="leads" role="tabpanel">
        <!-- Leads table -->
      </div>
      <div class="tab-pane fade" id="criteria" role="tabpanel">
        <!-- Criteria builder -->
      </div>
      <div class="tab-pane fade" id="access" role="tabpanel">
        <!-- Access control UI -->
      </div>
    </div>
  </div>
  <div class="card-footer">
    <button class="btn btn-primary" id="refresh-campaign-btn">
      <i class="bi bi-arrow-repeat"></i> Refresh Campaign
    </button>
    <button class="btn btn-danger" id="delete-campaign-btn">
      <i class="bi bi-trash"></i> Delete Campaign
    </button>
  </div>
</div>
```

## JavaScript Implementation

### Campaign Criteria Evaluation

```javascript
// Evaluate if a lead matches campaign criteria
function evaluateCriteria(lead, criteria) {
  // Handle empty criteria (match all)
  if (!criteria || criteria.length === 0) {
    return true;
  }
  
  let result = true;
  let previousLogic = 'and';
  
  for (const criterion of criteria) {
    const { field, operator, value, logic } = criterion;
    
    // Get the field value from the lead
    const fieldValue = getFieldValue(lead, field);
    
    // Evaluate the condition
    const conditionResult = evaluateCondition(fieldValue, operator, value);
    
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
}

// Get a field value from a lead object
function getFieldValue(lead, field) {
  const parts = field.split('.');
  let value = lead;
  
  for (const part of parts) {
    if (value === undefined || value === null) {
      return undefined;
    }
    value = value[part];
  }
  
  return value;
}

// Evaluate a condition
function evaluateCondition(fieldValue, operator, compareValue) {
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
```

### Campaign Refresh Logic

```javascript
// Refresh a campaign based on its criteria
async function refreshCampaign(campaignId) {
  // Get the campaign
  const campaign = await store.campaigns.getById(campaignId);
  
  if (!campaign) {
    throw new Error('Campaign not found');
  }
  
  // Skip if not dynamic
  if (!campaign.is_dynamic) {
    return { changes: 0 };
  }
  
  // Get all leads
  const leads = await store.leads.getAll();
  
  // Get current campaign members
  const currentMembers = await store.campaignMembers.getByCampaignId(campaignId);
  const currentMemberIds = new Set(currentMembers.map(m => m.lead_id));
  
  // Evaluate each lead against criteria
  const matchingLeads = leads.filter(lead => evaluateCriteria(lead, campaign.criteria));
  const matchingLeadIds = new Set(matchingLeads.map(lead => lead.id));
  
  // Find leads to add and remove
  const leadsToAdd = matchingLeads.filter(lead => !currentMemberIds.has(lead.id));
  const leadsToRemove = currentMembers.filter(member => !matchingLeadIds.has(member.lead_id));
  
  // Add new matching leads
  for (const lead of leadsToAdd) {
    await store.campaignMembers.add({
      campaign_id: campaignId,
      lead_id: lead.id,
      added_at: new Date().toISOString(),
      added_by: null, // Automatic addition
      is_active: true
    });
  }
  
  // Remove non-matching leads
  for (const member of leadsToRemove) {
    await store.campaignMembers.remove(campaignId, member.lead_id);
  }
  
  // Update campaign
  await store.campaigns.update(campaignId, {
    lead_count: matchingLeadIds.size,
    last_refreshed: new Date().toISOString()
  });
  
  return {
    added: leadsToAdd.length,
    removed: leadsToRemove.length,
    total: matchingLeadIds.size
  };
}
```

## Workflow Integration

### Campaign Trigger

```javascript
// Add to workflow-manager.js
async processCampaignMembershipChange(data) {
  const { campaign_id, lead_id, action } = data;
  
  // Find active workflows with campaign membership trigger
  const workflows = await store.workflows.getActive();
  const matchingWorkflows = workflows.filter(workflow =>
    workflow.triggers.some(trigger =>
      trigger.type === 'campaign_membership' &&
      (!trigger.campaign_id || trigger.campaign_id === campaign_id) &&
      (!trigger.action || trigger.action === action)
    )
  );
  
  if (matchingWorkflows.length === 0) {
    return null;
  }
  
  // Get the lead and campaign
  const lead = await store.leads.getById(lead_id);
  const campaign = await store.campaigns.getById(campaign_id);
  
  // Start each matching workflow
  for (const workflow of matchingWorkflows) {
    await this.startWorkflow(workflow, {
      lead,
      campaign,
      action
    });
  }
  
  return true;
}
```

### Campaign Condition Step

```javascript
// Add to workflow-manager.js executeConditionStep method
// Special handling for campaign membership conditions
if (field === 'lead.campaigns' || field === 'lead.in_campaign') {
  // Get the lead ID from context
  const leadId = this.getFieldFromContext(context, 'lead.id');
  
  if (!leadId) {
    return false;
  }
  
  // If checking for membership in a specific campaign
  if (operator === 'contains' || operator === 'in') {
    // Get campaign membership
    const campaignMembers = await store.campaignMembers.getByLeadId(leadId);
    const campaignIds = campaignMembers.map(m => m.campaign_id);
    
    // Check if lead is in the specified campaign
    const result = campaignIds.includes(value);
    
    console.log(`Condition ${field} ${operator} ${value} evaluated to ${result}`);
    
    // Follow the appropriate branch
    const branchKey = result ? 'true_branch' : 'false_branch';
    return this.executeNextStep(workflow, step, context, branchKey);
  }
}
```

### Campaign Action Step

```javascript
// Add to workflow-manager.js
// Execute a campaign action step
async executeCampaignAction(workflow, step, context) {
  const { action, campaign_id } = step.properties || {};
  
  if (!action || !campaign_id) {
    console.error('Campaign action step requires action and campaign_id');
    return false;
  }
  
  // Get the lead ID from context
  const leadId = this.getFieldFromContext(context, 'lead.id');
  
  if (!leadId) {
    console.error('Campaign action step requires a lead in context');
    return false;
  }
  
  // Execute the action
  switch (action) {
    case 'add':
      await store.campaignMembers.add({
        campaign_id,
        lead_id: leadId,
        added_at: new Date().toISOString(),
        added_by: null, // Added by workflow
        is_active: true
      });
      break;
    case 'remove':
      await store.campaignMembers.remove(campaign_id, leadId);
      break;
    case 'refresh':
      await refreshCampaign(campaign_id);
      break;
    default:
      console.error(`Unknown campaign action: ${action}`);
      return false;
  }
  
  // Move to next step
  return this.executeNextStep(workflow, step, context);
}
```

## Access Control Implementation

### Access Control Middleware

```javascript
// Check campaign access
function checkCampaignAccess(accessType = 'read') {
  return async (req, res, next) => {
    try {
      const campaignId = req.params.id;
      
      // Skip for admins
      if (req.user.role === 'admin') {
        return next();
      }
      
      // Get the campaign
      const campaign = await store.campaigns.getById(campaignId);
      
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
```

## DRY Principles Implementation

1. **Reuse Existing Components**:
   - Leverage the existing workflow engine for campaign-based automation
   - Use the same criteria evaluation logic for both campaigns and workflow conditions
   - Share access control mechanisms with other parts of the system

2. **Create Reusable Abstractions**:
   - Implement a generic criteria builder component that can be used in multiple places
   - Create a reusable access control system that can be applied to other entities
   - Build a flexible field evaluation system that works across different data types

3. **Centralize Business Logic**:
   - Keep all campaign evaluation logic in a single place
   - Implement campaign refresh logic as a service that can be called from multiple places
   - Create a single source of truth for campaign membership

4. **Avoid Duplication in UI**:
   - Create reusable UI components for campaign management
   - Share form components between admin and agent interfaces
   - Use the same data visualization components for different views

## Testing Plan

### Unit Tests

1. **Campaign Criteria Evaluation**:
   - Test evaluation of different criteria types
   - Test complex criteria with AND/OR logic
   - Test edge cases and invalid criteria

2. **Campaign Membership Management**:
   - Test adding leads to campaigns
   - Test removing leads from campaigns
   - Test campaign refresh functionality

3. **Access Control**:
   - Test access control enforcement
   - Test different user roles and permissions
   - Test edge cases in access control

### Integration Tests

1. **Campaign and Workflow Integration**:
   - Test campaign-based workflow triggers
   - Test campaign conditions in workflows
   - Test campaign actions in workflows

2. **API Integration**:
   - Test campaign API endpoints
   - Test campaign membership API endpoints
   - Test campaign refresh API

### UI Tests

1. **Admin UI**:
   - Test campaign creation and editing
   - Test criteria builder functionality
   - Test access control management

2. **Agent UI**:
   - Test campaign viewing with access control
   - Test lead list viewing
   - Test manual lead addition to campaigns

## Timeline

- **Phase 1 (Backend Implementation)**: 1-2 weeks
- **Phase 2 (Admin UI Implementation)**: 1-2 weeks
- **Phase 3 (Agent UI Implementation)**: 1 week
- **Phase 4 (Workflow Integration)**: 1 week
- **Testing and Refinement**: 1 week

Total estimated time: 5-7 weeks

## Success Criteria

1. Admins can create and manage campaigns based on various criteria
2. Campaigns automatically update based on criteria when set as dynamic
3. Admins can control which agents have access to which campaigns
4. Agents can view campaigns they have access to
5. Workflows can be triggered by campaign membership changes
6. Workflows can check campaign membership in conditions
7. Workflows can add/remove leads from campaigns
8. The system follows DRY principles with minimal code duplication
9. All components are properly tested and documented

## Future Enhancements

1. **Campaign Analytics**:
   - Add detailed statistics for campaigns
   - Create conversion tracking for campaign leads
   - Implement campaign performance comparison

2. **Advanced Scheduling**:
   - Add time-based campaign activation/deactivation
   - Implement recurring campaign refreshes
   - Create campaign priority scheduling

3. **Campaign Templates**:
   - Allow saving campaigns as templates
   - Create predefined campaign templates for common scenarios
   - Implement template sharing between admins

4. **Campaign Sharing**:
   - Allow sharing campaigns between organizations
   - Implement campaign export/import functionality
   - Create campaign collaboration features