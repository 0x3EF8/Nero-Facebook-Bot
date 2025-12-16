/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                         MENTION RESPONSE EVENT                                ║
 * ║          Responds when the bot is mentioned in a message                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This event handler triggers when someone mentions the bot,
 * responding with a friendly hello message.
 *
 * @author 0x3EF8
 * @version 1.0.1
 */

"use strict";

module.exports = {
    config: {
        name: "mentionResponse",
        description: "Responds when the bot is mentioned",
        eventTypes: ["message"],
        priority: 5,
        enabled: true,
    },

    /**
     * Event execution function
     * @param {Object} context - Event context
     */
    async execute({ api, event, logger }) {
    // Get bot's user ID
    const botID = api.getCurrentUserID ? api.getCurrentUserID() : null;

    if (!botID) {
        return;
    }

    // Check if bot was mentioned
    const mentions = event.mentions || {};
    const wasMentioned = Object.keys(mentions).includes(botID);

    if (!wasMentioned) {
        return;
    }

    const threadID = event.threadID;
    const messageID = event.messageID;

    try {
        api.sendMessage(
            `Hello! 👋`,
            threadID,
            messageID
        );
        logger.debug("MentionResponse", `Responded to mention in thread ${threadID}`);
    } catch (error) {
        logger.error("MentionResponse", `Failed to respond to mention: ${error.message}`);
    }
    },
};
