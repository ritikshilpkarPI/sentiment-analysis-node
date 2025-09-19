const fs = require('fs');
const path = require('path');

/**
 * Advanced JSON to CSV converter with multiple output options
 */
class AdvancedJsonToCsvConverter {
    constructor(jsonData) {
        this.jsonData = jsonData;
        this.stats = {
            totalCategories: 0,
            totalTweets: 0,
            totalNewsArticles: 0,
            sentimentDistribution: {},
            categoryDistribution: {}
        };
    }

    /**
     * Generate summary statistics
     */
    generateStats() {
        this.stats.totalCategories = Object.keys(this.jsonData).length;
        
        for (const [category, items] of Object.entries(this.jsonData)) {
            if (Array.isArray(items)) {
                this.stats.categoryDistribution[category] = items.length;
                
                for (const item of items) {
                    if (item.tweet && item.sentiment) {
                        this.stats.totalTweets++;
                        
                        // Count sentiment distribution
                        const sentiment = item.sentiment;
                        this.stats.sentimentDistribution[sentiment] = 
                            (this.stats.sentimentDistribution[sentiment] || 0) + 1;
                        
                        // Count news articles
                        if (item.news && Array.isArray(item.news)) {
                            this.stats.totalNewsArticles += item.news.length;
                        }
                    }
                }
            }
        }
        
        return this.stats;
    }

    /**
     * Convert to standard CSV format
     */
    toStandardCsv() {
        const csvRows = [];
        
        // CSV Headers
        const headers = [
            'Category',
            'Tweet',
            'Sentiment',
            'News_Title',
            'News_Link'
        ];
        csvRows.push(headers.join(','));
        
        // Process each category
        for (const [category, items] of Object.entries(this.jsonData)) {
            if (Array.isArray(items)) {
                for (const item of items) {
                    if (item.tweet && item.sentiment) {
                        const tweet = item.tweet;
                        const sentiment = item.sentiment;
                        
                        if (item.news && Array.isArray(item.news) && item.news.length > 0) {
                            for (const newsItem of item.news) {
                                const row = [
                                    this.escapeCsvField(category),
                                    this.escapeCsvField(tweet),
                                    this.escapeCsvField(sentiment),
                                    this.escapeCsvField(newsItem.title || ''),
                                    this.escapeCsvField(newsItem.link || '')
                                ];
                                csvRows.push(row.join(','));
                            }
                        } else {
                            const row = [
                                this.escapeCsvField(category),
                                this.escapeCsvField(tweet),
                                this.escapeCsvField(sentiment),
                                '',
                                ''
                            ];
                            csvRows.push(row.join(','));
                        }
                    }
                }
            }
        }
        
        return csvRows.join('\n');
    }

    /**
     * Convert to flattened CSV format (one row per tweet-news combination)
     */
    toFlattenedCsv() {
        const csvRows = [];
        
        // CSV Headers
        const headers = [
            'Category',
            'Tweet_Index',
            'Tweet',
            'Sentiment',
            'News_Index',
            'News_Title',
            'News_Link'
        ];
        csvRows.push(headers.join(','));
        
        let tweetIndex = 0;
        
        for (const [category, items] of Object.entries(this.jsonData)) {
            if (Array.isArray(items)) {
                for (const item of items) {
                    if (item.tweet && item.sentiment) {
                        tweetIndex++;
                        const tweet = item.tweet;
                        const sentiment = item.sentiment;
                        
                        if (item.news && Array.isArray(item.news) && item.news.length > 0) {
                            for (let i = 0; i < item.news.length; i++) {
                                const newsItem = item.news[i];
                                const row = [
                                    this.escapeCsvField(category),
                                    tweetIndex,
                                    this.escapeCsvField(tweet),
                                    this.escapeCsvField(sentiment),
                                    i + 1,
                                    this.escapeCsvField(newsItem.title || ''),
                                    this.escapeCsvField(newsItem.link || '')
                                ];
                                csvRows.push(row.join(','));
                            }
                        } else {
                            const row = [
                                this.escapeCsvField(category),
                                tweetIndex,
                                this.escapeCsvField(tweet),
                                this.escapeCsvField(sentiment),
                                0,
                                '',
                                ''
                            ];
                            csvRows.push(row.join(','));
                        }
                    }
                }
            }
        }
        
        return csvRows.join('\n');
    }

    /**
     * Convert to summary CSV format (aggregated by category and sentiment)
     */
    toSummaryCsv() {
        const csvRows = [];
        
        // CSV Headers
        const headers = [
            'Category',
            'Sentiment',
            'Tweet_Count',
            'News_Count'
        ];
        csvRows.push(headers.join(','));
        
        const summary = {};
        
        for (const [category, items] of Object.entries(this.jsonData)) {
            if (Array.isArray(items)) {
                for (const item of items) {
                    if (item.tweet && item.sentiment) {
                        const sentiment = item.sentiment;
                        const key = `${category}_${sentiment}`;
                        
                        if (!summary[key]) {
                            summary[key] = {
                                category,
                                sentiment,
                                tweetCount: 0,
                                newsCount: 0
                            };
                        }
                        
                        summary[key].tweetCount++;
                        
                        if (item.news && Array.isArray(item.news)) {
                            summary[key].newsCount += item.news.length;
                        }
                    }
                }
            }
        }
        
        // Convert summary to CSV rows
        for (const key in summary) {
            const item = summary[key];
            const row = [
                this.escapeCsvField(item.category),
                this.escapeCsvField(item.sentiment),
                item.tweetCount,
                item.newsCount
            ];
            csvRows.push(row.join(','));
        }
        
        return csvRows.join('\n');
    }

    /**
     * Escape CSV field values
     */
    escapeCsvField(field) {
        if (field === null || field === undefined) {
            return '';
        }
        
        const stringField = String(field);
        
        if (stringField.includes(',') || stringField.includes('"') || 
            stringField.includes('\n') || stringField.includes('\r')) {
            return '"' + stringField.replace(/"/g, '""') + '"';
        }
        
        return stringField;
    }

    /**
     * Generate a comprehensive report
     */
    generateReport() {
        const stats = this.generateStats();
        
        let report = '=== JSON TO CSV CONVERSION REPORT ===\n\n';
        report += `Total Categories: ${stats.totalCategories}\n`;
        report += `Total Tweets: ${stats.totalTweets}\n`;
        report += `Total News Articles: ${stats.totalNewsArticles}\n\n`;
        
        report += 'Categories:\n';
        for (const [category, count] of Object.entries(stats.categoryDistribution)) {
            report += `  ${category}: ${count} tweets\n`;
        }
        
        report += '\nSentiment Distribution:\n';
        for (const [sentiment, count] of Object.entries(stats.sentimentDistribution)) {
            const percentage = ((count / stats.totalTweets) * 100).toFixed(1);
            report += `  ${sentiment}: ${count} (${percentage}%)\n`;
        }
        
        return report;
    }
}

/**
 * Main function
 */
function main() {
    try {
        const jsonFilePath = path.join(__dirname, 'results.json');
        console.log('Reading JSON file:', jsonFilePath);
        
        if (!fs.existsSync(jsonFilePath)) {
            console.error('Error: results.json file not found in current directory');
            process.exit(1);
        }
        
        const jsonContent = fs.readFileSync(jsonFilePath, 'utf8');
        const jsonData = JSON.parse(jsonContent);
        
        console.log('JSON data loaded successfully');
        
        // Create converter instance
        const converter = new AdvancedJsonToCsvConverter(jsonData);
        
        // Generate and display report
        const report = converter.generateReport();
        console.log(report);
        
        // Generate different CSV formats
        const standardCsv = converter.toStandardCsv();
        const flattenedCsv = converter.toFlattenedCsv();
        const summaryCsv = converter.toSummaryCsv();
        
        // Write CSV files
        fs.writeFileSync('results_standard.csv', standardCsv, 'utf8');
        fs.writeFileSync('results_flattened.csv', flattenedCsv, 'utf8');
        fs.writeFileSync('results_summary.csv', summaryCsv, 'utf8');
        
        console.log('CSV files created successfully:');
        console.log('  - results_standard.csv (standard format)');
        console.log('  - results_flattened.csv (with indices)');
        console.log('  - results_summary.csv (aggregated summary)');
        
        // Show sample of each format
        console.log('\n=== SAMPLE OUTPUTS ===');
        
        console.log('\nStandard CSV (first 3 rows):');
        standardCsv.split('\n').slice(0, 3).forEach((line, i) => {
            console.log(`${i + 1}: ${line}`);
        });
        
        console.log('\nSummary CSV (first 3 rows):');
        summaryCsv.split('\n').slice(0, 3).forEach((line, i) => {
            console.log(`${i + 1}: ${line}`);
        });
        
    } catch (error) {
        console.error('Error converting JSON to CSV:', error.message);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = AdvancedJsonToCsvConverter; 