// Database module for Twilio Dialer Web App
// Using in-memory store instead of SQLite

// Import the memory store
const store = require('./memory-store');

// Export the store directly
module.exports = store;