const fs = require('fs');
const path = require('path');

// Test the monitoring system by checking if it can find Pakistan tweets
function testMonitoringSystem() {
    console.log('🔍 Testing monitoring system...');
    
    // Check if Pakistan tweets file exists
    const pakistanFile = './python-scraper/tweets_output_pakistan.md';
    if (fs.existsSync(pakistanFile)) {
        console.log('✅ Pakistan tweets file exists');
        
        // Read first few lines to see content
        const content = fs.readFileSync(pakistanFile, 'utf-8');
        const lines = content.split('\n').slice(0, 20);
        console.log('📄 First 20 lines of Pakistan file:');
        lines.forEach((line, i) => {
            console.log(`${i + 1}: ${line}`);
        });
        
        // Count total tweets
        const tweetCount = (content.match(/## Tweet/g) || []).length;
        console.log(`📊 Total tweets in file: ${tweetCount}`);
        
    } else {
        console.log('❌ Pakistan tweets file not found');
    }
    
    // Check blocked keywords
    const blockedFile = './python-scraper/blocked_keywords.txt';
    if (fs.existsSync(blockedFile)) {
        const blockedContent = fs.readFileSync(blockedFile, 'utf-8');
        const blockedKeywords = blockedContent.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
        
        console.log('🚫 Blocked keywords:', blockedKeywords);
        
        if (blockedKeywords.includes('pakistan')) {
            console.log('❌ Pakistan is still blocked!');
        } else {
            console.log('✅ Pakistan is not blocked');
        }
    }
    
    // Check if monitoring is supposed to run
    console.log('⏰ Monitoring should run every 30 seconds...');
}

testMonitoringSystem();
