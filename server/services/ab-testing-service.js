/**
 * A/B Testing Service for Twilio Dialer Web App
 * 
 * This service provides A/B testing capabilities for comparing different implementations
 * of features. It allows for gradual rollout of new features and comparison of their
 * performance against existing implementations.
 */
const featureFlags = require('./feature-flags');
const errorService = require('./error-service');

class ABTestingService {
  constructor() {
    this.tests = {};
    this.testResults = {};
    this.initialized = false;
  }
  
  /**
   * Initialize the A/B testing service
   */
  async initialize() {
    try {
      console.log('Initializing A/B testing service');
      
      // Check if A/B testing is enabled
      const abTestingEnabled = await featureFlags.isFeatureEnabled('abTesting.enabled');
      
      if (!abTestingEnabled) {
        console.log('A/B testing is disabled');
        return true;
      }
      
      // Load test configurations
      const callDistributionEnabled = await featureFlags.isFeatureEnabled('abTesting.tests.callDistribution.enabled');
      const retryStrategyEnabled = await featureFlags.isFeatureEnabled('abTesting.tests.retryStrategy.enabled');
      
      // Initialize tests
      if (callDistributionEnabled) {
        const traditionalWeight = await featureFlags.getFeatureValue('abTesting.tests.callDistribution.variants.traditional', 0.5);
        const loadBalancedWeight = await featureFlags.getFeatureValue('abTesting.tests.callDistribution.variants.loadBalanced', 0.5);
        
        this.tests.callDistribution = {
          enabled: true,
          variants: {
            traditional: traditionalWeight,
            loadBalanced: loadBalancedWeight
          },
          totalWeight: traditionalWeight + loadBalancedWeight
        };
        
        console.log('Call distribution A/B test enabled:', this.tests.callDistribution);
      }
      
      if (retryStrategyEnabled) {
        const fixedWeight = await featureFlags.getFeatureValue('abTesting.tests.retryStrategy.variants.fixed', 0.3);
        const exponentialWeight = await featureFlags.getFeatureValue('abTesting.tests.retryStrategy.variants.exponential', 0.7);
        
        this.tests.retryStrategy = {
          enabled: true,
          variants: {
            fixed: fixedWeight,
            exponential: exponentialWeight
          },
          totalWeight: fixedWeight + exponentialWeight
        };
        
        console.log('Retry strategy A/B test enabled:', this.tests.retryStrategy);
      }
      
      // Initialize test results
      this.testResults = {
        callDistribution: {
          traditional: {
            calls: 0,
            successes: 0,
            failures: 0,
            avgDuration: 0,
            totalDuration: 0
          },
          loadBalanced: {
            calls: 0,
            successes: 0,
            failures: 0,
            avgDuration: 0,
            totalDuration: 0
          }
        },
        retryStrategy: {
          fixed: {
            retries: 0,
            successes: 0,
            failures: 0,
            avgAttempts: 0,
            totalAttempts: 0
          },
          exponential: {
            retries: 0,
            successes: 0,
            failures: 0,
            avgAttempts: 0,
            totalAttempts: 0
          }
        }
      };
      
      this.initialized = true;
      console.log('A/B testing service initialized');
      
      return true;
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'ab-testing-service.initialize');
      console.error('Error initializing A/B testing service:', errorInfo);
      return false;
    }
  }
  
  /**
   * Get the variant to use for a test
   * @param {string} testName - The name of the test
   * @param {string} entityId - An ID to use for consistent assignment (e.g., call ID, agent ID)
   * @returns {string|null} The variant to use, or null if the test is not enabled
   */
  getVariant(testName, entityId) {
    try {
      // If not initialized or test not enabled, return null
      if (!this.initialized || !this.tests[testName] || !this.tests[testName].enabled) {
        return null;
      }
      
      // If entityId is provided, use it for consistent assignment
      if (entityId) {
        // Use a simple hash of the entityId to get a number between 0 and 1
        const hash = this.hashString(entityId);
        const normalizedHash = hash / Number.MAX_SAFE_INTEGER;
        
        return this.selectVariantByWeight(testName, normalizedHash);
      }
      
      // Otherwise, use random assignment
      return this.selectVariantByWeight(testName, Math.random());
    } catch (error) {
      console.error('Error getting variant:', error);
      return null;
    }
  }
  
  /**
   * Select a variant based on its weight
   * @param {string} testName - The name of the test
   * @param {number} value - A value between 0 and 1
   * @returns {string} The selected variant
   */
  selectVariantByWeight(testName, value) {
    const test = this.tests[testName];
    let cumulativeWeight = 0;
    
    for (const [variant, weight] of Object.entries(test.variants)) {
      cumulativeWeight += weight / test.totalWeight;
      
      if (value <= cumulativeWeight) {
        return variant;
      }
    }
    
    // Default to the first variant if something goes wrong
    return Object.keys(test.variants)[0];
  }
  
  /**
   * Record a test result
   * @param {string} testName - The name of the test
   * @param {string} variant - The variant used
   * @param {boolean} success - Whether the operation was successful
   * @param {Object} metrics - Additional metrics to record
   */
  recordResult(testName, variant, success, metrics = {}) {
    try {
      // If not initialized or test not enabled, do nothing
      if (!this.initialized || !this.tests[testName] || !this.tests[testName].enabled) {
        return;
      }
      
      // If variant is not valid, do nothing
      if (!this.testResults[testName] || !this.testResults[testName][variant]) {
        return;
      }
      
      const results = this.testResults[testName][variant];
      
      // Update common metrics
      if (testName === 'callDistribution') {
        results.calls++;
        
        if (success) {
          results.successes++;
          
          // Update duration metrics if provided
          if (metrics.duration) {
            results.totalDuration += metrics.duration;
            results.avgDuration = results.totalDuration / results.successes;
          }
        } else {
          results.failures++;
        }
      } else if (testName === 'retryStrategy') {
        results.retries++;
        
        if (success) {
          results.successes++;
        } else {
          results.failures++;
        }
        
        // Update attempts metrics if provided
        if (metrics.attempts) {
          results.totalAttempts += metrics.attempts;
          results.avgAttempts = results.totalAttempts / results.retries;
        }
      }
    } catch (error) {
      console.error('Error recording test result:', error);
    }
  }
  
  /**
   * Get test results
   * @returns {Object} The test results
   */
  getResults() {
    return { ...this.testResults };
  }
  
  /**
   * Get test configuration
   * @returns {Object} The test configuration
   */
  getTests() {
    return { ...this.tests };
  }
  
  /**
   * Simple string hash function
   * @param {string} str - The string to hash
   * @returns {number} A numeric hash value
   */
  hashString(str) {
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash);
  }
}

// Create a singleton instance
const abTestingService = new ABTestingService();

module.exports = abTestingService;