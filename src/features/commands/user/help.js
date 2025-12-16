/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                            HELP COMMAND                                       ║
 * ║           Display available commands and their usage information              ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command displays a list of all available commands or
 * detailed information about a specific command.
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

/**
 * Formats category name for display
 * @param {string} category - Category name
 * @returns {string}
 */
function formatCategoryName(category) {
    const icons = {
        admin: "👑",
        user: "👤",
        fun: "🎮",
        utility: "🛠️",
        moderation: "🔨",
        music: "🎵",
        economy: "💰",
        games: "🎲",
    };

    const icon = icons[category.toLowerCase()] || "📁";
    return `${icon} ${category.charAt(0).toUpperCase() + category.slice(1)}`;
}

module.exports = {
    config: {
        name: "help",
        aliases: ["h", "commands", "cmds", "menu"],
        description: "Display available commands and their usage",
        usage: "help [command_name]",
        category: "user",
        cooldown: 3,
        permissions: "user",
        enabled: true,
        dmOnly: false,
        groupOnly: false,
    },

    /**
     * Command execution function
     * @param {Object} context - Command context
     */
    async execute({
        api,
        event,
        args,
        prefix,
        config,
        commandHandler,
        isAdmin,
    }) {
    const threadID = event.threadID;
    const displayPrefix = prefix || config.bot.prefix || "";

    // If a specific command is requested
    if (args.length > 0) {
        const commandName = args[0].toLowerCase();
        const command = commandHandler.getCommand(commandName);

        if (!command) {
            return api.sendMessage(
                `❌ Command "${commandName}" not found.\n\n` +
                    `Use ${displayPrefix}help to see all available commands.`,
                threadID
            );
        }

        // Check if user can see this command
        if (command.config.permissions === "admin" && !isAdmin) {
            return api.sendMessage(
                `❌ Command "${commandName}" not found.\n\n` +
                    `Use ${displayPrefix}help to see all available commands.`,
                threadID
            );
        }

        // Build detailed command info
        // Show only first alias or None
        const alias = command.config.aliases.length > 0 ? command.config.aliases[0] : "None";

        const permissionLabels = {
            user: "Everyone",
            admin: "Admins",
            superadmin: "Super Admins",
        };

        let details = `📖 **COMMAND INFO**\n\n`;
        details += `📌 **Name:** ${command.config.name}\n`;
        details += `📝 **Desc:** ${command.config.description}\n`;
        details += `💡 **Usage:** ${displayPrefix}${command.config.usage}\n`;
        details += `🏷️ **Alias:** ${alias}\n`;
        details += `📁 **Group:** ${formatCategoryName(command.config.category)}\n`;
        details += `⏱️ **Cooldown:** ${command.config.cooldown}s\n`;
        details += `🔒 **Access:** ${permissionLabels[command.config.permissions] || command.config.permissions}`;

        if (command.config.dmOnly) {
            details += "\n📱 **DM Only:** Yes";
        }

        if (command.config.groupOnly) {
            details += "\n👥 **Group Only:** Yes";
        }

        return api.sendMessage(details, threadID);
    }

    // Show all commands grouped by category
    const commandsByCategory = new Map();

    // Group commands by category, filtering by permission
    for (const [, command] of commandHandler.commands) {
        // Skip disabled commands
        if (!command.config.enabled) continue;

        // Skip admin commands for non-admins
        if (command.config.permissions === "admin" && !isAdmin) continue;
        if (command.config.permissions === "superadmin" && !config.isSuperAdmin(event.senderID))
            {continue;}

        const category = command.config.category;

        if (!commandsByCategory.has(category)) {
            commandsByCategory.set(category, []);
        }

        commandsByCategory.get(category).push(command.config.name);
    }

    // Build the help message
    let helpMessage = `📚 **${config.bot.name.toUpperCase()} HELP**\n`;
    
    if (config.bot.prefixEnabled) {
        helpMessage += `Prefix: \`${displayPrefix || "(None)"}\`\n\n`;
    } else {
        helpMessage += `\n`;
    }

    // Add categories
    for (const [category, commands] of commandsByCategory) {
        if (commands.length === 0) continue;

        helpMessage += `${formatCategoryName(category)}\n`;
        // Join with newlines and bullet points
        helpMessage += commands.map(cmd => `• ${cmd}`).join("\n") + "\n\n";
    }

    // Add stats and tip
    const stats = commandHandler.getStats();
    helpMessage += `📊 ${stats.totalCommands} commands available\n`;
    helpMessage += `💡 Type \`${displayPrefix}help <command>\` for details`;

    api.sendMessage(helpMessage, threadID);
    },
};
