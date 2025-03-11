// Agent Status Management for Twilio Dialer Web App

/**
 * This module provides functionality for managing agent status,
 * including status timer display and notifications.
 */

class AgentStatusManager {
  constructor() {
    this.statusTimerInterval = null;
    this.statusStartTime = null;
    this.notificationsInterval = null;
    this.token = localStorage.getItem('token');
  }

  /**
   * Initialize the agent status manager
   */
  async initialize() {
    // Create the status timer UI
    this.createStatusTimerUI();
    
    // Create the notifications UI
    this.createNotificationsUI();
    
    // Start the status timer
    await this.updateStatusTimer();
    
    // Start notifications polling
    this.startNotificationsPolling();
    
    console.log('Agent status manager initialized');
  }

  /**
   * Create the status timer UI
   */
  createStatusTimerUI() {
    const container = document.getElementById('agent-status-container');
    if (!container) return;
    
    const timerHTML = `
      <div class="card mb-3">
        <div class="card-body">
          <h5 class="card-title">Current Status</h5>
          <div class="status-timer" id="statusTimer">
            <span id="statusTimerValue">00:00:00</span>
            <span id="statusLabel">in current status</span>
          </div>
        </div>
      </div>
    `;
    
    container.innerHTML += timerHTML;
    
    // Add CSS for the status timer
    const style = document.createElement('style');
    style.textContent = `
      .status-timer {
        margin-top: 10px;
        font-size: 14px;
        color: #666;
      }
      
      #statusTimerValue {
        font-weight: bold;
        font-family: monospace;
        font-size: 16px;
      }
      
      .status-timer-warning {
        color: #f44336;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Create the notifications UI
   */
  createNotificationsUI() {
    const container = document.getElementById('agent-status-container');
    if (!container) return;
    
    const notificationsHTML = `
      <div class="notifications-container" id="notificationsContainer" style="display: none;">
        <div class="card">
          <div class="card-body">
            <div class="notifications-header">
              <h5 class="card-title">Notifications <span class="notification-count badge bg-danger" id="notificationCount">0</span></h5>
            </div>
            <div class="notifications-list" id="notificationsList">
              <!-- Notifications will be added here dynamically -->
            </div>
          </div>
        </div>
      </div>
    `;
    
    container.innerHTML += notificationsHTML;
    
    // Add CSS for the notifications
    const style = document.createElement('style');
    style.textContent = `
      .notification {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        border-bottom: 1px solid #eee;
        margin-bottom: 8px;
      }
      
      .notification:last-child {
        border-bottom: none;
        margin-bottom: 0;
      }
      
      .notification-acw-reminder {
        background-color: #fff3e0;
        border-radius: 4px;
      }
      
      .notification-message {
        font-weight: bold;
        font-size: 14px;
      }
      
      .notification-time {
        font-size: 12px;
        color: #666;
        margin-top: 5px;
      }
      
      .notification-dismiss {
        background: none;
        border: none;
        cursor: pointer;
        color: #999;
        font-size: 16px;
      }
      
      .notification-dismiss:hover {
        color: #f44336;
      }
      
      .notification-count {
        font-size: 10px;
        padding: 2px 6px;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Update the status timer
   */
  async updateStatusTimer() {
    try {
      // Fetch the current time in status
      const response = await fetch('/api/agent-status/me', {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to get status time');
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Store the start time
        this.statusStartTime = new Date(new Date() - data.timeInStatusMs);
        
        // Update the timer display
        this.updateTimerDisplay();
        
        // Start the timer interval
        if (this.statusTimerInterval) {
          clearInterval(this.statusTimerInterval);
        }
        
        this.statusTimerInterval = setInterval(() => this.updateTimerDisplay(), 1000);
      }
    } catch (error) {
      console.error('Error fetching status time:', error);
    }
  }

  /**
   * Update the timer display
   */
  updateTimerDisplay() {
    if (!this.statusStartTime) return;
    
    const now = new Date();
    const diff = now - this.statusStartTime;
    
    // Format the time difference
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    // Update the display
    const timerElement = document.getElementById('statusTimerValue');
    if (timerElement) {
      timerElement.textContent = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      // Highlight the timer if it's been too long
      const timerContainer = document.getElementById('statusTimer');
      if (timerContainer) {
        if (hours > 0 || minutes >= 5) {
          timerContainer.classList.add('status-timer-warning');
        } else {
          timerContainer.classList.remove('status-timer-warning');
        }
      }
    }
  }

  /**
   * Start polling for notifications
   */
  startNotificationsPolling() {
    // Check for notifications every 30 seconds
    this.notificationsInterval = setInterval(() => this.loadNotifications(), 30000);
    
    // Load notifications immediately
    this.loadNotifications();
  }

  /**
   * Load notifications
   */
  async loadNotifications() {
    try {
      const response = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to get notifications');
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Update the notification count
        const countElement = document.getElementById('notificationCount');
        if (countElement) {
          countElement.textContent = data.notifications.length;
        }
        
        // Clear the current notifications
        const notificationsList = document.getElementById('notificationsList');
        if (notificationsList) {
          notificationsList.innerHTML = '';
          
          // Add each notification
          data.notifications.forEach(notification => {
            const notificationElement = document.createElement('div');
            notificationElement.className = `notification notification-${notification.type}`;
            notificationElement.innerHTML = `
              <div class="notification-content">
                <div class="notification-message">${notification.message}</div>
                <div class="notification-time">${this.formatTimeAgo(new Date(notification.createdAt))}</div>
              </div>
              <button class="notification-dismiss" data-id="${notification.id}">
                <i class="bi bi-x"></i>
              </button>
            `;
            
            notificationsList.appendChild(notificationElement);
          });
          
          // Add event listeners to dismiss buttons
          document.querySelectorAll('.notification-dismiss').forEach(button => {
            button.addEventListener('click', (e) => this.dismissNotification(e));
          });
          
          // Show or hide the container based on whether there are notifications
          const container = document.getElementById('notificationsContainer');
          if (container) {
            container.style.display = data.notifications.length > 0 ? 'block' : 'none';
          }
        }
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }

  /**
   * Dismiss a notification
   */
  async dismissNotification(event) {
    const notificationId = event.currentTarget.dataset.id;
    
    try {
      const response = await fetch(`/api/notifications/dismiss/${notificationId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to dismiss notification');
      }
      
      // Reload notifications
      this.loadNotifications();
    } catch (error) {
      console.error('Error dismissing notification:', error);
    }
  }

  /**
   * Format a time as "X time ago"
   */
  formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    
    if (diffSec < 60) {
      return 'just now';
    } else if (diffMin < 60) {
      return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
    } else if (diffHour < 24) {
      return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
}

// Initialize the agent status manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
  const agentStatusManager = new AgentStatusManager();
  agentStatusManager.initialize();
});