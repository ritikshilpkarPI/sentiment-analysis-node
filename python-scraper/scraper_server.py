#!/usr/bin/env python3
"""
Persistent Twitter Scraper Server (fixed)
- Proper headless handling
- Save/load cookies to avoid repeated manual logins
- Fail-fast on repeated Chromedriver errors (no spam)
- Chromedriver logs to /tmp/chromedriver.log
"""

import json
import os
import sys
import time
import threading
import socket
import pickle
import pathlib
import hashlib
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

# Output directory for scraped tweets
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")

# Globals
driver_instance = None
server_socket = None
is_running = False

# Cookie path
COOKIE_PATH = os.path.join(os.path.dirname(__file__), "twitter_cookies.pkl")

# Keywords configuration path
KEYWORDS_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "scraper_keywords.txt")

def read_allowed_keywords():
    """Read allowed keywords from configuration file"""
    allowed_keywords = set()
    if os.path.exists(KEYWORDS_CONFIG_PATH):
        try:
            with open(KEYWORDS_CONFIG_PATH, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        allowed_keywords.add(line)
            print(f"📋 Allowed keywords: {', '.join(allowed_keywords) if allowed_keywords else 'None'}")
        except Exception as e:
            print(f"❌ Error reading keywords config: {e}")
    else:
        print("⚠️ No keywords config file found. All keywords will be allowed.")
    return allowed_keywords

# Read creds from env (recommended)
TWITTER_USERNAME = os.environ.get("TWITTER_USERNAME")
TWITTER_PASSWORD = os.environ.get("TWITTER_PASSWORD")


def save_cookies(driver, path=COOKIE_PATH):
    try:
        cookies = driver.get_cookies()
        pathlib.Path(path).parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump(cookies, f)
        print(f"💾 Saved {len(cookies)} cookies to {path}")
        return True
    except Exception as e:
        print(f"❌ Failed to save cookies: {e}")
        return False


def load_cookies(driver, path=COOKIE_PATH, domain=".twitter.com"):
    try:
        if not os.path.exists(path):
            print("⚠️ Cookies file not found:", path)
            return 0
        with open(path, "rb") as f:
            cookies = pickle.load(f)
        loaded = 0
        for c in cookies:
            cookie = {k: v for k, v in c.items() if k not in ("sameSite",)}
            if "domain" not in cookie:
                cookie["domain"] = domain
            try:
                driver.add_cookie(cookie)
                loaded += 1
            except Exception:
                cookie.pop("expiry", None)
                try:
                    driver.add_cookie(cookie)
                    loaded += 1
                except Exception:
                    continue
        print(f"🔁 Loaded {loaded} cookies from {path}")
        return loaded
    except Exception as e:
        print(f"❌ Failed to load cookies: {e}")
        return 0


def setup_driver(headless=True):
    """Setup Chrome driver with sensible options. headless=True runs without UI."""
    chrome_options = Options()
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--remote-debugging-port=9222")
    chrome_options.add_argument("--disable-extensions")
    chrome_options.add_argument("--mute-audio")
    chrome_options.add_argument("--hide-scrollbars")
    chrome_options.add_argument("--disable-background-networking")
    chrome_options.add_argument("--disable-background-timer-throttling")
    chrome_options.add_argument("--disable-renderer-backgrounding")
    chrome_options.add_argument("--disable-backgrounding-occluded-windows")
    chrome_options.add_argument("--disable-client-side-phishing-detection")
    # Additional flags for macOS compatibility
    chrome_options.add_argument("--disable-web-security")
    chrome_options.add_argument("--disable-features=VizDisplayCompositor")
    chrome_options.add_argument("--disable-ipc-flooding-protection")
    chrome_options.add_argument("--disable-hang-monitor")
    chrome_options.add_argument("--disable-prompt-on-repost")
    chrome_options.add_argument("--disable-sync")
    chrome_options.add_argument("--disable-translate")
    chrome_options.add_argument("--disable-logging")
    chrome_options.add_argument("--disable-default-apps")
    chrome_options.add_argument("--disable-component-extensions-with-background-pages")

    if headless:
        # modern headless flag
        chrome_options.add_argument("--headless=new")

    # Try common chrome paths (including macOS)
    chrome_paths = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",  # macOS Chrome
        "/usr/bin/google-chrome-stable",
        "/usr/bin/google-chrome",
        "/snap/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium"
    ]
    for p in chrome_paths:
        if os.path.exists(p):
            chrome_options.binary_location = p
            print(f"🔧 Using Chrome at: {p}")
            break

    try:
        # Clear corrupted wdm cache optional
        wdm_cache = os.path.expanduser("~/.wdm")
        if os.path.exists(wdm_cache):
            # don't aggressively delete on every start in prod; helpful here
            import shutil
            shutil.rmtree(wdm_cache, ignore_errors=True)

        print("🔧 Using WebDriver Manager to install/locate chromedriver...")
        # Add chromedriver log path for debugging
        try:
            driver_path = ChromeDriverManager().install()
        except Exception as e:
            print(f"⚠️ WebDriver Manager failed: {e}")
            # Fallback: try to use system chromedriver
            driver_path = "/usr/local/bin/chromedriver"
            if not os.path.exists(driver_path):
                driver_path = "/opt/homebrew/bin/chromedriver"
            if not os.path.exists(driver_path):
                raise Exception("No chromedriver found")
            print(f"🔧 Using system chromedriver: {driver_path}")
        
        # Fix: WebDriver Manager sometimes returns wrong file, find the actual chromedriver
        if "THIRD_PARTY_NOTICES" in driver_path:
            actual_driver_path = driver_path.replace("THIRD_PARTY_NOTICES.chromedriver", "chromedriver")
            if os.path.exists(actual_driver_path):
                driver_path = actual_driver_path
                print(f"🔧 Fixed driver path to: {driver_path}")
        
        # Fix permissions for chromedriver
        try:
            os.chmod(driver_path, 0o755)
            print(f"🔧 Fixed chromedriver permissions")
        except Exception as e:
            print(f"⚠️ Could not fix permissions: {e}")
        
        service = Service(driver_path, log_path="/tmp/chromedriver.log")
        driver = webdriver.Chrome(service=service, options=chrome_options)

        # Try slight stealth
        try:
            driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        except Exception:
            pass

        # Attempt to reuse saved cookies (safe if file exists)
        try:
            driver.get("https://twitter.com/")
            if os.path.exists(COOKIE_PATH):
                load_cookies(driver)
                driver.get("https://twitter.com/home")
                time.sleep(2)
        except Exception as e:
            print("⚠️ Cookie load step failed (non-fatal):", e)

        driver.set_page_load_timeout(60)
        driver.implicitly_wait(5)
        print("✅ Browser started (headless=%s)." % ("True" if headless else "False"))
        return driver

    except Exception as e:
        print(f"❌ Error setting up driver: {e}")
        return None


def twitter_login(driver, timeout_seconds=60):
    """
    Automate Twitter login using credentials from environment variables.
    Returns True on successful login, False otherwise.
    """
    if not driver:
        print("❌ No browser available for login")
        return False

    # Check if we have credentials
    if not TWITTER_USERNAME or not TWITTER_PASSWORD:
        print("❌ Missing TWITTER_USERNAME or TWITTER_PASSWORD environment variables")
        return False

    # If cookies indicate logged-in state already, check quickly
    try:
        driver.get("https://twitter.com/home")
        time.sleep(2)
        if "login" not in driver.current_url and driver.find_elements(By.CSS_SELECTOR, '[data-testid="SideNav_AccountSwitcher_Button"]'):
            print("✅ Already logged in via cookies.")
            return True
    except Exception:
        pass

    print("🌐 Opening Twitter login page...")
    try:
        driver.get("https://twitter.com/i/flow/login")
        time.sleep(3)
    except Exception as e:
        print("⚠️ Could not open login page:", e)
        return False

    print("🔐 Attempting automatic login...")
    start_time = time.time()
    step = 0  # 0 = enter username, 1 = enter password, 2 = submitted

    while time.time() - start_time < timeout_seconds:
        try:
            current_url = driver.current_url

            # Quick check for already logged in
            if ("home" in current_url and "login" not in current_url) or driver.find_elements(By.CSS_SELECTOR, '[data-testid="SideNav_AccountSwitcher_Button"]'):
                print("✅ Login successful!")
                save_cookies(driver)
                return True

            # Step 0: Fill username
            if step == 0:
                username_selectors = [
                    'input[name="text"]',
                    'input[type="text"][autocomplete="username"]',
                    'input[aria-label="Phone, email, or username"]',
                    'input[placeholder*="phone"]',
                    'input[placeholder*="email"]',
                    'input[placeholder*="username"]',
                ]
                
                filled = False
                for sel in username_selectors:
                    try:
                        elems = driver.find_elements(By.CSS_SELECTOR, sel)
                        if elems:
                            for e in elems:
                                if e.is_displayed() and e.is_enabled():
                                    e.clear()
                                    e.send_keys(TWITTER_USERNAME)
                                    filled = True
                                    break
                        if filled:
                            break
                    except Exception:
                        continue

                if filled:
                    # Click next button
                    try:
                        buttons = driver.find_elements(By.CSS_SELECTOR, 'div[role="button"], button')
                        for b in buttons:
                            try:
                                if not b.is_displayed() or not b.is_enabled():
                                    continue
                                txt = (b.text or "").strip().lower()
                                if txt and any(k in txt for k in ("next", "continue", "log in", "login", "confirm")):
                                    b.click()
                                    break
                            except Exception:
                                continue
                    except Exception:
                        pass
                    step = 1
                    time.sleep(2)
                    continue

            # Step 1: Fill password
            if step == 1:
                pwd_selectors = [
                    'input[name="password"]',
                    'input[type="password"]',
                    'input[autocomplete="current-password"]',
                    'input[aria-label="Password"]'
                ]
                
                found_pwd = False
                for sel in pwd_selectors:
                    try:
                        elems = driver.find_elements(By.CSS_SELECTOR, sel)
                        if elems:
                            for e in elems:
                                if e.is_displayed() and e.is_enabled():
                                    e.clear()
                                    e.send_keys(TWITTER_PASSWORD)
                                    found_pwd = True
                                    break
                        if found_pwd:
                            break
                    except Exception:
                        continue

                if found_pwd:
                    # Click login button
                    try:
                        buttons = driver.find_elements(By.CSS_SELECTOR, 'div[role="button"], button')
                        for b in buttons:
                            try:
                                if not b.is_displayed() or not b.is_enabled():
                                    continue
                                txt = (b.text or "").strip().lower()
                                if txt and any(k in txt for k in ("log in", "login", "submit", "continue")):
                                    b.click()
                                    break
                            except Exception:
                                continue
                    except Exception:
                        pass
                    step = 2
                    time.sleep(3)
                    continue

            # Check for 2FA or CAPTCHA
            try:
                if driver.find_elements(By.CSS_SELECTOR, 'input[name="challenge_response"]') or "challenge" in driver.current_url:
                    print("⚠️ 2FA/challenge detected. Cannot bypass automatically.")
                    return False

                page_src = driver.page_source.lower()
                if "captcha" in page_src or driver.find_elements(By.CSS_SELECTOR, 'iframe[src*="captcha"]'):
                    print("⚠️ CAPTCHA detected. Cannot bypass automatically.")
                    return False
            except Exception:
                pass

            time.sleep(1)

        except Exception as e:
            print(f"⚠️ Login attempt error: {e}")
            time.sleep(1)
            continue

    print("⏰ Login timeout reached.")
    return False


def get_unique_filename(keywords, handles):
    content = f"{keywords}_{handles}_{time.time()}"
    hash_id = hashlib.md5(content.encode()).hexdigest()[:8]
    clean_keywords = "_".join([k.replace(" ", "_").replace("/", "_") for k in keywords])
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"tweets_output_{clean_keywords}_{timestamp}_{hash_id}.md"


def extract_media_from_tweet(tweet_element):
    media_data = {'images': [], 'videos': []}
    try:
        image_selectors = [
            'img[src*="pbs.twimg.com"]',
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
                    if src and 'pbs.twimg.com' in src and src not in [i['url'] for i in media_data['images']]:
                        media_data['images'].append({'url': src, 'alt': alt, 'type': 'image'})
            except:
                continue

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
                    if src and src not in [v['url'] for v in media_data['videos']]:
                        media_data['videos'].append({'url': src, 'poster': poster, 'type': 'video'})
                    elif poster and poster not in [v.get('poster') for v in media_data['videos']]:
                        media_data['videos'].append({'url': poster, 'poster': poster, 'type': 'video'})
            except:
                continue

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
                    if src and src not in [v['url'] for v in media_data['videos']]:
                        media_data['videos'].append({'url': src, 'poster': None, 'type': 'embed'})
            except:
                continue

    except Exception as e:
        print(f"⚠️ Error extracting media: {e}")
    return media_data


def search_and_scrape_tweets(driver, keyword, handle=None, max_scroll_attempts=10):
    try:
        if handle:
            search_url = f"https://twitter.com/search?q=from:{handle}%20{keyword}&src=typed_query&f=live"
        else:
            search_url = f"https://twitter.com/search?q={keyword}&src=typed_query&f=live"

        print(f"🔍 Searching: {search_url}")
        driver.get(search_url)
        time.sleep(5)

        tweets = []
        scroll_attempts = 0

        while scroll_attempts < max_scroll_attempts:
            try:
                WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.CSS_SELECTOR, "body")))

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
                        print(f"⚠️ Selector {selector} failed: {e}")
                        continue

                if not tweet_elements:
                    print(f"⚠️ No tweets found with any selector, trying scroll {scroll_attempts + 1}")
                    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                    time.sleep(3)
                    scroll_attempts += 1
                    continue

                new_tweets_found = 0
                for element in tweet_elements:
                    try:
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

                        if text and author != "Unknown" and len(text) > 10:
                            media_data = extract_media_from_tweet(element)
                            tweet_data = {'author': author, 'text': text, 'timestamp': datetime.now().isoformat(), 'media': media_data}
                            if not any(t['text'] == text for t in tweets):
                                tweets.append(tweet_data)
                                new_tweets_found += 1
                                media_info = f" (📷 {len(media_data['images'])} images, 🎥 {len(media_data['videos'])} videos)" if media_data['images'] or media_data['videos'] else ""
                                print(f"✅ Found tweet: {author} - {text[:50]}...{media_info}")
                    except Exception as e:
                        print(f"⚠️ Error extracting tweet: {e}")
                        continue

                if new_tweets_found > 0:
                    print(f"📊 Found {new_tweets_found} new tweets (total: {len(tweets)})")
                else:
                    print(f"⚠️ No new tweets found in this scroll (attempt {scroll_attempts + 1})")

                driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(3)
                scroll_attempts += 1

                if tweets and scroll_attempts >= 3:
                    print(f"📊 Found {len(tweets)} tweets total, continuing to scroll...")

            except Exception as e:
                print(f"⚠️ Error in scroll attempt {scroll_attempts + 1}: {e}")
                scroll_attempts += 1
                continue

        print(f"🎯 Scraping completed. Found {len(tweets)} tweets total.")
        return tweets

    except Exception as e:
        print(f"❌ Error in search_and_scrape_tweets: {e}")
        return []


def append_tweets_to_file(tweets, keyword, handle=None, file_name="tweets_output.md"):
    try:
        # Ensure the output directory exists
        pathlib.Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
        file_path = os.path.join(OUTPUT_DIR, file_name)
        
        # Count existing tweets to continue sequential numbering
        existing_tweet_count = 0
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                # Count existing "## Tweet" headers
                existing_tweet_count = content.count('## Tweet')
        
        with open(file_path, 'a', encoding='utf-8') as f:
            for i, tweet in enumerate(tweets, existing_tweet_count + 1):
                f.write(f"## Tweet {i}\n")
                f.write(f"**Author:** {tweet['author']}\n")
                f.write(f"**Time:** {tweet['timestamp']}\n")
                f.write(f"**Text:** {tweet['text']}\n")
                f.write(f"**Keyword:** {keyword}\n")
                if handle:
                    f.write(f"**Handle:** {handle}\n")
                if 'media' in tweet and tweet['media']:
                    media = tweet['media']
                    if media['images']:
                        f.write(f"**Images:** {len(media['images'])} found\n")
                        for j, img in enumerate(media['images'], 1):
                            f.write(f"  - Image {j}: {img['url']}\n")
                    if media['videos']:
                        f.write(f"**Videos:** {len(media['videos'])} found\n")
                        for j, vid in enumerate(media['videos'], 1):
                            f.write(f"  - Video {j}: {vid['url']}\n")
                f.write("\n")
        print(f"💾 Appended {len(tweets)} tweets to {file_name} (starting from Tweet {existing_tweet_count + 1})")
    except Exception as e:
        print(f"❌ Error appending tweets to file: {e}")


# Batch scraping function - saves tweets in batches of 5
def scrape_tweets_in_batches(driver, keyword, handles=None, batch_size=5, max_batches=20):
    """Scrape tweets in batches and save immediately"""
    keyword_filename = f"tweets_output_{keyword}.md"
    total_tweets_saved = 0
    
    try:
        if handles:
            for handle in handles:
                print(f"  -> Searching in handle: {handle}")
                search_url = f"https://twitter.com/search?q=from:{handle}%20{keyword}&src=typed_query&f=live"
                driver.get(search_url)
                time.sleep(3)
                
                for batch_num in range(max_batches):
                    tweet_data = scrape_tweet_batch(driver, batch_size)
                    if tweet_data:
                        # Convert tweet data to proper structure (maintaining original format)
                        tweets = []
                        for tweet_info in tweet_data:
                            tweet_obj = {
                                'author': tweet_info['author'],
                                'timestamp': tweet_info['timestamp'],  # Use extracted timestamp
                                'text': tweet_info['text'],
                                'media': tweet_info['media']  # Use extracted media
                            }
                            tweets.append(tweet_obj)
                        append_tweets_to_file(tweets, keyword, handle=handle, file_name=keyword_filename)
                        total_tweets_saved += len(tweets)
                        print(f"💾 Batch {batch_num + 1}: Saved {len(tweets)} tweets (total: {total_tweets_saved})")
                        
                        # Scroll for next batch
                        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                        time.sleep(2)
                    else:
                        print(f"📊 No more tweets found in handle {handle}")
                        break
        else:
            search_url = f"https://twitter.com/search?q={keyword}&src=typed_query&f=live"
            driver.get(search_url)
            time.sleep(3)
            
            for batch_num in range(max_batches):
                tweet_data = scrape_tweet_batch(driver, batch_size)
                if tweet_data:
                    # Convert tweet data to proper structure (maintaining original format)
                    tweets = []
                    for tweet_info in tweet_data:
                        tweet_obj = {
                            'author': tweet_info['author'],
                            'timestamp': tweet_info['timestamp'],  # Use extracted timestamp
                            'text': tweet_info['text'],
                            'media': tweet_info['media']  # Use extracted media
                        }
                        tweets.append(tweet_obj)
                    append_tweets_to_file(tweets, keyword, file_name=keyword_filename)
                    total_tweets_saved += len(tweets)
                    print(f"💾 Batch {batch_num + 1}: Saved {len(tweets)} tweets (total: {total_tweets_saved})")
                    
                    # Scroll for next batch
                    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                    time.sleep(2)
                else:
                    print(f"📊 No more tweets found for keyword {keyword}")
                    break
                    
    except Exception as e:
        print(f"❌ Error in batch scraping for keyword {keyword}: {e}")
    
    return total_tweets_saved

# Helper function to scrape a single batch of tweets
def scrape_tweet_batch(driver, batch_size):
    """Scrape a single batch of tweets (up to batch_size) with complete data like original"""
    tweets = []
    try:
        # Wait for tweets to load
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'article[data-testid="tweet"]'))
        )
        
        # Get tweet elements
        tweet_elements = driver.find_elements(By.CSS_SELECTOR, 'article[data-testid="tweet"]')
        
        for i, tweet_element in enumerate(tweet_elements[:batch_size]):
            try:
                # Extract tweet text
                text_element = tweet_element.find_element(By.CSS_SELECTOR, '[data-testid="tweetText"]')
                tweet_text = text_element.text.strip()
                
                # Extract author name
                try:
                    author_element = tweet_element.find_element(By.CSS_SELECTOR, '[data-testid="User-Name"]')
                    author_name = author_element.text.strip()
                except:
                    author_name = 'Unknown'
                
                # Extract timestamp (ISO format like original)
                try:
                    time_element = tweet_element.find_element(By.CSS_SELECTOR, 'time')
                    timestamp = time_element.get_attribute('datetime')
                    if not timestamp:
                        timestamp = datetime.now().isoformat()
                except:
                    timestamp = datetime.now().isoformat()
                
                # Extract media (images and videos)
                media = {'images': [], 'videos': []}
                try:
                    # Look for images
                    image_elements = tweet_element.find_elements(By.CSS_SELECTOR, '[data-testid="tweetPhoto"] img')
                    for img in image_elements:
                        img_url = img.get_attribute('src')
                        if img_url:
                            media['images'].append({'url': img_url})
                    
                    # Look for videos
                    video_elements = tweet_element.find_elements(By.CSS_SELECTOR, 'video')
                    for vid in video_elements:
                        video_src = vid.get_attribute('src')
                        if video_src:
                            media['videos'].append({'url': video_src})
                except:
                    pass
                
                if tweet_text:
                    tweets.append({
                        'text': tweet_text,
                        'author': author_name,
                        'timestamp': timestamp,
                        'media': media
                    })
                    
            except Exception as e:
                print(f"⚠️ Error extracting tweet {i + 1}: {e}")
                continue
                
    except Exception as e:
        print(f"❌ Error in scrape_tweet_batch: {e}")
    
    return tweets

# Continuous scraping thread for each keyword
def continuous_scrape_keyword(keyword, handles=None, interval_minutes=5):
    """Continuously scrape tweets for a keyword and append to file in batches"""
    global driver_instance
    if not driver_instance:
        print(f"❌ No browser instance available for keyword: {keyword}")
        return
    
    keyword_filename = f"tweets_output_{keyword}.md"
    print(f"🔄 Starting continuous batch scraping for keyword: {keyword}")
    print(f"📁 Output file: {keyword_filename}")
    print(f"⏰ Scraping interval: {interval_minutes} minutes")
    print(f"📦 Batch size: 5 tweets per save")
    
    while is_running:
        try:
            print(f"🔍 Starting batch scraping for keyword: {keyword}")
            
            # Use batch processing
            total_saved = scrape_tweets_in_batches(driver_instance, keyword, handles, batch_size=5, max_batches=20)
            print(f"✅ Completed batch scraping for {keyword}: {total_saved} tweets saved")
            
            print(f"⏳ Waiting {interval_minutes} minutes before next scrape for keyword: {keyword}")
            time.sleep(interval_minutes * 60)  # Convert minutes to seconds
            
        except Exception as e:
            print(f"❌ Error in continuous scraping for keyword {keyword}: {e}")
            time.sleep(60)  # Wait 1 minute before retrying

def process_scraping_request(keywords, handles):
    global driver_instance
    if not driver_instance:
        print("❌ No browser instance available")
        return None
    try:
        # Read allowed keywords
        allowed_keywords = read_allowed_keywords()
        
        total_tweets = 0
        processed_keywords = []
        skipped_keywords = []
        
        for keyword in keywords:
            # Check if keyword is allowed
            if allowed_keywords and keyword not in allowed_keywords:
                print(f"🚫 Skipping blocked keyword: {keyword}")
                skipped_keywords.append(keyword)
                continue
                
            print(f"🔍 Starting continuous scraping for keyword: {keyword}")
            keyword_filename = f"tweets_output_{keyword}.md"
            print(f"📁 Using per-keyword file: {keyword_filename}")
            
            # Start continuous scraping thread for this keyword
            scrape_thread = threading.Thread(
                target=continuous_scrape_keyword, 
                args=(keyword, handles, 5),  # 5 minute interval
                daemon=True
            )
            scrape_thread.start()
            
            processed_keywords.append(keyword)
            print(f"✅ Continuous scraping started for keyword: {keyword}")
        
        return {
            'success': True, 
            'filename': f"continuous_scraping_{len(keywords)}_keywords", 
            'tweets_count': 0,  # Will be continuously updated
            'keywords': processed_keywords, 
            'skipped_keywords': skipped_keywords,
            'handles': handles,
            'message': f'Continuous scraping started for {len(processed_keywords)} keywords. {len(skipped_keywords)} keywords skipped.'
        }
    except Exception as e:
        print(f"❌ Error processing scraping request: {e}")
        return {'success': False, 'error': str(e)}


def handle_client(client_socket, address):
    try:
        print(f"📞 New connection from {address}")
        data = client_socket.recv(4096).decode('utf-8')
        if not data:
            return
        
        # Handle HTTP-style health check requests
        if data.startswith('GET /health'):
            health_response = {
                'status': 'OK',
                'timestamp': datetime.now().isoformat(),
                'browser_ready': driver_instance is not None,
                'logged_in': driver_instance is not None,
                'server_running': is_running,
                'version': '1.0.0'
            }
            http_response = f"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {len(json.dumps(health_response))}\r\n\r\n{json.dumps(health_response)}"
            client_socket.send(http_response.encode('utf-8'))
            return
        
        try:
            request = json.loads(data)
        except json.JSONDecodeError:
            response = {'success': False, 'error': 'Invalid JSON request'}
            client_socket.send(json.dumps(response).encode('utf-8'))
            return
        print(f"📥 Received request: {request}")
        if request.get('action') == 'scrape':
            keywords = request.get('keywords', [])
            handles = request.get('handles', [])
            result = process_scraping_request(keywords, handles)
            response = json.dumps(result)
        elif request.get('action') == 'status' or request.get('action') == 'health':
            health_data = {
                'success': True, 
                'status': 'running', 
                'browser_ready': driver_instance is not None,
                'logged_in': driver_instance is not None,
                'timestamp': datetime.now().isoformat(),
                'uptime': time.time() - start_time if 'start_time' in globals() else 0
            }
            response = json.dumps(health_data)
        else:
            response = json.dumps({'success': False, 'error': 'Unknown action'})
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


def start_server(port=9999, headless=True):
    global server_socket, is_running, driver_instance, start_time
    start_time = time.time()
    try:
        print("🚀 Setting up browser...")
        driver_instance = setup_driver(headless=headless)
        if not driver_instance:
            print("❌ Failed to setup browser")
            return
        print("🔐 Logging into Twitter...")
        logged_in = twitter_login(driver_instance)
        if not logged_in:
            print("❌ Failed to login to Twitter")
            cleanup()
            return
        print("✅ Logged into Twitter successfully. Starting server...")
        server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server_socket.bind(('localhost', port))
        server_socket.listen(5)
        is_running = True
        print(f"🌐 Scraper server started on port {port}")
        while is_running:
            try:
                client_socket, address = server_socket.accept()
                client_thread = threading.Thread(target=handle_client, args=(client_socket, address))
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
    # default to headless for production; use headless=False for the one-time manual login inside VNC
    start_server(port, headless=True)
