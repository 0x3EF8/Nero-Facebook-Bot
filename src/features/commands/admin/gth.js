/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                        GET THREAD HISTORY COMMAND                             ║
 * ║        List recent threads and view their message history (Admin Only)        ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command allows admins to list recent inbox threads and peek into
 * their message history without joining them.
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const axios = require("axios");

/**
 * Gets the display name for a thread (reused logic)
 * @param {Object} thread - Thread object
 * @returns {string} Display name
 */
function getThreadDisplayName(thread) {
    if (thread.isGroup) {
        return thread.threadName || thread.name || "Unnamed Group";
    }
    if (thread.userInfo && thread.userInfo.length > 0) {
        // Find user who is not the bot (assuming bot ID is not easily available here without context,
        // but typically valid assumption for 1:1)
        const userWithName = thread.userInfo.find((u) => u.name);
        if (userWithName) return userWithName.name;
    }
    return thread.threadName || thread.name || "Unknown";
}

/**
 * Shortens a URL using is.gd
 * @param {string} url - The long URL
 * @returns {Promise<string>} The shortened URL or original if failed
 */
async function shortenUrl(url) {
    try {
        if (!url) return "";
        const response = await axios.get(
            `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`
        );
        return response.data;
    } catch (_e) {
        // Fallback to tinyurl if is.gd fails
        try {
            const response = await axios.get(
                `http://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`
            );
            return response.data;
        } catch {
            return url; // Return original if both fail
        }
    }
}

module.exports = {
    config: {
        name: "gth",
        aliases: ["history", "threads", "inbox"],
        description: "List threads or view thread history",
        usage: "gth [number]",
        category: "admin",
        cooldown: 5,
        permissions: "admin",
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
        const limit = 20; // Number of threads to list

        try {
            // Mode 1: List Threads (No arguments)
            if (args.length === 0) {
                api.setMessageReaction("⏳", messageID, () => {}, true);

                // Fetch recent threads from inbox
                const threads = await api.getThreadList(limit, null, ["INBOX"]);

                if (!threads || threads.length === 0) {
                    api.setMessageReaction("❌", messageID, () => {}, true);
                    return api.sendMessage("📭 Inbox is empty.", threadID, null, messageID);
                }

                let msg = `📬 **Recent Inbox Threads**\n\n`;
                threads.forEach((t, i) => {
                    const name = getThreadDisplayName(t);
                    const type = t.isGroup ? "Group" : "User";
                    const snippet = t.snippet
                        ? t.snippet.length > 30
                            ? t.snippet.substring(0, 30) + "..."
                            : t.snippet
                        : "No message";
                    msg += `${i + 1}. **${name}** (${type})\n   ID: ${t.threadID}\n   📝 ${snippet}\n\n`;
                });

                msg += `👉 Type 
${config.bot.prefix}gth <number>
 to view history.`;

                api.setMessageReaction("✅", messageID, () => {}, true);
                return api.sendMessage(msg, threadID, null, messageID);
            }

            // Mode 2: View History (With argument)
            const index = parseInt(args[0], 10);

            if (isNaN(index) || index < 1 || index > limit) {
                return api.sendMessage(
                    `❌ Invalid number. Please choose between 1 and ${limit}.`,
                    threadID,
                    messageID
                );
            }

            api.setMessageReaction("⏳", messageID, () => {}, true);

            // We must re-fetch the list to map the index to a Thread ID accurately
            const threads = await api.getThreadList(limit, null, ["INBOX"]);

            if (!threads || index > threads.length) {
                return api.sendMessage(
                    "❌ Thread list changed or index out of range. Please list again.",
                    threadID,
                    messageID
                );
            }

            const targetThread = threads[index - 1];
            const targetThreadID = targetThread.threadID;
            const targetName = getThreadDisplayName(targetThread);

            // Fetch history for the specific thread
            // Fetch 50 messages to get a good context
            const history = await api.getThreadHistory(targetThreadID, 50);

            if (!history || history.length === 0) {
                api.setMessageReaction("❌", messageID, () => {}, true);
                return api.sendMessage(
                    `📭 No history found for **${targetName}**.`,
                    threadID,
                    messageID
                );
            }

            // Format the history
            // We need to resolve sender names. history[i].senderID is available.
            const userMap = {};
            if (targetThread.userInfo) {
                targetThread.userInfo.forEach((u) => (userMap[u.id] = u.name));
            }

            let historyMsg = `CHAT HISTORY: ${targetName}\n`;
            historyMsg += `Thread ID: ${targetThreadID}\n`;
            historyMsg += `Thread Type: ${targetThread.isGroup ? "Group" : "User"}\n`;
            if (targetThread.isGroup && targetThread.participantIDs) {
                historyMsg += `Participants: ${targetThread.participantIDs.length}\n`;
            }
            if (targetThread.messageCount !== undefined) {
                historyMsg += `Total Messages: ${targetThread.messageCount}\n`;
            }
            historyMsg += `------------------------------------------\n\n`;

            // Reverse to show oldest to newest (top is old, bottom is new)
            const sortedHistory = history.reverse();

            // Use for...of to handle async await for URL shortening
            for (const msg of sortedHistory) {
                const senderName = userMap[msg.senderID] || "Unknown User";

                // Detail attachment types and URLs
                let attachmentInfo = "";
                if (msg.attachments && msg.attachments.length > 0) {
                    for (const a of msg.attachments) {
                        const type = a.type || "unknown";
                        const originalUrl = a.url || a.facebookUrl || a.previewUrl || "";
                        if (originalUrl) {
                            const shortUrl = await shortenUrl(originalUrl);
                            attachmentInfo += `\n   📎 [${type}]: ${shortUrl}`;
                        } else {
                            attachmentInfo += ` [${type}]`;
                        }
                    }
                }

                const body = (msg.body || "") + attachmentInfo;
                const finalContent = body.trim() || "[Action/Event or Empty Message]";

                // Compact Date-Time Formatting (MM/DD HH:MM)
                const ts = parseInt(msg.timestamp, 10);
                const dateObj = new Date(ts);
                let dateTime = "00/00 00:00";

                if (!isNaN(ts)) {
                    const M = String(dateObj.getMonth() + 1).padStart(2, "0");
                    const D = String(dateObj.getDate()).padStart(2, "0");
                    const h = String(dateObj.getHours()).padStart(2, "0");
                    const m = String(dateObj.getMinutes()).padStart(2, "0");
                    dateTime = `${M}/${D} ${h}:${m}`;
                }

                historyMsg += `[${dateTime}] ${senderName}: ${finalContent}\n\n`;
            }

            historyMsg += `\n------------------------------------------`;

            api.setMessageReaction("✅", messageID, () => {}, true);
            return api.sendMessage(historyMsg, threadID, null, messageID);
        } catch (error) {
            console.error(error);
            api.setMessageReaction("❌", messageID, () => {}, true);
            return api.sendMessage(
                `❌ Error: ${error.message || "Something went wrong."}\n`,
                threadID,
                messageID
            );
        }
    },
};
