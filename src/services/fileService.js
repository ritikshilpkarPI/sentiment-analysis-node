const fs = require('fs');
const path = require('path');
const {
    LAST_TWEET_COUNT_FILE,
    TWEETS_INPUT_FILE,
    RESULTS_OUTPUT_FILE,
    RESULTS_OUTPUT_FILE_JSON
} = require('../config/constants');

class FileService {
    static async getLastTweetCount() {
        if (fs.existsSync(LAST_TWEET_COUNT_FILE)) {
            try {
                const data = fs.readFileSync(LAST_TWEET_COUNT_FILE, 'utf-8').trim();
                if (/^\d+$/.test(data)) {
                    console.log(`[DEBUG] last_tweet_count read from disk: ${data}`);
                    return parseInt(data, 10);
                }
            } catch (err) {
                console.log(`[DEBUG] Could not read last_tweet_count.txt: ${err}`);
            }
        }
        console.log('[DEBUG] No valid last tweet count found. Starting from 0.');
        return 0;
    }

    static async updateLastTweetCount(count) {
        console.log(`[DEBUG] Setting last tweet count to: ${count}`);
        fs.writeFileSync(LAST_TWEET_COUNT_FILE, String(count), 'utf-8');
    }

    static async readTweetsFile() {
        if (!fs.existsSync(TWEETS_INPUT_FILE)) {
            return [];
        }
        console.log(`[DEBUG] Reading tweets from: ${TWEETS_INPUT_FILE}`);
        const lines = fs.readFileSync(TWEETS_INPUT_FILE, 'utf-8').split('\n');
        const tweets = [];
        let currentLines = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('## ')) {
                continue;
            }
            if (trimmed.startsWith('- ')) {
                if (currentLines.length > 0) {
                    tweets.push(currentLines.join(' ').trim());
                    currentLines = [];
                }
                currentLines.push(trimmed.slice(2).trim()); // remove '- '
            } else {
                currentLines.push(trimmed);
            }
        }
        if (currentLines.length > 0) {
            tweets.push(currentLines.join(' ').trim());
        }
        console.log(`[DEBUG] Found ${tweets.length} tweet lines in ${TWEETS_INPUT_FILE}`);
        return tweets;
    }

    static async writeResults(results) {
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
        let markdownOutput = `\n## Results at ${now}\n\n`;
        let jsonOutput = {};
        
        for (const { tweet, sentiment, topic, news } of results) {
            const singleLineTweet = tweet.replace(/\n/g, ' ');
            markdownOutput += `- **Tweet**: ${singleLineTweet} - **Sentiment**: ${sentiment} - **Topic**: ${topic}\n`;
            if (news && news.length > 0) {
                markdownOutput += '  **Related News**:\n';
                for (const { title, link } of news) {
                    markdownOutput += `  - [${title}](${link})\n`;
                }
            }
            markdownOutput += '\n';

            // Update JSON output
            if (!jsonOutput[topic]) {
                jsonOutput[topic] = [];
            }
            jsonOutput[topic].push({
                tweet,
                sentiment,
                news: news.map(({ title, link }) => ({ title, link }))
            });
        }
        
        // Write markdown results
        fs.appendFileSync(RESULTS_OUTPUT_FILE, markdownOutput, 'utf-8');
        console.log(`[DEBUG] Appended ${results.length} results to sentiment_results.md`);

        // Write JSON results
        try {
            let existingData = {};
            if (fs.existsSync(RESULTS_OUTPUT_FILE_JSON) && fs.statSync(RESULTS_OUTPUT_FILE_JSON).size > 0) {
                try {
                    existingData = JSON.parse(fs.readFileSync(RESULTS_OUTPUT_FILE_JSON, 'utf-8'));
                } catch (err) {
                    console.error('[ERROR] Failed to parse existing JSON:', err);
                }
            }

            // Merge existing data with new results
            for (const [topic, tweets] of Object.entries(jsonOutput)) {
                if (!existingData[topic]) {
                    existingData[topic] = [];
                }
                existingData[topic].push(...tweets);
            }

            fs.writeFileSync(RESULTS_OUTPUT_FILE_JSON, JSON.stringify(existingData, null, 4), 'utf-8');
            console.log(`[DEBUG] Updated results.json with ${results.length} new results`);
        } catch (err) {
            console.error('[ERROR] Failed to write to JSON file:', err);
        }
    }

    static async readResultsFile() {
        if (!fs.existsSync(RESULTS_OUTPUT_FILE)) {
            return 'No results yet!';
        }
        try {
            return fs.readFileSync(RESULTS_OUTPUT_FILE, 'utf-8');
        } catch (err) {
            console.error('[ERROR] Failed to read results file:', err);
            return 'Error reading results';
        }
    }

    static async readResultsJsonFile() {
        if (!fs.existsSync(RESULTS_OUTPUT_FILE_JSON)) {
            return 'No results yet!';
        }
        try {
            return fs.readFileSync(RESULTS_OUTPUT_FILE_JSON, 'utf-8');
        } catch (err) {
            console.error('[ERROR] Failed to read JSON results:', err);
            return 'Error reading results';
        }
    }
}

module.exports = FileService; 