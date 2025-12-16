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

    // Format for API: { "Option Name": false } (Standard FCA format)
    const pollOptions = options.reduce((acc, opt) => {
        acc[opt] = false; 
        return acc;
    }, {});

    try {
        await api.createPoll(threadID, question, pollOptions);
        api.setMessageReaction(REACTIONS.success, messageID, () => {}, true);
        return true;
    } catch (error) {
        console.error(chalk.red(` ├─✗ Poll error: ${error.message}`));
        
        // Fallback: Try array format { text: "Option" } (Some API versions)
        try {
            const fallbackOptions = options.map(text => ({ text }));
            await api.createPoll(threadID, question, fallbackOptions);
            api.setMessageReaction(REACTIONS.success, messageID, () => {}, true);
            return true;
        } catch (err2) {
            api.setMessageReaction(REACTIONS.error, messageID, () => {}, true);
            await api.sendMessage(`❌ Failed to create poll: ${error.message}`, threadID, messageID);
            return false;
        }
    }
}

module.exports = {
    createPoll,
};
