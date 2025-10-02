const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Tweet = sequelize.define('Tweet', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    tweetId: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    author: {
        type: DataTypes.STRING,
        allowNull: true
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    topicId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'Topics',
            key: 'id'
        }
    },
    sentimentId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'Sentiments',
            key: 'id'
        }
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    keyword: {
        type: DataTypes.STRING,
        allowNull: true
    },
    mediaImages: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: []
    },
    mediaVideos: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: []
    },
    mediaAnalysis: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    mediaRelevance: {
        type: DataTypes.STRING,
        allowNull: true
    },
    mediaDescription: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    grokAnalysis: {
        type: DataTypes.JSON,
        allowNull: true
    },
    crossValidation: {
        type: DataTypes.JSON,
        allowNull: true
    },
    analysisConfidence: {
        type: DataTypes.STRING,
        allowNull: true
    },
    consensusResult: {
        type: DataTypes.STRING,
        allowNull: true
    },
    newsValidation: {
        type: DataTypes.JSON,
        allowNull: true
    },
    // Geo-sentiment analysis fields
    geoAnalysis: {
        type: DataTypes.JSON,
        allowNull: true
    },
    district: {
        type: DataTypes.STRING,
        allowNull: true
    },
    threatLevel: {
        type: DataTypes.STRING,
        allowNull: true
    },
    isAntiNational: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    timestamps: true
});

module.exports = Tweet; 