/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                            LEAVE COMMAND                                      ║
 * ║                  Makes the bot leave the current group                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

module.exports = {
    config: {
        name: "leave",
        aliases: ["out", "left"],
        description: "Makes the bot leave the current group chat",
        usage: "leave",
        category: "admin",
        cooldown: 5,
        permissions: "admin",
        enabled: true,
        dmOnly: false,
        groupOnly: true,
    },

    async execute({ api, event, logger }) {
        const { threadID } = event;

        try {
            await api.sendMessage("👋 Goodbye! Leaving the group now...", threadID);

            // Wait a moment for the message to be sent
            await new Promise((resolve) => {
                setTimeout(resolve, 1000);
            });

            const botID = api.getCurrentUserID();
            // Use gcmember to remove the bot (itself) from the group
            if (api.gcmember) {
                await api.gcmember("remove", botID, threadID);
                logger.info("Leave Command", `Left group ${threadID}`);
            } else {
                throw new Error("gcmember API not available");
            }
        } catch (error) {
            logger.error("Leave Command", error);
            api.sendMessage(`❌ Failed to leave group: ${error.message}`, threadID);
        }
    },
};
