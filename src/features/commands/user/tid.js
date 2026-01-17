/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                            TID COMMAND                                        ║
 * ║                  Get Thread ID (Group ID) for the chat                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command retrieves the Thread ID (TID) of the current conversation.
 * Useful for configuring group-specific settings.
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

module.exports = {
    config: {
        name: "tid",
        aliases: ["threadid", "groupid", "gid"],
        description: "Get the Thread ID (Group ID) of the current chat",
        usage: "tid",
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

        try {
            // Get thread info to possibly show the group name
            const threadInfo = await api.getThreadInfo(threadID);
            const threadName = threadInfo.threadName || "Unnamed Group";
            const isGroup = threadInfo.isGroup;
            const participantCount = threadInfo.participantIDs ? threadInfo.participantIDs.length : 0;

            const response =
                `📂 Thread Information\n\n` +
                `📛 Name: ${threadName}\n` +
                `🆔 Thread ID: ${threadID}\n` +
                `👥 Type: ${isGroup ? "Group Chat" : "Direct Message"}\n` +
                `👤 Participants: ${participantCount}`;

            await api.sendMessage(response, threadID, messageID);
        } catch {
            // Fallback - just show the ID if getThreadInfo fails
            await api.sendMessage(
                `🆔 Thread ID:\n${threadID}`,
                threadID,
                messageID
            );
        }
    },
};
