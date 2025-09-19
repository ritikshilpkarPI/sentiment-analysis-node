const User = require('./User');
const Company = require('./Company');
const Team = require('./Team');
const Keyword = require('./Keyword');
const Tweet = require('./Tweet');
const Topic = require('./Topic');
const Sentiment = require('./Sentiment');
const Result = require('./Result');
const News = require('./News');
const YoutubeCommentCache = require('./YoutubeCommentCache');
const InstagramCommentCache = require('./InstagramCommentCache');
const GoogleReviewCache = require('./GoogleReviewCache');

// Company - Team relationship
Company.hasMany(Team, { foreignKey: 'companyId' });
Team.belongsTo(Company, { foreignKey: 'companyId' });

// Team - User relationship
Team.hasMany(User, { foreignKey: 'teamId' });
User.belongsTo(Team, { foreignKey: 'teamId' });

// Company - User relationship
Company.hasMany(User, { foreignKey: 'companyId' });
User.belongsTo(Company, { foreignKey: 'companyId' });

// Team - Keyword relationship (through TeamKeyword)
Team.belongsToMany(Keyword, { 
    through: 'TeamKeyword',
    foreignKey: 'teamId',
    otherKey: 'keywordId'
});
Keyword.belongsToMany(Team, { 
    through: 'TeamKeyword',
    foreignKey: 'keywordId',
    otherKey: 'teamId'
});

// Tweet relationships
Tweet.belongsTo(Topic, { foreignKey: 'topicId' });
Topic.hasMany(Tweet, { foreignKey: 'topicId' });

Tweet.belongsTo(Sentiment, { foreignKey: 'sentimentId' });
Sentiment.hasMany(Tweet, { foreignKey: 'sentimentId' });

// Result relationships
Result.belongsTo(Tweet, { foreignKey: 'tweetId' });
Tweet.hasMany(Result, { foreignKey: 'tweetId' });

Result.belongsTo(Team, { foreignKey: 'teamId' });
Team.hasMany(Result, { foreignKey: 'teamId' });

Result.belongsTo(Company, { foreignKey: 'companyId' });
Company.hasMany(Result, { foreignKey: 'companyId' });

// Result - News relationship
Result.belongsToMany(News, {
    through: 'ResultNews',
    foreignKey: 'resultId',
    otherKey: 'newsId'
});
News.belongsToMany(Result, {
    through: 'ResultNews',
    foreignKey: 'newsId',
    otherKey: 'resultId'
});

module.exports = {
    User,
    Company,
    Team,
    Keyword,
    Tweet,
    Topic,
    Sentiment,
    Result,
    News,
    YoutubeCommentCache,
    InstagramCommentCache,
    GoogleReviewCache
}; 