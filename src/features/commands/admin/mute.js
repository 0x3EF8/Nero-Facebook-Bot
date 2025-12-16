/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                            MUTE COMMAND                                       ║
 * ║                  Manage bot silence in groups (Admins only)                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * Usage:
 *  • mute -a / on    -> Activate mute (Silence bot)
 *  • mute -d / off   -> Deactivate mute (Bot speaks)
 *  • mute -l / list  -> List muted groups
 *  • mute            -> Toggle mute status
 *
 * @author 0x3EF8
 * @version 2.0.0
 */

"use strict";

module.exports = {
    config: {
        name: "mute",
        aliases: ["silence", "shh", "unmute"],
        description: "Manage bot mute status in groups",
        usage: "mute [-a|-d|-l]",
        category: "admin",
        cooldown: 5,
        permissions: "admin",
        enabled: true,
        dmOnly: false,
        groupOnly: true,
    },

    async execute({ api, event, args, config, logger }) {
        const { threadID } = event;
        const prefix = config.bot.prefix;

        // Default to toggle if no args provided
        if (args.length === 0) {
            if (config.isThreadBlocked(threadID)) {
                // Currently muted -> Unmute
                config.unblockThread(threadID);
                logger.info("Mute Command", `Unmuted thread ${threadID}`);
                return api.sendMessage("🔔 Bot unmuted! Everyone can use commands now.", threadID);
            } else {
                // Currently unmuted -> Mute
                config.blockThread(threadID);
                logger.info("Mute Command", `Muted thread ${threadID}`);
                return api.sendMessage("🔕 Bot muted! Only Admins can use commands now.", threadID);
            }
        }

        const action = args[0].toLowerCase();

        // ═══════════════════════════════════════════════════════════════════
        // ACTIVATE MUTE (-a / on)
        // ═══════════════════════════════════════════════════════════════════
        if (action === "-a" || action === "on" || action === "activate") {
            if (config.isThreadBlocked(threadID)) {
                return api.sendMessage("⚠️ The bot is already muted in this group.", threadID);
            }

            const success = config.blockThread(threadID);
            if (success) {
                logger.info("Mute Command", `Muted thread ${threadID}`);
                return api.sendMessage("🔕 Bot muted! Only Admins can use commands now.", threadID);
            } else {
                return api.sendMessage("❌ Failed to mute the bot.", threadID);
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // DEACTIVATE MUTE (-d / off)
        // ═══════════════════════════════════════════════════════════════════
        else if (action === "-d" || action === "off" || action === "deactivate") {
            if (!config.isThreadBlocked(threadID)) {
                return api.sendMessage("⚠️ The bot is not muted in this group.", threadID);
            }

            const success = config.unblockThread(threadID);
            if (success) {
                logger.info("Mute Command", `Unmuted thread ${threadID}`);
                return api.sendMessage("🔔 Bot unmuted! Everyone can use commands now.", threadID);
            } else {
                return api.sendMessage("❌ Failed to unmute the bot.", threadID);
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // LIST MUTED THREADS (-l / list)
        // ═══════════════════════════════════════════════════════════════════
        else if (action === "-l" || action === "list") {
            // Note: blockThread/unblockThread updates dynamicConfig in memory/file,
            // but we need to access the list. config.bot.blockedThreads is the source.
            
            const blockedThreads = config.bot.blockedThreads || [];
            
            if (blockedThreads.length === 0) {
                return api.sendMessage("📝 No groups are currently muted.", threadID);
            }

            let msg = "🔕 **Muted Groups** 🔕\n\n";
            
            // Limit list to avoid huge messages if many threads blocked
            const limit = 20;
            const displayList = blockedThreads.slice(0, limit);
            
            displayList.forEach((id, index) => {
                const marker = (id === threadID) ? " (Current)" : "";
                msg += `${index + 1}. ${id}${marker}\n`;
            });

            if (blockedThreads.length > limit) {
                msg += `
...and ${blockedThreads.length - limit} more.`;
            }

            return api.sendMessage(msg, threadID);
        }

        // ═══════════════════════════════════════════════════════════════════
        // INVALID USAGE
        // ═══════════════════════════════════════════════════════════════════
        // INVALID USAGE
        else {
            const actualPrefix = config.bot.prefixEnabled ? config.bot.prefix : '';
            const commandName = this.config.name;
            return api.sendMessage(
                `❌ Invalid usage!\n\n` +
                `Usage:\n` +
                `• ${actualPrefix}${commandName} -a : Activate mute (Silence bot)\n` +
                `• ${actualPrefix}${commandName} -d : Deactivate mute (Bot speaks)\n` +
                `• ${actualPrefix}${commandName} -l : List muted groups\n` +
                `• ${actualPrefix}${commandName}    : Toggle status`,
                threadID
            );
        }
    }
};
