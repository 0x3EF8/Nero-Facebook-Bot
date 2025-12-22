/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                          POLL SERVICE MODULE                                  ║
 * ║                   Handles poll creation logic for AI                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module services/poll
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const chalk = require("chalk");
const { REACTIONS } = require("../core/constants");

/**
 * Create a poll in the thread
 * @param {Object} api - Facebook API instance
 * @param {string} threadID - Thread identifier
 * @param {string} messageID - Message ID for reactions
 * @param {string} question - Poll question
 * @param {Array<string>} options - Poll options
 * @returns {Promise<boolean>} Success status
 */
async function createPoll(api, threadID, messageID, question, options) {
    console.log(chalk.cyan(` ├─📊 Creating poll: "${question}"`));
    api.setMessageReaction("📊", messageID, () => {}, true);

    // 1. Deduplicate and clean options
    const uniqueOptions = [...new Set(options.map(o => o.trim()).filter(Boolean))];

    // 2. Ensure at least 2 options
    if (uniqueOptions.length < 2) {
        // If only 1 option provided (e.g. "Yes"), add "No" automatically
        if (uniqueOptions.length === 1) {
            uniqueOptions.push("No");
        } else {
             // Fallback default options
            uniqueOptions.push("Yes", "No");
        }
    }

    try {
        // API expects Array<string> or Array<Object>
        // passing strings directly is supported by nero-core
        await api.createPoll(threadID, question, uniqueOptions);
        
        api.setMessageReaction(REACTIONS.success, messageID, () => {}, true);
        return true;
    } catch (error) {
        console.error(chalk.red(` ├─✗ Poll error: ${error.message}`));
        api.setMessageReaction(REACTIONS.error, messageID, () => {}, true);
        await api.sendMessage(`❌ Failed to create poll: ${error.message}`, threadID, messageID);
        return false;
    }
}

module.exports = {
    createPoll,
};
