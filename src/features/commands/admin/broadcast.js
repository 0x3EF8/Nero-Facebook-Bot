/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                          BROADCAST COMMAND                                    ║
 * ║              Send a message to all threads or specific groups                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command allows admins to broadcast messages to:
 * - All active threads (groups and DMs)
 * - Only groups
 * - Only DMs (direct messages)
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { getTempDirSync } = require("../../../utils/paths");

// ═══════════════════════════════════════════════════════════════════════════════
//                              CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** @type {number} Maximum threads to fetch */
const MAX_THREADS = 100;

/** @type {number} Delay between messages (ms) to avoid rate limiting */
const MESSAGE_DELAY = 1000;

/** @type {string[]} School GC thread IDs (from classSchedule) */
const SCHOOL_GC_IDS = ["24052714344355754", "24425853360351937"];

/** @type {Map<string, boolean>} Track ongoing broadcasts to prevent duplicates */
const activeBroadcasts = new Map();

// ═══════════════════════════════════════════════════════════════════════════════
//                              HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch all active threads
 * @param {Object} api - Nero API object
 * @param {string} filter - Filter type: 'all', 'groups', 'dms', 'school'
 * @returns {Promise<Array>} Array of thread objects
 */
async function fetchThreads(api, filter = "all") {
    // For school filter, return mock thread objects with the IDs
    if (filter === "school") {
        return SCHOOL_GC_IDS.map((id) => ({
            threadID: id,
            isGroup: true,
            threadName: `School GC (${id.slice(-4)})`,
        }));
    }

    try {
        const threads = await api.getThreadList(MAX_THREADS, null, ["INBOX"]);

        if (!threads || threads.length === 0) {
            return [];
        }

        // Filter based on type
        switch (filter) {
            case "groups":
                return threads.filter((t) => t.isGroup);
            case "dms":
                return threads.filter((t) => !t.isGroup);
            default:
                return threads;
        }
    } catch (error) {
        throw new Error(`Failed to fetch threads: ${error.message}`);
    }
}

/**
 * Get display name for a thread
 * @param {Object} thread - Thread object
 * @returns {string} Display name
 */
function getThreadName(thread) {
    if (thread.isGroup) {
        return thread.threadName || thread.name || "Unnamed Group";
    }

    if (thread.userInfo && thread.userInfo.length > 0) {
        const user = thread.userInfo.find((u) => u.name);
        if (user) return user.name;
    }

    return thread.threadName || thread.name || "Unknown";
}

/**
 * Sleep for specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/**
 * Download attachment from URL
 * @param {string} url - URL to download
 * @param {string} type - 'photo' or 'video'
 * @returns {Promise<string>} Path to temporary file
 */
async function downloadAttachment(url, type) {
    try {
        const response = await axios({
            method: "GET",
            url: url,
            responseType: "stream",
        });

        const tempDir = getTempDirSync();

        const ext = type === "video" ? "mp4" : "png";
        const filePath = path.join(tempDir, `broadcast_${Date.now()}.${ext}`);

        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on("finish", () => resolve(filePath));
            writer.on("error", reject);
        });
    } catch (error) {
        throw new Error(`Failed to download attachment: ${error.message}`);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
//                              COMMAND EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    config: {
        name: "broadcast",
        aliases: ["bc", "announce", "sendall"],
        description: "Broadcast a message/attachment to threads",
        usage: "broadcast <msg> | reply to media",
        category: "admin",
        cooldown: 30,
        permissions: "admin",
        enabled: true,
        dmOnly: false,
        groupOnly: false,
    },

    /**
     * Command execution function
     */
    async execute({ api, event, args, config, logger }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const senderID = event.senderID;

        // Check if broadcast is already running
        if (activeBroadcasts.get(senderID)) {
            return api.sendMessage(
                "⚠️ You already have an active broadcast running.\nPlease wait for it to complete.",
                threadID,
                messageID
            );
        }

        // --- 1. Handle Attachments (Reply Mode) ---
        let attachmentPath = null;
        let attachmentType = null;

        if (
            event.type === "message_reply" &&
            event.messageReply.attachments &&
            event.messageReply.attachments.length > 0
        ) {
            const att = event.messageReply.attachments[0]; // Take first attachment
            if (att.type === "photo" || att.type === "video" || att.type === "animated_image") {
                try {
                    api.sendMessage("⏳ Downloading attachment...", threadID, null, messageID);
                    attachmentType = att.type === "video" ? "video" : "photo";
                    attachmentPath = await downloadAttachment(att.url, attachmentType);
                } catch (err) {
                    return api.sendMessage(
                        `❌ Error downloading attachment: ${err.message}`,
                        threadID,
                        messageID
                    );
                }
            }
        }

        // Parse flags
        const firstArg = args[0] ? args[0].toLowerCase().trim() : "";
        let filter = "all";
        let messageStart = 0;
        const selectedIDs = [];

        if (["-g", "-groups", "groups"].includes(firstArg)) {
            filter = "groups";
            messageStart = 1;
        } else if (["-d", "-dms", "dms"].includes(firstArg)) {
            filter = "dms";
            messageStart = 1;
        } else if (["-s", "-school", "school"].includes(firstArg)) {
            filter = "school";
            messageStart = 1;
        } else if (["-t", "-target", "target"].includes(firstArg)) {
            // Logic for -t <id1>, <id2> ... <message>
            filter = "custom";
            let i = 1;

            // Collect IDs. Supports numeric IDs or IDs starting with 'c', allowing trailing commas
            while (i < args.length && /^(c|)\d+,?$/i.test(args[i])) {
                // Strip the comma if present
                const cleanID = args[i].replace(/,$/, "");
                selectedIDs.push(cleanID);
                i++;
            }

            if (selectedIDs.length === 0) {
                return api.sendMessage(
                    "❌ Please provide at least one Thread ID after -t.\nExample: /broadcast -t c12345, c67890 Hello",
                    threadID
                );
            }
            messageStart = i;
        } else if (firstArg === "-list") {
            return await this.listThreads(api, event, args[1] || "all", config);
        }

        // Show usage if no arguments and no attachment
        if (args.length === 0 && !attachmentPath) {
            const actualPrefix = config.bot.prefixEnabled ? config.bot.prefix : "";
            const commandName = this.config.name;
            return api.sendMessage(
                "📢 **Broadcast Command**\n\n" +
                "Send a message (text, photo, video) to multiple threads.\n" +
                "Reply to an attachment to broadcast it.\n\n" +
                "**Usage:**\n" +
                `• ${actualPrefix}${commandName} <message>` +
                " - Send to all threads\n" +
                `• ${actualPrefix}${commandName} -g <message>` +
                " - Send to groups only\n" +
                `• ${actualPrefix}${commandName} -d <message>` +
                " - Send to DMs only\n" +
                `• ${actualPrefix}${commandName} -s <message>` +
                " - Send to school GCs\n" +
                `• ${actualPrefix}${commandName} -t <id1> <id2>... <msg>` +
                " - Send to target IDs\n" +
                `• ${actualPrefix}${commandName} -list` +
                " - List all threads\n\n" +
                "**Attachments:** Reply to a photo/video with the command to broadcast it.",
                threadID,
                messageID
            );
        }

        // Get message text content - Preserving whitespace
        // Strategy: Locate where the actual message starts in event.body
        let broadcastMessage = "";

        if (args.length > messageStart) {
            let searchBody = event.body.trim();

            // 1. Remove command (first word)
            // This handles prefix + commandName whatever casing was used
            const firstSpace = searchBody.indexOf(" ");
            if (firstSpace !== -1) {
                searchBody = searchBody.substring(firstSpace).trim();
            } else {
                searchBody = ""; // Only command, no args
            }

            // 2. Remove consumed args (flags like -g, -t, etc.)
            for (let i = 0; i < messageStart; i++) {
                const arg = args[i];
                // Find arg in remaining body (should be near start)
                const argIndex = searchBody.indexOf(arg);
                if (argIndex !== -1) {
                    searchBody = searchBody.substring(argIndex + arg.length).trim();
                }
            }

            broadcastMessage = searchBody;
        }

        // Validation: Must have either text OR attachment
        if (!broadcastMessage && !attachmentPath) {
            const actualPrefix = config.bot.prefixEnabled ? config.bot.prefix : "";
            return api.sendMessage(
                "❌ Please provide a message or reply to an attachment.\n\n" +
                `Usage: \`${actualPrefix}broadcast <message>\``,
                threadID,
                messageID
            );
        }

        // Confirm broadcast
        let filterText = filter;
        if (filter === "all") filterText = "all threads";
        else if (filter === "groups") filterText = "groups only";
        else if (filter === "dms") filterText = "DMs only";
        else if (filter === "school") filterText = "school GCs";
        else if (filter === "custom") filterText = `target IDs (${selectedIDs.length})`;
        try {
            // Fetch threads
            let targetThreads = [];

            if (filter === "custom") {
                // Manually construct thread objects for custom IDs
                targetThreads = selectedIDs.map((id) => ({
                    threadID: id,
                    isGroup: true, // Assume group, doesn't matter much for sending
                    threadName: `ID: ${id}`,
                }));
            } else {
                const threads = await fetchThreads(api, filter);
                if (threads.length === 0) {
                    return api.sendMessage(`📭 No ${filterText} found.`, threadID, null, messageID);
                }
                // Filter out current thread to avoid echo
                targetThreads = threads.filter((t) => t.threadID !== threadID);
            }

            if (targetThreads.length === 0) {
                return api.sendMessage("📭 No targets found.", threadID, null, messageID);
            }

            // Send confirmation
            const confirmMsg = await api.sendMessage(
                `📢 **Broadcasting to ${targetThreads.length} targets**\n` +
                (attachmentPath ? `📎 With attachment (${attachmentType})\n` : "") +
                (broadcastMessage
                    ? `📝 Text: "${broadcastMessage.substring(0, 50)}..."\n`
                    : "") +
                `⏳ Starting...`,
                threadID
            );

            // Mark broadcast as active
            activeBroadcasts.set(senderID, true);

            // Send messages
            let successCount = 0;
            let failCount = 0;
            const failedThreads = [];

            logger?.info?.("Broadcast", `Starting broadcast to ${targetThreads.length} threads`);

            for (const thread of targetThreads) {
                try {
                    const msgOptions = {};

                    // Add text if exists
                    if (broadcastMessage) {
                        msgOptions.body = `📢 **BROADCAST**\n\n${broadcastMessage}`;
                    } else if (attachmentPath) {
                        msgOptions.body = `📢 **BROADCAST**`;
                    }

                    // Add attachment if exists
                    if (attachmentPath) {
                        msgOptions.attachment = fs.createReadStream(attachmentPath);
                    }

                    await api.sendMessage(msgOptions, thread.threadID);
                    successCount++;
                    logger?.debug?.(
                        "Broadcast",
                        `Sent to ${getThreadName(thread)} (${thread.threadID})`
                    );
                } catch (error) {
                    failCount++;
                    failedThreads.push({
                        name: getThreadName(thread),
                        id: thread.threadID,
                        error: error.message,
                    });
                    logger?.debug?.(
                        "Broadcast",
                        `Failed: ${getThreadName(thread)} - ${error.message}`
                    );
                }

                // Delay between messages
                await sleep(MESSAGE_DELAY);
            }

            // Cleanup attachment file
            if (attachmentPath && fs.existsSync(attachmentPath)) {
                fs.unlinkSync(attachmentPath);
            }

            // Clear active broadcast
            activeBroadcasts.delete(senderID);

            // Try to unsend confirmation
            try {
                if (confirmMsg?.messageID) await api.unsendMessage(confirmMsg.messageID);
            } catch {
                /* ignore */
            }

            // Send results
            let resultMessage =
                `✅ **Broadcast Complete**\n` +
                `📤 Sent: ${successCount}/${targetThreads.length}\n`;

            if (failCount > 0) {
                resultMessage += `❌ Failed: ${failCount}\n\nFAILED:\n`;
                for (const ft of failedThreads.slice(0, 5)) {
                    resultMessage += `• ${ft.name}\n`;
                }
            }

            return api.sendMessage(resultMessage, threadID, null, messageID);
        } catch (error) {
            activeBroadcasts.delete(senderID);
            // Cleanup on error too
            if (attachmentPath && fs.existsSync(attachmentPath)) fs.unlinkSync(attachmentPath);

            logger?.error?.("Broadcast", `Error: ${error.message}`);
            return api.sendMessage(`❌ Failed: ${error.message}`, threadID, null, messageID);
        }
    },

    /**
     * List all threads
     * @param {Object} api - Nero API object
     * @param {Object} event - Event object
     * @param {string} filter - Filter type
     */
    async listThreads(api, event, filter, _config) {
        const threadID = event.threadID;
        const messageID = event.messageID;

        try {
            const threads = await fetchThreads(
                api,
                filter === "groups" ? "groups" : filter === "dms" ? "dms" : filter === "school" ? "school" : "all"
            );

            if (threads.length === 0) {
                return api.sendMessage("📭 No threads found.", threadID, null, messageID);
            }

            let list = `📋 **Thread List** (${threads.length})\n\n`;

            const groups = threads.filter((t) => t.isGroup);
            const dms = threads.filter((t) => !t.isGroup);

            if (groups.length > 0) {
                list += `👥 **Groups (${groups.length}):**\n`;
                for (let i = 0; i < Math.min(groups.length, 10); i++) {
                    const g = groups[i];
                    list += `${i + 1}. ${getThreadName(g)} (${g.threadID})\n`;
                }
                if (groups.length > 10) {
                    list += `... and ${groups.length - 10} more\n`;
                }
                list += `\n`;
            }

            if (dms.length > 0) {
                list += `👤 **DMs (${dms.length}):**\n`;
                for (let i = 0; i < Math.min(dms.length, 10); i++) {
                    const d = dms[i];
                    list += `${i + 1}. ${getThreadName(d)} (${d.threadID})\n`;
                }
                if (dms.length > 10) {
                    list += `... and ${dms.length - 10} more\n`;
                }
            }

            return api.sendMessage(list, threadID, null, messageID);
        } catch (error) {
            return api.sendMessage(
                `❌ Failed to fetch threads: ${error.message}`,
                threadID,
                null,
                messageID
            );
        }
    },
};
