const sequelize = require('../config/database');
const { User, Company, Team, Keyword, Tweet, Topic, Sentiment, Result, News } = require('../models');

class DbService {
    static async initialize() {
        try {
            // Test database connection
            await sequelize.authenticate();
            console.log('Database connection established successfully.');

            // Sync all models with database
            await sequelize.sync({ alter: true });
            console.log('Database synchronized successfully.');

            return true;
        } catch (error) {
            console.error('Database initialization error:', error);
            throw error;
        }
    }

    static async close() {
        try {
            await sequelize.close();
            console.log('Database connection closed.');
        } catch (error) {
            console.error('Error closing database connection:', error);
            throw error;
        }
    }

    static async clearDatabase() {
        try {
            // Drop all tables in reverse order of dependencies
            await Result.destroy({ where: {}, force: true });
            await Tweet.destroy({ where: {}, force: true });
            await News.destroy({ where: {}, force: true });
            await Sentiment.destroy({ where: {}, force: true });
            await Topic.destroy({ where: {}, force: true });
            await Keyword.destroy({ where: {}, force: true });
            await Team.destroy({ where: {}, force: true });
            await User.destroy({ where: {}, force: true });
            await Company.destroy({ where: {}, force: true });

            console.log('Database cleared successfully.');
            return true;
        } catch (error) {
            console.error('Error clearing database:', error);
            throw error;
        }
    }

    static async saveAnalysisResult(result) {
        try {
            // Create or find sentiment
            let [sentiment] = await Sentiment.findOrCreate({
                where: { sentiment: result.sentiment },
                defaults: { sentiment: result.sentiment }
            });

            // Create or find topic
            let [topic] = await Topic.findOrCreate({
                where: { name: result.topic },
                defaults: { name: result.topic }
            });

            // Create tweet
            const tweet = await Tweet.create({
                text: result.tweet,
                topicId: topic.id,
                date: new Date(),
                sentimentId: sentiment.id
            });

            // Create news if available
            let news = null;
            if (result.news && result.news.length > 0) {
                news = await News.create({
                    newsLinks: result.news,
                    topicId: topic.id
                });
            }

            // Create result
            const analysisResult = await Result.create({
                tweetId: tweet.id,
                newsId: news ? news.id : null,
                teamId: result.teamRef,
                companyId: result.companyRef
            });

            return { tweet, topic, sentiment, news, result: analysisResult };
        } catch (error) {
            console.error('Error saving analysis result:', error);
            throw error;
        }
    }

    static async getResults() {
        try {
            const results = await Result.findAll({
                include: [
                    {
                        model: Tweet,
                        include: [
                            {
                                model: Topic
                            },
                            {
                                model: Sentiment
                            }
                        ]
                    },
                    {
                        model: News
                    },
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

            return formattedResults;
        } catch (error) {
            console.error('Error getting results:', error);
            throw error;
        }
    }
}

module.exports = DbService; 