// Storage Service for Twilio Dialer Web App
/**
 * This service provides a storage abstraction layer that works with both in-memory and persistent storage.
 * It defines interfaces for data access and ensures all data access goes through this abstraction layer.
 *
 * The storage service supports multiple storage adapters:
 * 1. MemoryAdapter - In-memory storage (default)
 * 2. SqlAdapter - SQL database storage (PostgreSQL recommended)
 *
 * The storage service is designed to be easily extensible with additional adapters.
 */

const featureFlags = require('./feature-flags');
const errorService = require('./error-service');
const SqlAdapter = require('./sql-adapter');

// Base Storage Adapter Interface
class StorageAdapter {
  /**
   * Initialize the storage adapter
   * @returns {Promise<boolean>} Whether initialization was successful
   */
  async initialize() {
    throw new Error('Method not implemented: initialize');
  }

  /**
   * Close the storage adapter
   * @returns {Promise<boolean>} Whether closing was successful
   */
  async close() {
    throw new Error('Method not implemented: close');
  }

  /**
   * Run a query that doesn't return data
   * @param {string} sql - The SQL query to run
   * @param {Array} params - The parameters for the query
   * @returns {Promise<Object>} The result of the query
   */
  async run(sql, params = []) {
    throw new Error('Method not implemented: run');
  }

  /**
   * Get a single row from a query
   * @param {string} sql - The SQL query to run
   * @param {Array} params - The parameters for the query
   * @returns {Promise<Object>} The result of the query
   */
  async get(sql, params = []) {
    throw new Error('Method not implemented: get');
  }

  /**
   * Get all rows from a query
   * @param {string} sql - The SQL query to run
   * @param {Array} params - The parameters for the query
   * @returns {Promise<Array>} The result of the query
   */
  async all(sql, params = []) {
    throw new Error('Method not implemented: all');
  }

  /**
   * Create a table if it doesn't exist
   * @param {string} tableName - The name of the table
   * @param {string} schema - The schema of the table
   * @returns {Promise<boolean>} Whether the table was created
   */
  async createTable(tableName, schema) {
    throw new Error('Method not implemented: createTable');
  }

  /**
   * Insert a row into a table
   * @param {string} tableName - The name of the table
   * @param {Object} data - The data to insert
   * @returns {Promise<Object>} The result of the insertion
   */
  async insert(tableName, data) {
    throw new Error('Method not implemented: insert');
  }

  /**
   * Update a row in a table
   * @param {string} tableName - The name of the table
   * @param {string|number} id - The ID of the row to update
   * @param {Object} data - The data to update
   * @returns {Promise<Object>} The result of the update
   */
  async update(tableName, id, data) {
    throw new Error('Method not implemented: update');
  }

  /**
   * Delete a row from a table
   * @param {string} tableName - The name of the table
   * @param {string|number} id - The ID of the row to delete
   * @returns {Promise<Object>} The result of the deletion
   */
  async delete(tableName, id) {
    throw new Error('Method not implemented: delete');
  }

  /**
   * Get a row from a table by ID
   * @param {string} tableName - The name of the table
   * @param {string|number} id - The ID of the row to get
   * @returns {Promise<Object>} The row
   */
  async getById(tableName, id) {
    throw new Error('Method not implemented: getById');
  }

  /**
   * Get all rows from a table
   * @param {string} tableName - The name of the table
   * @param {Object} options - Options for the query (limit, offset, where, orderBy)
   * @returns {Promise<Array>} The rows
   */
  async getAll(tableName, options = {}) {
    throw new Error('Method not implemented: getAll');
  }

  /**
   * Count rows in a table
   * @param {string} tableName - The name of the table
   * @param {Object} where - Where clause for the query
   * @returns {Promise<number>} The count
   */
  async count(tableName, where = {}) {
    throw new Error('Method not implemented: count');
  }

  /**
   * Begin a transaction
   * @returns {Promise<Object>} The transaction object
   */
  async beginTransaction() {
    throw new Error('Method not implemented: beginTransaction');
  }

  /**
   * Commit a transaction
   * @param {Object} transaction - The transaction object
   * @returns {Promise<boolean>} Whether the commit was successful
   */
  async commitTransaction(transaction) {
    throw new Error('Method not implemented: commitTransaction');
  }

  /**
   * Rollback a transaction
   * @param {Object} transaction - The transaction object
   * @returns {Promise<boolean>} Whether the rollback was successful
   */
  async rollbackTransaction(transaction) {
    throw new Error('Method not implemented: rollbackTransaction');
  }
}

// Memory Storage Adapter
class MemoryAdapter extends StorageAdapter {
  constructor() {
    super();
    this.tables = {};
    this.nextIds = {};
    this.isInitialized = false;
  }

  /**
   * Initialize the memory adapter
   * @returns {Promise<boolean>} Whether initialization was successful
   */
  async initialize() {
    try {
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing memory adapter:', error);
      return false;
    }
  }

  /**
   * Close the memory adapter
   * @returns {Promise<boolean>} Whether closing was successful
   */
  async close() {
    try {
      this.isInitialized = false;
      return true;
    } catch (error) {
      console.error('Error closing memory adapter:', error);
      return false;
    }
  }

  /**
   * Run a query that doesn't return data
   * @param {string} sql - The SQL query to run
   * @param {Array} params - The parameters for the query
   * @returns {Promise<Object>} The result of the query
   */
  async run(sql, params = []) {
    console.log('Memory adapter run:', sql, params);
    return { id: 0, changes: 0 };
  }

  /**
   * Get a single row from a query
   * @param {string} sql - The SQL query to run
   * @param {Array} params - The parameters for the query
   * @returns {Promise<Object>} The result of the query
   */
  async get(sql, params = []) {
    console.log('Memory adapter get:', sql, params);
    return null;
  }

  /**
   * Get all rows from a query
   * @param {string} sql - The SQL query to run
   * @param {Array} params - The parameters for the query
   * @returns {Promise<Array>} The result of the query
   */
  async all(sql, params = []) {
    console.log('Memory adapter all:', sql, params);
    return [];
  }

  /**
   * Create a table if it doesn't exist
   * @param {string} tableName - The name of the table
   * @param {string} schema - The schema of the table
   * @returns {Promise<boolean>} Whether the table was created
   */
  async createTable(tableName, schema) {
    if (!this.tables[tableName]) {
      this.tables[tableName] = [];
      this.nextIds[tableName] = 1;
      return true;
    }
    return false;
  }

  /**
   * Insert a row into a table
   * @param {string} tableName - The name of the table
   * @param {Object} data - The data to insert
   * @returns {Promise<Object>} The result of the insertion
   */
  async insert(tableName, data) {
    if (!this.tables[tableName]) {
      await this.createTable(tableName);
    }

    const id = data.id || this.nextIds[tableName]++;
    const now = new Date().toISOString();
    
    const row = {
      ...data,
      id,
      created_at: data.created_at || now,
      updated_at: data.updated_at || now
    };

    this.tables[tableName].push(row);
    
    return { id, changes: 1 };
  }

  /**
   * Update a row in a table
   * @param {string} tableName - The name of the table
   * @param {string|number} id - The ID of the row to update
   * @param {Object} data - The data to update
   * @returns {Promise<Object>} The result of the update
   */
  async update(tableName, id, data) {
    if (!this.tables[tableName]) {
      return { changes: 0 };
    }

    const index = this.tables[tableName].findIndex(row => row.id === id);
    
    if (index === -1) {
      return { changes: 0 };
    }

    const now = new Date().toISOString();
    
    this.tables[tableName][index] = {
      ...this.tables[tableName][index],
      ...data,
      updated_at: now
    };
    
    return { changes: 1 };
  }

  /**
   * Delete a row from a table
   * @param {string} tableName - The name of the table
   * @param {string|number} id - The ID of the row to delete
   * @returns {Promise<Object>} The result of the deletion
   */
  async delete(tableName, id) {
    if (!this.tables[tableName]) {
      return { changes: 0 };
    }

    const initialLength = this.tables[tableName].length;
    this.tables[tableName] = this.tables[tableName].filter(row => row.id !== id);
    
    return { changes: initialLength - this.tables[tableName].length };
  }

  /**
   * Get a row from a table by ID
   * @param {string} tableName - The name of the table
   * @param {string|number} id - The ID of the row to get
   * @returns {Promise<Object>} The row
   */
  async getById(tableName, id) {
    if (!this.tables[tableName]) {
      return null;
    }

    return this.tables[tableName].find(row => row.id === id) || null;
  }

  /**
   * Get all rows from a table
   * @param {string} tableName - The name of the table
   * @param {Object} options - Options for the query (limit, offset, where, orderBy)
   * @returns {Promise<Array>} The rows
   */
  async getAll(tableName, options = {}) {
    if (!this.tables[tableName]) {
      return [];
    }

    let result = [...this.tables[tableName]];
    
    // Apply where clause
    if (options.where) {
      result = result.filter(row => {
        for (const [key, value] of Object.entries(options.where)) {
          if (row[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }
    
    // Apply order by
    if (options.orderBy) {
      const [field, direction] = options.orderBy.split(' ');
      result.sort((a, b) => {
        if (direction === 'DESC') {
          return b[field] > a[field] ? 1 : -1;
        }
        return a[field] > b[field] ? 1 : -1;
      });
    }
    
    // Apply limit and offset
    if (options.limit) {
      const offset = options.offset || 0;
      result = result.slice(offset, offset + options.limit);
    }
    
    return result;
  }

  /**
   * Count rows in a table
   * @param {string} tableName - The name of the table
   * @param {Object} where - Where clause for the query
   * @returns {Promise<number>} The count
   */
  async count(tableName, where = {}) {
    if (!this.tables[tableName]) {
      return 0;
    }

    if (Object.keys(where).length === 0) {
      return this.tables[tableName].length;
    }

    return (await this.getAll(tableName, { where })).length;
  }

  /**
   * Begin a transaction
   * @returns {Promise<Object>} The transaction object
   */
  async beginTransaction() {
    // Memory adapter doesn't support transactions, but we'll simulate it
    return { id: Date.now(), snapshot: JSON.parse(JSON.stringify(this.tables)) };
  }

  /**
   * Commit a transaction
   * @param {Object} transaction - The transaction object
   * @returns {Promise<boolean>} Whether the commit was successful
   */
  async commitTransaction(transaction) {
    // Memory adapter doesn't support transactions, but we'll simulate it
    return true;
  }

  /**
   * Rollback a transaction
   * @param {Object} transaction - The transaction object
   * @returns {Promise<boolean>} Whether the rollback was successful
   */
  async rollbackTransaction(transaction) {
    // Memory adapter doesn't support transactions, but we'll simulate it
    if (transaction && transaction.snapshot) {
      this.tables = transaction.snapshot;
      return true;
    }
    return false;
  }
}


// Storage Service
class StorageService {
  constructor() {
    this.adapter = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the storage service
   * @returns {Promise<boolean>} Whether initialization was successful
   */
  async initialize() {
    try {
      // Check if persistent storage is enabled
      const persistentStorageEnabled = await featureFlags.isFeatureEnabled('persistentStorage.enabled');
      
      if (persistentStorageEnabled) {
        console.log('Persistent storage is enabled, initializing SQL adapter');
        
        // Get the SQL adapter configuration
        const dbType = await featureFlags.getFeatureValue('persistentStorage.dbType', 'postgres');
        const dbHost = await featureFlags.getFeatureValue('persistentStorage.dbHost', 'localhost');
        const dbPort = await featureFlags.getFeatureValue('persistentStorage.dbPort', 5432);
        const dbName = await featureFlags.getFeatureValue('persistentStorage.dbName', 'twilio_dialer');
        const dbUser = await featureFlags.getFeatureValue('persistentStorage.dbUser', 'postgres');
        const dbPassword = await featureFlags.getFeatureValue('persistentStorage.dbPassword', '');
        const connectionPoolSize = await featureFlags.getFeatureValue('persistentStorage.connectionPoolSize', 10);
        
        // Create the SQL adapter
        this.adapter = new SqlAdapter({
          type: dbType,
          host: dbHost,
          port: dbPort,
          database: dbName,
          user: dbUser,
          password: dbPassword,
          connectionPoolSize
        });
      } else {
        console.log('Using in-memory storage');
        
        // Create the memory adapter
        this.adapter = new MemoryAdapter();
      }
      
      // Initialize the adapter
      const initialized = await this.adapter.initialize();
      
      if (initialized) {
        this.isInitialized = true;
        console.log('Storage service initialized successfully');
        
        // If using SQL adapter, create tables if they don't exist
        if (persistentStorageEnabled) {
          await this.createTablesIfNotExist();
        }
        
        return true;
      } else {
        console.error('Failed to initialize storage adapter');
        return false;
      }
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'storage-service.initialize');
      console.error('Error initializing storage service:', errorInfo);
      return false;
    }
  }
  
  /**
   * Create tables if they don't exist
   * @returns {Promise<boolean>} Whether the tables were created
   */
  async createTablesIfNotExist() {
    try {
      // Define table schemas
      const tableSchemas = {
        users: `
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          full_name VARCHAR(100) NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          role VARCHAR(20) NOT NULL DEFAULT 'agent',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        `,
        agent_status: `
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          status VARCHAR(20) NOT NULL DEFAULT 'Offline',
          last_status_change TIMESTAMP NOT NULL DEFAULT NOW(),
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        `,
        call_queue: `
          id SERIAL PRIMARY KEY,
          phone_number VARCHAR(20) NOT NULL,
          contact_name VARCHAR(100),
          notes TEXT,
          priority INTEGER NOT NULL DEFAULT 1,
          status VARCHAR(20) NOT NULL DEFAULT 'Queued',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          scheduled_for TIMESTAMP,
          assigned_to INTEGER REFERENCES users(id),
          completed_at TIMESTAMP,
          call_sid VARCHAR(50),
          call_duration INTEGER,
          call_status VARCHAR(20),
          retry_count INTEGER DEFAULT 0,
          last_retry TIMESTAMP,
          retry_after TIMESTAMP,
          failure_reason TEXT,
          failure_type VARCHAR(50),
          failure_category VARCHAR(50),
          failure_description TEXT,
          error_id VARCHAR(50),
          disposition_id VARCHAR(50),
          disposition_name VARCHAR(100),
          workflow_id VARCHAR(50),
          workflow_step_id VARCHAR(50),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        `,
        call_history: `
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          phone_number VARCHAR(20) NOT NULL,
          contact_name VARCHAR(100),
          direction VARCHAR(10) NOT NULL,
          start_time TIMESTAMP NOT NULL,
          end_time TIMESTAMP,
          duration INTEGER,
          call_sid VARCHAR(50),
          call_status VARCHAR(20),
          notes TEXT,
          recording_url TEXT,
          disposition_id VARCHAR(50),
          disposition_name VARCHAR(100),
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        `,
        dispositions: `
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          is_final BOOLEAN NOT NULL DEFAULT FALSE,
          active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        `,
        workflows: `
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          active BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          triggers JSONB,
          steps JSONB,
          business_hours JSONB
        `,
        campaigns: `
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          criteria JSONB,
          is_dynamic BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          created_by INTEGER REFERENCES users(id),
          lead_count INTEGER DEFAULT 0,
          last_refreshed TIMESTAMP,
          access_control JSONB
        `,
        campaign_members: `
          id SERIAL PRIMARY KEY,
          campaign_id VARCHAR(50) NOT NULL REFERENCES campaigns(id),
          lead_id INTEGER NOT NULL REFERENCES call_queue(id),
          added_at TIMESTAMP NOT NULL DEFAULT NOW(),
          added_by INTEGER REFERENCES users(id),
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        `,
        contact_centers: `
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          active BOOLEAN NOT NULL DEFAULT TRUE,
          settings JSONB
        `,
        contact_center_agents: `
          id VARCHAR(50) PRIMARY KEY,
          contact_center_id VARCHAR(50) NOT NULL REFERENCES contact_centers(id),
          user_id INTEGER NOT NULL REFERENCES users(id),
          role VARCHAR(20) NOT NULL DEFAULT 'agent',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          active BOOLEAN NOT NULL DEFAULT TRUE
        `,
        contact_center_phones: `
          id VARCHAR(50) PRIMARY KEY,
          contact_center_id VARCHAR(50) NOT NULL REFERENCES contact_centers(id),
          phone_number VARCHAR(20) NOT NULL,
          friendly_name VARCHAR(100),
          direction VARCHAR(10) NOT NULL DEFAULT 'both',
          is_default BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          active BOOLEAN NOT NULL DEFAULT TRUE
        `
      };
      
      // Create tables
      for (const [tableName, schema] of Object.entries(tableSchemas)) {
        const tableCreated = await this.adapter.createTable(tableName, schema);
        console.log(`Table ${tableName} ${tableCreated ? 'created' : 'already exists'}`);
      }
      
      // Create indexes
      await this.adapter.createIndex('agent_status', 'idx_agent_status_user_id', 'user_id');
      await this.adapter.createIndex('call_queue', 'idx_call_queue_status', 'status');
      await this.adapter.createIndex('call_queue', 'idx_call_queue_scheduled_for', 'scheduled_for');
      await this.adapter.createIndex('call_queue', 'idx_call_queue_assigned_to', 'assigned_to');
      await this.adapter.createIndex('call_history', 'idx_call_history_user_id', 'user_id');
      await this.adapter.createIndex('call_history', 'idx_call_history_call_sid', 'call_sid');
      await this.adapter.createIndex('campaign_members', 'idx_campaign_members_campaign_id', 'campaign_id');
      await this.adapter.createIndex('campaign_members', 'idx_campaign_members_lead_id', 'lead_id');
      await this.adapter.createIndex('contact_center_agents', 'idx_contact_center_agents_user_id', 'user_id');
      await this.adapter.createIndex('contact_center_phones', 'idx_contact_center_phones_phone_number', 'phone_number');
      
      return true;
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'storage-service.createTablesIfNotExist');
      console.error('Error creating tables:', errorInfo);
      return false;
    }
  }

  /**
   * Close the storage service
   * @returns {Promise<boolean>} Whether closing was successful
   */
  async close() {
    try {
      if (this.adapter) {
        const closed = await this.adapter.close();
        
        if (closed) {
          this.isInitialized = false;
          console.log('Storage service closed successfully');
          return true;
        } else {
          console.error('Failed to close storage adapter');
          return false;
        }
      }
      
      return true;
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'storage-service.close');
      console.error('Error closing storage service:', errorInfo);
      return false;
    }
  }

  /**
   * Run a query that doesn't return data
   * @param {string} sql - The SQL query to run
   * @param {Array} params - The parameters for the query
   * @returns {Promise<Object>} The result of the query
   */
  async run(sql, params = []) {
    try {
      if (!this.isInitialized) {
        throw new Error('Storage service not initialized');
      }
      
      return await this.adapter.run(sql, params);
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'storage-service.run');
      console.error('Error running query:', errorInfo);
      return { id: 0, changes: 0 };
    }
  }

  /**
   * Get a single row from a query
   * @param {string} sql - The SQL query to run
   * @param {Array} params - The parameters for the query
   * @returns {Promise<Object>} The result of the query
   */
  async get(sql, params = []) {
    try {
      if (!this.isInitialized) {
        throw new Error('Storage service not initialized');
      }
      
      return await this.adapter.get(sql, params);
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'storage-service.get');
      console.error('Error getting row:', errorInfo);
      return null;
    }
  }

  /**
   * Get all rows from a query
   * @param {string} sql - The SQL query to run
   * @param {Array} params - The parameters for the query
   * @returns {Promise<Array>} The result of the query
   */
  async all(sql, params = []) {
    try {
      if (!this.isInitialized) {
        throw new Error('Storage service not initialized');
      }
      
      return await this.adapter.all(sql, params);
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'storage-service.all');
      console.error('Error getting all rows:', errorInfo);
      return [];
    }
  }

  /**
   * Create a table if it doesn't exist
   * @param {string} tableName - The name of the table
   * @param {string} schema - The schema of the table
   * @returns {Promise<boolean>} Whether the table was created
   */
  async createTable(tableName, schema) {
    try {
      if (!this.isInitialized) {
        throw new Error('Storage service not initialized');
      }
      
      return await this.adapter.createTable(tableName, schema);
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'storage-service.createTable');
      console.error(`Error creating table ${tableName}:`, errorInfo);
      return false;
    }
  }

  /**
   * Insert a row into a table
   * @param {string} tableName - The name of the table
   * @param {Object} data - The data to insert
   * @returns {Promise<Object>} The result of the insertion
   */
  async insert(tableName, data) {
    try {
      if (!this.isInitialized) {
        throw new Error('Storage service not initialized');
      }
      
      return await this.adapter.insert(tableName, data);
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'storage-service.insert');
      console.error(`Error inserting into table ${tableName}:`, errorInfo);
      return { id: 0, changes: 0 };
    }
  }

  /**
   * Update a row in a table
   * @param {string} tableName - The name of the table
   * @param {string|number} id - The ID of the row to update
   * @param {Object} data - The data to update
   * @returns {Promise<Object>} The result of the update
   */
  async update(tableName, id, data) {
    try {
      if (!this.isInitialized) {
        throw new Error('Storage service not initialized');
      }
      
      return await this.adapter.update(tableName, id, data);
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'storage-service.update');
      console.error(`Error updating table ${tableName}:`, errorInfo);
      return { changes: 0 };
    }
  }

  /**
   * Delete a row from a table
   * @param {string} tableName - The name of the table
   * @param {string|number} id - The ID of the row to delete
   * @returns {Promise<Object>} The result of the deletion
   */
  async delete(tableName, id) {
    try {
      if (!this.isInitialized) {
        throw new Error('Storage service not initialized');
      }
      
      return await this.adapter.delete(tableName, id);
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'storage-service.delete');
      console.error(`Error deleting from table ${tableName}:`, errorInfo);
      return { changes: 0 };
    }
  }

  /**
   * Get a row from a table by ID
   * @param {string} tableName - The name of the table
   * @param {string|number} id - The ID of the row to get
   * @returns {Promise<Object>} The row
   */
  async getById(tableName, id) {
    try {
      if (!this.isInitialized) {
        throw new Error('Storage service not initialized');
      }
      
      return await this.adapter.getById(tableName, id);
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'storage-service.getById');
      console.error(`Error getting row from table ${tableName}:`, errorInfo);
      return null;
    }
  }

  /**
   * Get all rows from a table
   * @param {string} tableName - The name of the table
   * @param {Object} options - Options for the query (limit, offset, where, orderBy)
   * @returns {Promise<Array>} The rows
   */
  async getAll(tableName, options = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('Storage service not initialized');
      }
      
      return await this.adapter.getAll(tableName, options);
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'storage-service.getAll');
      console.error(`Error getting all rows from table ${tableName}:`, errorInfo);
      return [];
    }
  }

  /**
   * Count rows in a table
   * @param {string} tableName - The name of the table
   * @param {Object} where - Where clause for the query
   * @returns {Promise<number>} The count
   */
  async count(tableName, where = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('Storage service not initialized');
      }
      
      return await this.adapter.count(tableName, where);
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'storage-service.count');
      console.error(`Error counting rows in table ${tableName}:`, errorInfo);
      return 0;
    }
  }

  /**
   * Begin a transaction
   * @returns {Promise<Object>} The transaction object
   */
  async beginTransaction() {
    try {
      if (!this.isInitialized) {
        throw new Error('Storage service not initialized');
      }
      
      return await this.adapter.beginTransaction();
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'storage-service.beginTransaction');
      console.error('Error beginning transaction:', errorInfo);
      return null;
    }
  }

  /**
   * Commit a transaction
   * @param {Object} transaction - The transaction object
   * @returns {Promise<boolean>} Whether the commit was successful
   */
  async commitTransaction(transaction) {
    try {
      if (!this.isInitialized) {
        throw new Error('Storage service not initialized');
      }
      
      return await this.adapter.commitTransaction(transaction);
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'storage-service.commitTransaction');
      console.error('Error committing transaction:', errorInfo);
      return false;
    }
  }

  /**
   * Rollback a transaction
   * @param {Object} transaction - The transaction object
   * @returns {Promise<boolean>} Whether the rollback was successful
   */
  async rollbackTransaction(transaction) {
    try {
      if (!this.isInitialized) {
        throw new Error('Storage service not initialized');
      }
      
      return await this.adapter.rollbackTransaction(transaction);
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'storage-service.rollbackTransaction');
      console.error('Error rolling back transaction:', errorInfo);
      return false;
    }
  }
}

// Create a singleton instance
const storageService = new StorageService();

module.exports = storageService;