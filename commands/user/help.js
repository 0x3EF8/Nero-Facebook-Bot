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
 * Command configuration
 */
module.exports.config = {
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
};

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

/**
 * Command execution function
 * @param {Object} context - Command context
 */
module.exports.execute = async function({ api, event, args, prefix, config, commandHandler, isAdmin }) {
    const threadID = event.threadID;
    const messageID = event.messageID ? String(event.messageID) : null;
    
    // If a specific command is requested
    if (args.length > 0) {
        const commandName = args[0].toLowerCase();
        const command = commandHandler.getCommand(commandName);
        
        if (!command) {
            return api.sendMessage(
                `❌ Command "${commandName}" not found.\n\n` +
                `Use ${prefix}help to see all available commands.`,
                threadID,
                messageID
            );
        }
        
        // Check if user can see this command
        if (command.config.permissions === "admin" && !isAdmin) {
            return api.sendMessage(
                `❌ Command "${commandName}" not found.\n\n` +
                `Use ${prefix}help to see all available commands.`,
                threadID,
                messageID
            );
        }
        
        // Build detailed command info
        const aliases = command.config.aliases.length > 0 
            ? command.config.aliases.join(", ") 
            : "None";
        
        const permissionLabels = {
            user: "Everyone",
            admin: "Admins",
            superadmin: "Super Admins",
        };
        
        const details = [
            `📌 Command: ${command.config.name}`,
            `📝 Description: ${command.config.description}`,
            `💡 Usage: ${prefix}${command.config.usage}`,
            `🏷️ Aliases: ${aliases}`,
            `📁 Category: ${formatCategoryName(command.config.category)}`,
            `⏱️ Cooldown: ${command.config.cooldown}s`,
            `🔒 Permission: ${permissionLabels[command.config.permissions] || command.config.permissions}`,
            `✅ Enabled: ${command.config.enabled ? "Yes" : "No"}`,
        ];
        
        if (command.config.dmOnly) {
            details.push("📱 DM Only: Yes");
        }
        
        if (command.config.groupOnly) {
            details.push("👥 Group Only: Yes");
        }
        
        return api.sendMessage(
            `╔════════════════════╗\n` +
            `║    COMMAND INFO    ║\n` +
            `╚════════════════════╝\n\n` +
            details.join("\n"),
            threadID,
            messageID
        );
    }
    
    // Show all commands grouped by category
    const commandsByCategory = new Map();
    
    // Group commands by category, filtering by permission
    for (const [, command] of commandHandler.commands) {
        // Skip disabled commands
        if (!command.config.enabled) continue;
        
        // Skip admin commands for non-admins
        if (command.config.permissions === "admin" && !isAdmin) continue;
        if (command.config.permissions === "superadmin" && !config.isSuperAdmin(event.senderID)) continue;
        
        const category = command.config.category;
        
        if (!commandsByCategory.has(category)) {
            commandsByCategory.set(category, []);
        }
        
        commandsByCategory.get(category).push(command.config.name);
    }
    
    // Build the help message
    let helpMessage = 
        `📚 ${config.bot.name.toUpperCase()} HELP\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📝 Prefix: ${prefix}\n` +
        `💡 Use ${prefix}help <command> for details\n\n`;
    
    // Add categories
    for (const [category, commands] of commandsByCategory) {
        if (commands.length === 0) continue;
        
        helpMessage += `${formatCategoryName(category)}\n`;
        helpMessage += `   ${commands.join(", ")}\n\n`;
    }
    
    // Add stats
    const stats = commandHandler.getStats();
    helpMessage += 
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 Total: ${stats.totalCommands} commands`;
    
    api.sendMessage(helpMessage, threadID, messageID);
};
