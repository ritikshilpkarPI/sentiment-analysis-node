const axios = require('axios');
const cheerio = require('cheerio');

class NewsService {
    static async fetchGoogleNews() {
        try {
            const response = await axios.get('https://news.google.com/rss');
            const $ = cheerio.load(response.data, {
                xmlMode: true
            });

            const articles = [];
            $('item').each((i, elem) => {
                const title = $(elem).find('title').text();
                const link = $(elem).find('link').text();
                const pubDate = $(elem).find('pubDate').text();
                const source = $(elem).find('source').text();

                articles.push({
                    title,
                    link,
                    pubDate,
                    source
                });
            });

            return articles;
        } catch (error) {
            console.error('Error fetching Google News:', error.message);
            throw error;
        }
    }
}

module.exports = NewsService; 