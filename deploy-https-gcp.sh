#!/bin/bash

# GCP HTTPS Deployment Script
# This script sets up HTTPS on your existing GCP instance

set -e

echo "🚀 GCP HTTPS Deployment Script"
echo "=============================="

# Configuration
INSTANCE_NAME="instance-20250919-091417"
ZONE="us-central1-f"
EXTERNAL_IP="34.56.157.230"

echo "📋 Instance Details:"
echo "   Name: $INSTANCE_NAME"
echo "   Zone: $ZONE" 
echo "   External IP: $EXTERNAL_IP"
echo ""

# Function to run commands on GCP instance
run_on_instance() {
    echo "🔧 Running on instance: $1"
    gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="$1"
}

# Function to copy files to instance
copy_to_instance() {
    echo "📁 Copying $1 to instance..."
    gcloud compute scp $1 $INSTANCE_NAME:~/ --zone=$ZONE
}

echo "1️⃣ Updating firewall rules for HTTPS..."
gcloud compute firewall-rules create allow-https-tweet-sentiment \
    --allow tcp:443 \
    --source-ranges 0.0.0.0/0 \
    --description "Allow HTTPS for tweet sentiment app" \
    --target-tags https-server || echo "Firewall rule may already exist"

echo "2️⃣ Adding HTTPS tag to instance..."
gcloud compute instances add-tags $INSTANCE_NAME \
    --tags https-server \
    --zone=$ZONE

echo "3️⃣ Copying SSL setup script to instance..."
copy_to_instance "setup-ssl.sh"
copy_to_instance "env.production.example"

echo "4️⃣ Installing required packages on instance..."
run_on_instance "sudo apt-get update && sudo apt-get install -y certbot nginx"

echo "5️⃣ Setting up SSL certificates with Let's Encrypt..."
echo ""
echo "⚠️  IMPORTANT: You need a domain name pointing to $EXTERNAL_IP"
echo "   If you don't have a domain, we'll set up self-signed certificates for testing."
echo ""

read -p "Do you have a domain name pointing to this IP? (y/n): " has_domain

if [[ "$has_domain" == "y" || "$has_domain" == "Y" ]]; then
    read -p "Enter your domain name (e.g., api.yourdomain.com): " DOMAIN
    read -p "Enter your email address: " EMAIL
    
    if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
        echo "❌ Domain and email are required"
        exit 1
    fi
    
    echo "🌐 Setting up Let's Encrypt certificate for $DOMAIN..."
    
    # Stop any services using port 80
    run_on_instance "sudo pkill -f 'node.*app.js' || true"
    run_on_instance "sudo systemctl stop nginx || true"
    
    # Get Let's Encrypt certificate
    run_on_instance "sudo certbot certonly --standalone --email $EMAIL --agree-tos --no-eff-email -d $DOMAIN"
    
    # Copy certificates to application directory
    run_on_instance "mkdir -p ~/tweet-sentiment-backend-node/ssl"
    run_on_instance "sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ~/tweet-sentiment-backend-node/ssl/private.key"
    run_on_instance "sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ~/tweet-sentiment-backend-node/ssl/certificate.crt"
    run_on_instance "sudo chown \$(whoami):\$(whoami) ~/tweet-sentiment-backend-node/ssl/*"
    run_on_instance "chmod 600 ~/tweet-sentiment-backend-node/ssl/private.key"
    run_on_instance "chmod 644 ~/tweet-sentiment-backend-node/ssl/certificate.crt"
    
    HTTPS_URL="https://$DOMAIN"
    
else
    echo "🔒 Setting up self-signed certificates for testing..."
    
    # Create self-signed certificate on instance
    run_on_instance "mkdir -p ~/tweet-sentiment-backend-node/ssl"
    run_on_instance "openssl req -x509 -newkey rsa:4096 -keyout ~/tweet-sentiment-backend-node/ssl/private.key -out ~/tweet-sentiment-backend-node/ssl/certificate.crt -days 365 -nodes -subj '/C=US/ST=CA/L=San Francisco/O=Development/OU=IT Department/CN=$EXTERNAL_IP'"
    run_on_instance "chmod 600 ~/tweet-sentiment-backend-node/ssl/private.key"
    run_on_instance "chmod 644 ~/tweet-sentiment-backend-node/ssl/certificate.crt"
    
    HTTPS_URL="https://$EXTERNAL_IP"
fi

echo "6️⃣ Updating application code on instance..."
run_on_instance "cd ~/tweet-sentiment-backend-node && git pull origin main"

echo "7️⃣ Setting up production environment..."
run_on_instance "cd ~/tweet-sentiment-backend-node && cp env.production.example .env.production"

# Update environment file with production settings
run_on_instance "cd ~/tweet-sentiment-backend-node && sed -i 's/your_gemini_api_key_here/AIzaSyAus6FjDg-O-Y-lTzZ8zag9pS8HJ_IfnE0/' .env.production"

echo "8️⃣ Installing/updating Node.js dependencies..."
run_on_instance "cd ~/tweet-sentiment-backend-node && npm install"

echo "9️⃣ Setting up Python environment..."
run_on_instance "cd ~/tweet-sentiment-backend-node && python3 -m pip install -r requirements.txt"

echo "🔟 Starting application in production mode..."
# Stop existing processes
run_on_instance "pkill -f 'node.*app.js' || true"
run_on_instance "pkill -f 'python.*scraper_server.py' || true"

# Start Python scraper server in background
run_on_instance "cd ~/tweet-sentiment-backend-node && nohup python3 python-scraper/scraper_server.py 9999 > scraper.log 2>&1 &"

# Start Node.js app in production mode
run_on_instance "cd ~/tweet-sentiment-backend-node && NODE_ENV=production nohup npm start > app.log 2>&1 &"

echo "⏳ Waiting for services to start..."
sleep 10

echo "✅ Deployment completed!"
echo ""
echo "🌐 Your application is now running with HTTPS support:"
echo "   HTTP:  http://$EXTERNAL_IP:8080 (redirects to HTTPS)"
echo "   HTTPS: $HTTPS_URL"
echo ""
echo "🔍 Health Check Endpoints:"
echo "   $HTTPS_URL/health"
echo "   $HTTPS_URL/ready" 
echo "   $HTTPS_URL/alive"
echo ""
echo "📊 Testing endpoints..."

# Test health endpoints
echo "Testing health check..."
if curl -k -s "$HTTPS_URL/health" > /dev/null; then
    echo "✅ HTTPS health check: OK"
else
    echo "⚠️  HTTPS health check: Failed (may need a few more seconds)"
fi

if curl -s "http://$EXTERNAL_IP:8080/health" > /dev/null; then
    echo "✅ HTTP health check: OK"
else
    echo "⚠️  HTTP health check: Failed"
fi

echo ""
echo "🎉 HTTPS setup completed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Test your HTTPS endpoints"
echo "2. Update your DNS if using a custom domain"
echo "3. Set up certificate auto-renewal for Let's Encrypt"
echo ""
echo "🔧 Useful commands:"
echo "   # Check application logs:"
echo "   gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command='tail -f ~/tweet-sentiment-backend-node/app.log'"
echo ""
echo "   # Check scraper logs:"
echo "   gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command='tail -f ~/tweet-sentiment-backend-node/scraper.log'"
echo ""
echo "   # Restart application:"
echo "   gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command='cd ~/tweet-sentiment-backend-node && pkill -f node && NODE_ENV=production nohup npm start > app.log 2>&1 &'"
