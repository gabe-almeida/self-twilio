// Twilio Client SDK wrapper for the Chrome extension
class TwilioClientWrapper {
  constructor() {
    this.device = null;
    this.currentCall = null;
    this.isInitialized = false;
    this.token = null;
    this.tokenExpiration = null;
    this.callListeners = [];
    this.deviceListeners = [];
    this.selectedMicrophoneId = null;
  }

  /**
   * Initialize the Twilio Device with a token
   * @param {string} microphoneId - Optional microphone device ID to use
   * @returns {Promise<void>}
   */
  async initialize(microphoneId = null) {
    if (!window.Twilio) {
      throw new Error('Twilio SDK not loaded');
    }

    try {
      // Store the selected microphone ID
      this.selectedMicrophoneId = microphoneId;
      
      // Get a token from the server
      const token = await this.getToken();
      
      // Create device options with audio constraints
      const deviceOptions = {
        // Log level for debugging
        logLevel: 'debug',
        // Audio constraints for the microphone
        audioConstraints: this.getAudioConstraints()
      };
      
      console.log('Initializing Twilio device with options:', deviceOptions);
      
      // Initialize the device
      this.device = new Twilio.Device(token, deviceOptions);
      
      // Set up event listeners
      this.setupDeviceListeners();
      
      // Mark as initialized
      this.isInitialized = true;
      
      console.log('Twilio device initialized successfully');
      
      // Request microphone permission explicitly
      await this.requestMicrophonePermission();
      
      return this.device;
    } catch (error) {
      console.error('Error initializing Twilio device:', error);
      throw error;
    }
  }

  /**
   * Request microphone permission explicitly
   */
  async requestMicrophonePermission() {
    try {
      console.log('Requesting microphone permission...');
      
      // First try to request the permission through Chrome API
      if (chrome.permissions && chrome.permissions.request) {
        const granted = await new Promise(resolve => {
          chrome.permissions.request({
            permissions: ['microphone']
          }, result => resolve(result));
        });
        
        if (granted) {
          console.log('Microphone permission granted through Chrome API');
        } else {
          console.warn('Microphone permission denied through Chrome API');
        }
      }
      
      // Then try to get actual microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone access granted, devices:', stream.getAudioTracks());
      
      // Keep the stream active to maintain microphone access
      window.microphoneStream = stream;
      
      return true;
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      return false;
    }
  }

  /**
   * Get audio constraints based on selected microphone
   * @returns {Object} Audio constraints
   */
  getAudioConstraints() {
    const constraints = {
      autoGainControl: true,
      echoCancellation: true,
      noiseSuppression: true
    };
    
    // If a specific microphone is selected, use it
    if (this.selectedMicrophoneId) {
      constraints.deviceId = { exact: this.selectedMicrophoneId };
    }
    
    return constraints;
  }

  /**
   * Set up event listeners for the Twilio Device
   */
  setupDeviceListeners() {
    if (!this.device) return;
    
    // Clear any existing listeners
    this.deviceListeners.forEach(listener => {
      this.device.removeListener(listener.event, listener.callback);
    });
    this.deviceListeners = [];
    
    // Register new listeners
    const registerListener = (event, callback) => {
      this.device.on(event, callback);
      this.deviceListeners.push({ event, callback });
    };
    
    // Device ready
    registerListener('ready', () => {
      console.log('Twilio device is ready for calls');
      this.notifyListeners('deviceReady');
    });
    
    // Device error
    registerListener('error', (error) => {
      console.error('Twilio device error:', error);
      this.notifyListeners('deviceError', error);
    });
    
    // Incoming call
    registerListener('incoming', (call) => {
      console.log('Incoming call from:', call.parameters.From);
      this.currentCall = call;
      this.setupCallListeners(call);
      this.notifyListeners('incomingCall', call);
    });
    
    // Register for other events
    ['connect', 'disconnect', 'offline', 'tokenWillExpire'].forEach(event => {
      registerListener(event, (...args) => {
        console.log(`Twilio device event: ${event}`, args);
        this.notifyListeners(event, ...args);
      });
    });
  }

  /**
   * Set up event listeners for a call
   * @param {Object} call - The Twilio call object
   */
  setupCallListeners(call) {
    if (!call) return;
    
    // Call accepted
    call.on('accept', () => {
      console.log('Call accepted');
      this.notifyListeners('callAccepted', call);
    });
    
    // Call disconnected
    call.on('disconnect', () => {
      console.log('Call disconnected');
      this.currentCall = null;
      this.notifyListeners('callEnded', call);
    });
    
    // Call rejected
    call.on('reject', () => {
      console.log('Call rejected');
      this.currentCall = null;
      this.notifyListeners('callRejected', call);
    });
    
    // Call error
    call.on('error', (error) => {
      console.error('Call error:', error);
      this.notifyListeners('callError', error);
    });
    
    // Audio warnings (important for debugging audio issues)
    call.on('warning', (warning) => {
      console.warn('Call warning:', warning);
      this.notifyListeners('callWarning', warning);
    });
    
    // Audio warnings cleared
    call.on('warning-cleared', (warning) => {
      console.log('Call warning cleared:', warning);
      this.notifyListeners('callWarningCleared', warning);
    });
  }

  /**
   * Make an outgoing call
   * @param {string} phoneNumber - The phone number to call
   * @returns {Promise<Object>} - The call object
   */
  async makeCall(phoneNumber) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      // Ensure we have a valid token
      await this.ensureValidToken();
      
      // Format the phone number
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      
      console.log(`Making call to ${formattedNumber}`);
      
      // Log the parameters we're sending
      const callParams = {
        to: formattedNumber,  // Use lowercase 'to' instead of uppercase 'To'
        from: process.env.DEFAULT_CALLER_ID || '+19788785223',  // Add from parameter
        direction: 'outbound'  // Use lowercase 'direction' instead of 'Direction'
      };
      console.log('Call parameters:', callParams);
      
      // Add detailed logging for debugging
      console.log('==================== TWILIO CLIENT: MAKING CALL ====================');
      console.log('Timestamp:', new Date().toISOString());
      console.log('Destination number:', formattedNumber);
      console.log('Caller ID:', callParams.from);
      console.log('Device state:', this.device ? this.device.state : 'unknown');
      console.log('Device ready:', this.device ? this.device.isReady() : false);
      console.log('Call parameters:', JSON.stringify(callParams, null, 2));
      console.log('Params structure:', JSON.stringify({ params: callParams }, null, 2));
      
      // Make the call with params directly
      console.log('Making call with params directly...');
      
      // IMPORTANT: We need to pass the parameters directly, not nested in a params object
      // This ensures they're properly passed to the TwiML app
      const call = await this.device.connect(callParams);
      
      // Log the call object details
      console.log('Call object created:', call ? 'success' : 'failed');
      if (call) {
        console.log('Call parameters:', call.parameters);
        console.log('Call options:', call.options);
        console.log('Call direction:', call.direction);
        console.log('Call status:', call.status());
      }
      
      // Store the current call
      this.currentCall = call;
      
      // Set up call listeners
      this.setupCallListeners(call);
      
      console.log('Call initiated successfully');
      
      return call;
    } catch (error) {
      console.error('Error making call:', error);
      throw error;
    }
  }

  /**
   * Format a phone number for dialing
   * @param {string} phoneNumber - The phone number to format
   * @returns {string} - The formatted phone number
   */
  formatPhoneNumber(phoneNumber) {
    // Remove non-digit characters
    let digits = phoneNumber.replace(/\D/g, '');
    
    // Add +1 for US numbers if needed
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    
    // Otherwise, add + if needed
    if (!phoneNumber.startsWith('+')) {
      return `+${digits}`;
    }
    
    return phoneNumber;
  }

  /**
   * End the current call
   */
  endCall() {
    if (this.currentCall) {
      console.log('Ending current call');
      this.currentCall.disconnect();
      this.currentCall = null;
    }
  }

  /**
   * Mute or unmute the current call
   * @param {boolean} mute - Whether to mute the call
   */
  mute(mute = true) {
    if (this.currentCall) {
      console.log(`${mute ? 'Muting' : 'Unmuting'} current call`);
      this.currentCall.mute(mute);
    }
  }

  /**
   * Check if the current call is muted
   * @returns {boolean} - Whether the call is muted
   */
  isCallMuted() {
    return this.currentCall ? this.currentCall.isMuted() : false;
  }

  /**
   * Send DTMF tones (digits) during a call
   * @param {string} digits - The digits to send
   */
  sendDigits(digits) {
    if (this.currentCall) {
      console.log(`Sending digits: ${digits}`);
      this.currentCall.sendDigits(digits);
    }
  }

  /**
   * Get a token from the server
   * @returns {Promise<string>} - The token
   */
  async getToken() {
    // Check if we have a valid token
    if (this.token && this.tokenExpiration && this.tokenExpiration > Date.now()) {
      return this.token;
    }
    
    try {
      // Get a new token from the server with a caller ID
      const callerId = '+19788785223'; // Default caller ID
      console.log('Requesting token with caller ID:', callerId);
      
      // Use the server URL from the extension's config or a default
      const serverUrl = chrome.runtime.getURL('config/config.json') ?
        chrome.extension.getBackgroundPage().CONFIG.SERVER_URL :
        'http://localhost:3000';
      console.log('Using server URL:', serverUrl);
      
      const response = await fetch(`${serverUrl}/voice/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ callerId })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get token: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Store the token and expiration
      this.token = data.token;
      this.tokenExpiration = Date.now() + (data.ttl || 3600) * 1000;
      
      return this.token;
    } catch (error) {
      console.error('Error getting token:', error);
      throw error;
    }
  }

  /**
   * Ensure we have a valid token
   * @returns {Promise<string>} - The token
   */
  async ensureValidToken() {
    // If the token is about to expire, get a new one
    if (!this.token || !this.tokenExpiration || this.tokenExpiration - Date.now() < 60000) {
      return this.getToken();
    }
    
    return this.token;
  }

  /**
   * Add a listener for call events
   * @param {Function} listener - The listener function
   */
  addListener(listener) {
    if (typeof listener === 'function') {
      this.callListeners.push(listener);
    }
  }

  /**
   * Remove a listener
   * @param {Function} listener - The listener to remove
   */
  removeListener(listener) {
    this.callListeners = this.callListeners.filter(l => l !== listener);
  }

  /**
   * Notify all listeners of an event
   * @param {string} event - The event name
   * @param {...any} args - The event arguments
   */
  notifyListeners(event, ...args) {
    this.callListeners.forEach(listener => {
      try {
        listener(event, ...args);
      } catch (error) {
        console.error('Error in call listener:', error);
      }
    });
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }
    
    this.currentCall = null;
    this.isInitialized = false;
    this.callListeners = [];
    this.deviceListeners = [];
    
    // Release the microphone stream if we have one
    if (window.microphoneStream) {
      window.microphoneStream.getTracks().forEach(track => track.stop());
      window.microphoneStream = null;
    }
  }
}

// Create a singleton instance
const TwilioClient = new TwilioClientWrapper();

// Export the singleton
window.TwilioClient = TwilioClient;