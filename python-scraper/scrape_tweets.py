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

# Example list of keywords
KEYWORDS = ["mohan yadav"]

# Optional list of specific Twitter handles. 
# If this list is NOT empty, searches will be restricted to these handles.
# Example: HANDLES = ["@TwitterDev", "@OpenAI"]
HANDLES = []

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
    """Open Twitter login page and wait for manual login."""
    driver.get("https://twitter.com/i/flow/login")
    print("Please log in manually. Waiting for 30 seconds...")
    time.sleep(30)  # Wait for manual login
    if "home" in driver.current_url:
        print("Login successful!")
    else:
        print("Login may have failed. Current URL:", driver.current_url)

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

def main():
    driver = setup_driver(headless=False)
    try:
        twitter_login(driver, TWITTER_USERNAME, TWITTER_PASSWORD)

        while True:
            keyword = random.choice(KEYWORDS)
            print(f"Searching for keyword: {keyword}")

            if HANDLES:
                for h in HANDLES:
                    print(f"  -> Searching in handle: {h}")
                    new_tweets = search_and_scrape_tweets(driver, keyword, handle=h, max_scroll_attempts=10)
                    if new_tweets:
                        print(f"  -> Found {len(new_tweets)} new tweets for handle {h}")
                        append_tweets_to_file(new_tweets, keyword, handle=h)
                    else:
                        print(f"  -> No new tweets found for '{keyword}' in handle {h}")
            else:
                new_tweets = search_and_scrape_tweets(driver, keyword, handle=None, max_scroll_attempts=10)
                if new_tweets:
                    print(f"Collected {len(new_tweets)} new tweets for '{keyword}' (global)")
                    append_tweets_to_file(new_tweets, keyword)
                else:
                    print(f"No new tweets found for '{keyword}' (global).")

            sleep_sec = random.randint(10, 60)
            print(f"Waiting {sleep_sec} seconds before next search...\n")
            time.sleep(sleep_sec)

    except KeyboardInterrupt:
        print("Script interrupted by user.")
    finally:
        driver.quit()

if __name__ == "__main__":
    main()
