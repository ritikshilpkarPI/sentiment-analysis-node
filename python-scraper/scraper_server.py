#!/usr/bin/env python3
"""
Persistent Twitter Scraper Server (headless + auto-login)
"""

import json
import os
import sys
import time
import threading
import socket
from datetime import datetime
import hashlib
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

# Global driver instance
driver_instance = None
server_socket = None
is_running = False

# --- Credentials: read from environment variables (recommended) ---
# Set these in your VM before running:
# export TWITTER_USERNAME="your_username"
# export TWITTER_PASSWORD="your_password"
TWITTER_USERNAME = os.environ.get("TWITTER_USERNAME") or None
TWITTER_PASSWORD = os.environ.get("TWITTER_PASSWORD") or None

# (Optional) fallback literals (not recommended). Set to None for safety if you don't want a fallback.
# TWITTER_USERNAME = TWITTER_USERNAME or "RajMalh07467374"
# TWITTER_PASSWORD = TWITTER_PASSWORD or "Shilpkarji@01"

def setup_driver(headless=True):
    """Setup Chrome driver with sensible options. headless=True runs without UI."""
    chrome_options = Options()

    # Minimal, stable flags for headless servers
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

    # Headless flag (modern)
    if headless:
        chrome_options.add_argument("--headless=new")

    # Use a binary location only if it exists (helps on systems w/ different path)
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
        # Clear corrupted wdm cache to avoid previous bad downloads (optional but useful)
        wdm_cache = os.path.expanduser("~/.wdm")
        if os.path.exists(wdm_cache):
            import shutil
            shutil.rmtree(wdm_cache, ignore_errors=True)

        print("🔧 Using WebDriver Manager to install/locate chromedriver...")
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)

        # Optional stealth measure
        try:
            driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        except Exception:
            pass

        driver.set_page_load_timeout(60)
        driver.implicitly_wait(5)
        print("✅ Browser started (headless=%s)." % ("True" if headless else "False"))
        return driver

    except Exception as e:
        print(f"❌ Error setting up driver: {e}")
        return None


def twitter_login(driver, username=None, password=None, timeout_seconds=60):
    """
    Automate Twitter login in headless mode using the provided credentials.
    Returns True on success, False on failure, or raises where appropriate.
    """
    username = username or TWITTER_USERNAME
    password = password or TWITTER_PASSWORD

    if not username or not password:
        print("❌ No TWITTER_USERNAME or TWITTER_PASSWORD provided in environment.")
        return False

    try:
        print("🌐 Opening Twitter login flow...")
        driver.get("https://twitter.com/i/flow/login")
        wait = WebDriverWait(driver, 20)

        start_time = time.time()

        # Different flows exist. We'll try to detect username input or email/phone prompt.
        # Loop trying to progress the flow; break when we detect being logged in.
        step = 0
        while time.time() - start_time < timeout_seconds:
            try:
                current_url = driver.current_url
                # If already logged in, home will be reachable or account UI appears
                if ("home" in current_url and "login" not in current_url) or driver.find_elements(By.CSS_SELECTOR, '[data-testid="SideNav_AccountSwitcher_Button"]'):
                    print("✅ Already logged in (detected home/account element).")
                    return True

                # try multiple selectors for username input
                if step == 0:
                    # username/email/phone field (various selectors used by Twitter)
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
                                # choose first visible/enabled element
                                for e in elems:
                                    if e.is_displayed() and e.is_enabled():
                                        e.clear()
                                        e.send_keys(username)
                                        filled = True
                                        break
                        except Exception:
                            continue

                    if filled:
                        time.sleep(0.8)
                        # click Next / Continue button if present
                        next_btn_selectors = [
                            'div[role="button"][data-testid="LoginForm_Login_Button"]',
                            'div[role="button"] span:contains("Next")',  # fallback (may not work)
                            'div[role="button"][data-testid="ocfEnterTextNextButton"]',
                            'div[role="button"]'
                        ]
                        # generic attempt: find buttons and click one that looks enabled
                        buttons = driver.find_elements(By.CSS_SELECTOR, 'div[role="button"], button')
                        for b in buttons:
                            try:
                                if b.is_displayed() and b.is_enabled():
                                    txt = b.text.strip().lower()
                                    if txt in ("next", "continue", "log in", "login", "confirm", "next →"):
                                        try:
                                            b.click()
                                            break
                                        except:
                                            driver.execute_script("arguments[0].click();", b)
                                            break
                        step = 1
                        time.sleep(1.5)
                        continue

                # If we've reached password step
                if step == 1:
                    # look for password input
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
                                        e.send_keys(password)
                                        found_pwd = True
                                        break
                        except Exception:
                            continue

                    if found_pwd:
                        time.sleep(0.6)
                        # click Log in / Submit button
                        buttons = driver.find_elements(By.CSS_SELECTOR, 'div[role="button"], button')
                        for b in buttons:
                            try:
                                if not b.is_displayed() or not b.is_enabled():
                                    continue
                                txt = b.text.strip().lower()
                                if txt in ("log in", "login", "log in →", "log in now", "submit", "continue"):
                                    try:
                                        b.click()
                                    except:
                                        driver.execute_script("arguments[0].click();", b)
                                    break
                        step = 2
                        time.sleep(2)
                        # After password submit, check for success
                        time.sleep(2)
                        # If 2FA or challenge appears, detect below
                        continue

                # After submit attempts: detect 2FA/challenge or success
                # Detect presence of 2FA / verification challenge / captcha / locked pages
                # These selectors are heuristic and may change over time
                if driver.find_elements(By.CSS_SELECTOR, 'input[name="challenge_response"]') or driver.find_elements(By.CSS_SELECTOR, 'input[type="tel"]') or "challenge" in driver.current_url:
                    print("⚠️ Login requires additional verification (2FA / challenge). Cannot bypass automatically.")
                    return False

                # Detect captcha-ish flows
                if driver.find_elements(By.CSS_SELECTOR, 'iframe[src*="captcha"]') or "captcha" in driver.page_source.lower():
                    print("⚠️ CAPTCHA detected on login flow. Manual intervention required.")
                    return False

                # If logged in, find account UI
                if driver.find_elements(By.CSS_SELECTOR, '[data-testid="SideNav_AccountSwitcher_Button"]'):
                    print("✅ Login detected via account UI.")
                    return True

                # Some flows redirect to a home URL after success
                if "home" in driver.current_url and "login" not in driver.current_url:
                    print("✅ Login redirect detected.")
                    return True

            except Exception as inner_e:
                # keep trying until timeout
                # print a short debug message but avoid spamming
                # print(f"⚠️ Login attempt check error: {inner_e}")
                pass

            time.sleep(1)

        print("⏰ Login timeout reached (headless automated attempts).")
        return False

    except Exception as e:
        print(f"❌ Error during automated login: {e}")
        return False


# --- rest of your original scraper code below (unchanged except where we call setup/twitter_login) ---

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
                    elif poster and poster not in [v['poster'] for v in media_data['videos']]:
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
        print("🔐 Attempting automated Twitter login...")
        logged_in = twitter_login(driver_instance)
        if not logged_in:
            print("❌ Automated login failed. Exiting.")
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
    # Start headless by default. If you want a visible browser (not recommended on GCP), set headless=False.
    start_server(port, headless=True)
