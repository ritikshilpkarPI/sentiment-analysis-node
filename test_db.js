const { Sequelize } = require('sequelize');
require('dotenv').config();

async function testConnection() {
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
        
        // Test if tables exist
        const [results] = await sequelize.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log('📋 Tables:', results.map(r => r.table_name));
        
        await sequelize.close();
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
    }
}

testConnection();
