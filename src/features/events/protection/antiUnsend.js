/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                         ANTI-UNSEND V2                                        ║
 * ║          Uses Nero's Built-in Message Store for Anti-Unsend                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * Nero automatically stores all messages. This event simply retrieves
 * and reveals them when someone unsends a message.
 *
 * Supports: text, photos, videos, audio, files, stickers, GIFs
 *
 * @author 0x3EF8
 * @version 2.0.0
 */

"use strict";

const https = require("https");
const http = require("http");
const { URL } = require("url");
const { PassThrough } = require("stream");

/**
 * Download file from URL as a stream
 */
function downloadStream(url, filename, type) {
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
                            return downloadStream(response.headers.location, filename, type)
                                .then(resolve)
                                .catch(reject);
                        }

                        if (response.statusCode !== 200) {
                            return reject(new Error(`HTTP ${response.statusCode}`));
                        }

                        const stream = new PassThrough();

                        // Determine proper extension based on type
                        let ext;
                        if (type === "photo" || type === "animated_image") {
                            ext = "jpg";
                        } else if (type === "video") {
                            ext = "mp4";
                        } else if (type === "audio") {
                            ext = "mp3";
                        } else {
                            ext = filename?.split(".").pop() || "bin";
                        }

                        // Use proper filename with extension
                        const finalFilename =
                            type === "photo" || type === "animated_image"
                                ? `photo_${Date.now()}.${ext}`
                                : filename || `attachment_${Date.now()}.${ext}`;

                        stream.path = finalFilename;
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
 * Format timestamp
 */
function formatTime(timestamp) {
    if (typeof timestamp === "string") timestamp = parseInt(timestamp, 10);
    if (!timestamp || isNaN(timestamp)) return "Unknown time";

    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "Unknown time";

    return date.toLocaleString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        month: "short",
        day: "numeric",
    });
}

module.exports = {
    config: {
        name: "antiUnsendV2",
        description: "Reveals deleted messages using Nero's built-in message store",
        eventTypes: ["message_unsend"],
        priority: 50,
        enabled: true,
    },

    /**
     * Event execution
     */
    async execute({ api, event, config, logger }) {
        const { threadID, messageID, senderID, deletionTimestamp } = event;

        // Don't reveal bot's own unsent messages
        const botID = api.getCurrentUserID?.();
        if (senderID === botID) return;

        // Don't reveal admins' or superAdmins' unsent messages
        if (config.isAdmin(senderID)) return;

        // Get original message from Nero's built-in store
        const original = api.getStoredMessage(messageID);

        if (!original) {
            logger?.debug?.("AntiUnsend", `Message ${messageID} not in store`);
            return;
        }

        logger?.info?.("AntiUnsend", `Revealing unsent message from ${senderID}`);

        try {
            // Get sender name
            let senderName = "Someone";
            try {
                const userInfo = await api.getUserInfo([String(senderID)]);
                const userData = userInfo?.[senderID] || Object.values(userInfo || {})[0];
                senderName = userData?.name || userData?.firstName || senderName;
            } catch {
                senderName = `User ${String(senderID).slice(-4)}`;
            }

            // Build reveal message
            let msg = `🗑️ 𝗠𝗘𝗦𝗦𝗔𝗚𝗘 𝗨𝗡𝗦𝗘𝗡𝗧\n`;
            msg += `━━━━━━━━━━━━━━━━━━\n`;
            msg += `👤 From: ${senderName}\n`;
            msg += `🕐 Sent: ${formatTime(original.timestamp)}\n`;

            if (deletionTimestamp) {
                msg += `🗑️ Deleted: ${formatTime(deletionTimestamp)}`;
            }

            if (original.body?.trim()) {
                msg += `\n💬 Content:\n${original.body}`;
            }

            if (original.messageReply?.body) {
                const preview = original.messageReply.body.substring(0, 50);
                const ellipsis = original.messageReply.body.length > 50 ? "..." : "";
                msg += `\n\n↩️ Was replying to: "${preview}${ellipsis}"`;
            }

            // Download attachments
            const attachments = original.attachments || [];
            const streams = [];

            for (const att of attachments) {
                // Skip stickers (handled separately)
                if (att.type === "sticker") continue;

                const url = att.url || att.largePreviewUrl || att.previewUrl;
                if (!url) {
                    // Try to resolve photo URL if we have an ID
                    const photoId = att.fbid || att.ID;
                    if (photoId) {
                        try {
                            const resolvedUrl = await new Promise((resolve, reject) => {
                                api.resolvePhotoUrl(photoId, (err, photoUrl) => {
                                    if (err) reject(err);
                                    else resolve(photoUrl);
                                });
                            });
                            if (resolvedUrl) {
                                const stream = await downloadStream(
                                    resolvedUrl,
                                    att.filename || "photo.jpg",
                                    "photo"
                                );
                                streams.push(stream);
                            }
                        } catch (e) {
                            logger?.debug?.("AntiUnsend", `Could not resolve photo: ${e.message}`);
                        }
                    }
                    continue;
                }

                try {
                    // For photos, always use photo type to ensure proper handling
                    const attType = att.type === "animated_image" ? "photo" : att.type;

                    const stream = await downloadStream(url, att.filename || att.name, attType);
                    streams.push(stream);
                } catch (e) {
                    logger?.debug?.("AntiUnsend", `Failed to download: ${e.message}`);
                }
            }

            // Send reveal message with attachments
            try {
                await api.sendMessage(
                    {
                        body: msg,
                        attachment:
                            streams.length > 0
                                ? streams.length === 1
                                    ? streams[0]
                                    : streams
                                : undefined,
                    },
                    threadID
                );
            } catch {
                // Fallback: send text only
                await api.sendMessage(msg, threadID);
            }

            // Send stickers separately
            for (const att of attachments.filter((a) => a.type === "sticker" && a.stickerID)) {
                try {
                    await api.sendMessage({ sticker: att.stickerID }, threadID);
                } catch (e) {
                    logger?.debug?.("AntiUnsend", `Failed to send sticker: ${e.message}`);
                }
            }

            logger?.success?.("AntiUnsend", `Revealed message from ${senderName}`);
        } catch (error) {
            logger?.error?.("AntiUnsend", `Failed: ${error.message}`);
        }
    },
};
