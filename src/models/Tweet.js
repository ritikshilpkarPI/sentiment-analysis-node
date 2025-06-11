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
    }
}, {
    timestamps: true
});

module.exports = Tweet; 