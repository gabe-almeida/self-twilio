// Lock Service for Twilio Dialer Web App
/**
 * This service provides a robust locking mechanism for concurrent operations.
 * It replaces the simple boolean flags with a more sophisticated approach that
 * includes timeouts, ownership tracking, and automatic lock release.
 * 
 * The service supports both in-memory locks (for single-instance deployments)
 * and can be extended to support distributed locks (for multi-instance deployments).
 */

const errorService = require('./error-service');
const featureFlags = require('./feature-flags');

// In-memory store for locks
const locks = new Map();

/**
 * Lock types for different operations
 */
const LockTypes = {
  QUEUE_PROCESSING: 'queue_processing',
  CALL_ASSIGNMENT: 'call_assignment',
  AGENT_STATUS_UPDATE: 'agent_status_update',
  WORKFLOW_EXECUTION: 'workflow_execution'
};

/**
 * Default lock options
 */
const DEFAULT_OPTIONS = {
  timeout: 30000, // 30 seconds
  retryInterval: 500, // 500 ms
  maxRetries: 10,
  autoRelease: true
};

/**
 * Acquire a lock
 * 
 * @param {string} lockType - The type of lock to acquire
 * @param {string} resourceId - The ID of the resource to lock (optional)
 * @param {string} ownerId - The ID of the owner acquiring the lock
 * @param {Object} options - Lock options
 * @returns {Promise<Object>} - Lock result
 */
const acquireLock = async (lockType, resourceId = 'default', ownerId = 'system', options = {}) => {
  try {
    // Merge default options with provided options
    const lockOptions = { ...DEFAULT_OPTIONS, ...options };
    
    // Generate lock key
    const lockKey = `${lockType}:${resourceId}`;
    
    // Check if distributed locking is enabled
    const distributedLockingEnabled = await featureFlags.isFeatureEnabled('concurrency.distributedLocking');
    
    if (distributedLockingEnabled) {
      // Use distributed locking mechanism (to be implemented)
      return acquireDistributedLock(lockKey, ownerId, lockOptions);
    } else {
      // Use in-memory locking mechanism
      return acquireInMemoryLock(lockKey, ownerId, lockOptions);
    }
  } catch (error) {
    const errorInfo = errorService.handleError(error, 'lock-service.acquireLock');
    return {
      success: false,
      error: errorInfo.message,
      lockKey: `${lockType}:${resourceId}`
    };
  }
};

/**
 * Acquire an in-memory lock
 * 
 * @param {string} lockKey - The key for the lock
 * @param {string} ownerId - The ID of the owner acquiring the lock
 * @param {Object} options - Lock options
 * @returns {Promise<Object>} - Lock result
 */
const acquireInMemoryLock = async (lockKey, ownerId, options) => {
  let retries = 0;
  
  while (retries <= options.maxRetries) {
    // Check if the lock is already held
    const existingLock = locks.get(lockKey);
    
    if (!existingLock) {
      // Lock is not held, acquire it
      const lock = {
        ownerId,
        acquiredAt: Date.now(),
        expiresAt: Date.now() + options.timeout,
        released: false
      };
      
      locks.set(lockKey, lock);
      
      // Set up automatic release if enabled
      if (options.autoRelease) {
        setTimeout(() => {
          // Only release if still held by the same owner
          const currentLock = locks.get(lockKey);
          if (currentLock && currentLock.ownerId === ownerId && !currentLock.released) {
            console.log(`Auto-releasing lock ${lockKey} for owner ${ownerId} after timeout`);
            releaseLock(lockKey, ownerId);
          }
        }, options.timeout);
      }
      
      return {
        success: true,
        lockKey,
        ownerId,
        expiresAt: lock.expiresAt
      };
    } else if (existingLock.ownerId === ownerId) {
      // Lock is already held by this owner, extend it
      existingLock.expiresAt = Date.now() + options.timeout;
      
      return {
        success: true,
        lockKey,
        ownerId,
        expiresAt: existingLock.expiresAt,
        extended: true
      };
    } else if (existingLock.expiresAt < Date.now()) {
      // Lock has expired, force release and try again
      console.log(`Forcing release of expired lock ${lockKey} held by ${existingLock.ownerId}`);
      locks.delete(lockKey);
      continue;
    }
    
    // Lock is held by another owner and not expired, wait and retry
    retries++;
    
    if (retries <= options.maxRetries) {
      await new Promise(resolve => setTimeout(resolve, options.retryInterval));
    }
  }
  
  // Failed to acquire lock after max retries
  return {
    success: false,
    error: `Failed to acquire lock ${lockKey} after ${options.maxRetries} retries`,
    lockKey,
    ownerId
  };
};

/**
 * Acquire a distributed lock (placeholder for future implementation)
 * 
 * @param {string} lockKey - The key for the lock
 * @param {string} ownerId - The ID of the owner acquiring the lock
 * @param {Object} options - Lock options
 * @returns {Promise<Object>} - Lock result
 */
const acquireDistributedLock = async (lockKey, ownerId, options) => {
  // This is a placeholder for future implementation
  // In a real implementation, this would use Redis, a database, or another distributed locking mechanism
  console.log(`Distributed locking not yet implemented, falling back to in-memory locking for ${lockKey}`);
  return acquireInMemoryLock(lockKey, ownerId, options);
};

/**
 * Release a lock
 * 
 * @param {string} lockType - The type of lock to release
 * @param {string} resourceId - The ID of the resource to unlock (optional)
 * @param {string} ownerId - The ID of the owner releasing the lock
 * @returns {Promise<Object>} - Release result
 */
const releaseLock = async (lockType, resourceId = 'default', ownerId = 'system') => {
  try {
    // Generate lock key
    const lockKey = `${lockType}:${resourceId}`;
    
    // Check if distributed locking is enabled
    const distributedLockingEnabled = await featureFlags.isFeatureEnabled('concurrency.distributedLocking');
    
    if (distributedLockingEnabled) {
      // Use distributed locking mechanism (to be implemented)
      return releaseDistributedLock(lockKey, ownerId);
    } else {
      // Use in-memory locking mechanism
      return releaseInMemoryLock(lockKey, ownerId);
    }
  } catch (error) {
    const errorInfo = errorService.handleError(error, 'lock-service.releaseLock');
    return {
      success: false,
      error: errorInfo.message,
      lockKey: `${lockType}:${resourceId}`
    };
  }
};

/**
 * Release an in-memory lock
 * 
 * @param {string} lockKey - The key for the lock
 * @param {string} ownerId - The ID of the owner releasing the lock
 * @returns {Promise<Object>} - Release result
 */
const releaseInMemoryLock = async (lockKey, ownerId) => {
  // Check if the lock exists
  const existingLock = locks.get(lockKey);
  
  if (!existingLock) {
    return {
      success: false,
      error: `Lock ${lockKey} does not exist`,
      lockKey,
      ownerId
    };
  }
  
  // Check if the lock is owned by the requester
  if (existingLock.ownerId !== ownerId) {
    return {
      success: false,
      error: `Lock ${lockKey} is owned by ${existingLock.ownerId}, not ${ownerId}`,
      lockKey,
      ownerId
    };
  }
  
  // Mark the lock as released
  existingLock.released = true;
  
  // Remove the lock
  locks.delete(lockKey);
  
  return {
    success: true,
    lockKey,
    ownerId
  };
};

/**
 * Release a distributed lock (placeholder for future implementation)
 * 
 * @param {string} lockKey - The key for the lock
 * @param {string} ownerId - The ID of the owner releasing the lock
 * @returns {Promise<Object>} - Release result
 */
const releaseDistributedLock = async (lockKey, ownerId) => {
  // This is a placeholder for future implementation
  // In a real implementation, this would use Redis, a database, or another distributed locking mechanism
  console.log(`Distributed locking not yet implemented, falling back to in-memory locking for ${lockKey}`);
  return releaseInMemoryLock(lockKey, ownerId);
};

/**
 * Check if a lock is held
 * 
 * @param {string} lockType - The type of lock to check
 * @param {string} resourceId - The ID of the resource to check (optional)
 * @returns {Promise<Object>} - Lock status
 */
const isLocked = async (lockType, resourceId = 'default') => {
  try {
    // Generate lock key
    const lockKey = `${lockType}:${resourceId}`;
    
    // Check if distributed locking is enabled
    const distributedLockingEnabled = await featureFlags.isFeatureEnabled('concurrency.distributedLocking');
    
    if (distributedLockingEnabled) {
      // Use distributed locking mechanism (to be implemented)
      return isDistributedLocked(lockKey);
    } else {
      // Use in-memory locking mechanism
      return isInMemoryLocked(lockKey);
    }
  } catch (error) {
    const errorInfo = errorService.handleError(error, 'lock-service.isLocked');
    return {
      success: false,
      error: errorInfo.message,
      lockKey: `${lockType}:${resourceId}`
    };
  }
};

/**
 * Check if an in-memory lock is held
 * 
 * @param {string} lockKey - The key for the lock
 * @returns {Promise<Object>} - Lock status
 */
const isInMemoryLocked = async (lockKey) => {
  // Check if the lock exists
  const existingLock = locks.get(lockKey);
  
  if (!existingLock) {
    return {
      locked: false,
      lockKey
    };
  }
  
  // Check if the lock has expired
  if (existingLock.expiresAt < Date.now()) {
    // Lock has expired, force release
    console.log(`Forcing release of expired lock ${lockKey} held by ${existingLock.ownerId}`);
    locks.delete(lockKey);
    
    return {
      locked: false,
      lockKey,
      expired: true
    };
  }
  
  // Lock is held and not expired
  return {
    locked: true,
    lockKey,
    ownerId: existingLock.ownerId,
    expiresAt: existingLock.expiresAt,
    acquiredAt: existingLock.acquiredAt
  };
};

/**
 * Check if a distributed lock is held (placeholder for future implementation)
 * 
 * @param {string} lockKey - The key for the lock
 * @returns {Promise<Object>} - Lock status
 */
const isDistributedLocked = async (lockKey) => {
  // This is a placeholder for future implementation
  // In a real implementation, this would use Redis, a database, or another distributed locking mechanism
  console.log(`Distributed locking not yet implemented, falling back to in-memory locking for ${lockKey}`);
  return isInMemoryLocked(lockKey);
};

/**
 * Get all active locks
 * 
 * @returns {Promise<Array>} - Array of active locks
 */
const getAllLocks = async () => {
  try {
    // Check if distributed locking is enabled
    const distributedLockingEnabled = await featureFlags.isFeatureEnabled('concurrency.distributedLocking');
    
    if (distributedLockingEnabled) {
      // Use distributed locking mechanism (to be implemented)
      return getAllDistributedLocks();
    } else {
      // Use in-memory locking mechanism
      return getAllInMemoryLocks();
    }
  } catch (error) {
    const errorInfo = errorService.handleError(error, 'lock-service.getAllLocks');
    return {
      success: false,
      error: errorInfo.message
    };
  }
};

/**
 * Get all active in-memory locks
 * 
 * @returns {Promise<Array>} - Array of active locks
 */
const getAllInMemoryLocks = async () => {
  const now = Date.now();
  const activeLocks = [];
  
  // Iterate through all locks
  for (const [lockKey, lock] of locks.entries()) {
    // Skip expired locks
    if (lock.expiresAt < now) {
      continue;
    }
    
    // Add active lock to the result
    activeLocks.push({
      lockKey,
      ownerId: lock.ownerId,
      acquiredAt: lock.acquiredAt,
      expiresAt: lock.expiresAt,
      timeRemaining: lock.expiresAt - now
    });
  }
  
  return {
    success: true,
    locks: activeLocks
  };
};

/**
 * Get all active distributed locks (placeholder for future implementation)
 * 
 * @returns {Promise<Array>} - Array of active locks
 */
const getAllDistributedLocks = async () => {
  // This is a placeholder for future implementation
  // In a real implementation, this would use Redis, a database, or another distributed locking mechanism
  console.log('Distributed locking not yet implemented, falling back to in-memory locking');
  return getAllInMemoryLocks();
};

/**
 * Clean up expired locks
 * 
 * @returns {Promise<Object>} - Cleanup result
 */
const cleanupExpiredLocks = async () => {
  try {
    // Check if distributed locking is enabled
    const distributedLockingEnabled = await featureFlags.isFeatureEnabled('concurrency.distributedLocking');
    
    if (distributedLockingEnabled) {
      // Use distributed locking mechanism (to be implemented)
      return cleanupExpiredDistributedLocks();
    } else {
      // Use in-memory locking mechanism
      return cleanupExpiredInMemoryLocks();
    }
  } catch (error) {
    const errorInfo = errorService.handleError(error, 'lock-service.cleanupExpiredLocks');
    return {
      success: false,
      error: errorInfo.message
    };
  }
};

/**
 * Clean up expired in-memory locks
 * 
 * @returns {Promise<Object>} - Cleanup result
 */
const cleanupExpiredInMemoryLocks = async () => {
  const now = Date.now();
  let count = 0;
  
  // Iterate through all locks
  for (const [lockKey, lock] of locks.entries()) {
    // Remove expired locks
    if (lock.expiresAt < now) {
      locks.delete(lockKey);
      count++;
    }
  }
  
  return {
    success: true,
    count
  };
};

/**
 * Clean up expired distributed locks (placeholder for future implementation)
 * 
 * @returns {Promise<Object>} - Cleanup result
 */
const cleanupExpiredDistributedLocks = async () => {
  // This is a placeholder for future implementation
  // In a real implementation, this would use Redis, a database, or another distributed locking mechanism
  console.log('Distributed locking not yet implemented, falling back to in-memory locking');
  return cleanupExpiredInMemoryLocks();
};

/**
 * Initialize the lock service
 * 
 * @returns {Promise<boolean>} - True if initialization was successful
 */
const initialize = async () => {
  try {
    // Set up periodic cleanup of expired locks
    setInterval(cleanupExpiredLocks, 60000); // Run every minute
    
    console.log('Lock service initialized');
    return true;
  } catch (error) {
    errorService.handleError(error, 'lock-service.initialize');
    return false;
  }
};

module.exports = {
  LockTypes,
  initialize,
  acquireLock,
  releaseLock,
  isLocked,
  getAllLocks,
  cleanupExpiredLocks
};