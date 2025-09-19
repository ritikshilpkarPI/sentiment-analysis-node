const sequelize = require('./src/config/database');

async function updateEnum() {
    try {
        console.log('Adding USER to enum_Users_role...');
        
        // Add USER to the existing enum
        await sequelize.query(`
            ALTER TYPE "enum_Users_role" ADD VALUE 'USER';
        `);
        
        console.log('✅ Successfully added USER to enum_Users_role');
        
    } catch (error) {
        if (error.message.includes('already exists')) {
            console.log('✅ USER already exists in enum_Users_role');
        } else {
            console.error('❌ Error updating enum:', error.message);
        }
    } finally {
        await sequelize.close();
    }
}

updateEnum();
