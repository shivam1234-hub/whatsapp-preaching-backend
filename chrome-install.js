const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create a directory for Chrome in the user's home directory
const chromeDir = path.join(process.env.HOME, '.chrome');
if (!fs.existsSync(chromeDir)) {
    fs.mkdirSync(chromeDir, { recursive: true });
}

// Download and extract Chrome
try {
    console.log('Downloading Chrome...');
    execSync(`curl -L https://storage.googleapis.com/chromium-browser-snapshots/Linux_x64/1002910/chrome-linux.zip -o ${chromeDir}/chrome.zip`);

    console.log('Extracting Chrome...');
    execSync(`unzip ${chromeDir}/chrome.zip -d ${chromeDir}`);

    console.log('Chrome installation completed');
} catch (error) {
    console.error('Error installing Chrome:', error);
    process.exit(1);
}