// Script to set up ngrok tunnel and configure the environment
const ngrok = require('ngrok');
const fs = require('fs');
const path = require('path');
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
    
    console.log('\n🔨 Next steps:');
    console.log('1. Go to https://console.twilio.com/');
    console.log('2. Navigate to Voice -> TwiML Apps');
    console.log('3. Create a new TwiML App or edit existing one');
    console.log('4. Set the Voice Request URL to:');
    console.log(`   ${url}/voice/outgoing`);
    console.log('5. Copy the TwiML App SID and add it to your .env file\n');
    
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