/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                      MUSIC DOWNLOAD SERVICE MODULE                            ║
 * ║              Handles music downloading from YouTube                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module services/music
 * @author 0x3EF8
 * @version 3.0.0
 *
 * Features:
 * - YouTube music search with AI-powered result scoring
 * - Multi-client download fallback (WEB, IOS, ANDROID, YTMUSIC)
 * - Optional lyrics fetching
 * - Automatic file cleanup
 */

"use strict";

const { Innertube, Utils, Platform } = require("youtubei.js");
const fs = require("fs");
const fsPromises = require("fs").promises;
const path = require("path");

const { gemini } = require("../core/gemini");
const { fetchLyrics } = require("./lyrics");
const { withRetry } = require("../../../../../utils/retry");
const { getTempDirSync } = require("../../../../../utils/paths");
const { MEDIA_CONFIG, REACTIONS, MESSAGES } = require("../core/constants");

// ═══════════════════════════════════════════════════════════════════════════════
// JAVASCRIPT EVALUATOR FOR URL DECIPHERING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Custom JavaScript evaluator for deciphering YouTube URLs
 * Required by youtubei.js to decipher streaming URLs
 */
Platform.shim.eval = (data, env) => {
    const properties = [];
    
    if (env.n) {
        properties.push(`n: exportedVars.nFunction("${env.n}")`);
    }
    
    if (env.sig) {
        properties.push(`sig: exportedVars.sigFunction("${env.sig}")`);
    }
    
    const code = `${data.output}\nreturn { ${properties.join(', ')} }`;
    
    try {
        return new Function(code)();
    } catch (err) {
        console.error('[Music] JS Eval error:', err.message);
        return {};
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL LOGGER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Internal logger - Always enabled for download debugging
 * @private
 */
const log = {
    info: (msg) => console.log(`[Music] ℹ ${msg}`),
    success: (msg) => console.log(`[Music] ✓ ${msg}`),
    warn: (msg) => console.warn(`[Music] ⚠ ${msg}`),
    error: (msg) => console.error(`[Music] ✗ ${msg}`),
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Set message reaction (non-blocking)
 * @param {Object} api - Facebook API
 * @param {string} messageID - Message ID
 * @param {string} reaction - Reaction emoji
 * @private
 */
function react(api, messageID, reaction) {
    api.setMessageReaction(reaction, messageID, () => {}, true);
}

/**
 * Sanitize filename for safe filesystem storage
 * @param {string} title - Video title
 * @returns {string} Sanitized filename
 * @private
 */
function sanitizeFilename(title) {
    return title.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 100);
}

/**
 * Cleanup file asynchronously with delay
 * @param {string} filePath - Path to delete
 * @param {number} [delayMs=5000] - Delay before deletion
 * @private
 */
function scheduleCleanup(filePath, delayMs = 5000) {
    setTimeout(async () => {
        try {
            if (fs.existsSync(filePath)) {
                await fsPromises.unlink(filePath);
                log.info(`Cleaned up: ${path.basename(filePath)}`);
            }
        } catch {
            // Ignore cleanup errors
        }
    }, delayMs);
}

/**
 * Score search results using AI
 * @param {Object} model - Gemini model proxy
 * @param {string} query - Original search query
 * @param {Array} videos - Video results
 * @returns {Promise<Array>} Reordered videos
 * @private
 */
async function scoreResultsWithAI(model, query, videos) {
    try {
        const videoTitles = videos
            .slice(0, 10)
            .map((v, i) => `${i + 1}. "${v.title.text}" by ${v.author?.name || "Unknown"} (${v.duration?.text || "N/A"})`)
            .join("\n");

        const scoringPrompt = `Score these music results for "${query}":\n${videoTitles}\nReturn JSON: [{"index": 1, "score": 95, "reason": "..."}]`;

        const result = await model.generateContent(scoringPrompt);
        const text = result?.response?.text?.();

        if (text) {
            const cleanJson = text.replace(/```json\n?|```\n?/g, "").trim();
            const scores = JSON.parse(cleanJson);
            scores.sort((a, b) => b.score - a.score);

            const reordered = scores.map((s) => videos[s.index - 1]).filter(Boolean);
            log.success("AI ranked results");

            return reordered.concat(videos.filter((v) => !reordered.includes(v)));
        }
    } catch {
        log.warn("AI scoring failed, using default order");
    }

    return videos;
}

/**
 * Find suitable video within duration limits
 * @param {Array} videos - Video candidates
 * @returns {Object|null} Selected video or null
 * @private
 */
function findSuitableVideo(videos) {
    for (const video of videos) {
        try {
            // Use duration from search results first (faster)
            const durationText = video.duration?.text || "";
            const parts = durationText.split(":").map(Number);
            let duration = 0;
            
            if (parts.length === 2) {
                duration = parts[0] * 60 + parts[1];
            } else if (parts.length === 3) {
                duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
            }

            // Accept 10 seconds to 10 minutes
            if (duration >= 10 && duration <= MEDIA_CONFIG.maxDuration) {
                log.info(`Selected: ${video.title.text} (${durationText})`);
                return video;
            }
        } catch (err) {
            log.warn(`Duration parse failed for ${video.id}: ${err.message}`);
            continue;
        }
    }

    // Fallback to first video
    if (videos[0]) {
        log.warn("Using first video as fallback");
        return videos[0];
    }
    return null;
}

/**
 * Download audio with multi-client fallback
 * Uses different YouTube client types to maximize compatibility
 * @param {string} videoId - Video ID
 * @param {string} outputPath - Output file path
 * @returns {Promise<boolean>} Success status
 * @private
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
        {},                         // No client specified
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
            // Create fresh session for each client
            const youtube = await Innertube.create({
                generate_session_locally: true,
                retrieve_player: true,
            });

            for (const qualityOpt of qualityOptions) {
                try {
                    const downloadOpts = { ...qualityOpt, ...clientOpt };
                    log.info(`Trying: ${clientName} / ${qualityOpt.type} / ${qualityOpt.quality}`);

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

                    // Verify file
                    if (fs.existsSync(outputPath)) {
                        const stats = fs.statSync(outputPath);
                        if (stats.size > 5000) { // At least 5KB
                            log.success(`Download success: ${clientName} / ${qualityOpt.quality} (${(stats.size / 1024).toFixed(1)} KB)`);
                            return true;
                        }
                        // File too small, delete and try next
                        fs.unlinkSync(outputPath);
                    }
                } catch (err) {
                    log.warn(`Failed (${clientName}/${qualityOpt.quality}): ${err.message}`);
                    if (fs.existsSync(outputPath)) {
                        try { fs.unlinkSync(outputPath); } catch { /* ignore */ }
                    }
                }
            }
        } catch (err) {
            log.warn(`Client ${clientName} session failed: ${err.message}`);
        }
    }

    return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Download music from YouTube with AI-powered search optimization
 *
 * @param {Object} api - Facebook API instance
 * @param {string} threadID - Thread identifier
 * @param {string} messageID - Message ID for reactions
 * @param {string} query - Search query
 * @param {Object} [_model] - Unused (uses internal gemini)
 * @param {boolean} [wantsLyrics=false] - Whether to fetch lyrics
 * @returns {Promise<void>}
 */
async function downloadMusic(api, threadID, messageID, query, _model, wantsLyrics = false) {
    const model = gemini.createModelProxy();
    const downloadDir = getTempDirSync();
    let audioPath = null;

    try {
        react(api, messageID, REACTIONS.loading);

        // Initialize YouTube client for search
        const youtube = await Innertube.create({
            generate_session_locally: true,
            retrieve_player: true,
        });

        // Search with retry
        log.info(`Searching: "${query}"`);
        const search = await withRetry(() => youtube.search(query), {
            maxRetries: 3,
            initialDelay: 1000,
            shouldRetry: (error) =>
                error.code === "ECONNRESET" ||
                error.code === "ETIMEDOUT" ||
                error.message?.includes("network"),
        });

        let allVideos = search.results
            .filter((item) => item.type === "Video")
            .slice(0, 20);

        if (allVideos.length === 0) {
            react(api, messageID, REACTIONS.error);
            return api.sendMessage(MESSAGES.errors.noResults, threadID, null, messageID);
        }

        log.info(`Found ${allVideos.length} videos`);

        // AI-powered content scoring
        allVideos = await scoreResultsWithAI(model, query, allVideos);

        // Find video within duration limits
        const selectedVideo = findSuitableVideo(allVideos);

        if (!selectedVideo) {
            react(api, messageID, REACTIONS.error);
            return api.sendMessage(MESSAGES.errors.noResults, threadID, null, messageID);
        }

        const videoTitle = selectedVideo.title.text;
        const channelName = selectedVideo.author?.name || "Unknown";
        const videoId = selectedVideo.id;

        log.info(`Downloading: ${videoTitle} (${videoId})`);
        react(api, messageID, REACTIONS.downloading);

        // Prepare file path
        audioPath = path.join(downloadDir, `${Date.now()}-${sanitizeFilename(videoTitle)}.mp3`);

        // Download with multi-client fallback
        const downloadSuccess = await downloadAudioWithFallback(videoId, audioPath);

        if (!downloadSuccess) {
            throw new Error("Download failed with all clients and quality options");
        }

        // Validate file size
        const stats = fs.statSync(audioPath);
        const fileSizeMB = stats.size / (1024 * 1024);

        if (fileSizeMB > MEDIA_CONFIG.maxFileSize) {
            fs.unlinkSync(audioPath);
            react(api, messageID, REACTIONS.error);
            return api.sendMessage(MESSAGES.errors.fileTooLarge, threadID, null, messageID);
        }

        // Fetch lyrics if requested
        if (wantsLyrics) {
            log.info("Fetching lyrics...");
            const lyrics = await fetchLyrics(videoTitle, channelName);

            if (lyrics) {
                await api.sendMessage(`📝 **${videoTitle}**\n👤 ${channelName}\n\n${lyrics}`, threadID, null, messageID);
            }
        }

        // Upload music
        log.info("Uploading music...");
        react(api, messageID, REACTIONS.uploading);

        await api.sendMessage(
            {
                body: `🎵 ${videoTitle}\n👤 ${channelName}`,
                attachment: fs.createReadStream(audioPath),
            },
            threadID,
            null,
            messageID
        );

        log.success(`Music sent: ${videoTitle.substring(0, 40)}... (${fileSizeMB.toFixed(2)} MB)`);
        react(api, messageID, REACTIONS.success);

        // Schedule cleanup
        scheduleCleanup(audioPath);
    } catch (error) {
        log.error(`Music download error: ${error.message}`);
        react(api, messageID, REACTIONS.error);

        // Cleanup on error
        if (audioPath && fs.existsSync(audioPath)) {
            try {
                fs.unlinkSync(audioPath);
            } catch {
                // Ignore
            }
        }

        return api.sendMessage(MESSAGES.errors.downloadFailed, threadID, null, messageID);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    downloadMusic,
};
