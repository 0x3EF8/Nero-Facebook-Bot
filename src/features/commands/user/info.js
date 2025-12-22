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
 * @version 1.1.5
 */

"use strict";

const packageJson = require("../../../../package.json");
const eventHandler = require("../../../handlers/eventHandler");
const backgroundHandler = require("../../../handlers/backgroundHandler");
const statsTracker = require("../../../utils/statsTracker");

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
    async execute({ api, event, config, commandHandler, accountManager }) {
        const threadID = event.threadID;
        const messageID = event.messageID ? String(event.messageID) : null;

        // Get system information
        const memUsage = process.memoryUsage();
        const nodeVersion = process.version;
        const platform = process.platform;
        const arch = process.arch;

        // Get statistics from handlers
        const cmdStats = commandHandler.getStats();
        const eventStats = eventHandler.getStats();
        const bgStats = backgroundHandler.getStats();
        const trackerStats = statsTracker.getStats();

        // Get account information
        const onlineAccounts = accountManager ? accountManager.getOnlineAccounts().length : 1;

        // Conditional prefix display
        const prefixInfo = config.bot.prefixEnabled ? `\nPrefix: ${config.bot.prefix}` : "";

        // Build the info message - Pure text only
        const infoMessage = 
`NERO SYSTEM INFORMATION

GENERAL INFORMATION
Name: ${config.bot.name}
Version: v${packageJson.version}${prefixInfo}
Owner: 0x3EF8

SYSTEM STATUS
Platform: ${platform} (${arch})
Node.js: ${nodeVersion}
Memory: ${formatBytes(memUsage.heapUsed)} / ${formatBytes(memUsage.heapTotal)}
Uptime: ${trackerStats.uptimeFormatted}

BOT INFRASTRUCTURE
Active Accounts: ${onlineAccounts}
Commands: ${cmdStats.totalCommands}
Event Handlers: ${eventStats.loaded}
Background Tasks: ${bgStats.loaded}

REAL-TIME METRICS
Total Messages: ${trackerStats.messages.total.toLocaleString()}
Commands Run: ${trackerStats.commands.successful.toLocaleString()}
Active Users: ${trackerStats.activeUsers.toLocaleString()}
Active Threads: ${trackerStats.activeThreads.toLocaleString()}

ADMINISTRATION
Admins: ${config.bot.admins.length}
Super Admins: ${config.bot.superAdmins.length}`;

        api.sendMessage(infoMessage, threadID, messageID);
    },
};
