/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                          NERO BOT SETTINGS                                    ║
 * ║        Runtime settings for bot behavior, features, and options               ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This file contains all runtime settings that control bot behavior.
 * Separate from config.js to keep identity/paths separate from behavior settings.
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const settings = {
    // ═══════════════════════════════════════════════════════════════════════════
    // NERO FRAMEWORK OPTIONS - Passed directly to the Nero login function
    // All available options from nero/src/core/auth/setOptions.js
    // ═══════════════════════════════════════════════════════════════════════════
    neroOptions: {
        // ─────────────────────────────────────────────────────────────────────────
        // CORE LISTENING OPTIONS
        // ─────────────────────────────────────────────────────────────────────────
        selfListen: true, // Listen to messages from bot's own account
        selfListenEvent: false, // Include bot's own events in event listener
        listenEvents: true, // Listen to events (join/leave, name changes, etc.)
        listenTyping: false, // Listen to typing indicators from users
        updatePresence: false, // Update online presence status

        // ─────────────────────────────────────────────────────────────────────────
        // CONNECTION & SESSION OPTIONS
        // ─────────────────────────────────────────────────────────────────────────
        online: true, // Set bot as online/active
        forceLogin: false, // Force new login even if session exists
        autoReconnect: true, // Automatically reconnect on disconnect
        emitReady: false, // Emit ready event when fully connected

        // ─────────────────────────────────────────────────────────────────────────
        // AUTO-ACTION OPTIONS
        // ─────────────────────────────────────────────────────────────────────────
        autoMarkDelivery: false, // Automatically mark messages as delivered
        autoMarkRead: true, // Automatically mark messages as read

        // ─────────────────────────────────────────────────────────────────────────
        // USER AGENT & IDENTITY OPTIONS
        // ─────────────────────────────────────────────────────────────────────────
        userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        randomUserAgent: false, // Use random user agent on each request (overrides userAgent)

        // ─────────────────────────────────────────────────────────────────────────
        // NETWORK & PROXY OPTIONS
        // ─────────────────────────────────────────────────────────────────────────
        proxy: null, // Proxy URL string (e.g., "http://127.0.0.1:8080") or null
        bypassRegion: null, // Region bypass code (e.g., "US", "PH") or null

        // ─────────────────────────────────────────────────────────────────────────
        // FRAMEWORK LOGGING & DEBUG OPTIONS
        // ─────────────────────────────────────────────────────────────────────────
        // Debug Levels:
        //   • silent  - No debug output (production mode)
        //   • minimal - Critical errors only
        //   • normal  - Errors, warnings, key events (recommended)
        //   • verbose - Full telemetry: HTTP, MQTT, deltas, API calls
        logging: true, // Enable Nero framework banner/info (true/false)
        debugLevel: "normal", // Debug level for framework logging
        debugTimestamps: false, // Show timestamps in framework debug logs

        // ─────────────────────────────────────────────────────────────────────────
        // HUMAN BEHAVIOR ENGINE - Enable for realistic human-like delays
        // ─────────────────────────────────────────────────────────────────────────
        humanBehavior: true, // Enable human behavior simulation in framework
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // COMMAND SETTINGS
    // ═══════════════════════════════════════════════════════════════════════════
    commands: {
        enabled: true, // Enable/disable command system
        defaultCooldown: 3, // Default cooldown in seconds
        ignoreCooldownForAdmins: true, // Ignore cooldown for admins
        deleteCommandMessage: false, // Delete command message after execution
        caseSensitive: false, // Case sensitive commands
        allowInDM: true, // Allow commands in DMs
        allowInGroups: true, // Allow commands in groups
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENT SETTINGS
    // ═══════════════════════════════════════════════════════════════════════════
    events: {
        enabled: true, // Enable/disable event system
        allowInDM: true, // Allow events in DMs
        allowInGroups: true, // Allow events in groups
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // BACKGROUND TASK SETTINGS
    // ═══════════════════════════════════════════════════════════════════════════
    background: {
        enabled: true, // Enable/disable background task system
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // LOGGING CONFIGURATION (Bot Logger - Controls ALL bot output)
    // ═══════════════════════════════════════════════════════════════════════════
    //
    // Log Level Presets (choose ONE):
    //   • "silent"  - No logging output at all (completely quiet)
    //   • "error"   - Errors only (critical issues)
    //   • "warn"    - Warnings + errors (issues to be aware of)
    //   • "info"    - Standard output (recommended for production)
    //   • "verbose" - All logs including debug (for development)
    //   • "debug"   - Same as verbose (full debugging)
    //   • "all"     - Everything (maximum verbosity)
    //
    // Or use array for custom: ["info", "error", "success"]
    //
    // Examples:
    //   levels: "silent"                    - Production: no console output
    //   levels: "error"                     - Production: only errors
    //   levels: "info"                      - Production: normal operation logs
    //   levels: "all"                       - Development: see everything
    //   levels: ["error", "success"]        - Custom: only errors and successes
    //
    logging: {
        console: true, // Enable console logging (false = silent mode)
        file: false, // Enable file logging
        filePath: "./logs/bot.log", // Log file path (supports rotation)
        maxFileSize: 10, // Max file size in MB before rotation
        levels: "info", // Log level preset (see above for options)
        timestamps: true, // Show timestamps (HH:mm:ss.SSS format)
        colors: true, // Enable colored output
        moduleWidth: 18, // Fixed width for module names (alignment)
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // RATE LIMITING & ANTI-SPAM
    // ═══════════════════════════════════════════════════════════════════════════
    rateLimit: {
        enabled: true, // Enable rate limiting
        maxMessages: 5, // Maximum messages per window
        windowSeconds: 10, // Time window in seconds
        penaltySeconds: 30, // Penalty time when rate limited
    },
};

// Freeze settings to prevent accidental modifications
Object.freeze(settings.neroOptions);
Object.freeze(settings.commands);
Object.freeze(settings.events);
Object.freeze(settings.background);
Object.freeze(settings.logging);
Object.freeze(settings.rateLimit);

module.exports = settings;
