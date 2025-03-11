# Data Persistence Documentation

This document provides an overview of the data persistence system implemented in the Twilio Dialer Web App.

## Overview

The data persistence system provides a storage abstraction layer that works with both in-memory and persistent storage. It defines interfaces for data access and ensures all data access goes through this abstraction layer.

The system supports multiple storage adapters:
1. **MemoryAdapter** - In-memory storage (default)
2. **SqlAdapter** - SQL database storage (PostgreSQL)

The system is designed to be easily extensible with additional adapters.

## Storage Service

The storage service (`server/services/storage-service.js`) provides a unified interface for data access. It selects the appropriate storage adapter based on configuration and routes all data access through the adapter.

### Key Features

- **Storage Abstraction Layer**: Defines interfaces for data access that work with both in-memory and persistent storage.
- **Multiple Storage Adapters**: Supports in-memory and SQL database storage.
- **Transparent Data Access**: All data access goes through the abstraction layer, making it easy to switch between storage adapters.
- **Error Handling**: Comprehensive error handling for all data access operations.
- **Transaction Support**: Support for transactions to ensure data consistency.

## Configuration

The storage service is configured through the feature flags system. The following configuration options are available:

```json
"persistentStorage": {
  "enabled": false,
  "dbType": "postgres",
  "dbHost": "localhost",
  "dbPort": 5432,
  "dbName": "twilio_dialer",
  "dbUser": "postgres",
  "dbPassword": "",
  "connectionPoolSize": 10,
  "migrationEnabled": true
}
```

- `enabled`: Whether persistent storage is enabled
- `dbType`: The type of database to use (currently only PostgreSQL is supported)
- `dbHost`: The hostname of the database server
- `dbPort`: The port of the database server
- `dbName`: The name of the database
- `dbUser`: The username for the database
- `dbPassword`: The password for the database
- `connectionPoolSize`: The size of the connection pool
- `migrationEnabled`: Whether automatic migration is enabled

## Database Schema

The system uses the following database schema:

### Users Table

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'agent',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Agent Status Table

```sql
CREATE TABLE IF NOT EXISTS agent_status (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'Offline',
  last_status_change TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Call Queue Table

```sql
CREATE TABLE IF NOT EXISTS call_queue (
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
);
```

### Call History Table

```sql
CREATE TABLE IF NOT EXISTS call_history (
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
);
```

### Dispositions Table

```sql
CREATE TABLE IF NOT EXISTS dispositions (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_final BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Workflows Table

```sql
CREATE TABLE IF NOT EXISTS workflows (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  triggers JSONB,
  steps JSONB,
  business_hours JSONB
);
```

### Campaigns Table

```sql
CREATE TABLE IF NOT EXISTS campaigns (
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
);
```

### Campaign Members Table

```sql
CREATE TABLE IF NOT EXISTS campaign_members (
  id SERIAL PRIMARY KEY,
  campaign_id VARCHAR(50) NOT NULL REFERENCES campaigns(id),
  lead_id INTEGER NOT NULL REFERENCES call_queue(id),
  added_at TIMESTAMP NOT NULL DEFAULT NOW(),
  added_by INTEGER REFERENCES users(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Contact Centers Table

```sql
CREATE TABLE IF NOT EXISTS contact_centers (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  settings JSONB
);
```

### Contact Center Agents Table

```sql
CREATE TABLE IF NOT EXISTS contact_center_agents (
  id VARCHAR(50) PRIMARY KEY,
  contact_center_id VARCHAR(50) NOT NULL REFERENCES contact_centers(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  role VARCHAR(20) NOT NULL DEFAULT 'agent',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  active BOOLEAN NOT NULL DEFAULT TRUE
);
```

### Contact Center Phones Table

```sql
CREATE TABLE IF NOT EXISTS contact_center_phones (
  id VARCHAR(50) PRIMARY KEY,
  contact_center_id VARCHAR(50) NOT NULL REFERENCES contact_centers(id),
  phone_number VARCHAR(20) NOT NULL,
  friendly_name VARCHAR(100),
  direction VARCHAR(10) NOT NULL DEFAULT 'both',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  active BOOLEAN NOT NULL DEFAULT TRUE
);
```

## Migration

The system includes a migration script (`server/scripts/migrate-to-db.js`) to migrate data from in-memory storage to the database. The script reads the data from the memory-store.js file and inserts it into the database.

### Usage

```bash
node server/scripts/migrate-to-db.js
```

The migration script performs the following steps:
1. Enables persistent storage
2. Initializes the storage service
3. Migrates users
4. Migrates agent statuses
5. Migrates call queue
6. Migrates call history
7. Migrates dispositions
8. Migrates workflows
9. Migrates campaigns
10. Migrates campaign members
11. Migrates contact centers
12. Migrates contact center agents
13. Migrates contact center phones

## Usage

### Initializing the Storage Service

```javascript
const storageService = require('./services/storage-service');

// Initialize the storage service
await storageService.initialize();
```

### Basic CRUD Operations

```javascript
// Insert a user
const user = {
  username: 'john.doe',
  password: 'hashed_password',
  full_name: 'John Doe',
  email: 'john.doe@example.com',
  role: 'agent'
};

const result = await storageService.insert('users', user);
console.log(`User inserted with ID: ${result.id}`);

// Get a user by ID
const user = await storageService.getById('users', 1);
console.log(`User: ${user.username}`);

// Update a user
const updateResult = await storageService.update('users', 1, {
  full_name: 'John Smith'
});
console.log(`User updated: ${updateResult.changes} rows affected`);

// Delete a user
const deleteResult = await storageService.delete('users', 1);
console.log(`User deleted: ${deleteResult.changes} rows affected`);
```

### Querying Data

```javascript
// Get all users
const users = await storageService.getAll('users');
console.log(`Found ${users.length} users`);

// Get users with filtering, sorting, and pagination
const options = {
  where: { role: 'agent' },
  orderBy: 'username ASC',
  limit: 10,
  offset: 0
};

const agents = await storageService.getAll('users', options);
console.log(`Found ${agents.length} agents`);

// Count users
const count = await storageService.count('users', { role: 'agent' });
console.log(`Found ${count} agents`);
```

### Transactions

```javascript
// Begin a transaction
const transaction = await storageService.beginTransaction();

try {
  // Perform operations within the transaction
  await storageService.insert('users', user);
  await storageService.insert('agent_status', status);
  
  // Commit the transaction
  await storageService.commitTransaction(transaction);
  console.log('Transaction committed');
} catch (error) {
  // Rollback the transaction on error
  await storageService.rollbackTransaction(transaction);
  console.error('Transaction rolled back:', error);
}
```

## Best Practices

1. **Use the Storage Service**: Always use the storage service for data access, not direct database queries.
2. **Use Transactions**: Use transactions for operations that need to be atomic.
3. **Handle Errors**: Always handle errors from the storage service.
4. **Use Feature Flags**: Use feature flags to control the storage adapter.
5. **Test Both Adapters**: Test your code with both in-memory and SQL adapters.

## Future Improvements

1. **Additional Storage Adapters**: Add support for additional storage adapters (e.g., MongoDB, Redis).
2. **Schema Versioning**: Add support for schema versioning and automatic migrations.
3. **Query Builder**: Add a query builder to simplify complex queries.
4. **Caching**: Add caching to improve performance.
5. **Sharding**: Add support for sharding to improve scalability.