#!/bin/bash

# GCP Compute Engine Setup Script for Tweet Sentiment Backend
# Run this script on your GCP VM instance

echo "🚀 Setting up Tweet Sentiment Backend on GCP Compute Engine..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python 3 and pip
sudo apt install -y python3 python3-pip python3-venv

# Install Chrome/Chromium for GCP
sudo apt install -y chromium-browser chromium-chromedriver

# Install Docker (optional, for containerized deployment)
sudo apt install -y docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# Install Git
sudo apt install -y git

# Install PostgreSQL (if not using Cloud SQL)
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Install gcloud CLI (if not already installed)
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Create application directory
sudo mkdir -p /opt/tweet-sentiment-backend
sudo chown $USER:$USER /opt/tweet-sentiment-backend
cd /opt/tweet-sentiment-backend

echo "✅ GCP Compute Engine setup complete!"
echo "📝 Next steps:"
echo "1. Clone your repository"
echo "2. Copy .env file with your environment variables"
echo "3. Run: npm install"
echo "4. Run: pip3 install -r requirements.txt"
echo "5. Start the application: npm start"
echo ""
echo "🐳 Or use Docker:"
echo "1. Copy docker-compose.yml and Dockerfile"
echo "2. Run: docker-compose up -d"
echo ""
echo "☁️ For Cloud SQL:"
echo "1. Create Cloud SQL instance"
echo "2. Update .env with Cloud SQL connection details"
