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
 * Internal helper to perform download attempt
 * @returns {Promise<boolean>} Success status
 */
async function attemptDownload(api, threadID, messageID, query, model, downloadDir, wantsLyrics) {
    let audioPath = null;
    let youtube = null;

    try {
        youtube = await Innertube.create({
            generate_session_locally: true,
        });

        const search = await withRetry(() => youtube.search(query), {
            maxRetries: 2,
            initialDelay: 1000,
            shouldRetry: (error) => error.code === "ECONNRESET" || error.code === "ETIMEDOUT",
        });

        let allVideos = search.results.filter((item) => item.type === "Video").slice(0, 15);

        if (allVideos.length === 0) return false;

        // AI-POWERED CONTENT SCORING (Optional - continue if fails)
        try {
            const videoTitles = allVideos.slice(0, 8).map((v, i) => `${i + 1}. "${v.title.text}" (${v.duration?.text})`).join("\n");
            const scoringPrompt = `Rank these results for "${query}":\n${videoTitles}\nReturn JSON ids: [1, 5, 2]`;
            const scoringResult = await model.generateContent(scoringPrompt);
            const scores = JSON.parse(scoringResult?.response?.text?.().replace(/```json\n?|```\n?/g, "") || "[]");
            if (Array.isArray(scores) && scores.length > 0) {
                 const reordered = scores.map(idx => allVideos[idx-1]).filter(Boolean);
                 allVideos = [...reordered, ...allVideos.filter(v => !reordered.includes(v))];
            }
        } catch { /* Ignore AI sorting errors */ }

        // Find valid video
        let selectedVideo = null;
        for (const video of allVideos) {
            try {
                const info = await youtube.getInfo(video.id);
                const dur = info.basic_info.duration;
                if (dur > 30 && dur <= 600) {
                    selectedVideo = video;
                    break;
                }
            } catch { continue; }
        }

        if (!selectedVideo) return false;

        const videoTitle = selectedVideo.title.text;
        const channelName = selectedVideo.author?.name || "Unknown";
        
        console.log(chalk.cyan(` ├─🎵 Downloading: ${videoTitle} (${query})`));
        
        const sanitizedTitle = videoTitle.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 50);
        audioPath = path.join(downloadDir, `${Date.now()}-${sanitizedTitle}.mp3`);

        // Download loop
        let downloadSuccess = false;
        const qualityOptions = [
            { type: "audio", quality: "best" },
            { type: "audio", quality: "bestefficiency" },
        ];

        for (const options of qualityOptions) {
            try {
                const stream = await youtube.download(selectedVideo.id, options);
                const fileStream = fs.createWriteStream(audioPath);
                for await (const chunk of Utils.streamToIterable(stream)) fileStream.write(chunk);
                fileStream.end();
                await new Promise(resolve => fileStream.on("finish", resolve));
                downloadSuccess = true;
                break;
            } catch { 
                if (fs.existsSync(audioPath)) try { fs.unlinkSync(audioPath); } catch { /* ignore */ }
            }
        }

        if (!downloadSuccess) return false;

        const stats = fs.statSync(audioPath);
        if (stats.size / (1024 * 1024) > 50) {
             fs.unlinkSync(audioPath);
             return false;
        }

        // Lyrics
        if (wantsLyrics) {
            const lyrics = await fetchLyrics(videoTitle, channelName);
            if (lyrics) await api.sendMessage(`📝 **${videoTitle}**\n\n${lyrics}`, threadID);
        }

        // Upload
        api.setMessageReaction("🔃", messageID, () => {}, true);
        await api.sendMessage({
            body: `🎵 ${videoTitle}\n👤 ${channelName}`,
            attachment: fs.createReadStream(audioPath)
        }, threadID);
        
        api.setMessageReaction("✅", messageID, () => {}, true);

        // Cleanup
        setTimeout(() => { if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath); }, 5000);
        return true;

    } catch (error) {
        console.error(`Download helper failed: ${error.message}`);
        if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
        return false;
    }
}

/**
 * Download music from YouTube with Retry Logic
 */
async function downloadMusic(api, threadID, messageID, query, _model, wantsLyrics = false) {
    const model = gemini.createModelProxy();
    const downloadDir = path.join(process.cwd(), "data", "temp");
    if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });

    api.setMessageReaction("⏳", messageID, () => {}, true);

    // Retry Strategy
    const queries = [
        query,                          // Attempt 1: Raw query
        `${query} official audio`,      // Attempt 2: Official Audio
        `${query} lyrics`,              // Attempt 3: Lyrics version (often loads faster/easier)
        query.split(" ").slice(0, 3).join(" ") // Attempt 4: Simplified query
    ];

    for (let i = 0; i < queries.length; i++) {
        const currentQuery = queries[i];
        if (i > 0) console.log(chalk.yellow(` ├─⚠ Retry ${i}: "${currentQuery}"`));
        
        const success = await attemptDownload(api, threadID, messageID, currentQuery, model, downloadDir, wantsLyrics);
        if (success) return;
        
        // Wait briefly between retries
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // All failed
    api.setMessageReaction("❌", messageID, () => {}, true);
    return api.sendMessage("❌ Failed to download music after multiple attempts. Please try a different song name.", threadID, messageID);
}

module.exports = {
    downloadMusic,
};
