// Test script for the scheduler service
const schedulerService = require('../services/scheduler-service');
const store = require('../memory-store');
const featureFlags = require('../services/feature-flags');

// Enable scheduled calls for testing
async function enableScheduledCalls() {
  await featureFlags.enableFeature('scheduledCalls.enabled');
  console.log('Scheduled calls enabled for testing');
}

// Test basic scheduling functionality
async function testBasicScheduling() {
  console.log('\n=== Testing Basic Scheduling ===');
  
  // Initialize the scheduler service
  await schedulerService.initialize(async (callIds) => {
    console.log(`Processing ${callIds.length} scheduled calls`);
    
    for (const callId of callIds) {
      console.log(`Processing scheduled call ${callId}`);
    }
  });
  
  // Create a test call scheduled for 5 seconds from now
  const scheduledTime = new Date(Date.now() + 5000);
  
  // Add the call to the database
  const call = {
    phone_number: '+19785551234',
    contact_name: 'Test User',
    notes: 'Test scheduled call',
    priority: 2,
    status: 'Queued',
    scheduled_for: scheduledTime
  };
  
  const result = await store.callQueue.add(call);
  console.log(`Added call to queue with ID: ${result.id}`);
  
  // Schedule the call
  const scheduleResult = await schedulerService.scheduleCall({
    ...call,
    id: result.id
  });
  
  console.log('Schedule result:', scheduleResult);
  
  if (!scheduleResult.success) {
    console.error('Failed to schedule call');
    return false;
  }
  
  console.log(`Call scheduled for ${scheduleResult.scheduled_call.scheduled_for}`);
  console.log('Waiting for call to be processed...');
  
  // Wait for the call to be processed
  await new Promise(resolve => setTimeout(resolve, 7000));
  
  console.log('Basic scheduling test completed');
  return true;
}

// Test batch processing
async function testBatchProcessing() {
  console.log('\n=== Testing Batch Processing ===');
  
  // Create multiple test calls scheduled for the same time
  const scheduledTime = new Date(Date.now() + 5000);
  const calls = [];
  
  // Add 5 calls to the database
  for (let i = 0; i < 5; i++) {
    const call = {
      phone_number: `+1978555${1000 + i}`,
      contact_name: `Test User ${i + 1}`,
      notes: `Test scheduled call ${i + 1}`,
      priority: 5 - i, // Higher priority for lower index
      status: 'Queued',
      scheduled_for: scheduledTime
    };
    
    const result = await store.callQueue.add(call);
    console.log(`Added call ${i + 1} to queue with ID: ${result.id}`);
    
    // Schedule the call
    const scheduleResult = await schedulerService.scheduleCall({
      ...call,
      id: result.id
    });
    
    if (scheduleResult.success) {
      calls.push({
        id: result.id,
        priority: call.priority
      });
    }
  }
  
  console.log(`Scheduled ${calls.length} calls for ${scheduledTime}`);
  console.log('Waiting for calls to be processed...');
  
  // Wait for the calls to be processed
  await new Promise(resolve => setTimeout(resolve, 7000));
  
  console.log('Batch processing test completed');
  return true;
}

// Test rescheduling
async function testRescheduling() {
  console.log('\n=== Testing Rescheduling ===');
  
  // Create a test call scheduled for 10 seconds from now
  const initialScheduledTime = new Date(Date.now() + 10000);
  
  // Add the call to the database
  const call = {
    phone_number: '+19785559999',
    contact_name: 'Reschedule Test User',
    notes: 'Test rescheduling',
    priority: 3,
    status: 'Queued',
    scheduled_for: initialScheduledTime
  };
  
  const result = await store.callQueue.add(call);
  console.log(`Added call to queue with ID: ${result.id}`);
  
  // Schedule the call
  const scheduleResult = await schedulerService.scheduleCall({
    ...call,
    id: result.id
  });
  
  console.log(`Call scheduled for ${scheduleResult.scheduled_call.scheduled_for}`);
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Reschedule the call for 3 seconds from now
  const newScheduledTime = new Date(Date.now() + 3000);
  
  console.log(`Rescheduling call ${result.id} from ${initialScheduledTime} to ${newScheduledTime}`);
  
  const rescheduleResult = await schedulerService.rescheduleCall(
    result.id,
    newScheduledTime,
    4 // Increase priority
  );
  
  console.log('Reschedule result:', rescheduleResult);
  
  if (!rescheduleResult.success) {
    console.error('Failed to reschedule call');
    return false;
  }
  
  console.log(`Call rescheduled for ${rescheduleResult.scheduled_call.scheduled_for}`);
  console.log('Waiting for call to be processed...');
  
  // Wait for the call to be processed
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('Rescheduling test completed');
  return true;
}

// Test cancellation
async function testCancellation() {
  console.log('\n=== Testing Cancellation ===');
  
  // Create a test call scheduled for 10 seconds from now
  const scheduledTime = new Date(Date.now() + 10000);
  
  // Add the call to the database
  const call = {
    phone_number: '+19785558888',
    contact_name: 'Cancellation Test User',
    notes: 'Test cancellation',
    priority: 2,
    status: 'Queued',
    scheduled_for: scheduledTime
  };
  
  const result = await store.callQueue.add(call);
  console.log(`Added call to queue with ID: ${result.id}`);
  
  // Schedule the call
  const scheduleResult = await schedulerService.scheduleCall({
    ...call,
    id: result.id
  });
  
  console.log(`Call scheduled for ${scheduleResult.scheduled_call.scheduled_for}`);
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Cancel the call
  console.log(`Cancelling call ${result.id}`);
  
  const cancelResult = await schedulerService.cancelScheduledCall(result.id);
  
  console.log('Cancel result:', cancelResult);
  
  if (!cancelResult.success) {
    console.error('Failed to cancel call');
    return false;
  }
  
  console.log(`Call ${result.id} cancelled`);
  
  // Wait to ensure the call is not processed
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  console.log('Cancellation test completed');
  return true;
}

// Test schedule density
async function testScheduleDensity() {
  console.log('\n=== Testing Schedule Density ===');
  
  // Create multiple test calls scheduled at different times
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 minutes from now
  
  // Add 10 calls to the database at different times
  for (let i = 0; i < 10; i++) {
    const minutesFromNow = 5 + i * 2; // 5, 7, 9, 11, ... minutes from now
    const scheduledTime = new Date(Date.now() + minutesFromNow * 60 * 1000);
    
    const call = {
      phone_number: `+1978555${2000 + i}`,
      contact_name: `Density Test User ${i + 1}`,
      notes: `Test schedule density ${i + 1}`,
      priority: 3,
      status: 'Queued',
      scheduled_for: scheduledTime
    };
    
    const result = await store.callQueue.add(call);
    console.log(`Added call ${i + 1} to queue with ID: ${result.id} scheduled for ${scheduledTime}`);
    
    // Schedule the call
    await schedulerService.scheduleCall({
      ...call,
      id: result.id
    });
  }
  
  // Get the schedule density
  const densityResult = await schedulerService.getScheduleDensity(
    startTime,
    endTime,
    5 // 5-minute intervals
  );
  
  console.log('Schedule density result:', densityResult);
  
  if (!densityResult.success) {
    console.error('Failed to get schedule density');
    return false;
  }
  
  // Print the density
  console.log('Schedule density:');
  for (const interval of densityResult.density) {
    console.log(`${interval.start} - ${interval.end}: ${interval.count} calls`);
  }
  
  console.log('Schedule density test completed');
  return true;
}

// Test schedule optimization
async function testScheduleOptimization() {
  console.log('\n=== Testing Schedule Optimization ===');
  
  // Create a high-density interval
  const highDensityTime = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now
  
  // Add 10 calls to the database at the same time
  for (let i = 0; i < 10; i++) {
    const call = {
      phone_number: `+1978555${3000 + i}`,
      contact_name: `Optimization Test User ${i + 1}`,
      notes: `Test schedule optimization ${i + 1}`,
      priority: i + 1, // Different priorities
      status: 'Queued',
      scheduled_for: highDensityTime
    };
    
    const result = await store.callQueue.add(call);
    console.log(`Added call ${i + 1} to queue with ID: ${result.id} scheduled for ${highDensityTime}`);
    
    // Schedule the call
    await schedulerService.scheduleCall({
      ...call,
      id: result.id
    });
  }
  
  // Get the schedule density before optimization
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 minutes from now
  
  const beforeDensity = await schedulerService.getScheduleDensity(
    startTime,
    endTime,
    5 // 5-minute intervals
  );
  
  console.log('Schedule density before optimization:');
  for (const interval of beforeDensity.density) {
    console.log(`${interval.start} - ${interval.end}: ${interval.count} calls`);
  }
  
  // Optimize the schedule
  const optimizationResult = await schedulerService.optimizeSchedule(
    startTime,
    endTime
  );
  
  console.log('Optimization result:', optimizationResult);
  
  if (!optimizationResult.success) {
    console.error('Failed to optimize schedule');
    return false;
  }
  
  // Get the schedule density after optimization
  const afterDensity = await schedulerService.getScheduleDensity(
    startTime,
    endTime,
    5 // 5-minute intervals
  );
  
  console.log('Schedule density after optimization:');
  for (const interval of afterDensity.density) {
    console.log(`${interval.start} - ${interval.end}: ${interval.count} calls`);
  }
  
  console.log('Schedule optimization test completed');
  return true;
}

// Run all tests
async function runTests() {
  try {
    // Enable scheduled calls
    await enableScheduledCalls();
    
    // Run tests
    const basicTestResult = await testBasicScheduling();
    const batchTestResult = await testBatchProcessing();
    const rescheduleTestResult = await testRescheduling();
    const cancellationTestResult = await testCancellation();
    const densityTestResult = await testScheduleDensity();
    const optimizationTestResult = await testScheduleOptimization();
    
    // Print summary
    console.log('\n=== Test Summary ===');
    console.log(`Basic Scheduling: ${basicTestResult ? 'PASSED' : 'FAILED'}`);
    console.log(`Batch Processing: ${batchTestResult ? 'PASSED' : 'FAILED'}`);
    console.log(`Rescheduling: ${rescheduleTestResult ? 'PASSED' : 'FAILED'}`);
    console.log(`Cancellation: ${cancellationTestResult ? 'PASSED' : 'FAILED'}`);
    console.log(`Schedule Density: ${densityTestResult ? 'PASSED' : 'FAILED'}`);
    console.log(`Schedule Optimization: ${optimizationTestResult ? 'PASSED' : 'FAILED'}`);
    
    const allPassed = basicTestResult && batchTestResult && rescheduleTestResult && 
                      cancellationTestResult && densityTestResult && optimizationTestResult;
    
    console.log(`\nOverall Result: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
    
    // Stop the scheduler service
    schedulerService.stop();
    
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('Error running tests:', error);
    process.exit(1);
  }
}

// Run the tests
runTests();