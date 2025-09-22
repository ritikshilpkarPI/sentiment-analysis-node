# 🔒 HTTPS Setup Guide

This guide explains how to set up HTTPS with SSL certificates for your Node.js Tweet Sentiment Analysis application.

## 📋 Overview

The application now supports:
- ✅ **Health Check Routes** (`/health`, `/ready`, `/alive`)
- ✅ **Automatic HTTPS/HTTP server setup**
- ✅ **SSL Certificate management**
- ✅ **Security headers and middleware**
- ✅ **Production-ready configuration**

## 🚀 Quick Start

### 1. Health Check Routes

Your application now includes comprehensive health check endpoints:

```bash
# Main health check with full system status
curl http://localhost:9000/health

# Kubernetes readiness probe
curl http://localhost:9000/ready

# Kubernetes liveness probe  
curl http://localhost:9000/alive

# Python scraper health check
curl http://localhost:9999/health
```

### 2. SSL Certificate Setup

Run the SSL setup script to configure certificates:

```bash
./setup-ssl.sh
```

Choose from three options:
1. **Self-signed certificates** (Development)
2. **Let's Encrypt certificates** (Production)
3. **Existing certificates** (Custom)

### 3. Environment Configuration

Copy the production environment template:

```bash
cp env.production.example .env.production
```

Update the following variables:
```env
NODE_ENV=production
PORT=8080
HTTPS_PORT=443
SSL_CERT_DIR=./ssl
FRONTEND_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com,https://api.yourdomain.com
```

### 4. Start the Application

```bash
# Development (HTTP only)
npm start

# Production (HTTPS + HTTP redirect)
NODE_ENV=production npm start
```

## 🔧 Detailed Configuration

### Health Check Response

The `/health` endpoint returns comprehensive system information:

```json
{
  "status": "OK",
  "timestamp": "2025-01-22T10:30:45.123Z",
  "uptime": 3600.5,
  "environment": "production",
  "version": "1.0.0",
  "port": 9000,
  "services": {
    "database": "OK",
    "gemini_api": "OK",
    "scraper": "OK",
    "tweet_processing": "ACTIVE"
  },
  "system": {
    "memory": {
      "rss": 50331648,
      "heapTotal": 20971520,
      "heapUsed": 15728640,
      "external": 1048576
    },
    "platform": "linux",
    "nodeVersion": "v18.17.0"
  }
}
```

### SSL Certificate Structure

```
ssl/
├── private.key      # Private key file
├── certificate.crt  # SSL certificate
└── ca_bundle.crt   # CA bundle (optional)
```

### Security Features

The application includes these security measures:

- **Security Headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, CSP
- **HTTPS Redirect**: Automatic HTTP to HTTPS redirect in production
- **CORS Configuration**: Configurable origins for cross-origin requests
- **Rate Limiting**: Built-in request rate limiting
- **Input Validation**: Request body size limits and validation

## 🐳 Docker Deployment

### Build and Run with HTTPS

```bash
# Build the image
docker build -t tweet-sentiment-app .

# Run with SSL certificates mounted
docker run -d \
  --name tweet-sentiment \
  -p 80:8080 \
  -p 443:443 \
  -p 9999:9999 \
  -v $(pwd)/ssl:/app/ssl:ro \
  -e NODE_ENV=production \
  -e HTTPS_PORT=443 \
  tweet-sentiment-app
```

### Docker Compose with HTTPS

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "80:8080"
      - "443:443"
      - "9999:9999"
    volumes:
      - ./ssl:/app/ssl:ro
    environment:
      - NODE_ENV=production
      - HTTPS_PORT=443
      - SSL_CERT_DIR=/app/ssl
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

## ☁️ Google Cloud Platform Deployment

### 1. Cloud Run Deployment

```bash
# Build and push to Container Registry
gcloud builds submit --tag gcr.io/PROJECT_ID/tweet-sentiment

# Deploy to Cloud Run with HTTPS
gcloud run deploy tweet-sentiment \
  --image gcr.io/PROJECT_ID/tweet-sentiment \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars NODE_ENV=production
```

### 2. Compute Engine with SSL

```bash
# Create VM instance
gcloud compute instances create tweet-sentiment-vm \
  --zone=us-central1-a \
  --machine-type=e2-medium \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --tags=http-server,https-server

# Set up firewall rules
gcloud compute firewall-rules create allow-https \
  --allow tcp:443 \
  --source-ranges 0.0.0.0/0 \
  --target-tags https-server
```

### 3. Load Balancer with SSL

```bash
# Create SSL certificate
gcloud compute ssl-certificates create tweet-sentiment-ssl \
  --domains=yourdomain.com

# Create load balancer
gcloud compute url-maps create tweet-sentiment-lb \
  --default-backend-service=tweet-sentiment-backend

# Create HTTPS proxy
gcloud compute target-https-proxies create tweet-sentiment-https-proxy \
  --url-map=tweet-sentiment-lb \
  --ssl-certificates=tweet-sentiment-ssl
```

## 🔍 Monitoring and Troubleshooting

### Health Check Monitoring

Set up monitoring for your health endpoints:

```bash
# Simple monitoring script
#!/bin/bash
while true; do
  if curl -f http://localhost:9000/health > /dev/null 2>&1; then
    echo "$(date): Health check OK"
  else
    echo "$(date): Health check FAILED"
  fi
  sleep 30
done
```

### Common Issues

**Issue**: Certificate not found
```bash
# Solution: Check SSL directory and permissions
ls -la ssl/
chmod 600 ssl/private.key
chmod 644 ssl/certificate.crt
```

**Issue**: Port 443 permission denied
```bash
# Solution: Run with proper privileges or use port > 1024
sudo setcap 'cap_net_bind_service=+ep' $(which node)
# Or use port 8443 instead of 443
```

**Issue**: Health check failing
```bash
# Debug: Check application logs
docker logs tweet-sentiment
# Check if services are running
curl -v http://localhost:9000/health
```

## 📊 Performance Optimization

### Production Optimizations

1. **Enable HTTP/2**: Automatically enabled with HTTPS
2. **Gzip Compression**: Add compression middleware
3. **Static File Caching**: Configure proper cache headers
4. **Connection Pooling**: Optimize database connections

### Monitoring Metrics

Track these metrics for production:
- Response time for `/health` endpoint
- SSL certificate expiry dates
- Memory and CPU usage
- Database connection status
- Tweet processing throughput

## 🔐 Security Best Practices

1. **Keep certificates updated**: Set up auto-renewal for Let's Encrypt
2. **Use strong cipher suites**: Configure TLS properly
3. **Regular security updates**: Keep dependencies updated
4. **Monitor access logs**: Set up log analysis
5. **Implement rate limiting**: Prevent abuse

## 🆘 Support

For issues with HTTPS setup:

1. Check the application logs
2. Verify certificate validity: `openssl x509 -in ssl/certificate.crt -text -noout`
3. Test SSL configuration: `openssl s_client -connect yourdomain.com:443`
4. Use online SSL checkers: SSL Labs, SSL Shopper

---

## 📝 Example Commands

```bash
# Generate self-signed certificate
./setup-ssl.sh

# Start in production mode
NODE_ENV=production npm start

# Test health endpoints
curl https://yourdomain.com/health
curl https://yourdomain.com/ready
curl https://yourdomain.com/alive

# Check certificate expiry
openssl x509 -in ssl/certificate.crt -noout -dates

# Monitor logs
tail -f logs/app.log
```

Your application is now ready for production with full HTTPS support! 🚀
