// Scheduler Service for Twilio Dialer Web App
/**
 * This service provides a more precise scheduling mechanism for outbound calls.
 * It replaces the fixed interval queue processing with a dynamic approach that:
 * 1. Uses a priority queue sorted by scheduled time
 * 2. Wakes up at the exact time calls need to be made
 * 3. Optimizes scheduling based on call density and agent availability
 */

const store = require('../memory-store');
const errorService = require('./error-service');
const featureFlags = require('./feature-flags');
const lockService = require('./lock-service');

// In-memory storage for scheduled calls
class ScheduledCallQueue {
  constructor() {
    this.queue = [];
    this.timers = new Map(); // Map of call IDs to their scheduled timers
    this.instanceId = `scheduler-${Date.now()}`; // Unique ID for this instance
  }

  /**
   * Add a call to the scheduled queue
   * @param {Object} call - The call to schedule
   * @returns {Object} - The scheduled call
   */
  add(call) {
    // Ensure the call has a scheduled_for time
    if (!call.scheduled_for) {
      throw new Error('Call must have a scheduled_for time');
    }

    // Convert scheduled_for to a Date object if it's a string
    const scheduledTime = typeof call.scheduled_for === 'string' 
      ? new Date(call.scheduled_for) 
      : call.scheduled_for;

    // Create a scheduled call object
    const scheduledCall = {
      id: call.id,
      scheduled_for: scheduledTime,
      priority: call.priority || 1,
      added_at: new Date()
    };

    // Add to the queue
    this.queue.push(scheduledCall);

    // Sort the queue by scheduled time and priority
    this.sortQueue();

    return scheduledCall;
  }

  /**
   * Remove a call from the scheduled queue
   * @param {number} callId - The ID of the call to remove
   * @returns {boolean} - Whether the call was removed
   */
  remove(callId) {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(call => call.id !== callId);
    
    // Clear any scheduled timer for this call
    if (this.timers.has(callId)) {
      clearTimeout(this.timers.get(callId));
      this.timers.delete(callId);
    }
    
    return initialLength !== this.queue.length;
  }

  /**
   * Get all scheduled calls
   * @returns {Array} - All scheduled calls
   */
  getAll() {
    return [...this.queue];
  }

  /**
   * Get calls that are due to be processed
   * @param {Date} now - The current time (defaults to now)
   * @returns {Array} - Calls that are due
   */
  getDueCalls(now = new Date()) {
    return this.queue.filter(call => call.scheduled_for <= now);
  }

  /**
   * Get the next scheduled call
   * @returns {Object|null} - The next scheduled call or null if none
   */
  getNextCall() {
    return this.queue.length > 0 ? this.queue[0] : null;
  }

  /**
   * Get the time until the next scheduled call
   * @param {Date} now - The current time (defaults to now)
   * @returns {number} - Milliseconds until the next call or -1 if none
   */
  getTimeUntilNextCall(now = new Date()) {
    const nextCall = this.getNextCall();
    if (!nextCall) {
      return -1;
    }
    
    const timeUntil = nextCall.scheduled_for - now;
    return Math.max(0, timeUntil); // Ensure we don't return negative time
  }

  /**
   * Sort the queue by scheduled time and priority
   */
  sortQueue() {
    this.queue.sort((a, b) => {
      // First sort by scheduled time
      const timeA = a.scheduled_for.getTime();
      const timeB = b.scheduled_for.getTime();
      
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      
      // If scheduled for the same time, sort by priority (higher first)
      return b.priority - a.priority;
    });
  }

  /**
   * Clear all scheduled timers
   */
  clearAllTimers() {
    for (const timerId of this.timers.values()) {
      clearTimeout(timerId);
    }
    this.timers.clear();
  }
}

class SchedulerService {
  constructor() {
    this.scheduledCalls = new ScheduledCallQueue();
    this.isRunning = false;
    this.nextScheduledTimer = null;
    this.processingCallback = null;
    this.batchSize = 10; // Default batch size for processing calls
    this.batchTimeWindow = 60000; // Default time window for batching calls (1 minute)
  }

  /**
   * Initialize the scheduler service
   * @param {Function} processingCallback - Callback function to process due calls
   * @returns {Promise<boolean>} - Whether initialization was successful
   */
  async initialize(processingCallback) {
    try {
      // Store the processing callback
      this.processingCallback = processingCallback;
      
      // Load configuration from feature flags
      await this.loadConfiguration();
      
      // Load existing scheduled calls from the database
      await this.loadScheduledCalls();
      
      // Start the scheduler
      this.start();
      
      console.log('Scheduler service initialized');
      return true;
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'scheduler-service.initialize');
      console.error('Error initializing scheduler service:', errorInfo);
      return false;
    }
  }

  /**
   * Load configuration from feature flags
   * @returns {Promise<void>}
   */
  async loadConfiguration() {
    // Load batch size from feature flags
    this.batchSize = await featureFlags.getFeatureValue('scheduledCalls.batchSize', 10);
    
    // Load batch time window from feature flags
    this.batchTimeWindow = await featureFlags.getFeatureValue('scheduledCalls.batchTimeWindow', 60000);
    
    console.log(`Scheduler configured with batch size ${this.batchSize} and time window ${this.batchTimeWindow}ms`);
  }

  /**
   * Load existing scheduled calls from the database
   * @returns {Promise<void>}
   */
  async loadScheduledCalls() {
    try {
      // Get all queued calls from the database
      const queuedCalls = await store.callQueue.getAll();
      
      // Filter for calls that have a scheduled_for time
      const scheduledCalls = queuedCalls.filter(call => 
        call.status === 'Queued' && call.scheduled_for
      );
      
      console.log(`Loading ${scheduledCalls.length} scheduled calls from database`);
      
      // Add each call to the scheduled queue
      for (const call of scheduledCalls) {
        this.scheduledCalls.add(call);
      }
      
      console.log(`Loaded ${this.scheduledCalls.getAll().length} scheduled calls`);
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'scheduler-service.loadScheduledCalls');
      console.error('Error loading scheduled calls:', errorInfo);
    }
  }

  /**
   * Start the scheduler
   * @returns {void}
   */
  start() {
    if (this.isRunning) {
      return;
    }
    
    this.isRunning = true;
    console.log('Starting scheduler service');
    
    // Schedule the next call
    this.scheduleNextCall();
  }

  /**
   * Stop the scheduler
   * @returns {void}
   */
  stop() {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    console.log('Stopping scheduler service');
    
    // Clear the next scheduled timer
    if (this.nextScheduledTimer) {
      clearTimeout(this.nextScheduledTimer);
      this.nextScheduledTimer = null;
    }
    
    // Clear all individual call timers
    this.scheduledCalls.clearAllTimers();
  }

  /**
   * Schedule the next call
   * @returns {void}
   */
  scheduleNextCall() {
    // Clear any existing timer
    if (this.nextScheduledTimer) {
      clearTimeout(this.nextScheduledTimer);
      this.nextScheduledTimer = null;
    }
    
    // If not running, don't schedule anything
    if (!this.isRunning) {
      return;
    }
    
    // Get the time until the next call
    const now = new Date();
    const timeUntilNext = this.scheduledCalls.getTimeUntilNextCall(now);
    
    // If there are no scheduled calls, check again in 1 minute
    if (timeUntilNext < 0) {
      this.nextScheduledTimer = setTimeout(() => this.scheduleNextCall(), 60000);
      return;
    }
    
    // If there are calls due now, process them immediately
    if (timeUntilNext === 0) {
      this.processScheduledCalls();
      return;
    }
    
    // Schedule the next call
    console.log(`Next call scheduled in ${timeUntilNext}ms`);
    this.nextScheduledTimer = setTimeout(() => this.processScheduledCalls(), timeUntilNext);
  }

  /**
   * Process scheduled calls that are due
   * @returns {Promise<void>}
   */
  async processScheduledCalls() {
    // If not running, don't process anything
    if (!this.isRunning) {
      return;
    }
    
    try {
      // Check if concurrency control is enabled
      const concurrencyEnabled = await featureFlags.isFeatureEnabled('concurrency.enabled');
      
      // Use lock service if concurrency control is enabled
      if (concurrencyEnabled) {
        // Try to acquire a lock for scheduled call processing
        const lockResult = await lockService.acquireLock(
          lockService.LockTypes.QUEUE_PROCESSING,
          'scheduled-calls',
          this.scheduledCalls.instanceId
        );
        
        // If we couldn't acquire the lock, try again later
        if (!lockResult.success) {
          console.log(`Scheduled call processing already in progress: ${lockResult.error}`);
          this.scheduleNextCall();
          return;
        }
        
        try {
          // Process the calls with the lock
          await this._processScheduledCallsWithLock();
        } finally {
          // Always release the lock when done
          await lockService.releaseLock(
            lockService.LockTypes.QUEUE_PROCESSING,
            'scheduled-calls',
            this.scheduledCalls.instanceId
          );
        }
      } else {
        // Fall back to processing without a lock
        await this._processScheduledCallsWithLock();
      }
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'scheduler-service.processScheduledCalls');
      console.error('Error processing scheduled calls:', errorInfo);
    } finally {
      // Schedule the next call
      this.scheduleNextCall();
    }
  }

  /**
   * Process scheduled calls with a lock
   * @returns {Promise<void>}
   */
  async _processScheduledCallsWithLock() {
    const now = new Date();
    
    // Get calls that are due
    const dueCalls = this.scheduledCalls.getDueCalls(now);
    
    if (dueCalls.length === 0) {
      console.log('No scheduled calls due for processing');
      return;
    }
    
    console.log(`Processing ${dueCalls.length} scheduled calls`);
    
    // Get calls that are due within the batch time window
    const batchEndTime = new Date(now.getTime() + this.batchTimeWindow);
    const batchCalls = this.scheduledCalls.getAll().filter(call => 
      call.scheduled_for <= batchEndTime
    );
    
    // Limit to batch size
    const callsToProcess = batchCalls.slice(0, this.batchSize);
    
    console.log(`Processing batch of ${callsToProcess.length} calls (${dueCalls.length} due now, ${batchCalls.length} due within ${this.batchTimeWindow}ms)`);
    
    // Remove the calls from the scheduled queue
    for (const call of callsToProcess) {
      this.scheduledCalls.remove(call.id);
    }
    
    // Get the call IDs to process
    const callIds = callsToProcess.map(call => call.id);
    
    // Call the processing callback with the call IDs
    if (this.processingCallback) {
      await this.processingCallback(callIds);
    }
  }

  /**
   * Schedule a call
   * @param {Object} call - The call to schedule
   * @returns {Promise<Object>} - The scheduled call
   */
  async scheduleCall(call) {
    try {
      // Add the call to the scheduled queue
      const scheduledCall = this.scheduledCalls.add(call);
      
      console.log(`Scheduled call ${call.id} for ${scheduledCall.scheduled_for}`);
      
      // If this is the next call to be processed, reschedule
      const nextCall = this.scheduledCalls.getNextCall();
      if (nextCall && nextCall.id === call.id) {
        this.scheduleNextCall();
      }
      
      return {
        success: true,
        scheduled_call: scheduledCall
      };
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'scheduler-service.scheduleCall');
      console.error(`Error scheduling call ${call.id}:`, errorInfo);
      
      return {
        success: false,
        error: errorInfo.message
      };
    }
  }

  /**
   * Cancel a scheduled call
   * @param {number} callId - The ID of the call to cancel
   * @returns {Promise<Object>} - The result of the cancellation
   */
  async cancelScheduledCall(callId) {
    try {
      // Remove the call from the scheduled queue
      const removed = this.scheduledCalls.remove(callId);
      
      if (removed) {
        console.log(`Cancelled scheduled call ${callId}`);
      } else {
        console.log(`Call ${callId} was not found in the scheduled queue`);
      }
      
      return {
        success: true,
        removed
      };
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'scheduler-service.cancelScheduledCall');
      console.error(`Error cancelling scheduled call ${callId}:`, errorInfo);
      
      return {
        success: false,
        error: errorInfo.message
      };
    }
  }

  /**
   * Reschedule a call
   * @param {number} callId - The ID of the call to reschedule
   * @param {Date|string} scheduledFor - The new scheduled time
   * @param {number} priority - The new priority (optional)
   * @returns {Promise<Object>} - The result of the rescheduling
   */
  async rescheduleCall(callId, scheduledFor, priority) {
    try {
      // Get the call from the database
      const call = await store.callQueue.getById(callId);
      
      if (!call) {
        return {
          success: false,
          error: `Call ${callId} not found`
        };
      }
      
      // Remove the call from the scheduled queue if it's already there
      this.scheduledCalls.remove(callId);
      
      // Update the call with the new scheduled time and priority
      const updatedCall = {
        ...call,
        scheduled_for: scheduledFor,
        priority: priority !== undefined ? priority : call.priority
      };
      
      // Add the call back to the scheduled queue
      const scheduledCall = this.scheduledCalls.add(updatedCall);
      
      console.log(`Rescheduled call ${callId} for ${scheduledCall.scheduled_for}`);
      
      // If this is the next call to be processed, reschedule
      const nextCall = this.scheduledCalls.getNextCall();
      if (nextCall && nextCall.id === callId) {
        this.scheduleNextCall();
      }
      
      return {
        success: true,
        scheduled_call: scheduledCall
      };
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'scheduler-service.rescheduleCall');
      console.error(`Error rescheduling call ${callId}:`, errorInfo);
      
      return {
        success: false,
        error: errorInfo.message
      };
    }
  }

  /**
   * Get all scheduled calls
   * @returns {Promise<Array>} - All scheduled calls
   */
  async getAllScheduledCalls() {
    try {
      return {
        success: true,
        calls: this.scheduledCalls.getAll()
      };
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'scheduler-service.getAllScheduledCalls');
      console.error('Error getting scheduled calls:', errorInfo);
      
      return {
        success: false,
        error: errorInfo.message
      };
    }
  }

  /**
   * Get scheduled calls for a specific time range
   * @param {Date|string} startTime - The start time
   * @param {Date|string} endTime - The end time
   * @returns {Promise<Array>} - Scheduled calls in the time range
   */
  async getScheduledCallsInRange(startTime, endTime) {
    try {
      // Convert to Date objects if strings
      const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
      const end = typeof endTime === 'string' ? new Date(endTime) : endTime;
      
      // Get calls in the time range
      const calls = this.scheduledCalls.getAll().filter(call => 
        call.scheduled_for >= start && call.scheduled_for <= end
      );
      
      return {
        success: true,
        calls
      };
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'scheduler-service.getScheduledCallsInRange');
      console.error('Error getting scheduled calls in range:', errorInfo);
      
      return {
        success: false,
        error: errorInfo.message
      };
    }
  }

  /**
   * Get the schedule density for a specific time range
   * @param {Date|string} startTime - The start time
   * @param {Date|string} endTime - The end time
   * @param {number} intervalMinutes - The interval in minutes (default: 15)
   * @returns {Promise<Object>} - Schedule density data
   */
  async getScheduleDensity(startTime, endTime, intervalMinutes = 15) {
    try {
      // Convert to Date objects if strings
      const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
      const end = typeof endTime === 'string' ? new Date(endTime) : endTime;
      
      // Calculate the interval in milliseconds
      const intervalMs = intervalMinutes * 60 * 1000;
      
      // Initialize the density data
      const density = [];
      
      // Calculate the number of intervals
      const intervals = Math.ceil((end - start) / intervalMs);
      
      // Get all scheduled calls
      const allCalls = this.scheduledCalls.getAll();
      
      // Calculate the density for each interval
      for (let i = 0; i < intervals; i++) {
        const intervalStart = new Date(start.getTime() + i * intervalMs);
        const intervalEnd = new Date(intervalStart.getTime() + intervalMs);
        
        // Count calls in this interval
        const callsInInterval = allCalls.filter(call => 
          call.scheduled_for >= intervalStart && call.scheduled_for < intervalEnd
        );
        
        density.push({
          start: intervalStart,
          end: intervalEnd,
          count: callsInInterval.length,
          calls: callsInInterval.map(call => call.id)
        });
      }
      
      return {
        success: true,
        density
      };
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'scheduler-service.getScheduleDensity');
      console.error('Error getting schedule density:', errorInfo);
      
      return {
        success: false,
        error: errorInfo.message
      };
    }
  }

  /**
   * Optimize the schedule based on call density and agent availability
   * @param {Date|string} startTime - The start time
   * @param {Date|string} endTime - The end time
   * @returns {Promise<Object>} - Optimization result
   */
  async optimizeSchedule(startTime, endTime) {
    try {
      // Convert to Date objects if strings
      const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
      const end = typeof endTime === 'string' ? new Date(endTime) : endTime;
      
      // Get the schedule density
      const densityResult = await this.getScheduleDensity(start, end, 15);
      
      if (!densityResult.success) {
        return densityResult;
      }
      
      const { density } = densityResult;
      
      // Find intervals with high call density
      const highDensityIntervals = density.filter(interval => interval.count > 5);
      
      if (highDensityIntervals.length === 0) {
        return {
          success: true,
          message: 'No high-density intervals found, schedule is already optimized',
          changes: 0
        };
      }
      
      // Find intervals with low call density
      const lowDensityIntervals = density.filter(interval => interval.count < 2);
      
      if (lowDensityIntervals.length === 0) {
        return {
          success: true,
          message: 'No low-density intervals found for redistribution',
          changes: 0
        };
      }
      
      // Redistribute calls from high-density to low-density intervals
      let changes = 0;
      
      for (const highInterval of highDensityIntervals) {
        // Calculate how many calls to move
        const excessCalls = Math.floor((highInterval.count - 5) / 2);
        
        if (excessCalls <= 0) {
          continue;
        }
        
        // Get the calls to move (prioritize lower priority calls)
        const callsToMove = await this.getCallsToMove(highInterval.calls, excessCalls);
        
        // Distribute calls to low-density intervals
        for (let i = 0; i < callsToMove.length && i < lowDensityIntervals.length; i++) {
          const call = callsToMove[i];
          const targetInterval = lowDensityIntervals[i];
          
          // Calculate a random time within the target interval
          const randomOffset = Math.random() * (targetInterval.end - targetInterval.start);
          const newScheduledTime = new Date(targetInterval.start.getTime() + randomOffset);
          
          // Reschedule the call
          await this.rescheduleCall(call.id, newScheduledTime, call.priority);
          changes++;
        }
      }
      
      return {
        success: true,
        message: `Optimized schedule by redistributing ${changes} calls`,
        changes
      };
    } catch (error) {
      const errorInfo = await errorService.handleError(error, 'scheduler-service.optimizeSchedule');
      console.error('Error optimizing schedule:', errorInfo);
      
      return {
        success: false,
        error: errorInfo.message
      };
    }
  }

  /**
   * Get calls to move from a high-density interval
   * @param {Array} callIds - The call IDs in the interval
   * @param {number} count - The number of calls to move
   * @returns {Promise<Array>} - Calls to move
   */
  async getCallsToMove(callIds, count) {
    // Get the call details from the database
    const calls = [];
    
    for (const callId of callIds) {
      const call = await store.callQueue.getById(callId);
      if (call) {
        calls.push(call);
      }
    }
    
    // Sort by priority (lower first) and then by creation time (newer first)
    calls.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });
    
    // Return the first 'count' calls
    return calls.slice(0, count);
  }
}

// Create a singleton instance
const schedulerService = new SchedulerService();

module.exports = schedulerService;