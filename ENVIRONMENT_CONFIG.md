# Environment Configuration

## Environment Variables

### Required Variables
```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=tweet_sentiment

# JWT Secret
JWT_SECRET=your_jwt_secret_here

# Gemini API Key (for sentiment analysis)
GEMINI_API_KEY=your_gemini_api_key_here
```

### Optional Variables
```bash
# Environment Mode
NODE_ENV=development  # or 'production'

# Tweet Processing
PROCESS_TWEETS=false  # Set to 'true' to enable continuous tweet processing

# Twitter/X API Configuration (Production only)
USE_X_API=false  # Set to 'true' to use X API instead of scraper
X_API_BEARER_TOKEN=your_x_api_bearer_token_here
```

## Development vs Production Modes

### Development Mode (Default)
- Uses Python scraper for tweet collection
- Requires manual login to Twitter/X
- Scrapes tweets using Selenium WebDriver
- Set `USE_X_API=false` or leave unset

### Production Mode
- Uses official X API for tweet collection
- No manual login required
- More reliable and faster
- Set `USE_X_API=true` and provide `X_API_BEARER_TOKEN`

## How to Switch Modes

### For Development (Scraper):
```bash
NODE_ENV=development
USE_X_API=false
# X_API_BEARER_TOKEN not required
```

### For Production (X API):
```bash
NODE_ENV=production
USE_X_API=true
X_API_BEARER_TOKEN=your_actual_bearer_token
```

## Getting X API Bearer Token

1. Go to [Twitter Developer Portal](https://developer.twitter.com/)
2. Create a new app or use existing app
3. Go to "Keys and tokens" tab
4. Generate Bearer Token
5. Copy the Bearer Token to your environment variables

## Testing the Configuration

### Test Development Mode:
```bash
curl -X POST http://localhost:9000/api/results/runAnalysis \
  -H "Content-Type: application/json" \
  -d '{"keywords": ["test"], "handles": []}'
```

Response should show `"method": "scraper"`

### Test Production Mode:
```bash
# Set USE_X_API=true first
curl -X POST http://localhost:9000/api/results/runAnalysis \
  -H "Content-Type: application/json" \
  -d '{"keywords": ["test"], "handles": []}'
```

Response should show `"method": "x_api"`
