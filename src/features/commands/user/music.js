/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                            MUSIC COMMAND                                      ║
 * ║               Search and Download YouTube Music (Beta AI Port)                ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command uses youtubei.js to search and download music, ported from Beta AI.
 *
 * @author 0x3EF8
 * @version 2.2.0
 */

"use strict";

const { Innertube, Utils } = require("youtubei.js");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

// Import Beta AI modules
const { withRetry } = require("../../../utils/retry");

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

        const downloadDir = path.join(process.cwd(), "data", "temp");

        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }

        let audioPath = null;

        try {
            api.setMessageReaction("⏳", messageID, () => {}, true);
           // api.sendMessage(`🔎 Searching for "${query}"...`, threadID, messageID);

            const youtube = await Innertube.create({
                generate_session_locally: true,
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
                return api.sendMessage("❌ No music found for your search query.", threadID, messageID);
            }

            // Find video within duration limit
            let selectedVideo = null;
            let videoTitle = "";
            let channelName = "";

            for (const video of allVideos) {
                try {
                    const info = await youtube.getInfo(video.id);
                    // Check duration: must be between 30s and 600s (10 mins)
                    if (info.basic_info.duration <= 600 && info.basic_info.duration > 30) {
                        selectedVideo = video;
                        videoTitle = selectedVideo.title.text;
                        channelName = selectedVideo.author?.name || "Unknown";
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
            }
            
            const duration = selectedVideo.duration?.text || "Unknown";

            console.log(chalk.cyan(`🎵 Downloading: ${videoTitle}`));
            api.setMessageReaction("⬇️", messageID, () => {}, true);

            const sanitizedTitle = videoTitle.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 100);
            audioPath = path.join(downloadDir, `${Date.now()}-${sanitizedTitle}.mp3`);

            // Download audio
            let downloadSuccess = false;
            const qualityOptions = [
                { type: "audio", quality: "best" },
                { type: "audio", quality: "bestefficiency" },
                { type: "video+audio", quality: "bestefficiency", format: "mp4" },
            ];

            for (const options of qualityOptions) {
                try {
                    const stream = await youtube.download(selectedVideo.id, options);
                    const fileStream = fs.createWriteStream(audioPath);

                    for await (const chunk of Utils.streamToIterable(stream)) {
                        fileStream.write(chunk);
                    }

                    fileStream.end();
                    await new Promise((resolve) => {
                        fileStream.on("finish", resolve);
                    });
                    downloadSuccess = true;
                    break;
                } catch {
                    if (fs.existsSync(audioPath)) {
                        try {
                            fs.unlinkSync(audioPath);
                        } catch { /* ignore */ }
                    }
                    continue;
                }
            }

            if (!downloadSuccess) {
                throw new Error("Download failed with all quality options");
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
                } catch { /* ignore */ }
            }, 5000);

        } catch (error) {
            console.error(chalk.red(`✗ Music command error: ${error.message}`));
            api.setMessageReaction("❌", messageID, () => {}, true);

            if (audioPath && fs.existsSync(audioPath)) {
                try {
                    fs.unlinkSync(audioPath);
                } catch { /* ignore */ }
            }

            return api.sendMessage(
                `❌ Failed to fetch music: ${error.message}`,
                threadID,
                messageID
            );
        }
    }
};

