// API module for Twilio Dialer extension
// Handles communication with the backend service

class TwilioDialerAPI {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.tokenExpirationTime = null;
  }

  /**
   * Get a Twilio access token from the server
   * @param {string} callerId - The caller ID to use
   * @returns {Promise<Object>} - The token response
   */
  async getToken(callerId) {
    console.log('API: Requesting token for caller ID:', callerId);
    console.log('API: Server URL:', this.serverUrl);
    
    try {
      console.log('API: Starting fetch request to token endpoint');
      const response = await fetch(`${this.serverUrl}/voice/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ callerId }),
      });

      console.log('API: Server response status:', response.status);
      
      if (!response.ok) {
        console.error('API: Server returned error status:', response.status, response.statusText);
        
        // Try to get the error details from the response
        let errorDetails = '';
        try {
          const errorJson = await response.json();
          errorDetails = JSON.stringify(errorJson);
        } catch (e) {
          try {
            errorDetails = await response.text();
          } catch (e2) {
            errorDetails = 'Could not parse error details';
          }
        }
        
        throw new Error(`Failed to get token (${response.status}): ${response.statusText}. Details: ${errorDetails}`);
      }

      console.log('API: Parsing JSON response');
      const data = await response.json();
      console.log('API: Token received, token length:', data.token ? data.token.length : 'No token');
      
      // Set token expiration time (usually 1 hour)
      this.tokenExpirationTime = new Date();
      this.tokenExpirationTime.setSeconds(
        this.tokenExpirationTime.getSeconds() + data.ttl
      );
      console.log('API: Token will expire at:', this.tokenExpirationTime);
      
      return data;
    } catch (error) {
      console.error('API: Error getting token:', error.message);
      if (error.stack) {
        console.error('API: Stack trace:', error.stack);
      }
      throw error;
    }
  }

  /**
   * Check if the current token is expired or about to expire
   * @returns {boolean} - True if token needs refresh
   */
  needsTokenRefresh() {
    if (!this.tokenExpirationTime) return true;
    
    // Refresh if less than 5 minutes remaining
    const fiveMinutes = 5 * 60 * 1000;
    const now = new Date();
    return now.getTime() + fiveMinutes >= this.tokenExpirationTime.getTime();
  }

  /**
   * Get available caller IDs from the server
   * @returns {Promise<Array>} - List of available caller IDs
   */
  async getCallerIds() {
    try {
      const response = await fetch(`${this.serverUrl}/caller-ids`);
      
      if (!response.ok) {
        throw new Error(`Failed to get caller IDs: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting caller IDs:', error);
      throw error;
    }
  }

  /**
   * Initiate a call through the server using Twilio's REST API
   * @param {string} to - The phone number to call
   * @param {string} from - The caller ID to use
   * @returns {Promise<Object>} - Call details including ID and status
   */
  async initiateCall(to, from = null) {
    console.log(`API: Initiating server-side call to ${to}`, new Date().toISOString());
    
    try {
      // Build the request payload
      const payload = { to };
      
      // Add from if specified
      if (from) {
        payload.from = from;
      }
      
      console.log(`API: Making POST request to ${this.serverUrl}/api/calls with payload:`, payload);
      
      // Make the API request
      const response = await fetch(`${this.serverUrl}/api/calls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        // Add these options to help with potential CORS issues
        mode: 'cors',
        credentials: 'omit'
      });
      
      console.log(`API: Received response with status: ${response.status}`);
      
      // Handle errors
      if (!response.ok) {
        let errorDetails = '';
        try {
          const errorJson = await response.json();
          errorDetails = JSON.stringify(errorJson);
          console.error('API: Error details from JSON:', errorDetails);
        } catch (e) {
          try {
            errorDetails = await response.text();
            console.error('API: Error text from response:', errorDetails);
          } catch (e2) {
            errorDetails = 'Could not parse error details';
            console.error('API: Could not parse error details');
          }
        }
        
        const errorMsg = `Failed to initiate call (${response.status}): ${response.statusText}. Details: ${errorDetails}`;
        console.error('API: ' + errorMsg);
        throw new Error(errorMsg);
      }
      
      // Parse and return the response
      const data = await response.json();
      console.log('API: Call initiated successfully:', data);
      return data;
    } catch (error) {
      console.error('API: Error initiating call:', error);
      // Display error in alert for debugging
      if (CONFIG && CONFIG.DEBUG) {
        alert(`Error making call: ${error.message}`);
      }
      throw error;
    }
  }
  
  /**
   * Log a call to the server
   * @param {Object} callData - Details about the call
   * @returns {Promise<Object>} - The server response
   */
  async logCall(callData) {
    try {
      const response = await fetch(`${this.serverUrl}/log-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(callData),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to log call: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error logging call:', error);
      throw error;
    }
  }
}

// Create and export API instance
let API;

// Initialize the API when DOM is loaded (ensuring CONFIG is available)
document.addEventListener('DOMContentLoaded', () => {
  API = new TwilioDialerAPI(CONFIG.SERVER_URL);
});