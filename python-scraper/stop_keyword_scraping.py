#!/usr/bin/env python3
"""
Script to stop Python scraper for specific keywords
Usage: python stop_keyword_scraping.py <keyword1> <keyword2> ...
"""

import sys
import os
import signal
import psutil

def stop_scraping_for_keywords(keywords):
    """Stop Python scraper processes for specific keywords"""
    stopped_count = 0
    
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            # Check if it's a Python process running scraper_server.py
            if proc.info['name'] == 'python' or proc.info['name'] == 'python3':
                cmdline = ' '.join(proc.info['cmdline']) if proc.info['cmdline'] else ''
                
                # Check if it's running scraper_server.py
                if 'scraper_server.py' in cmdline:
                    # Check if any of the keywords are being processed
                    for keyword in keywords:
                        if keyword in cmdline:
                            print(f"🛑 Stopping scraper process (PID: {proc.info['pid']}) for keyword: {keyword}")
                            proc.terminate()
                            stopped_count += 1
                            break
                            
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    
    if stopped_count == 0:
        print("❌ No scraper processes found for the specified keywords")
    else:
        print(f"✅ Stopped {stopped_count} scraper process(es)")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python stop_keyword_scraping.py <keyword1> <keyword2> ...")
        print("Example: python stop_keyword_scraping.py 'abhishek sharma' cricket")
        sys.exit(1)
    
    keywords = sys.argv[1:]
    print(f"🛑 Stopping scraping for keywords: {', '.join(keywords)}")
    stop_scraping_for_keywords(keywords)
