const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { Result, Tweet, Topic, Sentiment, News, Team, Keyword } = require('../models');

// Get all results (unfiltered)
router.get('/all', async (req, res) => {
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
                { model: News },
                {
                    model: Team,
                    include: [Keyword]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const formattedResults = {};
        
        for (const result of results) {
            const topic = result.Tweet.Topic.name;
            if (!formattedResults[topic]) {
                formattedResults[topic] = [];
            }

            formattedResults[topic].push({
                tweet: result.Tweet.text,
                sentiment: result.Tweet.Sentiment.sentiment,
                news: result.News ? result.News.newsLinks : []
            });
        }

        res.json(formattedResults);
    } catch (error) {
        console.error('Error getting results:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get filtered results based on user's team
router.get('/filtered', auth, async (req, res) => {
    try {
        const user = req.user;
        let whereClause = {};

        if (user.role === 'COMPANY_ADMIN') {
            // Company admins can see all results for their company
            whereClause.companyId = user.companyId;
        } else {
            // Team members can only see their team's results
            whereClause.teamId = user.teamId;
        }

        const results = await Result.findAll({
            where: whereClause,
            include: [
                {
                    model: Tweet,
                    include: [
                        { model: Topic },
                        { model: Sentiment }
                    ]
                },
                { model: News },
                {
                    model: Team,
                    include: [Keyword]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const formattedResults = {};
        
        for (const result of results) {
            const topic = result.Tweet.Topic.name;
            if (!formattedResults[topic]) {
                formattedResults[topic] = [];
            }

            formattedResults[topic].push({
                tweet: result.Tweet.text,
                sentiment: result.Tweet.Sentiment.sentiment,
                news: result.News ? result.News.newsLinks : []
            });
        }

        res.json(formattedResults);
    } catch (error) {
        console.error('Error getting filtered results:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get filtered results in JSON format
router.get('/filtered/json', auth, async (req, res) => {
    try {
        const user = req.user;
        let whereClause = {};

        if (user.role === 'COMPANY_ADMIN') {
            whereClause.companyId = user.companyId;
        } else {
            whereClause.teamId = user.teamId;
        }

        const results = await Result.findAll({
            where: whereClause,
            include: [
                {
                    model: Tweet,
                    include: [
                        { model: Topic },
                        { model: Sentiment }
                    ]
                },
                { model: News },
                {
                    model: Team,
                    include: [Keyword]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json(results);
    } catch (error) {
        console.error('Error getting filtered results:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 