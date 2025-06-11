const express = require('express');
const router = express.Router();
const { Tweet, Topic, Sentiment, Result, Team, Company, News } = require('../models');
const { authenticateToken } = require('../middleware/auth');

// Welcome message
router.get('/', (req, res) => {
    res.json({
        message: 'Welcome to the Tweet Sentiment Analysis API',
        endpoints: [
            '- GET /api/results/all - Get all sentiment analysis results without filtering',
            '- GET /api/results/filtered - Get sentiment analysis results filtered by user\'s team',
            '- GET /api/results/filtered/json - Get filtered results in JSON format'
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
        console.error('Error fetching results:', error);
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
                    link: news.link
                }))
            };

            acc[topicName].push(tweetData);
            return acc;
        }, {});

        res.json(groupedResults);
    } catch (error) {
        console.error('Error fetching filtered results:', error);
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
        console.error('Error fetching filtered results:', error);
        res.status(500).json({ error: 'Failed to fetch filtered results' });
    }
});

// Get results grouped by topic with tweets and news
router.get('/grouped', authenticateToken, async (req, res) => {
    try {
        const results = await Result.findAll({
            include: [
                {
                    model: Tweet,
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
        console.error('Error fetching grouped results:', error);
        res.status(500).json({ error: 'Failed to fetch grouped results' });
    }
});

module.exports = router; 