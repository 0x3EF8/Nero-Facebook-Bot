const axios = require("axios");
const cheerio = require("cheerio");

async function testDDG() {
    try {
        const query = "nodejs";
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        console.log(`Fetching: ${url}`);
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        const results = [];

        $('.result').each((i, elem) => {
            const title = $(elem).find('.result__title a').text().trim();
            const link = $(elem).find('.result__title a').attr('href');
            const snippet = $(elem).find('.result__snippet').text().trim();

            if (title && link) {
                results.push({ title, link, snippet });
            }
        });

        console.log(`Found ${results.length} results.`);
        if (results.length > 0) console.log("First:", results[0]);

    } catch (error) {
        console.error("Error:", error.message);
    }
}

testDDG();
