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
        allowNull: true,
        validate: {
            min: -1,
            max: 1
        }
    },
    label: {
        type: DataTypes.ENUM('POSITIVE', 'NEGATIVE', 'NEUTRAL'),
        allowNull: true
    },
    confidence: {
        type: DataTypes.FLOAT,
        allowNull: true,
        validate: {
            min: 0,
            max: 1
        }
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    timestamps: true
});

module.exports = Sentiment; 