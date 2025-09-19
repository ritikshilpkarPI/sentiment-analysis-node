const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');
const axios = require('axios');
const { Op } = require('sequelize');
const { Tweet, Topic, Sentiment, Result, Team, Company, News } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const youtubeService = require('../services/youtubeService');
const instagramService = require('../services/instagramService');
const googleReviewService = require('../services/googleReviewService');

// Welcome message
router.get('/', (req, res) => {
    res.json({
        message: 'Welcome to the Tweet Sentiment Analysis API',
        endpoints: [
            '- GET /api/results/all - Get all sentiment analysis results without filtering',
            '- GET /api/results/filtered - Get sentiment analysis results filtered by user\'s team',
            '- GET /api/results/filtered/json - Get filtered results in JSON format',
            '- POST /api/results/grouped - Get results grouped by topic (filtered by keywords/handles)',
            '- GET /api/results/grouped/all - Get all results grouped by topic (no filtering)',
            '- GET /api/results/keywords - Get all unique keywords from tweets',
            '- POST /api/results/runAnalysis - Run Twitter analysis (API in production, scraper in development)'
        ]
    });
});

// Get all results without filtering
router.get('/all', async (req, res) => {
    try {
        const results = await Tweet.findAll({
            include: [
                {
                    model: Topic,
                    attributes: ['id', 'name']
                },
                {
                    model: Sentiment,
                    attributes: ['id', 'label', 'score', 'confidence']
                }
            ],
            where: { isActive: true }
        });
        res.json(results);
    } catch (error) {
        // Error fetching results
        res.status(500).json({ error: 'Failed to fetch results' });
    }
});

// Get filtered results (requires authentication)
router.get('/filtered', authenticateToken, async (req, res) => {
    try {
        const results = await Result.findAll({
            include: [
                {
                    model: Tweet,
                    attributes: ['id', 'content', 'author', 'createdAt', 'keyword', 'mediaImages', 'mediaVideos', 'mediaAnalysis', 'mediaRelevance', 'mediaDescription', 'grokAnalysis', 'crossValidation', 'analysisConfidence', 'consensusResult', 'newsValidation'],
                    include: [
                        { model: Topic },
                        { model: Sentiment }
                    ]
                },
                { 
                    model: News,
                    attributes: ['id', 'title', 'link']
                },
                { model: Team },
                { model: Company }
            ],
            where: {
                teamId: req.user.teamId,
                isActive: true
            }
        });

        // Group results by topic
        const groupedResults = results.reduce((acc, result) => {
            const topicName = result.Tweet.Topic.name || 'General';
            if (!acc[topicName]) {
                acc[topicName] = [];
            }

            // Format tweet data with news
            const tweetData = {
                tweet: result.Tweet.content,
                sentiment: result.Tweet.Sentiment.label,
                news: result.News.map(news => ({
                    title: news.title,
                    link: news.url
                }))
            };

            acc[topicName].push(tweetData);
            return acc;
        }, {});

        res.json(groupedResults);
    } catch (error) {
        // Error fetching filtered results
        res.status(500).json({ error: 'Failed to fetch filtered results' });
    }
});

// Get filtered results in JSON format (requires authentication)
router.get('/filtered/json', authenticateToken, async (req, res) => {
    try {
        const results = await Result.findAll({
            include: [
                {
                    model: Tweet,
                    attributes: ['id', 'content', 'author', 'createdAt', 'keyword', 'mediaImages', 'mediaVideos', 'mediaAnalysis', 'mediaRelevance', 'mediaDescription', 'grokAnalysis', 'crossValidation', 'analysisConfidence', 'consensusResult', 'newsValidation'],
                    include: [
                        { model: Topic },
                        { model: Sentiment }
                    ]
                },
                { 
                    model: News,
                    attributes: ['id', 'title', 'link']
                },
                { model: Team },
                { model: Company }
            ],
            where: {
                teamId: req.user.teamId,
                isActive: true
            }
        });

        // Format results for JSON output
        const formattedResults = results.map(result => ({
            tweet: result.Tweet.content,
            author: result.Tweet.author,
            sentiment: result.Tweet.Sentiment.label,
            topic: result.Tweet.Topic.name,
            team: result.Team.name,
            company: result.Company.name,
            news: result.News.map(news => ({
                title: news.title,
                link: news.link
            })),
            createdAt: result.Tweet.createdAt
        }));

        res.json(formattedResults);
    } catch (error) {
        // Error fetching filtered results
        res.status(500).json({ error: 'Failed to fetch filtered results' });
    }
});

// Get results grouped by topic with tweets and news (filtered by keywords/handles)
router.post('/grouped', authenticateToken, async (req, res) => {
    try {
        const { keywords, handles } = req.body;

        console.log('Keywords:', keywords);
        
        
        // Build where clause for filtering
        let whereClause = {};
        
        // If keywords provided, filter by tweet keyword field first, then content
        if (keywords && keywords.length > 0) {
            const keywordTerms = [];
            const contentTerms = [];
            
            keywords.forEach(keyword => {
                // Add exact keyword match
                keywordTerms.push({ [Op.iLike]: `%${keyword}%` });
            });
            
            // PRIORITIZE keyword field - only search content if no keyword matches
            whereClause[Op.or] = [
                { '$Tweet.keyword$': { [Op.or]: keywordTerms } }
            ];
        }
        
        // If handles provided, filter by tweet author
        if (handles && handles.length > 0) {
            const handleTerms = [];
            handles.forEach(handle => {
                // Clean handle (remove @ if present)
                const cleanHandle = handle.replace('@', '');
                
                // Add original handle
                handleTerms.push({ [Op.iLike]: `%${handle}%` });
                
                // Add cleaned handle
                handleTerms.push({ [Op.iLike]: `%${cleanHandle}%` });
                
                // Add handle without @
                if (handle.startsWith('@')) {
                    handleTerms.push({ [Op.iLike]: `%${handle.substring(1)}%` });
                }
            });
            
            whereClause['$Tweet.author$'] = {
                [Op.or]: handleTerms
            };
        }

        

        const results = await Result.findAll({
            include: [
                {
                    model: Tweet,
                    attributes: ['id', 'content', 'author', 'createdAt', 'keyword', 'mediaImages', 'mediaVideos', 'mediaAnalysis', 'mediaRelevance', 'mediaDescription', 'grokAnalysis', 'crossValidation', 'analysisConfidence', 'consensusResult', 'newsValidation'],
                    include: [
                        { 
                            model: Topic,
                            attributes: ['id', 'name']
                        },
                        { 
                            model: Sentiment,
                            attributes: ['id', 'label', 'score', 'confidence']
                        }
                    ]
                },
                { 
                    model: News,
                    attributes: ['id', 'title', 'url']
                },
                { 
                    model: Team,
                    attributes: ['id', 'name']
                },
                { 
                    model: Company,
                    attributes: ['id', 'name']
                }
            ],
            where: whereClause
        });


        // Group results by topic
        const groupedResults = results.reduce((acc, result) => {
            const topicName = result.Tweet.Topic.name || 'General';
            if (!acc[topicName]) {
                acc[topicName] = [];
            }

            // Format tweet data with news and media
            const tweetData = {
                id: result.Tweet.id,
                tweet: result.Tweet.content,
                author: result.Tweet.author,
                createdAt: result.Tweet.createdAt,
                keyword: result.Tweet.keyword,
                sentiment: result.Tweet.Sentiment.label,
                media: {
                    images: result.Tweet.mediaImages || [],
                    videos: result.Tweet.mediaVideos || [],
                    analysis: result.Tweet.mediaAnalysis,
                    relevance: result.Tweet.mediaRelevance,
                    description: result.Tweet.mediaDescription
                },
                news: result.News.map(news => ({
                    title: news.title,
                    link: news.url
                }))
            };

            acc[topicName].push(tweetData);
            return acc;
        }, {});


        res.json(groupedResults);
    } catch (error) {
        // Error fetching grouped results
        res.status(500).json({ error: 'Failed to fetch grouped results' });
    }
});

// Get all unique keywords from tweets
router.get('/keywords', authenticateToken, async (req, res) => {
    try {
        const keywords = await Tweet.findAll({
            attributes: ['keyword'],
            where: {
                keyword: {
                    [Op.ne]: null
                }
            },
            group: ['keyword'],
            order: [['keyword', 'ASC']],
            raw: true
        });

        const keywordList = keywords.map(k => k.keyword).filter(k => k && k.trim() !== '');
        
        res.json({
            keywords: keywordList,
            count: keywordList.length
        });
    } catch (error) {
        // Error fetching keywords
        res.status(500).json({ error: 'Failed to fetch keywords' });
    }
});

// Get all results grouped by topic (no filtering)
router.get('/grouped/all', authenticateToken, async (req, res) => {
    try {
        const results = await Result.findAll({
            include: [
                {
                    model: Tweet,
                    attributes: ['id', 'content', 'author', 'createdAt', 'keyword', 'mediaImages', 'mediaVideos', 'mediaAnalysis', 'mediaRelevance', 'mediaDescription', 'grokAnalysis', 'crossValidation', 'analysisConfidence', 'consensusResult', 'newsValidation'],
                    include: [
                        { 
                            model: Topic,
                            attributes: ['id', 'name']
                        },
                        { 
                            model: Sentiment,
                            attributes: ['id', 'label', 'score', 'confidence']
                        }
                    ]
                },
                { 
                    model: News,
                    attributes: ['id', 'title', 'url']
                },
                { 
                    model: Team,
                    attributes: ['id', 'name']
                },
                { 
                    model: Company,
                    attributes: ['id', 'name']
                }
            ]
        });

        // Group results by topic
        const groupedResults = results.reduce((acc, result) => {
            const topicName = result.Tweet.Topic.name || 'General';
            if (!acc[topicName]) {
                acc[topicName] = [];
            }

            // Format tweet data with news and media
            const tweetData = {
                id: result.Tweet.id,
                tweet: result.Tweet.content,
                author: result.Tweet.author,
                createdAt: result.Tweet.createdAt,
                keyword: result.Tweet.keyword,
                sentiment: result.Tweet.Sentiment.label,
                media: {
                    images: result.Tweet.mediaImages || [],
                    videos: result.Tweet.mediaVideos || [],
                    analysis: result.Tweet.mediaAnalysis,
                    relevance: result.Tweet.mediaRelevance,
                    description: result.Tweet.mediaDescription
                },
                news: result.News.map(news => ({
                    title: news.title,
                    link: news.url
                }))
            };

            acc[topicName].push(tweetData);
            return acc;
        }, {});

        res.json(groupedResults);
    } catch (error) {
        // Error fetching grouped results
        res.status(500).json({ error: 'Failed to fetch grouped results' });
    }
});

// POST /api/results/youtube/comments - Get all comments from a YouTube video with sentiment, with caching
router.post('/youtube/comments', async (req, res) => {
    const { videoUrl, maxComments, page } = req.body;
    if (!videoUrl) {
        return res.status(400).json({ error: 'Missing videoUrl in request body' });
    }
    try {
        const pageSize = maxComments || 200;
        const pageNum = page || 1;
        // Only scrape and analyze the batch for this page
        const comments = await youtubeService.fetchAllYoutubeCommentsWithSentiment(videoUrl, pageSize, pageNum);
        if (!comments || comments.length === 0) {
            return res.json({
                videoUrl,
                total: 0,
                page: pageNum,
                pageSize,
                comments: [],
                noMoreComments: true,
                cached: false
            });
        }
        // We don't know the total, so just return the current batch
        res.json({
            videoUrl,
            total: comments.length,
            page: pageNum,
            pageSize,
            comments,
            noMoreComments: false,
            cached: false
        });
    } catch (error) {
        // Error fetching YouTube comments
        res.status(500).json({ error: 'Failed to fetch YouTube comments', details: error.message });
    }
});

// POST /api/results/instagram/comments - Get all comments from an Instagram Reel with sentiment, topic, and caching
router.post('/instagram/comments', async (req, res) => {
    const { reelUrl, maxComments } = req.body;
    if (!reelUrl) {
        return res.status(400).json({ error: 'Missing reelUrl in request body' });
    }
    try {
        // Check cache first
        const cached = await instagramService.getCachedInstagramComments(reelUrl);
        if (cached && cached.comments && Array.isArray(cached.comments) && cached.comments.length > 0) {
            return res.json({
                reelUrl,
                total: cached.comments.length,
                comments: cached.comments,
                cached: true
            });
        }
        // Not cached, scrape and analyze
        const comments = await instagramService.fetchAllInstagramCommentsWithSentiment(reelUrl, maxComments || 100);
        // Save to DB
        await instagramService.setCachedInstagramComments(reelUrl, comments);
        res.json({
            reelUrl,
            total: comments.length,
            comments,
            cached: false
        });
    } catch (error) {
        // Error fetching Instagram Reel comments
        res.status(500).json({ error: 'Failed to fetch Instagram Reel comments', details: error.message });
    }
});

// POST /api/results/google/reviews - Get all reviews from a Google Maps place with sentiment, topic, and caching
router.post('/google/reviews', async (req, res) => {
    const { placeUrl, maxReviews, page } = req.body;
    if (!placeUrl) {
        return res.status(400).json({ error: 'Missing placeUrl in request body' });
    }
    try {
        // Check cache first
        const cached = await googleReviewService.getCachedGoogleReviews(placeUrl);
        if (cached && cached.reviews && Array.isArray(cached.reviews) && cached.reviews.length > 0) {
            return res.json({
                placeUrl,
                total: cached.reviews.length,
                reviews: cached.reviews,
                cached: true
            });
        }
        // Not cached, scrape and analyze
        const reviews = await googleReviewService.fetchAllGoogleReviewsWithSentiment(placeUrl, maxReviews || 100, page || 1);
        // Save to DB
        await googleReviewService.setCachedGoogleReviews(placeUrl, reviews);
        res.json({
            placeUrl,
            total: reviews.length,
            reviews,
            cached: false
        });
    } catch (error) {
        // Error fetching Google Reviews
        res.status(500).json({ error: 'Failed to fetch Google Reviews', details: error.message });
    }
});

// POST /api/results/runAnalysis - Run Twitter analysis (API in production, scraper in development)
router.post('/runAnalysis', async (req, res) => {
    try {
        const { keywords, handles } = req.body;

        // Validation
        if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
            return res.status(400).json({ 
                error: 'Keywords are required and must be a non-empty array' 
            });
        }

        if (handles && !Array.isArray(handles)) {
            return res.status(400).json({ 
                error: 'Handles must be an array if provided' 
            });
        }

        console.log('Keywords:', keywords);
        if (handles && handles.length > 0) {
            console.log('Handles:', handles);
        }

        // Try X API first if enabled, with automatic fallback to scraper
        const shouldTryXApi = process.env.NODE_ENV === 'production' || process.env.USE_X_API === 'true';
        
        if (shouldTryXApi) {
            // Start X API analysis with fallback
            startXApiAnalysisWithFallback(keywords, handles || []);
            
            res.json({
                success: true,
                message: 'Analysis started with X API (fallback to scraper if needed)',
                keywords: keywords,
                handles: handles || [],
                status: 'running',
                method: 'x_api_with_fallback',
                note: 'Will automatically fallback to scraper if X API fails. Check server logs for progress.'
            });
        } else {
            // Use scraper directly in development
            const scraperPath = path.join(__dirname, '..', '..', 'python-scraper', 'scrape_tweets.py');
            
            // Check if scraper file exists
            if (!fs.existsSync(scraperPath)) {
                return res.status(500).json({ 
                    error: 'Scraper file not found', 
                    details: 'python-scraper/scrape_tweets.py does not exist' 
                });
            }

            // Start the scraper in the background (don't wait for it)
            startScraperInBackground(scraperPath, keywords, handles || []);

            res.json({
                success: true,
                message: 'Scraper started successfully in background',
                keywords: keywords,
                handles: handles || [],
                status: 'running',
                method: 'scraper',
                note: 'Check server logs for progress. Tweets will be saved to tweets_output.md'
            });
        }

    } catch (error) {
        // RUN_ANALYSIS Error
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message 
        });
    }
});

// Function to start scraper in background
// Global variable to track scraper server process
let scraperServerProcess = null;

// Function to start the persistent scraper server
function startScraperServer() {
    if (scraperServerProcess) {
        return;
    }
    
    const serverPath = path.join(__dirname, '..', '..', 'python-scraper', 'scraper_server.py');
    
    scraperServerProcess = spawn('python3', [serverPath, '9999'], {
        cwd: path.join(__dirname, '..', '..', 'python-scraper'),
        stdio: ['pipe', 'pipe', 'pipe']
    });

    scraperServerProcess.stdout.on('data', (data) => {
        // Server output
    });

    scraperServerProcess.stderr.on('data', (data) => {
        // SCRAPER_SERVER_ERROR
    });

    scraperServerProcess.on('close', (code) => {
        scraperServerProcess = null;
    });

    scraperServerProcess.on('error', (error) => {
        // SCRAPER_SERVER Failed to start
        scraperServerProcess = null;
    });
}

// Function to send request to scraper server
function sendScraperRequest(keywords, handles) {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        
        client.connect(9999, 'localhost', () => {
            const request = {
                action: 'scrape',
                keywords: keywords,
                handles: handles
            };
            
            client.write(JSON.stringify(request));
        });
        
        // Add timeout to handle cases where response doesn't come
        const timeout = setTimeout(() => {
            client.destroy();
            reject(new Error('Timeout waiting for scraper response'));
        }, 30000); // 30 second timeout
        
        client.on('data', (data) => {
            clearTimeout(timeout);
            try {
                const response = JSON.parse(data.toString());
                
                if (response.success && response.filename) {
                    // Process the output file
                    processSpecificFile(response.filename);
                }
                
                resolve(response);
            } catch (error) {
                // SCRAPER_CLIENT Error parsing response
                reject(error);
            }
            
            client.destroy();
        });
        
        client.on('error', (error) => {
            clearTimeout(timeout);
            // SCRAPER_CLIENT Connection error
            reject(error);
        });
        
        client.on('close', () => {
            clearTimeout(timeout);
        });
    });
}

// Function to start scraper in background (now uses server)
function startScraperInBackground(scriptPath, keywords, handles) {
    
    // Start server if not running
    if (!scraperServerProcess) {
        startScraperServer();
        
        // Wait for server to be ready
        setTimeout(() => {
            sendScraperRequest(keywords, handles).catch(error => {
                // RUN_ANALYSIS Scraper request failed
            });
        }, 10000); // Wait 10 seconds for server to be ready
    } else {
        // Server already running, send request immediately
        sendScraperRequest(keywords, handles).catch(error => {
            // RUN_ANALYSIS Scraper request failed
        });
    }
}

// Function to start X API analysis with automatic scraper fallback
async function startXApiAnalysisWithFallback(keywords, handles) {
    try {
        // Check if X API credentials are available
        if (!process.env.X_API_BEARER_TOKEN) {
            return fallbackToScraper(keywords, handles);
        }

        // Try X API first
        const success = await startXApiAnalysis(keywords, handles);
        
        if (!success) {
            return fallbackToScraper(keywords, handles);
        }
        
    } catch (error) {
        // X_API_FALLBACK X API error, falling back to scraper
        return fallbackToScraper(keywords, handles);
    }
}

// Function to fallback to scraper
async function fallbackToScraper(keywords, handles) {
    console.log('Keywords:', keywords);
    
    const scraperPath = path.join(__dirname, '..', '..', 'python-scraper', 'scrape_tweets.py');
    
    // Check if scraper file exists
    if (!fs.existsSync(scraperPath)) {
        // FALLBACK Scraper file not found
        return false;
    }
    // Start the scraper in the background
    startScraperInBackground(scraperPath, keywords, handles);
    return true;
}

// Function to start X API analysis in background (modified to return success status)
async function startXApiAnalysis(keywords, handles) {
    try {
        // Check if X API credentials are available
        if (!process.env.X_API_BEARER_TOKEN) {
            // X_API Bearer Token not found
            return false;
        }
        
        let totalTweetsProcessed = 0;
        let rateLimitHit = false;
        
        for (const keyword of keywords) {
            console.log('Keywords:', keywords);
            
            if (handles && handles.length > 0) {
                // Search within specific handles
                for (const handle of handles) {
                    const tweets = await fetchTweetsFromXApi(keyword, handle);
                    
                    if (tweets === null) {
                        // Rate limit hit
                        rateLimitHit = true;
                        break;
                    }
                    
                    if (tweets && tweets.length > 0) {
                        await processTweetsWithSentiment(tweets, keyword, handle);
                        totalTweetsProcessed += tweets.length;
                    }
                }
            } else {
                // General search
                const tweets = await fetchTweetsFromXApi(keyword);
                
                if (tweets === null) {
                    // Rate limit hit
                    rateLimitHit = true;
                    break;
                }
                
                if (tweets && tweets.length > 0) {
                    await processTweetsWithSentiment(tweets, keyword);
                    totalTweetsProcessed += tweets.length;
                }
            }
            
            if (rateLimitHit) break;
        }
        
        if (rateLimitHit) {
            return false;
        }
        
        // If no tweets were found for any keyword, also trigger fallback
        if (totalTweetsProcessed === 0) {
            return false;
        }
        
        return true;
        
    } catch (error) {
        // X_API Error in X API analysis
        return false;
    }
}

// Function to fetch tweets from X API with rate limiting
async function fetchTweetsFromXApi(keyword, handle = null) {
    try {
        let query = keyword;
        
        // If handle is specified, search within that handle
        if (handle) {
            const cleanHandle = handle.replace('@', '');
            query = `from:${cleanHandle} ${keyword}`;
        }
        
        const response = await axios.get('https://api.twitter.com/2/tweets/search/recent', {
            headers: {
                'Authorization': `Bearer ${process.env.X_API_BEARER_TOKEN}`,
                'Content-Type': 'application/json'
            },
            params: {
                query: query,
                max_results: 5, // Reduced to 5 recent tweets to conserve API calls
                'tweet.fields': 'created_at,author_id,public_metrics,context_annotations,attachments',
                'user.fields': 'username,name',
                'expansions': 'author_id,attachments.media_keys',
                'media.fields': 'type,url,preview_image_url,duration_ms,height,width,alt_text'
            }
        });

        if (response.data && response.data.data) {
            const tweets = response.data.data;
            const users = response.data.includes?.users || [];
            const media = response.data.includes?.media || [];
            
            // Map user data for easier lookup
            const userMap = {};
            users.forEach(user => {
                userMap[user.id] = user;
            });
            
            // Map media data for easier lookup
            const mediaMap = {};
            media.forEach(mediaItem => {
                mediaMap[mediaItem.media_key] = mediaItem;
            });
            
            // Format tweets for processing
            return tweets.map(tweet => {
                // Extract media from attachments
                const mediaImages = [];
                const mediaVideos = [];
                
                if (tweet.attachments && tweet.attachments.media_keys) {
                    tweet.attachments.media_keys.forEach(mediaKey => {
                        const mediaItem = mediaMap[mediaKey];
                        if (mediaItem) {
                            if (mediaItem.type === 'photo') {
                                mediaImages.push({
                                    url: mediaItem.url,
                                    alt: mediaItem.alt_text || '',
                                    type: 'image',
                                    width: mediaItem.width,
                                    height: mediaItem.height
                                });
                            } else if (mediaItem.type === 'video' || mediaItem.type === 'animated_gif') {
                                mediaVideos.push({
                                    url: mediaItem.url || mediaItem.preview_image_url,
                                    poster: mediaItem.preview_image_url,
                                    type: mediaItem.type,
                                    duration: mediaItem.duration_ms,
                                    width: mediaItem.width,
                                    height: mediaItem.height
                                });
                            }
                        }
                    });
                }
                
                return {
                    id: tweet.id,
                    text: tweet.text,
                    author_id: tweet.author_id,
                    author_name: userMap[tweet.author_id]?.name || 'Unknown',
                    author_username: userMap[tweet.author_id]?.username || 'unknown',
                    created_at: tweet.created_at,
                    public_metrics: tweet.public_metrics,
                    media: {
                        images: mediaImages,
                        videos: mediaVideos
                    }
                };
            });
        }
        
        return [];
        
    } catch (error) {
        if (error.response?.status === 429) {
            const resetTime = error.response.headers['x-rate-limit-reset'];
            const resetDate = resetTime ? new Date(resetTime * 1000).toISOString() : 'unknown';
            // X_API Rate limit exceeded, will fallback to scraper
            return null; // Return null to indicate rate limit hit
        } else {
            // X_API Error fetching tweets
        }
        return [];
    }
}

// Function to process tweets with sentiment analysis
async function processTweetsWithSentiment(tweets, keyword, handle = null) {
    try {
        const GeminiService = require('../services/geminiService');
        
        for (const tweet of tweets) {
            // Enhanced analysis with Grok validation
            const enhancedAnalysis = await GeminiService.analyzeSentimentWithGrokValidation(tweet.text);
            
            // Analyze media content if present with Grok validation
            let mediaAnalysisResult = null;
            if (tweet.media && (tweet.media.images.length > 0 || tweet.media.videos.length > 0)) {
                mediaAnalysisResult = await GeminiService.analyzeMediaContentWithGrokValidation(tweet.text, tweet.media);
            }
            
            // Fetch and validate news with Grok
            const newsValidation = await GeminiService.fetchAndValidateNewsWithGrok(enhancedAnalysis.finalTopic, tweet.text);
            
            // Map sentiment to database format
            const mappedSentiment = mapSentimentToEnum(enhancedAnalysis.finalSentiment);
            
            // Get default team and company
            const defaultTeam = await Team.findOne();
            const defaultCompany = await Company.findOne();
            
            if (!defaultTeam || !defaultCompany) {
                // X_API No default team or company found
                continue;
            }
            
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

            // Create tweet record with enhanced analysis
            const tweetRecord = await Tweet.create({
                tweetId: tweet.id,
                content: tweet.text,
                author: `${tweet.author_name} (@${tweet.author_username})`,
                createdAt: new Date(tweet.created_at),
                topicId: topicRecord.id,
                sentimentId: sentimentRecord.id,
                keyword: keyword,
                mediaImages: tweet.media?.images || [],
                mediaVideos: tweet.media?.videos || [],
                mediaAnalysis: mediaAnalysisResult?.finalAnalysis || null,
                mediaRelevance: mediaAnalysisResult?.finalRelevance || null,
                mediaDescription: mediaAnalysisResult?.finalDescription || null,
                grokAnalysis: enhancedAnalysis.grok,
                crossValidation: enhancedAnalysis.crossValidation,
                analysisConfidence: enhancedAnalysis.confidence,
                consensusResult: enhancedAnalysis.consensus,
                newsValidation: newsValidation
            });

            // Fetch related news (use validated news from Grok)
            let newsRecord = null;
            if (enhancedAnalysis.finalTopic !== 'Unknown' && newsValidation.topMatch) {
                const newsArticles = newsValidation.validatedArticles;
                if (newsArticles && newsArticles.length > 0) {
                    newsRecord = await News.create({
                        title: newsArticles[0].title,
                        content: newsArticles[0].description || '',
                        url: newsArticles[0].link,
                        source: newsArticles[0].source,
                        publishedAt: new Date()
                    });
                }
            }

            // Create result record
            await Result.create({
                tweetId: tweetRecord.id,
                newsId: newsRecord ? newsRecord.id : null,
                teamId: defaultTeam.id,
                companyId: defaultCompany.id
            });

            // Also append to file for compatibility
            appendTweetToFile(tweet, keyword, handle, sentiment, topic);
        }
        
    } catch (error) {
        // X_API Error processing tweets
    }
}

// Function to map Gemini sentiment to database enum format
function mapSentimentToEnum(sentiment) {
    // Direct mapping for the three supported sentiments
    const sentimentMap = {
        'Positive': 'POSITIVE',
        'Negative': 'NEGATIVE', 
        'Neutral': 'NEUTRAL'
    };
    
    const mapped = sentimentMap[sentiment] || 'NEUTRAL';
    return mapped;
}

// Function to append tweet to file (for compatibility with scraper output)
function appendTweetToFile(tweet, keyword, handle, sentiment, topic) {
    try {
        const outputFilePath = path.join(__dirname, '..', '..', 'tweets_output.md');
        const tweetData = `## Tweet (X API)
**Author:** ${tweet.author_name} (@${tweet.author_username})
**Time:** ${tweet.created_at}
**Text:** ${tweet.text}
**Keyword:** ${keyword}
${handle ? `**Handle:** ${handle}` : ''}
**Sentiment:** ${sentiment}
**Topic:** ${topic}

---

`;
        
        fs.appendFileSync(outputFilePath, tweetData, 'utf-8');
        
    } catch (error) {
        // X_API Error appending to file
    }
}

// Function to process a specific tweets file
function processSpecificFile(filename) {
    const filePath = path.join(__dirname, '..', '..', 'python-scraper', filename);
    
    if (!fs.existsSync(filePath)) {
        // PROCESS_FILE File not found
        return;
    }
    
    // Read and process the file
    const { readTweetsFromFile, processTweets } = require('../app');
    
    try {
        const tweets = readTweetsFromFile(filePath);
        
        if (tweets.length > 0) {
            processTweets(tweets);
        }
    } catch (error) {
        // PROCESS_FILE Error processing file
    }
}

module.exports = router; 