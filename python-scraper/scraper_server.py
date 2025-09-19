#!/usr/bin/env python3
"""
Persistent Twitter Scraper Server
Keeps browser open and handles multiple scraping requests
"""

import json
import os
import sys
import time
import threading
import socket
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import hashlib

# Global driver instance
driver_instance = None
server_socket = None
is_running = False

# def setup_driver(headless=True):
#     """Setup Chrome driver with options for GCP deployment"""
#     chrome_options = Options()
    
#     # GCP/Linux specific options for stability
#     chrome_options.add_argument("--no-sandbox")
#     chrome_options.add_argument("--disable-dev-shm-usage")
#     chrome_options.add_argument("--disable-gpu")
#     chrome_options.add_argument("--disable-web-security")
#     chrome_options.add_argument("--disable-features=VizDisplayCompositor")
#     chrome_options.add_argument("--disable-extensions")
#     chrome_options.add_argument("--disable-plugins")
#     chrome_options.add_argument("--disable-background-timer-throttling")
#     chrome_options.add_argument("--disable-backgrounding-occluded-windows")
#     chrome_options.add_argument("--disable-renderer-backgrounding")
#     chrome_options.add_argument("--remote-debugging-port=9222")
#     chrome_options.add_argument("--disable-setuid-sandbox")
#     chrome_options.add_argument("--disable-software-rasterizer")
#     chrome_options.add_argument("--headless")
#     chrome_options.add_argument("--disable-logging")
#     chrome_options.add_argument("--disable-default-apps")
#     chrome_options.add_argument("--disable-sync")
#     chrome_options.add_argument("--disable-translate")
#     chrome_options.add_argument("--hide-scrollbars")
#     chrome_options.add_argument("--mute-audio")
#     chrome_options.add_argument("--no-first-run")
#     chrome_options.add_argument("--disable-background-networking")
#     chrome_options.add_argument("--disable-background-timer-throttling")
#     chrome_options.add_argument("--disable-renderer-backgrounding")
#     chrome_options.add_argument("--disable-backgrounding-occluded-windows")
#     chrome_options.add_argument("--disable-client-side-phishing-detection")
#     chrome_options.add_argument("--disable-crash-reporter")
#     chrome_options.add_argument("--disable-oopr-debug-crash-dump")
#     chrome_options.add_argument("--no-crash-upload")
#     chrome_options.add_argument("--disable-gpu-sandbox")
#     chrome_options.add_argument("--disable-software-rasterizer")
#     chrome_options.add_argument("--disable-background-timer-throttling")
#     chrome_options.add_argument("--disable-renderer-backgrounding")
#     chrome_options.add_argument("--disable-backgrounding-occluded-windows")
#     chrome_options.add_argument("--disable-ipc-flooding-protection")
    
#     # Use Google Chrome for GCP
#     chrome_options.binary_location = "/usr/bin/google-chrome-stable"
    
#     if not headless:
#         chrome_options.add_argument("--disable-blink-features=AutomationControlled")
#         chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
#         chrome_options.add_experimental_option('useAutomationExtension', False)
#         chrome_options.add_argument("--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
#         chrome_options.add_argument("--window-size=1920,1080")
#     else:
#         chrome_options.add_argument("--headless")
#         chrome_options.add_argument("--window-size=1920,1080")
    
#     try:
#         # Use WebDriver Manager to get correct ChromeDriver version
#         print("🔧 Using WebDriver Manager for correct ChromeDriver version...")
        
#         # Clear any corrupted cache first
#         import os
#         wdm_cache = os.path.expanduser("~/.wdm")
#         if os.path.exists(wdm_cache):
#             print("🧹 Clearing WebDriver Manager cache...")
#             import shutil
#             shutil.rmtree(wdm_cache, ignore_errors=True)
        
#         service = Service(ChromeDriverManager().install())
#         driver = webdriver.Chrome(service=service, options=chrome_options)
#         driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
#         # Set timeouts
#         driver.set_page_load_timeout(30)
#         driver.implicitly_wait(10)
        
#         return driver
#     except Exception as e:
#         print(f"❌ Error setting up driver: {e}")
#         print("💡 Try installing Chrome manually: sudo apt install google-chrome-stable")
#         return None


def setup_driver(headless=True):
    """Setup Chrome driver with sensible options. headless=True runs without UI."""
    chrome_options = Options()

    # Stable, minimal flags for headless servers
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--remote-debugging-port=9222")
    chrome_options.add_argument("--disable-extensions")
    chrome_options.add_argument("--mute-audio")
    chrome_options.add_argument("--hide-scrollbars")
    chrome_options.add_argument("--disable-background-networking")

    # Set binary path only if present (avoid hard crash)
    chrome_path = "/usr/bin/google-chrome-stable"
    if os.path.exists(chrome_path):
        chrome_options.binary_location = chrome_path
    else:
        print(f"⚠️ Chrome binary not found at {chrome_path}. Chrome must be installed or binary_location changed.")

    # Only add headless when requested
    if headless:
        # modern headless argument
        chrome_options.add_argument("--headless=new")

    # Optional anti-detection when opening a visible browser
    if not headless:
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        chrome_options.add_argument("--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

    try:
        # Clear corrupted wdm cache if you want (optional)
        wdm_cache = os.path.expanduser("~/.wdm")
        if os.path.exists(wdm_cache):
            import shutil
            shutil.rmtree(wdm_cache, ignore_errors=True)

        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)

        # optional stealth
        try:
            driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        except Exception:
            pass

        driver.set_page_load_timeout(30)
        driver.implicitly_wait(10)
        return driver

    except Exception as e:
        print(f"❌ Error setting up driver: {e}")
        return None

def twitter_login(driver):
    """Login to Twitter and wait for manual completion"""
    try:
        print("🌐 Opening Twitter login page...")
        driver.get("https://twitter.com/i/flow/login")
        time.sleep(3)
        
        print("🔐 Please login to Twitter manually in the browser window...")
        print("⏳ Waiting for you to complete login...")
        print("   (The server will continue once you're logged in)")
        
        # Wait indefinitely until user manually logs in
        login_attempts = 0
        max_attempts = 300  # 10 minutes max
        
        while login_attempts < max_attempts:
            try:
                current_url = driver.current_url
                
                # Check if we're on home page or logged in
                if ("home" in current_url or 
                    "twitter.com" in current_url and "login" not in current_url or
                    driver.find_elements(By.CSS_SELECTOR, '[data-testid="SideNav_AccountSwitcher_Button"]')):
                    print("✅ Login detected! Server ready for scraping...")
                    return True
                    
                # Check for any error messages
                error_elements = driver.find_elements(By.CSS_SELECTOR, '[data-testid="error"]')
                if error_elements:
                    print("❌ Login error detected. Please try again.")
                    print("   Refreshing page...")
                    driver.refresh()
                    time.sleep(3)
                
                # Wait a bit before checking again
                time.sleep(2)
                login_attempts += 1
                
                if login_attempts % 30 == 0:  # Every minute
                    print(f"⏳ Still waiting for login... ({login_attempts/30} minutes)")
                
            except Exception as e:
                print(f"⚠️  Checking login status... ({e})")
                time.sleep(2)
                login_attempts += 1
                continue
        
        print("⏰ Login timeout reached. Continuing anyway...")
        return True
                
    except Exception as e:
        print(f"❌ Error during login setup: {e}")
        return False

def get_unique_filename(keywords, handles):
    """Generate a unique filename based on keywords and timestamp"""
    content = f"{keywords}_{handles}_{time.time()}"
    hash_id = hashlib.md5(content.encode()).hexdigest()[:8]
    
    # Clean keywords for filename
    clean_keywords = "_".join([k.replace(" ", "_").replace("/", "_") for k in keywords])
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    return f"tweets_output_{clean_keywords}_{timestamp}_{hash_id}.md"

def extract_media_from_tweet(tweet_element):
    """Extract images and videos from a tweet element"""
    media_data = {
        'images': [],
        'videos': []
    }
    
    try:
        # Extract images with multiple selectors
        image_selectors = [
            'img[src*="pbs.twimg.com"]',  # Twitter images
            'img[alt*="Image"]',
            'img[data-testid="tweetPhoto"]',
            'div[data-testid="tweetPhoto"] img',
            'img[src*="media"]'
        ]
        
        for selector in image_selectors:
            try:
                img_elements = tweet_element.find_elements(By.CSS_SELECTOR, selector)
                for img in img_elements:
                    src = img.get_attribute('src')
                    alt = img.get_attribute('alt') or ''
                    if src and 'pbs.twimg.com' in src and src not in [img['url'] for img in media_data['images']]:
                        media_data['images'].append({
                            'url': src,
                            'alt': alt,
                            'type': 'image'
                        })
            except:
                continue
        
        # Extract videos with multiple selectors
        video_selectors = [
            'video[src]',
            'video source[src]',
            'div[data-testid="videoPlayer"] video',
            'div[data-testid="videoPlayer"] source',
            'video[poster]'
        ]
        
        for selector in video_selectors:
            try:
                video_elements = tweet_element.find_elements(By.CSS_SELECTOR, selector)
                for video in video_elements:
                    src = video.get_attribute('src')
                    poster = video.get_attribute('poster')
                    if src and src not in [vid['url'] for vid in media_data['videos']]:
                        media_data['videos'].append({
                            'url': src,
                            'poster': poster,
                            'type': 'video'
                        })
                    elif poster and poster not in [vid['poster'] for vid in media_data['videos']]:
                        media_data['videos'].append({
                            'url': poster,
                            'poster': poster,
                            'type': 'video'
                        })
            except:
                continue
        
        # Also check for embedded content (YouTube, etc.)
        embed_selectors = [
            'iframe[src*="youtube"]',
            'iframe[src*="vimeo"]',
            'iframe[src*="twitch"]'
        ]
        
        for selector in embed_selectors:
            try:
                embed_elements = tweet_element.find_elements(By.CSS_SELECTOR, selector)
                for embed in embed_elements:
                    src = embed.get_attribute('src')
                    if src and src not in [vid['url'] for vid in media_data['videos']]:
                        media_data['videos'].append({
                            'url': src,
                            'poster': None,
                            'type': 'embed'
                        })
            except:
                continue
                
    except Exception as e:
        print(f"⚠️  Error extracting media: {e}")
    
    return media_data

def search_and_scrape_tweets(driver, keyword, handle=None, max_scroll_attempts=10):
    """Search and scrape tweets for a given keyword"""
    try:
        # Build search URL
        if handle:
            search_url = f"https://twitter.com/search?q=from:{handle}%20{keyword}&src=typed_query&f=live"
        else:
            search_url = f"https://twitter.com/search?q={keyword}&src=typed_query&f=live"
        
        print(f"🔍 Searching: {search_url}")
        driver.get(search_url)
        time.sleep(5)  # Wait longer for page load
        
        tweets = []
        scroll_attempts = 0
        
        while scroll_attempts < max_scroll_attempts:
            try:
                # Wait for page to load
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "body"))
                )
                
                # Find tweet elements using multiple selectors (updated for current Twitter)
                tweet_selectors = [
                    'article[data-testid="tweet"]',
                    '[data-testid="tweet"]',
                    'article[role="article"]',
                    'div[data-testid="tweet"]',
                    'article'
                ]
                
                tweet_elements = []
                for selector in tweet_selectors:
                    try:
                        elements = driver.find_elements(By.CSS_SELECTOR, selector)
                        if elements and len(elements) > 0:
                            tweet_elements = elements
                            print(f"✅ Found {len(elements)} elements with selector: {selector}")
                            break
                    except Exception as e:
                        print(f"⚠️  Selector {selector} failed: {e}")
                        continue
                
                if not tweet_elements:
                    print(f"⚠️  No tweets found with any selector, trying scroll {scroll_attempts + 1}")
                    # Try different scroll approach
                    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                    time.sleep(3)
                    scroll_attempts += 1
                    continue
                
                # Extract tweet data
                new_tweets_found = 0
                for element in tweet_elements:
                    try:
                        # Extract author with multiple selectors
                        author_selectors = [
                            '[data-testid="User-Name"] span',
                            '[data-testid="User-Name"] a',
                            'a[role="link"] span',
                            'a[href*="/"] span',
                            'div[dir="ltr"] span'
                        ]
                        
                        author = "Unknown"
                        for selector in author_selectors:
                            try:
                                author_elem = element.find_elements(By.CSS_SELECTOR, selector)
                                if author_elem and author_elem[0].text.strip():
                                    author = author_elem[0].text.strip()
                                    break
                            except:
                                continue
                        
                        # Extract text content with multiple selectors
                        text_selectors = [
                            '[data-testid="tweetText"]',
                            '[lang]',
                            'div[data-testid="tweetText"]',
                            'div[dir="ltr"]',
                            'span[lang]'
                        ]
                        
                        text = ""
                        for selector in text_selectors:
                            try:
                                text_elem = element.find_elements(By.CSS_SELECTOR, selector)
                                if text_elem and text_elem[0].text.strip():
                                    text = text_elem[0].text.strip()
                                    break
                            except:
                                continue
                        
                        # Only add if we have both author and text
                        if text and author != "Unknown" and len(text) > 10:
                            # Extract media (images/videos) with multiple selectors
                            media_data = extract_media_from_tweet(element)
                            
                            tweet_data = {
                                'author': author,
                                'text': text,
                                'timestamp': datetime.now().isoformat(),
                                'media': media_data
                            }
                            
                            # Check if tweet already exists
                            if not any(t['text'] == text for t in tweets):
                                tweets.append(tweet_data)
                                new_tweets_found += 1
                                media_info = f" (📷 {len(media_data['images'])} images, 🎥 {len(media_data['videos'])} videos)" if media_data['images'] or media_data['videos'] else ""
                                print(f"✅ Found tweet: {author} - {text[:50]}...{media_info}")
                    
                    except Exception as e:
                        print(f"⚠️  Error extracting tweet: {e}")
                        continue
                
                if new_tweets_found > 0:
                    print(f"📊 Found {new_tweets_found} new tweets (total: {len(tweets)})")
                else:
                    print(f"⚠️  No new tweets found in this scroll (attempt {scroll_attempts + 1})")
                
                # Scroll for more tweets
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(3)
                scroll_attempts += 1
                
                # If we found tweets, continue scrolling
                if tweets and scroll_attempts >= 3:
                    print(f"📊 Found {len(tweets)} tweets total, continuing to scroll...")
                
            except Exception as e:
                print(f"⚠️  Error in scroll attempt {scroll_attempts + 1}: {e}")
                scroll_attempts += 1
                continue
        
        print(f"🎯 Scraping completed. Found {len(tweets)} tweets total.")
        return tweets
        
    except Exception as e:
        print(f"❌ Error in search_and_scrape_tweets: {e}")
        return []

def append_tweets_to_file(tweets, keyword, handle=None, file_name="tweets_output.md"):
    """Append tweets to file with keyword information"""
    try:
        file_path = os.path.join(os.path.dirname(__file__), file_name)
        
        with open(file_path, 'a', encoding='utf-8') as f:
            for i, tweet in enumerate(tweets, 1):
                f.write(f"## Tweet {i}\n")
                f.write(f"**Author:** {tweet['author']}\n")
                f.write(f"**Time:** {tweet['timestamp']}\n")
                f.write(f"**Text:** {tweet['text']}\n")
                f.write(f"**Keyword:** {keyword}\n")
                if handle:
                    f.write(f"**Handle:** {handle}\n")
                
                # Add media information if present
                if 'media' in tweet and tweet['media']:
                    media = tweet['media']
                    if media['images']:
                        f.write(f"**Images:** {len(media['images'])} found\n")
                        for j, img in enumerate(media['images'], 1):
                            f.write(f"  - Image {j}: {img['url']}\n")
                    if media['videos']:
                        f.write(f"**Videos:** {len(media['videos'])} found\n")
                        for j, vid in enumerate(media['videos'], 1):
                            f.write(f"  - Video {j}: {vid['url']} (type: {vid['type']})\n")
                
                f.write("\n")
        
        print(f"💾 Appended {len(tweets)} tweets to {file_name}")
        
    except Exception as e:
        print(f"❌ Error appending tweets to file: {e}")

def process_scraping_request(keywords, handles):
    """Process a scraping request"""
    global driver_instance
    
    if not driver_instance:
        print("❌ No browser instance available")
        return None
    
    try:
        # Generate unique filename
        unique_filename = get_unique_filename(keywords, handles)
        print(f"📁 Using output file: {unique_filename}")
        
        total_tweets = 0
        
        # Process each keyword
        for keyword in keywords:
            print(f"🔍 Searching for keyword: {keyword}")
            
            if handles:
                for handle in handles:
                    print(f"  -> Searching in handle: {handle}")
                    new_tweets = search_and_scrape_tweets(driver_instance, keyword, handle=handle, max_scroll_attempts=10)
                    if new_tweets:
                        print(f"  -> Found {len(new_tweets)} new tweets for handle {handle}")
                        append_tweets_to_file(new_tweets, keyword, handle=handle, file_name=unique_filename)
                        total_tweets += len(new_tweets)
                    else:
                        print(f"  -> No new tweets found for '{keyword}' in handle {handle}")
            else:
                new_tweets = search_and_scrape_tweets(driver_instance, keyword, handle=None, max_scroll_attempts=10)
                if new_tweets:
                    print(f"✅ Collected {len(new_tweets)} new tweets for '{keyword}' (global)")
                    append_tweets_to_file(new_tweets, keyword, file_name=unique_filename)
                    total_tweets += len(new_tweets)
                else:
                    print(f"❌ No new tweets found for '{keyword}' (global).")
        
        return {
            'success': True,
            'filename': unique_filename,
            'tweets_count': total_tweets,
            'keywords': keywords,
            'handles': handles
        }
        
    except Exception as e:
        print(f"❌ Error processing scraping request: {e}")
        return {
            'success': False,
            'error': str(e)
        }

def handle_client(client_socket, address):
    """Handle client requests"""
    try:
        print(f"📞 New connection from {address}")
        
        # Receive request
        data = client_socket.recv(4096).decode('utf-8')
        if not data:
            return
        
        try:
            request = json.loads(data)
        except json.JSONDecodeError:
            response = {'success': False, 'error': 'Invalid JSON request'}
            client_socket.send(json.dumps(response).encode('utf-8'))
            return
        
        print(f"📥 Received request: {request}")
        
        # Process scraping request
        if request.get('action') == 'scrape':
            keywords = request.get('keywords', [])
            handles = request.get('handles', [])
            
            result = process_scraping_request(keywords, handles)
            response = json.dumps(result)
            
        elif request.get('action') == 'status':
            response = json.dumps({
                'success': True,
                'status': 'running',
                'browser_ready': driver_instance is not None
            })
            
        else:
            response = json.dumps({
                'success': False,
                'error': 'Unknown action'
            })
        
        # Send response
        client_socket.send(response.encode('utf-8'))
        print(f"📤 Sent response: {response[:100]}...")
        
    except Exception as e:
        print(f"❌ Error handling client {address}: {e}")
        error_response = json.dumps({'success': False, 'error': str(e)})
        try:
            client_socket.send(error_response.encode('utf-8'))
        except:
            pass
    finally:
        client_socket.close()

def start_server(port=9999):
    """Start the scraper server"""
    global server_socket, is_running, driver_instance
    
    try:
        # Setup browser
        print("🚀 Setting up browser...")
        driver_instance = setup_driver(headless=False)
        if not driver_instance:
            print("❌ Failed to setup browser")
            return
        
        # Login to Twitter
        print("🔐 Logging into Twitter...")
        if not twitter_login(driver_instance):
            print("❌ Failed to login to Twitter")
            return
        
        # Start server
        server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server_socket.bind(('localhost', port))
        server_socket.listen(5)
        
        is_running = True
        print(f"🌐 Scraper server started on port {port}")
        print("🔄 Server ready to handle scraping requests...")
        
        while is_running:
            try:
                client_socket, address = server_socket.accept()
                client_thread = threading.Thread(
                    target=handle_client,
                    args=(client_socket, address)
                )
                client_thread.daemon = True
                client_thread.start()
                
            except KeyboardInterrupt:
                print("\n🛑 Shutting down server...")
                break
            except Exception as e:
                print(f"❌ Server error: {e}")
                continue
                
    except Exception as e:
        print(f"❌ Failed to start server: {e}")
    finally:
        cleanup()

def cleanup():
    """Clean up resources"""
    global driver_instance, server_socket, is_running
    
    is_running = False
    
    if driver_instance:
        print("🔄 Closing browser...")
        try:
            driver_instance.quit()
        except:
            pass
        driver_instance = None
    
    if server_socket:
        try:
            server_socket.close()
        except:
            pass
        server_socket = None

if __name__ == "__main__":
    import atexit
    atexit.register(cleanup)
    
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 9999
    start_server(port)
