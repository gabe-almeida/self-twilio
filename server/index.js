// Main server for the Twilio Dialer Web App
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
const path = require('path');
const passport = require('passport');
const config = require('./config');
const auth = require('./auth');
const queueManager = require('./call-queue-manager');
const workflowManager = require('./workflow-manager');
const agentStatusService = require('./services/agent-status-service');
const notificationService = require('./services/notification-service');
const lockService = require('./services/lock-service');
const storageService = require('./services/storage-service');
const monitoringService = require('./services/monitoring-service');
const abTestingService = require('./services/ab-testing-service');

// Import routes
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const voiceRoutes = require('./routes/voice');
const rulesRoutes = require('./routes/rules');
const workflowRoutes = require('./routes/workflows');
const dispositionRoutes = require('./routes/dispositions');
const campaignRoutes = require('./routes/campaigns');
const contactCenterRoutes = require('./routes/contact-centers');
const agentStatusRoutes = require('./routes/agent-status');
const monitoringRoutes = require('./routes/monitoring');
const abTestingRoutes = require('./routes/ab-testing');
const configRoutes = require('./routes/config');

// Initialize Express app
const app = express();
const PORT = config.PORT;

// Configure middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? process.env.CLIENT_URL : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Add detailed logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  // For POST requests, log the body for debugging
  if (req.method === 'POST' && (req.url.includes('/voice') || req.url.includes('/token'))) {
    console.log('Request body:', JSON.stringify(req.body, null, 2));
  }
  
  // Capture the original send method
  const originalSend = res.send;
  
  // Override the send method to log responses
  res.send = function(body) {
    // Log TwiML responses for debugging
    if (res.get('Content-Type') === 'text/xml' && body) {
      console.log('TwiML Response:', body);
    }
    
    // Call the original send method
    return originalSend.call(this, body);
  };
  
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Passport
app.use(passport.initialize());

// Create Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Log Twilio client initialization
console.log(`Initializing Twilio client with Account SID: ${process.env.TWILIO_ACCOUNT_SID}`);

// Verify the Twilio client is working
twilioClient.api.accounts(process.env.TWILIO_ACCOUNT_SID)
  .fetch()
  .then(account => {
    console.log(`Successfully connected to Twilio account: ${account.friendlyName} (${account.status})`);
    console.log(`Account type: ${account.type}`);
  })
  .catch(error => {
    console.error('Error connecting to Twilio account:', error.message);
  });

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Log serving directory for debugging
console.log('Serving static files from:', path.join(__dirname, 'public'));

// Routes
app.get('/', (req, res) => {
  res.send('Twilio Dialer Web App is running');
});

// Use route modules
app.use('/api', apiRoutes);
app.use('/auth', authRoutes);
app.use('/voice', voiceRoutes);
app.use('/api/rules', rulesRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/dispositions', dispositionRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/contact-centers', contactCenterRoutes);
app.use('/api/agent-status', agentStatusRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/ab-testing', abTestingRoutes);
app.use('/api/config', configRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Server error',
    message: err.message
  });
});

// Start the call queue manager, workflow engine, agent status service, notification service, lock service, and storage service
(async () => {
  try {
    // Initialize storage service first
    const storageInitialized = await storageService.initialize();
    if (storageInitialized) {
      console.log('Storage service initialized successfully');
    } else {
      console.error('Failed to initialize storage service');
    }
    
    // Initialize lock service
    const lockInitialized = await lockService.initialize();
    if (lockInitialized) {
      console.log('Lock service initialized successfully');
    } else {
      console.error('Failed to initialize lock service');
    }
    
    // Initialize agent status service
    const agentStatusInitialized = await agentStatusService.initialize();
    if (agentStatusInitialized) {
      console.log('Agent status service initialized successfully');
    } else {
      console.error('Failed to initialize agent status service');
    }
    
    // Initialize notification service
    const notificationInitialized = await notificationService.initialize();
    if (notificationInitialized) {
      console.log('Notification service initialized successfully');
    } else {
      console.error('Failed to initialize notification service');
    }
    
    // Initialize monitoring service
    const monitoringInitialized = await monitoringService.initialize();
    if (monitoringInitialized) {
      console.log('Monitoring service initialized successfully');
    } else {
      console.error('Failed to initialize monitoring service');
    }
    
    // Initialize A/B testing service
    const abTestingInitialized = await abTestingService.initialize();
    if (abTestingInitialized) {
      console.log('A/B testing service initialized successfully');
    } else {
      console.error('Failed to initialize A/B testing service');
    }
    
    // Start workflow manager
    workflowManager.start();
    
    // Start call queue manager (which will initialize scheduler service if enabled)
    await queueManager.start();
    
  } catch (error) {
    console.error('Error initializing services:', error);
  }
})();

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  await queueManager.stop();
  workflowManager.stop();
  // Stop monitoring service
  monitoringService.stop();
  // Close the storage service
  await storageService.close();
  // No need to explicitly stop the agent status service as it uses setInterval
  // which will be automatically cleared when the process exits
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down server...');
  await queueManager.stop();
  workflowManager.stop();
  // Stop monitoring service
  monitoringService.stop();
  // Close the storage service
  await storageService.close();
  // No need to explicitly stop the agent status service as it uses setInterval
  // which will be automatically cleared when the process exits
  process.exit(0);
});