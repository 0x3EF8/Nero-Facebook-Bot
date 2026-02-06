/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                             STORY COMMAND                                     ║
 * ║              Create stories on the bot's Facebook profile                     ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command allows admins to create stories on the bot's profile:
 * - Text stories with custom fonts and backgrounds
 * - Photo stories (by replying to an image)
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
        name: "story",
        aliases: ["st", "mystory", "fbstory"],
        description: "Create a story on the bot's Facebook profile",
        usage: "story <text> | [reply to image] [caption]",
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
                "📖 **Story Command**\n\n" +
                    "Create a story on the bot's Facebook profile.\n\n" +
                    "**Usage:**\n" +
                    `• \`${actualPrefix}${commandName} <text>\` - Text story\n` +
                    `• \`${actualPrefix}${commandName} <text> -font <name>\` - Text story with font\n` +
                    `• \`${actualPrefix}${commandName} <text> -bg <color>\` - Text story with background\n` +
                    `• Reply to image with \`${actualPrefix}${commandName}\` - Photo story\n` +
                    `• Reply to image with \`${actualPrefix}${commandName} <caption>\` - Photo story with caption\n\n` +
                    "**Fonts:** headline, classic, casual, fancy\n" +
                    "**Backgrounds:** orange, blue, green, modern\n\n" +
                    "**Examples:**\n" +
                    `• \`${actualPrefix}${commandName} Hello world!\`\n` +
                    `• \`${actualPrefix}${commandName} Good morning! -font headline -bg orange\`\n` +
                    `• Reply to a photo with \`${actualPrefix}${commandName} My vacation 🌴\``,
                threadID,
                messageID
            );
        }

        // Check if story API exists
        if (!api.story) {
            return api.sendMessage(
                "❌ Story API not available.\n\n" +
                    "The bot needs to be restarted to load the new API.",
                threadID,
                messageID
            );
        }

        // Parse arguments for font and background options
        let storyText = "";
        let fontName = "classic";
        let backgroundName = "blue";

        // Parse -font and -bg flags
        const argsStr = args.join(" ");
        const fontMatch = argsStr.match(/-font\s+(\w+)/i);
        const bgMatch = argsStr.match(/-bg\s+(\w+)/i);

        if (fontMatch) {
            fontName = fontMatch[1].toLowerCase();
        }
        if (bgMatch) {
            backgroundName = bgMatch[1].toLowerCase();
        }

        // Remove flags from text
        storyText = argsStr
            .replace(/-font\s+\w+/gi, "")
            .replace(/-bg\s+\w+/gi, "")
            .trim();

        // Check for image in reply (photo story)
        if (messageReply && messageReply.attachments) {
            const imageUrls = extractImageUrls(messageReply.attachments);

            if (imageUrls.length > 0) {
                // Photo story mode
                const statusMsg = await api.sendMessage(
                    `📤 Downloading image for story...`,
                    threadID
                );

                let imageStream;
                try {
                    imageStream = await downloadStream(imageUrls[0]);

                    // Unsend status
                    if (statusMsg?.messageID) {
                        try {
                            await api.unsendMessage(statusMsg.messageID);
                        } catch {
                            // Ignore
                        }
                    }
                } catch (error) {
                    logger?.error?.("Story", `Failed to download image: ${error.message}`);
                    return api.sendMessage(
                        `❌ Failed to download image: ${error.message}`,
                        threadID,
                        messageID
                    );
                }

                // Send "creating story" status
                const creatingMsg = await api.sendMessage(`📷 Creating photo story...`, threadID);

                try {
                    // Create photo story
                    const result = await api.story.createPhoto(imageStream, storyText);

                    // Unsend "creating" status
                    if (creatingMsg?.messageID) {
                        try {
                            await api.unsendMessage(creatingMsg.messageID);
                        } catch {
                            // Ignore
                        }
                    }

                    logger?.success?.(
                        "Story",
                        `Created photo story: ${result.storyID || "success"}`
                    );

                    let successMessage = `✅ **Photo Story Created!**\n\n`;
                    successMessage += `📷 Image story uploaded successfully\n`;
                    if (storyText) {
                        successMessage += `📝 Caption: "${storyText.substring(0, 50)}${storyText.length > 50 ? "..." : ""}"\n`;
                    }
                    if (result.storyID) {
                        successMessage += `\n🔗 Story ID: ${result.storyID}`;
                    }

                    return api.sendMessage(successMessage, threadID, null, messageID);
                } catch (error) {
                    // Unsend "creating" status
                    if (creatingMsg?.messageID) {
                        try {
                            await api.unsendMessage(creatingMsg.messageID);
                        } catch {
                            // Ignore
                        }
                    }

                    logger?.error?.("Story", `Failed to create photo story: ${error.message}`);

                    return api.sendMessage(
                        `❌ Failed to create photo story!\n\n` +
                            `Error: ${error.message || "Unknown error"}`,
                        threadID,
                        null,
                        messageID
                    );
                }
            }
        }

        // Text story mode
        if (!storyText) {
            return api.sendMessage(
                "❌ Please provide text for the story or reply to an image.",
                threadID,
                messageID
            );
        }

        // Send "creating story" status
        const creatingMsg = await api.sendMessage(`📝 Creating text story...`, threadID);

        try {
            // Create text story
            const result = await api.story.create(storyText, fontName, backgroundName);

            // Unsend "creating" status
            if (creatingMsg?.messageID) {
                try {
                    await api.unsendMessage(creatingMsg.messageID);
                } catch {
                    // Ignore
                }
            }

            logger?.success?.("Story", `Created text story: ${result.storyID || "success"}`);

            let successMessage = `✅ **Text Story Created!**\n\n`;
            successMessage += `📝 Text: "${storyText.substring(0, 50)}${storyText.length > 50 ? "..." : ""}"\n`;
            successMessage += `🎨 Font: ${fontName}\n`;
            successMessage += `🖼️ Background: ${backgroundName}\n`;
            if (result.storyID) {
                successMessage += `\n🔗 Story ID: ${result.storyID}`;
            }

            return api.sendMessage(successMessage, threadID, null, messageID);
        } catch (error) {
            // Unsend "creating" status
            if (creatingMsg?.messageID) {
                try {
                    await api.unsendMessage(creatingMsg.messageID);
                } catch {
                    // Ignore
                }
            }

            logger?.error?.("Story", `Failed to create text story: ${error.message}`);

            return api.sendMessage(
                `❌ Failed to create text story!\n\n` +
                    `Error: ${error.message || "Unknown error"}`,
                threadID,
                messageID
            );
        }
    },
};
