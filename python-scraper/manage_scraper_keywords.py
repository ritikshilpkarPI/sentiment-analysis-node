#!/usr/bin/env python3
"""
Script to manage Python scraper keywords
Usage: python manage_scraper_keywords.py [add|remove|list|clear] [keyword]
"""

import sys
import os

KEYWORDS_FILE = "scraper_keywords.txt"

def read_keywords():
    """Read current keywords from file"""
    keywords = set()
    if os.path.exists(KEYWORDS_FILE):
        with open(KEYWORDS_FILE, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    keywords.add(line)
    return keywords

def write_keywords(keywords):
    """Write keywords to file"""
    with open(KEYWORDS_FILE, 'w', encoding='utf-8') as f:
        f.write("# Python Scraper Configuration\n")
        f.write("# Keywords listed here will be actively scraped\n")
        f.write("# Remove keywords to stop scraping them\n")
        f.write("# Add new keywords to start scraping them\n\n")
        
        if keywords:
            f.write("# Currently active keywords:\n")
            for keyword in sorted(keywords):
                f.write(f"{keyword}\n")
        else:
            f.write("# No active keywords - scraper will be stopped\n")

def add_keyword(keyword):
    """Add a keyword to the list"""
    keywords = read_keywords()
    keywords.add(keyword)
    write_keywords(keywords)
    print(f"✅ Added keyword: {keyword}")

def remove_keyword(keyword):
    """Remove a keyword from the list"""
    keywords = read_keywords()
    if keyword in keywords:
        keywords.remove(keyword)
        write_keywords(keywords)
        print(f"✅ Removed keyword: {keyword}")
    else:
        print(f"❌ Keyword not found: {keyword}")

def list_keywords():
    """List current keywords"""
    keywords = read_keywords()
    if keywords:
        print("📋 Current active keywords:")
        for keyword in sorted(keywords):
            print(f"  - {keyword}")
    else:
        print("📋 No active keywords")

def clear_keywords():
    """Clear all keywords"""
    write_keywords(set())
    print("✅ Cleared all keywords")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python manage_scraper_keywords.py [add|remove|list|clear] [keyword]")
        print("Examples:")
        print("  python manage_scraper_keywords.py list")
        print("  python manage_scraper_keywords.py add pakistan")
        print("  python manage_scraper_keywords.py remove cricket")
        print("  python manage_scraper_keywords.py clear")
        sys.exit(1)
    
    command = sys.argv[1].lower()
    
    if command == "list":
        list_keywords()
    elif command == "clear":
        clear_keywords()
    elif command in ["add", "remove"]:
        if len(sys.argv) < 3:
            print(f"❌ Please provide a keyword to {command}")
            sys.exit(1)
        keyword = sys.argv[2]
        if command == "add":
            add_keyword(keyword)
        else:
            remove_keyword(keyword)
    else:
        print(f"❌ Unknown command: {command}")
        sys.exit(1)
