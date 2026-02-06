/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                            MUSIC COMMAND                                      ║
 * ║               Search and Download YouTube Music (Beta AI Port)                ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command uses youtubei.js to search and download music with multi-client fallback.
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
 * Download audio with multi-client fallback
 * @param {string} videoId - Video ID
 * @param {string} outputPath - Output file path
 * @returns {Promise<boolean>} Success status
 */
async function downloadAudioWithFallback(videoId, outputPath) {
    // Client options to try (in order of preference for audio)
    // IOS first - confirmed working best for downloads
    const clientOptions = [
        { client: "IOS" },          // BEST - confirmed working
        { client: "ANDROID" },      // Good alternative
        { client: "TV_EMBEDDED" },  // Embedded player
        { client: "YTMUSIC" },      // Music client
        { client: "WEB" },          // Web fallback
        {},
    ];

    // Quality options for each client
    const qualityOptions = [
        { type: "audio", quality: "best" },
        { type: "audio", quality: "bestefficiency" },
        { type: "video+audio", quality: "bestefficiency", format: "mp4" },
        { type: "video+audio", quality: "360p", format: "mp4" },
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
                        if (stats.size > 5000) {
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

module.exports = {
    config: {
        name: "music",
        aliases: ["play", "song", "mp3", "audio"],
        description: "Search and download music from YouTube",
        usage: "music <search query>",
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
                `❌ Please provide a search query.\n\nUsage: ${config.bot.prefix}music <query>`,
                threadID,
                messageID
            );
        }

        const downloadDir = getTempDirSync();

        let audioPath = null;

        try {
            api.setMessageReaction("⏳", messageID, () => {}, true);
            // api.sendMessage(`🔎 Searching for "${query}"...`, threadID, messageID);

            const youtube = await Innertube.create({
                generate_session_locally: true,
                retrieve_player: true,
            });

            // Search with retry
            const search = await withRetry(() => youtube.search(query), {
                maxRetries: 3,
                initialDelay: 1000,
                shouldRetry: (error) =>
                    error.code === "ECONNRESET" ||
                    error.code === "ETIMEDOUT" ||
                    error.message?.includes("network"),
            });

            const allVideos = search.results.filter((item) => item.type === "Video").slice(0, 20);

            if (allVideos.length === 0) {
                api.setMessageReaction("❌", messageID, () => {}, true);
                return api.sendMessage(
                    "❌ No music found for your search query.",
                    threadID,
                    messageID
                );
            }

            // Find video within duration limit using search result duration
            let selectedVideo = null;
            let videoTitle = "";
            let channelName = "";
            let duration = "Unknown";

            for (const video of allVideos) {
                try {
                    const durationText = video.duration?.text || "";
                    const parts = durationText.split(":").map(Number);
                    let dur = 0;
                    
                    if (parts.length === 2) dur = parts[0] * 60 + parts[1];
                    else if (parts.length === 3) dur = parts[0] * 3600 + parts[1] * 60 + parts[2];

                    if (dur >= 10 && dur <= 600) {
                        selectedVideo = video;
                        videoTitle = video.title.text;
                        channelName = video.author?.name || "Unknown";
                        duration = durationText;
                        console.log(chalk.green(`✓ Found: ${videoTitle}`));
                        break;
                    }
                } catch {
                    continue;
                }
            }

            if (!selectedVideo) {
                selectedVideo = allVideos[0];
                videoTitle = selectedVideo.title.text;
                channelName = selectedVideo.author?.name || "Unknown";
                duration = selectedVideo.duration?.text || "Unknown";
            }

            console.log(chalk.cyan(`🎵 Downloading: ${videoTitle}`));
            api.setMessageReaction("⬇️", messageID, () => {}, true);

            const sanitizedTitle = videoTitle.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 100);
            audioPath = path.join(downloadDir, `${Date.now()}-${sanitizedTitle}.mp3`);

            // Download with multi-client fallback
            const downloadSuccess = await downloadAudioWithFallback(selectedVideo.id, audioPath);

            if (!downloadSuccess) {
                throw new Error("Download failed with all clients and quality options");
            }

            const stats = fs.statSync(audioPath);
            const fileSizeMB = stats.size / (1024 * 1024);

            if (fileSizeMB > 50) {
                fs.unlinkSync(audioPath);
                api.setMessageReaction("❌", messageID, () => {}, true);
                return api.sendMessage(
                    `⚠️ Audio file too large (${fileSizeMB.toFixed(2)} MB). Max: 50 MB`,
                    threadID,
                    messageID
                );
            }

            console.log(chalk.cyan(`🔃 Uploading music...`));
            api.setMessageReaction("🔃", messageID, () => {}, true);

            // Send music and text in a single message
            await api.sendMessage(
                {
                    body: `🎵 ${videoTitle}\n👤 ${channelName}\n⏱️ ${duration}`,
                    attachment: fs.createReadStream(audioPath),
                },
                threadID,
                messageID
            );

            console.log(
                chalk.green(
                    `✓ Music sent: ${videoTitle.substring(0, 40)}... (${fileSizeMB.toFixed(2)} MB)`
                )
            );
            api.setMessageReaction("✅", messageID, () => {}, true);

            // Cleanup
            setTimeout(() => {
                try {
                    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
                } catch {
                    /* ignore */
                }
            }, 5000);
        } catch (error) {
            console.error(chalk.red(`✗ Music command error: ${error.message}`));
            api.setMessageReaction("❌", messageID, () => {}, true);

            if (audioPath && fs.existsSync(audioPath)) {
                try {
                    fs.unlinkSync(audioPath);
                } catch {
                    /* ignore */
                }
            }

            return api.sendMessage(
                `❌ Failed to fetch music: ${error.message}`,
                threadID,
                messageID
            );
        }
    },
};
