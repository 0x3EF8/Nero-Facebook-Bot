/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                            IMAGE COMMAND                                      ║
 * ║                  Search and Download Images via Bing                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * Scrapes Bing Images for high-quality results.
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

module.exports = {
    config: {
        name: "image",
        aliases: ["img", "pic", "picture"],
        description: "Search for images on the web",
        usage: "image <query> [count]",
        category: "media",
        cooldown: 10,
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

        // Parse args: last arg might be a number for count
        let count = 6; // Default count
        let query = args.join(" ");

        if (args.length > 1 && !isNaN(args[args.length - 1])) {
            count = parseInt(args[args.length - 1]);
            if (count > 35) count = 35; // Max 35 images
            if (count < 1) count = 1;
            query = args.slice(0, -1).join(" ");
        }

        if (!query) {
            return api.sendMessage(
                `❌ Please provide a search query.\n\nUsage: ${config.bot.prefix}image <query> [count]`,
                threadID,
                messageID
            );
        }

        const downloadDir = path.join(process.cwd(), "data", "temp");
        if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });

        try {
            api.setMessageReaction("🔎", messageID, () => { }, true);
            //  api.sendMessage(`🔎 Searching images for "${query}"...`, threadID, messageID);

            // Scrape Bing Images (General Search)
            const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=1`;

            const response = await axios.get(url, {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
                },
            });

            const $ = cheerio.load(response.data);
            const imageUrls = [];

            $("a.iusc").each((i, elem) => {
                const m = $(elem).attr("m");
                if (m) {
                    try {
                        const parsed = JSON.parse(m);
                        if (parsed.murl && !imageUrls.includes(parsed.murl)) {
                            imageUrls.push(parsed.murl);
                        }
                    } catch {
                        /* ignore */
                    }
                }
            });

            if (imageUrls.length === 0) {
                api.setMessageReaction("❌", messageID, () => { }, true);
                return api.sendMessage("❌ No images found.", threadID, messageID);
            }

            // Shuffle results to give variety
            const shuffled = imageUrls.sort(() => 0.5 - Math.random());
            const selectedImages = shuffled.slice(0, count);

            api.setMessageReaction("⬇️", messageID, () => { }, true);

            // Download all selected images
            const attachments = [];
            const filesToDelete = [];

            for (let i = 0; i < selectedImages.length; i++) {
                try {
                    const imgUrl = selectedImages[i];
                    // Guess extension or default to .jpg
                    let ext = path.extname(imgUrl).split("?")[0] || ".jpg";
                    if (![".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext.toLowerCase())) {
                        ext = ".jpg";
                    }

                    const filename = `${Date.now()}_${i}${ext}`;
                    const filePath = path.join(downloadDir, filename);

                    const imgResponse = await axios({
                        url: imgUrl,
                        method: "GET",
                        responseType: "stream",
                        timeout: 5000, // 5s timeout per image
                    });

                    const writer = fs.createWriteStream(filePath);
                    imgResponse.data.pipe(writer);

                    await new Promise((resolve, reject) => {
                        writer.on("finish", resolve);
                        writer.on("error", reject);
                    });

                    // Check file size (0 byte files check)
                    const stats = fs.statSync(filePath);
                    if (stats.size > 0) {
                        attachments.push(fs.createReadStream(filePath));
                        filesToDelete.push(filePath);
                    } else {
                        fs.unlinkSync(filePath);
                    }
                } catch {
                    // console.error(`Failed to download image ${i}: ${err.message}`);
                }
            }

            if (attachments.length === 0) {
                return api.sendMessage(
                    "❌ Failed to download images. Please try again.",
                    threadID,
                    messageID
                );
            }

            api.setMessageReaction("✅", messageID, () => { }, true);

            // Send messages
            await api.sendMessage(
                {
                    body: `🖼️ Image results for: ${query}`,
                    attachment: attachments,
                },
                threadID,
                messageID
            );

            // Cleanup
            setTimeout(() => {
                filesToDelete.forEach((f) => {
                    try {
                        if (fs.existsSync(f)) fs.unlinkSync(f);
                    } catch {
                        /* ignore */
                    }
                });
            }, 5000 * 60); // 5 mins
        } catch (error) {
            console.error("[Image] Error:", error.message);
            api.setMessageReaction("❌", messageID, () => { }, true);
            return api.sendMessage(`❌ An error occurred: ${error.message}`, threadID, messageID);
        }
    },
};
