/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                            VIDEO COMMAND                                      ║
 * ║               Search and Download YouTube Videos (Beta AI Port)               ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command uses youtubei.js to search and download videos with multi-client fallback.
 *
 * @author 0x3EF8
 * @version 3.0.0
 */

"use strict";

const { Innertube, Utils, Platform } = require("youtubei.js");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

// Import utilities
const { withRetry } = require("../../../utils/retry");
const { getTempDirSync, scheduleDelete } = require("../../../utils/paths");

// ═══════════════════════════════════════════════════════════════════════════════
// JAVASCRIPT EVALUATOR FOR URL DECIPHERING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Custom JavaScript evaluator for deciphering YouTube URLs
 */
Platform.shim.eval = (data, env) => {
    const properties = [];
    if (env.n) properties.push(`n: exportedVars.nFunction("${env.n}")`);
    if (env.sig) properties.push(`sig: exportedVars.sigFunction("${env.sig}")`);
    const code = `${data.output}\nreturn { ${properties.join(', ')} }`;
    try { return new Function(code)(); } catch { return {}; }
};

/**
 * Download video with multi-client fallback
 * @param {string} videoId - Video ID
 * @param {string} outputPath - Output file path
 * @returns {Promise<boolean>} Success status
 */
async function downloadVideoWithFallback(videoId, outputPath) {
    // Client options to try (in order of preference for video)
    // IOS first - confirmed working best for downloads
    const clientOptions = [
        { client: "IOS" },          // BEST - confirmed working
        { client: "ANDROID" },      // Good alternative
        { client: "TV_EMBEDDED" },  // Embedded player
        { client: "WEB" },          // Web fallback
        {},
    ];

    // Quality options for each client
    const qualityOptions = [
        { type: "video+audio", quality: "360p", format: "mp4" },
        { type: "video+audio", quality: "480p", format: "mp4" },
        { type: "video+audio", quality: "bestefficiency", format: "mp4" },
        { type: "video+audio", quality: "720p", format: "mp4" },
    ];

    for (const clientOpt of clientOptions) {
        const clientName = clientOpt.client || "DEFAULT";
        
        try {
            const youtube = await Innertube.create({
                generate_session_locally: true,
                retrieve_player: true,
            });

            for (const qualityOpt of qualityOptions) {
                try {
                    const downloadOpts = { ...qualityOpt, ...clientOpt };
                    console.log(chalk.gray(`  Trying: ${clientName} / ${qualityOpt.quality}`));

                    const stream = await youtube.download(videoId, downloadOpts);
                    const fileStream = fs.createWriteStream(outputPath);

                    for await (const chunk of Utils.streamToIterable(stream)) {
                        fileStream.write(chunk);
                    }

                    fileStream.end();
                    await new Promise((resolve, reject) => {
                        fileStream.on("finish", resolve);
                        fileStream.on("error", reject);
                    });

                    if (fs.existsSync(outputPath)) {
                        const stats = fs.statSync(outputPath);
                        if (stats.size > 50000) { // At least 50KB for video
                            console.log(chalk.green(`  ✓ Success: ${clientName} / ${qualityOpt.quality}`));
                            return true;
                        }
                        fs.unlinkSync(outputPath);
                    }
                } catch (err) {
                    if (fs.existsSync(outputPath)) {
                        try { fs.unlinkSync(outputPath); } catch { /* ignore */ }
                    }
                }
            }
        } catch (err) {
            console.log(chalk.yellow(`  ⚠ Client ${clientName} failed`));
        }
    }

    return false;
}

// Helper function for video download
async function attemptVideoDownload(api, threadID, messageID, query, downloadDir) {
    let videoPath = null;

    try {
        const youtube = await Innertube.create({ 
            generate_session_locally: true,
            retrieve_player: true,
        });

        const search = await withRetry(() => youtube.search(query), {
            maxRetries: 2,
            initialDelay: 1000,
            shouldRetry: (error) => error.code === "ECONNRESET" || error.code === "ETIMEDOUT",
        });

        const allVideos = search.results.filter((item) => item.type === "Video").slice(0, 15);
        if (allVideos.length === 0) return false;

        // Find video within duration limit using search result duration
        let selectedVideo = null;
        for (const video of allVideos) {
            try {
                const durationText = video.duration?.text || "";
                const parts = durationText.split(":").map(Number);
                let dur = 0;
                
                if (parts.length === 2) dur = parts[0] * 60 + parts[1];
                else if (parts.length === 3) dur = parts[0] * 3600 + parts[1] * 60 + parts[2];

                if (dur >= 5 && dur <= 600) {
                    selectedVideo = video;
                    break;
                }
            } catch {
                continue;
            }
        }

        if (!selectedVideo) {
            selectedVideo = allVideos[0];
        }

        const videoTitle = selectedVideo.title.text;
        const channelName = selectedVideo.author?.name || "Unknown";
        const duration = selectedVideo.duration?.text || "Unknown";

        console.log(chalk.cyan(`🎬 Downloading: ${videoTitle}`));

        const sanitizedTitle = videoTitle.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 50);
        videoPath = path.join(downloadDir, `${Date.now()}-${sanitizedTitle}.mp4`);

        // Download with multi-client fallback
        const downloadSuccess = await downloadVideoWithFallback(selectedVideo.id, videoPath);

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
