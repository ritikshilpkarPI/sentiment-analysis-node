require('dotenv').config();
const GeminiService = require('./src/services/geminiService');

async function testMediaAnalysis() {
    try {
        console.log('🧪 Testing media analysis...');
        
        const testTweet = "Some Bangladeshi posted this song on Facebook after Shaheen Shah Afridi doesnt recognise the Tigers. A Bangladeshi Diss Track for whole Pakistan and Pakistani Cricket Team";
        const testMedia = {
            images: [
                { url: 'https://example.com/image1.jpg', alt: 'Cricket match image' }
            ],
            videos: []
        };
        
        console.log('📝 Test tweet:', testTweet);
        console.log('🖼️ Test media:', testMedia);
        
        const result = await GeminiService.analyzeMediaContentWithGrokValidation(testTweet, testMedia);
        
        console.log('✅ Media analysis result:', JSON.stringify(result, null, 2));
        
    } catch (error) {
        console.error('❌ Media analysis failed:', error.message);
        console.error('📋 Full error:', error);
    }
}

testMediaAnalysis();
