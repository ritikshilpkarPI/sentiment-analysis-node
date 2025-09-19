#!/usr/bin/env python3
"""
Test script to verify Chrome and ChromeDriver setup
"""

import sys
import subprocess
import os

def test_chrome_installation():
    """Test if Chrome is installed"""
    try:
        # Try to find Chrome
        chrome_paths = [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser'
        ]
        
        for path in chrome_paths:
            if os.path.exists(path):
                print(f"✅ Chrome found at: {path}")
                return path
        
        print("❌ Chrome not found in common locations")
        return None
        
    except Exception as e:
        print(f"❌ Error checking Chrome: {e}")
        return None

def test_chromedriver():
    """Test ChromeDriver"""
    try:
        result = subprocess.run(['which', 'chromedriver'], 
                              capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            driver_path = result.stdout.strip()
            print(f"✅ ChromeDriver found at: {driver_path}")
            return driver_path
        else:
            print("❌ ChromeDriver not found in PATH")
            return None
    except Exception as e:
        print(f"❌ Error checking ChromeDriver: {e}")
        return None

def test_selenium():
    """Test Selenium import and basic functionality"""
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        print("✅ Selenium imported successfully")
        
        # Test basic Chrome options
        options = Options()
        options.add_argument("--headless")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        print("✅ Chrome options created successfully")
        
        return True
        
    except ImportError as e:
        print(f"❌ Selenium import failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Selenium test failed: {e}")
        return False

def main():
    print("=== Chrome/ChromeDriver Test ===")
    
    chrome_path = test_chrome_installation()
    driver_path = test_chromedriver()
    selenium_ok = test_selenium()
    
    print("\n=== Summary ===")
    if chrome_path and driver_path and selenium_ok:
        print("✅ All components are ready!")
        print("You can now use the /runAnalysis endpoint.")
    else:
        print("❌ Some components are missing or broken.")
        print("\nTo fix:")
        if not chrome_path:
            print("- Install Google Chrome: https://www.google.com/chrome/")
        if not driver_path:
            print("- Install ChromeDriver: brew install chromedriver")
        if not selenium_ok:
            print("- Install Python dependencies: pip3 install -r requirements.txt")

if __name__ == "__main__":
    main()
