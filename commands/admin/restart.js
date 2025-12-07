/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                          RESTART COMMAND                                      ║
 * ║              Restart the bot process (Admin Only)                             ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 * 
 * This command allows admins to restart the bot.
 * Useful for applying configuration changes or recovering from issues.
 * 
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

/**
 * Command configuration
 */
module.exports.config = {
    name: "restart",
    aliases: ["reboot", "rs"],
    description: "Restart the bot (Admin Only)",
    usage: "restart",
    category: "admin",
    cooldown: 30,
    permissions: "admin",
    enabled: true,
    dmOnly: false,
    groupOnly: false,
};

/**
 * Command execution function
 * @param {Object} context - Command context
 */
module.exports.execute = async function({ api, event, logger }) {
    const threadID = event.threadID;
    const messageID = event.messageID;
    
    logger.warn("Restart", `Bot restart initiated by ${event.senderID}`);
    
    // Send confirmation message
    await api.sendMessage(
        "🔄 Restarting bot...\n\n" +
        "The bot will be back online shortly.",
        threadID,
        messageID
    );
    
    // Log the restart
    logger.info("Restart", "Shutting down for restart...");
    
    // Give time for the message to send
    setTimeout(() => {
        // Exit with code 0 for clean restart
        // Process manager (pm2, nodemon, etc.) should restart the process
        process.exit(0);
    }, 1000);
};
