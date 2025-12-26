/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                            SHOTI COMMAND                                      ║
 * ║                 Send random TikTok videos from VIP List                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command fetches random videos from a specific curated list of users.
 * It uses the robust TikWM API (same as tiktok.js) for reliability.
 *
 * @author 0x3EF8
 * @version 2.0.0
 */

"use strict";

const axios = require("axios");

// Track recently sent videos to avoid duplicates
const sentVideos = new Set();
const MAX_HISTORY = 100;

module.exports = {
    config: {
        name: "shoti",
        aliases: ["tikgirl", "chix", "pautog"],
        description: "Send a random video from the VIP Shoti list",
        usage: "shoti",
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
    async execute({ api, event, args, config }, retries = 0) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        
        // Prevent infinite loops
        if (retries > 5) {
            api.setMessageReaction("❌", messageID, () => {}, true);
            return api.sendMessage("❌ Failed to fetch a valid video after multiple attempts. Try again later.", threadID, messageID);
        }

        // The specific list of users requested
        const targetUsers = [
            "xqfcxkk2r2", "_szniaa", "ms.micha1", "samdel065", "vix.max", 
            "we.could.happen", "pinay.ph2", "iamyours143244", "_asianxbeauties", 
            "achueeeeee_nice", "forgoal2", "lie.ju02", "koko.yumi", 
            "dontvisitmyprofileeeeee", "chichidump_666", "chieezzeey"
        ];

        // React to show processing
        api.setMessageReaction("🎲", messageID, () => {}, true);

        try {
            // 1. Pick a random user from the list
            const randomUser = targetUsers[Math.floor(Math.random() * targetUsers.length)];
            console.log(`[Shoti] Selected target: ${randomUser} (Attempt ${retries + 1})`);

            // 2. Search for videos by this user using TikWM Search API (Same as tiktok.js)
            const response = await axios.post("https://www.tikwm.com/api/feed/search", {
                keywords: randomUser,
                count: 12, // Fetch a batch of videos
                cursor: 0,
                web: 1,
                hd: 1
            }, { 
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }
            });

            let videos = [];
            if (response.data?.data?.videos) {
                const allVideos = response.data.data.videos;
                
                // Strict Filter: Ensure video is actually from the target user
                // Search API often returns "related" videos if the user has few videos
                videos = allVideos.filter(v => 
                    v.author && 
                    v.author.unique_id && 
                    v.author.unique_id.toLowerCase() === randomUser.toLowerCase()
                );
            }

            // If no videos found for this specific user, retry with a DIFFERENT user
            if (videos.length === 0) {
                console.log(`[Shoti] No videos found matching '${randomUser}' exactly, retrying with new user...`);
                return this.execute({ api, event, args, config }, retries + 1);
            }

            // 3. Select a unique video
            let videoData = null;
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

            // Extract metadata
            const title = videoData.title || "Shoti Video";
            const author = videoData.author ? videoData.author.nickname : "Unknown";
            const username = videoData.author ? videoData.author.unique_id : randomUser;
            const likes = videoData.digg_count ? `❤️ ${videoData.digg_count}` : "";

            // Handle relative URLs
            let videoUrl = videoData.play;
            if (videoUrl && !videoUrl.startsWith("http")) {
                videoUrl = `https://www.tikwm.com${videoUrl}`;
            }

            api.setMessageReaction("⬇️", messageID, () => {}, true);

            // 4. Download video stream
            const videoStream = await axios({
                method: "GET",
                url: videoUrl,
                responseType: "stream",
                timeout: 30000
            });

            // Validate stream size (max 50MB for FB)
            const size = videoStream.headers['content-length'];
            if (size && parseInt(size) > 50 * 1024 * 1024) {
                console.log("[Shoti] Video too large, retrying...");
                return this.execute({ api, event, args, config }, retries + 1);
            }

            // Assign filename
            videoStream.data.path = `shoti_${Date.now()}.mp4`;

            api.setMessageReaction("✅", messageID, () => {}, true);

            // 5. Send message
            try {
                const msg = {
                    body: `@${username}`,
                    attachment: videoStream.data
                };

                await api.sendMessage(msg, threadID, messageID);

            } catch (sendError) {
                // Handle FB upload rejection by retrying
                if (sendError.message.includes("metadata") || sendError.message.includes("upload")) {
                    console.warn(`[Shoti] Facebook rejected video. Retrying (Attempt ${retries + 1})...`);
                    return this.execute({ api, event, args, config }, retries + 1);
                }
                throw sendError;
            }

        } catch (error) {
            console.error("[Shoti] Error:", error.message);
            // If it's a network/API error, retry
            if (retries < 3) {
                return this.execute({ api, event, args, config }, retries + 1);
            }
            
            api.setMessageReaction("❌", messageID, () => {}, true);
            return api.sendMessage(`❌ Error: ${error.message}`, threadID, messageID);
        }
    }
};
