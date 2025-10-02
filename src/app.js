require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const xml2js = require('xml2js');
const https = require('https');
const http = require('http');
const { Team, Keyword, Tweet, Topic, Sentiment, Result, Company, News } = require('./models');
const DbService = require('./services/dbService');

const app = express();
const PORT = process.env.PORT || 9000;

// API Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// Log API key status
if (GEMINI_API_KEY) {
    console.log(`[API] Gemini API key loaded: ${GEMINI_API_KEY}`);
} else {
    console.log(`[API] ❌ GEMINI_API_KEY not found in environment variables`);
}

// File paths
const LAST_TWEET_COUNT_FILE = path.join(__dirname, '..', 'last_tweet_count.txt');
const TWEETS_INPUT_FILE = path.join(__dirname, '..', 'tweets_output.md'); // Old single input file (deprecated)
const TWEETS_INPUT_DIR = path.join(__dirname, '..', 'python-scraper', 'output'); // Directory for raw scraper output
const RESULTS_OUTPUT_FILE = path.join(__dirname, '..', 'sentiment_results.md');
const TOPIC_OUTPUT_FILE = path.join(__dirname, '..', 'topic.md');
const RESULTS_OUTPUT_FILE_JSON = path.join(__dirname, '..', 'results.json');

// Security middleware
app.use((req, res, next) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';");
    
    // HTTPS redirect in production (only for HTTP requests)
    if (process.env.NODE_ENV === 'production' && 
        req.header('x-forwarded-proto') !== 'https' && 
        !req.secure) {
        return res.redirect(`https://${req.header('host')}${req.url}`);
    }
    
    next();
});

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'https://tweet-sentiments-client.netlify.app',
            'https://34.56.157.230:8443',
            'http://localhost:3000',
            'http://localhost:8081',
            'http://localhost:9000'
        ];
        
        // Add environment-based origins
        if (process.env.FRONTEND_URL) {
            allowedOrigins.push(process.env.FRONTEND_URL);
        }
        if (process.env.ALLOWED_ORIGINS) {
            allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(','));
        }
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

// Middleware
app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Route - Should be first
app.get('/health', async (req, res) => {
    const healthCheck = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: require('../package.json').version,
        port: PORT,
        services: {
            database: 'OK',
            gemini_api: 'OK',
            scraper: 'OK'
        },
        system: {
            memory: process.memoryUsage(),
            platform: process.platform,
            nodeVersion: process.version
        }
    };

    try {
        // Test database connection
        const { sequelize } = require('./models');
        await sequelize.authenticate();
        healthCheck.services.database = 'OK';
    } catch (error) {
        healthCheck.services.database = 'ERROR';
        healthCheck.status = 'DEGRADED';
    }

    // Test if tweets processing is active
    healthCheck.services.tweet_processing = isProcessingTweets ? 'ACTIVE' : 'IDLE';
    
    // Test scraper server connection
    try {
        const scraperResponse = await axios.get('http://localhost:9999/health', { timeout: 2000 });
        healthCheck.services.scraper = 'OK';
    } catch (error) {
        healthCheck.services.scraper = 'ERROR';
    }

    const statusCode = healthCheck.status === 'OK' ? 200 : 503;
    res.status(statusCode).json(healthCheck);
});

// Readiness probe for Kubernetes/Docker
app.get('/ready', async (req, res) => {
    try {
        const { sequelize } = require('./models');
        await sequelize.authenticate();
        res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
    } catch (error) {
        res.status(503).json({ status: 'not ready', error: error.message });
    }
});

// Liveness probe
app.get('/alive', (req, res) => {
    res.status(200).json({ 
        status: 'alive', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Routes
app.use('/api/results', require('./routes/resultsRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/companies', require('./routes/companyRoutes'));
app.use('/api/teams', require('./routes/teamRoutes'));
app.use('/api/geo-sentiment', require('./routes/geoSentimentRoutes'));

// Route to get all results from JSON file
app.get('/results', (req, res) => {
    try {
        if (!fs.existsSync(RESULTS_OUTPUT_FILE_JSON)) {
            return res.status(404).json({ error: 'No results found' });
        }

        const results = JSON.parse(fs.readFileSync(RESULTS_OUTPUT_FILE_JSON, 'utf-8'));
        res.json(results);
    } catch (error) {
        // ERROR Failed to read results
        res.status(500).json({ error: 'Failed to read results' });
    }
});

// Initialize database
DbService.initialize()
    .then(() => {
        console.log('Database initialized successfully');
    })
    .catch(err => {
        // Failed to initialize database
        process.exit(1);
    });

let isProcessingTweets = false;

// Helper function to get last processed tweet count (per keyword) - OLD SYSTEM
function getLastTweetCount(keyword = null) {
    const countFile = keyword ? `last_tweet_count_${keyword}.txt` : LAST_TWEET_COUNT_FILE;
    if (fs.existsSync(countFile)) {
        try {
            const data = fs.readFileSync(countFile, 'utf-8').trim();
            if (/^\d+$/.test(data)) {
                console.log(`[DEBUG] last_tweet_count read from disk for ${keyword || 'global'}: ${data}`);
                return parseInt(data, 10);
            }
        } catch (err) {
            console.log(`[DEBUG] Could not read ${countFile}: ${err}`);
        }
    }
    console.log(`[DEBUG] No valid last tweet count found for ${keyword || 'global'}. Starting from 0.`);
    return 0;
}

// Helper function to set last processed tweet count (per keyword) - OLD SYSTEM
function setLastTweetCount(count, keyword = null) {
    const countFile = keyword ? `last_tweet_count_${keyword}.txt` : LAST_TWEET_COUNT_FILE;
    console.log(`[DEBUG] Setting last tweet count to: ${count} for ${keyword || 'global'}`);
    fs.writeFileSync(countFile, String(count), 'utf-8');
}

// Helper function to add delays between API calls
async function addApiDelay(ms = 2000, reason = 'API call') {
    console.log(`[DELAY] Waiting ${ms}ms before ${reason}...`);
    await new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to get processed tweet IDs (per keyword) - NEW SYSTEM
function getProcessedTweetIds(keyword = null) {
    const idsFile = keyword ? `processed_tweet_ids_${keyword}.json` : 'processed_tweet_ids.json';
    if (fs.existsSync(idsFile)) {
        try {
            const data = fs.readFileSync(idsFile, 'utf-8');
            const ids = JSON.parse(data);
            console.log(`[DEBUG] Loaded ${ids.length} processed tweet IDs for ${keyword || 'global'}`);
            return new Set(ids);
        } catch (err) {
            console.log(`[DEBUG] Could not read ${idsFile}: ${err}`);
        }
    }
    console.log(`[DEBUG] No processed tweet IDs found for ${keyword || 'global'}. Starting fresh.`);
    return new Set();
}

// Helper function to save processed tweet IDs (per keyword)
function saveProcessedTweetIds(tweetIds, keyword = null) {
    const idsFile = keyword ? `processed_tweet_ids_${keyword}.json` : 'processed_tweet_ids.json';
    const idsArray = Array.from(tweetIds);
    console.log(`[DEBUG] Saving ${idsArray.length} processed tweet IDs for ${keyword || 'global'}`);
    fs.writeFileSync(idsFile, JSON.stringify(idsArray, null, 2), 'utf-8');
}

// Helper function to generate tweet ID from content
function generateTweetId(tweetContent, author, timestamp) {
    // Create a unique ID based on content, author, and timestamp
    const content = typeof tweetContent === 'string' ? tweetContent : tweetContent.content;
    const tweetAuthor = typeof tweetContent === 'object' ? tweetContent.author : author;
    const tweetTimestamp = typeof tweetContent === 'object' ? tweetContent.timestamp : timestamp;
    
    // Use first 100 chars of content + author + timestamp for ID
    const idString = `${content.substring(0, 100)}_${tweetAuthor}_${tweetTimestamp}`;
    return require('crypto').createHash('md5').update(idString).digest('hex');
}

// Helper function to read tweets from file
function readTweetsFromFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return [];
    }
    console.log(`[DEBUG] Reading tweets from: ${filePath}`);
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    const tweets = [];
    let currentTweet = { content: '', keyword: '', author: 'Unknown', timestamp: '', media: { images: [], videos: [] } };
    let inTweet = false;
    let inTextSection = false;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }
        
        // Start of new tweet
        if (trimmed.startsWith('## Tweet')) {
            // Save previous tweet if exists
            if (inTweet && currentTweet.content.trim()) {
                tweets.push(currentTweet);
            }
            
            // Start new tweet
            currentTweet = { content: '', keyword: '', author: 'Unknown', timestamp: '', media: { images: [], videos: [] } };
            inTweet = true;
            inTextSection = false;
            continue;
        }
        
        if (!inTweet) continue;
        
        // Handle different fields
        if (trimmed.startsWith('**Author:**')) {
            // Extract author name
            currentTweet.author = trimmed.replace('**Author:**', '').trim();
            continue;
        } else if (trimmed.startsWith('**Time:**')) {
            // Extract timestamp
            currentTweet.timestamp = trimmed.replace('**Time:**', '').trim();
            continue;
        } else if (trimmed.startsWith('**Text:**')) {
            // Start text section
            inTextSection = true;
            const textContent = trimmed.replace('**Text:**', '').trim();
            currentTweet.content = textContent;
        } else if (trimmed.startsWith('**Keyword:**')) {
            inTextSection = false;
            currentTweet.keyword = trimmed.replace('**Keyword:**', '').trim();
        } else if (trimmed.startsWith('**Images:**')) {
            inTextSection = false;
            // Just note that images are coming, don't create placeholders
            // The actual URLs will be parsed from the - Image lines
        } else if (trimmed.startsWith('**Videos:**')) {
            inTextSection = false;
            // Just note that videos are coming, don't create placeholders
            // The actual URLs will be parsed from the - Video lines
        } else if (trimmed.startsWith('- Image ') || trimmed.startsWith('- Video ')) {
            inTextSection = false;
            // Parse individual media URLs
            const mediaMatch = trimmed.match(/^- (Image|Video) \d+: (.+?)(?:\s+\(type: (.+)\))?$/);
            if (mediaMatch) {
                const [, type, url, mediaType] = mediaMatch;
                if (type === 'Image') {
                    currentTweet.media.images.push({ url, type: 'image' });
                } else if (type === 'Video') {
                    currentTweet.media.videos.push({ url, type: mediaType || 'video' });
                }
            }
        } else if (inTextSection && !trimmed.startsWith('**')) {
            // Add to content if we're in text section
            currentTweet.content += ' ' + trimmed;
        }
    }
    
    // Save last tweet
    if (inTweet && currentTweet.content.trim()) {
        tweets.push(currentTweet);
    }
    
    console.log(`[DEBUG] Found ${tweets.length} tweet lines in ${filePath}`);
    return tweets;
}

// Helper function to read existing topics
function readExistingTopics() {
    try {
        if (fs.existsSync(TOPIC_OUTPUT_FILE)) {
            const content = fs.readFileSync(TOPIC_OUTPUT_FILE, 'utf-8');
            return content.split('\n').filter(line => line.trim());
        }
    } catch (err) {
        // ERROR Failed to read topics
    }
    return [];
}

// Helper function to get sentiment prompt
function getSentimentPrompt(text, existingTopics) {
    const topicListStr = existingTopics.length > 0 
        ? existingTopics.map(t => `- ${t}`).join('\n')
        : 'None';

    return `Analyze the following tweet: "${text}".\n` +
        '1. Determine its sentiment. Respond with one of the following sentiments: Positive, Negative, Neutral, Sarcastic, Religious, Funny, Provocative.\n' +
        '2. Identify the topic or subject of the tweet.\n' +
        `   Here's a list of existing topics:\n${topicListStr}\n` +
        '   If the tweet matches or is closely related to any topic from the list below, return that exact topic string from the list (no rewording). Only generate a new topic if there is absolutely no match.\n' +
        '   When providing a topic, ensure it is **well-defined and descriptive**, making it clear what the tweet is about.\n' +
        '   For example, instead of \'Politics,\' say \'Government Policies on Climate Change\' if relevant.\n' +
        'Provide your response in the following format exactly:\n' +
        '- **Sentiment**: <Sentiment>\n' +
        '- **Topic**: <Well-defined and descriptive topic>';
}

// Helper function to map sentiment to valid database enum
function mapSentimentToValidEnum(sentiment) {
    const sentimentMap = {
        'POSITIVE': 'POSITIVE',
        'NEGATIVE': 'NEGATIVE',
        'NEUTRAL': 'NEUTRAL',
        'SARCASM': 'NEUTRAL',
        'RELIGIOUS': 'NEUTRAL',
        'FUNNY': 'POSITIVE',
        'PROVOCATIVE': 'NEGATIVE'
    };
    const mappedSentiment = sentimentMap[sentiment.toUpperCase()] || 'NEUTRAL';
    console.log(`[DEBUG] Mapping sentiment from ${sentiment} to ${mappedSentiment}`);
    return mappedSentiment;
}

// Helper function to call Gemini API
async function callGeminiApi(tweet) {
    try {
        const prompt = getSentimentPrompt(tweet, readExistingTopics());
        const response = await axios.post(API_ENDPOINT, {
            contents: [{
                parts: [{
                    text: prompt,
                }],
            }],
        }, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const data = response.data;
        let rawSentiment = 'NEUTRAL';
        let topic = 'Unknown';

        if (data.candidates && data.candidates[0] && data.candidates[0].content && 
            data.candidates[0].content.parts && data.candidates[0].content.parts[0] && 
            data.candidates[0].content.parts[0].text) {
            
            const rawResponse = data.candidates[0].content.parts[0].text.trim();
            console.log('[Gemini] Raw response:', rawResponse);

            // Extract sentiment and topic using regex
            const sentimentMatch = rawResponse.match(/\*\*Sentiment\*\*:\s*(.*)/);
            const topicMatch = rawResponse.match(/\*\*Topic\*\*:\s*(.*)/);

            rawSentiment = sentimentMatch ? sentimentMatch[1].trim() : 'NEUTRAL';
            topic = topicMatch ? topicMatch[1].trim() : 'Unknown';

            // Handle new topics
            if (topic !== 'Unknown') {
                const existingTopics = readExistingTopics();
                if (!existingTopics.includes(topic)) {
                    fs.appendFileSync(TOPIC_OUTPUT_FILE, topic + '\n', 'utf-8');
                    console.log(`[Gemini] New topic appended: ${topic}`);
                }
            }
        }

        // Map sentiment to valid database enum
        const sentiment = mapSentimentToValidEnum(rawSentiment);

        // Fetch news for the topic
        let news = [];
        if (topic !== 'Unknown') {
            console.log(`\nFetching news for topic: ${topic}`);
            news = await fetchGoogleNews(topic);
            for (const { title, link } of news) {
                console.log(`News: ${title}`);
                console.log(`Link: ${link}\n`);
            }
        }

        return { sentiment, topic, news };
    } catch (err) {
        // Gemini API error
        return { sentiment: 'NEUTRAL', topic: 'Unknown', news: [] };
    }
}

// Helper function to fetch Google News
async function fetchGoogleNews(topic, location = 'IN') {
    try {
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=en-${location}&gl=${location}&ceid=${location}:en`;
        const response = await axios.get(rssUrl);
        
        if (response.status === 200) {
            const parser = new xml2js.Parser();
            const result = await parser.parseStringPromise(response.data);
            
            if (result.rss && result.rss.channel && result.rss.channel[0].item) {
                return result.rss.channel[0].item.slice(0, 5).map(item => ({
                    title: item.title[0],
                    link: item.link[0]
                }));
            }
        }
        return [];
    } catch (error) {
        // ERROR Failed to fetch Google News
        return [];
    }
}

// Helper: Append results to file
function appendResultsToFile(results) {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    let output = `\n## Results at ${now}\n\n`;
    for (const [tweet, sentiment, topic, news] of results) {
        const singleLineTweet = tweet.replace(/\n/g, ' ');
        output += `- **Tweet**: ${singleLineTweet} - **Sentiment**: ${sentiment} - **Topic**: ${topic}\n`;
        if (news && news.length > 0) {
            output += '  **Related News**:\n';
            for (const { title, link } of news) {
                output += `  - [${title}](${link})\n`;
            }
        }
        output += '\n';
    }
    fs.appendFileSync(RESULTS_OUTPUT_FILE, output, 'utf-8');
    console.log(`[DEBUG] Appended ${results.length} results to ${RESULTS_OUTPUT_FILE}`);
}

// Helper: Append results to JSON file
function appendResultsToJson(results) {
    try {
        let data = {};
        if (fs.existsSync(RESULTS_OUTPUT_FILE_JSON) && fs.statSync(RESULTS_OUTPUT_FILE_JSON).size > 0) {
            try {
                data = JSON.parse(fs.readFileSync(RESULTS_OUTPUT_FILE_JSON, 'utf-8'));
            } catch (err) {
                // ERROR Failed to parse existing JSON
            }
        }
        for (const [tweet, sentiment, topic, news] of results) {
            if (!data[topic]) {
                data[topic] = [];
            }
            data[topic].push({
                tweet,
                sentiment,
                news: news.map(({ title, link }) => ({ title, link }))
            });
        }
        fs.writeFileSync(RESULTS_OUTPUT_FILE_JSON, JSON.stringify(data, null, 4), 'utf-8');
        console.log(`[DEBUG] Updated ${RESULTS_OUTPUT_FILE_JSON} with ${results.length} new results`);
    } catch (err) {
        // ERROR Failed to write to JSON file
    }
}

// Process new tweets for a specific keyword
async function processNewTweets(newTweets, keyword) {
    // Get default team and company
    const defaultTeam = await Team.findOne();
    const defaultCompany = await Company.findOne();

    if (!defaultTeam || !defaultCompany) {
        console.log('No default team or company found in the database');
        return;
    }

    let results = [];
    const batchSize = 5;
    const delayBetweenBatches = 60000; // 60 seconds
    const delayBetweenCalls = 5000; // 5 seconds

    // Process tweets in batches
    for (let i = 0; i < newTweets.length; i += batchSize) {
        const batch = newTweets.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(newTweets.length / batchSize);
        
        console.log(`[BATCH] Processing batch ${batchNumber}/${totalBatches} (${batch.length} tweets) for keyword: ${keyword}`);
        
        for (const tweetData of batch) {
        const tweet = typeof tweetData === 'string' ? tweetData : tweetData.content;
        const media = typeof tweetData === 'object' ? tweetData.media : { images: [], videos: [] };
        const author = typeof tweetData === 'object' ? tweetData.author : 'Unknown';
        
        // Enhanced analysis with Grok validation
        const GeminiService = require('./services/geminiService');
        
        // Add delay between API calls (except for first tweet in first batch)
        const tweetIndex = i + batch.indexOf(tweetData);
        if (tweetIndex > 0) {
            await addApiDelay(delayBetweenCalls, 'next API call');
        }
        
        const enhancedAnalysis = await GeminiService.analyzeSentimentWithGrokValidation(tweet);
        
        if (!enhancedAnalysis.finalSentiment) {
            console.log(`[DEBUG] Error processing tweet: ${tweet}`);
            continue;
        }

        // Analyze media content if present with Grok validation
        let mediaAnalysisResult = null;
        if (media && (media.images.length > 0 || media.videos.length > 0)) {
            await addApiDelay(delayBetweenCalls, 'media analysis');
            mediaAnalysisResult = await GeminiService.analyzeMediaContentWithGrokValidation(tweet, media);
        }

        // Fetch and validate news with Grok
        await addApiDelay(delayBetweenCalls, 'news validation');
        const newsValidation = await GeminiService.fetchAndValidateNewsWithGrok(enhancedAnalysis.finalTopic, tweet);

        // Geo-sentiment analysis (NEW)
        let geoAnalysisResult = null;
        try {
            const GeoSentimentService = require('./services/geoSentimentService');
            const geoSentimentService = new GeoSentimentService();
            
            console.log(`[GEO] Processing geo-sentiment analysis for tweet: ${tweet.substring(0, 50)}...`);
            
            geoAnalysisResult = await geoSentimentService.processTweet({
                text: tweet,
                author: author,
                timestamp: new Date(),
                location: '' // Let Gemini AI determine location from tweet content intelligently
            });
            
            if (geoAnalysisResult) {
                console.log(`[GEO] Analysis complete - District: ${geoAnalysisResult.district}, Sentiment: ${geoAnalysisResult.sentiment}, Threat: ${geoAnalysisResult.threatLevel}`);
            } else {
                console.log(`[GEO] No geo-analysis result (likely no district identified)`);
            }
        } catch (geoError) {
            console.error(`[GEO] Error in geo-sentiment analysis:`, geoError.message);
            // Continue processing even if geo-analysis fails
        }

        // Map sentiment to database format (consider geo-sentiment override)
        const validSentiments = ['POSITIVE', 'NEGATIVE', 'NEUTRAL', 'SARCASTIC', 'RELIGIOUS', 'FUNNY', 'PROVOCATIVE'];
        let finalSentiment = enhancedAnalysis.finalSentiment.toUpperCase();
        
        // Override sentiment if geo-analysis detected anti-national content
        if (geoAnalysisResult && geoAnalysisResult.sentiment === 'anti_national') {
            finalSentiment = 'NEGATIVE'; // Map anti_national to NEGATIVE for database compatibility
            console.log(`[GEO] Overriding sentiment to NEGATIVE due to anti-national detection`);
        }
        
        const mappedSentiment = validSentiments.includes(finalSentiment) 
            ? finalSentiment 
            : 'NEUTRAL';

        // Create or find topic
        const [topicRecord] = await Topic.findOrCreate({
            where: { name: enhancedAnalysis.finalTopic },
            defaults: { description: `Topic: ${enhancedAnalysis.finalTopic}` }
        });

        // Create or find sentiment
        const [sentimentRecord] = await Sentiment.findOrCreate({
            where: { label: mappedSentiment },
            defaults: { 
                score: 0, 
                confidence: 0.5,
                label: mappedSentiment
            }
        });

        // Create tweet with enhanced analysis including geo-sentiment data
        const tweetRecord = await Tweet.create({
            tweetId: `tweet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            content: tweet,
            author: author,
            keyword: keyword,
            mediaImages: media.images || [],
            mediaVideos: media.videos || [],
            mediaAnalysis: mediaAnalysisResult?.finalAnalysis || null,
            mediaRelevance: mediaAnalysisResult?.finalRelevance || null,
            mediaDescription: mediaAnalysisResult?.finalDescription || null,
            grokAnalysis: enhancedAnalysis.grok,
            crossValidation: enhancedAnalysis.crossValidation,
            analysisConfidence: enhancedAnalysis.confidence,
            consensusResult: enhancedAnalysis.consensus,
            newsValidation: newsValidation,
            // NEW: Geo-sentiment fields
            geoAnalysis: geoAnalysisResult ? JSON.stringify(geoAnalysisResult) : null,
            district: geoAnalysisResult?.district || null,
            threatLevel: geoAnalysisResult?.threatLevel || null,
            isAntiNational: geoAnalysisResult?.sentiment === 'anti_national' || false,
            createdAt: new Date(),
            topicId: topicRecord.id,
            sentimentId: sentimentRecord.id
        });

        // Create result with proper UUIDs
        const resultRecord = await Result.create({
            tweetId: tweetRecord.id,
            teamId: defaultTeam.id,
            companyId: defaultCompany.id
        });

        // Create validated news records and associate them with the result
        if (enhancedAnalysis.finalTopic !== 'Unknown' && newsValidation.topMatch) {
            const newsArticles = newsValidation.validatedArticles;
            if (newsArticles && newsArticles.length > 0) {
                const newsRecord = await News.create({
                    title: newsArticles[0].title,
                    content: newsArticles[0].description || '',
                    url: newsArticles[0].link,
                    source: newsArticles[0].source,
                    publishedAt: new Date()
                });

                // Associate news with result
                await resultRecord.addNews(newsRecord);
            }
        }

        results.push([tweet, mappedSentiment, enhancedAnalysis.finalTopic, []]);
        }
        
        // Delay between batches (except for the last batch)
        if (i + batchSize < newTweets.length) {
            console.log(`[BATCH] Batch ${batchNumber} completed. Waiting ${delayBetweenBatches/1000} seconds before next batch...`);
            await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
    }

    console.log(`Tweets processed and stored successfully for keyword: ${keyword}`);
}

// Process tweets for a specific keyword
async function processTweetsForKeyword(keyword) {
    if (isProcessingTweets) {
        console.log('Tweet processing already in progress');
        return;
    }
    
    try {
        isProcessingTweets = true;
        console.log(`Starting tweet processing for keyword: ${keyword}`);
        
        const keywordFile = path.join(TWEETS_INPUT_DIR, `tweets_output_${keyword}.md`);
        
        if (!fs.existsSync(keywordFile)) {
            console.log(`No tweets file found for keyword ${keyword}: ${keywordFile}`);
            return;
        }

        // Get processed tweet IDs to avoid duplicates
        const processedIds = getProcessedTweetIds(keyword);
        const allTweets = readTweetsFromFile(keywordFile); // Pass the full file path
        
        // Filter out already processed tweets
        const newTweets = [];
        const newProcessedIds = new Set(processedIds);
        
        for (const tweet of allTweets) {
            const tweetId = generateTweetId(tweet, tweet.author, tweet.timestamp);
            
            if (!processedIds.has(tweetId)) {
                newTweets.push(tweet);
                newProcessedIds.add(tweetId);
            }
        }

        if (newTweets.length > 0) {
            console.log(`[DEBUG] Found ${newTweets.length} new tweets for keyword: ${keyword} (${allTweets.length - newTweets.length} duplicates skipped)`);
            
            // Process the new tweets
            await processNewTweets(newTweets, keyword);
            
            // Save updated processed IDs
            saveProcessedTweetIds(newProcessedIds, keyword);
        } else {
            console.log(`[DEBUG] No new tweets for keyword ${keyword}. All ${allTweets.length} tweets already processed.`);
        }
    } catch (error) {
        console.error(`Error processing tweets for keyword ${keyword}:`, error);
    } finally {
        isProcessingTweets = false;
    }
}

// Legacy processTweets function removed - now using processTweetsForKeyword for per-keyword processing
async function processTweets_LEGACY_REMOVED(tweetsToProcess = null, requestedKeywords = null) {
    if (isProcessingTweets) {
        console.log('Tweet processing already in progress');
        return;
    }
    try {
        isProcessingTweets = true;
        console.log('Starting tweet processing...');
        
        let newTweets;

        if (tweetsToProcess) {
            // Process specific tweets passed as parameter
            newTweets = tweetsToProcess;
            console.log(`[DEBUG] Processing ${newTweets.length} specific tweets`);
        } else {
            // This block is for legacy single-file processing and is now deprecated.
            // The primary processing mechanism is via monitorKeywordFiles for per-keyword files.
            console.log('[DEBUG] Skipping old single-file based tweet processing. Use monitorKeywordFiles for continuous scraping.');
            return; // Exit if no specific tweets are passed
        }

        // Filter tweets by requested keywords if provided
        if (requestedKeywords && requestedKeywords.length > 0) {
            console.log(`[DEBUG] Filtering tweets by keywords: ${requestedKeywords.join(', ')}`);
            const originalCount = newTweets.length;

            newTweets = newTweets.filter(tweetData => {
                const tweet = typeof tweetData === 'string' ? tweetData : tweetData.content;
                const keyword = typeof tweetData === 'object' ? tweetData.keyword : '';

                // Check if tweet content or keyword matches any requested keyword
                return requestedKeywords.some(reqKeyword =>
                    tweet.toLowerCase().includes(reqKeyword.toLowerCase()) ||
                    keyword.toLowerCase().includes(reqKeyword.toLowerCase())
                );
            });

            console.log(`[DEBUG] Filtered from ${originalCount} to ${newTweets.length} tweets`);
        }

        if (newTweets && newTweets.length > 0) {
        // Get default team and company
        const defaultTeam = await Team.findOne();
        const defaultCompany = await Company.findOne();

        if (!defaultTeam || !defaultCompany) {
                // No default team or company found in the database
            return;
        }

            let results = [];

            for (const tweetData of newTweets) {
                const tweet = typeof tweetData === 'string' ? tweetData : tweetData.content;
                const tweetKeyword = typeof tweetData === 'object' ? tweetData.keyword : '';
                const media = typeof tweetData === 'object' ? tweetData.media : { images: [], videos: [] };
                const author = typeof tweetData === 'object' ? tweetData.author : 'Unknown';

                // Use requested keywords if available, otherwise use tweet's individual keyword
                const keywordToStore = requestedKeywords && requestedKeywords.length > 0
                    ? requestedKeywords.join(', ')
                    : tweetKeyword;

                // Enhanced analysis with Grok validation
                const GeminiService = require('./services/geminiService');
                const enhancedAnalysis = await GeminiService.analyzeSentimentWithGrokValidation(tweet);

                if (!enhancedAnalysis.finalSentiment) {
                    console.log(`[DEBUG] Error processing tweet: ${tweet}`);
                    continue;
                }

                // Analyze media content if present with Grok validation
                let mediaAnalysisResult = null;
                if (media && (media.images.length > 0 || media.videos.length > 0)) {
                    console.log(`[SCRAPER] Analyzing media content for tweet: ${media.images.length} images, ${media.videos.length} videos`);
                    mediaAnalysisResult = await GeminiService.analyzeMediaContentWithGrokValidation(tweet, media);
                }

                // Fetch and validate news with Grok
                const newsValidation = await GeminiService.fetchAndValidateNewsWithGrok(enhancedAnalysis.finalTopic, tweet);

                // Ensure sentiment is in valid format before database operations
                const validSentiment = mapSentimentToValidEnum(enhancedAnalysis.finalSentiment);
                results.push([tweet, validSentiment, enhancedAnalysis.finalTopic, newsValidation, keywordToStore, media, mediaAnalysisResult]);

                try {
                    // Save to database
                    // Create or find topic
                    const [topicRecord] = await Topic.findOrCreate({
                        where: { name: enhancedAnalysis.finalTopic },
                        defaults: { description: `Topic: ${enhancedAnalysis.finalTopic}` }
                    });

                    // Create or find sentiment with valid enum value
                    const [sentimentRecord] = await Sentiment.findOrCreate({
                        where: { label: validSentiment },
                        defaults: { 
                            score: 0, 
                            confidence: 0.5,
                            label: validSentiment
                        }
                    });

                    // Create tweet with enhanced analysis
                    const tweetRecord = await Tweet.create({
                        tweetId: `tweet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        content: tweet,
                        author: author,
                        keyword: keywordToStore,
                        mediaImages: media.images || [],
                        mediaVideos: media.videos || [],
                        mediaAnalysis: mediaAnalysisResult?.finalAnalysis || null,
                        mediaRelevance: mediaAnalysisResult?.finalRelevance || null,
                        mediaDescription: mediaAnalysisResult?.finalDescription || null,
                        grokAnalysis: enhancedAnalysis.grok,
                        crossValidation: enhancedAnalysis.crossValidation,
                        analysisConfidence: enhancedAnalysis.confidence,
                        consensusResult: enhancedAnalysis.consensus,
                        newsValidation: newsValidation,
                        createdAt: new Date(),
                        topicId: topicRecord.id,
                        sentimentId: sentimentRecord.id
                    });

                    // Create result with proper UUIDs
                    const resultRecord = await Result.create({
                        tweetId: tweetRecord.id,
                        teamId: defaultTeam.id,
                        companyId: defaultCompany.id
                    });

                    // Create validated news records and associate them with the result
                    if (newsValidation && newsValidation.validatedArticles && newsValidation.validatedArticles.length > 0) {
                        for (const article of newsValidation.validatedArticles.slice(0, 2)) { // Save top 2 validated articles
                            const newsRecord = await News.create({
                                title: article.title,
                                url: article.link,
                                topicId: topicRecord.id
                            });
                            await resultRecord.addNews(newsRecord);
                        }
                    }
                } catch (dbError) {
                    console.error('[DB] Error saving tweet to database:', dbError);
                    continue;
                }
            }

            if (results.length > 0) {
                console.log('\nResults Table:');
                console.log('| Tweet                                              | Sentiment | Topic |');
                console.log('|----------------------------------------------------|-----------|-------|');
                for (const [tweet, sentiment, topic, news] of results) {
                    const shortTweet = tweet.length > 50 ? tweet.slice(0, 47) + '...' : tweet;
                    console.log(`| ${shortTweet.padEnd(50)} | ${sentiment.padEnd(9)} | ${topic.padEnd(6)} |`);
                    if (news && news.length > 0) {
                        console.log('\nRelated News:');
                        for (const { title, link } of news) {
                            console.log(`- ${title}`);
                            console.log(`  Link: ${link}\n`);
                        }
                    }
                }

                appendResultsToFile(results);
                appendResultsToJson(results);
            }

        } else {
            console.log(`[DEBUG] No new tweets found or after filtering.`);
        }

        console.log('Tweets processed and stored successfully (both file and DB)');
    } catch (error) {
        console.error('Error processing tweets:', error);
    } finally {
        isProcessingTweets = false;
    }
}

// Legacy continuousAnalysis function removed - now using monitorKeywordFiles for per-keyword processing
async function continuousAnalysis_LEGACY_REMOVED() {
    console.log('[INFO] Starting continuous analysis loop...');
    
    while (true) {
        try {
            await processTweets_LEGACY_REMOVED();
            
            // Random sleep between 10-60 seconds
            const sleepTime = Math.floor(Math.random() * (60 - 10 + 1)) + 10;
            console.log(`[DEBUG] Waiting ${sleepTime} seconds before next check...\n`);
            await new Promise((resolve) => setTimeout(resolve, sleepTime * 1000));
        } catch (error) {
            // ERROR Error in continuous analysis loop
            // Wait 30 seconds before retrying on error
            await new Promise((resolve) => setTimeout(resolve, 30000));
        }
    }
}

// SSL Certificate configuration
function getSSLOptions() {
    const sslDir = process.env.SSL_CERT_DIR || path.join(__dirname, '..', 'ssl');
    const keyPath = path.join(sslDir, 'private.key');
    const certPath = path.join(sslDir, 'certificate.crt');
    const caPath = path.join(sslDir, 'ca_bundle.crt');

    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        const options = {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath)
        };

        // Add CA bundle if available
        if (fs.existsSync(caPath)) {
            options.ca = fs.readFileSync(caPath);
        }

        return options;
    }
    return null;
}

// Start server with HTTPS support
function startServer() {
    const sslOptions = getSSLOptions();
    const HTTPS_PORT = process.env.HTTPS_PORT || 443;
    
    if (sslOptions && process.env.NODE_ENV === 'production') {
        // Start HTTPS server
        const httpsServer = https.createServer(sslOptions, app);
        httpsServer.listen(HTTPS_PORT, () => {
            console.log(`🔒 HTTPS Server is running on port ${HTTPS_PORT}`);
            console.log(`🔒 Secure access: https://localhost:${HTTPS_PORT}`);
        });

        // Start HTTP server for redirects
        const httpApp = express();
        httpApp.use((req, res) => {
            res.redirect(301, `https://${req.headers.host}${req.url}`);
        });
        
        const httpServer = http.createServer(httpApp);
        httpServer.listen(PORT, () => {
            console.log(`🔄 HTTP Server running on port ${PORT} (redirecting to HTTPS)`);
        });

        return { httpsServer, httpServer };
    } else {
        // Start HTTP server only
        const httpServer = http.createServer(app);
        httpServer.listen(PORT, () => {
            console.log(`🌐 HTTP Server is running on port ${PORT}`);
            console.log(`🌐 Access: http://localhost:${PORT}`);
            if (process.env.NODE_ENV === 'production') {
                console.log('⚠️  WARNING: Running in production without HTTPS certificates!');
            }
        });

        return { httpServer };
    }
}

// Initialize server
const servers = startServer();

    console.log('PROCESS_TWEETS environment variable:', process.env.PROCESS_TWEETS);
    
    if (process.env.PROCESS_TWEETS === 'true') {
        // Start keyword file monitoring for per-keyword processing
        monitorKeywordFiles();
    }

// Handle graceful shutdown
async function gracefulShutdown(signal) {
    console.log(`${signal} received. Starting graceful shutdown...`);
    
    try {
        // Close servers
        if (servers.httpsServer) {
            servers.httpsServer.close();
            console.log('HTTPS server closed.');
        }
        if (servers.httpServer) {
            servers.httpServer.close();
            console.log('HTTP server closed.');
        }
        
        // Close database connection
    await DbService.close();
        console.log('Database connection closed.');

        console.log('Graceful shutdown completed.');
    process.exit(0);
    } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Error handling middleware
app.use((err, req, res, next) => {
    // Unhandled error
    res.status(500).json({ error: 'Something went wrong!' });
}); 

// Monitor all keyword files for new tweets (runs every 30 seconds)
async function monitorKeywordFiles() {
    console.log('[MONITOR] Starting keyword file monitoring...');

    // Get list of all keyword files from python-scraper/output directory
    const scraperOutputDir = TWEETS_INPUT_DIR;
    if (!fs.existsSync(scraperOutputDir)) {
        console.log('[MONITOR] Python scraper output directory not found:', scraperOutputDir);
        console.log('[MONITOR] Creating directory:', scraperOutputDir);
        fs.mkdirSync(scraperOutputDir, { recursive: true });
    }

    // Read blocked keywords
    const blockedKeywords = new Set();
    const blocklistFile = path.join(__dirname, '..', 'python-scraper', 'blocked_keywords.txt');
    if (fs.existsSync(blocklistFile)) {
        const blocklistContent = fs.readFileSync(blocklistFile, 'utf-8');
        blocklistContent.split('\n').forEach(line => {
            const keyword = line.trim();
            if (keyword && !keyword.startsWith('#')) {
                blockedKeywords.add(keyword);
            }
        });
        console.log(`[MONITOR] Blocked keywords: ${Array.from(blockedKeywords).join(', ')}`);
    }

    const files = fs.readdirSync(scraperOutputDir).filter(file => file.startsWith('tweets_output_') && file.endsWith('.md'));
    console.log(`[MONITOR] Found ${files.length} keyword files in ${scraperOutputDir}:`, files);

    for (const file of files) {
        // Extract keyword from filename
        const keyword = file.replace('tweets_output_', '').replace('.md', '');

        // Skip blocked keywords
        if (blockedKeywords.has(keyword)) {
            console.log(`[MONITOR] Skipping blocked keyword: "${keyword}"`);
            continue;
        }

        console.log(`[MONITOR] Processing keyword: "${keyword}"`);

        try {
            await processTweetsForKeyword(keyword);
        } catch (error) {
            console.error(`[MONITOR] Error processing keyword ${keyword}:`, error);
        }
    }
}

// Start monitoring every 30 seconds
setInterval(monitorKeywordFiles, 30000);

// Export functions for use in other modules
module.exports = { readTweetsFromFile, processTweetsForKeyword }; 