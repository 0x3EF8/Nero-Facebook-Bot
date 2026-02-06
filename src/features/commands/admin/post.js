/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                             POST COMMAND                                      ║
 * ║              Create posts on the bot's Facebook timeline                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command allows admins to create posts on the bot's timeline:
 * - Text posts
 * - Posts with images (by replying to an image)
 * - Posts with URLs
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const https = require("https");
const http = require("http");
const { URL } = require("url");
const { PassThrough } = require("stream");

// ═══════════════════════════════════════════════════════════════════════════════
//                              HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Download file from URL as a stream
 * @param {string} url - URL to download
 * @returns {Promise<PassThrough>} Stream with the file
 */
function downloadStream(url) {
    return new Promise((resolve, reject) => {
        try {
            const parsedUrl = new URL(url);
            const protocol = parsedUrl.protocol === "https:" ? https : http;

            protocol
                .get(
                    url,
                    {
                        headers: {
                            "User-Agent":
                                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                        },
                    },
                    (response) => {
                        if (
                            response.statusCode >= 300 &&
                            response.statusCode < 400 &&
                            response.headers.location
                        ) {
                            return downloadStream(response.headers.location)
                                .then(resolve)
                                .catch(reject);
                        }

                        if (response.statusCode !== 200) {
                            return reject(new Error(`HTTP ${response.statusCode}`));
                        }

                        const stream = new PassThrough();
                        stream.path = `image_${Date.now()}.jpg`;
                        response.pipe(stream);
                        resolve(stream);
                    }
                )
                .on("error", reject);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Extract image URLs from attachments
 * @param {Array} attachments - Message attachments
 * @returns {string[]} Array of image URLs
 */
function extractImageUrls(attachments) {
    if (!attachments || !Array.isArray(attachments)) return [];

    const urls = [];
    for (const att of attachments) {
        if (att.type === "photo" || att.type === "animated_image") {
            const url = att.url || att.largePreviewUrl || att.previewUrl;
            if (url) urls.push(url);
        }
    }
    return urls;
}

// ═══════════════════════════════════════════════════════════════════════════════
//                              COMMAND EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    config: {
        name: "post",
        aliases: ["fb", "timeline", "status"],
        description: "Create a post on the bot's Facebook timeline",
        usage: "post <message> | [reply to image] <caption>",
        category: "admin",
        cooldown: 30,
        permissions: "admin",
        enabled: true,
        dmOnly: false,
        groupOnly: false,
    },

    /**
     * Command execution function
     * @param {Object} context - Command context
     * @param {Object} context.api - Nero API object
     * @param {Object} context.event - Event object
     * @param {Array} context.args - Command arguments
     * @param {Object} context.logger - Logger utility
     */
    async execute({ api, event, args, config, logger }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const messageReply = event.messageReply;

        // Show usage if no arguments and no reply
        if (args.length === 0 && !messageReply) {
            const actualPrefix = config.bot.prefixEnabled ? config.bot.prefix : "";
            const commandName = this.config.name;
            return api.sendMessage(
                "📝 **Post Command**\n\n" +
                    "Create a post on the bot's Facebook timeline.\n\n" +
                    "**Usage:**\n" +
                    `• \`${actualPrefix}${commandName} <message>\` - Text post\n` +
                    `• \`${actualPrefix}${commandName} <message>\` (reply to image) - Post with image\n\n` +
                    "**Examples:**\n" +
                    `• \`${actualPrefix}${commandName} Hello world!\`\n` +
                    `• Reply to a photo with \`${actualPrefix}${commandName} My vacation photo\``,
                threadID,
                messageID
            );
        }

        // Check if createPost API exists
        if (!api.createPost) {
            return api.sendMessage(
                "❌ Post API not available.\n\n" +
                    "The bot needs to be restarted to load the new API.",
                threadID,
                messageID
            );
        }

        // Get message content
        const postMessage = args.join(" ").trim();

        // Check for image in reply
        const imageStreams = [];
        if (messageReply && messageReply.attachments) {
            const imageUrls = extractImageUrls(messageReply.attachments);

            if (imageUrls.length > 0) {
                // Send "uploading" status
                const statusMsg = await api.sendMessage(
                    `📤 Downloading ${imageUrls.length} image(s)...`,
                    threadID
                );

                try {
                    for (const url of imageUrls) {
                        const stream = await downloadStream(url);
                        imageStreams.push(stream);
                    }

                    // Unsend status
                    if (statusMsg?.messageID) {
                        try {
                            await api.unsendMessage(statusMsg.messageID);
                        } catch {
                            // Ignore
                        }
                    }
                } catch (error) {
                    logger?.error?.("Post", `Failed to download image: ${error.message}`);
                    return api.sendMessage(
                        `❌ Failed to download image: ${error.message}`,
                        threadID,
                        messageID
                    );
                }
            }
        }

        // Require message or image
        if (!postMessage && imageStreams.length === 0) {
            return api.sendMessage(
                "❌ Please provide a message or reply to an image.",
                threadID,
                messageID
            );
        }

        // Send "posting" status
        const postingMsg = await api.sendMessage(`📝 Creating post...`, threadID);

        try {
            // Create the post
            const options = {};
            if (imageStreams.length > 0) {
                options.attachment = imageStreams.length === 1 ? imageStreams[0] : imageStreams;
            }

            const result = await api.createPost(postMessage || "", options);

            // Unsend "posting" status
            if (postingMsg?.messageID) {
                try {
                    await api.unsendMessage(postingMsg.messageID);
                } catch {
                    // Ignore
                }
            }

            logger?.success?.("Post", `Created post: ${result.postID || "success"}`);

            let successMessage = `✅ **Post Created Successfully!**\n\n`;
            if (postMessage) {
                successMessage += `📝 Message: "${postMessage.substring(0, 50)}${postMessage.length > 50 ? "..." : ""}"\n`;
            }
            if (imageStreams.length > 0) {
                successMessage += `📷 Images: ${imageStreams.length}\n`;
            }
            if (result.url) {
                successMessage += `\n🔗 ${result.url}`;
            }

            return api.sendMessage(successMessage, threadID, null, messageID);
        } catch (error) {
            // Unsend "posting" status
            if (postingMsg?.messageID) {
                try {
                    await api.unsendMessage(postingMsg.messageID);
                } catch {
                    // Ignore
                }
            }

            logger?.error?.("Post", `Failed to create post: ${error.message}`);

            return api.sendMessage(
                `❌ Failed to create post!\n\n` + `Error: ${error.message || "Unknown error"}`,
                threadID,
                null,
                messageID
            );
        }
    },
};
