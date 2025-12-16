/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                            UNSEND COMMAND                                     ║
 * ║           Unsend bot messages by reply or unsend all recent messages          ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command allows admins to unsend bot messages:
 * - Reply to a bot message and use "unsend" to unsend that specific message
 * - Use "unsend all" to unsend all recent bot messages in the thread
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

// ═══════════════════════════════════════════════════════════════════════════════
//                              MESSAGE TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Track bot messages per thread for unsend functionality
 * @type {Map<string, Array<{messageID: string, timestamp: number}>>}
 */
const botMessages = new Map();

/** @type {number} Maximum messages to track per thread */
const MAX_MESSAGES_PER_THREAD = 50;

/** @type {number} Message expiry time: 1 hour */
const MESSAGE_EXPIRY = 60 * 60 * 1000;

/**
 * Track a sent bot message
 * @param {string} threadID - Thread ID
 * @param {string} messageID - Message ID
 */
function trackMessage(threadID, messageID) {
    if (!threadID || !messageID) return;

    const threadMessages = botMessages.get(threadID) || [];
    const now = Date.now();

    // Add new message
    threadMessages.unshift({
        messageID,
        timestamp: now,
    });

    // Remove expired messages
    const filtered = threadMessages.filter(
        (msg) => now - msg.timestamp < MESSAGE_EXPIRY
    );

    // Limit to max messages
    const limited = filtered.slice(0, MAX_MESSAGES_PER_THREAD);

    botMessages.set(threadID, limited);
}

/**
 * Get tracked messages for a thread
 * @param {string} threadID - Thread ID
 * @returns {Array} Array of tracked message objects
 */
function getTrackedMessages(threadID) {
    if (!threadID) return [];

    const threadMessages = botMessages.get(threadID) || [];
    const now = Date.now();

    // Filter expired messages
    return threadMessages.filter((msg) => now - msg.timestamp < MESSAGE_EXPIRY);
}

/**
 * Remove a message from tracking
 * @param {string} threadID - Thread ID
 * @param {string} messageID - Message ID to remove
 */
function untrackMessage(threadID, messageID) {
    if (!threadID || !messageID) return;

    const threadMessages = botMessages.get(threadID) || [];
    const filtered = threadMessages.filter((msg) => msg.messageID !== messageID);
    botMessages.set(threadID, filtered);
}

/**
 * Clear all tracked messages for a thread
 * @param {string} threadID - Thread ID
 */
function clearThread(threadID) {
    if (threadID) {
        botMessages.delete(threadID);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
//                              COMMAND EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    config: {
        name: "unsend",
        aliases: ["uns", "del", "delete", "remove"],
        description: "Unsend bot messages by reply or unsend all recent messages",
        usage: "unsend [reply] | unsend all",
        category: "admin",
        cooldown: 3,
        permissions: "admin",
        enabled: true,
        dmOnly: false,
        groupOnly: false,
    },

    // Export tracking functions for commandHandler
    trackMessage,
    getTrackedMessages,
    untrackMessage,
    clearThread,

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
        const botID = api.getCurrentUserID?.();

        // Check for "all" argument
        const unsendAll = args[0]?.toLowerCase() === "all";

        if (unsendAll) {
            // Unsend all recent bot messages in this thread
            const trackedMessages = getTrackedMessages(threadID);

            if (trackedMessages.length === 0) {
                return api.sendMessage(
                    "📭 No recent bot messages to unsend in this thread.",
                    threadID,
                    messageID
                );
            }

            let successCount = 0;
            let failCount = 0;

            // Send status message first
            const statusMsg = await api.sendMessage(
                `🗑️ Unsending ${trackedMessages.length} message(s)...`,
                threadID
            );

            // Unsend all tracked messages
            for (const msg of trackedMessages) {
                try {
                    await api.unsendMessage(msg.messageID);
                    untrackMessage(threadID, msg.messageID);
                    successCount++;
                } catch (error) {
                    logger?.debug?.("Unsend", `Failed to unsend ${msg.messageID}: ${error.message}`);
                    failCount++;
                }

                // Small delay to avoid rate limiting
                await new Promise((r) => { setTimeout(r, 100); });
            }

            // Clear all tracked messages for this thread
            clearThread(threadID);

            // Update status message
            const resultText = failCount > 0
                ? `✅ Unsent ${successCount} message(s), ❌ ${failCount} failed.`
                : `✅ Successfully unsent ${successCount} message(s).`;

            // Try to unsend the status message and send result
            try {
                if (statusMsg?.messageID) {
                    await api.unsendMessage(statusMsg.messageID);
                }
            } catch {
                // Ignore
            }

            return api.sendMessage(resultText, threadID, messageID);
        }

        // Single message unsend (requires reply)
        if (!messageReply) {
            const actualPrefix = config.bot.prefixEnabled ? config.bot.prefix : '';
            const commandName = this.config.name;
            return api.sendMessage(
                "📝 **Unsend Command Usage**\n\n" +
                `• Reply to a bot message and type \`${actualPrefix}${commandName}\` to unsend it\n` +
                `• Type \`${actualPrefix}${commandName} all\` to unsend all recent bot messages\n\n` +
                "Note: Only bot messages can be unsent.",
                threadID,
                messageID
            );
        }

        // Check if the replied message is from the bot
        const repliedSenderID = messageReply.senderID;

        if (repliedSenderID !== botID) {
            return api.sendMessage(
                "❌ I can only unsend my own messages!\n\n" +
                "Please reply to one of my messages to unsend it.",
                threadID,
                messageID
            );
        }

        // Attempt to unsend the message
        const targetMessageID = messageReply.messageID;

        try {
            await api.unsendMessage(targetMessageID);
            untrackMessage(threadID, targetMessageID);

            logger?.info?.("Unsend", `Unsent message ${targetMessageID} in thread ${threadID}`);

            // Send confirmation (will auto-delete after 3 seconds)
            const confirmMsg = await api.sendMessage("✅ Message unsent!", threadID);

            // Auto-delete confirmation after 3 seconds
            setTimeout(async () => {
                try {
                    if (confirmMsg?.messageID) {
                        await api.unsendMessage(confirmMsg.messageID);
                    }
                } catch {
                    // Ignore - message might already be deleted
                }
            }, 3000);

        } catch (error) {
            logger?.error?.("Unsend", `Failed to unsend: ${error.message}`);

            return api.sendMessage(
                `❌ Failed to unsend message!\n\n` +
                `Error: ${error.message || "Unknown error"}\n\n` +
                "This might happen if:\n" +
                "• The message is too old\n" +
                "• The message was already unsent\n" +
                "• There's a network issue",
                threadID,
                messageID
            );
        }
    },
};
