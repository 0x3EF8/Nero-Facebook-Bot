/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                       REACTION COPY EVENT HANDLER                             ║
 * ║             Automatically mimics reactions from other users                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * Features:
 * - Copies reactions from other users to appear engaged
 * - Human-like delay (0.5-1.5 seconds) for natural behavior
 * - Prevents duplicate reactions on same message
 * - Memory-efficient with automatic cache cleanup
 * - Error recovery with automatic retry
 *
 * Behavior:
 * - When someone reacts → Bot reacts with same emoji
 * - Delay: 500-1500ms (random for human-like timing)
 * - One reaction per message (no spam)
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

// ═══════════════════════════════════════════════════════════════════════════════
//                              CACHE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/** @type {Set<string>} Track messages already reacted to */
const reactedMessages = new Set();

/** @type {number} Maximum messages to track */
const REACTION_CACHE_MAX = 500;

/**
 * Clean up reaction cache when limit is reached
 * Removes oldest entries using FIFO strategy
 */
function cleanupReactionCache() {
    if (reactedMessages.size > REACTION_CACHE_MAX) {
        const entriesToRemove = reactedMessages.size - REACTION_CACHE_MAX;
        const iterator = reactedMessages.values();

        for (let i = 0; i < entriesToRemove; i++) {
            const oldestItem = iterator.next().value;
            reactedMessages.delete(oldestItem);
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
//                              EVENT HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    config: {
        name: "reactionCopy",
        description: "Automatically copies reactions from other users to mimic engagement",
        eventTypes: ["message_reaction"],
        priority: 30,
        enabled: true,
    },

    /**
     * Event execution function
     * @param {Object} context - Event context
     * @param {Object} context.api - Nero API object
     * @param {Object} context.event - Event object
     * @param {Object} context.logger - Logger utility
     */
    async execute({ api, event, logger }) {
        try {
            // Get bot's user ID
            const botID = api.getCurrentUserID?.();
            if (!botID) return;

            // Don't copy bot's own reactions
            if (event.senderID === botID) return;

            // Check if bot has already reacted to this message
            if (reactedMessages.has(event.messageID)) return;

            // Validate reaction data
            if (!event.reaction || !event.messageID) {
                logger?.debug?.("ReactionCopy", "Invalid reaction event - missing data");
                return;
            }

            // ───────────────────────────────────────────────────────────────────
            // COPY REACTION WITH HUMAN-LIKE DELAY
            // ───────────────────────────────────────────────────────────────────

            // Mark as reacted immediately to prevent duplicates
            reactedMessages.add(event.messageID);

            // Clean up cache if needed
            cleanupReactionCache();

            // Calculate human-like delay (0.5-1.5 seconds)
            const baseDelay = 500;
            const randomDelay = Math.random() * 1000; // 0-1000ms
            const totalDelay = baseDelay + randomDelay;

            // Apply reaction after delay
            setTimeout(() => {
                api.setMessageReaction(
                    event.reaction,
                    event.messageID,
                    (err) => {
                        if (err) {
                            logger?.error?.(
                                "ReactionCopy",
                                `Error copying reaction: ${err.message || err}`
                            );
                            // Remove from cache on failure so it can be retried
                            reactedMessages.delete(event.messageID);
                        } else {
                            logger?.debug?.("ReactionCopy", `Copied reaction: ${event.reaction}`);
                        }
                    },
                    true // Is reaction
                );
            }, totalDelay);
        } catch (error) {
            logger?.error?.("ReactionCopy", `Handler error: ${error.message || error}`);
            // Remove from cache on error
            if (event?.messageID) {
                reactedMessages.delete(event.messageID);
            }
        }
    },
};
