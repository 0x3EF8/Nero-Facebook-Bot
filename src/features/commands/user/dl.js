/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                            DL COMMAND                                         ║
 * ║        Download videos from various platforms (FB, TikTok, YT, Insta)         ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command uses the 'ab-downloader' package to fetch videos from social media
 * platforms and sends them as attachments.
 *
 * Supported: Instagram, TikTok, Facebook, YouTube, and more.
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const { aio, fbdown, igdl, ttdl, twitter, youtube } = require("ab-downloader");
const axios = require("axios");

module.exports = {
    config: {
        name: "dl",
        aliases: ["download", "video", "save", "tik", "fbdl", "igdl"],
        description: "Download videos from TikTok, Facebook, Instagram, YouTube, etc.",
        usage: "dl <url>",
        category: "utility",
        cooldown: 10,
        permissions: "user",
        enabled: true,
        dmOnly: false,
        groupOnly: false,
    },

    /**
     * Command execution function
     * @param {Object} context - Command context
     */
    async execute({ api, event, args, config }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        let statusMsg = null;

        // check if url is provided
        if (args.length === 0) {
            return api.sendMessage(
                `❌ Please provide a URL.\n\nUsage: ${config.bot.prefix}dl <url>`,
                threadID,
                messageID
            );
        }

        const url = args[0];

        // Set initial reaction and send status message
        api.setMessageReaction("⏳", messageID, () => {}, true);
        /* statusMsg = await api.sendMessage(
            `⏳ Searching for content...\nThis might take a moment.`,
            threadID,
            messageID
        ); */

        try {
            let response;
            let platform = "Unknown";

            // Select specific downloader based on URL
            if (url.includes('facebook.com') || url.includes('fb.watch') || url.includes('fb.com')) {
                platform = "Facebook";
                response = await fbdown(url);
            } else if (url.includes('tiktok.com')) {
                platform = "TikTok";
                response = await ttdl(url);
            } else if (url.includes('instagram.com')) {
                platform = "Instagram";
                response = await igdl(url);
            } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
                platform = "YouTube";
                response = await youtube(url);
            } else if (url.includes('twitter.com') || url.includes('x.com')) {
                platform = "Twitter";
                response = await twitter(url);
            } else {
                platform = "Auto-Detect";
                response = await aio(url);
            }

            console.log(`[DL Command] Platform: ${platform}`);
            console.log("[DL Command] Response:", JSON.stringify(response, null, 2));

            // Flexible data extraction
            let data = response;
            if (response && response.data) {
                data = response.data;
            } else if (response && response.result) {
                data = response.result;
            }

            if (!data) {
                throw new Error("Empty response from downloader.");
            }
            
            // Determine the best URL to use
            // varied structures: .url, .video, .HD, .SD, .media, .Video, .Download, .mp4, .Normal_video
            let videoUrl = 
                data.HD || 
                data.mp4 ||
                data.video || 
                data.Normal_video ||
                data.SD || 
                data.url || 
                data.media ||
                data.Video ||
                data.Download ||
                (data.links ? data.links[0] : null) ||
                (typeof data === 'string' && data.startsWith('http') ? data : null);
            
            // Handle array response (sometimes returns multiple qualities) or nested arrays
            if (Array.isArray(data)) {
                 videoUrl = data[0].url || data[0].video || data[0].HD || data[0].SD || data[0].Normal_video;
            } else if (Array.isArray(data.video)) {
                // Specific fix for ttdl response where video is ["url"]
                videoUrl = data.video[0];
            }

            // Prioritize title from data, then caption/description
            // Common fields: title, caption, description, desc, text, full_title
            let title = 
                data.title || 
                data.full_title ||
                data.caption || 
                data.description || 
                data.desc ||
                data.text ||
                (data.meta ? data.meta.title : null);
            
            if (!title) {
                if (platform !== "Unknown") {
                    title = `${platform} Video`;
                } else {
                    title = "Downloaded Video";
                }
            }
                
            // Common fields: author, uploader, owner, user, nickname, unique_id, author_name
            let author = 
                data.author || 
                data.uploader || 
                data.owner || 
                data.user || 
                data.nickname || 
                data.unique_id || 
                data.author_name || 
                (typeof data.author === 'object' ? (data.author.nickname || data.author.name || data.author.unique_id) : null) ||
                (typeof data.owner === 'object' ? (data.owner.nickname || data.owner.username) : null);
            
            // Fallback: Extract author from URL for various platforms
            if (!author) {
                // TikTok: @username
                // IG/Twitter: .com/username
                // FB: .com/username or .com/groups/id
                const tiktokMatch = url.match(/@([^/?&]+)/);
                const generalMatch = url.match(/https?:\/\/(?:www\.)?(?:instagram|twitter|x|facebook|youtube)\.com\/([^/?&]+)/);
                
                if (tiktokMatch) {
                    author = tiktokMatch[1];
                } else if (generalMatch && !["share", "watch", "reels", "shorts", "groups"].includes(generalMatch[1])) {
                    author = generalMatch[1];
                } else {
                    author = "Unknown";
                }
            }

            if (!videoUrl) {
                throw new Error("No download URL found in the response.");
            }

            api.setMessageReaction("⬇️", messageID, () => {}, true);
            
            // For Facebook, we skip the "Downloading" status message to keep it simple
            if (platform !== "Facebook") {
                statusMsg = await api.sendMessage(
                    `⬇️ Downloading content...\n\nTitle: ${title.substring(0, 50)}${title.length > 50 ? "..." : ""}\n👤 From: ${author}`,
                    threadID,
                    messageID
                );
            }

            // Download the video as a stream
            const videoStream = await axios({
                method: "GET",
                url: videoUrl,
                responseType: "stream",
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                }
            });

            // Force the stream to have a proper filename so the API treats it as a video
            // Using the title as filename can help some platforms display it better
            const safeTitle = title.replace(/[/\\?%*:|"<>]/g, "").substring(0, 50) || "video";
            videoStream.data.path = `${safeTitle}.mp4`;

            // Set uploading reaction
            api.setMessageReaction("🔃", messageID, () => {}, true);

            // Cleanup status message BEFORE sending the final one
            // This ensures there's only one bot message at the end
            if (statusMsg && statusMsg.messageID) {
                try {
                    await api.unsendMessage(statusMsg.messageID);
                } catch (e) {
                    // Ignore unsend errors
                }
            }

            // Set final success reaction
            api.setMessageReaction("✅", messageID, () => {}, true);
            
            let finalBody = `✅ **Download Complete**\n\nTitle: ${title}\n👤 From: ${author}`;
            if (platform === "Facebook") {
                finalBody = `✅ **Download Complete**`;
            }

            // Combined message: Text (body) + Video (attachment) in ONE call
            await api.sendMessage(
                {
                    body: finalBody,
                    attachment: videoStream.data,
                },
                threadID,
                messageID
            );

        } catch (error) {
            console.error("[DL Command] Error:", error);
            api.setMessageReaction("❌", messageID, () => {}, true);
            
            // Cleanup status message
            try {
                if (statusMsg && statusMsg.messageID) {
                    await api.unsendMessage(statusMsg.messageID);
                }
            } catch (e) {
                // Ignore
            }

            return api.sendMessage(
                `❌ Download failed.\n\nError: ${error.message || "Unknown error occurred"}\n\nPlease check the URL and try again.`,
                threadID,
                messageID
            );
        }
    },
};
