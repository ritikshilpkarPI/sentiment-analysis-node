const { Sequelize } = require('sequelize');
require('dotenv').config();

// Import models to register them
require('./src/models');

async function initializeTables() {
    try {
        const sequelize = new Sequelize({
            dialect: 'postgres',
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            username: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            database: process.env.DB_NAME || 'tweet_sentiment',
            logging: console.log
        });

        await sequelize.authenticate();
        console.log('✅ Database connection successful');

        // Sync all models
        await sequelize.sync({ alter: true });
        console.log('✅ Database tables created successfully');
        
        await sequelize.close();
    } catch (error) {
        console.error('❌ Database initialization failed:', error.message);
    }
}

initializeTables();
