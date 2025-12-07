/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                          NERO BOT - MAIN ENTRY POINT                          ║
 * ║              Messenger Bot Framework - Bootstrap and Initialize               ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 * 
 * This is the main entry point for the Nero Bot. It handles:
 * - Auto-update checking from GitHub
 * - Loading configuration
 * - Initializing the logger
 * - Loading command and event handlers
 * - Multi-account login support
 * - Setting up message listeners for all accounts
 * - Graceful shutdown handling
 * 
 * @author 0x3EF8
 * @version 2.0.0
 */

"use strict";

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORTS
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");

// Core modules
const config = require("./config/config");
const logger = require("./utils/logger");
const Updater = require("./utils/updater");

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURE LOGGER FROM SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

// Apply logging settings from config to the logger
logger.configure({
    console: config.logging.console,
    file: config.logging.file,
    filePath: config.logging.file ? path.join(config.paths.logs, config.logging.fileName) : null,
    levels: config.logging.levels,
    timestamps: config.logging.timestamps,
    timestampFormat: config.logging.timestampFormat,
    colors: config.logging.colors,
    maxFileSize: config.logging.maxFileSize,
    showPid: config.logging.showPid,
    showMemory: config.logging.showMemory,
    moduleWidth: config.logging.moduleWidth,
});

const commandHandler = require("./handlers/commandHandler");
const eventHandler = require("./handlers/eventHandler");
const AccountManager = require("./utils/accountManager");
const statsTracker = require("./utils/statsTracker");

// Nero framework
const nero = require("./nero-core");

// API Server
const { startServer } = require("./server");

// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════════════════════════════════════════════

/** @type {AccountManager} Multi-account manager instance */
const accountManager = new AccountManager({
    accountsPath: path.join(__dirname, "accounts"),
    neroOptions: config.neroOptions,
    logger: logger,
});

/** @type {boolean} Whether the bot is currently running */
let isRunning = false;

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Main initialization function
 * Bootstraps the entire bot application with multi-account support
 */
async function initialize() {
    try {
        // ═══════════════════════════════════════════════════════════════════
        // PHASE 0: CHECK FOR UPDATES (Before anything else)
        // ═══════════════════════════════════════════════════════════════════
        
        const updater = new Updater();
        const needsRestart = await updater.checkAndPrompt();
        
        if (needsRestart) {
            // Restart the process after update
            console.log("\x1b[36m[Updater]\x1b[0m Restarting bot with updated code...\n");
            
            // Small delay to let user see the message
            await new Promise(resolve => { setTimeout(resolve, 2000); });
            
            // Restart using the same command
            const { spawn } = require("child_process");
            const child = spawn(process.argv[0], process.argv.slice(1), {
                stdio: "inherit",
                detached: false,
            });
            
            child.on("error", (err) => {
                console.error("Failed to restart:", err.message);
                process.exit(1);
            });
            
            // Exit current process
            process.exit(0);
        }
        
        // ═══════════════════════════════════════════════════════════════════
        // PHASE 1: NERO FRAMEWORK INITIALIZATION (Silent bot logs)
        // ═══════════════════════════════════════════════════════════════════
        
        // Temporarily disable bot logs during nero framework initialization
        const originalConsole = logger.options.console;
        logger.options.console = false;
        
        // Initialize account manager (no logs)
        await accountManager.init(nero);
        
        // Login accounts - nero framework will show its own logs
        const hasAccounts = await checkAndLoginAccounts();
        
        // Re-enable bot logs
        logger.options.console = originalConsole;
        
        // Check login result - if no accounts, start server in waiting mode
        if (!hasAccounts) {
            logger.blank();
            logger.divider();
            logger.warn("Main", "No accounts found. Starting server in waiting mode...");
            logger.info("Main", "You can submit your appstate/cookies via the API.");
            logger.divider();
            
            // Validate config and load handlers anyway
            await validateConfig();
            await loadHandlers();
            
            // Start API server to accept cookies
            try {
                startServer();
                logger.blank();
                logger.info("Server", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                logger.info("Server", "📌 Waiting for appstate submission via API...");
                logger.info("Server", "   POST /api/cookies with your Facebook cookies");
                logger.info("Server", "   The bot will auto-restart when cookies are received");
                logger.info("Server", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            } catch (serverErr) {
                logger.error("Server", `API server failed to start: ${serverErr.message}`);
                process.exit(1);
            }
            
            return; // Stay running, waiting for cookies
        }
        
        // Start listeners - this triggers MQTT connection (nero logs)
        const listenerCount = accountManager.startAllListeners(handleEvent);
        
        // Wait for MQTT connection and auto-reconnect scheduling to complete
        // This ensures all nero framework logs finish before bot logs start
        await new Promise(resolve => { setTimeout(resolve, 3000); });
        
        // ═══════════════════════════════════════════════════════════════════
        // PHASE 2: BOT INITIALIZATION (Re-enable bot logs)
        // ═══════════════════════════════════════════════════════════════════
        
        // Re-enable bot logs
        logger.options.console = originalConsole;
        
        // Now show bot initialization logs
        logger.blank(); // Clean line break after nero logs
        logger.divider();
        logger.info("Main", "Bot initialization complete");
        
        // Step 1: Validate configuration and directories
        await validateConfig();
        
        // Step 2: Load handlers
        await loadHandlers();
        
        // Mark as running
        isRunning = true;
        
        // Display status
        displayAccountStatus();
        
        logger.info("Listener", `Active listeners: ${listenerCount}`);
        logger.success("Main", "Bot is now online and ready!");
        logger.divider();
        
        // Start API server
        try {
            startServer();
        } catch (serverErr) {
            logger.warn("Server", `API server failed to start: ${serverErr.message}`);
        }
        
    } catch (error) {
        logger.error("Main", `Initialization failed: ${error.message}`);
        logger.debug("Main", error.stack);
        process.exit(1);
    }
}

/**
 * Validates the configuration and ensures required files exist
 */
async function validateConfig() {
    logger.info("Config", "Validating configuration...");
    
    // Ensure required directories exist
    const directories = [
        config.paths.commands,
        config.paths.events,
        config.paths.logs,
        path.join(__dirname, "accounts"),
        path.join(config.paths.commands, "admin"),
        path.join(config.paths.commands, "user"),
        path.join(config.paths.events, "welcome"),
        path.join(config.paths.events, "otherEvents"),
    ];
    
    for (const dir of directories) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            logger.debug("Config", `Created directory: ${dir}`);
        }
    }
    
    logger.success("Config", "Configuration validated successfully");
}

/**
 * Loads command and event handlers
 */
async function loadHandlers() {
    logger.info("Handlers", "Loading handlers...");
    
    // Load command handler
    const commandCount = await commandHandler.init();
    logger.info("Handlers", `Command handler loaded ${commandCount} commands`);
    
    // Load event handler
    const eventCount = await eventHandler.init();
    logger.info("Handlers", `Event handler loaded ${eventCount} events`);
    
    logger.success("Handlers", "All handlers loaded successfully");
}

/**
 * Check for accounts and login
 * Uses accounts/ folder with appstate files
 * @returns {Promise<boolean>} Whether at least one account is online
 */
async function checkAndLoginAccounts() {
    logger.info("Auth", "Checking for accounts...");
    
    // Discover and login accounts from accounts folder
    const discovered = accountManager.discoverAccounts();
    
    if (discovered.length > 0) {
        logger.info("Auth", `Found ${discovered.length} account(s) in accounts folder`);
        
        const result = await accountManager.loginAll();
        
        if (result.success > 0) {
            return true;
        }
    }
    
    // No accounts found
    logger.error("Auth", "No appstate files found!");
    logger.info("Auth", "Please add appstate JSON files to the 'accounts' folder");
    
    return false;
}

/**
 * Display account status summary
 */
function displayAccountStatus() {
    const stats = accountManager.getAccountStats();
    
    logger.divider();
    logger.info("Status", "═══ ACCOUNT STATUS ═══");
    logger.info("Status", `Total Accounts: ${stats.total}`);
    logger.info("Status", `Online: ${stats.online} | Offline: ${stats.offline} | Error: ${stats.error}`);
    
    // List online accounts
    const onlineAccounts = accountManager.getOnlineAccounts();
    
    if (onlineAccounts.length > 0) {
        logger.info("Status", "Online Accounts:");
        
        for (const account of onlineAccounts) {
            const displayName = account.userName || account.name;
            logger.info("Status", `  • ${displayName} (UID: ${account.userID})`);
        }
    }
    
    // List failed accounts
    const failedAccounts = accountManager.getAllAccounts().filter((a) => a.status === "error");
    
    if (failedAccounts.length > 0) {
        logger.warn("Status", "Failed Accounts:");
        
        for (const account of failedAccounts) {
            logger.warn("Status", `  • ${account.name}: ${account.error}`);
        }
    }
    
    logger.divider();
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Main event handler - processes all incoming events from all accounts
 * @param {Object} api - The Nero API instance for this account
 * @param {Object} event - The event object from Nero
 * @param {Object} account - Account info object
 */
async function handleEvent(api, event, account) {
    try {
        // Skip if event is blocked (e.g., by anti-spam)
        if (event.__blocked) {
            return;
        }
        
        // Track message in stats (for message events)
        if (event.type === "message" || event.type === "message_reply") {
            statsTracker.recordMessage(event);
        }
        
        // Track reactions
        if (event.type === "message_reaction") {
            statsTracker.recordReaction();
        }
        
        // Skip if user/thread is blocked (only for message events with senderID)
        if (event.senderID && config.isBlocked(event.senderID)) {
            return;
        }
        if (event.threadID && config.isThreadBlocked(event.threadID)) {
            return;
        }
        
        // Process through event handlers first (like anti-spam, welcome, antiLeave)
        await eventHandler.handle(api, event);
        
        // Check if event was blocked by an event handler
        if (event.__blocked) {
            return;
        }
        
        // Process commands (for message events)
        if (event.type === "message" || event.type === "message_reply") {
            const wasCommand = await commandHandler.handle(api, event);
            
            // If it was a command, update stats and we're done
            if (wasCommand) {
                accountManager.incrementCommandCount(account.name);
                return;
            }
        }
        
    } catch (error) {
        logger.error("EventHandler", `Error processing event: ${error.message}`);
        logger.debug("EventHandler", error.stack);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handles graceful shutdown of the bot
 * @param {string} signal - The signal that triggered shutdown
 */
async function shutdown(signal) {
    logger.warn("Shutdown", `Received ${signal} signal, shutting down...`);
    
    isRunning = false;
    
    // Stop all listeners (but DON'T logout - keeps sessions valid)
    try {
        accountManager.stopAllListeners();
        // Note: We don't call logoutAll() to preserve appstate/cookies
    } catch (err) {
        logger.debug("Shutdown", `Cleanup error (ignored): ${err.message}`);
    }
    
    logger.success("Shutdown", "Bot has been shut down cleanly");
    logger.close();
    
    process.exit(0);
}

// Handle various shutdown signals
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Handle uncaught exceptions - log but don't crash
process.on("uncaughtException", (error) => {
    logger.error("Fatal", `Uncaught Exception: ${error.message}`);
    logger.debug("Fatal", error.stack);
    // Don't shutdown on uncaught exceptions, just log and continue
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, _promise) => {
    logger.error("Fatal", `Unhandled Rejection: ${reason}`);
    // Don't exit for unhandled rejections, just log them
});

// ═══════════════════════════════════════════════════════════════════════════════
// START THE BOT
// ═══════════════════════════════════════════════════════════════════════════════

// Initialize the bot
initialize();

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    accountManager,
    commandHandler,
    eventHandler,
    statsTracker,
    config,
    logger,
    Updater,
    isRunning: () => isRunning,
    
    // Helper methods for external access
    getAccounts: () => accountManager.getAllAccounts(),
    getOnlineAccounts: () => accountManager.getOnlineAccounts(),
    getPrimaryApi: () => {
        const primary = accountManager.getPrimaryAccount();
        return primary ? primary.api : null;
    },
    getApiByName: (name) => {
        const account = accountManager.getAccount(name);
        return account ? account.api : null;
    },
    getApiByUserID: (userID) => {
        const account = accountManager.getAccountByUserID(userID);
        return account ? account.api : null;
    },
};
