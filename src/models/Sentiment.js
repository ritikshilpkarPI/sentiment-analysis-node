const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Sentiment = sequelize.define('Sentiment', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    score: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    label: {
        type: DataTypes.ENUM('POSITIVE', 'NEGATIVE', 'NEUTRAL', 'SARCASTIC', 'RELIGIOUS', 'FUNNY', 'PROVOCATIVE'),
        allowNull: true
    },
    confidence: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    timestamps: true
});

module.exports = Sentiment; 