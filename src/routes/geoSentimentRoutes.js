const express = require('express');
const router = express.Router();
const GeoSentimentService = require('../services/geoSentimentService');

// Initialize geo-sentiment service
const geoSentimentService = new GeoSentimentService();

// Get district sentiment heat map
router.get('/heatmap', (req, res) => {
  try {
    const heatMapData = geoSentimentService.getDistrictSentimentHeatMap();
    
    res.json({
      success: true,
      data: heatMapData,
      totalDistricts: heatMapData.length,
      timestamp: new Date(),
      description: "District-wise sentiment heat map for Madhya Pradesh"
    });
  } catch (error) {
    console.error('Error getting heat map:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get heat map data',
      message: error.message
    });
  }
});

// Get anti-national alerts summary
router.get('/anti-national-alerts', (req, res) => {
  try {
    const alertsSummary = geoSentimentService.getAntiNationalAlertsSummary();
    
    res.json({
      success: true,
      data: alertsSummary,
      timestamp: new Date(),
      description: "Anti-national sentiment alerts and threats detected"
    });
  } catch (error) {
    console.error('Error getting anti-national alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get anti-national alerts',
      message: error.message
    });
  }
});

// Get district-wise statistics
router.get('/district-statistics', (req, res) => {
  try {
    const districtStats = geoSentimentService.getDistrictStatistics();
    
    res.json({
      success: true,
      data: districtStats,
      totalDistricts: Object.keys(districtStats).length,
      timestamp: new Date(),
      description: "Detailed district-wise sentiment statistics"
    });
  } catch (error) {
    console.error('Error getting district statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get district statistics',
      message: error.message
    });
  }
});

// Get specific district data
router.get('/district/:districtName', (req, res) => {
  try {
    const districtName = req.params.districtName;
    const districtStats = geoSentimentService.getDistrictStatistics();
    
    if (!districtStats[districtName]) {
      return res.status(404).json({
        success: false,
        error: 'District not found',
        message: `District '${districtName}' not found in Madhya Pradesh`
      });
    }
    
    res.json({
      success: true,
      data: districtStats[districtName],
      timestamp: new Date(),
      description: `Sentiment data for ${districtName} district`
    });
  } catch (error) {
    console.error('Error getting district data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get district data',
      message: error.message
    });
  }
});

// Get critical alerts (high priority)
router.get('/critical-alerts', (req, res) => {
  try {
    const alertsSummary = geoSentimentService.getAntiNationalAlertsSummary();
    const criticalAlerts = alertsSummary.critical;
    
    res.json({
      success: true,
      data: {
        alerts: criticalAlerts,
        count: criticalAlerts.length,
        severity: 'CRITICAL',
        description: 'Critical anti-national threats requiring immediate attention'
      },
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error getting critical alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get critical alerts',
      message: error.message
    });
  }
});

// Process tweet for geo-sentiment analysis
router.post('/process-tweet', (req, res) => {
  try {
    const { text, author, timestamp, location } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Tweet text is required'
      });
    }
    
    const result = geoSentimentService.processTweet({
      text,
      author: author || 'Unknown',
      timestamp: timestamp || new Date(),
      location: location || ''
    });
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date(),
      description: "Tweet processed for geo-sentiment analysis"
    });
  } catch (error) {
    console.error('Error processing tweet:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process tweet',
      message: error.message
    });
  }
});

// Get real-time sentiment dashboard data
router.get('/dashboard', (req, res) => {
  try {
    const heatMapData = geoSentimentService.getDistrictSentimentHeatMap();
    const alertsSummary = geoSentimentService.getAntiNationalAlertsSummary();
    const districtStats = geoSentimentService.getDistrictStatistics();
    
    // Calculate overall statistics
    const totalTweets = Object.values(districtStats).reduce((sum, district) => sum + district.totalTweets, 0);
    const totalAntiNational = Object.values(districtStats).reduce((sum, district) => sum + district.sentiment.anti_national, 0);
    const highRiskDistricts = Object.values(districtStats).filter(district => district.riskLevel === 'HIGH').length;
    
    res.json({
      success: true,
      data: {
        overview: {
          totalTweets,
          totalAntiNational,
          antiNationalPercentage: totalTweets > 0 ? (totalAntiNational / totalTweets) * 100 : 0,
          highRiskDistricts,
          totalDistricts: Object.keys(districtStats).length,
          lastUpdated: new Date()
        },
        heatMap: heatMapData,
        alerts: alertsSummary,
        districts: districtStats
      },
      timestamp: new Date(),
      description: "Real-time geo-sentiment dashboard data"
    });
  } catch (error) {
    console.error('Error getting dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard data',
      message: error.message
    });
  }
});

// Get MP districts list
router.get('/districts', (req, res) => {
  try {
    const mpDistricts = require('../data/mpDistricts');
    
    const districtsList = Object.keys(mpDistricts).map(name => ({
      name,
      id: mpDistricts[name].id,
      coordinates: mpDistricts[name].coordinates,
      keywords: mpDistricts[name].keywords,
      neighboring: mpDistricts[name].neighboring
    }));
    
    res.json({
      success: true,
      data: districtsList,
      totalDistricts: districtsList.length,
      timestamp: new Date(),
      description: "Complete list of Madhya Pradesh districts"
    });
  } catch (error) {
    console.error('Error getting districts list:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get districts list',
      message: error.message
    });
  }
});

module.exports = router;
