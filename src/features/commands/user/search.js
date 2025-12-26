/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                            SEARCH COMMAND                                     ║
 * ║                  Web Search and Information Retrieval (DuckDuckGo)            ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * Scrapes DuckDuckGo Web Search to provide summaries and links.
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const axios = require("axios");
const cheerio = require("cheerio");

module.exports = {
    config: {
        name: "search",
        aliases: ["google", "bing", "find", "ask"],
        description: "Search the web for information",
        usage: "search <query>",
        category: "utility",
        cooldown: 5,
        permissions: "user",
        enabled: true,
        dmOnly: false,
        groupOnly: false,
    },

    /**
     * Command execution function
     */
    async execute({ api, event, args, config }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const query = args.join(" ");

        if (!query) {
            return api.sendMessage(
                `❌ Please provide a search query.\n\nUsage: ${config.bot.prefix}search <query>`,
                threadID,
                messageID
            );
        }

        try {
            api.setMessageReaction("🔎", messageID, () => {}, true);
            
            // 1. Fetch DuckDuckGo HTML Search Results
            const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                }
            });

            const $ = cheerio.load(response.data);
            const results = [];

            $('.result').each((i, elem) => {
                if (results.length >= 7) return;

                const titleElem = $(elem).find('.result__title a');
                const title = titleElem.text().trim();
                let link = titleElem.attr('href');
                const description = $(elem).find('.result__snippet').text().trim() || "No description available.";

                // Decode DDG link
                if (link && link.includes('uddg=')) {
                    try {
                        const match = link.match(/uddg=([^&]+)/);
                        if (match && match[1]) {
                            link = decodeURIComponent(match[1]);
                        }
                    } catch { /* ignore */ }
                }

                if (title && link && !link.startsWith('/')) {
                    results.push({ title, link, description });
                }
            });

            if (results.length === 0) {
                api.setMessageReaction("❌", messageID, () => {}, true);
                return api.sendMessage("Error: No results found for your query.", threadID, messageID);
            }

            // 3. Format Output
            let message = `WEB SEARCH RESULTS\n`;
            message += `QUERY: ${query.toUpperCase()}\n\n`;
            
            results.forEach((res, index) => {
                let domain = "";
                try {
                    domain = new URL(res.link).hostname.replace('www.', '');
                } catch { domain = "link"; }

                message += `[${index + 1}] ${res.title}\n`;
                message += `Source: ${domain}\n`;
                message += `Summary: ${res.description}\n`;
                message += `URL: ${res.link}\n\n`;
            });
            
            message += `Total results retrieved: ${results.length}`;

            api.setMessageReaction("✅", messageID, () => {}, true);
            return api.sendMessage(message, threadID, messageID);

        } catch (error) {
            console.error("[Search] Error:", error.message);
            api.setMessageReaction("❌", messageID, () => {}, true);
            return api.sendMessage(`❌ Failed to search: ${error.message}`, threadID, messageID);
        }
    }
};
