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
const settings = require("./settings");

// Load .env file if it exists
try {
    require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
} catch {
    // dotenv not installed or .env not found - will use defaults
}

const config = {
    // ═══════════════════════════════════════════════════════════════════════════
    // BOT IDENTITY & BASIC SETTINGS
    // ═══════════════════════════════════════════════════════════════════════════
    bot: {
        name: "Nero Bot",                    // Bot name displayed in responses
        version: "1.0.0",                    // Bot version
        description: "A lightweight, modular Messenger chatbot framework with multi-account support, event handling, and extensible command system",
        prefixEnabled: true,                 // Enable/disable prefix requirement
        prefix: "!",                         // Command prefix (string or array)
        botPrefix: ".",                      // Bot's own prefix when selfListen enabled
        alternativePrefixes: ["/", "-"],     // Alternative prefixes (optional)
        admins: [                            // Bot owner/admin user IDs (Facebook UIDs)
            "100044343889036",
            "100091687191806"
        ],
        superAdmins: [                       // Super admins with full access
            "100044343889036"
        ],
        blockedUsers: [],                    // Blocked/banned user IDs
        blockedThreads: [],                  // Blocked thread IDs
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // NERO LOGIN OPTIONS (from settings.js)
    // ═══════════════════════════════════════════════════════════════════════════
    neroOptions: settings.neroOptions,

    // ═══════════════════════════════════════════════════════════════════════════
    // PATHS CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════════════
    paths: {
        root: path.resolve(__dirname, ".."),                    // Root directory
        commands: path.resolve(__dirname, "..", "commands"),    // Commands directory
        events: path.resolve(__dirname, "..", "events"),        // Events directory
        config: path.resolve(__dirname),                        // Config directory
        handlers: path.resolve(__dirname, "..", "handlers"),    // Handlers directory
        utils: path.resolve(__dirname, "..", "utils"),          // Utils directory
        accounts: path.resolve(__dirname, "..", "accounts"),    // Multi-account directory
        logs: path.resolve(__dirname, "..", "logs"),            // Logs directory
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
        directories: ["welcome", "otherEvents", "AI"],  // Directories to load events from
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
        port: 3000,                          // Server port
        host: 'localhost',                   // Server host
        logStartup: false,                    // Log server startup info
        logRequests: false,                   // Log incoming API requests
        
        // API SECURITY
        // ───────────────────────────────────────────────────────────────────────
        apiKey: process.env.NERO_API_KEY || '',
        requireAuth: true,                   // Require API key for sensitive endpoints
        publicEndpoints: ['/api/stats'],     // Endpoints accessible without API key
        
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

    // ═══════════════════════════════════════════════════════════════════════════
    // FEATURE FLAGS (from settings.js)
    // ═══════════════════════════════════════════════════════════════════════════
    features: settings.features,
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

// Freeze the config object to prevent accidental modifications
Object.freeze(config.bot);
Object.freeze(config.paths);
Object.freeze(config.commands);
Object.freeze(config.events);
Object.freeze(config.env);
Object.freeze(config.apiKeys);
Object.freeze(config.server);
Object.freeze(config.server.rateLimit);

module.exports = config;
