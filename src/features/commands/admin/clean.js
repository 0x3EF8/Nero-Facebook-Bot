/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                            CLEAN COMMAND                                      ║
 * ║         Delete all conversations (groups and DMs) from inbox                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command allows admins to clean up conversations:
 * - Delete all threads (groups and DMs)
 * - Delete only groups
 * - Delete only DMs
 *
 * WARNING: This is destructive and cannot be undone!
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

/** @type {number} Delay between deletions (ms) to avoid rate limiting */
const DELETE_DELAY = 500;

/** @type {Map<string, boolean>} Track ongoing clean operations */
const activeCleans = new Map();

/** @type {string[]} Protected thread IDs (won't be deleted) */
const PROTECTED_THREADS = [
    "24052714344355754",  // School GC 1
    "24425853360351937",  // School GC 2
];

// ═══════════════════════════════════════════════════════════════════════════════
//                              HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch all threads
 * @param {Object} api - Nero API object
 * @param {string} filter - Filter type: 'all', 'groups', 'dms'
 * @returns {Promise<Array>} Array of thread objects
 */
async function fetchThreads(api, filter = "all") {
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
        name: "clean",
        aliases: ["clear", "deleteall", "cleaninbox"],
        description: "Delete all conversations from inbox",
        usage: "clean <all|groups|dms> [confirm]",
        category: "admin",
        cooldown: 60,
        permissions: "superadmin",
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
    async execute({ api, event, args, logger }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const senderID = event.senderID;

        // Check if clean is already running
        if (activeCleans.get(senderID)) {
            return api.sendMessage(
                "⚠️ You already have an active clean operation running.\nPlease wait for it to complete.",
                threadID,
                messageID
            );
        }

        // Show usage if no arguments
        if (args.length === 0) {
            return api.sendMessage(
                "🧹 **Clean Command**\n\n" +
                "Delete conversations from your inbox.\n\n" +
                "⚠️ **WARNING:** This is destructive and cannot be undone!\n\n" +
                "**Usage:**\n" +
                "• `clean all confirm` - Delete ALL threads\n" +
                "• `clean groups confirm` - Delete groups only\n" +
                "• `clean dms confirm` - Delete DMs only\n" +
                "• `clean list` - Preview threads before deleting\n\n" +
                "**Protected Threads:**\n" +
                "School GCs are protected and won't be deleted.",
                threadID,
                messageID
            );
        }

        // Parse arguments
        const filterArg = args[0].toLowerCase();
        const confirmArg = args[1]?.toLowerCase();

        // List threads
        if (filterArg === "list") {
            return await this.listThreads(api, event, args[1] || "all");
        }

        // Validate filter
        if (!["all", "groups", "dms"].includes(filterArg)) {
            return api.sendMessage(
                "❌ Invalid option.\n\n" +
                "Use: `clean all`, `clean groups`, or `clean dms`",
                threadID,
                messageID
            );
        }

        // Require confirmation
        if (confirmArg !== "confirm") {
            const filterText = filterArg === "all" ? "ALL threads" : 
                filterArg === "groups" ? "all GROUPS" : "all DMs";

            return api.sendMessage(
                `⚠️ **Confirmation Required**\n\n` +
                `You are about to delete ${filterText}.\n\n` +
                `This action CANNOT be undone!\n\n` +
                `To confirm, type:\n` +
                `\`clean ${filterArg} confirm\``,
                threadID,
                messageID
            );
        }

        try {
            // Fetch threads
            const threads = await fetchThreads(api, filterArg);

            if (threads.length === 0) {
                return api.sendMessage(
                    "📭 No threads found to delete.",
                    threadID,
                    messageID
                );
            }

            // Filter out protected threads and current thread
            const targetThreads = threads.filter((t) => 
                t.threadID !== threadID && 
                !PROTECTED_THREADS.includes(t.threadID)
            );

            if (targetThreads.length === 0) {
                return api.sendMessage(
                    "📭 No threads to delete (all are protected or current).",
                    threadID,
                    messageID
                );
            }

            const protectedCount = threads.length - targetThreads.length;

            // Send status
            const statusMsg = await api.sendMessage(
                `🧹 **Starting cleanup...**\n\n` +
                `📋 Threads to delete: ${targetThreads.length}\n` +
                `🛡️ Protected: ${protectedCount}\n\n` +
                `⏳ This may take a while...`,
                threadID
            );

            // Mark as active
            activeCleans.set(senderID, true);

            let successCount = 0;
            let failCount = 0;
            const failedThreads = [];

            logger?.info?.("Clean", `Starting deletion of ${targetThreads.length} threads`);

            // Check if deleteThread API exists
            if (!api.deleteThread) {
                activeCleans.delete(senderID);
                return api.sendMessage(
                    "❌ Delete thread API not available.\n\n" +
                    "The bot needs to be restarted to load the new API.",
                    threadID,
                    messageID
                );
            }

            // Delete threads one by one
            for (const thread of targetThreads) {
                try {
                    await api.deleteThread(thread.threadID);
                    successCount++;
                    
                    logger?.debug?.("Clean", `Deleted: ${getThreadName(thread)} (${thread.threadID})`);
                } catch (error) {
                    failCount++;
                    failedThreads.push({
                        name: getThreadName(thread),
                        id: thread.threadID,
                        error: error.message,
                    });
                    
                    logger?.debug?.("Clean", `Failed: ${getThreadName(thread)} - ${error.message}`);
                }

                // Delay between deletions
                await sleep(DELETE_DELAY);
            }

            // Clear active status
            activeCleans.delete(senderID);

            // Try to unsend status message
            try {
                if (statusMsg?.messageID) {
                    await api.unsendMessage(statusMsg.messageID);
                }
            } catch {
                // Ignore
            }

            // Send results
            let resultMessage = 
                `✅ **Cleanup Complete**\n\n` +
                `🗑️ Deleted: ${successCount}/${targetThreads.length}\n` +
                `🛡️ Protected: ${protectedCount}\n`;

            if (failCount > 0) {
                resultMessage += `❌ Failed: ${failCount}\n`;
            }

            logger?.success?.("Clean", `Completed: ${successCount} deleted, ${failCount} failed`);

            return api.sendMessage(resultMessage, threadID, messageID);

        } catch (error) {
            activeCleans.delete(senderID);
            logger?.error?.("Clean", `Error: ${error.message}`);

            return api.sendMessage(
                `❌ Cleanup failed!\n\nError: ${error.message}`,
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
    async listThreads(api, event, filter) {
        const threadID = event.threadID;
        const messageID = event.messageID;

        try {
            const validFilter = ["groups", "dms"].includes(filter) ? filter : "all";
            const threads = await fetchThreads(api, validFilter);

            if (threads.length === 0) {
                return api.sendMessage("📭 No threads found.", threadID, messageID);
            }

            // Separate protected and deletable
            const deletable = threads.filter((t) => 
                t.threadID !== threadID && 
                !PROTECTED_THREADS.includes(t.threadID)
            );
            const protectedList = threads.filter((t) => 
                PROTECTED_THREADS.includes(t.threadID)
            );

            let list = `📋 **Thread Preview** (${threads.length} total)\n\n`;

            const groups = deletable.filter((t) => t.isGroup);
            const dms = deletable.filter((t) => !t.isGroup);

            if (groups.length > 0) {
                list += `👥 **Groups (${groups.length}):**\n`;
                for (let i = 0; i < Math.min(groups.length, 10); i++) {
                    list += `• ${getThreadName(groups[i])}\n`;
                }
                if (groups.length > 10) {
                    list += `... and ${groups.length - 10} more\n`;
                }
                list += `\n`;
            }

            if (dms.length > 0) {
                list += `👤 **DMs (${dms.length}):**\n`;
                for (let i = 0; i < Math.min(dms.length, 10); i++) {
                    list += `• ${getThreadName(dms[i])}\n`;
                }
                if (dms.length > 10) {
                    list += `... and ${dms.length - 10} more\n`;
                }
                list += `\n`;
            }

            if (protectedList.length > 0) {
                list += `🛡️ **Protected (${protectedList.length}):**\n`;
                for (const t of protectedList) {
                    list += `• ${getThreadName(t)}\n`;
                }
            }

            list += `\n⚠️ Total deletable: ${deletable.length}`;

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
