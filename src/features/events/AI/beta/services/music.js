/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                      MUSIC DOWNLOAD SERVICE MODULE                            ║
 * ║              Handles music downloading from YouTube                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module services/music
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const { Innertube, Utils } = require("youtubei.js");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const { gemini } = require("../core/gemini");
const { fetchLyrics } = require("./lyrics");
const { withRetry } = require("../../../../../utils/retry");

/**
 * Download music from YouTube
 * @param {Object} api - Facebook API instance
 * @param {string} threadID - Thread identifier
 * @param {string} messageID - Message ID for reactions
 * @param {string} query - Search query
 * @param {Object} _model - Unused (uses internal gemini)
 * @param {boolean} wantsLyrics - Whether to fetch lyrics
 * @returns {Promise<void>}
 */
async function downloadMusic(api, threadID, messageID, query, _model, wantsLyrics = false) {
    const model = gemini.createModelProxy();
    const downloadDir = path.join(process.cwd(), "data", "temp");

    if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true });
    }

    let audioPath = null;

    try {
        api.setMessageReaction("⏳", messageID, () => {}, true);

        const youtube = await Innertube.create({
            generate_session_locally: true,
        });

        const search = await withRetry(() => youtube.search(query), {
            maxRetries: 3,
            initialDelay: 1000,
            shouldRetry: (error) =>
                error.code === "ECONNRESET" ||
                error.code === "ETIMEDOUT" ||
                error.message?.includes("network"),
        });
        let allVideos = search.results.filter((item) => item.type === "Video").slice(0, 20);

        if (allVideos.length === 0) {
            api.setMessageReaction("❌", messageID, () => {}, true);
            return api.sendMessage("❌ No music found for your search query.", threadID, messageID);
        }

        // AI-POWERED CONTENT SCORING
        console.log(chalk.magenta(`🧠 AI scoring ${allVideos.length} results...`));

        try {
            const videoTitles = allVideos
                .slice(0, 10)
                .map(
                    (v, i) =>
                        `${i + 1}. "${v.title.text}" by ${v.author?.name || "Unknown"} (${v.duration?.text || "N/A"})`
                )
                .join("\n");

            const scoringPrompt = `Score these music results for "${query}":
${videoTitles}
Return JSON: [{"index": 1, "score": 95, "reason": "..."}]`;

            const scoringResult = await model.generateContent(scoringPrompt);
            const scoringText = scoringResult?.response?.text?.();

            if (scoringText) {
                const cleanJson = scoringText.replace(/```json\n?|```\n?/g, "").trim();
                const scores = JSON.parse(cleanJson);
                scores.sort((a, b) => b.score - a.score);
                const reordered = scores.map((s) => allVideos[s.index - 1]).filter((v) => v);
                allVideos = reordered.concat(allVideos.filter((v) => !reordered.includes(v)));
                console.log(chalk.green(`✓ AI ranked results`));
            }
        } catch {
            console.warn(chalk.yellow("⚠ AI scoring failed, using default order"));
        }

        // Find video within duration limit
        let selectedVideo = null;
        let videoTitle = "";
        let channelName = "";

        for (const video of allVideos) {
            try {
                const info = await youtube.getInfo(video.id);
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
                    } catch {
                        /* ignore */
                    }
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

        // Fetch lyrics if requested
        if (wantsLyrics) {
            console.log(chalk.cyan(`📝 Fetching lyrics...`));
            const lyrics = await fetchLyrics(videoTitle, channelName);

            if (lyrics) {
                await api.sendMessage(
                    `📝 **${videoTitle}**\n👤 ${channelName}\n\n${lyrics}`,
                    threadID
                );
            }
        }

        console.log(chalk.cyan(`🔃 Uploading music...`));
        api.setMessageReaction("🔃", messageID, () => {}, true);

        // Send music
        await api.sendMessage(
            {
                body: `🎵 ${videoTitle}\n👤 ${channelName}`,
                attachment: fs.createReadStream(audioPath),
            },
            threadID
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
        console.error(chalk.red(`✗ Music download error: ${error.message}`));
        api.setMessageReaction("❌", messageID, () => {}, true);

        if (audioPath && fs.existsSync(audioPath)) {
            try {
                fs.unlinkSync(audioPath);
            } catch {
                /* ignore */
            }
        }

        return api.sendMessage(
            "❌ Error downloading music. Try a different search query.",
            threadID,
            messageID
        );
    }
}

module.exports = {
    downloadMusic,
};