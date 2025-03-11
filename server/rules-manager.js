// Rules Manager for Twilio Dialer Web App
const store = require('./memory-store');

class RulesManager {
  constructor() {
    // Default rules configuration
    this.rules = {
      // When a new lead is created, call immediately
      newLeadRule: {
        enabled: false,
        priority: 3, // High priority
      },
      
      // If a call is dispositioned as "No Answer", retry after delay
      noAnswerRetryRule: {
        enabled: false,
        retryDelayMinutes: 30, // Default to 30 minutes
        maxRetries: 3, // Maximum number of retries
        respectCallCenterHours: true, // Only retry during call center hours
      },
      
      // Call center hours
      callCenterHours: {
        enabled: true,
        timezone: 'America/New_York',
        workDays: [1, 2, 3, 4, 5], // Monday to Friday (0 = Sunday, 6 = Saturday)
        startTime: '09:00', // 9 AM
        endTime: '17:00', // 5 PM
      }
    };
  }
  
  // Get all rules
  getRules() {
    return { ...this.rules };
  }
  
  // Update rules
  updateRules(newRules) {
    this.rules = {
      ...this.rules,
      ...newRules
    };
    return this.rules;
  }
  
  // Check if current time is within call center hours
  isWithinCallCenterHours() {
    if (!this.rules.callCenterHours.enabled) {
      return true; // If call center hours are disabled, always return true
    }
    
    const now = new Date();
    const timezone = this.rules.callCenterHours.timezone;
    
    // Format options for getting time in the specified timezone
    const options = { 
      timeZone: timezone,
      hour12: false
    };
    
    // Get current day of week in the specified timezone (0 = Sunday, 6 = Saturday)
    const day = now.toLocaleDateString('en-US', { ...options, weekday: 'numeric' });
    const dayNum = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      .indexOf(day);
    
    // Check if current day is a work day
    if (!this.rules.callCenterHours.workDays.includes(dayNum)) {
      return false;
    }
    
    // Get current time in the specified timezone
    const timeStr = now.toLocaleTimeString('en-US', { ...options, hour: '2-digit', minute: '2-digit' });
    const [hours, minutes] = timeStr.split(':').map(Number);
    const currentTime = hours * 60 + minutes; // Convert to minutes since midnight
    
    // Parse start and end times
    const [startHours, startMinutes] = this.rules.callCenterHours.startTime.split(':').map(Number);
    const [endHours, endMinutes] = this.rules.callCenterHours.endTime.split(':').map(Number);
    
    const startTime = startHours * 60 + startMinutes;
    const endTime = endHours * 60 + endMinutes;
    
    // Check if current time is within start and end times
    return currentTime >= startTime && currentTime <= endTime;
  }
  
  // Calculate next retry time based on rules
  calculateNextRetryTime(call) {
    const now = new Date();
    const retryDelayMs = this.rules.noAnswerRetryRule.retryDelayMinutes * 60 * 1000;
    let nextRetryTime = new Date(now.getTime() + retryDelayMs);
    
    // If we need to respect call center hours
    if (this.rules.noAnswerRetryRule.respectCallCenterHours) {
      // If the next retry time is outside call center hours, adjust it
      while (!this.isTimeWithinCallCenterHours(nextRetryTime)) {
        // Move to the next day's start time
        nextRetryTime = this.getNextCallCenterStartTime(nextRetryTime);
      }
    }
    
    return nextRetryTime;
  }
  
  // Check if a specific time is within call center hours
  isTimeWithinCallCenterHours(time) {
    if (!this.rules.callCenterHours.enabled) {
      return true;
    }
    
    const timezone = this.rules.callCenterHours.timezone;
    
    // Format options for getting time in the specified timezone
    const options = { 
      timeZone: timezone,
      hour12: false
    };
    
    // Get day of week for the specified time
    const day = time.toLocaleDateString('en-US', { ...options, weekday: 'numeric' });
    const dayNum = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      .indexOf(day);
    
    // Check if the day is a work day
    if (!this.rules.callCenterHours.workDays.includes(dayNum)) {
      return false;
    }
    
    // Get time in the specified timezone
    const timeStr = time.toLocaleTimeString('en-US', { ...options, hour: '2-digit', minute: '2-digit' });
    const [hours, minutes] = timeStr.split(':').map(Number);
    const timeInMinutes = hours * 60 + minutes;
    
    // Parse start and end times
    const [startHours, startMinutes] = this.rules.callCenterHours.startTime.split(':').map(Number);
    const [endHours, endMinutes] = this.rules.callCenterHours.endTime.split(':').map(Number);
    
    const startTime = startHours * 60 + startMinutes;
    const endTime = endHours * 60 + endMinutes;
    
    // Check if time is within start and end times
    return timeInMinutes >= startTime && timeInMinutes <= endTime;
  }
  
  // Get the next call center start time after the given time
  getNextCallCenterStartTime(time) {
    const timezone = this.rules.callCenterHours.timezone;
    const options = { timeZone: timezone };
    
    // Parse start time
    const [startHours, startMinutes] = this.rules.callCenterHours.startTime.split(':').map(Number);
    
    // Create a new date for the next day at start time
    const nextDay = new Date(time);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(startHours, startMinutes, 0, 0);
    
    // If the next day is not a work day, recursively find the next work day
    const day = nextDay.toLocaleDateString('en-US', { ...options, weekday: 'numeric' });
    const dayNum = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      .indexOf(day);
    
    if (!this.rules.callCenterHours.workDays.includes(dayNum)) {
      return this.getNextCallCenterStartTime(nextDay);
    }
    
    return nextDay;
  }
  
  // Process a new lead according to rules
  processNewLead(leadData) {
    if (!this.rules.newLeadRule.enabled) {
      return null; // Rule is disabled, do nothing
    }
    
    // Check if we're within call center hours
    if (this.rules.callCenterHours.enabled && !this.isWithinCallCenterHours()) {
      // Schedule for the next call center start time
      const nextCallTime = this.getNextCallCenterStartTime(new Date());
      
      // Add to queue with scheduled time
      return {
        ...leadData,
        priority: this.rules.newLeadRule.priority,
        scheduled_for: nextCallTime.toISOString()
      };
    }
    
    // Within call center hours, add to queue for immediate calling
    return {
      ...leadData,
      priority: this.rules.newLeadRule.priority
    };
  }
  
  // Process a no-answer call according to rules
  processNoAnswerCall(call) {
    if (!this.rules.noAnswerRetryRule.enabled) {
      return null; // Rule is disabled, do nothing
    }
    
    // Check if we've reached the maximum number of retries
    const retryCount = call.retry_count || 0;
    if (retryCount >= this.rules.noAnswerRetryRule.maxRetries) {
      return null; // Max retries reached, do nothing
    }
    
    // Calculate next retry time
    const nextRetryTime = this.calculateNextRetryTime(call);
    
    // Return updated call data for rescheduling
    return {
      ...call,
      status: 'Queued',
      retry_count: retryCount + 1,
      scheduled_for: nextRetryTime.toISOString(),
      last_retry: new Date().toISOString()
    };
  }
}

// Create a singleton instance
const rulesManager = new RulesManager();

module.exports = rulesManager;