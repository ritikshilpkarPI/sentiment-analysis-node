#!/bin/bash
# Local Development Startup Script

echo "🚀 Starting Tweet Sentiment Analysis - Development Mode"
echo "======================================================="

# Kill any existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "node src/app.js" 2>/dev/null || true
pkill -f "python3 scraper_server.py" 2>/dev/null || true
sleep 2

# Start Python scraper in background
echo "🐍 Starting Python scraper server on port 9999..."
cd python-scraper
export TWITTER_USERNAME=RajMalh07467374
export TWITTER_PASSWORD=Shilpkarji@01
python3 scraper_server.py 9999 &
SCRAPER_PID=$!
cd ..

# Wait for scraper to start
echo "⏳ Waiting for scraper to initialize..."
sleep 10

# Start Node.js backend
echo "🟢 Starting Node.js backend on port 8080..."
export NODE_ENV=development
export PORT=8080
export PROCESS_TWEETS=false
export GEMINI_API_KEY=AIzaSyA5qMlarEH1xF440097n6ZeibnK0pDYSk8
node src/app.js &
BACKEND_PID=$!

# Wait for backend to start
echo "⏳ Waiting for backend to initialize..."
sleep 5

# Test both servers
echo ""
echo "🧪 Testing servers..."
echo "Python Scraper Health:"
curl -s http://localhost:9999/health || echo "❌ Scraper not responding"

echo ""
echo "Node.js Backend Health:"
curl -s http://localhost:8080/health || echo "❌ Backend not responding"

echo ""
echo "🎉 Development environment ready!"
echo "📊 Backend API: http://localhost:8080"
echo "🐍 Python Scraper: http://localhost:9999"
echo "🗺️ Geo-Sentiment API: http://localhost:8080/api/geo-sentiment"
echo ""
echo "Available endpoints:"
echo "- GET  http://localhost:8080/api/geo-sentiment/districts"
echo "- GET  http://localhost:8080/api/geo-sentiment/heatmap" 
echo "- GET  http://localhost:8080/api/geo-sentiment/dashboard"
echo "- POST http://localhost:8080/api/geo-sentiment/process-tweet"
echo ""
echo "Press Ctrl+C to stop all servers"

# Function to cleanup on exit
cleanup() {
    echo "🛑 Stopping servers..."
    kill $SCRAPER_PID 2>/dev/null || true
    kill $BACKEND_PID 2>/dev/null || true
    echo "✅ Cleanup complete"
    exit 0
}

# Set trap for cleanup
trap cleanup SIGINT SIGTERM

# Wait for user to stop
wait
