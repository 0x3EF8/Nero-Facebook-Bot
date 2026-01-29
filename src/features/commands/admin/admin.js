/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                            ADMIN COMMAND                                      ║
 * ║                  Manage bot administrators dynamically                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * Usage:
 *  • admin -a @user / reply  -> Add admin
 *  • admin -r @user / reply  -> Remove admin
 *  • admin -l                -> List admins
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

module.exports = {
    config: {
        name: "admin",
        aliases: ["manager", "mod"],
        description: "Add or remove bot administrators",
        usage: "admin <-a|-r|-l> [@user|reply|user ID]",
        category: "admin",
        cooldown: 5,
        permissions: "superadmin", // Only superadmins can manage admins
        enabled: true,
        dmOnly: false,
        groupOnly: false,
    },

    async execute({ api, event, args, config, _senderID }) {
        const { threadID, messageReply, mentions } = event;
        const actualPrefix = config.bot.prefixEnabled ? config.bot.prefix : "";
        const commandName = this.config.name;

        if (args.length === 0) {
            return api.sendMessage(
                `❌ Invalid usage!\n\n` +
                    `Usage:\n` +
                    `• ${actualPrefix}${commandName} -a @user : Add admin\n` +
                    `• ${actualPrefix}${commandName} -r @user : Remove admin\n` +
                    `• ${actualPrefix}${commandName} -l       : List admins`,
                threadID
            );
        }

        const action = args[0].toLowerCase();

        // List Admins
        if (action === "-l" || action === "list") {
            const admins = config.bot.admins;
            const superAdmins = config.bot.superAdmins;

            let msg = "👑 **Bot Administrators** 👑\n\n";

            msg += "**Super Admins:**\n";
            superAdmins.forEach((id, index) => {
                msg += `${index + 1}. ${id}\n`;
            });

            msg += "\n**Admins:**\n";
            if (admins.length > 0) {
                admins.forEach((id, index) => {
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
            try {
                const userInfo = await api.getUserInfo(targetID);
                targetName = userInfo[targetID]?.name || "Replied User";
            } catch (_err) {
                targetName = "Replied User";
            }
        } else if (Object.keys(mentions).length > 0) {
            targetID = Object.keys(mentions)[0];
            targetName = mentions[targetID].replace("@", "");
        } else if (args[1]) {
            // Try to parse ID directly
            if (!isNaN(args[1])) {
                targetID = args[1];
                try {
                    const userInfo = await api.getUserInfo(targetID);
                    targetName = userInfo[targetID]?.name || `User ${targetID}`;
                } catch (_err) {
                    targetName = `User ${targetID}`;
                }
            }
        }

        if (!targetID) {
            return api.sendMessage("❌ Please reply to a user or mention them.", threadID);
        }

        // Action: Add Admin
        if (action === "-a" || action === "add") {
            if (config.isSuperAdmin(targetID)) {
                return api.sendMessage("⚠️ User is already a Super Admin.", threadID);
            }

            const success = config.addAdmin(targetID);
            if (success) {
                return api.sendMessage(`✅ Successfully added ${targetName} as Admin!`, threadID);
            } else {
                return api.sendMessage(`⚠️ User is already an Admin.`, threadID);
            }
        }

        // Action: Remove Admin
        else if (action === "-r" || action === "remove" || action === "del") {
            if (config.isSuperAdmin(targetID)) {
                return api.sendMessage("❌ You cannot remove a Super Admin.", threadID);
            }

            const success = config.removeAdmin(targetID);
            if (success) {
                return api.sendMessage(
                    `✅ Successfully removed ${targetName} from Admins.`,
                    threadID
                );
            } else {
                return api.sendMessage(`⚠️ User is not an Admin.`, threadID);
            }
        } else {
            return api.sendMessage(
                `❌ Unknown action: ${action}\n\n` +
                    `Usage:\n` +
                    `• ${actualPrefix}${commandName} -a @user : Add admin\n` +
                    `• ${actualPrefix}${commandName} -r @user : Remove admin\n` +
                    `• ${actualPrefix}${commandName} -l       : List admins`,
                threadID
            );
        }
    },
};
