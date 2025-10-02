# Use Ubuntu as base image
FROM ubuntu:22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    gnupg \
    software-properties-common \
    python3 \
    python3-pip \
    python3-venv \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Google Chrome
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Install ChromeDriver using new Chrome for Testing API
RUN CHROME_VERSION=$(google-chrome --version | cut -d " " -f3 | cut -d "." -f1-3) \
    && echo "Chrome version: $CHROME_VERSION" \
    && CHROMEDRIVER_VERSION=$(curl -s "https://googlechromelabs.github.io/chrome-for-testing/LATEST_RELEASE_${CHROME_VERSION}") \
    && echo "ChromeDriver version: $CHROMEDRIVER_VERSION" \
    && wget -O /tmp/chromedriver.zip "https://storage.googleapis.com/chrome-for-testing-public/${CHROMEDRIVER_VERSION}/linux64/chromedriver-linux64.zip" \
    && unzip /tmp/chromedriver.zip -d /tmp/ \
    && mv /tmp/chromedriver-linux64/chromedriver /usr/local/bin/ \
    && chmod +x /usr/local/bin/chromedriver \
    && rm -rf /tmp/chromedriver*

# Create symlinks for compatibility
RUN ln -sf /usr/bin/google-chrome-stable /usr/bin/google-chrome \
    && ln -sf /usr/bin/google-chrome-stable /usr/bin/google-chrome-beta \
    && ln -sf /usr/bin/google-chrome-stable /usr/bin/google-chrome-dev

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --omit=dev

# Copy Python requirements
COPY requirements.txt ./

# Install Python dependencies
RUN pip3 install -r requirements.txt

# Copy application code
COPY . .

# Create virtual environment for Python
RUN python3 -m venv /app/venv

# Install Python dependencies in virtual environment
RUN /app/venv/bin/pip install -r requirements.txt

# Create SSL directory
RUN mkdir -p /app/ssl

# Create app user
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app

# Switch to app user
USER appuser

# Expose port
EXPOSE 9000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:9000/health || exit 1

# Start both services

CMD ["sh", "-c", "npm start & python3 python-scraper/scraper_server.py 9999 & wait"]

