# Grok API Integration Setup

## Overview
This system now includes Grok API integration for enhanced tweet analysis and news validation alongside Gemini AI.

## Features Added

### 1. **Enhanced Sentiment Analysis**
- **Gemini + Grok Cross-Validation**: Both AI models analyze tweets independently
- **Consensus Building**: Grok validates Gemini's analysis and provides final consensus
- **Confidence Scoring**: Each analysis includes confidence levels
- **Disagreement Detection**: Identifies areas where the two AI models disagree

### 2. **News Validation**
- **Grok-Powered Validation**: News articles are validated against tweet content using Grok
- **Relevance Scoring**: Each news article gets a match score (0-100)
- **Semantic Analysis**: Grok analyzes semantic similarity between tweets and news
- **Top Match Selection**: Only the most relevant news articles are stored

### 3. **Media Analysis Enhancement**
- **Dual AI Analysis**: Both Gemini and Grok analyze media content
- **Cross-Validation**: Media analysis is validated by both models
- **Enhanced Descriptions**: More detailed media content descriptions

## Environment Variables Required

Add these to your `.env` file:

```bash
# Grok API Configuration
GROK_API_KEY=your_grok_api_key_here

# Existing Gemini Configuration (keep these)
GEMINI_API_KEY=your_gemini_api_key_here
```

## Database Changes

New fields added to the `Tweets` table:
- `grokAnalysis` (JSON): Complete Grok analysis results
- `crossValidation` (JSON): Cross-validation results between Gemini and Grok
- `analysisConfidence` (STRING): Overall confidence level
- `consensusResult` (STRING): Consensus between AI models
- `newsValidation` (JSON): Validated news articles with scores

## API Response Changes

All tweet endpoints now return enhanced data:

```json
{
  "id": "tweet_id",
  "tweet": "tweet content",
  "sentiment": "POSITIVE",
  "grokAnalysis": {
    "sentiment": "POSITIVE",
    "topic": "Sports",
    "confidence": "High",
    "reasoning": "Clear positive sentiment about cricket"
  },
  "crossValidation": {
    "consensus": "Agree",
    "finalSentiment": "POSITIVE",
    "confidenceLevel": "High",
    "disagreementAreas": "None",
    "recommendation": "Both analyses agree"
  },
  "analysisConfidence": "High",
  "consensusResult": "Agree",
  "newsValidation": {
    "validatedArticles": [
      {
        "title": "India vs Pakistan Cricket Match",
        "link": "https://...",
        "relevance": "Highly Relevant",
        "matchScore": 95,
        "isValid": true
      }
    ],
    "topMatch": {...}
  }
}
```

## Usage

### 1. **Run Analysis with Grok Validation**
```bash
POST /api/results/runAnalysis
{
  "keywords": ["cricket"],
  "handles": []
}
```

### 2. **Get Enhanced Results**
```bash
POST /api/results/grouped
{
  "keywords": ["cricket"],
  "handles": []
}
```

## Testing

Run the integration test:
```bash
node test_grok_integration.js
```

## Benefits

1. **Higher Accuracy**: Cross-validation between two AI models
2. **Better News Relevance**: Only relevant news articles are stored
3. **Confidence Scoring**: Know how confident the analysis is
4. **Disagreement Detection**: Identify when AI models disagree
5. **Enhanced Media Analysis**: Better understanding of media content

## Fallback Behavior

- If Grok API fails, the system falls back to Gemini-only analysis
- If Grok validation fails, news articles are still fetched but not validated
- All existing functionality remains intact

## Cost Considerations

- Grok API calls are made for each tweet analysis
- News validation adds additional API calls
- Consider implementing caching for frequently analyzed content
- Monitor API usage and costs

## Migration

Run the database migration to add new fields:
```bash
# Note: Migration file created but needs sequelize config
# Manual database update may be required
```
