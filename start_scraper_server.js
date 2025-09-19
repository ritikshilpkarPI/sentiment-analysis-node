#!/usr/bin/env node
/**
 * Start the persistent Twitter scraper server
 * This keeps the browser open and handles multiple requests
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Twitter Scraper Server...');
console.log('📝 This will open a browser for manual login');
console.log('🔄 The server will keep the browser open for multiple requests');
console.log('⏹️  Press Ctrl+C to stop the server');

const serverPath = path.join(__dirname, 'python-scraper', 'scraper_server.py');

const serverProcess = spawn('python3', [serverPath, '9999'], {
    cwd: path.join(__dirname, 'python-scraper'),
    stdio: 'inherit'
});

serverProcess.on('close', (code) => {
    console.log(`\n🛑 Scraper server exited with code ${code}`);
});

serverProcess.on('error', (error) => {
    console.error(`❌ Failed to start scraper server: ${error.message}`);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down scraper server...');
    serverProcess.kill();
    process.exit(0);
});
