/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                        AUTO DOWNLOADER EVENT                                  ║
 * ║       Wrapper that invokes the working 'dl' command logic                     ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This event handler detects links and forwards them to the existing 'dl' command
 * to ensure consistent behavior and fix duplication bugs.
 *
 * @author 0x3EF8
 * @version 2.0.0
 */

"use strict";

const path = require("path");

// Lazy load the command to avoid circular dependency issues during init
let dlCommand = null;

module.exports = {
    config: {
        name: "autoDownloader",
        description: "Automatically downloads videos using the dl command logic",
        eventTypes: ["message"],
        priority: 10,
        enabled: true,
        category: "media",
    },

    async execute({ api, event, logger, config }) {
        // Ignore self
        if (api.getCurrentUserID && event.senderID === api.getCurrentUserID()) return;

        const body = (event.body || "").trim();
        if (!body.startsWith("http")) return;

        // Specific patterns to trigger on
        const videoPatterns = [
            "facebook.com/share/v/",
            "facebook.com/share/r/",
            "facebook.com/reel/",
            "facebook.com/watch/",
            "fb.watch/",
            "tiktok.com/",
            "instagram.com/reel/",
            "instagram.com/p/",
            "youtube.com/watch",
            "youtu.be/",
            "youtube.com/shorts/",
        ];

        const isVideoLink = videoPatterns.some((pattern) => body.includes(pattern));

        if (!isVideoLink) return;

        const url = body.split(/\s+/)[0];

        logger.info("AutoDownloader", `Delegating ${url} to DL command...`);

        // Load the DL command dynamically and force fresh reload
        try {
            const dlPath = path.resolve(__dirname, "../../commands/user/dl.js");
            // Delete cache to ensure we get the latest version (vital for updates)
            delete require.cache[require.resolve(dlPath)];
            dlCommand = require(dlPath);
        } catch (err) {
            logger.error("AutoDownloader", "Failed to load dl.js: " + err.message);
            return;
        }

        // Mock context for the command
        const mockArgs = [url];

        // We need a mock config object that matches what dl.js expects
        // dl.js uses config.bot.prefix in error messages, but since we are providing args,
        // it shouldn't trigger the "Please provide a URL" error.
        const mockContext = {
            api,
            event,
            args: mockArgs,
            config: config, // Pass the global config
            logger,
        };

        // Retry logic - keep trying until successful or max retries reached
        const maxRetries = 5;
        const baseDelay = 2000; // 2 seconds

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await dlCommand.execute(mockContext);
                logger.success("AutoDownloader", `Download successful on attempt ${attempt}`);
                return; // Success, exit the function
            } catch (error) {
                logger.warn("AutoDownloader", `Attempt ${attempt}/${maxRetries} failed: ${error.message}`);
                
                if (attempt < maxRetries) {
                    const delay = baseDelay * attempt; // Progressive delay: 2s, 4s, 6s
                    logger.info("AutoDownloader", `Retrying in ${delay / 1000}s...`);
                    await new Promise(resolve => { setTimeout(resolve, delay); });
                } else {
                    logger.error("AutoDownloader", `All ${maxRetries} attempts failed for: ${url}`);
                }
            }
        }
    },
};
