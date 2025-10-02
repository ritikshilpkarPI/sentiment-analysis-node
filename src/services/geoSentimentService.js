const mpDistricts = require('../data/mpDistricts');
const AISentimentService = require('./aiSentimentService');

class GeoSentimentService {
  constructor() {
    this.districtSentimentData = {};
    this.antiNationalAlerts = [];
    this.aiSentimentService = new AISentimentService();
    this.initializeDistrictData();
  }

  // Initialize district sentiment tracking
  initializeDistrictData() {
    Object.keys(mpDistricts).forEach(districtName => {
      this.districtSentimentData[districtName] = {
        name: districtName,
        id: mpDistricts[districtName].id,
        coordinates: mpDistricts[districtName].coordinates,
        sentiment: {
          positive: 0,
          negative: 0,
          neutral: 0,
          anti_national: 0
        },
        totalTweets: 0,
        lastUpdated: new Date(),
        keywords: mpDistricts[districtName].keywords,
        alerts: []
      };
    });
  }

  // Extract district from tweet content
  extractDistrictFromTweet(tweetText, userLocation = '') {
    const text = (tweetText + ' ' + userLocation).toLowerCase();
    
    // Check for direct district mentions
    for (const [districtName, districtData] of Object.entries(mpDistricts)) {
      for (const keyword of districtData.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          return districtName;
        }
      }
    }

    // Check for neighboring districts context
    for (const [districtName, districtData] of Object.entries(mpDistricts)) {
      if (districtData.neighboring) {
        for (const neighbor of districtData.neighboring) {
          if (text.includes(neighbor.toLowerCase())) {
            return districtName; // Assign to main district
          }
        }
      }
    }

    return null; // No district identified
  }

  // Analyze anti-national sentiment using AI
  async analyzeAntiNationalSentiment(tweetText, author, timestamp, location = '') {
    try {
      console.log(`🤖 [GEO_AI] Analyzing anti-national sentiment: ${tweetText.substring(0, 50)}...`);
      
      const aiResult = await this.aiSentimentService.analyzeAntiNationalSentiment(tweetText, author, location);
      
      if (aiResult.isAntiNational && aiResult.severity !== 'NONE') {
        const alert = {
          id: `ai_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          tweetText,
          author,
          timestamp,
          location,
          district: this.extractDistrictFromTweet(tweetText, location),
          aiAnalysis: aiResult,
          severity: aiResult.severity,
          confidence: aiResult.confidence,
          threats: aiResult.threats,
          recommendedAction: aiResult.recommendedAction,
          status: 'ACTIVE',
          createdAt: new Date(),
          source: 'AI_ANALYSIS'
        };

        this.antiNationalAlerts.push(alert);
        console.log(`🚨 [GEO_AI] Anti-national alert created - Severity: ${alert.severity}, Confidence: ${alert.confidence}%`);
        return alert;
      }

      console.log(`✅ [GEO_AI] No anti-national content detected`);
      return null;
      
    } catch (error) {
      console.error('Error in AI anti-national analysis:', error);
      return null;
    }
  }

  // Update district sentiment
  updateDistrictSentiment(districtName, sentiment, isAntiNational = false) {
    if (!this.districtSentimentData[districtName]) {
      return;
    }

    const district = this.districtSentimentData[districtName];
    district.totalTweets++;
    district.lastUpdated = new Date();

    if (isAntiNational) {
      district.sentiment.anti_national++;
    } else {
      district.sentiment[sentiment]++;
    }

    // Add alert if anti-national
    if (isAntiNational) {
      district.alerts.push({
        timestamp: new Date(),
        severity: 'HIGH',
        count: 1
      });
    }
  }

  // Get district sentiment heat map data
  getDistrictSentimentHeatMap() {
    const heatMapData = [];

    Object.values(this.districtSentimentData).forEach(district => {
      const total = district.sentiment.positive + district.sentiment.negative + district.sentiment.neutral;
      
      if (total > 0) {
        const sentimentScore = (district.sentiment.positive - district.sentiment.negative) / total;
        const antiNationalRatio = district.sentiment.anti_national / total;
        
        // Calculate heat intensity (0-1)
        let heatIntensity = 0.5; // Neutral base
        
        if (antiNationalRatio > 0.1) {
          heatIntensity = 1.0; // High threat (red)
        } else if (antiNationalRatio > 0.05) {
          heatIntensity = 0.8; // Medium threat (orange)
        } else if (sentimentScore > 0.3) {
          heatIntensity = 0.2; // Positive sentiment (green)
        } else if (sentimentScore < -0.3) {
          heatIntensity = 0.7; // Negative sentiment (red-orange)
        }

        heatMapData.push({
          id: district.id,
          name: district.name,
          coordinates: district.coordinates,
          sentiment: district.sentiment,
          totalTweets: district.totalTweets,
          sentimentScore,
          antiNationalRatio,
          heatIntensity,
          color: this.getHeatMapColor(heatIntensity, antiNationalRatio),
          lastUpdated: district.lastUpdated
        });
      }
    });

    return heatMapData.sort((a, b) => b.heatIntensity - a.heatIntensity);
  }

  // Get heat map color based on intensity and anti-national ratio
  getHeatMapColor(heatIntensity, antiNationalRatio) {
    if (antiNationalRatio > 0.1) {
      return '#FF0000'; // Red - Critical threat
    } else if (antiNationalRatio > 0.05) {
      return '#FF4500'; // Orange Red - High threat
    } else if (heatIntensity > 0.7) {
      return '#00FF00'; // Green - Very positive
    } else if (heatIntensity > 0.5) {
      return '#90EE90'; // Light Green - Positive
    } else if (heatIntensity > 0.3) {
      return '#FFFF00'; // Yellow - Neutral-positive
    } else if (heatIntensity > 0.1) {
      return '#FFA500'; // Orange - Negative
    } else {
      return '#FF0000'; // Red - Very negative
    }
  }

  // Get anti-national alerts summary
  getAntiNationalAlertsSummary() {
    const summary = {
      total: this.antiNationalAlerts.length,
      bySeverity: {},
      byDistrict: {},
      recent: this.antiNationalAlerts.slice(-10).reverse(),
      critical: this.antiNationalAlerts.filter(alert => alert.severity === 'CRITICAL'),
      active: this.antiNationalAlerts.filter(alert => alert.status === 'ACTIVE')
    };

    // Count by severity
    Object.keys(severityLevels).forEach(level => {
      summary.bySeverity[level] = this.antiNationalAlerts.filter(alert => alert.severity === level).length;
    });

    // Count by district
    Object.keys(mpDistricts).forEach(district => {
      summary.byDistrict[district] = this.antiNationalAlerts.filter(alert => alert.district === district).length;
    });

    return summary;
  }

  // Process tweet for geo-sentiment analysis using AI
  async processTweet(tweetData) {
    try {
      const { text, author, timestamp, location } = tweetData;
      
      console.log(`🔍 [GEO_PROCESS] Processing tweet: ${text.substring(0, 50)}...`);
      
      // Use AI for comprehensive analysis
      const aiAnalysis = await this.aiSentimentService.comprehensiveAnalysis(text, author, location);
      
      if (aiAnalysis.error) {
        console.error('AI analysis failed, falling back to basic analysis');
        return this.processTweetBasic(tweetData);
      }

      // Extract district from AI analysis or fallback to basic extraction
      let district = aiAnalysis.geoSentiment.district;
      if (!district) {
        district = this.extractDistrictFromTweet(text, location);
      }
      
      if (!district) {
        console.log(`⚠️ [GEO_PROCESS] No district identified for tweet, but saving geo-sentiment data...`);
        // Save geo-sentiment data even without district for complete analytics
        return {
          district: 'Unknown',
          sentiment: aiAnalysis.geoSentiment.sentiment || 'neutral',
          threatLevel: aiAnalysis.antiNational.isAntiNational ? aiAnalysis.antiNational.severity : 'NONE',
          confidence: aiAnalysis.geoSentiment.confidence || aiAnalysis.antiNational.confidence || 0,
          aiAnalysis: aiAnalysis,
          requiresAttention: aiAnalysis.antiNational.isAntiNational || false,
          source: 'AI_ANALYSIS_NO_DISTRICT'
        };
      }

      // Determine final sentiment
      let sentiment = aiAnalysis.geoSentiment.sentiment;
      if (aiAnalysis.antiNational.isAntiNational) {
        sentiment = 'anti_national';
      }

      // Create anti-national alert if detected
      let antiNationalAlert = null;
      if (aiAnalysis.antiNational.isAntiNational) {
        antiNationalAlert = await this.analyzeAntiNationalSentiment(text, author, timestamp, location);
      }

      // Update district sentiment
      this.updateDistrictSentiment(district, sentiment, !!antiNationalAlert);

      const result = {
        district,
        sentiment,
        confidence: aiAnalysis.geoSentiment.confidence,
        antiNationalAlert,
        aiAnalysis,
        threatLevel: aiAnalysis.overallThreatLevel,
        requiresAttention: aiAnalysis.requiresAttention,
        processedAt: new Date(),
        source: 'AI_POWERED'
      };

      console.log(`✅ [GEO_PROCESS] Processed - District: ${district}, Sentiment: ${sentiment}, Threat: ${result.threatLevel}`);
      return result;
      
    } catch (error) {
      console.error('Error in AI tweet processing, falling back to basic:', error);
      return this.processTweetBasic(tweetData);
    }
  }

  // Fallback basic processing method
  processTweetBasic(tweetData) {
    const { text, author, timestamp, location } = tweetData;
    
    // Extract district
    const district = this.extractDistrictFromTweet(text, location);
    
    if (!district) {
      return null; // No district identified
    }

    // Basic sentiment analysis (simplified)
    let sentiment = 'neutral';
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'अच्छा', 'बहुत अच्छा'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'worst', 'बुरा', 'भयानक'];
    
    const textLower = text.toLowerCase();
    const positiveCount = positiveWords.filter(word => textLower.includes(word)).length;
    const negativeCount = negativeWords.filter(word => textLower.includes(word)).length;
    
    if (positiveCount > negativeCount) {
      sentiment = 'positive';
    } else if (negativeCount > positiveCount) {
      sentiment = 'negative';
    }

    // Update district sentiment
    this.updateDistrictSentiment(district, sentiment, false);

    return {
      district,
      sentiment,
      confidence: 50, // Basic confidence
      antiNationalAlert: null,
      processedAt: new Date(),
      source: 'BASIC_FALLBACK'
    };
  }

  // Get district-wise sentiment statistics
  getDistrictStatistics() {
    const stats = {};
    
    Object.values(this.districtSentimentData).forEach(district => {
      const total = district.sentiment.positive + district.sentiment.negative + district.sentiment.neutral;
      
      if (total > 0) {
        stats[district.name] = {
          ...district,
          sentimentPercentage: {
            positive: (district.sentiment.positive / total) * 100,
            negative: (district.sentiment.negative / total) * 100,
            neutral: (district.sentiment.neutral / total) * 100,
            anti_national: (district.sentiment.anti_national / total) * 100
          },
          riskLevel: district.sentiment.anti_national > 5 ? 'HIGH' : 
                    district.sentiment.anti_national > 2 ? 'MEDIUM' : 'LOW'
        };
      }
    });

    return stats;
  }
}

module.exports = GeoSentimentService;
