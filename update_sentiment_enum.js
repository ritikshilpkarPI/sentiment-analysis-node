const sequelize = require('./src/config/database');

async function updateSentimentEnum() {
    try {
        console.log('Updating Sentiment enum to include new values...');
        
        // Add new sentiment values to the existing enum
        const queries = [
            `ALTER TYPE "enum_Sentiments_label" ADD VALUE IF NOT EXISTS 'SARCASTIC';`,
            `ALTER TYPE "enum_Sentiments_label" ADD VALUE IF NOT EXISTS 'RELIGIOUS';`,
            `ALTER TYPE "enum_Sentiments_label" ADD VALUE IF NOT EXISTS 'FUNNY';`,
            `ALTER TYPE "enum_Sentiments_label" ADD VALUE IF NOT EXISTS 'PROVOCATIVE';`
        ];
        
        for (const query of queries) {
            try {
                await sequelize.query(query);
                console.log(`✅ Executed: ${query}`);
            } catch (error) {
                if (error.message.includes('already exists')) {
                    console.log(`ℹ️  Value already exists: ${query}`);
                } else {
                    console.error(`❌ Error executing: ${query}`, error.message);
                }
            }
        }
        
        console.log('✅ Successfully updated Sentiment enum!');
        
    } catch (error) {
        console.error('❌ Error updating enum:', error.message);
    } finally {
        await sequelize.close();
    }
}

updateSentimentEnum();
