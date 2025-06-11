const axios = require('axios');
const { API_ENDPOINT } = require('../config/constants');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

class GeminiService {
    static async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static async makeRequestWithRetry(prompt, maxRetries = 3, initialDelay = 2000) {
        let retries = 0;
        let delay = initialDelay;

        while (retries < maxRetries) {
            try {
                const response = await axios.post(API_ENDPOINT, {
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }]
                });

                return response.data.candidates[0].content.parts[0].text.trim();
            } catch (error) {
                if (error.response?.status === 429) {
                    console.log(`Rate limit hit. Retrying in ${delay}ms...`);
                    await this.sleep(delay);
                    delay *= 2; // Exponential backoff
                    retries++;
                    
                    if (retries === maxRetries) {
                        await this.sleep(30000); // Wait 30 seconds before next attempt
                    }
                } else {
                    throw error;
                }
            }
        }

        throw new Error('Max retries reached for API request');
    }

    static readExistingTopics() {
        try {
            const topicFile = path.join(__dirname, '../../topic.md');
            if (fs.existsSync(topicFile)) {
                const content = fs.readFileSync(topicFile, 'utf-8');
                return content.split('\n').filter(line => line.trim());
            }
        } catch (err) {
            console.error('[ERROR] Failed to read topics:', err);
        }
        return [];
    }

    static getSentimentPrompt(text, existingTopics) {
        const topicListStr = existingTopics.length > 0 
            ? existingTopics.map(t => `- ${t}`).join('\n')
            : 'None';

        return `Analyze the following tweet: "${text}".\n` +
            '1. Determine its sentiment. Respond with one of the following sentiments: Positive, Negative, Neutral, Sarcastic, Religious, Funny, Provocative.\n' +
            '2. Identify the topic or subject of the tweet.\n' +
            `   Here's a list of existing topics:\n${topicListStr}\n` +
            '   If the tweet matches or is closely related to any topic from the list below, return that exact topic string from the list (no rewording). Only generate a new topic if there is absolutely no match.\n' +
            '   When providing a topic, ensure it is **well-defined and descriptive**, making it clear what the tweet is about.\n' +
            '   For example, instead of "Politics," say "Government Policies on Climate Change" if relevant.\n' +
            'Provide your response in the following format exactly:\n' +
            '- **Sentiment**: <Sentiment>\n' +
            '- **Topic**: <Well-defined and descriptive topic>';
    }

    static async analyzeSentiment(tweet) {
        try {
            const existingTopics = this.readExistingTopics();
            const prompt = this.getSentimentPrompt(tweet, existingTopics);
            const response = await this.makeRequestWithRetry(prompt);
            
            // Parse response
            const sentimentMatch = response.match(/\*\*Sentiment\*\*:\s*(.*)/);
            const topicMatch = response.match(/\*\*Topic\*\*:\s*(.*)/);

            const sentiment = sentimentMatch ? sentimentMatch[1].trim() : 'Neutral';
            const topic = topicMatch ? topicMatch[1].trim() : 'Unknown';

            // Validate sentiment
            const validSentiments = ['Positive', 'Negative', 'Neutral', 'Sarcastic', 'Religious', 'Funny', 'Provocative'];
            if (!validSentiments.includes(sentiment)) {
                console.error('Gemini API returned unexpected sentiment:', sentiment);
                return { sentiment: 'Neutral', topic: 'Unknown' };
            }

            // Handle new topics
            if (topic !== 'Unknown') {
                const topicFile = path.join(__dirname, '../../topic.md');
                if (!existingTopics.includes(topic)) {
                    fs.appendFileSync(topicFile, topic + '\n', 'utf-8');
                    console.log(`[Gemini] New topic appended: ${topic}`);
                }
            }

            return { sentiment, topic };
        } catch (error) {
            console.error('Error analyzing sentiment:', error.message);
            return { sentiment: 'Neutral', topic: 'Unknown' };
        }
    }

    static async fetchGoogleNews(topic, location = 'IN') {
        try {
            const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=en-${location}&gl=${location}&ceid=${location}:en`;
            const response = await axios.get(rssUrl);
            
            if (response.status === 200) {
                const parser = new xml2js.Parser();
                const result = await parser.parseStringPromise(response.data);
                
                if (result.rss && result.rss.channel && result.rss.channel[0].item) {
                    return result.rss.channel[0].item.slice(0, 5).map(item => ({
                        title: item.title[0],
                        link: item.link[0]
                    }));
                }
            }
            return [];
        } catch (error) {
            console.error('[ERROR] Failed to fetch Google News:', error.message);
            return [];
        }
    }
}

module.exports = GeminiService; 