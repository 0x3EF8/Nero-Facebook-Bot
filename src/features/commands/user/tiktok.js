/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                          TIKTOK COMMAND                                       ║
 * ║           Search and Download TikTok Videos (Viral & Search)                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command allows users to search for TikTok videos or get random
 * trending/viral content if no query is provided.
 *
 * Usage:
 * - tiktok (sends a viral video)
 * - tiktok <query> (searches and sends a video)
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const axios = require("axios");

// Track recently sent videos to avoid duplicates
const sentVideos = new Set();
const MAX_HISTORY = 100;

module.exports = {
    config: {
        name: "tiktok",
        aliases: ["tik", "tt", "trending"],
        description: "Search TikTok or get viral videos",
        usage: "tiktok [search query]",
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
    async execute({ api, event, args, messageID }, retries = 0) {
        const threadID = event.threadID;
        const query = args.join(" ");

        // Prevent infinite loops
        if (retries > 5) {
            api.setMessageReaction("❌", event.messageID, () => {}, true);
            return api.sendMessage(
                "❌ Failed to send video after multiple attempts.",
                threadID,
                event.messageID
            );
        }

        // Set initial reaction
        api.setMessageReaction("⏳", event.messageID, () => {}, true);

        try {
            let videoData = null;
            let videos = [];

            if (query.startsWith("@")) {
                // USER SEARCH MODE
                const username = query.substring(1); // Remove '@'
                console.log(`[TikTok] Searching user: ${username}`);

                const response = await axios.post(
                    "https://www.tikwm.com/api/feed/search",
                    {
                        keywords: username,
                        count: 12,
                        cursor: 0,
                        web: 1,
                        hd: 1,
                    },
                    {
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                        },
                    }
                );

                if (response.data?.data?.videos) {
                    // Filter for user
                    const allVideos = response.data.data.videos;
                    videos = allVideos.filter(
                        (v) =>
                            v.author && v.author.unique_id.toLowerCase() === username.toLowerCase()
                    );
                    if (videos.length === 0) videos = allVideos; // Fallback
                }
            } else if (query) {
                // SEARCH MODE
                console.log(`[TikTok] Searching for: ${query}`);

                // Random cursor for variety
                const randomCursor = Math.floor(Math.random() * 10) * 12;

                const response = await axios.post(
                    "https://www.tikwm.com/api/feed/search",
                    {
                        keywords: query,
                        count: 12,
                        cursor: randomCursor,
                        web: 1,
                        hd: 1,
                    },
                    {
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                        },
                    }
                );

                if (response.data?.data?.videos) {
                    videos = response.data.data.videos;
                }
            } else {
                // VIRAL / TRENDING MODE
                console.log(`[TikTok] Fetching viral videos (PH)`);

                const randomCursor = Math.floor(Math.random() * 50);
                const response = await axios.get(
                    `https://www.tikwm.com/api/feed/list?region=PH&count=20&cursor=${randomCursor}`,
                    {
                        headers: {
                            "User-Agent":
                                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                        },
                    }
                );

                if (response.data?.data) {
                    const allVideos = response.data.data;
                    // Strict viral filter
                    videos = allVideos.filter((v) => v.play_count > 100000 || v.digg_count > 10000);
                    if (videos.length === 0) {
                        // Fallback: sort by plays
                        allVideos.sort((a, b) => b.play_count - a.play_count);
                        videos = [allVideos[0]];
                    }
                }
            }

            if (!videos || videos.length === 0) {
                throw new Error(
                    query ? `No videos found for "${query}"` : "No trending videos found."
                );
            }

            // SELECT UNIQUE VIDEO
            // Try up to 10 times to find one not in sentVideos
            let attempts = 0;
            do {
                videoData = videos[Math.floor(Math.random() * videos.length)];
                attempts++;
            } while (sentVideos.has(videoData.video_id) && attempts < 10);

            // Add to history
            if (videoData.video_id) {
                sentVideos.add(videoData.video_id);
                if (sentVideos.size > MAX_HISTORY) {
                    const firstItem = sentVideos.values().next().value;
                    sentVideos.delete(firstItem);
                }
            }

            const title = videoData.title || "TikTok Video";
            const _author = videoData.author ? videoData.author.nickname : "Unknown";
            const username = videoData.author ? videoData.author.unique_id : "unknown";
            const likes = videoData.digg_count ? `❤️ ${videoData.digg_count}` : "";

            // Handle relative URLs
            let videoUrl = videoData.play;
            if (videoUrl && !videoUrl.startsWith("http")) {
                videoUrl = `https://www.tikwm.com${videoUrl}`;
            }

            // Set downloading reaction
            api.setMessageReaction("⬇️", event.messageID, () => {}, true);

            // Download video stream
            const videoStream = await axios({
                method: "GET",
                url: videoUrl,
                responseType: "stream",
                timeout: 30000,
            });

            // Validate stream
            const size = videoStream.headers["content-length"];
            if (size && parseInt(size) > 50 * 1024 * 1024) {
                throw new Error("Video too large (>50MB).");
            }

            // Assign filename
            videoStream.data.path = `tiktok_${Date.now()}.mp4`;

            // Set uploading reaction
            api.setMessageReaction("🔃", event.messageID, () => {}, true);

            // Send message
            try {
                const header = query ? `🔎 **Result for:** ${query}` : `🔥 **Viral TikTok (PH)**`;

                await api.sendMessage(
                    {
                        body: `${header}\n\n👤 @${username}\n📝 ${title.substring(0, 100)}\n${likes}`,
                        attachment: videoStream.data,
                    },
                    threadID,
                    event.messageID
                );

                api.setMessageReaction("✅", event.messageID, () => {}, true);
            } catch (sendError) {
                // Check specifically for the metadata error which indicates FB rejection
                // Also check if the error is about empty attachments (core throws this now)
                const isMetadataError =
                    sendError.message.includes("missing metadata") ||
                    sendError.message.includes("Upload failed") ||
                    (sendError.error && JSON.stringify(sendError.error).includes("metadata"));

                if (isMetadataError || sendError.message.includes("upload")) {
                    console.warn(
                        `[TikTok] Facebook rejected video. Retrying (Attempt ${retries + 1})...`
                    );
                    return this.execute({ api, event, args, messageID }, retries + 1);
                }
                throw sendError;
            }
        } catch (error) {
            console.error("[TikTok Command] Error:", error.message);
            api.setMessageReaction("❌", event.messageID, () => {}, true);

            return api.sendMessage(
                `❌ ${error.message || "Failed to fetch video."}`,
                threadID,
                event.messageID
            );
        }
    },
};
