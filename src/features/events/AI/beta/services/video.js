/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                      VIDEO DOWNLOAD SERVICE MODULE                            ║
 * ║              Handles video downloading from YouTube                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module services/video
 * @author 0x3EF8
 * @version 3.0.0
 *
 * Features:
 * - YouTube video search with AI query optimization
 * - Multi-client download fallback (WEB, IOS, ANDROID)
 * - Quality fallback (360p → 480p → 720p → bestefficiency)
 * - Automatic file size validation and cleanup
 */

"use strict";

const { Innertube, Utils, Platform } = require("youtubei.js");
const fs = require("fs");
const fsPromises = require("fs").promises;
const path = require("path");

const { gemini } = require("../core/gemini");
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
        console.error('[Video] JS Eval error:', err.message);
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
    info: (msg) => console.log(`[Video] ℹ ${msg}`),
    success: (msg) => console.log(`[Video] ✓ ${msg}`),
    warn: (msg) => console.warn(`[Video] ⚠ ${msg}`),
    error: (msg) => console.error(`[Video] ✗ ${msg}`),
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
    return title.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 50);
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
 * Sleep helper
 * @param {number} ms - Milliseconds
 * @returns {Promise<void>}
 * @private
 */
function sleep(ms) {
    return new Promise((resolve) => { setTimeout(resolve, ms); });
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOWNLOAD HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Find suitable video within duration limits
 * @param {Array} videos - Video candidates
 * @returns {Object|null} Selected video or null
 * @private
 */
function findSuitableVideo(videos) {
    for (const video of videos) {
        try {
            // Use duration from search results (faster than fetching info)
            const durationText = video.duration?.text || "";
            const parts = durationText.split(":").map(Number);
            let duration = 0;
            
            if (parts.length === 2) {
                duration = parts[0] * 60 + parts[1];
            } else if (parts.length === 3) {
                duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
            }

            // Accept 5 seconds to 10 minutes for videos
            if (duration >= 5 && duration <= MEDIA_CONFIG.maxDuration) {
                log.info(`Selected video: ${video.title.text} (${durationText})`);
                return video;
            }
        } catch (err) {
            log.warn(`Duration parse failed for ${video.id}: ${err.message}`);
            continue;
        }
    }

    // Fallback to first video if none match criteria
    if (videos[0]) {
        log.warn("Using first video as fallback");
        return videos[0];
    }
    return null;
}

/**
 * Download video with multi-client fallback
 * Uses different YouTube client types to maximize compatibility
 * @param {string} videoId - Video ID
 * @param {string} outputPath - Output file path
 * @returns {Promise<boolean>} Success status
 * @private
 */
async function downloadVideoWithFallback(videoId, outputPath) {
    // Client options to try (in order of preference for video)
    // IOS first - confirmed working best for downloads
    const clientOptions = [
        { client: "IOS" },          // BEST - confirmed working
        { client: "ANDROID" },      // Good alternative
        { client: "TV_EMBEDDED" },  // Embedded player
        { client: "WEB" },          // Web fallback
        {},                         // No client specified
    ];

    // Quality options for each client
    const qualityOptions = [
        { type: "video+audio", quality: "360p", format: "mp4" },
        { type: "video+audio", quality: "480p", format: "mp4" },
        { type: "video+audio", quality: "bestefficiency", format: "mp4" },
        { type: "video+audio", quality: "720p", format: "mp4" },
        { type: "video+audio", quality: "best", format: "mp4" },
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
                    log.info(`Trying: ${clientName} / ${qualityOpt.quality}`);

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
                        if (stats.size > 50000) { // At least 50KB for video
                            log.success(`Download success: ${clientName} / ${qualityOpt.quality} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
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

/**
 * Attempt single video download
 * @param {Object} api - Facebook API
 * @param {string} threadID - Thread ID
 * @param {string} messageID - Message ID
 * @param {string} query - Search query
 * @param {string} downloadDir - Download directory
 * @returns {Promise<boolean>} Success status
 * @private
 */
async function attemptVideoDownload(api, threadID, messageID, query, downloadDir) {
    let videoPath = null;

    try {
        const youtube = await Innertube.create({ 
            generate_session_locally: true,
            retrieve_player: true,
        });

        log.info(`Searching: "${query}"`);
        
        const search = await withRetry(() => youtube.search(query), {
            maxRetries: 2,
            initialDelay: 1000,
            shouldRetry: (error) => error.code === "ECONNRESET" || error.code === "ETIMEDOUT",
        });

        const allVideos = search.results.filter((item) => item.type === "Video").slice(0, 15);

        if (allVideos.length === 0) {
            log.warn("No videos found");
            return false;
        }

        log.info(`Found ${allVideos.length} videos`);

        const selectedVideo = findSuitableVideo(allVideos);

        if (!selectedVideo) {
            log.warn("No suitable video found");
            return false;
        }

        const videoTitle = selectedVideo.title.text;
        const channelName = selectedVideo.author?.name || "Unknown";
        const videoId = selectedVideo.id;

        log.info(`Downloading: ${videoTitle} (${videoId})`);

        videoPath = path.join(downloadDir, `${Date.now()}-${sanitizeFilename(videoTitle)}.mp4`);

        const downloadSuccess = await downloadVideoWithFallback(videoId, videoPath);

        if (!downloadSuccess) {
            return false;
        }

        // Validate file size
        const stats = fs.statSync(videoPath);
        const fileSizeMB = stats.size / (1024 * 1024);

        if (fileSizeMB > MEDIA_CONFIG.maxFileSize) {
            log.warn(`File too large: ${fileSizeMB.toFixed(2)} MB`);
            fs.unlinkSync(videoPath);
            return false;
        }

        // Upload video
        log.info("Uploading video...");
        react(api, messageID, REACTIONS.uploading);

        await api.sendMessage(
            {
                body: `🎬 ${videoTitle}\n👤 ${channelName}`,
                attachment: fs.createReadStream(videoPath),
            },
            threadID,
            null,
            messageID
        );

        react(api, messageID, REACTIONS.success);
        log.success(`Video sent: ${videoTitle} (${fileSizeMB.toFixed(2)} MB)`);

        // Schedule cleanup
        scheduleCleanup(videoPath);

        return true;
    } catch (error) {
        log.error(`Video download helper failed: ${error.message}`);

        if (videoPath && fs.existsSync(videoPath)) {
            try {
                fs.unlinkSync(videoPath);
            } catch {
                // Ignore
            }
        }

        return false;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Download video from YouTube with retry logic and query optimization
 *
 * @param {Object} api - Facebook API instance
 * @param {string} threadID - Thread identifier
 * @param {string} messageID - Message ID for reactions
 * @param {string} query - Search query
 * @param {Object} [_model] - Unused (uses internal gemini)
 * @returns {Promise<void>}
 */
async function downloadVideo(api, threadID, messageID, query, _model) {
    const model = gemini.createModelProxy();
    const downloadDir = getTempDirSync();

    react(api, messageID, REACTIONS.loading);

    // Optimize query with AI
    let optimizedQuery = query;

    try {
        log.info("AI analyzing video request...");

        const analysisPrompt = `Optimize video search for: "${query}". Return JSON: {"optimizedQuery": "..."}`;
        const result = await model.generateContent(analysisPrompt);
        const json = JSON.parse(
            result?.response?.text?.().replace(/```json\n?|```\n?/g, "") || "{}"
        );

        if (json.optimizedQuery) {
            optimizedQuery = json.optimizedQuery;
            log.info(`AI optimized: "${optimizedQuery}"`);
        }
    } catch {
        // Use original query on AI failure
    }

    // Build query variations for retry
    const queries = [...new Set([
        optimizedQuery,
        query,
        `${query} short`,
        `${query} clip`,
    ])];

    // Attempt downloads with each query
    for (let i = 0; i < queries.length; i++) {
        const currentQuery = queries[i];

        if (i > 0) {
            log.warn(`Retry ${i}: "${currentQuery}"`);
        }

        const success = await attemptVideoDownload(api, threadID, messageID, currentQuery, downloadDir);

        if (success) {
            return;
        }

        await sleep(1000);
    }

    // All attempts failed
    log.error("All download attempts failed");
    react(api, messageID, REACTIONS.error);
    return api.sendMessage(MESSAGES.errors.downloadFailed, threadID, null, messageID);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    downloadVideo,
};
