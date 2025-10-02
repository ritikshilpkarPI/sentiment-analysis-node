const path = require('path');

// API Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// Log API key status
if (GEMINI_API_KEY) {
    console.log(`[CONSTANTS] Gemini API key loaded: ${GEMINI_API_KEY}`);
} else {
    console.log(`[CONSTANTS] ❌ GEMINI_API_KEY not found in environment variables`);
}

// File paths
const LAST_TWEET_COUNT_FILE = path.join(__dirname, "../../last_tweet_count.txt");
const TWEETS_INPUT_FILE = path.join(__dirname, "../../tweets_output.md");
const RESULTS_OUTPUT_FILE = path.join(__dirname, "../../sentiment_results.md");
const TOPIC_OUTPUT_FILE = path.join(__dirname, "../../topic.md");
const RESULTS_OUTPUT_FILE_JSON = path.join(__dirname, "../../results.json");

// Valid sentiments
const VALID_SENTIMENTS = ["Positive", "Negative", "Neutral", "Sarcastic", "Religious", "Funny", "Provocative"];

module.exports = {
    API_ENDPOINT,
    LAST_TWEET_COUNT_FILE,
    TWEETS_INPUT_FILE,
    RESULTS_OUTPUT_FILE,
    TOPIC_OUTPUT_FILE,
    RESULTS_OUTPUT_FILE_JSON,
    VALID_SENTIMENTS
}; 