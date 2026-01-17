/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                          THREADS LIST COMMAND                                 ║
 * ║              List all active group chats and their Thread IDs                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command allows admins to see a list of all groups the bot is in.
 * Useful for obtaining IDs for the broadcast -c command.
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

module.exports = {
    config: {
        name: "threads",
        aliases: ["groups", "listgc", "gclist"],
        description: "List all group chats and their IDs",
        usage: "threads [limit]",
        category: "admin",
        cooldown: 5,
        permissions: "admin",
        enabled: true,
        dmOnly: false,
        groupOnly: false,
    },

    /**
     * Command execution function
     * @param {Object} context - Command context
     */
    async execute({ api, event, args, logger }) {
        const threadID = event.threadID;
        const messageID = event.messageID;

        try {
            const limit = parseInt(args[0]) || 50;

            api.sendMessage("⏳ Fetching group list...", threadID, messageID);

            // Fetch threads from inbox
            const threads = await api.getThreadList(limit, null, ["INBOX"]);

            if (!threads || threads.length === 0) {
                return api.sendMessage("📭 No active threads found.", threadID, messageID);
            }

            // Filter only group chats
            const groups = threads.filter((t) => t.isGroup);

            if (groups.length === 0) {
                return api.sendMessage(
                    "👥 No group chats found in the last " + limit + " threads.",
                    threadID,
                    messageID
                );
            }

            let msg = `👥 **GROUP CHAT LIST** (${groups.length})\n`;
            msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

            groups.forEach((g, index) => {
                const name = g.threadName || g.name || "Unnamed Group";
                msg += `${index + 1}. **${name}**\n`;
                msg += `🆔 ID: \`${g.threadID}\`\n\n`;
            });

            msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            msg += `💡 *Tip: Copy the ID for use in /broadcast -c*`;

            // If message is too long, it might fail. Break it down if needed,
            // but for 50 groups it should be fine.
            return api.sendMessage(msg, threadID, messageID);
        } catch (error) {
            logger.error("ThreadsCommand", `Error: ${error.message}`);
            return api.sendMessage(
                `❌ Failed to fetch threads: ${error.message}`,
                threadID,
                messageID
            );
        }
    },
};
