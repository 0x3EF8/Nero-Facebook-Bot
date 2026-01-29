/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                            VIDEO COMMAND                                      ║
 * ║               Search and Download YouTube Videos (Beta AI Port)               ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command uses youtubei.js to search and download videos, ported from Beta AI.
 * Includes retry strategies.
 *
 * @author 0x3EF8
 * @version 2.1.0
 */

"use strict";

const { Innertube, Utils } = require("youtubei.js");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

// Import utilities
const { withRetry } = require("../../../utils/retry");
const { getTempDirSync, scheduleDelete } = require("../../../utils/paths");

// Helper function for video download
async function attemptVideoDownload(api, threadID, messageID, query, downloadDir) {
    let videoPath = null;
    let youtube = null;

    try {
        youtube = await Innertube.create({ generate_session_locally: true });

        const search = await withRetry(() => youtube.search(query), {
            maxRetries: 2,
            initialDelay: 1000,
            shouldRetry: (error) => error.code === "ECONNRESET" || error.code === "ETIMEDOUT",
        });

        const allVideos = search.results.filter((item) => item.type === "Video").slice(0, 15);
        if (allVideos.length === 0) return false;

        // Find video within duration limit (10 minutes)
        let selectedVideo = null;
        for (const video of allVideos) {
            try {
                const info = await youtube.getInfo(video.id);
                const dur = info.basic_info.duration;
                if (dur > 0 && dur <= 600) {
                    // Max 10 mins
                    selectedVideo = video;
                    break;
                }
            } catch {
                continue;
            }
        }

        if (!selectedVideo) return false;

        const videoTitle = selectedVideo.title.text;
        const channelName = selectedVideo.author?.name || "Unknown";
        const duration = selectedVideo.duration?.text || "Unknown";

        console.log(chalk.cyan(`🎬 Downloading: ${videoTitle}`));

        const sanitizedTitle = videoTitle.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 50);
        videoPath = path.join(downloadDir, `${Date.now()}-${sanitizedTitle}.mp4`);

        // Download loop
        let downloadSuccess = false;
        const qualityOptions = [
            { type: "video+audio", quality: "360p", format: "mp4" },
            { type: "video+audio", quality: "bestefficiency", format: "mp4" },
        ];

        for (const options of qualityOptions) {
            try {
                const stream = await youtube.download(selectedVideo.id, options);
                const fileStream = fs.createWriteStream(videoPath);
                for await (const chunk of Utils.streamToIterable(stream)) fileStream.write(chunk);
                fileStream.end();
                await new Promise((resolve) => {
                    fileStream.on("finish", resolve);
                });
                downloadSuccess = true;
                break;
            } catch {
                if (fs.existsSync(videoPath)) {
                    try {
                        fs.unlinkSync(videoPath);
                    } catch {
                        /* ignore */
                    }
                }
            }
        }

        if (!downloadSuccess) return false;

        const stats = fs.statSync(videoPath);
        if (stats.size / (1024 * 1024) > 50) {
            fs.unlinkSync(videoPath);
            return false;
        }

        // Upload
        api.setMessageReaction("🔃", messageID, () => { }, true);
        await api.sendMessage(
            {
                body: `🎬 ${videoTitle}\n👤 ${channelName}\n⏱️ ${duration}`,
                attachment: fs.createReadStream(videoPath),
            },
            threadID,
            messageID
        );

        api.setMessageReaction("✅", messageID, () => { }, true);
        console.log(chalk.green(`✓ Video sent: ${videoTitle}`));

        // Cleanup
        setTimeout(() => {
            if (fs.existsSync(videoPath)) {
                fs.unlinkSync(videoPath);
            }
        }, 5000);
        return true;
    } catch (error) {
        console.error(`Video download helper failed: ${error.message}`);
        if (videoPath && fs.existsSync(videoPath)) {
            try {
                fs.unlinkSync(videoPath);
            } catch {
                /* ignore */
            }
        }
        return false;
    }
}

module.exports = {
    config: {
        name: "video",
        aliases: ["yt", "vid", "playvideo"],
        description: "Search and download a video from YouTube",
        usage: "video <search query>",
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
        const query = args.join(" ");

        if (!query) {
            return api.sendMessage(
                `❌ Please provide a search query.\n\nUsage: ${config.bot.prefix}video <query>`,
                threadID,
                messageID
            );
        }

        const downloadDir = getTempDirSync();

        api.setMessageReaction("⏳", messageID, () => { }, true);
        // api.sendMessage(`🔎 Searching for "${query}"...`, threadID, messageID);

        // Retry Strategy
        const queries = [
            query, // Attempt 1: Raw query
            `${query} short`, // Attempt 2: Short version
            `${query} clip`, // Attempt 3: Clip
        ];

        // Deduplicate queries
        const uniqueQueries = [...new Set(queries)];

        for (let i = 0; i < uniqueQueries.length; i++) {
            const currentQuery = uniqueQueries[i];
            if (i > 0) console.log(chalk.yellow(`⚠ Retry ${i}: "${currentQuery}"`));

            const success = await attemptVideoDownload(
                api,
                threadID,
                messageID,
                currentQuery,
                downloadDir
            );
            if (success) return;

            await new Promise((resolve) => {
                setTimeout(resolve, 1000);
            });
        }

        // All failed
        api.setMessageReaction("❌", messageID, () => { }, true);
        return api.sendMessage(
            "❌ Failed to download video after multiple attempts.",
            threadID,
            messageID
        );
    },
};
