// Database initialization script for Twilio Dialer Web App
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');

// Create a new database connection
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log(`Initializing database at ${dbPath}`);

// Simple password hashing function using crypto
const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

// Run all database operations in a series of promises
const initDatabase = async () => {
  try {
    // Create users table
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          full_name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          role TEXT NOT NULL DEFAULT 'agent',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('Users table created');

    // Create agent_status table
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS agent_status (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL UNIQUE,
          status TEXT NOT NULL DEFAULT 'Offline',
          last_status_change TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('Agent status table created');

    // Create call_queue table
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS call_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          phone_number TEXT NOT NULL,
          contact_name TEXT,
          notes TEXT,
          priority INTEGER DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'Queued',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          scheduled_for TIMESTAMP,
          assigned_to INTEGER,
          completed_at TIMESTAMP,
          call_sid TEXT,
          call_duration INTEGER,
          call_status TEXT,
          FOREIGN KEY (assigned_to) REFERENCES users (id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('Call queue table created');

    // Create call_history table
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS call_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          phone_number TEXT NOT NULL,
          contact_name TEXT,
          direction TEXT NOT NULL,
          start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          end_time TIMESTAMP,
          duration INTEGER,
          call_sid TEXT,
          call_status TEXT,
          notes TEXT,
          recording_url TEXT,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('Call history table created');

    // Create an admin user if none exists
    const adminPassword = hashPassword('admin123');
    await new Promise((resolve, reject) => {
      db.run(`
        INSERT OR IGNORE INTO users (username, password, full_name, email, role)
        VALUES ('admin', ?, 'System Administrator', 'admin@example.com', 'admin')
      `, [adminPassword], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('Admin user created (if not already exists)');

    // Create a test agent if none exists
    const agentPassword = hashPassword('agent123');
    await new Promise((resolve, reject) => {
      db.run(`
        INSERT OR IGNORE INTO users (username, password, full_name, email, role)
        VALUES ('agent', ?, 'Test Agent', 'agent@example.com', 'agent')
      `, [agentPassword], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('Test agent created (if not already exists)');

    // Initialize agent statuses for existing users
    await new Promise((resolve, reject) => {
      db.run(`
        INSERT OR IGNORE INTO agent_status (user_id, status)
        SELECT id, 'Offline' FROM users WHERE role = 'agent'
        AND id NOT IN (SELECT user_id FROM agent_status)
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('Agent statuses initialized');

    // Add some sample call queue entries
    await new Promise((resolve, reject) => {
      db.run(`
        INSERT OR IGNORE INTO call_queue (phone_number, contact_name, notes, priority, status)
        VALUES
        ('+19785551234', 'John Smith', 'Interested in premium plan', 2, 'Queued'),
        ('+19785552345', 'Jane Doe', 'Follow up on previous call', 1, 'Queued'),
        ('+19785553456', 'Bob Johnson', 'New lead from website', 3, 'Queued')
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('Sample call queue entries added');

    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    // Close the database connection
    db.close();
  }
};

// Run the initialization
initDatabase();