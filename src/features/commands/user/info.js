/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                            INFO COMMAND                                       ║
 * ║              Display bot information and statistics                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command displays detailed information about the bot,
 * including version, uptime, statistics, and more.
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

/**
 * Formats bytes into human-readable format
 * @param {number} bytes - Bytes to format
 * @returns {string}
 */
function formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Formats uptime into human-readable string
 * @param {number} seconds - Uptime in seconds
 * @returns {string}
 */
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days} day${days !== 1 ? "s" : ""}`);
    if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs} second${secs !== 1 ? "s" : ""}`);

    return parts.join(", ");
}

module.exports = {
    config: {
        name: "info",
        aliases: ["botinfo", "about", "stats"],
        description: "Display bot information and statistics",
        usage: "info",
        category: "user",
        cooldown: 10,
        permissions: "user",
        enabled: true,
        dmOnly: false,
        groupOnly: false,
    },

    /**
     * Command execution function
     * @param {Object} context - Command context
     */
    async execute({ api, event, config, commandHandler }) {
    const threadID = event.threadID;
    const messageID = event.messageID ? String(event.messageID) : null;

    // Get system information
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    const nodeVersion = process.version;
    const platform = process.platform;
    const arch = process.arch;

    // Get command handler stats
    const cmdStats = commandHandler.getStats();

    // Get event handler stats
    let eventStats = { loaded: 0, triggered: 0, failed: 0 };
    try {
        const eventHandler = require("../../handlers/eventHandler");
        eventStats = eventHandler.getStats();
    } catch {
        // Event handler might not be loaded yet
    }

    // Build the info message
    const infoMessage = `🤖 ${config.bot.name.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━

📋 General:
   Name: ${config.bot.name}
   Version: ${config.bot.version}
   Prefix: ${config.bot.prefix}

⚙️ System:
   Platform: ${platform} (${arch})
   Node.js: ${nodeVersion}
   Memory: ${formatBytes(memUsage.heapUsed)} / ${formatBytes(memUsage.heapTotal)}
   Uptime: ${formatUptime(uptime)}

📊 Statistics:
   Commands: ${cmdStats.totalCommands} loaded
   Executed: ${cmdStats.executed}
   Events: ${eventStats.loaded || 0} loaded

👑 Admins: ${config.bot.admins.length} | Super: ${config.bot.superAdmins.length}`;

    api.sendMessage(infoMessage, threadID, messageID);
    },
};
