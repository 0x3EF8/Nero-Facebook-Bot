/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                            PING COMMAND                                       ║
 * ║               Check bot response time and status                              ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command checks the bot's response time (latency) and
 * confirms the bot is online and responsive.
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

/**
 * Gets status emoji based on ping
 * @param {number} ping - Ping in milliseconds
 * @returns {string}
 */
function getStatusEmoji(ping) {
    if (ping < 100) return "🟢"; // Excellent
    if (ping < 300) return "🟡"; // Good
    if (ping < 500) return "🟠"; // Fair
    return "🔴"; // Poor
}

/**
 * Gets status text based on ping
 * @param {number} ping - Ping in milliseconds
 * @returns {string}
 */
function getStatusText(ping) {
    if (ping < 100) return "Excellent";
    if (ping < 300) return "Good";
    if (ping < 500) return "Fair";
    return "Poor";
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
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(" ");
}

module.exports = {
    config: {
        name: "ping",
        aliases: ["pong", "latency", "status"],
        description: "Check bot response time and status",
        usage: "ping",
        category: "user",
        cooldown: 5,
        permissions: "user",
        enabled: true,
        dmOnly: false,
        groupOnly: false,
    },

    /**
     * Command execution function
     * @param {Object} context - Command context
     */
    async execute({ api, event }) {
        const threadID = event.threadID;
        const messageID = event.messageID;

        // Measure API latency with a lightweight operation
        const startTime = Date.now();
        await api.getUserInfo(event.senderID);
        const ping = Date.now() - startTime;

        const status = getStatusEmoji(ping);
        const statusText = getStatusText(ping);

        // Get system info
        const uptime = process.uptime();
        const uptimeStr = formatUptime(uptime);
        const memUsage = process.memoryUsage();
        const memUsedMB = (memUsage.heapUsed / 1024 / 1024).toFixed(2);

        // Build response
        const response =
            `🏓 Pong!\n\n` +
            `${status} Status: ${statusText}\n` +
            `⏱️ Latency: ${ping}ms\n` +
            `🕐 Uptime: ${uptimeStr}\n` +
            `💾 Memory: ${memUsedMB} MB`;

        // Send the result as a reply to the original message
        await api.sendMessage(response, threadID, null, messageID);
    },
};
