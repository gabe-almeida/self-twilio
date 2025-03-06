# Twilio Dialer Chrome Extension

A Chrome extension that allows making and receiving phone calls using the Twilio API.

## Features

- Make outbound calls from your browser
- Receive incoming calls
- Mute/unmute calls
- Send DTMF tones during calls
- Customize caller ID
- Call duration tracking

## Project Structure

```
twilio-dialer-extension/
├── manifest.json                 # Chrome extension manifest
├── popup/                        # Extension popup UI
│   ├── popup.html                # Main dialer UI
│   ├── popup.css                 # Styling
│   └── popup.js                  # UI interaction and call handling
├── background/                   # Background scripts
│   └── background.js             # Background service worker
├── lib/                          # Shared libraries
│   ├── twilio.js                 # Twilio SDK wrapper
│   └── api.js                    # Backend API communication
├── config/                       # Configuration
│   └── config.js                 # Extension config
├── assets/
│   └── icons/                    # Extension icons
└── server/                       # Backend server
    ├── index.js                  # Main server entry point
    ├── token-generator.js        # Twilio token generation
    ├── twiml-handler.js          # TwiML response generation
    ├── package.json              # Dependencies
    ├── .env                      # Environment variables
    └── public/                   # Static files
        └── onboarding.html       # Onboarding page
```

## Installation

### Backend Server Setup

1. Navigate to the server directory:
   ```
   cd server
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the server:
   ```
   npm run start
   ```

The server should now be running at http://localhost:3000

### Chrome Extension Setup

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top-right corner)
3. Click "Load unpacked" and select the root folder of this project
4. The extension should now appear in your Chrome toolbar

## Usage

1. Click the Twilio Dialer icon in your Chrome toolbar
2. Select your caller ID from the dropdown (default: +1 978 878 5223)
3. Enter a phone number to call
4. Click the "Call" button

### For Incoming Calls

Make sure your Twilio phone number is configured to point to your server's webhook:
- Voice URL: `http://your-server-url/voice` (using HTTP POST)

When you receive a call, you'll get a Chrome notification. Click the extension icon to answer.

## Configuration

### Server Configuration

The server uses environment variables in the `.env` file:

```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
PORT=3000
SERVER_BASE_URL=http://localhost:3000
```

### Extension Configuration

Extension settings are in `config/config.js`:

```js
const CONFIG = {
  SERVER_URL: 'http://localhost:3000',
  DEFAULT_CALLER_ID: '+19788785223',
  // ... other settings
};
```

## Future Enhancements

- Add call history
- Multiple caller ID selection
- Contact management
- Integration with CRM systems
- Auto-dialing from a queue

## Credits

This extension uses the following technologies:
- [Twilio Voice SDK](https://www.twilio.com/docs/voice/client/javascript)
- [Chrome Extension API](https://developer.chrome.com/docs/extensions/reference/)
- [Express.js](https://expressjs.com/)