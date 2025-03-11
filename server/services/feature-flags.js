// Feature flags service for Twilio Dialer Web App
const fs = require('fs').promises;
const path = require('path');

/**
 * This service manages feature flags for gradual rollout of new features.
 * It provides methods to check if features are enabled, get feature values,
 * and enable/disable features.
 */

// Default feature flags configuration
const defaultFlags = {
  errorHandling: {
    enabled: false,
    retryEnabled: false,
    maxRetries: 3,
    baseDelayMinutes: 1, // 1 minute
    maxDelayMinutes: 60, // 1 hour
    failureCategorization: false
  },
  logging: {
    detailedErrors: false,
    callStatusLogging: true
  },
  concurrency: {
    enabled: false,
    lockTimeout: 30000, // 30 seconds
    retryInterval: 500, // 500 ms
    maxRetries: 10,
    distributedLocking: false,
    autoRelease: true
  },
  loadBalancing: {
    enabled: false,
    maxCallsPerMinute: 60, // Default: 1 call per second
    agentCooldownMinutes: 5, // Default: 5 minutes cooldown after consecutive failures
    maxConsecutiveFailures: 3, // Default: 3 consecutive failures before cooldown
    prioritizeHighPriorityCalls: true, // Default: prioritize high-priority calls
    fairDistribution: true // Default: use fair distribution algorithm
  },
  monitoring: {
    enabled: false,
    updateIntervalMs: 60000, // 1 minute
    alertCheckIntervalMs: 300000, // 5 minutes
    metricsLogIntervalMs: 3600000, // 1 hour
    alertThresholds: {
      highCallFailureRate: 0.3, // 30% failure rate
      highQueueDepth: 20, // 20 calls in queue
      lowAgentAvailability: 0.2, // 20% of agents available
      highCallVolume: 50, // 50 calls per minute
      longWaitTime: 300 // 5 minutes
    }
  },
  abTesting: {
    enabled: false,
    tests: {
      callDistribution: {
        enabled: false,
        variants: {
          traditional: 0.5, // 50% of calls use traditional distribution
          loadBalanced: 0.5 // 50% of calls use load balanced distribution
        }
      },
      retryStrategy: {
        enabled: false,
        variants: {
          fixed: 0.3, // 30% of retries use fixed delay
          exponential: 0.7 // 70% of retries use exponential backoff
        }
      }
    }
  },
  scheduledCalls: {
    enabled: false,
    batchSize: 10, // Process up to 10 calls at once
    batchTimeWindow: 60000, // 1 minute window for batching calls
    optimizationEnabled: false,
    timezone: "America/New_York"
  },
  persistentStorage: {
    enabled: false,
    dbType: "postgres",
    dbHost: "localhost",
    dbPort: 5432,
    dbName: "twilio_dialer",
    dbUser: "postgres",
    dbPassword: "",
    connectionPoolSize: 10,
    migrationEnabled: true
  }
};

// In-memory cache of feature flags
let featureFlags = { ...defaultFlags };
let lastLoaded = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

// Path to feature flags file
const flagsFilePath = path.join(__dirname, '..', 'config', 'feature-flags.json');

/**
 * Loads feature flags from file
 * @param {boolean} force - Whether to force reload from disk
 * @returns {Promise<Object>} The loaded feature flags
 */
const loadFeatureFlags = async (force = false) => {
  try {
    // Check if we need to reload
    const now = Date.now();
    if (!force && now - lastLoaded < CACHE_TTL) {
      return featureFlags;
    }
    
    // Try to read the file
    const data = await fs.readFile(flagsFilePath, 'utf8');
    const loadedFlags = JSON.parse(data);
    
    // Merge with defaults to ensure all properties exist
    featureFlags = {
      ...defaultFlags,
      ...loadedFlags
    };
    
    lastLoaded = now;
    console.log('Feature flags loaded:', featureFlags);
    
    return featureFlags;
  } catch (error) {
    // If file doesn't exist or has invalid JSON, use defaults
    if (error.code === 'ENOENT' || error instanceof SyntaxError) {
      console.log('No feature flags file found or invalid JSON, using defaults');
      
      // Create the directory if it doesn't exist
      try {
        await fs.mkdir(path.dirname(flagsFilePath), { recursive: true });
      } catch (mkdirError) {
        console.error('Error creating config directory:', mkdirError);
      }
      
      // Write default flags to file for future use
      try {
        await fs.writeFile(flagsFilePath, JSON.stringify(defaultFlags, null, 2));
        console.log('Created default feature flags file');
      } catch (writeError) {
        console.error('Error writing default feature flags:', writeError);
      }
      
      return defaultFlags;
    }
    
    console.error('Error loading feature flags:', error);
    return defaultFlags;
  }
};

/**
 * Saves feature flags to file
 * @param {Object} flags - The flags to save
 * @returns {Promise<boolean>} Whether the save was successful
 */
const saveFeatureFlags = async (flags) => {
  try {
    // Merge with current flags
    const updatedFlags = {
      ...featureFlags,
      ...flags
    };
    
    // Write to file
    await fs.writeFile(flagsFilePath, JSON.stringify(updatedFlags, null, 2));
    
    // Update in-memory cache
    featureFlags = updatedFlags;
    lastLoaded = Date.now();
    
    console.log('Feature flags saved:', updatedFlags);
    return true;
  } catch (error) {
    console.error('Error saving feature flags:', error);
    return false;
  }
};

/**
 * Checks if a feature is enabled
 * @param {string} featurePath - Dot-notation path to the feature
 * @returns {Promise<boolean>} Whether the feature is enabled
 */
const isFeatureEnabled = async (featurePath) => {
  // Load flags (uses cache if available)
  await loadFeatureFlags();
  
  // Split the path into parts (e.g., 'errorHandling.retryEnabled')
  const parts = featurePath.split('.');
  
  // Navigate the object
  let current = featureFlags;
  for (const part of parts) {
    if (current === undefined || current === null) {
      return false;
    }
    current = current[part];
  }
  
  // Return the value, defaulting to false if undefined
  return Boolean(current);
};

/**
 * Gets a feature flag value
 * @param {string} featurePath - Dot-notation path to the feature
 * @param {*} defaultValue - Value to return if the feature is not found
 * @returns {Promise<*>} The feature value or the default value
 */
const getFeatureValue = async (featurePath, defaultValue = null) => {
  // Load flags (uses cache if available)
  await loadFeatureFlags();
  
  // Split the path into parts
  const parts = featurePath.split('.');
  
  // Navigate the object
  let current = featureFlags;
  for (const part of parts) {
    if (current === undefined || current === null) {
      return defaultValue;
    }
    current = current[part];
  }
  
  // Return the value or default
  return current !== undefined ? current : defaultValue;
};

/**
 * Enables a feature
 * @param {string} featurePath - Dot-notation path to the feature
 * @returns {Promise<boolean>} Whether the feature was enabled successfully
 */
const enableFeature = async (featurePath) => {
  // Load current flags
  await loadFeatureFlags();
  
  // Split the path
  const parts = featurePath.split('.');
  
  // Create a new object with the updated path
  const updateObj = {};
  let current = updateObj;
  
  // Build the nested structure
  for (let i = 0; i < parts.length - 1; i++) {
    current[parts[i]] = {};
    current = current[parts[i]];
  }
  
  // Set the final property to true
  current[parts[parts.length - 1]] = true;
  
  // Save the updated flags
  return saveFeatureFlags(updateObj);
};

/**
 * Disables a feature
 * @param {string} featurePath - Dot-notation path to the feature
 * @returns {Promise<boolean>} Whether the feature was disabled successfully
 */
const disableFeature = async (featurePath) => {
  // Load current flags
  await loadFeatureFlags();
  
  // Split the path
  const parts = featurePath.split('.');
  
  // Create a new object with the updated path
  const updateObj = {};
  let current = updateObj;
  
  // Build the nested structure
  for (let i = 0; i < parts.length - 1; i++) {
    current[parts[i]] = {};
    current = current[parts[i]];
  }
  
  // Set the final property to false
  current[parts[parts.length - 1]] = false;
  
  // Save the updated flags
  return saveFeatureFlags(updateObj);
};

/**
 * Gets all feature flags
 * @returns {Promise<Object>} All feature flags
 */
const getAllFeatureFlags = async () => {
  await loadFeatureFlags();
  return { ...featureFlags };
};

module.exports = {
  isFeatureEnabled,
  getFeatureValue,
  enableFeature,
  disableFeature,
  getAllFeatureFlags,
  loadFeatureFlags,
  saveFeatureFlags
};