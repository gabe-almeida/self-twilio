# Concurrency Control Documentation

This document provides an overview of the concurrency control mechanisms implemented in the Twilio Dialer Web App.

## Overview

The concurrency control system provides a robust locking mechanism to prevent race conditions and ensure data consistency in the application. It replaces the simple boolean flags with a more sophisticated approach that includes timeouts, ownership tracking, and automatic lock release.

## Lock Service

The lock service (`server/services/lock-service.js`) provides the following features:

- **In-memory locking**: For single-instance deployments
- **Distributed locking**: Abstraction layer for future multi-instance deployments
- **Timeout-based locks**: Locks automatically expire after a configurable timeout
- **Owner tracking**: Locks are associated with a specific owner
- **Automatic lock release**: Locks can be configured to automatically release after a timeout
- **Lock monitoring**: The service provides methods to monitor active locks
- **Stale lock recovery**: Expired locks are automatically detected and released

## Lock Types

The lock service defines several lock types for different operations:

- `QUEUE_PROCESSING`: Used for call queue processing operations
- `CALL_ASSIGNMENT`: Used for assigning calls to agents
- `AGENT_STATUS_UPDATE`: Used for updating agent status
- `WORKFLOW_EXECUTION`: Used for workflow execution

## Usage

### Acquiring a Lock

```javascript
const lockResult = await lockService.acquireLock(
  lockService.LockTypes.QUEUE_PROCESSING, // Lock type
  'default',                              // Resource ID
  'owner-123'                             // Owner ID
);

if (lockResult.success) {
  try {
    // Perform operations with the lock
    // ...
  } finally {
    // Always release the lock when done
    await lockService.releaseLock(
      lockService.LockTypes.QUEUE_PROCESSING,
      'default',
      'owner-123'
    );
  }
} else {
  console.log(`Could not acquire lock: ${lockResult.error}`);
}
```

### Checking if a Resource is Locked

```javascript
const lockStatus = await lockService.isLocked(
  lockService.LockTypes.QUEUE_PROCESSING,
  'default'
);

if (lockStatus.locked) {
  console.log(`Resource is locked by ${lockStatus.ownerId} until ${new Date(lockStatus.expiresAt)}`);
} else {
  console.log('Resource is not locked');
}
```

### Getting All Active Locks

```javascript
const result = await lockService.getAllLocks();

if (result.success) {
  console.log(`There are ${result.locks.length} active locks`);
  
  for (const lock of result.locks) {
    console.log(`Lock ${lock.lockKey} held by ${lock.ownerId}, expires in ${lock.timeRemaining}ms`);
  }
}
```

## Configuration

The lock service is configured through the feature flags system. The following configuration options are available:

- `concurrency.enabled`: Whether concurrency control is enabled
- `concurrency.lockTimeout`: The default timeout for locks in milliseconds
- `concurrency.retryInterval`: The interval between retry attempts in milliseconds
- `concurrency.maxRetries`: The maximum number of retry attempts
- `concurrency.distributedLocking`: Whether distributed locking is enabled
- `concurrency.autoRelease`: Whether locks should be automatically released after timeout

## Implementation Details

### In-Memory Locking

The in-memory locking mechanism uses a Map to store locks. Each lock is represented as an object with the following properties:

- `ownerId`: The ID of the owner who acquired the lock
- `acquiredAt`: The timestamp when the lock was acquired
- `expiresAt`: The timestamp when the lock expires
- `released`: Whether the lock has been released

### Distributed Locking

The distributed locking mechanism is designed to be implemented in the future. The current implementation provides a placeholder that falls back to in-memory locking.

## Best Practices

1. **Always release locks**: Use try/finally blocks to ensure locks are released even if an error occurs
2. **Use appropriate timeouts**: Set timeouts based on the expected duration of the operation
3. **Handle lock acquisition failures**: Have a strategy for what to do if a lock cannot be acquired
4. **Use specific resource IDs**: Make resource IDs as specific as possible to minimize contention
5. **Monitor lock usage**: Regularly check for stale or abandoned locks

## Future Improvements

1. **Implement distributed locking**: Add support for Redis or database-based distributed locking
2. **Add lock escalation**: Allow locks to be escalated to higher levels if needed
3. **Implement deadlock detection**: Add mechanisms to detect and resolve deadlocks
4. **Add lock statistics**: Collect and report statistics on lock usage and contention
5. **Implement lock queuing**: Allow operations to queue up for a lock rather than failing immediately