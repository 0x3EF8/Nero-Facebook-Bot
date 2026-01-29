/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                            BLOCK COMMAND                                      ║
 * ║                  Block or unblock users from using the bot                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * Usage:
 *  • block -a @user / reply  -> Block (ban) user
 *  • block -r @user / reply  -> Unblock (unban) user
 *  • block -l                -> List blocked users
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

module.exports = {
    config: {
        name: "block",
        aliases: ["ban", "muteuser", "ignore"],
        description: "Block or unblock users from using bot commands",
        usage: "block <-a|-r|-l> [@user|reply|user ID]",
        category: "admin",
        cooldown: 5,
        permissions: "admin",
        enabled: true,
        dmOnly: false,
        groupOnly: false,
    },

    async execute({ api, event, args, config }) {
        const { threadID, messageReply, mentions } = event;
        const actualPrefix = config.bot.prefixEnabled ? config.bot.prefix : "";
        const commandName = this.config.name;

        if (args.length === 0) {
            return api.sendMessage(
                `❌ Invalid usage!\n\n` +
                    `Usage:\n` +
                    `• ${actualPrefix}${commandName} -a @user : Block user\n` +
                    `• ${actualPrefix}${commandName} -r @user : Unblock user\n` +
                    `• ${actualPrefix}${commandName} -l       : List blocked users`,
                threadID
            );
        }

        const action = args[0].toLowerCase();

        // List Blocked Users
        if (action === "-l" || action === "list") {
            const blockedUsers = config.bot.blockedUsers;

            let msg = "🚫 **Blocked Users** 🚫\n\n";

            if (blockedUsers.length > 0) {
                // Determine if we can fetch names, for now just list IDs
                // In a real scenario, you might want to resolve names asynchronously
                blockedUsers.forEach((id, index) => {
                    msg += `${index + 1}. ${id}\n`;
                });
            } else {
                msg += "None\n";
            }

            return api.sendMessage(msg, threadID);
        }

        // Get target user
        let targetID = null;
        let targetName = "";

        if (messageReply) {
            targetID = messageReply.senderID;
            targetName = "Replied User";
        } else if (Object.keys(mentions).length > 0) {
            targetID = Object.keys(mentions)[0];
            targetName = mentions[targetID].replace("@", "");
        } else if (args[1]) {
            // Try to parse ID directly
            if (!isNaN(args[1])) {
                targetID = args[1];
                targetName = `User ${targetID}`;
            }
        }

        if (!targetID) {
            return api.sendMessage("❌ Please reply to a user or mention them.", threadID);
        }

        // Prevent blocking admins
        if (config.isAdmin(targetID)) {
            return api.sendMessage("🛡️ You cannot block a Bot Admin.", threadID);
        }

        // Action: Block User
        if (action === "-a" || action === "add" || action === "ban") {
            const success = config.blockUser(targetID);
            if (success) {
                return api.sendMessage(
                    `🚫 Successfully blocked ${targetName} from using the bot.`,
                    threadID
                );
            } else {
                return api.sendMessage(`⚠️ User is already blocked.`, threadID);
            }
        }

        // Action: Unblock User
        else if (
            action === "-r" ||
            action === "remove" ||
            action === "unban" ||
            action === "unblock"
        ) {
            const success = config.unblockUser(targetID);
            if (success) {
                return api.sendMessage(`✅ Successfully unblocked ${targetName}.`, threadID);
            } else {
                return api.sendMessage(`⚠️ User is not blocked.`, threadID);
            }
        } else {
            return api.sendMessage(
                `❌ Unknown action: ${action}\n\n` +
                    `Usage:\n` +
                    `• ${actualPrefix}${commandName} -a @user : Block user\n` +
                    `• ${actualPrefix}${commandName} -r @user : Unblock user\n` +
                    `• ${actualPrefix}${commandName} -l       : List blocked users`,
                threadID
            );
        }
    },
};
