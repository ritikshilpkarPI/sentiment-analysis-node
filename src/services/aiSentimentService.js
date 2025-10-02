const axios = require('axios');
require('dotenv').config();

class AISentimentService {
  constructor() {
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiApiKey}`;
    
    // Log API key status
    if (this.geminiApiKey) {
        console.log(`[AI_SENTIMENT] API key loaded: ${this.geminiApiKey}`);
    } else {
        console.log(`[AI_SENTIMENT] ❌ GEMINI_API_KEY not found in environment variables`);
    }
  }

  // Analyze anti-national sentiment using Gemini AI
  async analyzeAntiNationalSentiment(tweetText, author, location = '') {
    try {
      const prompt = this.createAntiNationalAnalysisPrompt(tweetText, author, location);
      
      const response = await axios.post(this.apiEndpoint, {
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const aiResponse = response.data.candidates[0].content.parts[0].text;
      return this.parseAntiNationalResponse(aiResponse, tweetText, author, location);
      
    } catch (error) {
      console.error('Error analyzing anti-national sentiment with AI:', error);
      return {
        isAntiNational: false,
        severity: 'UNKNOWN',
        confidence: 0,
        threats: [],
        reasoning: 'AI analysis failed',
        error: error.message
      };
    }
  }

  // Create comprehensive prompt for anti-national analysis
  createAntiNationalAnalysisPrompt(tweetText, author, location) {
    return `
ANTI-NATIONAL SENTIMENT ANALYSIS FOR SECURITY MONITORING

Analyze the following social media content for anti-national sentiment, threats to national security, and potential risks:

CONTENT TO ANALYZE:
Text: "${tweetText}"
Author: "${author}"
Location: "${location}"

ANALYSIS FRAMEWORK:
1. THREAT CATEGORIES:
   - Direct threats to national security
   - Separatist movements and propaganda
   - Anti-constitutional activities
   - Religious extremism and communal incitement
   - Violence and terrorism promotion
   - Anti-security forces sentiment
   - Economic sabotage attempts
   - Foreign propaganda and influence operations
   - Social unrest incitement
   - Regional separatist content

2. SEVERITY LEVELS:
   - CRITICAL: Immediate threat requiring urgent action
   - HIGH: Serious threat to law and order
   - MEDIUM: Potential threat requiring monitoring
   - LOW: Minor concern or regional discontent
   - NONE: No anti-national content detected

3. CONTEXT CONSIDERATIONS:
   - Historical context and current events
   - Regional sensitivities (all Indian states and regions)
   - Cultural and religious context
   - Sarcasm vs genuine threat
   - News reporting vs propaganda
   - Political criticism vs anti-national sentiment

REQUIRED OUTPUT FORMAT (JSON):
{
  "isAntiNational": boolean,
  "severity": "CRITICAL|HIGH|MEDIUM|LOW|NONE",
  "confidence": 0-100,
  "threats": [
    {
      "category": "threat category",
      "description": "specific threat identified",
      "keywords": ["relevant", "keywords", "found"],
      "risk_level": "CRITICAL|HIGH|MEDIUM|LOW"
    }
  ],
  "geo_relevance": {
    "mp_specific": boolean,
    "districts_mentioned": ["district names if any"],
    "regional_impact": "description"
  },
  "reasoning": "detailed explanation of analysis",
  "recommended_action": "immediate|monitor|investigate|no_action",
  "false_positive_check": {
    "is_news_report": boolean,
    "is_sarcasm": boolean,
    "is_political_criticism": boolean,
    "is_legitimate_concern": boolean
  }
}

IMPORTANT GUIDELINES:
- Be extremely careful about false positives
- Distinguish between legitimate political criticism and anti-national sentiment
- Consider context, sarcasm, and intent
- Focus on actual threats rather than opinions
- Pay special attention to all Indian regional contexts
- Consider the source credibility and author context

Analyze the content and provide the JSON response:`;
  }

  // Parse AI response for anti-national analysis
  parseAntiNationalResponse(aiResponse, tweetText, author, location) {
    try {
      // Extract JSON from AI response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const analysis = JSON.parse(jsonMatch[0]);
      
      // Validate and enhance the response
      return {
        id: `ai_analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tweetText,
        author,
        location,
        timestamp: new Date(),
        isAntiNational: analysis.isAntiNational || false,
        severity: analysis.severity || 'NONE',
        confidence: Math.min(Math.max(analysis.confidence || 0, 0), 100),
        threats: analysis.threats || [],
        geoRelevance: analysis.geo_relevance || {},
        reasoning: analysis.reasoning || 'No reasoning provided',
        recommendedAction: analysis.recommended_action || 'no_action',
        falsePositiveCheck: analysis.false_positive_check || {},
        aiModel: 'gemini-2.0-flash',
        analysisVersion: '1.0'
      };
      
    } catch (error) {
      console.error('Error parsing AI response:', error);
      return {
        isAntiNational: false,
        severity: 'UNKNOWN',
        confidence: 0,
        threats: [],
        reasoning: `Parse error: ${error.message}`,
        error: 'Failed to parse AI response'
      };
    }
  }

  // Analyze general sentiment with geo-context
  async analyzeGeoSentiment(tweetText, author, location = '') {
    try {
      const prompt = this.createGeoSentimentPrompt(tweetText, author, location);
      
      const response = await axios.post(this.apiEndpoint, {
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const aiResponse = response.data.candidates[0].content.parts[0].text;
      return this.parseGeoSentimentResponse(aiResponse, tweetText, author, location);
      
    } catch (error) {
      console.error('Error analyzing geo-sentiment with AI:', error);
      return {
        sentiment: 'neutral',
        confidence: 0,
        district: null,
        error: error.message
      };
    }
  }

  // Create prompt for geo-sentiment analysis
  createGeoSentimentPrompt(tweetText, author, location) {
    return `
GEO-SENTIMENT ANALYSIS FOR INDIA

Analyze the following content for sentiment and geographical relevance to Indian cities, districts, and states:

CONTENT:
Text: "${tweetText}"
Author: "${author}"
Location: "${location}"

MAJOR INDIAN CITIES & LOCATIONS TO CONSIDER:
METROS: Mumbai, Delhi, Bangalore, Hyderabad, Chennai, Kolkata, Pune, Ahmedabad
CAPITALS: New Delhi, Mumbai, Kolkata, Chennai, Bangalore, Hyderabad, Pune, Jaipur, Lucknow, Bhopal, Gandhinagar, Thiruvananthapuram, Panaji, Chandigarh, Shimla, Dehradun, Ranchi, Patna, Bhubaneswar, Raipur, Imphal, Kohima, Itanagar, Dispur, Aizawl, Agartala, Gangtok
MADHYA PRADESH: Bhopal, Indore, Gwalior, Jabalpur, Ujjain, Sagar, Rewa, Satna, Morena, Bhind, Chhatarpur, Panna, Damoh, Katni, Umaria, Shahdol, Sidhi, Singrauli
UTTAR PRADESH: Lucknow, Kanpur, Agra, Varanasi, Meerut, Allahabad, Bareilly, Moradabad, Aligarh, Gorakhpur, Noida, Ghaziabad
MAHARASHTRA: Mumbai, Pune, Nagpur, Nashik, Aurangabad, Solapur, Amravati, Kolhapur, Sangli, Thane
RAJASTHAN: Jaipur, Jodhpur, Udaipur, Kota, Bikaner, Ajmer, Alwar, Bharatpur
GUJARAT: Ahmedabad, Surat, Vadodara, Rajkot, Bhavnagar, Jamnagar, Gandhinagar
KARNATAKA: Bangalore, Mysore, Hubli, Mangalore, Belgaum, Gulbarga, Shimoga
TAMIL NADU: Chennai, Coimbatore, Madurai, Salem, Tiruchirappalli, Tirunelveli
WEST BENGAL: Kolkata, Howrah, Durgapur, Asansol, Siliguri
KERALA: Thiruvananthapuram, Kochi, Kozhikode, Thrissur, Kollam
ANDHRA PRADESH/TELANGANA: Hyderabad, Visakhapatnam, Vijayawada, Guntur, Nellore, Kurnool, Rajahmundry, Tirupati, Warangal, Nizamabad
PUNJAB: Chandigarh, Ludhiana, Amritsar, Jalandhar, Patiala
HARYANA: Gurgaon, Faridabad, Panipat, Ambala, Karnal
BIHAR: Patna, Gaya, Bhagalpur, Muzaffarpur, Darbhanga
ODISHA: Bhubaneswar, Cuttack, Rourkela, Berhampur
ASSAM: Guwahati, Dibrugarh, Jorhat, Silchar
INTERNATIONAL: Pakistan, Bangladesh, China, Nepal, Sri Lanka, Afghanistan, Myanmar

ANALYSIS REQUIRED:
1. Sentiment: Choose one from positive, negative, neutral, sarcastic, religious, funny, provocative
2. Location relevance: which Indian city/district/state if any
3. Local context: government, infrastructure, social issues, etc.
4. Confidence level: 0-100

OUTPUT FORMAT (JSON):
{
  "sentiment": "positive|negative|neutral",
  "confidence": 0-100,
  "district": "location_name or null",
  "districts_mentioned": ["list of locations mentioned"],
  "local_context": {
    "government_related": boolean,
    "infrastructure": boolean,
    "social_issues": boolean,
    "economic": boolean,
    "cultural": boolean
  },
  "sentiment_intensity": "very_positive|positive|neutral|negative|very_negative",
  "reasoning": "explanation of analysis"
}

Analyze and provide JSON response:`;
  }

  // Parse geo-sentiment response
  parseGeoSentimentResponse(aiResponse, tweetText, author, location) {
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const analysis = JSON.parse(jsonMatch[0]);
      
      return {
        id: `geo_analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tweetText,
        author,
        location,
        timestamp: new Date(),
        sentiment: analysis.sentiment || 'neutral',
        confidence: Math.min(Math.max(analysis.confidence || 0, 0), 100),
        district: analysis.district,
        districtsMentioned: analysis.districts_mentioned || [],
        localContext: analysis.local_context || {},
        sentimentIntensity: analysis.sentiment_intensity || 'neutral',
        reasoning: analysis.reasoning || 'No reasoning provided',
        aiModel: 'gemini-2.0-flash'
      };
      
    } catch (error) {
      console.error('Error parsing geo-sentiment response:', error);
      return {
        sentiment: 'neutral',
        confidence: 0,
        district: null,
        error: `Parse error: ${error.message}`
      };
    }
  }

  // Comprehensive analysis combining both anti-national and geo-sentiment
  async comprehensiveAnalysis(tweetText, author, location = '') {
    try {
      console.log(`🤖 [AI_ANALYSIS] Starting comprehensive analysis for: ${tweetText.substring(0, 50)}...`);
      
      // Run both analyses in parallel for efficiency
      const [antiNationalResult, geoSentimentResult] = await Promise.all([
        this.analyzeAntiNationalSentiment(tweetText, author, location),
        this.analyzeGeoSentiment(tweetText, author, location)
      ]);

      const combinedResult = {
        id: `comprehensive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tweetText,
        author,
        location,
        timestamp: new Date(),
        antiNational: antiNationalResult,
        geoSentiment: geoSentimentResult,
        overallThreatLevel: this.calculateOverallThreatLevel(antiNationalResult, geoSentimentResult),
        requiresAttention: this.requiresAttention(antiNationalResult, geoSentimentResult)
      };

      console.log(`✅ [AI_ANALYSIS] Complete - Threat: ${combinedResult.overallThreatLevel}, District: ${geoSentimentResult.district}`);
      
      return combinedResult;
      
    } catch (error) {
      console.error('Error in comprehensive analysis:', error);
      return {
        error: error.message,
        timestamp: new Date(),
        tweetText,
        author,
        location
      };
    }
  }

  // Calculate overall threat level
  calculateOverallThreatLevel(antiNationalResult, geoSentimentResult) {
    if (antiNationalResult.severity === 'CRITICAL') return 'CRITICAL';
    if (antiNationalResult.severity === 'HIGH') return 'HIGH';
    if (antiNationalResult.severity === 'MEDIUM') return 'MEDIUM';
    if (geoSentimentResult.sentiment === 'negative' && geoSentimentResult.confidence > 80) return 'LOW';
    return 'NONE';
  }

  // Determine if content requires attention
  requiresAttention(antiNationalResult, geoSentimentResult) {
    return antiNationalResult.isAntiNational || 
           antiNationalResult.severity !== 'NONE' || 
           (geoSentimentResult.sentiment === 'negative' && geoSentimentResult.confidence > 90);
  }
}

module.exports = AISentimentService;
