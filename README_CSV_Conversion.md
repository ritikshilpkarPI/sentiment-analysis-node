# JSON to CSV Conversion Scripts

This directory contains scripts to convert your `results.json` file to various CSV formats for easier analysis and import into spreadsheet applications.

## Files Created

- **`convert_to_csv.js`** - Basic JSON to CSV converter
- **`convert_to_csv_advanced.js`** - Advanced converter with multiple output formats
- **`run_conversion.bat`** - Windows batch file to run the conversion
- **`run_conversion.sh`** - Unix/Linux/Mac shell script to run the conversion

## Quick Start

### Option 1: Run the basic converter
```bash
# On Unix/Linux/Mac
./run_conversion.sh

# On Windows
run_conversion.bat

# Or directly with Node.js
node convert_to_csv.js
```

### Option 2: Run the advanced converter
```bash
node convert_to_csv_advanced.js
```

## Output Files

### Basic Converter (`convert_to_csv.js`)
- **`results.csv`** - Standard CSV with columns: Category, Tweet, Sentiment, News_Title, News_Link

### Advanced Converter (`convert_to_csv_advanced.js`)
- **`results_standard.csv** - Same as basic converter
- **`results_flattened.csv** - Includes tweet and news indices for better tracking
- **`results_summary.csv** - Aggregated summary by category and sentiment

## CSV Format Details

### Standard Format
Each row represents a tweet-news combination:
```
Category,Tweet,Sentiment,News_Title,News_Link
General,"## Tweets for 'mohan yadav' (global) at 2025-06-11 10:30:47",Neutral,"Lt General Rajiv Ghai, Air Marshal Bharti take over as deputy chiefs - Times of India","https://news.google.com/..."
```

### Flattened Format
Includes indices for better data tracking:
```
Category,Tweet_Index,Tweet,Sentiment,News_Index,News_Title,News_Link
General,1,"## Tweets for 'mohan yadav' (global) at 2025-06-11 10:30:47",Neutral,1,"Lt General Rajiv Ghai, Air Marshal Bharti take over as deputy chiefs - Times of India","https://news.google.com/..."
```

### Summary Format
Aggregated statistics by category and sentiment:
```
Category,Sentiment,Tweet_Count,News_Count
General,Neutral,150,750
General,Positive,25,125
General,Negative,10,50
```

## Features

- **CSV Escaping**: Properly handles commas, quotes, and newlines in text
- **Data Validation**: Checks for required fields before processing
- **Statistics**: Provides summary of data structure and content
- **Multiple Formats**: Choose the output format that best fits your needs
- **Error Handling**: Graceful error handling with informative messages

## Requirements

- **Node.js** (version 12 or higher)
- **results.json** file in the same directory

## Customization

You can modify the scripts to:
- Change column names
- Add additional data fields
- Filter specific categories or sentiments
- Change output file names
- Add data validation rules

## Troubleshooting

### Common Issues

1. **"Node.js not found"**
   - Install Node.js from [nodejs.org](https://nodejs.org/)

2. **"results.json not found"**
   - Ensure `results.json` is in the same directory as the scripts

3. **"Permission denied" (Unix/Linux/Mac)**
   - Make the shell script executable: `chmod +x run_conversion.sh`

4. **CSV formatting issues**
   - Check that your JSON data is valid
   - Ensure text fields don't contain problematic characters

### Data Structure Requirements

Your `results.json` should have this structure:
```json
{
  "CategoryName": [
    {
      "tweet": "Tweet text",
      "sentiment": "Sentiment value",
      "news": [
        {
          "title": "News title",
          "link": "News URL"
        }
      ]
    }
  ]
}
```

## Example Usage

```bash
# Convert and get a quick summary
node convert_to_csv.js

# Get detailed analysis and multiple formats
node convert_to_csv_advanced.js

# View the generated CSV files
ls -la *.csv
```

## Support

If you encounter issues:
1. Check that your JSON file is valid
2. Ensure Node.js is properly installed
3. Verify file permissions (on Unix systems)
4. Check the console output for error messages 