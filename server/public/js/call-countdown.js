/**
 * Call Countdown Module
 * 
 * This module provides a countdown timer before initiating automated outbound calls.
 * It allows agents to prepare for the call and provides an option to skip the countdown.
 * 
 * Features:
 * - Configurable countdown duration
 * - Visual countdown display
 * - Skip button to proceed immediately
 * - Automatic call initiation when countdown reaches zero
 * - Callback functions for countdown events
 */

class CallCountdown {
    /**
     * Create a new CallCountdown instance
     * @param {Object} options - Configuration options
     * @param {number} options.duration - Countdown duration in seconds (default: 5)
     * @param {Function} options.onComplete - Callback function when countdown completes
     * @param {Function} options.onSkip - Callback function when countdown is skipped
     * @param {Function} options.onTick - Callback function for each countdown tick
     * @param {Function} options.onCancel - Callback function when countdown is cancelled
     */
    constructor(options = {}) {
        this.duration = options.duration || 5;
        this.onComplete = options.onComplete || (() => {});
        this.onSkip = options.onSkip || (() => {});
        this.onTick = options.onTick || (() => {});
        this.onCancel = options.onCancel || (() => {});
        
        this.countdownElement = null;
        this.timerElement = null;
        this.skipButton = null;
        this.cancelButton = null;
        this.callInfoElement = null;
        
        this.interval = null;
        this.timeRemaining = 0;
        this.callData = null;
    }
    
    /**
     * Create the countdown UI elements
     * @private
     */
    _createElements() {
        // Create the main container
        this.countdownElement = document.createElement('div');
        this.countdownElement.className = 'call-countdown-container';
        this.countdownElement.style.display = 'none';
        
        // Create the countdown content
        const content = document.createElement('div');
        content.className = 'call-countdown-content';
        
        // Create the header
        const header = document.createElement('div');
        header.className = 'call-countdown-header';
        header.innerHTML = '<h4>Preparing Outbound Call</h4>';
        
        // Create the call info section
        this.callInfoElement = document.createElement('div');
        this.callInfoElement.className = 'call-countdown-info';
        
        // Create the timer
        const timerContainer = document.createElement('div');
        timerContainer.className = 'call-countdown-timer';
        
        this.timerElement = document.createElement('div');
        this.timerElement.className = 'call-countdown-time';
        this.timerElement.textContent = this.duration;
        
        const timerLabel = document.createElement('div');
        timerLabel.className = 'call-countdown-label';
        timerLabel.textContent = 'seconds';
        
        timerContainer.appendChild(this.timerElement);
        timerContainer.appendChild(timerLabel);
        
        // Create the buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'call-countdown-buttons';
        
        this.skipButton = document.createElement('button');
        this.skipButton.className = 'btn btn-success';
        this.skipButton.textContent = 'Call Now';
        this.skipButton.addEventListener('click', () => this.skip());
        
        this.cancelButton = document.createElement('button');
        this.cancelButton.className = 'btn btn-secondary';
        this.cancelButton.textContent = 'Cancel';
        this.cancelButton.addEventListener('click', () => this.cancel());
        
        buttonContainer.appendChild(this.skipButton);
        buttonContainer.appendChild(this.cancelButton);
        
        // Assemble the content
        content.appendChild(header);
        content.appendChild(this.callInfoElement);
        content.appendChild(timerContainer);
        content.appendChild(buttonContainer);
        
        // Add content to the container
        this.countdownElement.appendChild(content);
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .call-countdown-container {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
            }
            
            .call-countdown-content {
                background-color: white;
                border-radius: 8px;
                padding: 20px;
                width: 400px;
                max-width: 90%;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                text-align: center;
            }
            
            .call-countdown-header {
                margin-bottom: 15px;
            }
            
            .call-countdown-info {
                margin-bottom: 20px;
                padding: 10px;
                background-color: #f8f9fa;
                border-radius: 4px;
                text-align: left;
            }
            
            .call-countdown-timer {
                margin: 20px 0;
            }
            
            .call-countdown-time {
                font-size: 48px;
                font-weight: bold;
                color: #007bff;
            }
            
            .call-countdown-label {
                font-size: 14px;
                color: #6c757d;
            }
            
            .call-countdown-buttons {
                display: flex;
                justify-content: center;
                gap: 10px;
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(this.countdownElement);
    }
    
    /**
     * Start the countdown
     * @param {Object} callData - Data about the call being initiated
     * @param {string} callData.phoneNumber - The phone number being called
     * @param {string} callData.contactName - The name of the contact (optional)
     * @param {string} callData.notes - Additional notes about the call (optional)
     * @param {number} callData.id - The ID of the call in the queue (optional)
     */
    start(callData) {
        if (!this.countdownElement) {
            this._createElements();
        }
        
        this.callData = callData;
        this.timeRemaining = this.duration;
        
        // Update call info
        let infoHtml = `<strong>Phone:</strong> ${callData.phoneNumber}`;
        
        if (callData.contactName) {
            infoHtml += `<br><strong>Contact:</strong> ${callData.contactName}`;
        }
        
        if (callData.notes) {
            infoHtml += `<br><strong>Notes:</strong> ${callData.notes}`;
        }
        
        this.callInfoElement.innerHTML = infoHtml;
        
        // Update timer display
        this.timerElement.textContent = this.timeRemaining;
        
        // Show the countdown
        this.countdownElement.style.display = 'flex';
        
        // Start the interval
        this.interval = setInterval(() => this._tick(), 1000);
    }
    
    /**
     * Process a countdown tick
     * @private
     */
    _tick() {
        this.timeRemaining--;
        this.timerElement.textContent = this.timeRemaining;
        
        // Call the onTick callback
        this.onTick(this.timeRemaining, this.callData);
        
        // Check if countdown is complete
        if (this.timeRemaining <= 0) {
            this.complete();
        }
    }
    
    /**
     * Complete the countdown
     */
    complete() {
        clearInterval(this.interval);
        this.countdownElement.style.display = 'none';
        this.onComplete(this.callData);
    }
    
    /**
     * Skip the countdown
     */
    skip() {
        clearInterval(this.interval);
        this.countdownElement.style.display = 'none';
        this.onSkip(this.callData);
    }
    
    /**
     * Cancel the countdown
     */
    cancel() {
        clearInterval(this.interval);
        this.countdownElement.style.display = 'none';
        this.onCancel(this.callData);
    }
}

// Export the class
window.CallCountdown = CallCountdown;