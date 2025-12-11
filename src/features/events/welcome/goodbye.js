/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                          GOODBYE EVENT HANDLER                                ║
 * ║          Handles member departures and sends goodbye messages                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This event handler triggers when a member leaves a group,
 * sending a farewell message.
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

/**
 * Goodbye message templates
 */
const goodbyeTemplates = [
    "👋 {name} has left the group. We'll miss you!",
    "😢 Goodbye {name}! Hope to see you again someday.",
    "🚪 {name} has departed. Take care out there!",
    "💔 {name} is no longer with us. Farewell, friend!",
];

/**
 * Gets a random goodbye message
 * @param {string} name - User's name
 * @returns {string}
 */
function getRandomGoodbye(name) {
    const template = goodbyeTemplates[Math.floor(Math.random() * goodbyeTemplates.length)];
    return template.replace(/{name}/g, name);
}

module.exports = {
    config: {
        name: "goodbye",
        description: "Sends goodbye messages when members leave",
        eventTypes: ["event"],
        priority: 10,
        enabled: false,
    },

    /**
     * Event execution function
     * @param {Object} context - Event context
     */
    async execute({ api, event, _config, logger }) {
    // Only handle participant removal events
    if (event.logMessageType !== "log:unsubscribe") {
        return;
    }

    const threadID = event.threadID;

    // Get the removed participant
    const leftParticipantFbId = event.logMessageData?.leftParticipantFbId;

    if (!leftParticipantFbId) {
        return;
    }

    // Get bot's user ID
    const botID = api.getCurrentUserID ? api.getCurrentUserID() : null;

    // Don't send goodbye for the bot itself
    if (botID && leftParticipantFbId === botID) {
        return;
    }

    // Try to get user's name
    let userName = "Someone";

    try {
        const userInfo = await new Promise((resolve, reject) => {
            api.getUserInfo([leftParticipantFbId], (err, info) => {
                if (err) reject(err);
                else resolve(info);
            });
        });

        if (userInfo && userInfo[leftParticipantFbId]) {
            userName = userInfo[leftParticipantFbId].name || userName;
        }
    } catch {
        // Use default name if getUserInfo fails
    }

    // Generate and send goodbye message
    const goodbyeMessage = getRandomGoodbye(userName);

    try {
        await new Promise((resolve, reject) => {
            api.sendMessage(goodbyeMessage, threadID, (err, info) => {
                if (err) reject(err);
                else resolve(info);
            });
        });

        logger.info(
            "Goodbye",
            `Said goodbye to ${userName} (${leftParticipantFbId}) in thread ${threadID}`
        );
    } catch (error) {
        logger.error("Goodbye", `Failed to send goodbye message: ${error.message}`);
    }
    },
};
