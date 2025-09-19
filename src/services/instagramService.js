const puppeteer = require('puppeteer');
const GeminiService = require('./geminiService');
const { InstagramCommentCache } = require('../models');
const stringSimilarity = require('string-similarity');

// Ensure the table exists (sync at runtime)
InstagramCommentCache.sync();

async function fetchInstagramReelComments(reelUrl, maxComments = 100) {
  if (
    !reelUrl ||
    typeof reelUrl !== 'string' ||
    !/instagram\.com\/reel\//.test(reelUrl)
  ) {
    throw new Error('Invalid Instagram Reel URL');
  }

  let browser;
  try {
    // 1) Launch & login
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/120.0.0.0 Safari/537.36'
    );

    // Go to the login page
    await page.goto('https://www.instagram.com/accounts/login/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await page.waitForSelector('input[name="username"]', { timeout: 60000 });
    await page.type('input[name="username"]', process.env.INSTAGRAM_USERNAME, { delay: 50 });
    await page.type('input[name="password"]', process.env.INSTAGRAM_PASSWORD, { delay: 50 });
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });

    // Dismiss popups if they appear
    for (const txt of ['Not Now', 'Save Info']) {
      try {
        const btn = await page.waitForSelector(`button:has-text("${txt}")`, { timeout: 5000 });
        await btn.click();
      } catch {}
    }

    // 2) Let Puppeteer set the instagram.com cookie context
    //    by navigating somewhere on the same domain
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // 3) Extract the Reel shortcode from the URL
    const m = reelUrl.match(/reel\/([^/?]+)/);
    if (!m) throw new Error('Could not extract Reel shortcode from URL');
    const shortcode = m[1];

    // 4) Call the GraphQL comments API in a loop
    const queryHash = '97b41c52301f77ce508f55e66d17620e'; 
    let comments = [];
    let hasNextPage = true;
    let endCursor = null;

    while (comments.length < maxComments && hasNextPage) {
      // Build the variables object
      const variables = { shortcode, first: Math.min(maxComments - comments.length, 50) };
      if (endCursor) variables.after = endCursor;

      // Fetch the JSON from Instagram's GraphQL endpoint
      const result = await page.evaluate(
        async (hash, vars) => {
          const url = `https://www.instagram.com/graphql/query/` +
                      `?query_hash=${hash}` +
                      `&variables=${encodeURIComponent(JSON.stringify(vars))}`;
          const res = await fetch(url, { credentials: 'include' });
          if (!res.ok) throw new Error(`Network error: ${res.status}`);
          return await res.json();
        },
        queryHash,
        variables
      );

      // Drill into the response
      const edge = result?.data?.shortcode_media?.edge_media_to_parent_comment;
      if (!edge) {
        throw new Error('Unexpected GraphQL response structure');
      }

      // Accumulate
      const newComments = edge.edges.map(({ node }) => ({
        username: node.owner.username,
        comment:  node.text,
      }));
      comments.push(...newComments);

      hasNextPage = edge.page_info.has_next_page;
      endCursor   = edge.page_info.end_cursor;
    }

    // Return up to maxComments
    return comments.slice(0, maxComments);

  } catch (err) {
    throw new Error('Failed to scrape Instagram Reel comments: ' + err.message);
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Fetch Instagram Reel comments with sentiment and grouped topic (batch Gemini call)
 * @param {string} reelUrl - Instagram Reel URL
 * @param {number} [maxComments=100]
 * @returns {Promise<Array<{username: string, comment: string, sentiment: string, topic: string}>>}
 */
async function fetchAllInstagramCommentsWithSentiment(reelUrl, maxComments = 100) {
    const comments = await fetchInstagramReelComments(reelUrl, maxComments);
    const allTexts = comments.map(c => c.comment);
    const sentiments = await GeminiService.analyzeSentimentsBatch(allTexts);

    // --- Topic grouping logic (same as YouTube) ---
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
    const result = comments.map((c, i) => ({
        ...c,
        sentiment: sentiments[i]?.sentiment || 'Neutral',
        topic: topicMap[i] || 'Unknown'
    }));
    return result;
}

async function getCachedInstagramComments(reelUrl) {
    return InstagramCommentCache.findOne({ where: { reelUrl } });
}

async function setCachedInstagramComments(reelUrl, comments) {
    return InstagramCommentCache.upsert({ reelUrl, comments, createdAt: new Date() });
}

module.exports = {
    fetchInstagramReelComments,
    fetchAllInstagramCommentsWithSentiment,
    getCachedInstagramComments,
    setCachedInstagramComments
};
