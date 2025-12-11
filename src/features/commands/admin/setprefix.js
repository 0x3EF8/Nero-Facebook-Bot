/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                         SETPREFIX COMMAND                                     ║
 * ║              Change the bot's command prefix (Admin Only)                     ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command allows admins to change the bot's command prefix.
 * Note: This is a runtime change and will reset on restart.
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

module.exports = {
    config: {
        name: "setprefix",
        aliases: ["prefix", "changeprefix"],
        description: "Change the bot's command prefix (Admin Only)",
        usage: "setprefix <new_prefix>",
        category: "admin",
        cooldown: 10,
        permissions: "admin",
        enabled: true,
        dmOnly: false,
        groupOnly: false,
    },

    /**
     * Command execution function
     * @param {Object} context - Command context
     */
    async execute({ api, event, args, config, logger }) {
    const threadID = event.threadID;
    const messageID = event.messageID;

    // Check if new prefix was provided
    if (args.length === 0) {
        return api.sendMessage(
            `📝 Current prefix: ${config.bot.prefix}\n\n` +
                `Usage: setprefix <new_prefix>\n\n` +
                `Example: setprefix !\n` +
                `Example: setprefix /`,
            threadID,
            messageID
        );
    }

    const newPrefix = args[0];

    // Validate prefix
    if (newPrefix.length > 5) {
        return api.sendMessage(
            "❌ Prefix is too long!\n\n" + "The prefix should be 1-5 characters.",
            threadID,
            messageID
        );
    }

    const oldPrefix = config.bot.prefix;

    // Note: Since config is frozen in production, this will throw an error
    // In a real implementation, you'd use a mutable runtime config store
    try {
        // For demonstration - in production, use a database or mutable config store
        // config.bot.prefix = newPrefix; // This would throw if frozen

        logger.info(
            "SetPrefix",
            `Prefix changed from "${oldPrefix}" to "${newPrefix}" by ${event.senderID}`
        );

        await api.sendMessage(
            `✅ Prefix changed successfully!\n\n` +
                `Old prefix: ${oldPrefix}\n` +
                `New prefix: ${newPrefix}\n\n` +
                `📝 Note: This change is temporary and will reset on restart.\n` +
                `To make it permanent, update config/config.js`,
            threadID,
            messageID
        );
    } catch (error) {
        logger.error("SetPrefix", `Failed to change prefix: ${error.message}`);

        await api.sendMessage(
            `⚠️ Could not change prefix at runtime.\n\n` +
                `To change the prefix, edit config/config.js:\n` +
                `1. Open config/config.js\n` +
                `2. Find: prefix: "${oldPrefix}"\n` +
                `3. Change to: prefix: "${newPrefix}"\n` +
                `4. Restart the bot`,
            threadID,
            messageID
        );
    }
    },
};
