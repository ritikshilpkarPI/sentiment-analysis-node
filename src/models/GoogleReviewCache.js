const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GoogleReviewCache = sequelize.define('GoogleReviewCache', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    placeUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
        unique: true
    },
    reviews: {
        type: DataTypes.JSONB,
        allowNull: true
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    timestamps: false
});

module.exports = GoogleReviewCache; 