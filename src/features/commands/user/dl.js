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
        const statusMsg = null;

        // check if url is provided
        if (args.length === 0) {
            return api.sendMessage(
                `❌ Please provide a URL.\n\nUsage: ${config.bot.prefix}dl <url>`,
                threadID,
                messageID
            );
        }

        const url = args[0];
        let finalUrl = url;

        // Set initial reaction
        api.setMessageReaction("⏳", messageID, () => {}, true);

        try {
            // Resolve short URLs for better metadata extraction
            if (
                url.includes("vt.tiktok.com") ||
                url.includes("vm.tiktok.com") ||
                url.includes("bit.ly") ||
                url.includes("tinyurl.com")
            ) {
                try {
                    const headRes = await axios.head(url, {
                        maxRedirects: 10,
                        headers: {
                            "User-Agent":
                                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                        },
                    });
                    finalUrl = headRes.request.res.responseUrl || url;
                } catch (_e) {
                    try {
                        const getRes = await axios.get(url, {
                            maxRedirects: 10,
                            timeout: 5000,
                            headers: {
                                "User-Agent":
                                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                            },
                        });
                        finalUrl = getRes.request.res.responseUrl || url;
                    } catch (_e) {
                        return api.sendMessage(`❌ Error: ${_e.message}`, event.threadID);
                    }
                }
            }

            let response;
            let platform = "Unknown";

            // Select specific downloader based on URL
            if (
                finalUrl.includes("facebook.com") ||
                finalUrl.includes("fb.watch") ||
                finalUrl.includes("fb.com")
            ) {
                platform = "Facebook";
                response = await fbdown(finalUrl);
            } else if (finalUrl.includes("tiktok.com")) {
                platform = "TikTok";
                response = await ttdl(finalUrl);
            } else if (finalUrl.includes("instagram.com")) {
                platform = "Instagram";
                response = await igdl(finalUrl);
            } else if (finalUrl.includes("youtube.com") || finalUrl.includes("youtu.be")) {
                platform = "YouTube";
                response = await youtube(finalUrl);
            } else if (finalUrl.includes("twitter.com") || finalUrl.includes("x.com")) {
                platform = "Twitter";
                response = await twitter(finalUrl);
            } else {
                platform = "Auto-Detect";
                response = await aio(finalUrl);
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

            // Check for API failure
            if (!data || (data.status === false && !data.url && !data.video)) {
                console.log(`[DL Command] ${platform} downloader failed, trying AIO fallback...`);
                // Fallback to AIO
                try {
                    const aioResponse = await aio(finalUrl);
                    if (
                        aioResponse &&
                        (aioResponse.url || aioResponse.data || aioResponse.result)
                    ) {
                        response = aioResponse;
                        data = response.data || response.result || response;
                        platform = "Auto-Detect (Fallback)";
                        console.log(
                            "[DL Command] Fallback Response:",
                            JSON.stringify(data, null, 2)
                        );
                    }
                } catch (err) {
                    console.error("[DL Command] AIO fallback also failed:", err);
                }
            }

            if (!data) {
                throw new Error("Empty response from downloader.");
            }

            // Helper function to recursively find a URL in an object
            const findUrlInObject = (obj, visited = new Set()) => {
                if (!obj || typeof obj !== "object" || visited.has(obj)) return null;
                visited.add(obj);

                // Check immediate keys first
                const keys = [
                    "HD",
                    "mp4",
                    "video",
                    "Normal_video",
                    "SD",
                    "url",
                    "media",
                    "Video",
                    "Download",
                    "hd_play",
                    "sd_play",
                    "play_addr",
                    "play_url",
                    "download_url",
                    "no_watermark",
                ];

                for (const key of keys) {
                    if (obj[key] && typeof obj[key] === "string" && obj[key].startsWith("http")) {
                        return obj[key];
                    }
                }

                // If nested array, search inside
                if (Array.isArray(obj)) {
                    for (const item of obj) {
                        const result = findUrlInObject(item, visited);
                        if (result) return result;
                    }
                }

                // Deep search in values
                for (const key in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, key)) {
                        const val = obj[key];
                        if (typeof val === "object") {
                            const result = findUrlInObject(val, visited);
                            if (result) return result;
                        }
                    }
                }
                return null;
            };

            // Determine the best URL to use
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
                (typeof data === "string" && data.startsWith("http") ? data : null);

            // Handle array response or nested arrays
            if (!videoUrl && Array.isArray(data)) {
                videoUrl =
                    data[0].url ||
                    data[0].video ||
                    data[0].HD ||
                    data[0].SD ||
                    data[0].Normal_video;
            } else if (!videoUrl && Array.isArray(data.video)) {
                videoUrl = data.video[0];
            }

            // Last resort: deep search
            if (!videoUrl) {
                videoUrl = findUrlInObject(data);
            }

            // Prioritize title from data
            let title =
                data.title ||
                data.full_title ||
                data.caption ||
                data.description ||
                data.desc ||
                data.text ||
                (data.meta ? data.meta.title : null);

            if (!title) {
                title = platform !== "Unknown" ? `${platform} Video` : "Downloaded Video";
            }

            // Improved Author Extraction
            let author =
                data.author ||
                data.uploader ||
                data.owner ||
                data.user ||
                data.nickname ||
                data.unique_id ||
                data.uniqueId ||
                data.author_name ||
                data.authorName;

            // Handle object types for author
            if (author && typeof author === "object") {
                author =
                    author.nickname ||
                    author.name ||
                    author.unique_id ||
                    author.uniqueId ||
                    author.username ||
                    author.id;
            }

            // Fallback: If author still unknown, check nested objects or metadata
            if (!author || typeof author !== "string" || author === "Unknown") {
                const authorObj = data.author || data.owner || data.user || data.meta?.author;
                if (authorObj && typeof authorObj === "object") {
                    author =
                        authorObj.nickname ||
                        authorObj.name ||
                        authorObj.unique_id ||
                        authorObj.uniqueId ||
                        authorObj.username;
                }
            }

            // Final Fallback: Extract from URL
            if (!author || typeof author !== "string" || author === "Unknown") {
                const tiktokMatch = finalUrl.match(/@([^/?&]+)/);
                const generalMatch = finalUrl.match(
                    /https?:\/\/(?:www\.)?(?:instagram|twitter|x|facebook|youtube|tiktok)\.com\/([^/?&]+)/
                );

                if (tiktokMatch) {
                    author = tiktokMatch[1];
                } else if (
                    generalMatch &&
                    !["share", "watch", "reels", "shorts", "groups"].includes(generalMatch[1])
                ) {
                    author = generalMatch[1].startsWith("@")
                        ? generalMatch[1].substring(1)
                        : generalMatch[1];
                } else {
                    author = "Unknown";
                }
            }

            if (!videoUrl) {
                throw new Error("No download URL found in the response.");
            }

            api.setMessageReaction("⬇️", messageID, () => {}, true);

            // Download the video as a stream
            const videoStream = await axios({
                method: "GET",
                url: videoUrl,
                responseType: "stream",
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                },
            });

            // Force the stream to have a proper filename so the API treats it as a video
            // Using the title as filename can help some platforms display it better
            const safeTitle = title.replace(/[/\\?%*:|"<>]/g, "").substring(0, 50) || "video";
            videoStream.data.path = `${safeTitle}.mp4`;

            // Set uploading reaction
            api.setMessageReaction("🔃", messageID, () => {}, true);

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
            } catch (_err) {
                // Ignore
            }

            //  return api.sendMessage(
            //      `❌ Download failed.\n\nError: ${error.message || "Unknown error occurred"}\n\nPlease check the URL and try again.`,
            //     threadID,
            //      messageID
            //  );
        }
    },
};
