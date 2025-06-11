const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Result = sequelize.define('Result', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    tweetId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'Tweets',
            key: 'id'
        }
    },
    teamId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'Teams',
            key: 'id'
        }
    },
    companyId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'Companies',
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

module.exports = Result; 