/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                           SEXY COMMAND                                        ║
 * ║             Download random "sexy" TikTok videos (Custom Finder)              ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command fetches a random short video by searching a public TikTok feed API
 * with curated keywords, effectively creating a custom randomizer.
 *
 * @author 0x3EF8
 * @version 2.0.0
 */

"use strict";

const axios = require("axios");

// Curated keywords to keep content relevant to the command's theme
const KEYWORDS = [
    "pretty girl tiktok", "beautiful pinay", "tiktok dance girl", 
    "viral girl dance", "cute chinita", "filipina beauty", 
    "tiktok mashup girl", "pretty asian girl", "girl dancing trend",
    "tiktok model", "bikini girl tiktok", "hot girl dance",
    "trending pinay", "fit girl tiktok", "aesthetic girl",
    "thirst trap tiktok", "baddie edit", "tiktok crush",
    "sexy teens tiktok", "cute teen dance", "viral teen girl"
];

module.exports = {
    config: {
        name: "sexy",
        aliases: ["shoti", "randomtiktok", "girl"],
        description: "Download a random girl TikTok video",
        usage: "sexy",
        category: "fun",
        cooldown: 10,
        permissions: "user",
        enabled: true,
        dmOnly: false,
        groupOnly: false,
    },

    /**
     * Command execution function
     */
    async execute({ api, event, messageID }) {
        const threadID = event.threadID;
        
        // Set initial reaction
        api.setMessageReaction("⏳", event.messageID, () => {}, true);

        try {
            // 1. Pick a random keyword
            const randomKeyword = KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];
            
            // 2. Search using TikWM API
            const response = await axios.post("https://www.tikwm.com/api/feed/search", {
                keywords: randomKeyword,
                count: 12,
                cursor: 0,
                web: 1,
                hd: 1
            }, { 
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36'
                }
            });

            if (!response.data || !response.data.data || !response.data.data.videos || response.data.data.videos.length === 0) {
                throw new Error("No videos found.");
            }

            // 3. Pick a random video from the results
            const videos = response.data.data.videos;
            const randomVideo = videos[Math.floor(Math.random() * videos.length)];
            
            const title = randomVideo.title || "Random Video";
            const author = randomVideo.author ? randomVideo.author.nickname : "Unknown";
            const username = randomVideo.author ? randomVideo.author.unique_id : "unknown";
            
            // TikWM returns relative paths sometimes
            let videoUrl = randomVideo.play;
            if (videoUrl && !videoUrl.startsWith("http")) {
                videoUrl = `https://www.tikwm.com${videoUrl}`;
            }

            // Set downloading reaction
            api.setMessageReaction("⬇️", event.messageID, () => {}, true);

            // 4. Download the video stream
            const videoStream = await axios({
                method: "GET",
                url: videoUrl,
                responseType: "stream",
                timeout: 30000
            });

            // Set uploading reaction
            api.setMessageReaction("🔃", event.messageID, () => {}, true);

            // Assign a filename
            videoStream.data.path = `shoti_${Date.now()}.mp4`;

            // Check if stream is valid
            if (!videoStream.data) {
                throw new Error("Failed to download video stream.");
            }

            // 5. Send the video
            try {
                await api.sendMessage({
                    body: `@${username}`,
                    attachment: videoStream.data
                }, threadID, event.messageID);

                // Set success reaction only AFTER successful upload
                api.setMessageReaction("✅", event.messageID, () => {}, true);
            } catch (sendError) {
                // If FB rejects it (missing metadata), try one more time recursively
                if (sendError.message.includes("metadata") || sendError.message.includes("upload")) {
                    console.log("[Sexy] Upload failed, retrying with new video...");
                    return this.execute({ api, event, messageID, threadID });
                }
                throw sendError;
            }

        } catch (error) {
            console.error("[Sexy Command] Error:", error.message);
            api.setMessageReaction("❌", event.messageID, () => {}, true);
            
            let errMsg = `❌ Failed to fetch or send video.`;
            if (error.message.includes("metadata")) {
                errMsg = `⚠️ Facebook rejected the video upload (likely too large or filtered).`;
            } else {
                errMsg += `\nError: ${error.message || "Unknown error"}`;
            }

            return api.sendMessage(
                errMsg,
                threadID,
                event.messageID
            );
        }
    }
};