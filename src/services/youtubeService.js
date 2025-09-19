const puppeteer = require('puppeteer');
const GeminiService = require('./geminiService');
const { YoutubeCommentCache } = require('../models');
const stringSimilarity = require('string-similarity');

// Ensure the table exists (sync at runtime)
YoutubeCommentCache.sync();

/**
 * Fetch comments, usernames, likes, and replies from a YouTube video using Puppeteer (headless browser)
 * @param {string} videoUrl - YouTube video URL
 * @param {number} [maxComments=200] - Maximum number of comments to fetch
 * @returns {Promise<Array<{username: string, comment: string, likes: string, replies: Array<{username: string, comment: string, likes: string}>}>>}
 */
async function fetchAllYoutubeComments(videoUrl, maxComments = 200) {
    if (!videoUrl || typeof videoUrl !== 'string') {
        throw new Error('Invalid YouTube video URL');
    }
    // Handle YouTube Shorts URLs
    const shortsMatch = videoUrl.match(/youtube\.com\/shorts\/([\w-]{11})/);
    if (shortsMatch) {
        const videoId = shortsMatch[1];
        videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        console.log(`[Scraper] Converted Shorts URL to watch URL: ${videoUrl}`);
    }
    if (!videoUrl.includes('youtube.com/watch')) {
        throw new Error('Invalid YouTube video URL');
    }
    let browser;
    try {
        browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        // Set a real Chrome user-agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Retry navigation up to 3 times
        let navSuccess = false;
        let navError = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                console.log(`[Puppeteer] Navigating to ${videoUrl} (attempt ${attempt})`);
                await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 60000 });
                navSuccess = true;
                break;
            } catch (err) {
                navError = err;
                console.error(`[Puppeteer] Navigation attempt ${attempt} failed:`, err.message);
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, 3000)); // wait 3s before retry
                }
            }
        }
        if (!navSuccess) {
            throw new Error('Failed to navigate to YouTube page: ' + navError.message);
        }

        // Wait for comments section to load
        await page.waitForSelector('ytd-comments', { timeout: 15000 });
        await new Promise(resolve => setTimeout(resolve, 2000));

        let comments = [];
        let lastHeight = 0;
        let scrollTries = 0;
        let lastCommentsCount = 0;
        let noNewCommentsTries = 0;
        while (comments.length < maxComments && scrollTries < 50) {
            // Scroll to load more comments
            lastHeight = await page.evaluate('document.documentElement.scrollHeight');
            await page.evaluate('window.scrollTo(0, document.documentElement.scrollHeight)');
            await new Promise(resolve => setTimeout(resolve, 3000));
            let newHeight = await page.evaluate('document.documentElement.scrollHeight');
            // Extract comments, usernames, likes, and replies
            comments = await page.evaluate(() => {
                const commentNodes = document.querySelectorAll('ytd-comment-thread-renderer');
                return Array.from(commentNodes).map(node => {
                    const comment = node.querySelector('#content #content-text')?.innerText || '';
                    const username = node.querySelector('#author-text span')?.innerText || '';
                    const likes = node.querySelector('#vote-count-middle')?.innerText.trim() || '0';
                    // Extract replies
                    const replyNodes = node.querySelectorAll('ytd-comment-replies-renderer #expander-contents ytd-comment-renderer');
                    const replies = Array.from(replyNodes).map(replyNode => {
                        const replyComment = replyNode.querySelector('#content #content-text')?.innerText || '';
                        const replyUsername = replyNode.querySelector('#author-text span')?.innerText || '';
                        const replyLikes = replyNode.querySelector('#vote-count-middle')?.innerText.trim() || '0';
                        return { username: replyUsername, comment: replyComment, likes: replyLikes };
                    });
                    return { username, comment, likes, replies };
                });
            });
            console.log(`[Scraper] Scroll iteration: ${scrollTries}, comments fetched: ${comments.length}`);
            if (comments.length === lastCommentsCount) {
                noNewCommentsTries++;
            } else {
                noNewCommentsTries = 0;
            }
            lastCommentsCount = comments.length;
            if (noNewCommentsTries >= 3) {
                console.log('[Scraper] No new comments loaded for 3 consecutive scrolls. Breaking early.');
                break;
            }
            if (newHeight === lastHeight) {
                scrollTries++;
            } else {
                scrollTries = 0;
            }
        }

        // Click all 'View replies' buttons to load replies
        const viewRepliesButtons = await page.$$('ytd-comment-thread-renderer #replies #more-replies, ytd-comment-thread-renderer #replies ytd-button-renderer');
        for (const btn of viewRepliesButtons) {
            try {
                await btn.click();
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (e) {
                // Ignore errors if button is not clickable
            }
        }

        // After loading replies, extract comments again (with replies loaded)
        comments = await page.evaluate(() => {
            const commentNodes = document.querySelectorAll('ytd-comment-thread-renderer');
            return Array.from(commentNodes).map(node => {
                const comment = node.querySelector('#content #content-text')?.innerText || '';
                const username = node.querySelector('#author-text span')?.innerText || '';
                const likes = node.querySelector('#vote-count-middle')?.innerText.trim() || '0';
                // Extract replies
                const replyNodes = node.querySelectorAll('ytd-comment-replies-renderer #expander-contents ytd-comment-renderer');
                const replies = Array.from(replyNodes).map(replyNode => {
                    const replyComment = replyNode.querySelector('#content #content-text')?.innerText || '';
                    const replyUsername = replyNode.querySelector('#author-text span')?.innerText || '';
                    const replyLikes = replyNode.querySelector('#vote-count-middle')?.innerText.trim() || '0';
                    return { username: replyUsername, comment: replyComment, likes: replyLikes };
                });
                return { username, comment, likes, replies };
            });
        });
        console.log(`[Scraper] Total comments fetched before return: ${comments.length}`);
        return comments.slice(0, maxComments);
    } catch (err) {
        throw new Error('Failed to scrape YouTube comments: ' + err.message);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * Fetch comments with sentiment and grouped topic for a page (batch Gemini call, paginated, no full cache)
 * @param {string} videoUrl - YouTube video URL
 * @param {number} maxComments - Page size
 * @param {number} page - Page number (1-based)
 * @returns {Promise<Array<{username, comment, likes, sentiment, topic, replies}>}>}
 */
async function fetchAllYoutubeCommentsWithSentiment(videoUrl, maxComments = 200, page = 1) {
    // Scrape only up to the end of the requested page
    const end = page * maxComments;
    const allComments = await fetchAllYoutubeComments(videoUrl, end);
    const startIndex = (page - 1) * maxComments;
    const pageComments = allComments.slice(startIndex, startIndex + maxComments);
    if (pageComments.length === 0) {
        return [];
    }
    // Flatten all comments and replies for batch sentiment
    const allTexts = [];
    const mapIndex = [];
    pageComments.forEach((c, i) => {
        allTexts.push(c.comment);
        mapIndex.push({ type: 'comment', i });
        (c.replies || []).forEach((r, j) => {
            allTexts.push(r.comment);
            mapIndex.push({ type: 'reply', i, j });
        });
    });
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
    let k = 0;
    const result = pageComments.map((c, i) => {
        const commentSentiment = sentiments[k]?.sentiment || 'Neutral';
        const commentTopic = topicMap[k] || 'Unknown';
        k++;
        const replies = (c.replies || []).map((r, j) => {
            const replySentiment = sentiments[k]?.sentiment || 'Neutral';
            const replyTopic = topicMap[k] || 'Unknown';
            k++;
            return { ...r, sentiment: replySentiment, topic: replyTopic };
        });
        return { ...c, sentiment: commentSentiment, topic: commentTopic, replies };
    });
    return result;
}

async function getCachedComments(videoUrl) {
    return YoutubeCommentCache.findOne({ where: { videoUrl } });
}

async function setCachedComments(videoUrl, comments) {
    return YoutubeCommentCache.upsert({ videoUrl, comments, createdAt: new Date() });
}

async function fetchInstagramReelComments(reelUrl, maxComments = 100) {
    if (!reelUrl || typeof reelUrl !== 'string' || !reelUrl.includes('instagram.com/reel/')) {
        throw new Error('Invalid Instagram Reel URL');
    }
    let browser;
    try {
        browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.goto(reelUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for comments section to load
        await page.waitForSelector('ul > li > div > div > div > div > span', { timeout: 15000 });

        let comments = [];
        let lastCommentsCount = 0;
        let noNewCommentsTries = 0;
        let scrollTries = 0;
        while (comments.length < maxComments && scrollTries < 30) {
            // Extract comments
            const newComments = await page.evaluate(() => {
                const commentNodes = document.querySelectorAll('ul > li > div > div > div > div > span');
                const userNodes = document.querySelectorAll('ul > li > div > div > div > h3 > div > span > a');
                return Array.from(commentNodes).map((node, i) => ({
                    username: userNodes[i]?.innerText || '',
                    comment: node.innerText || ''
                }));
            });
            comments = newComments;
            if (comments.length === lastCommentsCount) {
                noNewCommentsTries++;
            } else {
                noNewCommentsTries = 0;
            }
            lastCommentsCount = comments.length;
            if (noNewCommentsTries >= 3) break;
            // Scroll to load more comments
            await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
            await new Promise(resolve => setTimeout(resolve, 2000));
            scrollTries++;
        }
        return comments.slice(0, maxComments);
    } catch (err) {
        throw new Error('Failed to scrape Instagram Reel comments: ' + err.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = {
    fetchAllYoutubeComments,
    fetchAllYoutubeCommentsWithSentiment,
    getCachedComments,
    setCachedComments,
    fetchInstagramReelComments
}; 