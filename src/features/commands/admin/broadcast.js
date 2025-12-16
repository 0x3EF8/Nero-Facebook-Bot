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

// ═══════════════════════════════════════════════════════════════════════════════
//                              COMMAND EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    config: {
        name: "broadcast",
        aliases: ["bc", "announce", "sendall"],
        description: "Broadcast a message to all threads",
        usage: "broadcast <message> | -g <message> | -d <message> | -s <message> | -list",
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
        const senderID = event.senderID;

        // Check if broadcast is already running
        if (activeBroadcasts.get(senderID)) {
            return api.sendMessage(
                "⚠️ You already have an active broadcast running.\nPlease wait for it to complete.",
                threadID,
                messageID
            );
        }

        // Show usage if no arguments
        if (args.length === 0) {
            const actualPrefix = config.bot.prefixEnabled ? config.bot.prefix : '';
            const commandName = this.config.name;
            return api.sendMessage(
                "📢 **Broadcast Command**\n\n" +
                "Send a message to multiple threads at once.\n\n" +
                "**Usage:**\n" +
                `• ${actualPrefix}${commandName} <message>` + " - Send to all threads\n" +
                `• ${actualPrefix}${commandName} -g <message>` + " - Send to groups only\n" +
                `• ${actualPrefix}${commandName} -d <message>` + " - Send to DMs only\n" +
                `• ${actualPrefix}${commandName} -s <message>` + " - Send to school GCs only\n" +
                `• ${actualPrefix}${commandName} -list` + " - List all threads\n\n" +
                "**Example:**\n" +
                `• ${actualPrefix}${commandName} Hello everyone! Bot update incoming.`,
                threadID,
                messageID
            );
        }

        // Parse flags
        const firstArg = args[0].toLowerCase();
        let filter = "all";
        let messageStart = 0;

        if (firstArg === "-g" || firstArg === "-groups") {
            filter = "groups";
            messageStart = 1;
        } else if (firstArg === "-d" || firstArg === "-dms") {
            filter = "dms";
            messageStart = 1;
        } else if (firstArg === "-s" || firstArg === "-school") {
            filter = "school";
            messageStart = 1;
        } else if (firstArg === "-list") {
            // List all threads
            return await this.listThreads(api, event, args[1] || "all", config);
        }

        // Get message content
        const broadcastMessage = args.slice(messageStart).join(" ").trim();

        if (!broadcastMessage) {
            const actualPrefix = config.bot.prefixEnabled ? config.bot.prefix : '';
            const commandName = this.config.name;
            return api.sendMessage(
                "❌ Please provide a message to broadcast.\n\n" +
                `Usage: \`${actualPrefix}${commandName} <message>\``,
                threadID,
                messageID
            );
        }

        // Confirm broadcast
        const filterText = filter === "all" ? "all threads" : 
            filter === "groups" ? "groups only" : 
            filter === "dms" ? "DMs only" : 
            filter === "school" ? "school GCs" : "threads";

        try {
            // Fetch threads
            const threads = await fetchThreads(api, filter);

            if (threads.length === 0) {
                return api.sendMessage(
                    `📭 No ${filterText} found to broadcast to.`,
                    threadID,
                    messageID
                );
            }

            // Filter out current thread (optional - you may want to include it)
            const targetThreads = threads.filter((t) => t.threadID !== threadID);

            if (targetThreads.length === 0) {
                return api.sendMessage(
                    `📭 No other threads found to broadcast to.`,
                    threadID,
                    messageID
                );
            }

            // Send confirmation
            const confirmMsg = await api.sendMessage(
                `📢 **Broadcasting to ${targetThreads.length} ${filterText}**\n\n` +
                `Message:\n"${broadcastMessage.substring(0, 100)}${broadcastMessage.length > 100 ? "..." : ""}"\n\n` +
                `⏳ Starting broadcast...`,
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
                    const formattedMessage = 
                        `📢 **BROADCAST**\n` +
                        `━━━━━━━━━━━━━━━━━━\n` +
                        `${broadcastMessage}\n` +
                        `━━━━━━━━━━━━━━━━━━`;

                    await api.sendMessage(formattedMessage, thread.threadID);
                    successCount++;
                    
                    logger?.debug?.("Broadcast", `Sent to ${getThreadName(thread)} (${thread.threadID})`);
                } catch (error) {
                    failCount++;
                    failedThreads.push({
                        name: getThreadName(thread),
                        id: thread.threadID,
                        error: error.message,
                    });
                    
                    logger?.debug?.("Broadcast", `Failed: ${getThreadName(thread)} - ${error.message}`);
                }

                // Delay between messages
                await sleep(MESSAGE_DELAY);
            }

            // Clear active broadcast
            activeBroadcasts.delete(senderID);

            // Try to unsend the "Starting broadcast" message
            try {
                if (confirmMsg?.messageID) {
                    await api.unsendMessage(confirmMsg.messageID);
                }
            } catch {
                // Ignore
            }

            // Send results
            let resultMessage = 
                `✅ **Broadcast Complete**\n\n` +
                `📤 Sent: ${successCount}/${targetThreads.length}\n`;

            if (failCount > 0) {
                resultMessage += `❌ Failed: ${failCount}\n\n`;
                
                if (failedThreads.length <= 5) {
                    resultMessage += `**Failed threads:**\n`;
                    for (const ft of failedThreads) {
                        resultMessage += `• ${ft.name}\n`;
                    }
                }
            }

            logger?.success?.("Broadcast", `Completed: ${successCount} sent, ${failCount} failed`);

            return api.sendMessage(resultMessage, threadID, messageID);

        } catch (error) {
            activeBroadcasts.delete(senderID);
            logger?.error?.("Broadcast", `Error: ${error.message}`);

            return api.sendMessage(
                `❌ Broadcast failed!\n\nError: ${error.message}`,
                threadID,
                messageID
            );
        }
    },

    /**
     * List all threads
     * @param {Object} api - Nero API object
     * @param {Object} event - Event object
     * @param {string} filter - Filter type
     */
    async listThreads(api, event, filter, config) {
        const threadID = event.threadID;
        const messageID = event.messageID;

        try {
            const threads = await fetchThreads(api, filter === "groups" ? "groups" : filter === "dms" ? "dms" : "all");

            if (threads.length === 0) {
                return api.sendMessage("📭 No threads found.", threadID, messageID);
            }

            let list = `📋 **Thread List** (${threads.length})\n\n`;

            const groups = threads.filter((t) => t.isGroup);
            const dms = threads.filter((t) => !t.isGroup);

            if (groups.length > 0) {
                list += `👥 **Groups (${groups.length}):**\n`;
                for (let i = 0; i < Math.min(groups.length, 10); i++) {
                    const g = groups[i];
                    list += `${i + 1}. ${getThreadName(g)}\n`;
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
                    list += `${i + 1}. ${getThreadName(d)}\n`;
                }
                if (dms.length > 10) {
                    list += `... and ${dms.length - 10} more\n`;
                }
            }

            return api.sendMessage(list, threadID, messageID);

        } catch (error) {
            return api.sendMessage(
                `❌ Failed to fetch threads: ${error.message}`,
                threadID,
                messageID
            );
        }
    },
};
