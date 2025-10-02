const { Tweet, Sentiment, Topic, Result, News } = require('./src/models');
const sequelize = require('./src/config/database');

async function deletePakistanTweets() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to database');

        // First, let's see what Pakistan tweets exist
        const pakistanTweets = await Tweet.findAll({
            where: {
                keyword: {
                    [sequelize.Sequelize.Op.like]: '%pakistan%'
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
                        [sequelize.Sequelize.Op.in]: tweetIds
                    }
                }
            });
            console.log(`🗑️ Deleted ${deletedResults} associated results`);

            // Now delete the tweets
            const deletedTweets = await Tweet.destroy({
                where: {
                    keyword: {
                        [sequelize.Sequelize.Op.like]: '%pakistan%'
                    }
                }
            });

            console.log(`✅ Successfully deleted ${deletedTweets} tweets with keyword 'pakistan'`);

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
