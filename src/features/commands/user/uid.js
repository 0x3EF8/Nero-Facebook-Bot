/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                            UID COMMAND                                        ║
 * ║              Get user ID (Facebook UID) for users                             ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command retrieves the Facebook User ID of the sender,
 * mentioned user, or replied-to user.
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

module.exports = {
    config: {
        name: "uid",
        aliases: ["userid", "id", "fbid"],
        description: "Get Facebook User ID",
        usage: "uid [@mention or reply]",
        category: "user",
        cooldown: 5,
        permissions: "user",
        enabled: true,
        dmOnly: false,
        groupOnly: false,
    },

    /**
     * Command execution function
     * @param {Object} context - Command context
     */
    async execute({ api, event }) {
        const threadID = event.threadID;
        const messageID = event.messageID ? String(event.messageID) : null;

        let targetID = event.senderID;
        let targetType = "Your";

        // Check if replying to someone
        if (event.messageReply && event.messageReply.senderID) {
            targetID = event.messageReply.senderID;
            targetType = "Replied user's";
        }
        // Check if mentioning someone
        else if (event.mentions && Object.keys(event.mentions).length > 0) {
            targetID = Object.keys(event.mentions)[0];
            targetType = "Mentioned user's";
        }

        // Try to get user info using Promise
        try {
            const info = await api.getUserInfo(targetID);

            // Handle different response formats
            let name = "Unknown";
            if (info) {
                if (info.name) {
                    name = info.name;
                } else if (info[targetID] && info[targetID].name) {
                    name = info[targetID].name;
                }
            }

            const response =
                `👤 User Information\n\n` + `📛 Name: ${name}\n` + `🔢 User ID: ${targetID}`;

            await api.sendMessage(response, threadID, null, messageID);
        } catch {
            // Fallback - just show the ID
            await api.sendMessage(`🔢 ${targetType} User ID:\n${targetID}`, threadID, null, messageID);
        }
    },
};
