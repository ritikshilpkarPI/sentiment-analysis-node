# Use Ubuntu as base image
FROM ubuntu:22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    gnupg \
    software-properties-common \
    python3 \
    python3-pip \
    python3-venv \
    chromium-browser \
    chromium-chromedriver \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install chromedriver for chromium
RUN CHROMIUM_VERSION=$(chromium-browser --version | cut -d " " -f2 | cut -d "." -f1) \
    && CHROMEDRIVER_VERSION=$(curl -s "https://chromedriver.storage.googleapis.com/LATEST_RELEASE_${CHROMIUM_VERSION}") \
    && wget -O /tmp/chromedriver.zip "https://chromedriver.storage.googleapis.com/${CHROMEDRIVER_VERSION}/chromedriver_linux64.zip" \
    && unzip /tmp/chromedriver.zip -d /usr/local/bin/ \
    && chmod +x /usr/local/bin/chromedriver \
    && rm /tmp/chromedriver.zip

# Create symlinks for compatibility
RUN ln -sf /usr/bin/chromium-browser /usr/bin/google-chrome \
    && ln -sf /usr/bin/chromium-browser /usr/bin/google-chrome-stable

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
RUN npm install --omit=dev

# Copy Python requirements
COPY requirements.txt ./

# Install Python dependencies
RUN pip3 install -r requirements.txt

# Copy application code
COPY . .

# Create Python virtual environment
RUN python3 -m venv /app/venv
RUN /app/venv/bin/pip install -r requirements.txt

# Create SSL directory for certificates
RUN mkdir -p /app/ssl

# Create non-root user for security
RUN useradd -m -u 1001 appuser && \
    chown -R appuser:appuser /app

# Create symlinks for Chrome compatibility (as root, before switching to appuser)
RUN ln -sf /usr/bin/chromium-browser /usr/bin/google-chrome \
    && ln -sf /usr/bin/chromium-browser /usr/bin/google-chrome-stable \
    && ln -sf /usr/bin/chromium-browser /usr/bin/google-chrome-beta \
    && ln -sf /usr/bin/chromium-browser /usr/bin/google-chrome-dev

USER appuser

# Expose ports (HTTP, HTTPS, Python scraper)
EXPOSE 9000 443 9999

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:9000/health || exit 1

# Start both services
CMD ["sh", "-c", "npm start & python3 python-scraper/scraper_server.py 9999 & wait"]
