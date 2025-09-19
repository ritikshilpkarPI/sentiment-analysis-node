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

# Globals
driver_instance = None
server_socket = None
is_running = False

# Cookie path
COOKIE_PATH = os.path.join(os.path.dirname(__file__), "twitter_cookies.pkl")

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

    if headless:
        # modern headless flag
        chrome_options.add_argument("--headless=new")

    # Try common chrome paths
    chrome_paths = [
        "/usr/bin/google-chrome-stable",
        "/usr/bin/google-chrome",
        "/snap/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium"
    ]
    for p in chrome_paths:
        if os.path.exists(p):
            chrome_options.binary_location = p
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
        driver_path = ChromeDriverManager().install()
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


def twitter_login(driver, timeout_seconds=180):
    """
    Login to Twitter.
    - If cookies restored a logged-in session, this returns True quickly.
    - Else requires manual login (GUI) or will timeout/abort on repeated driver errors.
    """
    if not driver:
        print("❌ No browser available for login")
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
    except Exception as e:
        print("⚠️ Could not open login page:", e)
        return False

    print("🔐 Please login to Twitter manually in the browser window (if visible).")
    print("⏳ Waiting for you to complete login...")

    start = time.time()
    login_attempts = 0
    max_attempts = max(30, timeout_seconds // 2)
    consec_errors = 0
    max_consec_errors = 5

    while time.time() - start < timeout_seconds and login_attempts < max_attempts:
        try:
            # If chromedriver dead, driver.current_url will raise/timeout
            current_url = driver.current_url
            consec_errors = 0  # reset on success

            # Check success indicators
            try:
                if ("home" in current_url and "login" not in current_url) or driver.find_elements(By.CSS_SELECTOR, '[data-testid="SideNav_AccountSwitcher_Button"]'):
                    print("✅ Login detected! Server ready for scraping...")
                    try:
                        save_cookies(driver)
                    except Exception:
                        pass
                    return True
            except Exception:
                pass

            # detect visible login error and refresh
            try:
                errs = driver.find_elements(By.CSS_SELECTOR, '[data-testid="error"]')
                if errs:
                    print("❌ Login error detected on page. Refreshing...")
                    driver.refresh()
                    time.sleep(2)
            except Exception:
                pass

            login_attempts += 1
            if login_attempts % 10 == 0:
                print(f"⏳ Still waiting for login... ({login_attempts} checks)")
            time.sleep(2)

        except Exception as e:
            consec_errors += 1
            login_attempts += 1
            print(f"⚠️  Checking login status... ({e})")
            if consec_errors >= max_consec_errors:
                print(f"❌ Repeated connection errors ({consec_errors}). Aborting login.")
                return False
            time.sleep(2)
            continue

    print("⏰ Login timeout reached.")
    # attempt a final cookie save if logged in
    try:
        if "home" in driver.current_url and "login" not in driver.current_url:
            save_cookies(driver)
            return True
    except Exception:
        pass
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
    global driver_instance
    if not driver_instance:
        print("❌ No browser instance available")
        return None
    try:
        unique_filename = get_unique_filename(keywords, handles)
        print(f"📁 Using output file: {unique_filename}")
        total_tweets = 0
        for keyword in keywords:
            print(f"🔍 Searching for keyword: {keyword}")
            if handles:
                for handle in handles:
                    print(f"  -> Searching in handle: {handle}")
                    new_tweets = search_and_scrape_tweets(driver_instance, keyword, handle=handle, max_scroll_attempts=10)
                    if new_tweets:
                        append_tweets_to_file(new_tweets, keyword, handle=handle, file_name=unique_filename)
                        total_tweets += len(new_tweets)
            else:
                new_tweets = search_and_scrape_tweets(driver_instance, keyword, handle=None, max_scroll_attempts=10)
                if new_tweets:
                    append_tweets_to_file(new_tweets, keyword, file_name=unique_filename)
                    total_tweets += len(new_tweets)
        return {'success': True, 'filename': unique_filename, 'tweets_count': total_tweets, 'keywords': keywords, 'handles': handles}
    except Exception as e:
        print(f"❌ Error processing scraping request: {e}")
        return {'success': False, 'error': str(e)}


def handle_client(client_socket, address):
    try:
        print(f"📞 New connection from {address}")
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
        if request.get('action') == 'scrape':
            keywords = request.get('keywords', [])
            handles = request.get('handles', [])
            result = process_scraping_request(keywords, handles)
            response = json.dumps(result)
        elif request.get('action') == 'status':
            response = json.dumps({'success': True, 'status': 'running', 'browser_ready': driver_instance is not None})
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
    global server_socket, is_running, driver_instance
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
