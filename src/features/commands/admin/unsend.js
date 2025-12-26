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
            // Set loading reaction
            api.setMessageReaction("⏳", messageID, () => {}, true);

            const unsentIDs = new Set();
            
            // 1. Unsend tracked messages first (Fastest, from memory)
            const trackedMessages = getTrackedMessages(threadID);
            
            for (const msg of trackedMessages) {
                try {
                    await api.unsendMessage(msg.messageID);
                    untrackMessage(threadID, msg.messageID);
                    unsentIDs.add(msg.messageID);
                } catch (error) {
                    logger?.debug?.("Unsend", `Failed to unsend tracked ${msg.messageID}: ${error.message}`);
                }
                // Small delay to avoid rate limiting
                await new Promise((r) => { setTimeout(r, 100); });
            }
            
            // Clear memory tracking
            clearThread(threadID);

            // 2. Scan recent history for untracked messages (e.g. from before restart)
            try {
                // Fetch last 50 messages
                const history = await api.getThreadHistory(threadID, 50);
                
                // Filter for messages sent by the bot that we haven't just unsent
                const botHistoryMessages = history.filter(
                    m => m.senderID === botID && !unsentIDs.has(m.messageID)
                );

                for (const msg of botHistoryMessages) {
                    try {
                        await api.unsendMessage(msg.messageID);
                        unsentIDs.add(msg.messageID);
                    } catch (error) {
                        logger?.debug?.("Unsend", `Failed to unsend history msg ${msg.messageID}: ${error.message}`);
                    }
                    // Small delay
                    await new Promise((r) => { setTimeout(r, 200); });
                }
            } catch (error) {
                logger?.debug?.("Unsend", `Failed to fetch history: ${error.message}`);
            }

            // Set completion reaction
            api.setMessageReaction("✅", messageID, () => {}, true);
            return;
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
            // Set loading reaction on the command message
            api.setMessageReaction("⏳", messageID, () => {}, true);

            await api.unsendMessage(targetMessageID);
            untrackMessage(threadID, targetMessageID);
            logger?.info?.("Unsend", `Unsent message ${targetMessageID} in thread ${threadID}`);
            
            // Set completion reaction
            api.setMessageReaction("✅", messageID, () => {}, true);
        } catch (error) {
            logger?.error?.("Unsend", `Failed to unsend: ${error.message}`);
            api.setMessageReaction("❌", messageID, () => {}, true);
        }
    },
};
