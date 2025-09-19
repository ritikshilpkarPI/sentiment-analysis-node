const axios = require('axios');

class GrokService {
    static async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static async makeRequestWithRetry(prompt, maxRetries = 3, initialDelay = 2000) {
        let retries = 0;
        let delay = initialDelay;

        while (retries < maxRetries) {
            try {
                const response = await axios.post('https://api.x.ai/v1/chat/completions', {
                    model: 'grok-beta',
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 1000,
                    temperature: 0.7
                }, {
                    headers: {
                        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                });

                return response.data.choices[0].message.content.trim();
            } catch (error) {
                if (error.response?.status === 429) {
                    console.log(`[GROK] Rate limit hit. Retrying in ${delay}ms...`);
                    await this.sleep(delay);
                    delay *= 2; // Exponential backoff
                    retries++;
                } else {
                    console.error('[GROK] API Error:', error.response?.data || error.message);
                    throw error;
                }
            }
        }

        throw new Error('Max retries reached for Grok API request');
    }

    static async analyzeSentiment(tweetText) {
        try {
            const prompt = `
Analyze the sentiment of this tweet and provide a brief topic classification:

Tweet: "${tweetText}"

Please respond in the following format:
- **Sentiment**: [POSITIVE/NEGATIVE/NEUTRAL]
- **Topic**: [Brief topic description]
- **Confidence**: [High/Medium/Low]
- **Reasoning**: [Brief explanation of your analysis]

Focus on the emotional tone and main subject matter of the tweet.
            `;

            const response = await this.makeRequestWithRetry(prompt);
            
            // Parse the response
            const sentimentMatch = response.match(/\*\*Sentiment\*\*:\s*(.+)/i);
            const topicMatch = response.match(/\*\*Topic\*\*:\s*(.+)/i);
            const confidenceMatch = response.match(/\*\*Confidence\*\*:\s*(.+)/i);
            const reasoningMatch = response.match(/\*\*Reasoning\*\*:\s*(.+)/i);

            return {
                sentiment: sentimentMatch ? sentimentMatch[1].trim() : 'NEUTRAL',
                topic: topicMatch ? topicMatch[1].trim() : 'Unknown',
                confidence: confidenceMatch ? confidenceMatch[1].trim() : 'Medium',
                reasoning: reasoningMatch ? reasoningMatch[1].trim() : 'No reasoning provided',
                analysis: response
            };

        } catch (error) {
            console.error('[GROK] Error analyzing sentiment:', error.message);
            return {
                sentiment: 'NEUTRAL',
                topic: 'Unknown',
                confidence: 'Low',
                reasoning: 'Error in analysis',
                analysis: null
            };
        }
    }

    static async validateNews(newsTitle, newsContent, tweetText) {
        try {
            const prompt = `
Validate if this news article is relevant to the given tweet:

Tweet: "${tweetText}"

News Title: "${newsTitle}"
News Content: "${newsContent}"

Please analyze and respond in the following format:
- **Relevance**: [Highly Relevant/Somewhat Relevant/Not Relevant]
- **Match Score**: [0-100]
- **Key Connections**: [List main connections between tweet and news]
- **Validation**: [Valid/Invalid/Uncertain]
- **Reasoning**: [Brief explanation of your validation]

Consider semantic similarity, topic alignment, and contextual relevance.
            `;

            const response = await this.makeRequestWithRetry(prompt);
            
            // Parse the response
            const relevanceMatch = response.match(/\*\*Relevance\*\*:\s*(.+)/i);
            const scoreMatch = response.match(/\*\*Match Score\*\*:\s*(\d+)/i);
            const connectionsMatch = response.match(/\*\*Key Connections\*\*:\s*(.+)/i);
            const validationMatch = response.match(/\*\*Validation\*\*:\s*(.+)/i);
            const reasoningMatch = response.match(/\*\*Reasoning\*\*:\s*(.+)/i);

            return {
                relevance: relevanceMatch ? relevanceMatch[1].trim() : 'Uncertain',
                matchScore: scoreMatch ? parseInt(scoreMatch[1]) : 0,
                keyConnections: connectionsMatch ? connectionsMatch[1].trim() : 'No connections found',
                validation: validationMatch ? validationMatch[1].trim() : 'Uncertain',
                reasoning: reasoningMatch ? reasoningMatch[1].trim() : 'No reasoning provided',
                analysis: response
            };

        } catch (error) {
            console.error('[GROK] Error validating news:', error.message);
            return {
                relevance: 'Uncertain',
                matchScore: 0,
                keyConnections: 'Error in analysis',
                validation: 'Uncertain',
                reasoning: 'Error in validation',
                analysis: null
            };
        }
    }

    static async analyzeMediaContent(tweetText, mediaItems) {
        try {
            if (!mediaItems || (mediaItems.images.length === 0 && mediaItems.videos.length === 0)) {
                return {
                    mediaAnalysis: null,
                    mediaRelevance: 'no_media',
                    mediaDescription: null,
                    confidence: 'N/A'
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

Please analyze and respond in the following format:
- **Relevance**: [highly_relevant/somewhat_relevant/not_relevant]
- **Content Type**: [informational/promotional/entertainment/news/meme/personal/other]
- **Relationship**: [enhances/neutral/contradicts]
- **Description**: [Brief description of likely media content]
- **Confidence**: [High/Medium/Low]

Focus on how the media content relates to the tweet's message and context.
            `;

            const response = await this.makeRequestWithRetry(prompt);
            
            // Parse the response
            const relevanceMatch = response.match(/\*\*Relevance\*\*:\s*(.+)/i);
            const contentTypeMatch = response.match(/\*\*Content Type\*\*:\s*(.+)/i);
            const relationshipMatch = response.match(/\*\*Relationship\*\*:\s*(.+)/i);
            const descriptionMatch = response.match(/\*\*Description\*\*:\s*(.+)/i);
            const confidenceMatch = response.match(/\*\*Confidence\*\*:\s*(.+)/i);

            return {
                mediaAnalysis: response,
                mediaRelevance: relevanceMatch ? relevanceMatch[1].trim() : 'unknown',
                mediaContentType: contentTypeMatch ? contentTypeMatch[1].trim() : 'unknown',
                mediaRelationship: relationshipMatch ? relationshipMatch[1].trim() : 'unknown',
                mediaDescription: descriptionMatch ? descriptionMatch[1].trim() : 'No description available',
                confidence: confidenceMatch ? confidenceMatch[1].trim() : 'Medium'
            };

        } catch (error) {
            console.error('[GROK] Error analyzing media content:', error.message);
            return {
                mediaAnalysis: null,
                mediaRelevance: 'error',
                mediaDescription: 'Error analyzing media content',
                confidence: 'Low'
            };
        }
    }

    static async crossValidateWithGemini(tweetText, geminiResult, grokResult) {
        try {
            const prompt = `
Compare and validate two AI analyses of the same tweet:

Tweet: "${tweetText}"

Gemini Analysis:
Sentiment: ${geminiResult.sentiment}
Topic: ${geminiResult.topic}

Grok Analysis:
Sentiment: ${grokResult.sentiment}
Topic: ${grokResult.topic}
Confidence: ${grokResult.confidence}
Reasoning: ${grokResult.reasoning}

Please provide a cross-validation analysis in the following format:
- **Consensus**: [Agree/Disagree/Partial]
- **Final Sentiment**: [POSITIVE/NEGATIVE/NEUTRAL]
- **Final Topic**: [Topic description]
- **Confidence Level**: [High/Medium/Low]
- **Disagreement Areas**: [Areas where analyses differ]
- **Recommendation**: [Which analysis to trust more and why]

Consider the reasoning and confidence levels from both analyses.
            `;

            const response = await this.makeRequestWithRetry(prompt);
            
            // Parse the response
            const consensusMatch = response.match(/\*\*Consensus\*\*:\s*(.+)/i);
            const finalSentimentMatch = response.match(/\*\*Final Sentiment\*\*:\s*(.+)/i);
            const finalTopicMatch = response.match(/\*\*Final Topic\*\*:\s*(.+)/i);
            const confidenceMatch = response.match(/\*\*Confidence Level\*\*:\s*(.+)/i);
            const disagreementMatch = response.match(/\*\*Disagreement Areas\*\*:\s*(.+)/i);
            const recommendationMatch = response.match(/\*\*Recommendation\*\*:\s*(.+)/i);

            return {
                consensus: consensusMatch ? consensusMatch[1].trim() : 'Partial',
                finalSentiment: finalSentimentMatch ? finalSentimentMatch[1].trim() : geminiResult.sentiment,
                finalTopic: finalTopicMatch ? finalTopicMatch[1].trim() : geminiResult.topic,
                confidenceLevel: confidenceMatch ? confidenceMatch[1].trim() : 'Medium',
                disagreementAreas: disagreementMatch ? disagreementMatch[1].trim() : 'None identified',
                recommendation: recommendationMatch ? recommendationMatch[1].trim() : 'Use Gemini analysis',
                crossValidation: response
            };

        } catch (error) {
            console.error('[GROK] Error in cross-validation:', error.message);
            return {
                consensus: 'Partial',
                finalSentiment: geminiResult.sentiment,
                finalTopic: geminiResult.topic,
                confidenceLevel: 'Medium',
                disagreementAreas: 'Error in cross-validation',
                recommendation: 'Use Gemini analysis',
                crossValidation: null
            };
        }
    }
}

module.exports = GrokService;
