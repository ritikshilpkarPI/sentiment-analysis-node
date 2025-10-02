const { processTweetsForKeyword } = require('./src/app');

async function testPakistanProcessing() {
    try {
        console.log('🧪 Testing Pakistan tweet processing...');
        await processTweetsForKeyword('pakistan');
        console.log('✅ Pakistan processing completed');
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testPakistanProcessing();
