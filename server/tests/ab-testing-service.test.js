/**
 * A/B Testing Service Tests
 * 
 * This file contains tests for the A/B testing service, which provides
 * capabilities for comparing different implementations side-by-side.
 */

const assert = require('assert');
const abTestingService = require('../services/ab-testing-service');
const featureFlags = require('../services/feature-flags');
const errorService = require('../services/error-service');

// Mock dependencies
jest.mock('../services/feature-flags', () => ({
  isFeatureEnabled: jest.fn(),
  getFeatureValue: jest.fn()
}));

jest.mock('../services/error-service', () => ({
  handleError: jest.fn().mockResolvedValue({
    message: 'Test error',
    type: 'TEST_ERROR',
    retryable: false
  })
}));

describe('A/B Testing Service', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Reset service state
    abTestingService.tests = {};
    abTestingService.testResults = {};
    abTestingService.initialized = false;
  });
  
  describe('initialize()', () => {
    it('should initialize the A/B testing service when enabled', async () => {
      // Mock feature flags
      featureFlags.isFeatureEnabled.mockImplementation((path) => {
        if (path === 'abTesting.enabled') return Promise.resolve(true);
        if (path === 'abTesting.tests.callDistribution.enabled') return Promise.resolve(true);
        if (path === 'abTesting.tests.retryStrategy.enabled') return Promise.resolve(true);
        return Promise.resolve(false);
      });
      
      featureFlags.getFeatureValue.mockImplementation((path, defaultValue) => {
        if (path === 'abTesting.tests.callDistribution.variants.traditional') return Promise.resolve(0.5);
        if (path === 'abTesting.tests.callDistribution.variants.loadBalanced') return Promise.resolve(0.5);
        if (path === 'abTesting.tests.retryStrategy.variants.fixed') return Promise.resolve(0.3);
        if (path === 'abTesting.tests.retryStrategy.variants.exponential') return Promise.resolve(0.7);
        return Promise.resolve(defaultValue);
      });
      
      const result = await abTestingService.initialize();
      
      expect(result).toBe(true);
      expect(abTestingService.initialized).toBe(true);
      
      // Check that tests were initialized
      expect(Object.keys(abTestingService.tests)).toHaveLength(2);
      expect(abTestingService.tests.callDistribution).toBeDefined();
      expect(abTestingService.tests.retryStrategy).toBeDefined();
      
      // Check that test results were initialized
      expect(abTestingService.testResults.callDistribution).toBeDefined();
      expect(abTestingService.testResults.retryStrategy).toBeDefined();
      
      // Check that feature flags were called
      expect(featureFlags.isFeatureEnabled).toHaveBeenCalledWith('abTesting.enabled');
      expect(featureFlags.isFeatureEnabled).toHaveBeenCalledWith('abTesting.tests.callDistribution.enabled');
      expect(featureFlags.isFeatureEnabled).toHaveBeenCalledWith('abTesting.tests.retryStrategy.enabled');
    });
    
    it('should not initialize tests when A/B testing is disabled', async () => {
      // Mock feature flags
      featureFlags.isFeatureEnabled.mockImplementation((path) => {
        if (path === 'abTesting.enabled') return Promise.resolve(false);
        return Promise.resolve(true);
      });
      
      const result = await abTestingService.initialize();
      
      expect(result).toBe(true);
      expect(abTestingService.initialized).toBe(false);
      expect(Object.keys(abTestingService.tests)).toHaveLength(0);
    });
    
    it('should handle errors during initialization', async () => {
      // Mock feature flags to throw an error
      featureFlags.isFeatureEnabled.mockRejectedValue(new Error('Test error'));
      
      const result = await abTestingService.initialize();
      
      expect(result).toBe(false);
      expect(errorService.handleError).toHaveBeenCalled();
    });
  });
  
  describe('getVariant()', () => {
    beforeEach(async () => {
      // Initialize with test data
      abTestingService.initialized = true;
      abTestingService.tests = {
        callDistribution: {
          enabled: true,
          variants: {
            traditional: 0.5,
            loadBalanced: 0.5
          },
          totalWeight: 1.0
        },
        retryStrategy: {
          enabled: true,
          variants: {
            fixed: 0.3,
            exponential: 0.7
          },
          totalWeight: 1.0
        }
      };
    });
    
    it('should return null when not initialized', () => {
      abTestingService.initialized = false;
      
      const variant = abTestingService.getVariant('callDistribution', 'test-id');
      
      expect(variant).toBeNull();
    });
    
    it('should return null when test is not enabled', () => {
      abTestingService.tests.callDistribution.enabled = false;
      
      const variant = abTestingService.getVariant('callDistribution', 'test-id');
      
      expect(variant).toBeNull();
    });
    
    it('should return null when test does not exist', () => {
      const variant = abTestingService.getVariant('nonexistentTest', 'test-id');
      
      expect(variant).toBeNull();
    });
    
    it('should return a consistent variant for the same entity ID', () => {
      const entityId = 'test-entity-id';
      
      const variant1 = abTestingService.getVariant('callDistribution', entityId);
      const variant2 = abTestingService.getVariant('callDistribution', entityId);
      
      expect(variant1).toBe(variant2);
    });
    
    it('should return different variants for different entity IDs', () => {
      // This test is probabilistic and could occasionally fail
      // We'll run it multiple times to reduce the chance of false failures
      const variants = new Set();
      
      for (let i = 0; i < 100; i++) {
        const entityId = `test-entity-id-${i}`;
        const variant = abTestingService.getVariant('callDistribution', entityId);
        variants.add(variant);
      }
      
      // We should have both variants
      expect(variants.size).toBeGreaterThan(1);
    });
    
    it('should handle missing entity ID by using random assignment', () => {
      const variant = abTestingService.getVariant('callDistribution');
      
      expect(['traditional', 'loadBalanced']).toContain(variant);
    });
  });
  
  describe('recordResult()', () => {
    beforeEach(async () => {
      // Initialize with test data
      abTestingService.initialized = true;
      abTestingService.tests = {
        callDistribution: {
          enabled: true,
          variants: {
            traditional: 0.5,
            loadBalanced: 0.5
          },
          totalWeight: 1.0
        }
      };
      
      abTestingService.testResults = {
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
        }
      };
    });
    
    it('should record a successful call result', () => {
      abTestingService.recordResult('callDistribution', 'traditional', true, { duration: 60 });
      
      const results = abTestingService.testResults.callDistribution.traditional;
      
      expect(results.calls).toBe(1);
      expect(results.successes).toBe(1);
      expect(results.failures).toBe(0);
      expect(results.totalDuration).toBe(60);
      expect(results.avgDuration).toBe(60);
    });
    
    it('should record a failed call result', () => {
      abTestingService.recordResult('callDistribution', 'traditional', false);
      
      const results = abTestingService.testResults.callDistribution.traditional;
      
      expect(results.calls).toBe(1);
      expect(results.successes).toBe(0);
      expect(results.failures).toBe(1);
      expect(results.totalDuration).toBe(0);
      expect(results.avgDuration).toBe(0);
    });
    
    it('should update average duration correctly', () => {
      // First call: 60 seconds
      abTestingService.recordResult('callDistribution', 'traditional', true, { duration: 60 });
      
      // Second call: 120 seconds
      abTestingService.recordResult('callDistribution', 'traditional', true, { duration: 120 });
      
      const results = abTestingService.testResults.callDistribution.traditional;
      
      expect(results.calls).toBe(2);
      expect(results.successes).toBe(2);
      expect(results.totalDuration).toBe(180);
      expect(results.avgDuration).toBe(90); // (60 + 120) / 2
    });
    
    it('should not record results when test is not initialized', () => {
      abTestingService.initialized = false;
      
      abTestingService.recordResult('callDistribution', 'traditional', true, { duration: 60 });
      
      const results = abTestingService.testResults.callDistribution.traditional;
      
      expect(results.calls).toBe(0);
    });
    
    it('should not record results when test is not enabled', () => {
      abTestingService.tests.callDistribution.enabled = false;
      
      abTestingService.recordResult('callDistribution', 'traditional', true, { duration: 60 });
      
      const results = abTestingService.testResults.callDistribution.traditional;
      
      expect(results.calls).toBe(0);
    });
    
    it('should not record results when variant is invalid', () => {
      abTestingService.recordResult('callDistribution', 'nonexistentVariant', true, { duration: 60 });
      
      // Should not throw an error
      expect(abTestingService.testResults.callDistribution.traditional.calls).toBe(0);
      expect(abTestingService.testResults.callDistribution.loadBalanced.calls).toBe(0);
    });
    
    it('should record retry strategy results', () => {
      // Initialize retry strategy results
      abTestingService.testResults.retryStrategy = {
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
      };
      
      abTestingService.tests.retryStrategy = {
        enabled: true,
        variants: {
          fixed: 0.3,
          exponential: 0.7
        },
        totalWeight: 1.0
      };
      
      abTestingService.recordResult('retryStrategy', 'fixed', true, { attempts: 3 });
      
      const results = abTestingService.testResults.retryStrategy.fixed;
      
      expect(results.retries).toBe(1);
      expect(results.successes).toBe(1);
      expect(results.failures).toBe(0);
      expect(results.totalAttempts).toBe(3);
      expect(results.avgAttempts).toBe(3);
    });
  });
  
  describe('getResults()', () => {
    it('should return a copy of the test results', () => {
      // Set up test results
      abTestingService.testResults = {
        callDistribution: {
          traditional: {
            calls: 10,
            successes: 8,
            failures: 2,
            avgDuration: 45,
            totalDuration: 360
          },
          loadBalanced: {
            calls: 10,
            successes: 9,
            failures: 1,
            avgDuration: 40,
            totalDuration: 360
          }
        }
      };
      
      const results = abTestingService.getResults();
      
      // Check that results match
      expect(results).toEqual(abTestingService.testResults);
      
      // Check that it's a copy, not a reference
      results.callDistribution.traditional.calls = 999;
      expect(abTestingService.testResults.callDistribution.traditional.calls).toBe(10);
    });
  });
  
  describe('getTests()', () => {
    it('should return a copy of the tests configuration', () => {
      // Set up tests
      abTestingService.tests = {
        callDistribution: {
          enabled: true,
          variants: {
            traditional: 0.5,
            loadBalanced: 0.5
          },
          totalWeight: 1.0
        }
      };
      
      const tests = abTestingService.getTests();
      
      // Check that tests match
      expect(tests).toEqual(abTestingService.tests);
      
      // Check that it's a copy, not a reference
      tests.callDistribution.enabled = false;
      expect(abTestingService.tests.callDistribution.enabled).toBe(true);
    });
  });
  
  describe('hashString()', () => {
    it('should return the same hash for the same string', () => {
      const string = 'test-string';
      
      const hash1 = abTestingService.hashString(string);
      const hash2 = abTestingService.hashString(string);
      
      expect(hash1).toBe(hash2);
    });
    
    it('should return different hashes for different strings', () => {
      const string1 = 'test-string-1';
      const string2 = 'test-string-2';
      
      const hash1 = abTestingService.hashString(string1);
      const hash2 = abTestingService.hashString(string2);
      
      expect(hash1).not.toBe(hash2);
    });
    
    it('should return a non-negative number', () => {
      const string = 'test-string';
      
      const hash = abTestingService.hashString(string);
      
      expect(hash).toBeGreaterThanOrEqual(0);
    });
  });
});