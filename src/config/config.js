/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                           NERO BOT CONFIGURATION                              ║
 * ║          Central configuration file for all bot settings and options          ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 * 
 * This file contains all configurable settings for the Nero Bot.
 * Modify these values to customize the bot's behavior.
 * For runtime behavior settings, see settings.js
 * 
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const path = require("path");
const fs = require("fs");
const settings = require("./settings");

// Load .env file if it exists (silently)
try {
    // Suppress dotenv v17+ output messages
    process.env.DOTENV_CONFIG_QUIET = 'true';
    require("dotenv").config({ 
        path: path.resolve(__dirname, "..", "..", ".env")
    });
} catch {
    // dotenv not installed or .env not found - will use defaults
}

// Load dynamic config
const dynamicConfigPath = path.resolve(__dirname, "dynamic.json");
let dynamicConfig = {
    admins: [],
    blockedUsers: [],
    blockedThreads: []
};

try {
    if (fs.existsSync(dynamicConfigPath)) {
        const fileContent = fs.readFileSync(dynamicConfigPath, 'utf8');
        dynamicConfig = JSON.parse(fileContent);
    }
} catch (error) {
    console.error("Failed to load dynamic config:", error);
}

// Helper to save dynamic config
function saveDynamicConfig(newConfig) {
    try {
        fs.writeFileSync(dynamicConfigPath, JSON.stringify(newConfig, null, 2));
        return true;
    } catch (error) {
        console.error("Failed to save dynamic config:", error);
        return false;
    }
}

const config = {
    // ═══════════════════════════════════════════════════════════════════════════
    // BOT IDENTITY & BASIC SETTINGS
    // ═══════════════════════════════════════════════════════════════════════════
    bot: {
        name: "Nero Bot",                    // Bot name displayed in responses
        version: "1.0.0",                    // Bot version
        description: "A lightweight, modular Messenger chatbot framework with multi-account support, event handling, and extensible command system",
        timeZone: "Asia/Manila",             // Global Timezone
        prefixEnabled: false,                // Enable/disable prefix requirement
        prefix: "!",                         // Command prefix (string or array)
        botPrefix: ".",                      // Bot's own prefix when selfListen enabled
        alternativePrefixes: ["/", "-"],     // Alternative prefixes (optional)
        admins: dynamicConfig.admins || [],  // Bot owner/admin user IDs (Facebook UIDs)
        superAdmins: [                       // Super admins with full access (Hardcoded for security)
            "100044343889036"
        ],
        blockedUsers: dynamicConfig.blockedUsers || [],    // Blocked/banned user IDs
        blockedThreads: dynamicConfig.blockedThreads || [],// Blocked thread IDs
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // NERO LOGIN OPTIONS (from settings.js)
    // ═══════════════════════════════════════════════════════════════════════════
    neroOptions: settings.neroOptions,

    // ═══════════════════════════════════════════════════════════════════════════
    // PATHS CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════════════
    paths: {
        // Project structure
        root: path.resolve(__dirname, "..", ".."),                          // Project root directory
        src: path.resolve(__dirname, ".."),                                 // Source directory
        
        // Source paths (inside src/features/)
        commands: path.resolve(__dirname, "..", "features", "commands"),     // Commands directory
        events: path.resolve(__dirname, "..", "features", "events"),         // Events directory
        background: path.resolve(__dirname, "..", "features", "background"), // Background tasks directory
        config: path.resolve(__dirname),                                    // Config directory
        handlers: path.resolve(__dirname, "..", "handlers"),                // Handlers directory
        utils: path.resolve(__dirname, "..", "utils"),                      // Utils directory
        core: path.resolve(__dirname, "..", "core"),                        // Core framework directory
        
        // Data paths (at root level)
        accounts: path.resolve(__dirname, "..", "..", "accounts"),          // Multi-account directory
        logs: path.resolve(__dirname, "..", "..", "logs"),                  // Logs directory
        data: path.resolve(__dirname, "..", "..", "data"),                  // Data directory
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // COMMAND SETTINGS (from settings.js + directories)
    // ═══════════════════════════════════════════════════════════════════════════
    commands: {
        ...settings.commands,
        directories: ["admin", "user"],      // Directories to load commands from
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENT SETTINGS (from settings.js + directories)
    // ═══════════════════════════════════════════════════════════════════════════
    events: {
        ...settings.events,
        directories: ["welcome", "protection", "AI", "media"],  // Directories to load events from
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // BACKGROUND TASK SETTINGS (from settings.js + directories)
    // ═══════════════════════════════════════════════════════════════════════════
    background: {
        ...settings.background,
        directories: [],  // Empty = load from root background folder directly
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // LOGGING CONFIGURATION (from settings.js)
    // ═══════════════════════════════════════════════════════════════════════════
    logging: settings.logging,

    // ═══════════════════════════════════════════════════════════════════════════
    // RATE LIMITING & ANTI-SPAM (from settings.js)
    // ═══════════════════════════════════════════════════════════════════════════
    rateLimit: settings.rateLimit,

    // ═══════════════════════════════════════════════════════════════════════════
    // ENVIRONMENT VARIABLES
    // ═══════════════════════════════════════════════════════════════════════════
    env: {
        nodeEnv: process.env.NODE_ENV || "development",  // Node environment
        debug: process.env.DEBUG === "true" || false,    // Debug mode
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // API KEYS (loaded from .env file - see .env.template for setup)
    // ═══════════════════════════════════════════════════════════════════════════
    apiKeys: {
        // Primary Gemini API key (from .env)
        gemini: process.env.GEMINI_API_KEY || "",
        
        // Backup Gemini API keys (comma-separated in .env, auto-rotate on rate limit)
        geminiBackups: (process.env.GEMINI_BACKUP_KEYS || "")
            .split(",")
            .map(key => key.trim())
            .filter(key => key.length > 0),
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // GENIUS API (for lyrics - https://genius.com/api-clients)
    // ═══════════════════════════════════════════════════════════════════════════
    geniusClientId: process.env.GENIUS_CLIENT_ID || "",
    geniusClientSecret: process.env.GENIUS_CLIENT_SECRET || "",

    // ═══════════════════════════════════════════════════════════════════════════
    // API SERVER SETTINGS
    // ═══════════════════════════════════════════════════════════════════════════
    server: {
        enabled: true,                       // Enable/disable API server
        port: 30174,                         // Server port
        host: '0.0.0.0',                     // Server host (0.0.0.0 accepts connections on all interfaces)
        // Public URL: http://176.100.37.91:30174/
        logStartup: false,                    // Log server startup info
        logRequests: false,                   // Log incoming API requests
        
        // API SECURITY
        // ───────────────────────────────────────────────────────────────────────
        apiKey: process.env.NERO_API_KEY || '',
        requireAuth: true,                   // Require API key for sensitive endpoints
        publicEndpoints: ['/api/stats', '/', '/favicon.ico'],     // Endpoints accessible without API key
        
        // API RATE LIMITING
        // ───────────────────────────────────────────────────────────────────────
        rateLimit: {
            enabled: true,                   // Enable API rate limiting
            windowMs: 60000,                 // Time window in ms (1 minute)
            maxRequests: 100,                // Max requests per window per IP
            skipSuccessfulRequests: false,   // Count all requests
            message: 'Too many requests, please try again later',
        },
    },
};

/**
 * Helper function to get nested config value
 * @param {string} path - Dot-notation path (e.g., 'bot.prefix')
 * @param {*} defaultValue - Default value if path doesn't exist
 * @returns {*} The config value or default
 */
config.get = function(configPath, defaultValue = null) {
    const keys = configPath.split(".");
    let result = this;
    
    for (const key of keys) {
        if (result && typeof result === "object" && key in result) {
            result = result[key];
        } else {
            return defaultValue;
        }
    }
    
    return result;
};

/**
 * Check if a user is an admin
 * @param {string} userId - The user's Facebook UID
 * @returns {boolean}
 */
config.isAdmin = function(userId) {
    return this.bot.admins.includes(userId) || this.bot.superAdmins.includes(userId);
};

/**
 * Check if a user is a super admin
 * @param {string} userId - The user's Facebook UID
 * @returns {boolean}
 */
config.isSuperAdmin = function(userId) {
    return this.bot.superAdmins.includes(userId);
};

/**
 * Check if a user is blocked
 * @param {string} userId - The user's Facebook UID
 * @returns {boolean}
 */
config.isBlocked = function(userId) {
    return this.bot.blockedUsers.includes(userId);
};

/**
 * Check if a thread is blocked
 * @param {string} threadId - The thread ID
 * @returns {boolean}
 */
config.isThreadBlocked = function(threadId) {
    return this.bot.blockedThreads.includes(threadId);
};

/**
 * Add a user as admin
 * @param {string} userId - The user's Facebook UID
 * @returns {boolean} True if added, false if already exists
 */
config.addAdmin = function(userId) {
    if (this.bot.admins.includes(userId)) return false;
    this.bot.admins.push(userId);
    saveDynamicConfig({
        admins: this.bot.admins,
        blockedUsers: this.bot.blockedUsers,
        blockedThreads: this.bot.blockedThreads
    });
    return true;
};

/**
 * Remove a user from admins
 * @param {string} userId - The user's Facebook UID
 * @returns {boolean} True if removed, false if not found
 */
config.removeAdmin = function(userId) {
    const index = this.bot.admins.indexOf(userId);
    if (index === -1) return false;
    this.bot.admins.splice(index, 1);
    saveDynamicConfig({
        admins: this.bot.admins,
        blockedUsers: this.bot.blockedUsers,
        blockedThreads: this.bot.blockedThreads
    });
    return true;
};

/**
 * Block a thread (Mute bot)
 * @param {string} threadId - The thread ID
 * @returns {boolean} True if blocked, false if already blocked
 */
config.blockThread = function(threadId) {
    if (this.bot.blockedThreads.includes(threadId)) return false;
    this.bot.blockedThreads.push(threadId);
    saveDynamicConfig({
        admins: this.bot.admins,
        blockedUsers: this.bot.blockedUsers,
        blockedThreads: this.bot.blockedThreads
    });
    return true;
};

/**
 * Unblock a thread (Unmute bot)
 * @param {string} threadId - The thread ID
 * @returns {boolean} True if unblocked, false if not blocked
 */
config.unblockThread = function(threadId) {
    const index = this.bot.blockedThreads.indexOf(threadId);
    if (index === -1) return false;
    this.bot.blockedThreads.splice(index, 1);
    saveDynamicConfig({
        admins: this.bot.admins,
        blockedUsers: this.bot.blockedUsers,
        blockedThreads: this.bot.blockedThreads
    });
    return true;
};

/**
 * Block a user (Ignore commands)
 * @param {string} userId - The user's Facebook UID
 * @returns {boolean} True if blocked, false if already blocked
 */
config.blockUser = function(userId) {
    if (this.bot.blockedUsers.includes(userId)) return false;
    this.bot.blockedUsers.push(userId);
    saveDynamicConfig({
        admins: this.bot.admins,
        blockedUsers: this.bot.blockedUsers,
        blockedThreads: this.bot.blockedThreads
    });
    return true;
};

/**
 * Unblock a user
 * @param {string} userId - The user's Facebook UID
 * @returns {boolean} True if unblocked, false if not blocked
 */
config.unblockUser = function(userId) {
    const index = this.bot.blockedUsers.indexOf(userId);
    if (index === -1) return false;
    this.bot.blockedUsers.splice(index, 1);
    saveDynamicConfig({
        admins: this.bot.admins,
        blockedUsers: this.bot.blockedUsers,
        blockedThreads: this.bot.blockedThreads
    });
    return true;
};

// Freeze the config object to prevent accidental modifications
Object.freeze(config.bot);
Object.freeze(config.paths);
Object.freeze(config.commands);
Object.freeze(config.events);
Object.freeze(config.background);
Object.freeze(config.env);
Object.freeze(config.apiKeys);
Object.freeze(config.server);
Object.freeze(config.server.rateLimit);

module.exports = config;