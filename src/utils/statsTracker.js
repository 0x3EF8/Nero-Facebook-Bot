/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                          STATS TRACKER                                        ║
 * ║              Real-time bot statistics tracking and reporting                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * Centralized statistics tracking for:
 * - Messages processed
 * - Commands executed
 * - Events triggered
 * - Per-command and per-user stats
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

/**
 * StatsTracker Class
 * Global singleton for tracking bot statistics
 */
class StatsTracker {
    constructor() {
        /** @type {Date} Bot start time */
        this.startTime = new Date();

        /** @type {Object} Core statistics */
        this.stats = {
            messages: {
                total: 0,
                text: 0,
                attachments: 0,
                reactions: 0,
            },
            commands: {
                total: 0,
                successful: 0,
                failed: 0,
                blocked: 0,
            },
            events: {
                total: 0,
                triggered: 0,
                failed: 0,
            },
            background: {
                total: 0,
                successful: 0,
                failed: 0,
                totalTime: 0,
            },
        };

        /** @type {Map<string, number>} Per-command usage counts */
        this.commandUsage = new Map();

        /** @type {Map<string, Object>} Per-background-task usage */
        this.backgroundTaskUsage = new Map();

        /** @type {Map<string, Object>} Per-user activity */
        this.userActivity = new Map();

        /** @type {Map<string, number>} Per-thread activity */
        this.threadActivity = new Map();

        /** @type {Array<Object>} Recent activity log (last 100) */
        this.recentActivity = [];

        /** @type {number} Max recent activity entries */
        this.maxRecentActivity = 100;
    }

    /**
     * Record a message event
     * @param {Object} event - The message event
     */
    recordMessage(event) {
        this.stats.messages.total++;

        // Track message type
        if (event.attachments && event.attachments.length > 0) {
            this.stats.messages.attachments++;
        } else if (event.body) {
            this.stats.messages.text++;
        }

        // Track user activity
        if (event.senderID) {
            this._updateUserActivity(event.senderID, "message");
        }

        // Track thread activity
        if (event.threadID) {
            const count = this.threadActivity.get(event.threadID) || 0;
            this.threadActivity.set(event.threadID, count + 1);
        }
    }

    /**
     * Record a command execution
     * @param {string} commandName - Name of the command
     * @param {string} userId - User who executed the command
     * @param {boolean} success - Whether it succeeded
     */
    recordCommand(commandName, userId, success = true) {
        this.stats.commands.total++;

        if (success) {
            this.stats.commands.successful++;
        } else {
            this.stats.commands.failed++;
        }

        // Track per-command usage
        const count = this.commandUsage.get(commandName) || 0;
        this.commandUsage.set(commandName, count + 1);

        // Track user activity
        if (userId) {
            this._updateUserActivity(userId, "command");
        }

        // Add to recent activity
        this._addRecentActivity({
            type: "command",
            name: commandName,
            userId,
            success,
            timestamp: new Date(),
        });
    }

    /**
     * Record a blocked command
     */
    recordBlockedCommand() {
        this.stats.commands.blocked++;
    }

    /**
     * Record an event execution
     * @param {string} eventName - Name of the event handler
     * @param {boolean} success - Whether it succeeded
     */
    recordEvent(eventName, success = true) {
        this.stats.events.total++;

        if (success) {
            this.stats.events.triggered++;
        } else {
            this.stats.events.failed++;
        }

        // Add to recent activity
        this._addRecentActivity({
            type: "event",
            name: eventName,
            success,
            timestamp: new Date(),
        });
    }

    /**
     * Record a background task execution
     * @param {string} taskName - Name of the task
     * @param {boolean} success - Whether it succeeded
     * @param {number} [duration] - Execution time in ms
     */
    recordBackgroundTask(taskName, success = true, duration = 0) {
        this.stats.background.total++;

        if (success) {
            this.stats.background.successful++;
            this.stats.background.totalTime += duration;
        } else {
            this.stats.background.failed++;
        }

        // Track per-task usage
        if (!this.backgroundTaskUsage.has(taskName)) {
            this.backgroundTaskUsage.set(taskName, {
                runs: 0,
                successful: 0,
                failed: 0,
                totalTime: 0,
                lastRun: null,
            });
        }

        const taskStats = this.backgroundTaskUsage.get(taskName);
        taskStats.runs++;
        if (success) {
            taskStats.successful++;
            taskStats.totalTime += duration;
        } else {
            taskStats.failed++;
        }
        taskStats.lastRun = new Date();

        // Add to recent activity
        this._addRecentActivity({
            type: "background",
            name: taskName,
            success,
            duration,
            timestamp: new Date(),
        });
    }

    /**
     * Record a reaction
     */
    recordReaction() {
        this.stats.messages.reactions++;
    }

    /**
     * Update user activity tracking
     * @param {string} userId - User ID
     * @param {string} type - Activity type
     * @private
     */
    _updateUserActivity(userId, type) {
        if (!this.userActivity.has(userId)) {
            this.userActivity.set(userId, {
                messages: 0,
                commands: 0,
                firstSeen: new Date(),
                lastSeen: new Date(),
            });
        }

        const user = this.userActivity.get(userId);
        user[type === "message" ? "messages" : "commands"]++;
        user.lastSeen = new Date();
    }

    /**
     * Add to recent activity log
     * @param {Object} activity - Activity entry
     * @private
     */
    _addRecentActivity(activity) {
        this.recentActivity.unshift(activity);

        if (this.recentActivity.length > this.maxRecentActivity) {
            this.recentActivity.pop();
        }
    }

    /**
     * Get uptime in seconds
     * @returns {number} Uptime in seconds
     */
    getUptime() {
        return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
    }

    /**
     * Get formatted uptime string
     * @returns {string} Formatted uptime
     */
    getUptimeFormatted() {
        const seconds = this.getUptime();
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (days > 0) return `${days}d ${hours}h ${minutes}m`;
        if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
        if (minutes > 0) return `${minutes}m ${secs}s`;
        return `${secs}s`;
    }

    /**
     * Get top commands by usage
     * @param {number} limit - Max number to return
     * @returns {Array<Object>} Top commands
     */
    getTopCommands(limit = 10) {
        return Array.from(this.commandUsage.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([name, count]) => ({ name, count }));
    }

    /**
     * Get top users by activity
     * @param {number} limit - Max number to return
     * @returns {Array<Object>} Top users
     */
    /**
     * Get complete stats summary for API
     * @returns {Object} Full stats object
     */
    getStats() {
        return {
            uptime: this.getUptime(),
            uptimeFormatted: this.getUptimeFormatted(),
            startTime: this.startTime.toISOString(),
            messages: {
                total: this.stats.messages.total,
                text: this.stats.messages.text,
                attachments: this.stats.messages.attachments,
                reactions: this.stats.messages.reactions,
            },
            commands: {
                total: this.stats.commands.total,
                successful: this.stats.commands.successful,
                failed: this.stats.commands.failed,
                blocked: this.stats.commands.blocked,
            },
            events: {
                total: this.stats.events.total,
                triggered: this.stats.events.triggered,
                failed: this.stats.events.failed,
            },
            background: {
                total: this.stats.background.total,
                successful: this.stats.background.successful,
                failed: this.stats.background.failed,
                avgTime:
                    this.stats.background.successful > 0
                        ? Math.round(
                              this.stats.background.totalTime / this.stats.background.successful
                          )
                        : 0,
            },
            topCommands: this.getTopCommands(5),
            activeUsers: this.userActivity.size,
            activeThreads: this.threadActivity.size,
        };
    }
}

// Export singleton instance
module.exports = new StatsTracker();
