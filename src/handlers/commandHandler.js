/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                           COMMAND HANDLER                                     ║
 * ║     Dynamic command loading, registration, and execution management           ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This handler is responsible for:
 * - Loading commands from designated directories
 * - Registering commands into a collection
 * - Managing command cooldowns
 * - Executing commands with proper permission checks
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const fs = require("fs");
const path = require("path");
const config = require("../config/config");
const logger = require("../utils/logger");
const maintenanceManager = require("../utils/maintenanceManager");
const statsTracker = require("../utils/statsTracker");

// Message tracking for unsend command
let unsendCommand = null;

/**
 * Get the unsend command module (lazy load)
 * @returns {Object|null} The unsend command module
 */
function getUnsendCommand() {
    if (unsendCommand) return unsendCommand;

    try {
        const unsendPath = path.join(config.paths.commands, "admin", "unsend.js");
        if (fs.existsSync(unsendPath)) {
            unsendCommand = require(unsendPath);
        }
    } catch {
        // Silently fail if unsend command not found
    }
    return unsendCommand;
}

/**
 * Wrap API to track sent messages for unsend command and auto-detect DMs
 * @param {Object} api - Original API object
 * @param {string} threadID - Thread ID for tracking
 * @param {Object} event - Event object containing isGroup info
 * @returns {Object} Wrapped API with message tracking and DM support
 */
function wrapApiWithTracking(api, threadID, event) {
    const originalSendMessage = api.sendMessage.bind(api);

    return {
        ...api,
        sendMessage: async (message, targetThreadID, replyToMessage, isSingleUser) => {
            // Auto-detect if it's a DM when isSingleUser is not explicitly set
            // If sending to the same thread as the event and it's not a group, it's a DM
            if (isSingleUser === undefined) {
                const isTargetSameThread =
                    targetThreadID === threadID || targetThreadID === event?.threadID;
                if (isTargetSameThread && event?.isGroup === false) {
                    isSingleUser = true;
                }
            }

            const result = await originalSendMessage(
                message,
                targetThreadID,
                replyToMessage,
                isSingleUser
            );

            // Track the sent message for potential unsending
            if (result?.messageID) {
                const unsend = getUnsendCommand();
                if (unsend?.trackMessage) {
                    unsend.trackMessage(threadID, result.messageID);
                }
            }

            return result;
        },
    };
}

/**
 * CommandHandler Class
 * Manages all command-related operations
 */
class CommandHandler {
    /**
     * Creates a new CommandHandler instance
     */
    constructor() {
        /** @type {Map<string, Object>} Collection of loaded commands */
        this.commands = new Map();

        /** @type {Map<string, Object>} Command aliases mapping */
        this.aliases = new Map();

        /** @type {Map<string, number>} User cooldown tracking */
        this.cooldowns = new Map();

        /** @type {Map<string, Object>} Command categories */
        this.categories = new Map();

        /** @type {Object} Command statistics */
        this.stats = {
            loaded: 0,
            executed: 0,
            failed: 0,
            blocked: 0,
        };

        /** @type {Map<string, Object>} Per-command usage statistics */
        this.commandStats = new Map();

        /** @type {Map<string, Object>} Per-user activity statistics */
        this.userActivity = new Map();

        /** @type {Set<string>} Processed message IDs to prevent multi-bot replies */
        this.processedMessages = new Set();

        // Start periodic cleanup for cooldowns and stats (every 60 seconds)
        this._cleanupInterval = setInterval(() => this._periodicCleanup(), 60000);
    }

    /**
     * Periodic cleanup of expired cooldowns and old stats
     * @private
     */
    _periodicCleanup() {
        const now = Date.now();

        // Clean expired cooldowns
        for (const [key, data] of this.cooldowns) {
            if (now >= data.expires) {
                this.cooldowns.delete(key);
            }
        }

        // Clear processed messages cache (simple flush every minute is sufficient)
        this.processedMessages.clear();

        // Limit user activity to 10000 entries max
        if (this.userActivity.size > 10000) {
            const entries = [...this.userActivity.entries()];
            entries.sort((a, b) => (a[1].lastActive || 0) - (b[1].lastActive || 0));
            const toDelete = entries.slice(0, entries.length - 10000);
            for (const [key] of toDelete) {
                this.userActivity.delete(key);
            }
        }
    }

    /**
     * Initializes the command handler and loads all commands
     * @returns {Promise<number>} Number of commands loaded
     */
    async init() {
        // Removed duplicate initializing log. Only log from main loader.

        // Clear existing handlers first (important for reload)
        this.commands.clear();
        this.aliases.clear();
        this.categories.clear();
        this.stats.loaded = 0;

        const commandsPath = config.paths.commands;
        const directories = config.commands.directories;

        // Ensure commands directory exists
        if (!fs.existsSync(commandsPath)) {
            fs.mkdirSync(commandsPath, { recursive: true });
            logger.warn("CommandHandler", `Created commands directory: ${commandsPath}`);
        }

        // Load commands from each directory
        for (const dir of directories) {
            const categoryPath = path.join(commandsPath, dir);

            if (!fs.existsSync(categoryPath)) {
                fs.mkdirSync(categoryPath, { recursive: true });
                logger.warn("CommandHandler", `Created category directory: ${categoryPath}`);
                continue;
            }

            await this.loadCategory(dir, categoryPath);
        }

        logger.success(
            "CommandHandler",
            `Loaded ${this.stats.loaded} commands from ${directories.length} categories. Ready.`
        );
        return this.stats.loaded;
    }

    /**
     * Loads all commands from a category directory
     * @param {string} category - Category name
     * @param {string} categoryPath - Path to the category directory
     * @returns {Promise<void>}
     */
    async loadCategory(category, categoryPath) {
        const files = fs.readdirSync(categoryPath).filter((file) => file.endsWith(".js"));

        this.categories.set(category, {
            name: category,
            path: categoryPath,
            commands: [],
        });

        for (const file of files) {
            try {
                await this.loadCommand(category, path.join(categoryPath, file));
            } catch (error) {
                logger.error("CommandHandler", `Failed to load command ${file}: ${error.message}`);
            }
        }
    }

    /**
     * Loads a single command from file
     * @param {string} category - Category name
     * @param {string} filePath - Path to the command file
     * @returns {Promise<void>}
     */
    async loadCommand(category, filePath) {
        // Clear require cache to allow hot reloading
        delete require.cache[require.resolve(filePath)];

        const command = require(filePath);

        // Validate command structure
        if (!command.config || !command.config.name) {
            throw new Error(`Command at ${filePath} is missing required config.name`);
        }

        // Set default values
        const commandData = {
            config: {
                name: command.config.name,
                aliases: command.config.aliases || [],
                description: command.config.description || "No description provided",
                usage: command.config.usage || command.config.name,
                category: category,
                cooldown: command.config.cooldown ?? config.commands.defaultCooldown,
                permissions: command.config.permissions || "user", // "user", "admin", "superadmin"
                enabled: command.config.enabled !== false,
                dmOnly: command.config.dmOnly || false,
                groupOnly: command.config.groupOnly || false,
            },
            execute: command.execute || command.run || command.onCall,
            onLoad: command.onLoad,
            onUnload: command.onUnload,
            filePath: filePath,
        };

        // Validate execute function
        if (typeof commandData.execute !== "function") {
            throw new Error(`Command ${commandData.config.name} is missing execute function`);
        }

        // Register command
        this.commands.set(commandData.config.name.toLowerCase(), commandData);

        // Register aliases
        for (const alias of commandData.config.aliases) {
            this.aliases.set(alias.toLowerCase(), commandData.config.name.toLowerCase());
        }

        // Add to category
        const categoryData = this.categories.get(category);
        if (categoryData) {
            categoryData.commands.push(commandData.config.name);
        }

        // Call onLoad hook if exists
        if (typeof commandData.onLoad === "function") {
            await commandData.onLoad();
        }

        this.stats.loaded++;
        logger.debug("CommandHandler", `Loaded command: ${commandData.config.name} (${category})`);
    }

    /**
     * Reloads a command by name
     * @param {string} commandName - Name of the command to reload
     * @returns {Promise<boolean>} Success status
     */
    async reloadCommand(commandName) {
        const command = this.getCommand(commandName);
        if (!command) return false;

        try {
            // Call onUnload hook if exists
            if (typeof command.onUnload === "function") {
                await command.onUnload();
            }

            // Remove from collections
            this.commands.delete(command.config.name.toLowerCase());
            for (const alias of command.config.aliases) {
                this.aliases.delete(alias.toLowerCase());
            }

            // Reload
            this.stats.loaded--;
            await this.loadCommand(command.config.category, command.filePath);

            logger.info("CommandHandler", `Reloaded command: ${commandName}`);
            return true;
        } catch (error) {
            logger.error(
                "CommandHandler",
                `Failed to reload command ${commandName}: ${error.message}`
            );
            return false;
        }
    }

    /**
     * Gets a command by name or alias
     * @param {string} name - Command name or alias
     * @returns {Object|null} Command object or null
     */
    getCommand(name) {
        const lowerName = name.toLowerCase();

        // Check direct command name
        if (this.commands.has(lowerName)) {
            return this.commands.get(lowerName);
        }

        // Check aliases
        if (this.aliases.has(lowerName)) {
            const commandName = this.aliases.get(lowerName);
            return this.commands.get(commandName);
        }

        return null;
    }

    /**
     * Checks if a user is on cooldown for a command
     * @param {string} userId - User ID
     * @param {string} commandName - Command name
     * @returns {number} Remaining cooldown in seconds, or 0 if not on cooldown
     */
    getCooldown(userId, commandName) {
        const key = `${userId}-${commandName}`;
        const now = Date.now();
        const cooldownData = this.cooldowns.get(key);

        if (!cooldownData) return 0;

        const remaining = Math.ceil((cooldownData.expires - now) / 1000);
        return remaining > 0 ? remaining : 0;
    }

    /**
     * Sets cooldown for a user on a command
     * @param {string} userId - User ID
     * @param {string} commandName - Command name
     * @param {number} seconds - Cooldown duration in seconds
     */
    setCooldown(userId, commandName, seconds) {
        const key = `${userId}-${commandName}`;
        this.cooldowns.set(key, {
            expires: Date.now() + seconds * 1000,
            commandName,
        });
        // Cleanup is handled by _periodicCleanup interval
    }

    /**
     * Handles incoming messages and executes commands
     * @param {Object} api - Nero API object
     * @param {Object} event - Message event object
     * @returns {Promise<boolean>} Whether a command was executed
     */
    async handle(api, event) {
        // Check if command system is enabled
        if (!config.commands.enabled) {
            return false;
        }

        // Only process message events
        if (event.type !== "message" && event.type !== "message_reply") {
            return false;
        }

        const body = event.body || "";
        const senderID = event.senderID;
        const botID = api.getCurrentUserID ? api.getCurrentUserID() : null;
        const isSelfMessage = botID && senderID === botID;

        let usedPrefix = null;
        let commandText = body;

        // Logic for Self (Bot) - ALWAYS requires specific bot prefix
        if (isSelfMessage) {
            const botPrefix = config.bot.botPrefix || ".";
            if (body.startsWith(botPrefix)) {
                usedPrefix = botPrefix;
                commandText = body.slice(usedPrefix.length).trim();
            } else {
                // Bot message without prefix -> Ignore
                return false;
            }
        }
        // Logic for Users
        else {
            const prefixEnabled = config.bot.prefixEnabled !== false;

            if (prefixEnabled) {
                // Prefix IS required for users
                // Handle case where prefix might be an array or string
                const mainPrefix = Array.isArray(config.bot.prefix)
                    ? config.bot.prefix
                    : [config.bot.prefix];
                const userPrefixes = [
                    ...mainPrefix,
                    ...(config.bot.alternativePrefixes || []),
                ].filter(Boolean);

                for (const p of userPrefixes) {
                    if (body.toLowerCase().startsWith(p.toLowerCase())) {
                        usedPrefix = p;
                        break;
                    }
                }

                if (!usedPrefix) return false; // User didn't use required prefix
                commandText = body.slice(usedPrefix.length).trim();
            }
            // If prefixEnabled is false, usedPrefix remains null, commandText remains body (No prefix mode)
        }

        // Parse command and arguments
        // Parse command and arguments with quote support
        // Match words or quoted strings
        const args = [];
        const regex = /"([^"]+)"|'([^']+)'|([^\s]+)/g;
        let match;

        while ((match = regex.exec(commandText)) !== null) {
            // match[1] or match[2] is the quoted content (without quotes)
            // match[3] is the unquoted word
            args.push(match[1] || match[2] || match[3]);
        }

        // Handle case where no args found (e.g. empty string), though commandText is trimmed
        if (args.length === 0 && commandText) {
            args.push(commandText);
        }
        const commandName = args.shift();

        if (!commandName) return false;

        // Get command
        const command = this.getCommand(
            config.commands.caseSensitive ? commandName : commandName.toLowerCase()
        );

        if (!command) {
            // Silently ignore unknown commands to prevent spam
            return false;
        }

        // Check if command is enabled
        if (!command.config.enabled) {
            return false;
        }

        const userId = event.senderID;
        const threadId = event.threadID;
        const isGroup = event.isGroup;

        // Check maintenance mode (admins bypass)
        if (maintenanceManager.isEnabled() && !config.isAdmin(userId)) {
            // Only notify if not recently notified (prevents spam)
            if (maintenanceManager.shouldNotify(userId)) {
                maintenanceManager.markNotified(userId);
                api.sendMessage(maintenanceManager.getMessage(), threadId);
            }
            return false;
        }

        // Check if user is blocked
        if (config.isBlocked(userId)) {
            this.stats.blocked++;
            statsTracker.recordBlockedCommand();
            return false;
        }

        // Check if thread is blocked (Admins bypass)
        if (config.isThreadBlocked(threadId) && !config.isAdmin(userId)) {
            this.stats.blocked++;
            statsTracker.recordBlockedCommand();
            return false;
        }

        // Check global DM/Group settings from config
        if (!isGroup && !config.commands.allowInDM) {
            return false; // Silently ignore DM commands
        }

        if (isGroup && !config.commands.allowInGroups) {
            return false; // Silently ignore group commands
        }

        // Check command-specific DM/Group restrictions
        if (command.config.dmOnly && isGroup) {
            api.sendMessage("❌ This command can only be used in private messages.", threadId);
            return false;
        }

        if (command.config.groupOnly && !isGroup) {
            api.sendMessage("❌ This command can only be used in groups.", threadId);
            return false;
        }

        // Check permissions
        const hasPermission = this.checkPermission(userId, command.config.permissions);
        if (!hasPermission) {
            api.sendMessage("🚫 You don't have permission to use this command.", threadId);
            this.stats.blocked++;
            return false;
        }

        // Check cooldown (skip for admins if configured)
        if (!(config.commands.ignoreCooldownForAdmins && config.isAdmin(userId))) {
            const remaining = this.getCooldown(userId, command.config.name);
            if (remaining > 0) {
                api.sendMessage(
                    `⏳ Please wait ${remaining} seconds before using this command again.`,
                    threadId
                );
                return false;
            }
        }

        // Execute command
        try {
            // Log command execution with details
            const argsStr = args.length > 0 ? `args=[${args.join(", ")}]` : "args=[]";
            logger.info(
                "CommandHandler",
                `Executing: ${command.config.name} │ user:${userId} │ thread:${threadId} │ ${argsStr}`
            );

            // Multi-bot collision prevention for shared groups
            // CHECK HERE: Only claim the message if we are actually about to execute
            if (config.commands.singleReplyInSharedGC && isGroup && event.messageID) {
                if (this.processedMessages.has(event.messageID)) {
                    // Another bot beat us to it (or we beat ourselves in a race)
                    logger.debug(
                        "CommandHandler",
                        `Skipping duplicate execution for ${event.messageID}`
                    );
                    return false;
                }
                this.processedMessages.add(event.messageID);
            }

            // Wrap API with tracking and auto DM detection
            const wrappedApi = wrapApiWithTracking(api, threadId, event);

            // Build context object
            const context = {
                api: wrappedApi,
                event,
                args,
                prefix: usedPrefix,
                command: command.config,
                config,
                logger,
                isAdmin: config.isAdmin(userId),
                isSuperAdmin: config.isSuperAdmin(userId),
                commandHandler: this,
            };

            // Execute the command
            const startTime = Date.now();
            await command.execute(context);
            const duration = Date.now() - startTime;

            // Log success with duration
            logger.success("CommandHandler", `Completed: ${command.config.name} │ ${duration}ms`);

            // Set cooldown
            this.setCooldown(userId, command.config.name, command.config.cooldown);

            // Update stats
            this.stats.executed++;

            // Track in global stats
            statsTracker.recordCommand(command.config.name, userId, true);

            // Track command stats
            this.trackCommandStats(command.config.name, userId, duration);

            // Delete command message if configured
            if (config.commands.deleteCommandMessage) {
                api.unsendMessage(event.messageID);
            }

            return true;
        } catch (error) {
            logger.error(
                "CommandHandler",
                `Command error (${command.config.name}): ${error.message}`
            );
            logger.debug("CommandHandler", error.stack);

            this.stats.failed++;

            // Track failed command in global stats
            statsTracker.recordCommand(command.config.name, userId, false);

            api.sendMessage("❌ An error occurred while executing this command.", threadId);
            return false;
        }
    }

    /**
     * Checks if a user has the required permission level
     * @param {string} userId - User ID
     * @param {string} required - Required permission level
     * @returns {boolean}
     */
    checkPermission(userId, required) {
        switch (required) {
            case "superadmin":
                return config.isSuperAdmin(userId);
            case "admin":
                return config.isAdmin(userId);
            case "user":
            default:
                return true;
        }
    }

    /**
     * Gets all commands in a category
     * @param {string} category - Category name
     * @returns {Array<Object>} Array of commands
     */
    getCommandsByCategory(category) {
        const commands = [];

        for (const command of this.commands.values()) {
            if (command.config.category === category) {
                commands.push(command);
            }
        }

        return commands;
    }

    /**
     * Gets all categories with their commands
     * @returns {Map<string, Object>}
     */
    getAllCategories() {
        return this.categories;
    }

    /**
     * Tracks command usage statistics
     * @param {string} commandName - Name of the command
     * @param {string} userId - User who executed the command
     * @param {number} duration - Execution time in ms
     */
    trackCommandStats(commandName, userId, duration) {
        if (!this.commandStats.has(commandName)) {
            this.commandStats.set(commandName, {
                name: commandName,
                uses: 0,
                totalTime: 0,
                avgTime: 0,
                lastUsed: null,
                users: new Set(),
            });
        }

        const stats = this.commandStats.get(commandName);
        stats.uses++;
        stats.totalTime += duration;
        stats.avgTime = Math.round(stats.totalTime / stats.uses);
        stats.lastUsed = new Date();
        stats.users.add(userId);

        // Track user activity
        this.trackUserActivity(userId, commandName);
    }

    /**
     * Tracks user activity
     * @param {string} userId - User ID
     * @param {string} commandName - Command used
     */
    trackUserActivity(userId, commandName) {
        if (!this.userActivity.has(userId)) {
            this.userActivity.set(userId, {
                commands: 0,
                lastActive: null,
                commandHistory: [],
            });
        }

        const activity = this.userActivity.get(userId);
        activity.commands++;
        activity.lastActive = new Date();
        activity.commandHistory.push({
            command: commandName,
            time: new Date(),
        });

        // Keep only last 50 commands in history
        if (activity.commandHistory.length > 50) {
            activity.commandHistory.shift();
        }
    }

    /**
     * Gets command statistics
     * @param {string} [commandName] - Specific command or all
     * @returns {Object|Map}
     */
    getCommandStats(commandName) {
        if (commandName) {
            const stats = this.commandStats.get(commandName);
            if (stats) {
                return {
                    ...stats,
                    uniqueUsers: stats.users.size,
                };
            }
            return null;
        }

        // Return all command stats
        const allStats = [];
        for (const [name, stats] of this.commandStats) {
            allStats.push({
                name,
                uses: stats.uses,
                avgTime: stats.avgTime,
                uniqueUsers: stats.users.size,
                lastUsed: stats.lastUsed,
            });
        }
        return allStats.sort((a, b) => b.uses - a.uses);
    }

    /**
     * Gets user activity
     * @param {string} userId - User ID
     * @returns {Object|null}
     */
    getUserActivity(userId) {
        return this.userActivity.get(userId) || null;
    }

    /**
     * Gets top users by command usage
     * @param {number} limit - Number of users to return
     * @returns {Array}
     */
    getTopUsers(limit = 10) {
        const users = [];
        for (const [userId, activity] of this.userActivity) {
            users.push({
                userId,
                commands: activity.commands,
                lastActive: activity.lastActive,
            });
        }
        return users.sort((a, b) => b.commands - a.commands).slice(0, limit);
    }

    /**
     * Gets handler statistics
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            totalCommands: this.commands.size,
            totalAliases: this.aliases.size,
            totalCategories: this.categories.size,
            activeCooldowns: this.cooldowns.size,
            trackedCommands: this.commandStats.size,
            trackedUsers: this.userActivity.size,
        };
    }
}

// Export singleton instance
module.exports = new CommandHandler();
