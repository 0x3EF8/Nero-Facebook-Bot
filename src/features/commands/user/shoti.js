/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                            SHOTI COMMAND                                      ║
 * ║                 Send random TikTok videos from List                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command fetches random videos from a specific curated list of users.
 * It uses the robust TikWM API (same as tiktok.js) for reliability.
 *
 * @author 0x3EF8
 * @version 2.1.0
 */

"use strict";

const axios = require("axios");
const fs = require("fs");
const path = require("path");

// Path to target users storage
const TARGETS_PATH = path.resolve(__dirname, "..", "..", "..", "config", "shoti.json");

/**
 * Load target users from JSON file
 */
function loadTargets() {
    try {
        if (fs.existsSync(TARGETS_PATH)) {
            return JSON.parse(fs.readFileSync(TARGETS_PATH, "utf8"));
        }
    } catch (error) {
        console.error("[Shoti] Failed to load targets:", error);
    }
    return [];
}

/**
 * Save target users to JSON file
 */
function saveTargets(targets) {
    try {
        fs.writeFileSync(TARGETS_PATH, JSON.stringify(targets, null, 2));
        return true;
    } catch (error) {
        console.error("[Shoti] Failed to save targets:", error);
        return false;
    }
}

// Track recently sent videos to avoid duplicates
const sentVideos = new Set();
const MAX_HISTORY = 100;

module.exports = {
    config: {
        name: "shoti",
        aliases: ["tikgirl", "chix", "pautog"],
        description: "Send a random video from the Shoti list",
        usage: "shoti [-l | -a <username> | -r <username>]",
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
        const targetUsers = loadTargets();

        // 1. Handle Subcommands
        if (args[0]) {
            const action = args[0].toLowerCase();

            // List Subcommand (-l)
            if (action === "-l" || action === "list") {
                if (targetUsers.length === 0) {
                    return api.sendMessage("📝 The Shoti list is currently empty.", threadID, messageID);
                }
                const list = targetUsers.map((user, i) => `${i + 1}. ${user}`).join("\n");
                return api.sendMessage(`🌟 **Shoti List** 🌟\n\n${list}\n\nTotal: ${targetUsers.length} users`, threadID, messageID);
            }

            // Add Subcommand (-a)
            if (action === "-a" || action === "add") {
                const newUser = args[1]?.toLowerCase();
                if (!newUser) {
                    return api.sendMessage("❌ Please provide a TikTok username to add.", threadID, messageID);
                }

                if (targetUsers.includes(newUser)) {
                    return api.sendMessage(`⚠️ '${newUser}' is already in the list.`, threadID, messageID);
                }

                targetUsers.push(newUser);
                if (saveTargets(targetUsers)) {
                    return api.sendMessage(`✅ Added '${newUser}' to the Shoti  list!`, threadID, messageID);
                } else {
                    return api.sendMessage("❌ Failed to save the updated list. Please check logs.", threadID, messageID);
                }
            }

            // Remove Subcommand (-r)
            if (action === "-r" || action === "remove") {
                const userToDelete = args[1]?.toLowerCase();
                if (!userToDelete) {
                    return api.sendMessage("❌ Please provide a TikTok username to remove.", threadID, messageID);
                }

                const index = targetUsers.indexOf(userToDelete);
                if (index === -1) {
                    return api.sendMessage(`⚠️ '${userToDelete}' is not in the list.`, threadID, messageID);
                }

                targetUsers.splice(index, 1);
                if (saveTargets(targetUsers)) {
                    return api.sendMessage(`✅ Removed '${userToDelete}' from the Shoti list!`, threadID, messageID);
                } else {
                    return api.sendMessage("❌ Failed to save the updated list. Please check logs.", threadID, messageID);
                }
            }
        }

        // 2. Base Command: Fetch Random Video
        if (targetUsers.length === 0) {
            return api.sendMessage("❌ Shoti list is empty. Add users first using 'shoti add <username>'.", threadID, messageID);
        }

        // Prevent infinite loops
        if (retries > 5) {
            api.setMessageReaction("❌", messageID, () => {}, true);
            return api.sendMessage("❌ Failed to fetch a valid video after multiple attempts. Try again later.", threadID, messageID);
        }

        // React to show processing
        api.setMessageReaction("🎲", messageID, () => {}, true);

        try {
            // 1. Pick a random user from the list
            const randomUser = targetUsers[Math.floor(Math.random() * targetUsers.length)];
            console.log(`[Shoti] Selected target: ${randomUser} (Attempt ${retries + 1})`);

            // 2. Search for videos by this user using TikWM Search API
            const response = await axios.post("https://www.tikwm.com/api/feed/search", {
                keywords: randomUser,
                count: 12,
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
            const username = videoData.author ? videoData.author.unique_id : randomUser;

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
                if (sendError.message.includes("metadata") || sendError.message.includes("upload")) {
                    console.warn(`[Shoti] Facebook rejected video. Retrying (Attempt ${retries + 1})...`);
                    return this.execute({ api, event, args, config }, retries + 1);
                }
                throw sendError;
            }

        } catch (error) {
            console.error("[Shoti] Error:", error.message);
            if (retries < 3) {
                return this.execute({ api, event, args, config }, retries + 1);
            }
            
            api.setMessageReaction("❌", messageID, () => {}, true);
            return api.sendMessage(`❌ Error: ${error.message}`, threadID, messageID);
        }
    }
};