# 🚀 Manual GCP HTTPS Setup Guide

Since we're having SSH connectivity issues, here's a manual setup guide you can follow to enable HTTPS on your GCP instance.

## 📋 Instance Information
- **Instance Name**: `instance-20250919-091417`
- **Zone**: `us-central1-f`
- **External IP**: `34.56.157.230`

## 🔧 Step-by-Step Setup

### 1. Connect to Your Instance

Use the GCP Console to connect to your instance:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **Compute Engine > VM instances**
3. Find your instance `instance-20250919-091417`
4. Click **SSH** to open a browser-based terminal

### 2. Update Your Application Code

```bash
# Navigate to your application directory
cd ~/tweet-sentiment-backend-node

# Pull the latest code with HTTPS support
git pull origin main

# Install any new dependencies
npm install
```

### 3. Set Up Firewall Rules (Already Done!)

The firewall rule for HTTPS has been created:
```bash
# This was already executed successfully
gcloud compute firewall-rules create allow-https-tweet-sentiment \
    --allow tcp:443 \
    --source-ranges 0.0.0.0/0
```

### 4. Install Required Packages

```bash
# Update system packages
sudo apt-get update

# Install certbot for Let's Encrypt (if you have a domain)
sudo apt-get install -y certbot

# Install OpenSSL for self-signed certificates
sudo apt-get install -y openssl
```

### 5. Choose Your SSL Certificate Option

#### Option A: Self-Signed Certificate (Quick Testing)

```bash
# Create SSL directory
mkdir -p ~/tweet-sentiment-backend-node/ssl

# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 \
    -keyout ~/tweet-sentiment-backend-node/ssl/private.key \
    -out ~/tweet-sentiment-backend-node/ssl/certificate.crt \
    -days 365 -nodes \
    -subj "/C=US/ST=CA/L=San Francisco/O=Development/OU=IT Department/CN=34.56.157.230"

# Set proper permissions
chmod 600 ~/tweet-sentiment-backend-node/ssl/private.key
chmod 644 ~/tweet-sentiment-backend-node/ssl/certificate.crt
```

#### Option B: Let's Encrypt Certificate (If You Have a Domain)

If you have a domain pointing to `34.56.157.230`:

```bash
# Stop any running services on port 80
sudo pkill -f 'node.*app.js' || true
sudo systemctl stop nginx || true

# Get Let's Encrypt certificate
sudo certbot certonly --standalone \
    --email your-email@example.com \
    --agree-tos \
    --no-eff-email \
    -d yourdomain.com

# Copy certificates to application directory
mkdir -p ~/tweet-sentiment-backend-node/ssl
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ~/tweet-sentiment-backend-node/ssl/private.key
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ~/tweet-sentiment-backend-node/ssl/certificate.crt

# Set proper ownership and permissions
sudo chown $(whoami):$(whoami) ~/tweet-sentiment-backend-node/ssl/*
chmod 600 ~/tweet-sentiment-backend-node/ssl/private.key
chmod 644 ~/tweet-sentiment-backend-node/ssl/certificate.crt
```

### 6. Set Up Production Environment

```bash
cd ~/tweet-sentiment-backend-node

# Copy production environment template
cp env.production.example .env.production

# Edit the environment file
nano .env.production
```

Update these values in `.env.production`:
```env
NODE_ENV=production
PORT=8080
HTTPS_PORT=443
SSL_CERT_DIR=./ssl

# Update with your actual API keys
GEMINI_API_KEY=AIzaSyAus6FjDg-O-Y-lTzZ8zag9pS8HJ_IfnE0
TWITTER_USERNAME=your_twitter_username
TWITTER_PASSWORD=your_twitter_password

# If using a custom domain, update these:
FRONTEND_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com
```

### 7. Install Python Dependencies

```bash
cd ~/tweet-sentiment-backend-node

# Install Python requirements
python3 -m pip install -r requirements.txt
```

### 8. Start Services in Production Mode

```bash
# Stop any existing processes
pkill -f 'node.*app.js' || true
pkill -f 'python.*scraper_server.py' || true

# Start Python scraper server in background
nohup python3 python-scraper/scraper_server.py 9999 > scraper.log 2>&1 &

# Start Node.js app in production mode (with HTTPS)
NODE_ENV=production nohup npm start > app.log 2>&1 &
```

### 9. Test Your HTTPS Setup

Wait about 10-15 seconds for services to start, then test:

```bash
# Test health check endpoints
curl -k https://34.56.157.230/health
curl -k https://34.56.157.230/ready
curl -k https://34.56.157.230/alive

# Test HTTP redirect (should redirect to HTTPS)
curl -I http://34.56.157.230:8080/health
```

### 10. Monitor Your Application

```bash
# Check application logs
tail -f ~/tweet-sentiment-backend-node/app.log

# Check scraper logs
tail -f ~/tweet-sentiment-backend-node/scraper.log

# Check if processes are running
ps aux | grep -E "(node|python.*scraper)"
```

## 🌐 Testing URLs

After setup, your application will be available at:

- **HTTPS**: `https://34.56.157.230` (main access)
- **HTTP**: `http://34.56.157.230:8080` (redirects to HTTPS)

### Health Check Endpoints:
- `https://34.56.157.230/health` - Full system status
- `https://34.56.157.230/ready` - Readiness probe
- `https://34.56.157.230/alive` - Liveness probe
- `http://34.56.157.230:9999/health` - Python scraper health

## 🔧 Troubleshooting

### If HTTPS doesn't work:
```bash
# Check if certificates exist
ls -la ~/tweet-sentiment-backend-node/ssl/

# Check certificate validity
openssl x509 -in ~/tweet-sentiment-backend-node/ssl/certificate.crt -text -noout

# Check if Node.js is running in production mode
ps aux | grep node
```

### If services won't start:
```bash
# Check logs for errors
tail -20 ~/tweet-sentiment-backend-node/app.log
tail -20 ~/tweet-sentiment-backend-node/scraper.log

# Manually start with debug output
cd ~/tweet-sentiment-backend-node
NODE_ENV=production npm start
```

### If ports are blocked:
```bash
# Check if ports are listening
sudo netstat -tlnp | grep -E "(443|8080|9999)"

# Test local connectivity
curl -k https://localhost/health
```

## 🎉 Expected Results

Once everything is working, you should see:

1. **HTTPS Server**: Running on port 443
2. **HTTP Redirect**: Port 8080 redirects to HTTPS
3. **Health Checks**: All endpoints returning status information
4. **SSL Certificate**: Valid and properly configured

### Sample Health Check Response:
```json
{
  "status": "OK",
  "timestamp": "2025-09-22T10:30:45.123Z",
  "uptime": 3600.5,
  "environment": "production",
  "version": "1.0.0",
  "services": {
    "database": "OK",
    "gemini_api": "OK",
    "scraper": "OK",
    "tweet_processing": "ACTIVE"
  }
}
```

## 📞 Need Help?

If you encounter issues:

1. Check the application logs first
2. Verify certificate permissions
3. Ensure firewall rules are correct
4. Test with `curl -k` to bypass SSL verification for self-signed certificates

Your application should now be running with full HTTPS support! 🔒✨
