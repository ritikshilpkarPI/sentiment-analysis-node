const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InstagramCommentCache = sequelize.define('InstagramCommentCache', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    reelUrl: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
    },
    comments: {
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

module.exports = InstagramCommentCache; 