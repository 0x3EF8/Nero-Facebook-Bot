/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                              BIO COMMAND                                      ║
 * ║              Update the bot's Facebook bio/intro text                         ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command allows admins to update the bot's Facebook bio/intro.
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

// ═══════════════════════════════════════════════════════════════════════════════
//                              COMMAND EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    config: {
        name: "bio",
        aliases: ["setbio", "intro", "about"],
        description: "Update the bot's Facebook bio/intro",
        usage: "bio <text> | bio -clear",
        category: "admin",
        cooldown: 30,
        permissions: "admin",
        enabled: true,
        dmOnly: false,
        groupOnly: false,
    },

    /**
     * Command execution function
     * @param {Object} context - Command context
     * @param {Object} context.api - Nero API object
     * @param {Object} context.event - Event object
     * @param {Array} context.args - Command arguments
     * @param {Object} context.logger - Logger utility
     */
    async execute({ api, event, args, config, logger }) {
        const threadID = event.threadID;
        const messageID = event.messageID;

        // Show usage if no arguments
        if (args.length === 0) {
            const actualPrefix = config.bot.prefixEnabled ? config.bot.prefix : '';
            const commandName = this.config.name;
            return api.sendMessage(
                "📝 **Bio Command**\n\n" +
                "Update the bot's Facebook bio/intro.\n\n" +
                "**Usage:**\n" +
                `• \`${actualPrefix}${commandName} <text>\` - Set new bio\n` +
                `• \`${actualPrefix}${commandName} -clear\` - Clear bio\n\n` +
                "**Notes:**\n" +
                "• Maximum 101 characters\n" +
                "• Emojis are supported 🎉\n\n" +
                "**Examples:**\n" +
                `• \`${actualPrefix}${commandName} Hello, I'm Nero Bot! 🤖\`\n` +
                `• \`${actualPrefix}${commandName} Living my best life ✨\``,
                threadID,
                messageID
            );
        }

        // Check if setBio API exists
        if (!api.setBio) {
            return api.sendMessage(
                "❌ Bio API not available.\n\n" +
                "The bot needs to be restarted to load the new API.",
                threadID,
                messageID
            );
        }

        // Parse arguments
        let bioText = args.join(" ").trim();

        // Handle clear command
        if (bioText === "-clear" || bioText === "clear") {
            bioText = "";
        }

        // Validate bio length
        if (bioText.length > 101) {
            return api.sendMessage(
                `❌ Bio is too long!\n\n` +
                `📏 Your bio: ${bioText.length} characters\n` +
                `📏 Maximum: 101 characters\n\n` +
                `Please shorten your bio by ${bioText.length - 101} characters.`,
                threadID,
                messageID
            );
        }

        // Send "updating" status
        const statusMsg = await api.sendMessage(
            `📝 Updating bio...`,
            threadID
        );

        try {
            // Update bio
            await api.setBio(bioText);

            // Unsend status
            if (statusMsg?.messageID) {
                try {
                    await api.unsendMessage(statusMsg.messageID);
                } catch {
                    // Ignore
                }
            }

            logger?.success?.("Bio", `Updated bio: "${bioText.substring(0, 30)}..."`);

            let successMessage = `✅ **Bio Updated Successfully!**\n\n`;
            if (bioText) {
                successMessage += `📝 New bio: "${bioText}"\n`;
                successMessage += `📏 Length: ${bioText.length}/101 characters`;
            } else {
                successMessage += `📝 Bio has been cleared.`;
            }

            return api.sendMessage(successMessage, threadID, messageID);

        } catch (error) {
            // Unsend status
            if (statusMsg?.messageID) {
                try {
                    await api.unsendMessage(statusMsg.messageID);
                } catch {
                    // Ignore
                }
            }

            logger?.error?.("Bio", `Failed to update bio: ${error.message}`);

            return api.sendMessage(
                `❌ Failed to update bio!\n\n` +
                `Error: ${error.message || "Unknown error"}`,
                threadID,
                messageID
            );
        }
    },
};
