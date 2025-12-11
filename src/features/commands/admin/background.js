/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                       BACKGROUND TASKS COMMAND                                ║
 * ║             Manage background tasks - list, start, stop, reload               ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * Admin command to manage background tasks. Allows listing all tasks,
 * starting/stopping individual tasks, reloading tasks, and viewing stats.
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const backgroundHandler = require("../../../handlers/backgroundHandler");

/**
 * Format interval to human-readable string
 * @param {number} ms - Interval in milliseconds
 * @returns {string}
 */
function formatInterval(ms) {
    if (!ms) return "N/A";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    return `${Math.round(ms / 3600000)}h`;
}

/**
 * Format date to string
 * @param {Date} date - Date object
 * @returns {string}
 */
function formatDate(date) {
    if (!date) return "Never";
    return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

module.exports = {
    config: {
        name: "background",
        aliases: ["bg", "tasks", "bgtask"],
        description: "Manage background tasks",
        usage: "background <list|start|stop|reload|stats> [taskName]",
        category: "admin",
        cooldown: 3,
        permissions: "admin",
        enabled: true,
        dmOnly: false,
        groupOnly: false,
    },

    /**
     * Command execution function
     * @param {Object} context - Command context
     */
    async execute({ api, event, args }) {
    const subCommand = args[0]?.toLowerCase() || "list";
    const taskName = args.slice(1).join(" ");

    switch (subCommand) {
        case "list":
        case "ls": {
            const tasks = backgroundHandler.getAllTasks();
            
            if (tasks.length === 0) {
                return api.sendMessage("📋 No background tasks loaded.", event.threadID);
            }

            const runningTasks = backgroundHandler.getRunningTasks();
            const runningNames = runningTasks.map((t) => t.name.toLowerCase());

            let message = "📋 ═══ BACKGROUND TASKS ═══\n\n";

            // Group by category
            const categories = {};
            for (const task of tasks) {
                if (!categories[task.category]) {
                    categories[task.category] = [];
                }
                categories[task.category].push(task);
            }

            for (const [category, categoryTasks] of Object.entries(categories)) {
                message += `📁 ${category.toUpperCase()}\n`;
                
                for (const task of categoryTasks) {
                    const isRunning = runningNames.includes(task.name.toLowerCase());
                    const status = isRunning ? "🟢" : task.enabled ? "🟡" : "🔴";
                    const interval = formatInterval(task.interval);
                    
                    message += `  ${status} ${task.name} (${interval})\n`;
                    message += `     └ ${task.description}\n`;
                }
                message += "\n";
            }

            message += `\n🟢 Running | 🟡 Enabled | 🔴 Disabled`;
            message += `\n\nTotal: ${tasks.length} tasks | Running: ${runningTasks.length}`;

            return api.sendMessage(message, event.threadID);
        }

        case "start": {
            if (!taskName) {
                return api.sendMessage("❌ Usage: background start <taskName>", event.threadID);
            }

            const task = backgroundHandler.getTask(taskName);
            if (!task) {
                return api.sendMessage(`❌ Task not found: ${taskName}`, event.threadID);
            }

            const success = await backgroundHandler.startTask(taskName);
            if (success) {
                return api.sendMessage(`✅ Started task: ${task.name}`, event.threadID);
            } else {
                return api.sendMessage(`❌ Failed to start task: ${taskName}`, event.threadID);
            }
        }

        case "stop": {
            if (!taskName) {
                return api.sendMessage("❌ Usage: background stop <taskName>", event.threadID);
            }

            const task = backgroundHandler.getTask(taskName);
            if (!task) {
                return api.sendMessage(`❌ Task not found: ${taskName}`, event.threadID);
            }

            const success = await backgroundHandler.stopTask(taskName);
            if (success) {
                return api.sendMessage(`✅ Stopped task: ${task.name}`, event.threadID);
            } else {
                return api.sendMessage(`❌ Failed to stop task: ${taskName}`, event.threadID);
            }
        }

        case "reload": {
            if (!taskName) {
                // Reload all tasks
                const count = await backgroundHandler.reloadAll();
                return api.sendMessage(`🔄 Reloaded ${count} background tasks`, event.threadID);
            }

            const task = backgroundHandler.getTask(taskName);
            if (!task) {
                return api.sendMessage(`❌ Task not found: ${taskName}`, event.threadID);
            }

            const success = await backgroundHandler.reloadTask(taskName);
            if (success) {
                return api.sendMessage(`🔄 Reloaded task: ${task.name}`, event.threadID);
            } else {
                return api.sendMessage(`❌ Failed to reload task: ${taskName}`, event.threadID);
            }
        }

        case "enable": {
            if (!taskName) {
                return api.sendMessage("❌ Usage: background enable <taskName>", event.threadID);
            }

            const success = backgroundHandler.enableTask(taskName);
            if (success) {
                return api.sendMessage(`✅ Enabled task: ${taskName}`, event.threadID);
            } else {
                return api.sendMessage(`❌ Task not found: ${taskName}`, event.threadID);
            }
        }

        case "disable": {
            if (!taskName) {
                return api.sendMessage("❌ Usage: background disable <taskName>", event.threadID);
            }

            const success = await backgroundHandler.disableTask(taskName);
            if (success) {
                return api.sendMessage(`✅ Disabled task: ${taskName}`, event.threadID);
            } else {
                return api.sendMessage(`❌ Task not found: ${taskName}`, event.threadID);
            }
        }

        case "stats":
        case "status": {
            const stats = backgroundHandler.getStats();
            const runningTasks = backgroundHandler.getRunningTasks();

            let message = "📊 ═══ BACKGROUND STATS ═══\n\n";
            message += `📋 Total Tasks: ${stats.total}\n`;
            message += `📁 Categories: ${stats.categories}\n`;
            message += `🟢 Running: ${stats.running}\n`;
            message += `⚡ Executions: ${stats.executions}\n`;
            message += `❌ Errors: ${stats.errors}\n`;
            message += `🕐 Last Execution: ${formatDate(stats.lastExecution)}\n`;

            if (runningTasks.length > 0) {
                message += "\n🏃 RUNNING TASKS:\n";
                for (const task of runningTasks) {
                    message += `  • ${task.name}\n`;
                    message += `    Runs: ${task.runCount} | Errors: ${task.errorCount}\n`;
                    message += `    Last Run: ${formatDate(task.lastRun)}\n`;
                }
            }

            return api.sendMessage(message, event.threadID);
        }

        case "info": {
            if (!taskName) {
                return api.sendMessage("❌ Usage: background info <taskName>", event.threadID);
            }

            const task = backgroundHandler.getTask(taskName);
            if (!task) {
                return api.sendMessage(`❌ Task not found: ${taskName}`, event.threadID);
            }

            const runningTasks = backgroundHandler.getRunningTasks();
            const isRunning = runningTasks.some((t) => t.name.toLowerCase() === task.name.toLowerCase());

            let message = `📋 ═══ TASK INFO ═══\n\n`;
            message += `📛 Name: ${task.name}\n`;
            message += `📝 Description: ${task.description}\n`;
            message += `📁 Category: ${task.category}\n`;
            message += `⏱️ Interval: ${formatInterval(task.interval)}\n`;
            message += `🚀 Run on Start: ${task.runOnStart ? "Yes" : "No"}\n`;
            message += `✅ Enabled: ${task.enabled ? "Yes" : "No"}\n`;
            message += `🟢 Running: ${isRunning ? "Yes" : "No"}\n`;
            message += `\n📊 STATISTICS:\n`;
            message += `  • Total Runs: ${task.runCount}\n`;
            message += `  • Errors: ${task.errorCount}\n`;
            message += `  • Last Run: ${formatDate(task.lastRun)}\n`;

            return api.sendMessage(message, event.threadID);
        }

        default: {
            const helpMessage = [
                "📋 ═══ BACKGROUND COMMANDS ═══",
                "",
                "!background list - List all tasks",
                "!background start <task> - Start a task",
                "!background stop <task> - Stop a task",
                "!background reload [task] - Reload task(s)",
                "!background enable <task> - Enable a task",
                "!background disable <task> - Disable a task",
                "!background stats - Show statistics",
                "!background info <task> - Task details",
                "",
                "Aliases: bg, tasks, bgtask"
            ].join("\n");

            return api.sendMessage(helpMessage, event.threadID);
        }
    }
    },
};
