const axios = require('axios');
require('dotenv').config();

// Test the exact parsing logic from GeminiService
async function testSentimentParsing() {
    try {
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
        
        const testTweet = "Some Bangladeshi posted this song on Facebook after Shaheen Shah Afridi doesnt recognise the Tigers. A Bangladeshi Diss Track for whole Pakistan and Pakistani Cricket Team";
        
        const prompt = `Analyze the following tweet: "${testTweet}".\n` +
            '1. Determine its sentiment. You MUST respond with EXACTLY one of these three sentiments only: Positive, Negative, Neutral. Do not use any other sentiment labels.\n' +
            '   - Positive: For tweets expressing happiness, approval, optimism, praise, or encouraging content\n' +
            '   - Negative: For tweets expressing anger, disapproval, criticism, sadness, sarcasm, or discouraging content\n' +
            '   - Neutral: For tweets that are factual, informational, or do not express clear positive/negative emotions\n' +
            '2. Identify the topic or subject of the tweet.\n' +
            '   Here\'s a list of existing topics:\nNone\n' +
            '   If the tweet matches or is closely related to any topic from the list below, return that exact topic string from the list (no rewording). Only generate a new topic if there is absolutely no match.\n' +
            '   When providing a topic, ensure it is **well-defined and descriptive**, making it clear what the tweet is about.\n' +
            '   For example, instead of "Politics," say "Government Policies on Climate Change" if relevant.\n' +
            'Provide your response in the following format exactly:\n' +
            '- **Sentiment**: <Sentiment>\n' +
            '- **Topic**: <Well-defined and descriptive topic>';

        console.log('🧪 Testing Gemini API call...');
        const response = await axios.post(API_ENDPOINT, {
            contents: [{
                parts: [{
                    text: prompt,
                }],
            }],
        }, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const data = response.data;
        console.log('📡 Raw API Response:', JSON.stringify(data, null, 2));

        if (data.candidates && data.candidates[0] && data.candidates[0].content && 
            data.candidates[0].content.parts && data.candidates[0].content.parts[0] && 
            data.candidates[0].content.parts[0].text) {
            
            const rawResponse = data.candidates[0].content.parts[0].text.trim();
            console.log('📝 Raw Response Text:', rawResponse);

            // Test the exact parsing logic from GeminiService.analyzeSentiment
            const sentimentMatch = rawResponse.match(/\*\*Sentiment\*\*:\s*(.*)/);
            const topicMatch = rawResponse.match(/\*\*Topic\*\*:\s*(.*)/);

            console.log('🔍 Sentiment Match:', sentimentMatch);
            console.log('🔍 Topic Match:', topicMatch);

            const sentiment = sentimentMatch ? sentimentMatch[1].trim() : 'Neutral';
            const topic = topicMatch ? topicMatch[1].trim() : 'Unknown';

            console.log('✅ Parsed Sentiment:', sentiment);
            console.log('✅ Parsed Topic:', topic);

            // Test validation logic
            const validSentiments = ['Positive', 'Negative', 'Neutral'];
            if (!validSentiments.includes(sentiment)) {
                console.error('❌ Gemini API returned unexpected sentiment:', sentiment, '- defaulting to Neutral');
                console.log('🔄 Final Sentiment: Neutral');
            } else {
                console.log('✅ Valid sentiment:', sentiment);
            }

            // Test mapping to database format (from processNewTweets)
            const validDbSentiments = ['POSITIVE', 'NEGATIVE', 'NEUTRAL'];
            const mappedSentiment = validDbSentiments.includes(sentiment.toUpperCase()) 
                ? sentiment.toUpperCase() 
                : 'NEUTRAL';

            console.log('🗄️ Database Mapped Sentiment:', mappedSentiment);

        } else {
            console.error('❌ No valid response from API');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('📡 API Error Response:', error.response.data);
        }
    }
}

testSentimentParsing();
