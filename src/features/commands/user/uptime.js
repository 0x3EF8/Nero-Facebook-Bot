/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                           UPTIME COMMAND                                      ║
 * ║                  Display how long the bot has been running                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command displays the bot's uptime - how long it has been
 * running since the last restart.
 *
 * @author 0x3EF8
 * @version 1.0.1
 */

"use strict";

/**
 * Formats seconds into detailed time string
 * @param {number} seconds - Total seconds
 * @returns {Object} Object with formatted time parts
 */
function formatTime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    return { days, hours, minutes, seconds: secs };
}

/**
 * Creates visual progress bar
 * @param {number} current - Current value
 * @param {number} max - Maximum value
 * @param {number} length - Bar length
 * @returns {string}
 */
function createProgressBar(current, max, length = 10) {
    const progress = Math.min(current / max, 1);
    const filled = Math.round(progress * length);
    const empty = length - filled;

    return "█".repeat(filled) + "░".repeat(empty);
}

module.exports = {
    config: {
        name: "uptime",
        aliases: ["up", "runtime"],
        description: "Display bot uptime",
        usage: "uptime",
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
    async execute({ api, event, config }) {
        const threadID = event.threadID;
        const messageID = event.messageID ? String(event.messageID) : null;

        const uptimeSeconds = process.uptime();
        const time = formatTime(uptimeSeconds);

        // Create progress bars (relative to day)
        const hoursBar = createProgressBar(time.hours, 24);
        const minutesBar = createProgressBar(time.minutes, 60);
        const secondsBar = createProgressBar(time.seconds, 60);

        // Calculate percentage of day
        const percentOfDay = (((uptimeSeconds % 86400) / 86400) * 100).toFixed(1);

        // Get start time
        const startTime = new Date(Date.now() - uptimeSeconds * 1000);
        const startTimeStr = startTime.toLocaleString();

        const response =
            `⏰ ${config.bot.name} Uptime

` +
            `📅 Days: ${time.days}
` +
            `⏱️ Hours: ${time.hours.toString().padStart(2, "0")}
` +
            `${hoursBar} ${time.hours}/24h

` +
            `⏱️ Minutes: ${time.minutes.toString().padStart(2, "0")}
` +
            `${minutesBar} ${time.minutes}/60m

` +
            `⏱️ Seconds: ${time.seconds.toString().padStart(2, "0")}
` +
            `${secondsBar} ${time.seconds}/60s

` +
            `📊 Day Progress: ${percentOfDay}%
` +
            `🚀 Started: ${startTimeStr}`;

        api.sendMessage(response, threadID, messageID);
    },
};
