const fs = require('fs');
const path = require('path');

/**
 * Convert JSON results to CSV format
 * The JSON structure has categories with tweets, sentiments, and news
 */
function convertJsonToCsv(jsonData) {
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
    for (const [category, items] of Object.entries(jsonData)) {
        if (Array.isArray(items)) {
            // Process each item in the category
            for (const item of items) {
                if (item.tweet && item.sentiment) {
                    const tweet = item.tweet;
                    const sentiment = item.sentiment;
                    
                    // If there are news articles, create a row for each
                    if (item.news && Array.isArray(item.news) && item.news.length > 0) {
                        for (const newsItem of item.news) {
                            const row = [
                                escapeCsvField(category),
                                escapeCsvField(tweet),
                                escapeCsvField(sentiment),
                                escapeCsvField(newsItem.title || ''),
                                escapeCsvField(newsItem.link || '')
                            ];
                            csvRows.push(row.join(','));
                        }
                    } else {
                        // No news, just tweet and sentiment
                        const row = [
                            escapeCsvField(category),
                            escapeCsvField(tweet),
                            escapeCsvField(sentiment),
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
 * Escape CSV field values to handle commas, quotes, and newlines
 */
function escapeCsvField(field) {
    if (field === null || field === undefined) {
        return '';
    }
    
    const stringField = String(field);
    
    // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n') || stringField.includes('\r')) {
        return '"' + stringField.replace(/"/g, '""') + '"';
    }
    
    return stringField;
}

/**
 * Main function to read JSON and convert to CSV
 */
function main() {
    try {
        // Read the JSON file
        const jsonFilePath = path.join(__dirname, 'results.json');
        console.log('Reading JSON file:', jsonFilePath);
        
        if (!fs.existsSync(jsonFilePath)) {
            console.error('Error: results.json file not found in current directory');
            process.exit(1);
        }
        
        const jsonContent = fs.readFileSync(jsonFilePath, 'utf8');
        const jsonData = JSON.parse(jsonContent);
        
        console.log('JSON data loaded successfully');
        console.log('Categories found:', Object.keys(jsonData));
        
        // Convert to CSV
        const csvContent = convertJsonToCsv(jsonData);
        
        // Write CSV file
        const csvFilePath = path.join(__dirname, 'results.csv');
        fs.writeFileSync(csvFilePath, csvContent, 'utf8');
        
        console.log('CSV file created successfully:', csvFilePath);
        console.log('Total CSV rows:', csvContent.split('\n').length);
        
        // Show sample of the CSV
        const lines = csvContent.split('\n');
        console.log('\nFirst 5 rows of CSV:');
        lines.slice(0, 5).forEach((line, index) => {
            console.log(`${index + 1}: ${line}`);
        });
        
        if (lines.length > 5) {
            console.log(`... and ${lines.length - 5} more rows`);
        }
        
    } catch (error) {
        console.error('Error converting JSON to CSV:', error.message);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { convertJsonToCsv, escapeCsvField }; 