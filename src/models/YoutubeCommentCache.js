const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const YoutubeCommentCache = sequelize.define('YoutubeCommentCache', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    videoUrl: {
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

module.exports = YoutubeCommentCache; 