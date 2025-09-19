#!/usr/bin/env python3
"""
Script to fix ChromeDriver issues by cleaning cache and reinstalling
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

def clean_chromedriver_cache():
    """Clean the webdriver-manager cache"""
    home = Path.home()
    wdm_cache = home / '.wdm'
    
    if wdm_cache.exists():
        print(f"Cleaning webdriver-manager cache at: {wdm_cache}")
        shutil.rmtree(wdm_cache)
        print("Cache cleaned successfully!")
    else:
        print("No webdriver-manager cache found.")

def install_chromedriver():
    """Install ChromeDriver using webdriver-manager"""
    try:
        print("Installing ChromeDriver...")
        from webdriver_manager.chrome import ChromeDriverManager
        from selenium.webdriver.chrome.service import Service
        
        driver_path = ChromeDriverManager().install()
        print(f"ChromeDriver installed at: {driver_path}")
        
        # Test if the driver works
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        
        options = Options()
        options.add_argument("--headless")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        
        service = Service(driver_path)
        driver = webdriver.Chrome(service=service, options=options)
        driver.get("https://www.google.com")
        print("ChromeDriver test successful!")
        driver.quit()
        
        return True
        
    except Exception as e:
        print(f"ChromeDriver installation failed: {e}")
        return False

def install_system_chromedriver():
    """Try to install ChromeDriver via system package manager"""
    try:
        print("Trying to install ChromeDriver via brew...")
        subprocess.run(['brew', 'install', 'chromedriver'], check=True)
        print("ChromeDriver installed via brew!")
        return True
    except subprocess.CalledProcessError:
        print("Brew installation failed or brew not available")
        return False
    except FileNotFoundError:
        print("Brew not found")
        return False

def main():
    print("=== ChromeDriver Fix Script ===")
    
    # Clean cache
    clean_chromedriver_cache()
    
    # Try to install ChromeDriver
    if install_chromedriver():
        print("✅ ChromeDriver fixed successfully!")
    else:
        print("❌ webdriver-manager installation failed")
        print("Trying system installation...")
        
        if install_system_chromedriver():
            print("✅ ChromeDriver installed via system package manager!")
        else:
            print("❌ All installation methods failed")
            print("Please install ChromeDriver manually:")
            print("1. Download from: https://chromedriver.chromium.org/")
            print("2. Add to PATH")
            print("3. Or install via brew: brew install chromedriver")

if __name__ == "__main__":
    main()
