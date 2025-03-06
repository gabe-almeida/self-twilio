// Main popup script for the Twilio Dialer extension

// First, load the Twilio Voice SDK
function loadTwilioSDK() {
  return new Promise((resolve, reject) => {
    if (window.Twilio) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://sdk.twilio.com/js/client/releases/1.14.0/twilio.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Twilio SDK'));
    document.head.appendChild(script);
  });
}

// Request microphone permission explicitly using browser API
async function requestMicrophonePermission() {
  try {
    console.log('Requesting microphone permission directly from browser...');
    
    // This will trigger the browser's native permission prompt
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Keep the stream active to maintain microphone access during the call
    window.microphoneStream = stream;
    
    console.log('Microphone permission granted by browser', stream.getAudioTracks());
    return true;
  } catch (error) {
    console.error('Browser denied microphone permission:', error);
    return false;
  }
}

// Dialer UI Controller
class DialerController {
  constructor() {
    this.phoneInput = document.getElementById('phone-number');
    this.callBtn = document.getElementById('call-btn');
    this.muteBtn = document.getElementById('mute-btn');
    this.hangupBtn = document.getElementById('hangup-btn');
    this.clearBtn = document.getElementById('clear-btn');
    this.dialButtons = document.querySelectorAll('.dial-btn');
    this.inCallControls = document.querySelector('.in-call-controls');
    this.callStatus = document.getElementById('call-status');
    this.callDuration = document.getElementById('call-duration');
    this.callerIdSelect = document.getElementById('caller-id');
    this.microphoneSelect = document.getElementById('microphone-select');
    this.isInCall = false;
    this.hasMicrophonePermission = false;
    this.selectedMicrophoneId = null;

    // Request microphone permission immediately on load
    this.requestMicrophoneAccess();
    
    // Set up event listeners
    this.setupEventListeners();
  }

  async requestMicrophoneAccess() {
    try {
      // This will trigger the browser's permission prompt
      const result = await requestMicrophonePermission();
      this.hasMicrophonePermission = result;
      
      if (result) {
        console.log('Microphone access granted on startup');
        this.updateStatus('Ready - Microphone access granted');
        this.populateAudioDevices();
      } else {
        console.log('Microphone access denied on startup');
        this.updateStatus('Microphone access required for calls');
      }
    } catch (error) {
      console.error('Error requesting microphone access:', error);
      this.updateStatus('Error accessing microphone');
    }
  }

  async populateAudioDevices() {
    try {
      // Get list of audio input devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputDevices = devices.filter(device => device.kind === 'audioinput');
      
      // Clear existing options
      this.microphoneSelect.innerHTML = '';
      
      // Add default option
      const defaultOption = document.createElement('option');
      defaultOption.value = 'default';
      defaultOption.text = 'Default Microphone';
      this.microphoneSelect.appendChild(defaultOption);
      
      // Add each device
      audioInputDevices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Microphone ${this.microphoneSelect.options.length}`;
        this.microphoneSelect.appendChild(option);
      });
      
      // Listen for microphone selection changes
      this.microphoneSelect.addEventListener('change', () => {
        this.selectedMicrophoneId = this.microphoneSelect.value === 'default' ? null : this.microphoneSelect.value;
        console.log('Selected microphone changed:', this.selectedMicrophoneId);
      });
      
    } catch (error) {
      console.error('Error enumerating audio devices:', error);
    }
  }

  setupEventListeners() {
    // Call button with microphone permission check
    this.callBtn.addEventListener('click', async () => {
      if (this.isInCall) return;

      try {
        // Check and request microphone permission if needed
        if (!this.hasMicrophonePermission) {
          console.log('Requesting microphone permission before call...');
          const granted = await requestMicrophonePermission();
          if (!granted) {
            this.updateStatus('Microphone access required for calls');
            alert('Please allow microphone access to make calls.');
            return;
          }
          this.hasMicrophonePermission = true;
        }

        // Proceed with the call
        const phoneNumber = this.phoneInput.value.replace(/\D/g, '');
        if (!phoneNumber) {
          alert('Please enter a phone number');
          return;
        }

        this.callBtn.disabled = true;
        this.updateStatus('Initializing call...');

        // Load Twilio SDK if needed
        await loadTwilioSDK();

        // Initialize Twilio if needed
        if (!window.TwilioClient || !window.TwilioClient.isInitialized) {
          // If TwilioClient is not available, create a simple version for testing
          if (!window.TwilioClient) {
            console.log('Creating test TwilioClient');
            window.TwilioClient = {
              isInitialized: false,
              initialize: async (micId) => {
                console.log('Initializing test TwilioClient with mic:', micId);
                window.TwilioClient.isInitialized = true;
                return true;
              },
              makeCall: async (number) => {
                console.log('Making test call to:', number);
                this.simulateCallStart();
                return { sid: 'test-call-sid' };
              },
              endCall: () => {
                console.log('Ending test call');
                this.simulateCallEnd();
              },
              mute: (mute) => {
                console.log('Muting call:', mute);
              },
              isCallMuted: () => false,
              sendDigits: (digits) => {
                console.log('Sending digits:', digits);
              }
            };
          }
          
          await window.TwilioClient.initialize(this.selectedMicrophoneId);
        }

        // Make the call
        await window.TwilioClient.makeCall(phoneNumber);
        this.simulateCallStart();
        
      } catch (error) {
        console.error('Error making call:', error);
        this.updateStatus(`Error: ${error.message}`);
        this.callBtn.disabled = false;
      }
    });

    // Set up other event listeners
    this.setupDialPadListeners();
    this.setupCallControls();
  }

  setupDialPadListeners() {
    this.dialButtons.forEach(button => {
      button.addEventListener('click', () => {
        const digit = button.getAttribute('data-value');
        if (this.isInCall && window.TwilioClient) {
          window.TwilioClient.sendDigits(digit);
        } else {
          this.phoneInput.value += digit;
        }
      });
    });

    this.clearBtn.addEventListener('click', () => {
      this.phoneInput.value = '';
    });
  }

  setupCallControls() {
    this.muteBtn.addEventListener('click', () => {
      if (!this.isInCall || !window.TwilioClient) return;
      
      const isMuted = window.TwilioClient.isCallMuted();
      window.TwilioClient.mute(!isMuted);
      this.muteBtn.textContent = isMuted ? 'Mute' : 'Unmute';
    });

    this.hangupBtn.addEventListener('click', () => {
      if (!this.isInCall) return;
      
      if (window.TwilioClient) {
        window.TwilioClient.endCall();
      }
      
      this.simulateCallEnd();
    });
  }

  simulateCallStart() {
    this.isInCall = true;
    this.callBtn.style.display = 'none';
    this.inCallControls.style.display = 'flex';
    this.hangupBtn.style.display = 'inline-block';
    this.updateStatus('Call connected');
    
    // Start call duration timer
    this.callStartTime = new Date();
    this.callDurationInterval = setInterval(() => {
      const now = new Date();
      const diff = Math.floor((now - this.callStartTime) / 1000);
      const minutes = Math.floor(diff / 60).toString().padStart(2, '0');
      const seconds = (diff % 60).toString().padStart(2, '0');
      this.callDuration.textContent = `${minutes}:${seconds}`;
    }, 1000);
  }

  simulateCallEnd() {
    this.isInCall = false;
    this.callBtn.style.display = 'inline-block';
    this.callBtn.disabled = false;
    this.inCallControls.style.display = 'none';
    this.hangupBtn.style.display = 'none';
    this.updateStatus('Call ended');
    
    // Stop call duration timer
    if (this.callDurationInterval) {
      clearInterval(this.callDurationInterval);
      this.callDurationInterval = null;
    }
    
    this.callDuration.textContent = '00:00';
  }

  updateStatus(status) {
    this.callStatus.textContent = status;
  }
}

// Initialize the dialer when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const dialer = new DialerController();
  window.dialer = dialer; // Make it accessible for debugging
});