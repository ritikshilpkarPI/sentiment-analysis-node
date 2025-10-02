#!/bin/bash

# Quick HTTPS Setup for GCP Instance
# Run this script directly on your GCP instance via browser SSH

echo "🚀 Quick HTTPS Setup Starting..."

# 1. Update application code
echo "📥 Updating application code..."
cd ~/tweet-sentiment-backend-node
git pull origin main
npm install

# 2. Create SSL directory and self-signed certificate
echo "🔒 Creating self-signed SSL certificate..."
mkdir -p ssl
openssl req -x509 -newkey rsa:4096 \
    -keyout ssl/private.key \
    -out ssl/certificate.crt \
    -days 365 -nodes \
    -subj "/C=US/ST=CA/L=SF/O=Dev/CN=34.56.157.230"

chmod 600 ssl/private.key
chmod 644 ssl/certificate.crt

# 3. Set up production environment
echo "⚙️ Setting up production environment..."
cp env.production.example .env.production

# Update API key in environment file
sed -i 's/your_gemini_api_key_here/AIzaSyAus6FjDg-O-Y-lTzZ8zag9pS8HJ_IfnE0/' .env.production

# 4. Install Python dependencies
echo "🐍 Installing Python dependencies..."
python3 -m pip install -r requirements.txt

# 5. Stop existing processes
echo "🛑 Stopping existing processes..."
pkill -f 'node.*app.js' || true
pkill -f 'python.*scraper_server.py' || true

# 6. Start services
echo "🚀 Starting services..."
nohup python3 python-scraper/scraper_server.py 9999 > scraper.log 2>&1 &
NODE_ENV=production nohup npm start > app.log 2>&1 &

echo "⏳ Waiting for services to start..."
sleep 10

# 7. Test endpoints
echo "🧪 Testing endpoints..."
echo "Testing HTTPS health check..."
curl -k -s https://localhost/health | head -3

echo ""
echo "Testing HTTP redirect..."
curl -I http://localhost:8080/health | head -3

echo ""
echo "✅ HTTPS Setup Complete!"
echo ""
echo "🌐 Your application is now available at:"
echo "   HTTPS: https://34.56.157.230"
echo "   HTTP:  http://34.56.157.230:8080 (redirects to HTTPS)"
echo ""
echo "🔍 Health Check URLs:"
echo "   https://34.56.157.230/health"
echo "   https://34.56.157.230/ready"
echo "   https://34.56.157.230/alive"
echo ""
echo "📊 View logs:"
echo "   tail -f app.log"
echo "   tail -f scraper.log"
