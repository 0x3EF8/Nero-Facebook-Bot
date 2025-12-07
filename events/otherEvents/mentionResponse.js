/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                         MENTION RESPONSE EVENT                                ║
 * ║          Responds when the bot is mentioned in a message                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 * 
 * This event handler triggers when someone mentions the bot,
 * providing helpful information on how to use it.
 * 
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

/**
 * Event configuration
 */
module.exports.config = {
    name: "mentionResponse",
    description: "Responds when the bot is mentioned",
    eventTypes: ["message"],
    priority: 5,
    enabled: false,
};

/**
 * Event execution function
 * @param {Object} context - Event context
 */
module.exports.execute = async function({ api, event, config, logger }) {
    // Check if mention response is enabled
    if (!config.features.mentionResponse) {
        return;
    }
    
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
        api.sendMessage(`Hello! I'm ${config.bot.name}. Use ${config.bot.prefix}help to see what I can do!`, threadID, messageID);
        logger.debug("MentionResponse", `Responded to mention in thread ${threadID}`);
    } catch (error) {
        logger.error("MentionResponse", `Failed to respond to mention: ${error.message}`);
    }
};
