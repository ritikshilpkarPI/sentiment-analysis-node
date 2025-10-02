#!/usr/bin/env node
/**
 * Development Testing Script for Geo-Sentiment Analysis
 * Tests all geo-sentiment endpoints locally
 */

const axios = require('axios');

// Development server configuration
const BASE_URL = 'http://localhost:9000';
const API_BASE = `${BASE_URL}/api/geo-sentiment`;

// Test data for different scenarios
const testTweets = [
  {
    text: "भोपाल में बहुत अच्छा काम हो रहा है सरकार का",
    author: "test_user_1",
    location: "Bhopal, MP",
    expected: "positive sentiment, Bhopal district"
  },
  {
    text: "इंदौर की सड़कें खराब हैं, सरकार कुछ नहीं कर रही",
    author: "test_user_2", 
    location: "Indore",
    expected: "negative sentiment, Indore district"
  },
  {
    text: "मध्य प्रदेश को अलग करना चाहिए भारत से",
    author: "test_user_3",
    location: "MP",
    expected: "anti-national alert, separatist content"
  },
  {
    text: "ग्वालियर में नई योजना शुरू हुई है",
    author: "test_user_4",
    location: "Gwalior",
    expected: "neutral/positive sentiment, Gwalior district"
  },
  {
    text: "भारत सरकार के खिलाफ हिंसा करनी चाहिए",
    author: "test_user_5",
    location: "Jabalpur",
    expected: "CRITICAL anti-national alert"
  }
];

class GeoSentimentTester {
  constructor() {
    this.results = [];
    this.errors = [];
  }

  // Test server health
  async testHealth() {
    console.log('\n🏥 Testing Server Health...');
    try {
      const response = await axios.get(`${BASE_URL}/health`);
      console.log('✅ Server Health:', response.data.status);
      return true;
    } catch (error) {
      console.error('❌ Server health check failed:', error.message);
      return false;
    }
  }

  // Test districts endpoint
  async testDistricts() {
    console.log('\n🗺️ Testing Districts Endpoint...');
    try {
      const response = await axios.get(`${API_BASE}/districts`);
      console.log(`✅ Districts loaded: ${response.data.data.length} districts`);
      console.log('Sample districts:', response.data.data.slice(0, 3).map(d => d.name));
      return true;
    } catch (error) {
      console.error('❌ Districts test failed:', error.message);
      return false;
    }
  }

  // Test heat map endpoint
  async testHeatMap() {
    console.log('\n🌡️ Testing Heat Map Endpoint...');
    try {
      const response = await axios.get(`${API_BASE}/heatmap`);
      console.log(`✅ Heat map data: ${response.data.data.length} districts with sentiment data`);
      
      // Show sample district data
      const sampleDistrict = response.data.data[0];
      if (sampleDistrict) {
        console.log('Sample district data:', {
          name: sampleDistrict.name,
          totalTweets: sampleDistrict.totalTweets,
          sentimentScore: sampleDistrict.sentimentScore,
          heatIntensity: sampleDistrict.heatIntensity
        });
      }
      return true;
    } catch (error) {
      console.error('❌ Heat map test failed:', error.message);
      return false;
    }
  }

  // Test anti-national alerts
  async testAntiNationalAlerts() {
    console.log('\n🚨 Testing Anti-National Alerts...');
    try {
      const response = await axios.get(`${API_BASE}/anti-national-alerts`);
      console.log(`✅ Anti-national alerts: ${response.data.data.total} total alerts`);
      console.log('By severity:', response.data.data.bySeverity);
      return true;
    } catch (error) {
      console.error('❌ Anti-national alerts test failed:', error.message);
      return false;
    }
  }

  // Test dashboard endpoint
  async testDashboard() {
    console.log('\n📊 Testing Dashboard Endpoint...');
    try {
      const response = await axios.get(`${API_BASE}/dashboard`);
      console.log('✅ Dashboard data loaded');
      console.log('Overview:', response.data.data.overview);
      return true;
    } catch (error) {
      console.error('❌ Dashboard test failed:', error.message);
      return false;
    }
  }

  // Test tweet processing with AI
  async testTweetProcessing() {
    console.log('\n🤖 Testing AI Tweet Processing...');
    
    for (let i = 0; i < testTweets.length; i++) {
      const tweet = testTweets[i];
      console.log(`\n--- Test ${i + 1}: ${tweet.expected} ---`);
      console.log(`Tweet: "${tweet.text}"`);
      
      try {
        const response = await axios.post(`${API_BASE}/process-tweet`, {
          text: tweet.text,
          author: tweet.author,
          location: tweet.location,
          timestamp: new Date().toISOString()
        });

        if (response.data.success && response.data.data) {
          const result = response.data.data;
          console.log('✅ Processing Result:');
          console.log(`   District: ${result.district || 'Not identified'}`);
          console.log(`   Sentiment: ${result.sentiment}`);
          console.log(`   Confidence: ${result.confidence || 'N/A'}%`);
          console.log(`   Threat Level: ${result.threatLevel || 'N/A'}`);
          console.log(`   Source: ${result.source}`);
          
          if (result.antiNationalAlert) {
            console.log('🚨 ANTI-NATIONAL ALERT GENERATED:');
            console.log(`   Severity: ${result.antiNationalAlert.severity}`);
            console.log(`   Confidence: ${result.antiNationalAlert.confidence}%`);
          }
        } else {
          console.log('⚠️ No district identified or processing failed');
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Tweet processing failed: ${error.message}`);
        if (error.response?.data) {
          console.error('Error details:', error.response.data);
        }
      }
    }
  }

  // Run all tests
  async runAllTests() {
    console.log('🚀 Starting Geo-Sentiment Development Tests...');
    console.log(`Testing server at: ${BASE_URL}`);
    
    const tests = [
      { name: 'Server Health', fn: () => this.testHealth() },
      { name: 'Districts', fn: () => this.testDistricts() },
      { name: 'Heat Map', fn: () => this.testHeatMap() },
      { name: 'Anti-National Alerts', fn: () => this.testAntiNationalAlerts() },
      { name: 'Dashboard', fn: () => this.testDashboard() },
      { name: 'AI Tweet Processing', fn: () => this.testTweetProcessing() }
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      try {
        const result = await test.fn();
        if (result) {
          passed++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`❌ Test "${test.name}" crashed:`, error.message);
        failed++;
      }
    }

    console.log('\n📋 Test Summary:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${passed + failed}`);

    if (failed === 0) {
      console.log('\n🎉 All tests passed! Your geo-sentiment system is ready for development.');
    } else {
      console.log('\n⚠️ Some tests failed. Check the errors above.');
    }
  }
}

// Run tests if script is executed directly
if (require.main === module) {
  const tester = new GeoSentimentTester();
  
  // Wait a bit for server to start
  console.log('⏳ Waiting 3 seconds for server to start...');
  setTimeout(() => {
    tester.runAllTests().catch(error => {
      console.error('💥 Test suite crashed:', error);
      process.exit(1);
    });
  }, 3000);
}

module.exports = GeoSentimentTester;
