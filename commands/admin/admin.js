/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                           ADMIN COMMAND                                       ║
 * ║         Manage bot administrators (Super Admin Only)                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 * 
 * This command allows super admins to manage bot administrators.
 * Add, remove, or list admin users.
 * 
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

/**
 * Command configuration
 */
module.exports.config = {
    name: "admin",
    aliases: ["admins", "administrator"],
    description: "Manage bot administrators (Super Admin Only)",
    usage: "admin <add|remove|list> [userID]",
    category: "admin",
    cooldown: 5,
    permissions: "superadmin",
    enabled: true,
    dmOnly: false,
    groupOnly: false,
};

/**
 * Command execution function
 * @param {Object} context - Command context
 */
module.exports.execute = async function({ api, event, args, config, logger }) {
    const threadID = event.threadID;
    const messageID = event.messageID;
    
    // Show usage if no arguments
    if (args.length === 0) {
        const adminList = config.bot.admins.length > 0 
            ? config.bot.admins.join("\n• ") 
            : "No admins configured";
        
        const superAdminList = config.bot.superAdmins.length > 0 
            ? config.bot.superAdmins.join("\n• ") 
            : "No super admins configured";
        
        return api.sendMessage(
            `👑 Admin Management\n\n` +
            `Super Admins:\n• ${superAdminList}\n\n` +
            `Admins:\n• ${adminList}\n\n` +
            `Commands:\n` +
            `• admin add <userID>\n` +
            `• admin remove <userID>\n` +
            `• admin list`,
            threadID,
            messageID
        );
    }
    
    const action = args[0].toLowerCase();
    const targetID = args[1];
    
    switch (action) {
        case "add": {
            if (!targetID) {
                return api.sendMessage(
                    "❌ Please provide a user ID to add.\n\n" +
                    "Usage: admin add <userID>",
                    threadID,
                    messageID
                );
            }
            
            // Check if already admin
            if (config.bot.admins.includes(targetID)) {
                return api.sendMessage(
                    `❌ User ${targetID} is already an admin.`,
                    threadID,
                    messageID
                );
            }
            
            // Note: In production, this would update a database
            // config.bot.admins.push(targetID); // Would throw if frozen
            
            logger.info("Admin", `Admin add attempted for ${targetID} by ${event.senderID}`);
            
            return api.sendMessage(
                `⚠️ To add an admin, update config/config.js:\n\n` +
                `Find the admins array and add:\n` +
                `"${targetID}"\n\n` +
                `Then restart the bot.`,
                threadID,
                messageID
            );
        }
        
        case "remove": {
            if (!targetID) {
                return api.sendMessage(
                    "❌ Please provide a user ID to remove.\n\n" +
                    "Usage: admin remove <userID>",
                    threadID,
                    messageID
                );
            }
            
            // Check if is super admin
            if (config.bot.superAdmins.includes(targetID)) {
                return api.sendMessage(
                    "❌ Cannot remove a super admin.",
                    threadID,
                    messageID
                );
            }
            
            // Check if is admin
            if (!config.bot.admins.includes(targetID)) {
                return api.sendMessage(
                    `❌ User ${targetID} is not an admin.`,
                    threadID,
                    messageID
                );
            }
            
            logger.info("Admin", `Admin removal attempted for ${targetID} by ${event.senderID}`);
            
            return api.sendMessage(
                `⚠️ To remove an admin, update config/config.js:\n\n` +
                `Find the admins array and remove:\n` +
                `"${targetID}"\n\n` +
                `Then restart the bot.`,
                threadID,
                messageID
            );
        }
        
        case "list": {
            const adminList = config.bot.admins.length > 0 
                ? config.bot.admins.map((id, i) => `${i + 1}. ${id}`).join("\n")
                : "No admins configured";
            
            const superAdminList = config.bot.superAdmins.length > 0 
                ? config.bot.superAdmins.map((id, i) => `${i + 1}. ${id}`).join("\n")
                : "No super admins configured";
            
            return api.sendMessage(
                `👑 Administrator List\n\n` +
                `━━━ Super Admins ━━━\n${superAdminList}\n\n` +
                `━━━ Admins ━━━\n${adminList}`,
                threadID,
                messageID
            );
        }
        
        default:
            return api.sendMessage(
                `❌ Unknown action "${action}".\n\n` +
                `Valid actions: add, remove, list`,
                threadID,
                messageID
            );
    }
};
