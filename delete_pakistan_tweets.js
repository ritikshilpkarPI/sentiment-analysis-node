const { Sequelize } = require('sequelize');
const { Tweet, Sentiment, Topic, Result, News } = require('./src/models');
require('dotenv').config();

async function deletePakistanTweets() {
    try {
        const sequelize = new Sequelize({
            dialect: 'postgres',
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            username: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            database: process.env.DB_NAME || 'tweet_sentiment',
            logging: console.log
        });

        await sequelize.authenticate();
        console.log('✅ Connected to database');

        // First, let's see what Pakistan tweets exist
        const pakistanTweets = await Tweet.findAll({
            where: {
                keyword: {
                    [Sequelize.Op.like]: '%pakistan%'
                }
            },
            include: [
                { model: Sentiment },
                { model: Topic },
                { model: Result }
            ]
        });

        console.log(`📊 Found ${pakistanTweets.length} tweets with keyword containing 'pakistan'`);
        
        if (pakistanTweets.length > 0) {
            console.log('📋 Pakistan tweets to be deleted:');
            pakistanTweets.forEach((tweet, index) => {
                console.log(`${index + 1}. ID: ${tweet.id}, Content: ${tweet.content.substring(0, 50)}..., Keyword: ${tweet.keyword}, Sentiment: ${tweet.Sentiment?.label || 'N/A'}`);
            });

            // Delete associated results first (foreign key constraint)
            const tweetIds = pakistanTweets.map(t => t.id);
            const deletedResults = await Result.destroy({
                where: {
                    tweetId: {
                        [Sequelize.Op.in]: tweetIds
                    }
                }
            });
            console.log(`🗑️ Deleted ${deletedResults} associated results`);

            // Delete associated news (if any)
            const deletedNews = await News.destroy({
                where: {
                    '$Results.tweetId$': {
                        [Sequelize.Op.in]: tweetIds
                    }
                },
                include: [{
                    model: Result,
                    required: true
                }]
            });
            console.log(`🗑️ Deleted ${deletedNews} associated news articles`);

            // Now delete the tweets
            const deletedTweets = await Tweet.destroy({
                where: {
                    keyword: {
                        [Sequelize.Op.like]: '%pakistan%'
                    }
                }
            });

            console.log(`✅ Successfully deleted ${deletedTweets} tweets with keyword 'pakistan'`);

            // Clean up orphaned sentiments and topics (optional)
            const orphanedSentiments = await Sentiment.findAll({
                include: [{
                    model: Tweet,
                    required: false
                }],
                where: {
                    '$Tweets.id$': null
                }
            });

            const orphanedTopics = await Topic.findAll({
                include: [{
                    model: Tweet,
                    required: false
                }],
                where: {
                    '$Tweets.id$': null
                }
            });

            if (orphanedSentiments.length > 0) {
                await Sentiment.destroy({
                    where: {
                        id: {
                            [Sequelize.Op.in]: orphanedSentiments.map(s => s.id)
                        }
                    }
                });
                console.log(`🧹 Cleaned up ${orphanedSentiments.length} orphaned sentiments`);
            }

            if (orphanedTopics.length > 0) {
                await Topic.destroy({
                    where: {
                        id: {
                            [Sequelize.Op.in]: orphanedTopics.map(t => t.id)
                        }
                    }
                });
                console.log(`🧹 Cleaned up ${orphanedTopics.length} orphaned topics`);
            }

        } else {
            console.log('ℹ️ No tweets found with keyword containing "pakistan"');
        }

        await sequelize.close();
        console.log('✅ Database connection closed');

    } catch (error) {
        console.error('❌ Error deleting Pakistan tweets:', error.message);
    }
}

deletePakistanTweets();
