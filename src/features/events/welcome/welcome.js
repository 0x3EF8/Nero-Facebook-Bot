/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                          WELCOME EVENT HANDLER                                ║
 * ║         Handles new member joins and sends welcome messages                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This event handler triggers when a new member joins a group,
 * sending a customizable welcome message to greet them.
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

/**
 * Welcome message templates
 * You can customize these or add more variations
 */
const welcomeTemplates = [
    "👋 Welcome to the group, {name}!\n\nWe're glad to have you here. Feel free to introduce yourself!",
    "🎉 Hey {name}, welcome aboard!\n\nMake yourself at home and don't be shy to participate in our conversations!",
    "✨ {name} just joined the party!\n\nWelcome to the group! We hope you enjoy your stay.",
    "🌟 A warm welcome to {name}!\n\nWe're excited to have you as part of our community!",
];

/**
 * Gets a random welcome message
 * @param {string} name - User's name
 * @returns {string}
 */
function getRandomWelcome(name) {
    const template = welcomeTemplates[Math.floor(Math.random() * welcomeTemplates.length)];
    return template.replace(/{name}/g, name);
}

module.exports = {
    config: {
        name: "welcome",
        description: "Sends welcome messages when new members join",
        eventTypes: ["event"], // Facebook event type for participant changes
        priority: 10,
        enabled: false,
    },

    /**
     * Event execution function
     * @param {Object} context - Event context
     * @param {Object} context.api - Nero API object
     * @param {Object} context.event - Event object
     * @param {Object} context.config - Bot configuration
     * @param {Object} context.logger - Logger utility
     */
    async execute({ api, event, logger }) {
        // Only handle participant addition events
        if (event.logMessageType !== "log:subscribe") {
            return;
        }

        const threadID = event.threadID;

        // Get the added participants
        const addedParticipants = event.logMessageData?.addedParticipants || [];

        if (addedParticipants.length === 0) {
            return;
        }

        // Get bot's user ID to avoid welcoming itself
        const botID = api.getCurrentUserID ? api.getCurrentUserID() : null;

        // Process each new member
        for (const participant of addedParticipants) {
            const userID = participant.userFbId;
            const fullName = participant.fullName || "Friend";

            // Don't welcome the bot itself
            if (botID && userID === botID) {
                logger.debug("Welcome", `Skipping self-welcome in thread ${threadID}`);
                continue;
            }

            // Generate welcome message
            const welcomeMessage = getRandomWelcome(fullName);

            try {
                // Send welcome message
                await api.sendMessage(welcomeMessage, threadID);

                logger.info("Welcome", `Welcomed ${fullName} (${userID}) to thread ${threadID}`);
            } catch (error) {
                logger.error("Welcome", `Failed to send welcome message: ${error.message}`);
            }
        }
    },
};
