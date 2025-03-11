// SQL Adapter for Twilio Dialer Web App
/**
 * This module provides a SQL adapter for the storage service.
 * It implements the StorageAdapter interface using a SQL database (PostgreSQL).
 */

const { Pool } = require('pg');
const errorService = require('./error-service');

class SqlAdapter {
  /**
   * Create a new SQL adapter
   * @param {Object} config - The database configuration
   */
  constructor(config) {
    this.config = config;
    this.pool = null;
    this.isInitialized = false;
    this.tableSchemas = {};
  }

  /**
   * Initialize the SQL adapter
   * @returns {Promise<boolean>} Whether initialization was successful
   */
  async initialize() {
    try {
      // Create a connection pool
      this.pool = new Pool({
        user: this.config.user,
        host: this.config.host,
        database: this.config.database,
        password: this.config.password,
        port: this.config.port,
        max: this.config.connectionPoolSize || 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test the connection
      const client = await this.pool.connect();
      client.release();

      console.log('Connected to PostgreSQL database');
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing SQL adapter:', error);
      return false;
    }
  }

  /**
   * Close the SQL adapter
   * @returns {Promise<boolean>} Whether closing was successful
   */
  async close() {
    try {
      if (this.pool) {
        await this.pool.end();
        console.log('Closed PostgreSQL connection pool');
      }
      this.isInitialized = false;
      return true;
    } catch (error) {
      console.error('Error closing SQL adapter:', error);
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
      const result = await this.pool.query(sql, params);
      return {
        id: result.rows[0]?.id || 0,
        changes: result.rowCount || 0
      };
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'sql-adapter.run');
      console.error('Error running SQL query:', errorInfo);
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
      const result = await this.pool.query(sql, params);
      return result.rows[0] || null;
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'sql-adapter.get');
      console.error('Error getting row from SQL query:', errorInfo);
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
      const result = await this.pool.query(sql, params);
      return result.rows || [];
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'sql-adapter.all');
      console.error('Error getting all rows from SQL query:', errorInfo);
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
      // Store the schema for future reference
      this.tableSchemas[tableName] = schema;

      // Create the table if it doesn't exist
      const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (${schema})`;
      await this.pool.query(sql);
      
      console.log(`Table ${tableName} created or already exists`);
      return true;
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'sql-adapter.createTable');
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
      // Add created_at and updated_at if not provided
      const now = new Date().toISOString();
      const insertData = {
        ...data,
        created_at: data.created_at || now,
        updated_at: data.updated_at || now
      };

      // Build the SQL query
      const columns = Object.keys(insertData);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const values = columns.map(col => insertData[col]);

      const sql = `
        INSERT INTO ${tableName} (${columns.join(', ')})
        VALUES (${placeholders})
        RETURNING id
      `;

      const result = await this.pool.query(sql, values);
      
      return {
        id: result.rows[0]?.id || 0,
        changes: result.rowCount || 0
      };
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'sql-adapter.insert');
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
      // Add updated_at if not provided
      const updateData = {
        ...data,
        updated_at: new Date().toISOString()
      };

      // Build the SQL query
      const columns = Object.keys(updateData);
      const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
      const values = [...columns.map(col => updateData[col]), id];

      const sql = `
        UPDATE ${tableName}
        SET ${setClause}
        WHERE id = $${columns.length + 1}
      `;

      const result = await this.pool.query(sql, values);
      
      return {
        changes: result.rowCount || 0
      };
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'sql-adapter.update');
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
      const sql = `
        DELETE FROM ${tableName}
        WHERE id = $1
      `;

      const result = await this.pool.query(sql, [id]);
      
      return {
        changes: result.rowCount || 0
      };
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'sql-adapter.delete');
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
      const sql = `
        SELECT * FROM ${tableName}
        WHERE id = $1
      `;

      const result = await this.pool.query(sql, [id]);
      
      return result.rows[0] || null;
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'sql-adapter.getById');
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
      // Build the SQL query
      let sql = `SELECT * FROM ${tableName}`;
      const values = [];
      let paramIndex = 1;

      // Add where clause
      if (options.where && Object.keys(options.where).length > 0) {
        const whereClause = Object.keys(options.where)
          .map(key => {
            values.push(options.where[key]);
            return `${key} = $${paramIndex++}`;
          })
          .join(' AND ');

        sql += ` WHERE ${whereClause}`;
      }

      // Add order by
      if (options.orderBy) {
        sql += ` ORDER BY ${options.orderBy}`;
      }

      // Add limit and offset
      if (options.limit) {
        sql += ` LIMIT $${paramIndex++}`;
        values.push(options.limit);

        if (options.offset) {
          sql += ` OFFSET $${paramIndex++}`;
          values.push(options.offset);
        }
      }

      const result = await this.pool.query(sql, values);
      
      return result.rows || [];
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'sql-adapter.getAll');
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
      // Build the SQL query
      let sql = `SELECT COUNT(*) as count FROM ${tableName}`;
      const values = [];
      let paramIndex = 1;

      // Add where clause
      if (Object.keys(where).length > 0) {
        const whereClause = Object.keys(where)
          .map(key => {
            values.push(where[key]);
            return `${key} = $${paramIndex++}`;
          })
          .join(' AND ');

        sql += ` WHERE ${whereClause}`;
      }

      const result = await this.pool.query(sql, values);
      
      return parseInt(result.rows[0]?.count || '0', 10);
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'sql-adapter.count');
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
      const client = await this.pool.connect();
      await client.query('BEGIN');
      
      return { client };
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'sql-adapter.beginTransaction');
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
      if (!transaction || !transaction.client) {
        throw new Error('Invalid transaction object');
      }

      await transaction.client.query('COMMIT');
      transaction.client.release();
      
      return true;
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'sql-adapter.commitTransaction');
      console.error('Error committing transaction:', errorInfo);
      
      // Try to rollback if commit fails
      if (transaction && transaction.client) {
        try {
          await transaction.client.query('ROLLBACK');
          transaction.client.release();
        } catch (rollbackError) {
          console.error('Error rolling back transaction after commit failure:', rollbackError);
        }
      }
      
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
      if (!transaction || !transaction.client) {
        throw new Error('Invalid transaction object');
      }

      await transaction.client.query('ROLLBACK');
      transaction.client.release();
      
      return true;
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'sql-adapter.rollbackTransaction');
      console.error('Error rolling back transaction:', errorInfo);
      
      // Release the client even if rollback fails
      if (transaction && transaction.client) {
        try {
          transaction.client.release();
        } catch (releaseError) {
          console.error('Error releasing client after rollback failure:', releaseError);
        }
      }
      
      return false;
    }
  }

  /**
   * Execute a query within a transaction
   * @param {Object} transaction - The transaction object
   * @param {string} sql - The SQL query to run
   * @param {Array} params - The parameters for the query
   * @returns {Promise<Object>} The result of the query
   */
  async queryWithTransaction(transaction, sql, params = []) {
    try {
      if (!transaction || !transaction.client) {
        throw new Error('Invalid transaction object');
      }

      const result = await transaction.client.query(sql, params);
      
      return {
        rows: result.rows || [],
        rowCount: result.rowCount || 0
      };
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'sql-adapter.queryWithTransaction');
      console.error('Error executing query within transaction:', errorInfo);
      throw error; // Rethrow to allow transaction rollback
    }
  }

  /**
   * Check if a table exists
   * @param {string} tableName - The name of the table
   * @returns {Promise<boolean>} Whether the table exists
   */
  async tableExists(tableName) {
    try {
      const sql = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        ) as exists
      `;

      const result = await this.pool.query(sql, [tableName]);
      
      return result.rows[0]?.exists || false;
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'sql-adapter.tableExists');
      console.error(`Error checking if table ${tableName} exists:`, errorInfo);
      return false;
    }
  }

  /**
   * Get the columns of a table
   * @param {string} tableName - The name of the table
   * @returns {Promise<Array>} The columns
   */
  async getTableColumns(tableName) {
    try {
      const sql = `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = $1
      `;

      const result = await this.pool.query(sql, [tableName]);
      
      return result.rows || [];
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'sql-adapter.getTableColumns');
      console.error(`Error getting columns for table ${tableName}:`, errorInfo);
      return [];
    }
  }

  /**
   * Add a column to a table
   * @param {string} tableName - The name of the table
   * @param {string} columnName - The name of the column
   * @param {string} dataType - The data type of the column
   * @returns {Promise<boolean>} Whether the column was added
   */
  async addColumn(tableName, columnName, dataType) {
    try {
      const sql = `
        ALTER TABLE ${tableName}
        ADD COLUMN IF NOT EXISTS ${columnName} ${dataType}
      `;

      await this.pool.query(sql);
      
      return true;
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'sql-adapter.addColumn');
      console.error(`Error adding column ${columnName} to table ${tableName}:`, errorInfo);
      return false;
    }
  }

  /**
   * Create an index on a table
   * @param {string} tableName - The name of the table
   * @param {string} indexName - The name of the index
   * @param {string|Array} columns - The column(s) to index
   * @param {boolean} unique - Whether the index should be unique
   * @returns {Promise<boolean>} Whether the index was created
   */
  async createIndex(tableName, indexName, columns, unique = false) {
    try {
      const columnList = Array.isArray(columns) ? columns.join(', ') : columns;
      const uniqueStr = unique ? 'UNIQUE' : '';
      
      const sql = `
        CREATE ${uniqueStr} INDEX IF NOT EXISTS ${indexName}
        ON ${tableName} (${columnList})
      `;

      await this.pool.query(sql);
      
      return true;
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'sql-adapter.createIndex');
      console.error(`Error creating index ${indexName} on table ${tableName}:`, errorInfo);
      return false;
    }
  }
}

module.exports = SqlAdapter;