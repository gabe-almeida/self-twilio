// Test script for the lock service
const lockService = require('../services/lock-service');
const featureFlags = require('../services/feature-flags');

// Enable concurrency control for testing
async function enableConcurrencyControl() {
  await featureFlags.enableFeature('concurrency.enabled');
  console.log('Concurrency control enabled for testing');
}

// Test acquiring and releasing a lock
async function testBasicLockAcquireRelease() {
  console.log('\n=== Testing Basic Lock Acquire/Release ===');
  
  // Initialize the lock service
  await lockService.initialize();
  
  // Acquire a lock
  const lockResult = await lockService.acquireLock(
    lockService.LockTypes.QUEUE_PROCESSING,
    'test-resource',
    'test-owner'
  );
  
  console.log('Lock acquisition result:', lockResult);
  
  if (!lockResult.success) {
    console.error('Failed to acquire lock');
    return false;
  }
  
  // Check if the resource is locked
  const lockStatus = await lockService.isLocked(
    lockService.LockTypes.QUEUE_PROCESSING,
    'test-resource'
  );
  
  console.log('Lock status:', lockStatus);
  
  if (!lockStatus.locked) {
    console.error('Resource should be locked but is not');
    return false;
  }
  
  // Release the lock
  const releaseResult = await lockService.releaseLock(
    lockService.LockTypes.QUEUE_PROCESSING,
    'test-resource',
    'test-owner'
  );
  
  console.log('Lock release result:', releaseResult);
  
  if (!releaseResult.success) {
    console.error('Failed to release lock');
    return false;
  }
  
  // Check if the resource is still locked
  const lockStatusAfterRelease = await lockService.isLocked(
    lockService.LockTypes.QUEUE_PROCESSING,
    'test-resource'
  );
  
  console.log('Lock status after release:', lockStatusAfterRelease);
  
  if (lockStatusAfterRelease.locked) {
    console.error('Resource should not be locked after release');
    return false;
  }
  
  console.log('Basic lock acquire/release test passed');
  return true;
}

// Test lock contention
async function testLockContention() {
  console.log('\n=== Testing Lock Contention ===');
  
  // Acquire a lock with the first owner
  const lockResult1 = await lockService.acquireLock(
    lockService.LockTypes.QUEUE_PROCESSING,
    'contention-resource',
    'owner-1'
  );
  
  console.log('First lock acquisition result:', lockResult1);
  
  if (!lockResult1.success) {
    console.error('Failed to acquire first lock');
    return false;
  }
  
  // Try to acquire the same lock with a different owner
  const lockResult2 = await lockService.acquireLock(
    lockService.LockTypes.QUEUE_PROCESSING,
    'contention-resource',
    'owner-2',
    { maxRetries: 0 } // Don't retry, just fail immediately
  );
  
  console.log('Second lock acquisition result:', lockResult2);
  
  if (lockResult2.success) {
    console.error('Second lock should have failed but succeeded');
    return false;
  }
  
  // Release the first lock
  const releaseResult = await lockService.releaseLock(
    lockService.LockTypes.QUEUE_PROCESSING,
    'contention-resource',
    'owner-1'
  );
  
  console.log('Lock release result:', releaseResult);
  
  // Now try to acquire the lock with the second owner again
  const lockResult3 = await lockService.acquireLock(
    lockService.LockTypes.QUEUE_PROCESSING,
    'contention-resource',
    'owner-2'
  );
  
  console.log('Third lock acquisition result:', lockResult3);
  
  if (!lockResult3.success) {
    console.error('Third lock should have succeeded but failed');
    return false;
  }
  
  // Release the second lock
  await lockService.releaseLock(
    lockService.LockTypes.QUEUE_PROCESSING,
    'contention-resource',
    'owner-2'
  );
  
  console.log('Lock contention test passed');
  return true;
}

// Test lock timeout
async function testLockTimeout() {
  console.log('\n=== Testing Lock Timeout ===');
  
  // Acquire a lock with a short timeout
  const lockResult = await lockService.acquireLock(
    lockService.LockTypes.QUEUE_PROCESSING,
    'timeout-resource',
    'timeout-owner',
    { timeout: 1000, autoRelease: false } // 1 second timeout, no auto-release
  );
  
  console.log('Lock acquisition result:', lockResult);
  
  if (!lockResult.success) {
    console.error('Failed to acquire lock');
    return false;
  }
  
  // Check if the resource is locked
  const lockStatus = await lockService.isLocked(
    lockService.LockTypes.QUEUE_PROCESSING,
    'timeout-resource'
  );
  
  console.log('Lock status immediately after acquisition:', lockStatus);
  
  // Wait for the lock to expire
  console.log('Waiting for lock to expire...');
  await new Promise(resolve => setTimeout(resolve, 1500)); // Wait 1.5 seconds
  
  // Check if the resource is still locked
  const lockStatusAfterTimeout = await lockService.isLocked(
    lockService.LockTypes.QUEUE_PROCESSING,
    'timeout-resource'
  );
  
  console.log('Lock status after timeout:', lockStatusAfterTimeout);
  
  if (lockStatusAfterTimeout.locked) {
    console.error('Resource should not be locked after timeout');
    return false;
  }
  
  console.log('Lock timeout test passed');
  return true;
}

// Test auto-release
async function testAutoRelease() {
  console.log('\n=== Testing Auto-Release ===');
  
  // Acquire a lock with auto-release
  const lockResult = await lockService.acquireLock(
    lockService.LockTypes.QUEUE_PROCESSING,
    'auto-release-resource',
    'auto-release-owner',
    { timeout: 1000, autoRelease: true } // 1 second timeout with auto-release
  );
  
  console.log('Lock acquisition result:', lockResult);
  
  if (!lockResult.success) {
    console.error('Failed to acquire lock');
    return false;
  }
  
  // Check if the resource is locked
  const lockStatus = await lockService.isLocked(
    lockService.LockTypes.QUEUE_PROCESSING,
    'auto-release-resource'
  );
  
  console.log('Lock status immediately after acquisition:', lockStatus);
  
  // Wait for the lock to auto-release
  console.log('Waiting for lock to auto-release...');
  await new Promise(resolve => setTimeout(resolve, 1500)); // Wait 1.5 seconds
  
  // Check if the resource is still locked
  const lockStatusAfterAutoRelease = await lockService.isLocked(
    lockService.LockTypes.QUEUE_PROCESSING,
    'auto-release-resource'
  );
  
  console.log('Lock status after auto-release:', lockStatusAfterAutoRelease);
  
  if (lockStatusAfterAutoRelease.locked) {
    console.error('Resource should not be locked after auto-release');
    return false;
  }
  
  console.log('Auto-release test passed');
  return true;
}

// Test getting all locks
async function testGetAllLocks() {
  console.log('\n=== Testing Get All Locks ===');
  
  // Acquire multiple locks
  const lockResult1 = await lockService.acquireLock(
    lockService.LockTypes.QUEUE_PROCESSING,
    'resource-1',
    'owner-1'
  );
  
  const lockResult2 = await lockService.acquireLock(
    lockService.LockTypes.CALL_ASSIGNMENT,
    'resource-2',
    'owner-2'
  );
  
  const lockResult3 = await lockService.acquireLock(
    lockService.LockTypes.AGENT_STATUS_UPDATE,
    'resource-3',
    'owner-3'
  );
  
  // Get all locks
  const allLocksResult = await lockService.getAllLocks();
  
  console.log('All locks result:', allLocksResult);
  
  if (!allLocksResult.success) {
    console.error('Failed to get all locks');
    return false;
  }
  
  if (allLocksResult.locks.length < 3) {
    console.error(`Expected at least 3 locks, but got ${allLocksResult.locks.length}`);
    return false;
  }
  
  // Release all locks
  await lockService.releaseLock(lockService.LockTypes.QUEUE_PROCESSING, 'resource-1', 'owner-1');
  await lockService.releaseLock(lockService.LockTypes.CALL_ASSIGNMENT, 'resource-2', 'owner-2');
  await lockService.releaseLock(lockService.LockTypes.AGENT_STATUS_UPDATE, 'resource-3', 'owner-3');
  
  console.log('Get all locks test passed');
  return true;
}

// Run all tests
async function runTests() {
  try {
    // Enable concurrency control
    await enableConcurrencyControl();
    
    // Run tests
    const basicTestResult = await testBasicLockAcquireRelease();
    const contentionTestResult = await testLockContention();
    const timeoutTestResult = await testLockTimeout();
    const autoReleaseTestResult = await testAutoRelease();
    const getAllLocksTestResult = await testGetAllLocks();
    
    // Print summary
    console.log('\n=== Test Summary ===');
    console.log(`Basic Lock Acquire/Release: ${basicTestResult ? 'PASSED' : 'FAILED'}`);
    console.log(`Lock Contention: ${contentionTestResult ? 'PASSED' : 'FAILED'}`);
    console.log(`Lock Timeout: ${timeoutTestResult ? 'PASSED' : 'FAILED'}`);
    console.log(`Auto-Release: ${autoReleaseTestResult ? 'PASSED' : 'FAILED'}`);
    console.log(`Get All Locks: ${getAllLocksTestResult ? 'PASSED' : 'FAILED'}`);
    
    const allPassed = basicTestResult && contentionTestResult && timeoutTestResult && 
                      autoReleaseTestResult && getAllLocksTestResult;
    
    console.log(`\nOverall Result: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
    
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('Error running tests:', error);
    process.exit(1);
  }
}

// Run the tests
runTests();