#!/bin/bash

# SSL Certificate Setup Script for Node.js Application
# This script helps set up SSL certificates for HTTPS

set -e

echo "🔒 SSL Certificate Setup for Node.js Application"
echo "================================================"

# Create SSL directory
SSL_DIR="ssl"
mkdir -p "$SSL_DIR"

# Function to generate self-signed certificates for development
generate_self_signed() {
    echo "🔧 Generating self-signed certificates for development..."
    
    openssl req -x509 -newkey rsa:4096 -keyout "$SSL_DIR/private.key" -out "$SSL_DIR/certificate.crt" -days 365 -nodes \
        -subj "/C=US/ST=CA/L=San Francisco/O=Development/OU=IT Department/CN=localhost"
    
    echo "✅ Self-signed certificates generated!"
    echo "   Private Key: $SSL_DIR/private.key"
    echo "   Certificate: $SSL_DIR/certificate.crt"
    echo ""
    echo "⚠️  WARNING: Self-signed certificates are for development only!"
    echo "   Browsers will show security warnings for self-signed certificates."
}

# Function to set up Let's Encrypt certificates
setup_letsencrypt() {
    echo "🌐 Setting up Let's Encrypt certificates..."
    
    read -p "Enter your domain name (e.g., api.yourdomain.com): " DOMAIN
    read -p "Enter your email address: " EMAIL
    
    if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
        echo "❌ Domain and email are required for Let's Encrypt"
        exit 1
    fi
    
    # Check if certbot is installed
    if ! command -v certbot &> /dev/null; then
        echo "📦 Installing certbot..."
        
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            # Ubuntu/Debian
            if command -v apt-get &> /dev/null; then
                sudo apt-get update
                sudo apt-get install -y certbot
            # CentOS/RHEL
            elif command -v yum &> /dev/null; then
                sudo yum install -y certbot
            else
                echo "❌ Could not install certbot. Please install it manually."
                exit 1
            fi
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            if command -v brew &> /dev/null; then
                brew install certbot
            else
                echo "❌ Please install Homebrew first, then run: brew install certbot"
                exit 1
            fi
        fi
    fi
    
    echo "🔒 Obtaining SSL certificate from Let's Encrypt..."
    echo "   This requires your domain to point to this server's public IP"
    
    # Use standalone mode (requires port 80 to be available)
    sudo certbot certonly --standalone \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        -d "$DOMAIN"
    
    # Copy certificates to our SSL directory
    sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$SSL_DIR/private.key"
    sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$SSL_DIR/certificate.crt"
    
    # Set proper permissions
    sudo chown $(whoami):$(whoami) "$SSL_DIR/private.key" "$SSL_DIR/certificate.crt"
    chmod 600 "$SSL_DIR/private.key"
    chmod 644 "$SSL_DIR/certificate.crt"
    
    echo "✅ Let's Encrypt certificates set up successfully!"
    echo "   Certificates are valid for 90 days"
    echo "   Set up auto-renewal with: sudo crontab -e"
    echo "   Add: 0 12 * * * /usr/bin/certbot renew --quiet"
}

# Function to use existing certificates
use_existing_certs() {
    echo "📁 Using existing certificates..."
    
    read -p "Enter path to private key file: " KEY_PATH
    read -p "Enter path to certificate file: " CERT_PATH
    read -p "Enter path to CA bundle file (optional, press Enter to skip): " CA_PATH
    
    if [[ ! -f "$KEY_PATH" ]]; then
        echo "❌ Private key file not found: $KEY_PATH"
        exit 1
    fi
    
    if [[ ! -f "$CERT_PATH" ]]; then
        echo "❌ Certificate file not found: $CERT_PATH"
        exit 1
    fi
    
    # Copy certificates
    cp "$KEY_PATH" "$SSL_DIR/private.key"
    cp "$CERT_PATH" "$SSL_DIR/certificate.crt"
    
    if [[ -n "$CA_PATH" && -f "$CA_PATH" ]]; then
        cp "$CA_PATH" "$SSL_DIR/ca_bundle.crt"
        echo "✅ CA bundle copied"
    fi
    
    # Set proper permissions
    chmod 600 "$SSL_DIR/private.key"
    chmod 644 "$SSL_DIR/certificate.crt"
    
    echo "✅ Existing certificates copied successfully!"
}

# Main menu
echo "Choose SSL certificate setup option:"
echo "1) Generate self-signed certificates (Development)"
echo "2) Set up Let's Encrypt certificates (Production)"
echo "3) Use existing certificates"
echo "4) Exit"

read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        generate_self_signed
        ;;
    2)
        setup_letsencrypt
        ;;
    3)
        use_existing_certs
        ;;
    4)
        echo "👋 Exiting..."
        exit 0
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "🎉 SSL setup completed!"
echo ""
echo "📝 Next steps:"
echo "1. Set NODE_ENV=production in your environment"
echo "2. Set HTTPS_PORT=443 (or your preferred HTTPS port)"
echo "3. Restart your Node.js application"
echo "4. Test HTTPS access: https://yourdomain.com"
echo ""
echo "🔧 Environment variables to set:"
echo "   NODE_ENV=production"
echo "   HTTPS_PORT=443"
echo "   SSL_CERT_DIR=$(pwd)/$SSL_DIR"
echo ""
echo "🚀 Your application will now support HTTPS!"
