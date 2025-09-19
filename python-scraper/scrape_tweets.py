import time
import random
from datetime import datetime

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

# ----------------------------------------------------------------------
# Replace these with your actual Twitter credentials
TWITTER_USERNAME = ""
TWITTER_PASSWORD = ""
# ----------------------------------------------------------------------

# Get keywords and handles from environment variables, fallback to defaults
def get_keywords_and_handles():
    import os
    import json
    
    keywords_json = os.getenv('KEYWORDS', '["test"]')
    handles_json = os.getenv('HANDLES', '[]')
    
    keywords = json.loads(keywords_json)
    handles = json.loads(handles_json)
    
    return keywords, handles

# Get keywords and handles
KEYWORDS, HANDLES = get_keywords_and_handles()

# Dictionary to track seen tweets per keyword
# We'll store a combined "seen_key" => text + author + handle + time to avoid duplicates.
seen_tweets_by_keyword = {}

def setup_driver(headless=False):
    """Initialize and return a Chrome WebDriver."""
    chrome_options = Options()
    if headless:
        chrome_options.add_argument("--headless")

    driver = webdriver.Chrome(options=chrome_options)
    driver.maximize_window()
    return driver

def twitter_login(driver, username, password):
    """Open Twitter and wait for manual login."""
    try:
        print("🌐 Opening Twitter login page...")
        driver.get("https://twitter.com/i/flow/login")
        
        print("🔐 Please login to Twitter manually in the browser window...")
        print("⏳ Waiting for you to complete login...")
        print("   (The scraper will continue once you're logged in)")
        
        # Wait indefinitely until user manually logs in
        while True:
            try:
                current_url = driver.current_url
                
                # Check if we're on home page or logged in
                if ("home" in current_url or 
                    "twitter.com" in current_url and "login" not in current_url or
                    driver.find_elements(By.CSS_SELECTOR, '[data-testid="SideNav_AccountSwitcher_Button"]')):
                    print("✅ Login detected! Continuing with scraping...")
                    return True
                    
                # Check for any error messages
                error_elements = driver.find_elements(By.CSS_SELECTOR, '[data-testid="error"]')
                if error_elements:
                    print("❌ Login error detected. Please try again.")
                    print("   Refreshing page...")
                    driver.refresh()
                    time.sleep(2)
                
                # Wait a bit before checking again
                time.sleep(2)
                
            except Exception as e:
                print(f"⚠️  Checking login status... ({e})")
                time.sleep(2)
                continue
                
    except Exception as e:
        print(f"❌ Error during login setup: {e}")
        return False

def build_search_url(keyword, handle=None):
    """
    Build a Twitter 'Latest' search URL.
    If handle is provided (e.g. '@OpenAI'), limit search to tweets from that handle + keyword.
    Otherwise, global search.
    """
    if handle:
        handle_stripped = handle.replace("@", "")
        # e.g. 'from%3AOpenAI mohan yadav'
        query = f"from%3A{handle_stripped}%20{keyword}"
    else:
        query = f"{keyword}"
    return f"https://twitter.com/search?q={query}&f=live"

def search_and_scrape_tweets(driver, keyword, handle=None, max_scroll_attempts=10):
    """
    Search for tweets containing `keyword`. If `handle` is given, search only for that handle.
    We attempt to capture: tweet_text, author_name, author_handle, tweet_timestamp.

    We'll scroll multiple times until no new tweets appear in a pass or we hit max_scroll_attempts.

    Returns a list of dicts: { 'text': str, 'author': str, 'handle': str, 'time': str }.
    """
    search_url = build_search_url(keyword, handle=handle)
    driver.get(search_url)
    time.sleep(3)

    # Initialize if not in dict
    if keyword not in seen_tweets_by_keyword:
        seen_tweets_by_keyword[keyword] = set()

    new_tweets_collected = []
    scroll_attempt = 0

    while True:
        scroll_attempt += 1
        new_in_this_pass = 0

        # Collect tweet elements
        tweet_elements = driver.find_elements(By.CSS_SELECTOR, 'article[role="article"]')

        for tweet_el in tweet_elements:
            try:
                # 1) Tweet text
                text_el = tweet_el.find_element(By.CSS_SELECTOR, 'div[data-testid="tweetText"]')
                tweet_text = text_el.text.strip()
                if not tweet_text:
                    continue

                # 2) Author (display name)
                try:
                    author_el = tweet_el.find_element(By.CSS_SELECTOR, 'div[data-testid="User-Name"] span span')
                    author_text = author_el.text.strip()
                except:
                    author_text = "Unknown"

                # 3) Author handle
                # We'll look for a link within data-testid="User-Name" that has href^="/"
                # Then read its <span> text, which often is "@handle"
                try:
                    handle_link = tweet_el.find_element(By.CSS_SELECTOR, 'div[data-testid="User-Name"] a[href^="/"]')
                    handle_span = handle_link.find_element(By.CSS_SELECTOR, 'span')
                    handle_text = handle_span.text.strip()  # e.g. "@iiamkrshn"
                    if not handle_text.startswith("@"):
                        handle_text = "@" + handle_text
                except:
                    handle_text = "@unknown"

                # 4) Timestamp
                try:
                    time_el = tweet_el.find_element(By.TAG_NAME, "time")
                    tweet_time = time_el.get_attribute("datetime") or "Unknown"
                except:
                    tweet_time = "Unknown"

                # Dedup key
                seen_key = f"{tweet_text} | {author_text} | {handle_text} | {tweet_time}"
                if seen_key in seen_tweets_by_keyword[keyword]:
                    continue

                # If new
                new_tweets_collected.append({
                    'text': tweet_text,
                    'author': author_text,
                    'handle': handle_text,
                    'time': tweet_time
                })
                seen_tweets_by_keyword[keyword].add(seen_key)
                new_in_this_pass += 1

            except:
                # skip if any failure
                continue

        # Scroll down
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(4)  # wait more time so new tweets can load

        if new_in_this_pass == 0:
            # No new tweets found in this pass - likely we've loaded everything or no new tweets are coming
            print("[DEBUG] No new tweets in this pass; stopping scroll.")
            break

        if scroll_attempt >= max_scroll_attempts:
            print(f"[DEBUG] Reached max scroll attempts ({max_scroll_attempts}). Stopping.")
            break

    return new_tweets_collected

def append_tweets_to_file(tweets, keyword, handle=None, file_name="tweets_output.md"):
    """
    Append the tweets to a .md file, including author, handle, and time.
    """
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    handle_info = f"(from {handle})" if handle else "(global)"

    header = f"\n## Tweets for '{keyword}' {handle_info} at {now}\n\n"

    lines = []
    for t in tweets:
        text_val = t.get('text', "")
        author_val = t.get('author', "Unknown")
        handle_val = t.get('handle', "@unknown")
        time_val = t.get('time', "Unknown")

        # Example bullet:
        # - [Author: Dr Mohan Yadav] [Handle: @drmohanyadav] [Time: 2025-03-13T05:36:16.000Z]
        #   (tweet text)
        lines.append(
            f"- [Author: {author_val}] [Handle: {handle_val}] [Time: {time_val}]\n  {text_val}\n"
        )

    with open(file_name, "a", encoding="utf-8") as f:
        f.write(header)
        for line in lines:
            f.write(line + "\n")  # extra blank line for spacing

def get_unique_filename(keywords, handles):
    """
    Generate a unique filename based on keywords and timestamp.
    """
    import hashlib
    import time
    
    # Create a unique identifier from keywords and handles
    content = f"{keywords}_{handles}_{time.time()}"
    hash_id = hashlib.md5(content.encode()).hexdigest()[:8]
    
    # Clean keywords for filename
    clean_keywords = "_".join([k.replace(" ", "_").replace("/", "_") for k in keywords])
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    return f"tweets_output_{clean_keywords}_{timestamp}_{hash_id}.md"

# Global driver instance to reuse across requests
driver_instance = None

def get_or_create_driver():
    """Get existing driver or create new one if none exists."""
    global driver_instance
    
    if driver_instance is None:
        print("🚀 Creating new browser instance...")
        driver_instance = setup_driver(headless=False)
        
        # Login once when creating the driver
        print("🔐 Logging into Twitter...")
        twitter_login(driver_instance, "", "")  # Manual login
        
    return driver_instance

def main():
    if not KEYWORDS:
        print("❌ No keywords provided")
        return
        
    # Generate unique filename for this run
    unique_filename = get_unique_filename(KEYWORDS, HANDLES)
    print(f"📁 Using output file: {unique_filename}")
    
    try:
        # Get or create driver (reuses existing browser if available)
        driver = get_or_create_driver()

        # Process each keyword
        for keyword in KEYWORDS:
            print(f"🔍 Searching for keyword: {keyword}")

            if HANDLES:
                for h in HANDLES:
                    print(f"  -> Searching in handle: {h}")
                    new_tweets = search_and_scrape_tweets(driver, keyword, handle=h, max_scroll_attempts=10)
                    if new_tweets:
                        print(f"  -> Found {len(new_tweets)} new tweets for handle {h}")
                        append_tweets_to_file(new_tweets, keyword, handle=h, file_name=unique_filename)
                    else:
                        print(f"  -> No new tweets found for '{keyword}' in handle {h}")
            else:
                new_tweets = search_and_scrape_tweets(driver, keyword, handle=None, max_scroll_attempts=10)
                if new_tweets:
                    print(f"✅ Collected {len(new_tweets)} new tweets for '{keyword}' (global)")
                    append_tweets_to_file(new_tweets, keyword, file_name=unique_filename)
                else:
                    print(f"❌ No new tweets found for '{keyword}' (global).")

    except KeyboardInterrupt:
        print("Script interrupted by user.")
        if driver_instance:
            print("🔄 Keeping browser open for future requests...")
    except Exception as e:
        print(f"❌ Error: {e}")
        # Don't quit driver on error, keep it for retry

def cleanup():
    """Clean up the global driver instance."""
    global driver_instance
    if driver_instance:
        print("🔄 Closing browser...")
        driver_instance.quit()
        driver_instance = None

if __name__ == "__main__":
    import atexit
    atexit.register(cleanup)  # Register cleanup function
    main()
