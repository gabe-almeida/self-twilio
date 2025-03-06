# Testing the Twilio Dialer Chrome Extension

This document provides instructions on how to test the Twilio Dialer Chrome extension.

## Prerequisites

Before testing, make sure you have:

1. Node.js installed (for running the backend server)
2. Chrome browser
3. Twilio account credentials (already in the .env file)

## Setup Steps

### 1. Start the Backend Server

First, start the backend server:

```bash
cd server
npm install
npm start
```

You should see a message indicating the server is running on port 3000.

### 2. Load the Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top-right corner)
3. Click "Load unpacked" 
4. Select the root folder of this project (where manifest.json is located)
5. The extension should now appear in your Chrome toolbar

## Testing Outbound Calls

1. Click the Twilio Dialer icon in your Chrome toolbar to open the popup
2. You should see the dialer interface with +1 978 878 5223 selected as the caller ID
3. Enter a phone number using the dialer pad or by typing directly
4. Click the "Call" button
5. The call should connect and you should hear ringing
6. Once connected, you can:
   - See the call duration incrementing
   - Use the mute button to mute/unmute your microphone
   - Press digits on the dialer pad to send DTMF tones
   - Click the "Hang up" button to end the call

## Testing Incoming Calls

To test incoming calls, you need a Twilio phone number that points to your server:

1. If testing locally, use a tool like ngrok to expose your local server:
   ```
   ngrok http 3000
   ```

2. In your Twilio console, configure your phone number's Voice URL to point to:
   ```
   https://your-ngrok-url/voice
   ```

3. Call your Twilio phone number from another phone
4. You should receive a Chrome notification for the incoming call
5. Click on the extension icon to open the popup
6. You should see the incoming call interface with "Answer" and "Decline" buttons
7. Click "Answer" to accept the call or "Decline" to reject it

## Troubleshooting

### Microphone Access

- Make sure to grant microphone permissions to the extension when prompted
- If no prompt appears, check Chrome's site settings for the extension

### Connection Issues

- Verify the server is running and accessible
- Check the browser console for any errors
- Ensure your Twilio account is active and has sufficient credits

### Audio Problems

- Check your audio input/output device settings
- Make sure you have a working microphone
- Test with earphones to avoid feedback

## Test Scenarios

Here are some scenarios to test:

1. **Basic outbound call**: Call a mobile phone and verify two-way audio
2. **DTMF navigation**: Call a number with an IVR system and navigate using the dialer pad
3. **Call controls**: Test muting/unmuting during a call
4. **Incoming call handling**: Test receiving and answering/declining incoming calls
5. **Error handling**: Test with invalid phone numbers or when offline