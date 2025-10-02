const { Sequelize } = require('sequelize');
require('dotenv').config();

async function createDatabase() {
    try {
        // Connect to postgres database first (default database)
        const sequelize = new Sequelize({
            dialect: 'postgres',
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            username: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            database: 'postgres', // Connect to default postgres database
            logging: console.log
        });

        await sequelize.authenticate();
        console.log('Connected to PostgreSQL');

        // Create the database
        await sequelize.query(`CREATE DATABASE ${process.env.DB_NAME || 'tweet_sentiment'}`);
        console.log(`Database '${process.env.DB_NAME || 'tweet_sentiment'}' created successfully`);

        await sequelize.close();
    } catch (error) {
        if (error.message.includes('already exists')) {
            console.log(`Database '${process.env.DB_NAME || 'tweet_sentiment'}' already exists`);
        } else {
            console.error('Error creating database:', error);
        }
    }
}

createDatabase();
