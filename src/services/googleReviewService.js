const puppeteer = require('puppeteer');
const GeminiService = require('./geminiService');
const { GoogleReviewCache } = require('../models');
const stringSimilarity = require('string-similarity');

// Ensure the table exists (sync at runtime)
GoogleReviewCache.sync();

/**
 * Fetch reviews, usernames, ratings, and dates from a Google Maps place page using Puppeteer
 * @param {string} placeUrl - Google Maps place URL
 * @param {number} [maxReviews=100] - Maximum number of reviews to fetch
 * @returns {Promise<Array<{username: string, review: string, rating: number, date: string}>>}
 */
async function fetchAllGoogleReviews(placeUrl, maxReviews = 100) {
    if (!placeUrl || typeof placeUrl !== 'string' || !placeUrl.includes('google.com/maps/place/')) {
        throw new Error('Invalid Google Maps place URL');
    }
    let browser;
    try {
        browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.goto(placeUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        // Try to open the reviews panel if needed
        let reviewsPanelOpened = false;
        // 1. Try to click the 'Reviews' tab if present
        let reviewsTabBtn = await page.$('button[aria-label*="Reviews for"]');
        if (reviewsTabBtn) {
            await reviewsTabBtn.click();
            await new Promise(resolve => setTimeout(resolve, 2000));
            reviewsPanelOpened = true;
        }
        // 2. Wait for review elements to appear
        let reviewsVisible = false;
        try {
            await page.waitForSelector('.jftiEf, .MyEned, div.section-review-content, div[jscontroller="e6Mltc"]', { timeout: 15000 });
            reviewsVisible = true;
        } catch {}
        if (!reviewsPanelOpened && !reviewsVisible) {
            // Try previous fallback selectors/buttons
            let reviewsBtn = await page.$('button[jsaction="pane.reviewChart.moreReviews"]');
            if (!reviewsBtn) {
                const btns = await page.$x("//button[contains(., 'All reviews') or contains(., 'reviews') or contains(., 'Reviews')]");
                if (btns && btns.length > 0) reviewsBtn = btns[0];
            }
            if (!reviewsBtn) {
                const abtns = await page.$x("//a[contains(., 'All reviews') or contains(., 'reviews') or contains(., 'Reviews')]");
                if (abtns && abtns.length > 0) reviewsBtn = abtns[0];
            }
            if (!reviewsBtn) {
                reviewsBtn = await page.$('a[href*="reviews"]');
            }
            if (reviewsBtn) {
                await reviewsBtn.click();
                await new Promise(resolve => setTimeout(resolve, 2000));
                reviewsPanelOpened = true;
            }
            // Try waiting again
            try {
                await page.waitForSelector('.jftiEf, .MyEned, div.section-review-content, div[jscontroller="e6Mltc"]', { timeout: 15000 });
                reviewsVisible = true;
            } catch {}
        }
        if (!reviewsVisible) {
            await page.screenshot({ path: 'google_reviews_debug.png' });
            throw new Error('Could not find or open the reviews panel. See google_reviews_debug.png for page state.');
        }
        // 3. Extract reviews from the new structure
        let reviews = await page.evaluate(() => {
            // Try new Google Maps review containers
            const reviewNodes = document.querySelectorAll('.jftiEf');
            if (reviewNodes.length > 0) {
                return Array.from(reviewNodes).map(node => {
                    const username = node.querySelector('.d4r55')?.innerText || '';
                    const review = node.querySelector('.MyEned span')?.innerText || '';
                    const rating = parseFloat(node.querySelector('.kvMYJc[aria-label*="star"]')?.getAttribute('aria-label')?.match(/\d+(\.\d+)?/)?.[0] || '0');
                    const date = node.querySelector('.rsqaWe')?.innerText || '';
                    return { username, review, rating, date };
                });
            }
            // Fallback to previous structure
            const legacyNodes = document.querySelectorAll('div.section-review-content');
            if (legacyNodes.length > 0) {
                return Array.from(legacyNodes).map(node => {
                    const username = node.querySelector('.section-review-title')?.innerText || '';
                    const review = node.querySelector('.section-review-text')?.innerText || '';
                    const rating = parseFloat(node.querySelector('.section-review-stars')?.getAttribute('aria-label')?.match(/\d+(\.\d+)?/)?.[0] || '0');
                    const date = node.querySelector('.section-review-publish-date')?.innerText || '';
                    return { username, review, rating, date };
                });
            }
            // Fallback: try .MyEned nodes
            const altNodes = document.querySelectorAll('.MyEned');
            if (altNodes.length > 0) {
                return Array.from(altNodes).map(node => {
                    const username = node.closest('.jftiEf')?.querySelector('.d4r55')?.innerText || '';
                    const review = node.querySelector('span')?.innerText || '';
                    const rating = parseFloat(node.closest('.jftiEf')?.querySelector('.kvMYJc[aria-label*="star"]')?.getAttribute('aria-label')?.match(/\d+(\.\d+)?/)?.[0] || '0');
                    const date = node.closest('.jftiEf')?.querySelector('.rsqaWe')?.innerText || '';
                    return { username, review, rating, date };
                });
            }
            return [];
        });
        // If you want to scroll and load more reviews, you can add scrolling logic here as before.
        // For now, just return the first batch.
        return reviews.slice(0, maxReviews);
    } catch (err) {
        throw new Error('Failed to scrape Google Reviews: ' + err.message);
    } finally {
        if (browser) await browser.close();
    }
}

/**
 * Fetch reviews with sentiment and grouped topic for a page (batch Gemini call, paginated, no full cache)
 * @param {string} placeUrl - Google Maps place URL
 * @param {number} maxReviews - Page size
 * @param {number} page - Page number (1-based)
 * @returns {Promise<Array<{username, review, rating, date, sentiment, topic}>>}
 */
async function fetchAllGoogleReviewsWithSentiment(placeUrl, maxReviews = 100, page = 1) {
    // Scrape only up to the end of the requested page
    const end = page * maxReviews;
    const allReviews = await fetchAllGoogleReviews(placeUrl, end);
    const startIndex = (page - 1) * maxReviews;
    const pageReviews = allReviews.slice(startIndex, startIndex + maxReviews);
    if (pageReviews.length === 0) {
        return [];
    }
    // Flatten all reviews for batch sentiment
    const allTexts = pageReviews.map(r => r.review);
    const sentiments = await GeminiService.analyzeSentimentsBatch(allTexts);

    // --- Topic grouping logic ---
    const allTopics = sentiments.map(s => s.topic && s.topic !== 'Unknown' ? s.topic.trim() : 'Unknown');
    const canonicalTopics = [];
    const topicMap = {};
    const SIMILARITY_THRESHOLD = 0.7;
    allTopics.forEach((topic, idx) => {
        if (topic === 'Unknown') {
            topicMap[idx] = 'Unknown';
            return;
        }
        let found = false;
        for (const canon of canonicalTopics) {
            if (stringSimilarity.compareTwoStrings(topic.toLowerCase(), canon.toLowerCase()) > SIMILARITY_THRESHOLD) {
                topicMap[idx] = canon;
                found = true;
                break;
            }
        }
        if (!found) {
            canonicalTopics.push(topic);
            topicMap[idx] = topic;
        }
    });

    // Map sentiments and canonical topics back to structure
    const result = pageReviews.map((r, i) => ({
        ...r,
        sentiment: sentiments[i]?.sentiment || 'Neutral',
        topic: topicMap[i] || 'Unknown'
    }));
    return result;
}

async function getCachedGoogleReviews(placeUrl) {
    return GoogleReviewCache.findOne({ where: { placeUrl } });
}

async function setCachedGoogleReviews(placeUrl, reviews) {
    return GoogleReviewCache.upsert({ placeUrl, reviews, createdAt: new Date() });
}

module.exports = {
    fetchAllGoogleReviews,
    fetchAllGoogleReviewsWithSentiment,
    getCachedGoogleReviews,
    setCachedGoogleReviews
}; 