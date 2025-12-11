/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                          ACCOUNTS COMMAND                                     ║
 * ║            View and Manage Multi-Account Bot Sessions                         ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command allows admins to view and manage multi-account bot sessions.
 * List accounts, view stats, and get detailed info about each session.
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

module.exports = {
    config: {
        name: "accounts",
        aliases: ["acc", "bots", "sessions"],
        description: "View and manage multi-account bot sessions",
        usage: "accounts [list|stats|info <name>]",
        category: "admin",
        cooldown: 3,
        permissions: ["admin"],
    },

    async execute({ api, event, args }) {
        const { threadID } = event;
        const messageID = event.messageID ? String(event.messageID) : null;

        let accountManager;
        try {
            const main = require("../../index");
            accountManager = main.accountManager;
        } catch {
            return api.sendMessage("❌ Failed to access account manager.", threadID, messageID);
        }

        if (!accountManager) {
            return api.sendMessage("❌ Account manager not available.", threadID, messageID);
        }

        const subCommand = args[0]?.toLowerCase() || "list";

        switch (subCommand) {
            case "list":
            case "ls":
                return listAccounts(api, event, accountManager);

            case "stats":
            case "statistics":
                return showStats(api, event, accountManager);

            case "info":
            case "details":
                return showAccountInfo(api, event, args.slice(1), accountManager);

            default:
                return listAccounts(api, event, accountManager);
        }
    },
};

// Helper Functions

function getStatusIcon(status) {
    const icons = { online: "🟢", offline: "⚫", error: "🔴", pending: "🟡" };
    return icons[status] || "⚪";
}

function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

async function listAccounts(api, event, accountManager) {
    const messageID = event.messageID ? String(event.messageID) : null;
    const accounts = accountManager.getAllAccounts();
    const stats = accountManager.getAccountStats();

    if (accounts.length === 0) {
        return api.sendMessage("📋 No accounts registered.", event.threadID, messageID);
    }

    let message = `🤖 BOT ACCOUNTS\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📊 Summary: ${stats.online}/${stats.total} Online\n\n`;

    for (const account of accounts) {
        const statusIcon = getStatusIcon(account.status);
        const uptime = account.loginTime
            ? formatUptime(Date.now() - account.loginTime.getTime())
            : "N/A";

        message += `${statusIcon} ${account.name}\n`;
        message += `   UID: ${account.userID || "N/A"}\n`;
        message += `   Status: ${account.status}\n`;

        if (account.status === "online") {
            message += `   Uptime: ${uptime}\n`;
            message += `   Commands: ${account.commandCount}\n`;
        } else if (account.error) {
            message += `   Error: ${account.error.slice(0, 50)}...\n`;
        }
        message += "\n";
    }

    return api.sendMessage(message.trim(), event.threadID, messageID);
}

async function showStats(api, event, accountManager) {
    const messageID = event.messageID ? String(event.messageID) : null;
    const accounts = accountManager.getAllAccounts();
    const stats = accountManager.getAccountStats();

    let totalMessages = 0;
    let totalCommands = 0;
    let totalUptime = 0;

    for (const account of accounts) {
        totalMessages += account.messageCount || 0;
        totalCommands += account.commandCount || 0;
        if (account.loginTime) {
            totalUptime += Date.now() - account.loginTime.getTime();
        }
    }

    let message = `📊 ACCOUNT STATISTICS\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `📈 Account Status:\n`;
    message += `   Total: ${stats.total}\n`;
    message += `   Online: ${stats.online}\n`;
    message += `   Offline: ${stats.offline}\n`;
    message += `   Errors: ${stats.error}\n\n`;
    message += `💬 Activity:\n`;
    message += `   Messages: ${totalMessages.toLocaleString()}\n`;
    message += `   Commands: ${totalCommands.toLocaleString()}\n`;

    if (stats.online > 0) {
        const avgUptime = totalUptime / stats.online;
        message += `\n⏱️ Avg Uptime: ${formatUptime(avgUptime)}`;
    }

    return api.sendMessage(message, event.threadID, messageID);
}

async function showAccountInfo(api, event, args, accountManager) {
    const messageID = event.messageID ? String(event.messageID) : null;
    const accountName = args[0];

    if (!accountName) {
        return api.sendMessage(
            "❌ Please specify an account name.\nUsage: !accounts info <name>",
            event.threadID,
            messageID
        );
    }

    let account = accountManager.getAccount(accountName);

    if (!account) {
        const allAccounts = accountManager.getAllAccounts();
        const matches = allAccounts.filter((a) =>
            a.name.toLowerCase().includes(accountName.toLowerCase())
        );

        if (matches.length === 0) {
            return api.sendMessage(
                `❌ Account "${accountName}" not found.`,
                event.threadID,
                messageID
            );
        }

        if (matches.length > 1) {
            const names = matches.map((a) => a.name).join(", ");
            return api.sendMessage(`❓ Multiple matches: ${names}`, event.threadID, messageID);
        }

        account = matches[0];
    }

    const statusIcon = getStatusIcon(account.status);
    const uptime = account.loginTime
        ? formatUptime(Date.now() - account.loginTime.getTime())
        : "N/A";

    let message = `${statusIcon} ${account.name.toUpperCase()}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `📋 General:\n`;
    message += `   Name: ${account.name}\n`;
    message += `   UID: ${account.userID || "N/A"}\n`;
    message += `   Status: ${account.status}\n`;
    message += `   File: ${account.filePath.split(/[/\\]/).pop()}\n`;

    if (account.status === "online") {
        message += `\n⏱️ Session:\n`;
        message += `   Login: ${account.loginTime?.toLocaleString() || "N/A"}\n`;
        message += `   Uptime: ${uptime}\n`;
        message += `\n📊 Stats:\n`;
        message += `   Messages: ${account.messageCount.toLocaleString()}\n`;
        message += `   Commands: ${account.commandCount.toLocaleString()}`;
    } else if (account.status === "error") {
        message += `\n❌ Error: ${account.error}`;
    }

    return api.sendMessage(message, event.threadID, messageID);
}
