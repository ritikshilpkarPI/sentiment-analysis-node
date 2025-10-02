const axios = require('axios');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const stringSimilarity = require('string-similarity');
const GrokService = require('./grokService');

// API Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// Log API key status
if (GEMINI_API_KEY) {
    console.log(`[GEMINI] API key loaded: ${GEMINI_API_KEY}`);
} else {
    console.log(`[GEMINI] ❌ GEMINI_API_KEY not found in environment variables`);
}

class GeminiService {
    static async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static async makeRequestWithRetry(prompt, maxRetries = 5, initialDelay = 5000) {
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
                console.log(`[GEMINI] API Error: ${error.response?.status} - ${error.response?.statusText}`);
                console.log(`[GEMINI] Error details:`, error.response?.data);
                
                if (error.response?.status === 429) {
                    console.log(`Rate limit hit. Retrying in ${delay}ms...`);
                    await this.sleep(delay);
                    delay *= 2; // Exponential backoff
                    retries++;
                    
                    if (retries === maxRetries) {
                        await this.sleep(60000); // Wait 60 seconds before final attempt
                    }
                } else {
                    console.log(`[GEMINI] Non-rate-limit error, throwing...`);
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
            '1. Determine its sentiment. You MUST respond with EXACTLY one of these three sentiments only: Positive, Negative, Neutral. Do not use any other sentiment labels.\n' +
            '   - Positive: For tweets expressing happiness, approval, optimism, praise, or encouraging content\n' +
            '   - Negative: For tweets expressing anger, disapproval, criticism, sadness, sarcasm, or discouraging content\n' +
            '   - Neutral: For tweets that are factual, informational, or do not express clear positive/negative emotions\n' +
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

            // Validate sentiment - only accept the three database-supported values
            const validSentiments = ['Positive', 'Negative', 'Neutral'];
            if (!validSentiments.includes(sentiment)) {
                console.error('Gemini API returned unexpected sentiment:', sentiment, '- defaulting to Neutral');
                return { sentiment: 'Neutral', topic: topic || 'Unknown' };
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

    static async analyzeSentimentWithGrokValidation(tweetText) {
        try {
            // Get Gemini analysis only (Grok disabled)
            const geminiResult = await this.analyzeSentiment(tweetText);
            
            console.log('[GEMINI] Using Gemini-only analysis (Grok disabled)');
            
            return {
                gemini: geminiResult,
                grok: null,
                crossValidation: null,
                finalSentiment: geminiResult.sentiment,
                finalTopic: geminiResult.topic,
                confidence: 'Medium',
                consensus: 'Gemini Only'
            };
        } catch (error) {
            console.error('Error in enhanced sentiment analysis:', error.message);
            throw error;
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

    static async fetchAndValidateNewsWithGrok(topic, tweetText, location = 'IN') {
        try {
            // Fetch news articles
            const newsArticles = await this.fetchGoogleNews(topic, location);
            
            if (newsArticles.length === 0) {
                return {
                    articles: [],
                    validatedArticles: [],
                    summary: 'No news articles found'
                };
            }

            // Skip Grok validation (disabled)
            console.log('[GEMINI] Using Gemini-only news fetching (Grok disabled)');
            
            const validatedArticles = newsArticles.slice(0, 3).map(article => ({
                ...article,
                validation: null,
                relevance: 'Unknown',
                matchScore: 0.5, // Default score
                isValid: true
            }));

            return {
                articles: newsArticles,
                validatedArticles: validatedArticles,
                summary: `Found ${newsArticles.length} articles (Grok validation disabled)`,
                topMatch: validatedArticles[0] || null
            };

        } catch (error) {
            console.error('[GEMINI] Error in enhanced news fetching:', error.message);
            return {
                articles: [],
                validatedArticles: [],
                summary: 'Error fetching and validating news'
            };
        }
    }

    /**
     * Analyze sentiments for an array of comments in a single Gemini API call
     * @param {string[]} comments
     * @returns {Promise<Array<{sentiment: string, topic: string}>>}
     */
    static async analyzeSentimentsBatch(comments) {
        if (!Array.isArray(comments) || comments.length === 0) return [];
        // Allowed sentiment labels
        const allowedSentiments = [
            'Positive',
            'Negative',
            'Neutral',
            'Suggestions',
            'Requests/Query',
            'Competitors Mentioned'
        ];
        // List of known competitor names (expand as needed)
        const competitorNames = [
            'XYZ Institute',
            'ABC',
            'DEF',
            'Coursera',
            'Udemy',
            'edX',
            'Khan Academy',
            'Byju',
            'Unacademy',
            'Vedantu',
            'Toppr',
            'PW',
            'Physics Wallah'
        ];
        // Improved prompt for better topic extraction and strict sentiment labels
        const prompt =
            'For each comment below, respond ONLY with a numbered list in this format (no extra text):\n' +
            '1. **Sentiment**: <Sentiment>\n   **Topic**: <Well-defined and descriptive topic>\n2. ...\n' +
            'For the **Sentiment**, choose ONLY from the following list (do not invent new labels):\n' +
            allowedSentiments.map(s => `- ${s}`).join('\n') + '\n' +
            'Use **Negative** ONLY for comments that express clear dissatisfaction, complaints, or criticism.\n' +
            'Use **Positive** for compliments, appreciation, or general positive feedback.\n' +
            'Use **Neutral** for generic, neutral, irrelevant, or common comments such as "Nice", "Good", "Wow", emojis, or remarks that are neither positive nor negative.\n' +
            'Use **Suggestions** for improvement ideas that do not mention a competitor.\n' +
            'Use **Requests/Query** for questions or requests for information.\n' +
            'Use **Competitors Mentioned** ONLY if the comment is suggesting, requesting, or referencing another company, institute, or product as an alternative or comparison (e.g., "You should try XYZ Institute" or "ABC does this better").\n' +
            'For the **Topic**, identify the main subject or issue the comment is actually talking about. Avoid generic topics like \'General\' or \'YouTube\'. Use the actual subject of the comment, e.g., \'Government Policies on Climate Change\', \'iPhone Battery Life\', etc.\n' +
            'Examples:\n' +
            '"Nice" -> Sentiment: Neutral\n' +
            '"Good job!" -> Sentiment: Positive\n' +
            '"This is bad" -> Sentiment: Negative\n' +
            '"Can you show more details?" -> Sentiment: Requests/Query\n' +
            '"Try XYZ Institute, they are better" -> Sentiment: Competitors Mentioned\n' +
            comments.map((c, i) => `${i + 1}. ${c}`).join('\n');
        console.log('Gemini batch prompt:\n', prompt); // <-- LOG PROMPT

        const response = await this.makeRequestWithRetry(prompt);
        console.log('Gemini batch response:\n', response); // <-- LOG RAW RESPONSE
        // Try regex parse first
        const results = [];
        const regex = /\d+\. \*\*Sentiment\*\*:\s*([^\n]+)\n\s*\*\*Topic\*\*:\s*([^\n]+)/g;
        let match;
        while ((match = regex.exec(response)) !== null) {
            results.push({
                sentiment: match[1].trim(),
                topic: match[2].trim()
            });
        }
        // If regex fails, try line-by-line fallback
        if (results.length === 0) {
            const lines = response.split(/\n+/).filter(line => line.match(/\*\*Sentiment\*\*/));
            for (const line of lines) {
                const m = line.match(/\*\*Sentiment\*\*:\s*([^\n]+)/);
                results.push({
                    sentiment: m ? m[1].trim() : 'Neutral',
                    topic: 'Unknown'
                });
            }
        }
        // Fallback: if still not enough, fill with Neutral/Unknown
        while (results.length < comments.length) {
            results.push({ sentiment: 'Neutral', topic: 'Unknown' });
        }
        // Post-process: map any unexpected sentiment to closest allowed label
        for (let i = 0; i < results.length; i++) {
            let r = results[i];
            if (!allowedSentiments.includes(r.sentiment)) {
                const best = stringSimilarity.findBestMatch(r.sentiment, allowedSentiments);
                r.sentiment = best.bestMatch.target;
            }
            // Post-process: if comment contains competitor name, force sentiment
            if (
                competitorNames.some(name => comments[i].toLowerCase().includes(name.toLowerCase())) &&
                r.sentiment !== 'Competitors Mentioned'
            ) {
                r.sentiment = 'Competitors Mentioned';
            }
            // Post-process: if comment is very short or generic and Gemini returned Negative or Positive, map to Neutral
            if (
                (r.sentiment === 'Negative' || r.sentiment === 'Positive') &&
                (comments[i].length < 8 || /^(nice|good|wow|amazing|great|cool|ok|okay|super|awesome|love|like|superb|perfect|beautiful|😍|👍|🔥|😊|😎|👏|👌)$/i.test(comments[i].trim()))
            ) {
                r.sentiment = 'Neutral';
            }
        }
        return results;
    }

    static async analyzeMediaContent(tweetText, mediaItems) {
        try {
            if (!mediaItems || (mediaItems.images.length === 0 && mediaItems.videos.length === 0)) {
                return {
                    mediaAnalysis: null,
                    mediaRelevance: 'no_media',
                    mediaDescription: null
                };
            }

            // Create a prompt to analyze media in context of the tweet
            let mediaDescription = '';
            
            if (mediaItems.images.length > 0) {
                mediaDescription += `This tweet contains ${mediaItems.images.length} image(s). `;
                mediaItems.images.forEach((img, index) => {
                    mediaDescription += `Image ${index + 1}: ${img.alt || 'No alt text available'}. `;
                });
            }
            
            if (mediaItems.videos.length > 0) {
                mediaDescription += `This tweet contains ${mediaItems.videos.length} video(s). `;
                mediaItems.videos.forEach((vid, index) => {
                    mediaDescription += `Video ${index + 1}: ${vid.type} format. `;
                });
            }

            const prompt = `
Analyze the relationship between this tweet text and its attached media:

Tweet Text: "${tweetText}"

Media Information: ${mediaDescription}

Please analyze:
1. How relevant is the media to the tweet content? (highly_relevant, somewhat_relevant, not_relevant)
2. What type of content does the media likely show? (informational, promotional, entertainment, news, meme, personal, other)
3. Does the media enhance or contradict the tweet's message? (enhances, neutral, contradicts)
4. Provide a brief description of what the media likely contains based on the tweet context

Respond in the following format:
- **Relevance**: <highly_relevant/somewhat_relevant/not_relevant>
- **Content Type**: <informational/promotional/entertainment/news/meme/personal/other>
- **Relationship**: <enhances/neutral/contradicts>
- **Description**: <Brief description of likely media content>
`;

            const response = await this.makeRequestWithRetry(prompt);
            
            // Parse the response
            const relevanceMatch = response.match(/\*\*Relevance\*\*:\s*(.+)/i);
            const contentTypeMatch = response.match(/\*\*Content Type\*\*:\s*(.+)/i);
            const relationshipMatch = response.match(/\*\*Relationship\*\*:\s*(.+)/i);
            const descriptionMatch = response.match(/\*\*Description\*\*:\s*(.+)/i);

            return {
                mediaAnalysis: response,
                mediaRelevance: relevanceMatch ? relevanceMatch[1].trim() : 'unknown',
                mediaContentType: contentTypeMatch ? contentTypeMatch[1].trim() : 'unknown',
                mediaRelationship: relationshipMatch ? relationshipMatch[1].trim() : 'unknown',
                mediaDescription: descriptionMatch ? descriptionMatch[1].trim() : 'No description available'
            };

        } catch (error) {
            console.error('[GEMINI] Error analyzing media content:', error.message);
            console.error('[GEMINI] Full error details:', error);
            return {
                mediaAnalysis: null,
                mediaRelevance: 'error',
                mediaDescription: 'Error analyzing media content'
            };
        }
    }

    static async analyzeMediaContentWithGrokValidation(tweetText, mediaItems) {
        try {
            // Get Gemini analysis only (Grok disabled)
            const geminiResult = await this.analyzeMediaContent(tweetText, mediaItems);
            
            console.log('[GEMINI] Using Gemini-only media analysis (Grok disabled)');
            
            return {
                gemini: geminiResult,
                grok: null,
                finalAnalysis: geminiResult.mediaAnalysis,
                finalRelevance: geminiResult.mediaRelevance,
                finalDescription: geminiResult.mediaDescription,
                confidence: 'Medium'
            };
        } catch (error) {
            console.error('[GEMINI] Error in enhanced media analysis:', error.message);
            console.error('[GEMINI] Full error details:', error);
            return {
                gemini: null,
                grok: null,
                finalAnalysis: null,
                finalRelevance: 'error',
                finalDescription: 'Error analyzing media content',
                confidence: 'Low'
            };
        }
    }
}

module.exports = GeminiService; 