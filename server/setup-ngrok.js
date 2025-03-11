// Script to set up ngrok tunnel and configure the environment
const ngrok = require('ngrok');
const fs = require('fs');
const path = require('path');
const twilio = require('twilio');
require('dotenv').config();

async function setupNgrok() {
  try {
    console.log('Starting ngrok tunnel...');
    const url = await ngrok.connect({
      proto: 'http',
      addr: 3000,
    });
    
    console.log(`✅ ngrok tunnel established at: ${url}`);
    
    // Update .env file with the new URL
    const envPath = path.join(__dirname, '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Update or add SERVER_BASE_URL
    if (envContent.includes('SERVER_BASE_URL=')) {
      envContent = envContent.replace(
        /SERVER_BASE_URL=.*/,
        `SERVER_BASE_URL=${url}`
      );
    } else {
      envContent += `\nSERVER_BASE_URL=${url}`;
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Updated .env with ngrok URL');
    
    // Update all configuration files
    console.log('Updating configuration files...');
    try {
      // Run the update-config.js script
      require('./update-config');
      console.log('✅ Configuration files updated successfully');
    } catch (error) {
      console.error('❌ Error updating configuration files:', error);
      console.log('Please update the configuration files manually');
    }
    
    // Keep the script running
    console.log('Keeping ngrok tunnel alive. Press Ctrl+C to stop.');
  } catch (error) {
    console.error('Error setting up ngrok:', error);
  }
}

// First install ngrok if it's not already installed
if (!fs.existsSync(path.join(__dirname, 'node_modules', 'ngrok'))) {
  console.log('Installing ngrok...');
  require('child_process').execSync('npm install ngrok', { stdio: 'inherit' });
}

// Run the setup
setupNgrok();