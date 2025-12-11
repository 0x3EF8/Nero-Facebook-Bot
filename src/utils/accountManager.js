/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                        NERO BOT - ACCOUNT MANAGER                             ║
 * ║       Multi-Account Login Handler - Manage Multiple Bot Instances             ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This module handles multi-account support for the Nero Bot, allowing
 * multiple Facebook accounts to run simultaneously under one process.
 *
 * Features:
 * - Load multiple appstate files from accounts folder
 * - Manage multiple API instances
 * - Track login status per account
 * - Graceful reconnection handling
 * - Account statistics and monitoring
 * - Auto-delete failed cookie files after max retries
 * - Auto-save appstate to keep sessions alive longer
 *
 * @author 0x3EF8
 * @version 1.2.0
 */

"use strict";

const fs = require("fs");
const path = require("path");
const EventEmitter = require("events");

// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNT MANAGER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} AccountInfo
 * @property {string} name - Account file name (without extension)
 * @property {string} filePath - Full path to appstate file
 * @property {Object|null} api - Nero API instance
 * @property {string|null} userID - Facebook User ID
 * @property {string|null} userName - Facebook display name
 * @property {string|null} profilePicUrl - Facebook profile picture URL
 * @property {Function|null} stopListening - MQTT listener stop function
 * @property {string} status - Account status: 'pending' | 'online' | 'offline' | 'error' | 'deleted'
 * @property {string|null} error - Error message if status is 'error'
 * @property {Date} loginTime - When the account logged in
 * @property {number} messageCount - Number of messages processed
 * @property {number} commandCount - Number of commands processed
 * @property {number} loginAttempts - Number of failed login attempts
 */

class AccountManager extends EventEmitter {
    /**
     * Creates a new AccountManager instance
     * @param {Object} options - Configuration options
     * @param {string} options.accountsPath - Path to accounts folder
     * @param {Object} options.neroOptions - Nero API options
     * @param {Object} options.logger - Logger instance
     * @param {number} options.maxLoginRetries - Max login attempts before deleting cookie file (default: 4)
     * @param {number} options.retryDelay - Delay between retries in ms (default: 3000)
     * @param {boolean} options.autoSaveAppState - Enable auto-save appstate feature (default: true)
     * @param {number} options.autoSaveInterval - Auto-save interval in minutes (default: 30)
     */
    constructor(options = {}) {
        super();

        /** @type {string} Path to accounts folder */
        this.accountsPath = options.accountsPath || path.join(process.cwd(), "accounts");

        /** @type {Object} Nero API options */
        this.neroOptions = options.neroOptions || {};

        /** @type {Object} Logger instance */
        this.logger = options.logger || console;

        /** @type {number} Maximum login retries before deleting cookie file */
        this.maxLoginRetries = options.maxLoginRetries || 4;

        /** @type {number} Delay between login retries in milliseconds */
        this.retryDelay = options.retryDelay || 3000;

        /** @type {boolean} Enable auto-save appstate feature */
        this.autoSaveAppState = options.autoSaveAppState !== false; // Default true

        /** @type {number} Auto-save interval in minutes */
        this.autoSaveInterval = options.autoSaveInterval || 30;

        /** @type {Map<string, AccountInfo>} Map of account name to account info */
        this.accounts = new Map();

        /** @type {Map<string, AccountInfo>} Map of userID to account info (for quick lookup) */
        this.accountsByUserID = new Map();

        /** @type {Map<string, NodeJS.Timeout>} Map of account name to auto-save interval ID */
        this.autoSaveTimers = new Map();

        /** @type {Map<string, Object>} Map of account name to save statistics */
        this.appStateSaveStats = new Map();

        /** @type {Object} Nero framework reference */
        this.nero = null;

        /** @type {boolean} Whether the manager is initialized */
        this.initialized = false;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Initialize the account manager
     * @param {Object} nero - Nero framework reference
     * @returns {Promise<void>}
     */
    async init(nero) {
        this.nero = nero;

        // Ensure accounts folder exists
        if (!fs.existsSync(this.accountsPath)) {
            fs.mkdirSync(this.accountsPath, { recursive: true });
            this.logger.info("AccountManager", `Created accounts folder: ${this.accountsPath}`);
        }

        this.initialized = true;
        this.logger.info("AccountManager", "Account manager initialized");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ACCOUNT DISCOVERY
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Discover all appstate files in the accounts folder
     * @returns {Array<{name: string, filePath: string}>} Array of account file info
     */
    discoverAccounts() {
        const accounts = [];

        if (!fs.existsSync(this.accountsPath)) {
            return accounts;
        }

        const files = fs.readdirSync(this.accountsPath);

        for (const file of files) {
            // Skip non-JSON files and template files
            if (!file.endsWith(".json") || file.endsWith(".template")) {
                continue;
            }

            const filePath = path.join(this.accountsPath, file);
            const stat = fs.statSync(filePath);

            // Skip directories
            if (stat.isDirectory()) {
                continue;
            }

            accounts.push({
                name: path.basename(file, ".json"),
                filePath: filePath,
            });
        }

        return accounts;
    }

    /**
     * Validate an appstate file
     * @param {string} filePath - Path to appstate file
     * @returns {{valid: boolean, appState?: Array, error?: string}}
     */
    validateAppState(filePath) {
        try {
            const content = fs.readFileSync(filePath, "utf8");
            const appState = JSON.parse(content);

            // Check if it's an array
            if (!Array.isArray(appState)) {
                return { valid: false, error: "AppState must be an array" };
            }

            // Check if it has cookies
            if (appState.length === 0) {
                return { valid: false, error: "AppState is empty" };
            }

            // Basic validation - check for required cookie properties
            const hasUserCookie = appState.some(
                (cookie) => cookie.key === "c_user" || cookie.name === "c_user"
            );

            if (!hasUserCookie) {
                return { valid: false, error: "AppState missing c_user cookie" };
            }

            return { valid: true, appState };
        } catch (error) {
            return { valid: false, error: `Parse error: ${error.message}` };
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // LOGIN MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Attempt a single login (internal helper)
     * @param {Object} accountInfo - Account info object
     * @param {Array} appState - Validated appstate array
     * @returns {Promise<{success: boolean, error?: string}>}
     * @private
     */
    _attemptLogin(accountInfo, appState) {
        return new Promise((resolve) => {
            this.nero.login({ appState }, this.neroOptions, async (err, api) => {
                if (err) {
                    resolve({ success: false, error: err.message || String(err) });
                    return;
                }

                // Successful login
                accountInfo.api = api;
                accountInfo.userID = api.getCurrentUserID ? api.getCurrentUserID() : null;
                accountInfo.status = "online";
                accountInfo.loginTime = new Date();
                accountInfo.loginAttempts = 0; // Reset on success

                // Add to userID lookup map
                if (accountInfo.userID) {
                    this.accountsByUserID.set(accountInfo.userID, accountInfo);
                }

                // Fetch user name
                if (accountInfo.userID && api.getUserInfo) {
                    try {
                        const userInfo = await api.getUserInfo(accountInfo.userID);
                        if (userInfo) {
                            if (userInfo.name) {
                                accountInfo.userName = userInfo.name;
                            }
                            if (userInfo.profilePicUrl) {
                                accountInfo.profilePicUrl = userInfo.profilePicUrl;
                            } else {
                                accountInfo.profilePicUrl = `https://graph.facebook.com/${accountInfo.userID}/picture?width=100&height=100&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
                            }
                        }
                    } catch {
                        accountInfo.profilePicUrl = `https://graph.facebook.com/${accountInfo.userID}/picture?width=100&height=100&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
                    }
                }

                resolve({ success: true });
            });
        });
    }

    /**
     * Delete a failed cookie file
     * @param {string} filePath - Path to the cookie file
     * @param {string} name - Account name for logging
     * @returns {boolean} Whether deletion was successful
     * @private
     */
    _deleteCookieFile(filePath, name) {
        try {
            if (fs.existsSync(filePath)) {
                // Delete the cookie file permanently
                fs.unlinkSync(filePath);

                this.logger.warn(
                    "AccountManager",
                    `[${name}] Cookie file deleted after ${this.maxLoginRetries} failed attempts`
                );

                return true;
            }
        } catch (error) {
            this.logger.error(
                "AccountManager",
                `[${name}] Failed to delete cookie file: ${error.message}`
            );
        }
        return false;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // APPSTATE AUTO-SAVE FEATURE
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Save fresh appstate (cookies) to file for an account
     * This keeps the session alive by saving Facebook's refreshed cookies
     * @param {string} name - Account name
     * @param {string} [reason='manual'] - Reason for save (for logging)
     * @returns {Promise<{success: boolean, cookieCount?: number, error?: string}>}
     */
    async saveAppState(name, reason = "manual") {
        const account = this.accounts.get(name);

        if (!account) {
            this.logger.error("AppStateSave", `[${name}] Account not found`);
            return { success: false, error: "Account not found" };
        }

        if (!account.api || account.status !== "online") {
            this.logger.warn("AppStateSave", `[${name}] Account not online, skipping save`);
            return { success: false, error: "Account not online" };
        }

        if (!account.api.getAppState) {
            this.logger.error("AppStateSave", `[${name}] API missing getAppState method`);
            return { success: false, error: "getAppState method not available" };
        }

        try {
            // Get fresh appstate from the API
            const freshAppState = account.api.getAppState();

            if (!freshAppState || !Array.isArray(freshAppState)) {
                this.logger.error("AppStateSave", `[${name}] Invalid appstate returned from API`);
                return { success: false, error: "Invalid appstate from API" };
            }

            const cookieCount = freshAppState.length;

            if (cookieCount === 0) {
                this.logger.error("AppStateSave", `[${name}] Empty appstate returned from API`);
                return { success: false, error: "Empty appstate" };
            }

            // Read existing appstate for comparison
            let existingCookieCount = 0;
            try {
                const existingContent = fs.readFileSync(account.filePath, "utf8");
                const existingState = JSON.parse(existingContent);
                existingCookieCount = Array.isArray(existingState) ? existingState.length : 0;
            } catch {
                // File doesn't exist or invalid - that's fine, we'll create it
            }

            // Write the fresh appstate to file
            const jsonContent = JSON.stringify(freshAppState, null, 2);
            fs.writeFileSync(account.filePath, jsonContent, "utf8");

            // Update save statistics
            const stats = this.appStateSaveStats.get(name) || {
                totalSaves: 0,
                lastSaveTime: null,
                lastCookieCount: 0,
            };
            stats.totalSaves++;
            stats.lastSaveTime = new Date();
            stats.lastCookieCount = cookieCount;
            this.appStateSaveStats.set(name, stats);

            // Detailed logging
            const displayName = account.userName || account.name;
            const timestamp = new Date().toISOString();

            this.logger.debug(
                "AppStateSave",
                `┌─────────────────────────────────────────────────────────────`
            );
            this.logger.debug(
                "AppStateSave",
                `│ 🔄 APPSTATE SAVE - ${displayName} (UID: ${account.userID})`
            );
            this.logger.debug(
                "AppStateSave",
                `├─────────────────────────────────────────────────────────────`
            );
            this.logger.debug("AppStateSave", `│ Reason:          ${reason}`);
            this.logger.debug("AppStateSave", `│ Timestamp:       ${timestamp}`);
            this.logger.debug(
                "AppStateSave",
                `│ File:            ${path.basename(account.filePath)}`
            );
            this.logger.debug("AppStateSave", `│ Previous Cookies: ${existingCookieCount}`);
            this.logger.debug("AppStateSave", `│ Current Cookies:  ${cookieCount}`);
            this.logger.debug("AppStateSave", `│ Total Saves:      ${stats.totalSaves}`);
            this.logger.debug(
                "AppStateSave",
                `└─────────────────────────────────────────────────────────────`
            );

            // Summary log
            this.logger.success(
                "AppStateSave",
                `[${name}] ✅ Saved ${cookieCount} cookies (${reason}) - Total saves: ${stats.totalSaves}`
            );

            this.emit("appStateSaved", {
                account: name,
                userID: account.userID,
                cookieCount,
                reason,
                filePath: account.filePath,
                timestamp: stats.lastSaveTime,
            });

            return { success: true, cookieCount };
        } catch (error) {
            this.logger.error(
                "AppStateSave",
                `[${name}] ❌ Failed to save appstate: ${error.message}`
            );
            return { success: false, error: error.message };
        }
    }

    /**
     * Start auto-save timer for an account
     * Periodically saves fresh cookies to keep session alive
     * @param {string} name - Account name
     * @returns {boolean} Whether auto-save was started
     */
    startAutoSaveAppState(name) {
        const account = this.accounts.get(name);

        if (!account || account.status !== "online") {
            return false;
        }

        // Stop existing timer if any
        this.stopAutoSaveAppState(name);

        const intervalMs = this.autoSaveInterval * 60 * 1000;

        this.logger.info(
            "AppStateSave",
            `[${name}] 🕐 Auto-save enabled - Saving every ${this.autoSaveInterval} minutes`
        );

        // Schedule periodic saves
        const timerId = setInterval(async () => {
            if (account.status === "online" && account.api) {
                await this.saveAppState(name, "auto-save (scheduled)");
            } else {
                this.logger.warn("AppStateSave", `[${name}] Skipping auto-save - account offline`);
                this.stopAutoSaveAppState(name);
            }
        }, intervalMs);

        this.autoSaveTimers.set(name, timerId);

        // Do an initial save on login (delay to let startup logs finish)
        setTimeout(async () => {
            if (account.status === "online") {
                await this.saveAppState(name, "initial (post-login)");
            }
        }, 8000); // Wait 8 seconds after login before first save

        return true;
    }

    /**
     * Stop auto-save timer for an account
     * @param {string} name - Account name
     */
    stopAutoSaveAppState(name) {
        const timerId = this.autoSaveTimers.get(name);
        if (timerId) {
            clearInterval(timerId);
            this.autoSaveTimers.delete(name);
            this.logger.debug("AppStateSave", `[${name}] Auto-save timer stopped`);
        }
    }

    /**
     * Stop all auto-save timers
     */
    stopAllAutoSaveTimers() {
        for (const [name] of this.autoSaveTimers) {
            this.stopAutoSaveAppState(name);
        }
        this.logger.info("AppStateSave", "All auto-save timers stopped");
    }

    /**
     * Get appstate save statistics for an account
     * @param {string} name - Account name
     * @returns {Object|null} Save statistics or null if not found
     */
    getAppStateSaveStats(name) {
        return this.appStateSaveStats.get(name) || null;
    }

    /**
     * Get all appstate save statistics
     * @returns {Object} Map of account name to save stats
     */
    getAllAppStateSaveStats() {
        const stats = {};
        for (const [name, data] of this.appStateSaveStats) {
            stats[name] = data;
        }
        return stats;
    }

    /**
     * Save appstate for all online accounts
     * @param {string} [reason='manual-all'] - Reason for save
     * @returns {Promise<{success: number, failed: number}>}
     */
    async saveAllAppStates(reason = "manual-all") {
        const results = { success: 0, failed: 0 };

        for (const [name, account] of this.accounts) {
            if (account.status === "online") {
                const result = await this.saveAppState(name, reason);
                if (result.success) {
                    results.success++;
                } else {
                    results.failed++;
                }
            }
        }

        this.logger.info(
            "AppStateSave",
            `Bulk save complete: ${results.success} success, ${results.failed} failed`
        );

        return results;
    }

    /**
     * Login a single account with retry logic
     * Automatically deletes the cookie file after max retries
     * @param {string} name - Account name
     * @param {string} filePath - Path to appstate file
     * @returns {Promise<AccountInfo>}
     */
    async loginAccount(name, filePath) {
        // Create account info object
        const accountInfo = {
            name,
            filePath,
            api: null,
            userID: null,
            userName: null,
            profilePicUrl: null,
            stopListening: null,
            status: "pending",
            error: null,
            loginTime: null,
            messageCount: 0,
            commandCount: 0,
            loginAttempts: 0,
        };

        // Store in accounts map
        this.accounts.set(name, accountInfo);

        // Validate appstate first
        const validation = this.validateAppState(filePath);

        if (!validation.valid) {
            accountInfo.status = "error";
            accountInfo.error = validation.error;
            accountInfo.loginAttempts = this.maxLoginRetries; // Max out attempts for invalid files
            this.logger.error("AccountManager", `[${name}] Invalid appstate: ${validation.error}`);

            // Delete invalid cookie file immediately
            this._deleteCookieFile(filePath, name);
            accountInfo.status = "deleted";

            return accountInfo;
        }

        // Attempt login with retries
        for (let attempt = 1; attempt <= this.maxLoginRetries; attempt++) {
            accountInfo.loginAttempts = attempt;

            this.logger.info(
                "AccountManager",
                `[${name}] Login attempt ${attempt}/${this.maxLoginRetries}...`
            );

            const result = await this._attemptLogin(accountInfo, validation.appState);

            if (result.success) {
                const displayName = accountInfo.userName || "Unknown";
                this.logger.success(
                    "AccountManager",
                    `[${name}] Logged in successfully - ${displayName} (UID: ${accountInfo.userID})`
                );

                // Start auto-save appstate if enabled
                if (this.autoSaveAppState) {
                    this.startAutoSaveAppState(name);
                }

                this.emit("loginSuccess", accountInfo);
                return accountInfo;
            }

            // Login failed
            accountInfo.error = result.error;
            this.logger.error(
                "AccountManager",
                `[${name}] Attempt ${attempt} failed: ${result.error}`
            );

            // If not last attempt, wait before retry
            if (attempt < this.maxLoginRetries) {
                this.logger.info(
                    "AccountManager",
                    `[${name}] Retrying in ${this.retryDelay / 1000} seconds...`
                );
                await this.delay(this.retryDelay);
            }
        }

        // All attempts failed - delete the cookie file
        this.logger.error(
            "AccountManager",
            `[${name}] All ${this.maxLoginRetries} login attempts failed`
        );

        const deleted = this._deleteCookieFile(filePath, name);

        if (deleted) {
            accountInfo.status = "deleted";
            this.emit("accountDeleted", accountInfo);
        } else {
            accountInfo.status = "error";
        }

        this.emit("loginFailed", accountInfo);
        return accountInfo;
    }

    /**
     * Login all accounts from the accounts folder
     * @returns {Promise<{success: number, failed: number, accounts: AccountInfo[]}>}
     */
    async loginAll() {
        const discoveredAccounts = this.discoverAccounts();

        if (discoveredAccounts.length === 0) {
            this.logger.warn("AccountManager", `No appstate files found in ${this.accountsPath}`);
            return { success: 0, failed: 0, accounts: [] };
        }

        this.logger.info(
            "AccountManager",
            `Found ${discoveredAccounts.length} account(s) to login`
        );

        const results = [];
        let success = 0;
        let failed = 0;

        // Login accounts sequentially to avoid rate limiting
        for (const { name, filePath } of discoveredAccounts) {
            this.logger.info("AccountManager", `Logging in account: ${name}...`);

            const accountInfo = await this.loginAccount(name, filePath);
            results.push(accountInfo);

            if (accountInfo.status === "online") {
                success++;
            } else {
                failed++;
            }

            // Small delay between logins to avoid rate limiting
            if (discoveredAccounts.length > 1) {
                await this.delay(2000);
            }
        }

        this.logger.info(
            "AccountManager",
            `Login complete: ${success} successful, ${failed} failed`
        );

        return { success, failed, accounts: results };
    }

    /**
     * Logout a specific account
     * @param {string} name - Account name
     * @returns {Promise<boolean>}
     */
    async logoutAccount(name) {
        const account = this.accounts.get(name);

        if (!account) {
            this.logger.warn("AccountManager", `Account not found: ${name}`);
            return false;
        }

        // Stop auto-save timer
        this.stopAutoSaveAppState(name);

        // Save final appstate before logout
        if (account.api && account.status === "online") {
            await this.saveAppState(name, "final (pre-logout)");
        }

        // Stop listening
        if (account.stopListening) {
            try {
                // listenMqtt returns a MessageEmitter with a .stop() method
                if (typeof account.stopListening.stop === "function") {
                    account.stopListening.stop();
                } else if (typeof account.stopListening === "function") {
                    account.stopListening();
                }
            } catch (err) {
                this.logger.debug(
                    "AccountManager",
                    `[${name}] Stop listening error: ${err.message}`
                );
            }
        }

        // Logout API
        if (account.api && account.api.logout) {
            return new Promise((resolve) => {
                account.api.logout((err) => {
                    if (err) {
                        this.logger.debug(
                            "AccountManager",
                            `[${name}] Logout error: ${err.message}`
                        );
                    }

                    account.status = "offline";
                    account.api = null;
                    account.stopListening = null;

                    // Remove from userID lookup
                    if (account.userID) {
                        this.accountsByUserID.delete(account.userID);
                    }

                    this.logger.info("AccountManager", `[${name}] Logged out`);
                    this.emit("logout", account);
                    resolve(true);
                });
            });
        }

        account.status = "offline";
        return true;
    }

    /**
     * Logout all accounts
     * @returns {Promise<void>}
     */
    async logoutAll() {
        this.logger.info("AccountManager", "Logging out all accounts...");

        // Stop all auto-save timers first
        this.stopAllAutoSaveTimers();

        for (const [name] of this.accounts) {
            await this.logoutAccount(name);
        }

        this.logger.info("AccountManager", "All accounts logged out");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // LISTENER MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Start listener for a specific account
     * @param {string} name - Account name
     * @param {Function} callback - Event callback function
     * @returns {boolean} Whether listener started successfully
     */
    startListenerForAccount(name, callback) {
        const account = this.accounts.get(name);

        if (!account || account.status !== "online" || !account.api) {
            return false;
        }

        // Wrap the callback to include account info
        const wrappedCallback = async (err, event) => {
            if (err) {
                // Better error formatting
                let errorMsg = err;
                if (typeof err === "object") {
                    errorMsg = err.message || err.error || JSON.stringify(err);
                }
                this.logger.error("AccountManager", `[${name}] Listener error: ${errorMsg}`);

                // Handle reconnection
                if (this.neroOptions.autoReconnect) {
                    this.logger.warn("AccountManager", `[${name}] Attempting reconnect...`);
                    await this.delay(5000);

                    if (account.status === "online") {
                        // Save appstate after reconnection attempt (cookies may have refreshed)
                        if (this.autoSaveAppState) {
                            await this.saveAppState(name, "reconnect (post-error)");
                        }
                        this.startListenerForAccount(name, callback);
                    }
                }
                return;
            }

            // Attach account info to event
            event.__account = {
                name: account.name,
                userID: account.userID,
            };

            // Update stats
            account.messageCount++;

            // Call the user's callback
            await callback(account.api, event, account);
        };

        try {
            const stopListening = account.api.listenMqtt(wrappedCallback);
            account.stopListening = stopListening;

            // Listen for MQTT reconnect events to save fresh cookies
            if (stopListening && typeof stopListening.on === "function") {
                // Save appstate on MQTT reconnection (fresh cookies!)
                stopListening.on("reconnect", async (_reconnectInfo) => {
                    if (this.autoSaveAppState && account.status === "online") {
                        this.logger.info(
                            "AppStateSave",
                            `[${name}] 🔄 MQTT reconnection detected - Saving fresh cookies...`
                        );
                        // Small delay to allow cookies to refresh
                        await this.delay(2000);
                        await this.saveAppState(name, "reconnect (mqtt scheduled)");
                    }
                });

                // Save appstate periodically on activity (every 100 messages)
                stopListening.on("message", (_event) => {
                    // Save appstate periodically on activity (every 100 messages)
                    if (account.messageCount > 0 && account.messageCount % 100 === 0) {
                        if (this.autoSaveAppState) {
                            this.saveAppState(name, `activity (${account.messageCount} messages)`);
                        }
                    }
                });
            }

            // Start realtime listener for Facebook notifications (comments, mentions, etc.)
            if (account.api.realtime && typeof account.api.realtime === "function") {
                try {
                    const realtimeEmitter = account.api.realtime();
                    account.realtimeEmitter = realtimeEmitter;

                    // Handle notification events
                    realtimeEmitter.on("notification", async (notif) => {
                        // Create an event-like object for the notification
                        const notifEvent = {
                            type: "notification",
                            ...notif,
                            __account: {
                                name: account.name,
                                userID: account.userID,
                            },
                        };

                        // Call the user's callback with the notification
                        await callback(account.api, notifEvent, account);
                    });

                    realtimeEmitter.on("error", (err) => {
                        this.logger.debug("Realtime", `[${name}] Error: ${err.message || err}`);
                    });

                    this.logger.debug("AccountManager", `[${name}] Realtime listener started`);
                } catch (realtimeErr) {
                    this.logger.debug(
                        "AccountManager",
                        `[${name}] Realtime listener not available: ${realtimeErr.message}`
                    );
                }
            }

            this.logger.info("AccountManager", `[${name}] Listener started`);
            return true;
        } catch (error) {
            this.logger.error(
                "AccountManager",
                `[${name}] Failed to start listener: ${error.message}`
            );
            return false;
        }
    }

    /**
     * Start listeners for all online accounts
     * @param {Function} callback - Event callback function
     * @returns {number} Number of listeners started
     */
    startAllListeners(callback) {
        let started = 0;

        for (const [name, account] of this.accounts) {
            if (account.status === "online") {
                if (this.startListenerForAccount(name, callback)) {
                    started++;
                }
            }
        }

        return started;
    }

    /**
     * Stop listener for a specific account
     * @param {string} name - Account name
     */
    stopListenerForAccount(name) {
        const account = this.accounts.get(name);

        if (account && account.stopListening) {
            try {
                // listenMqtt returns a MessageEmitter with a .stop() method
                if (typeof account.stopListening.stop === "function") {
                    account.stopListening.stop();
                } else if (typeof account.stopListening === "function") {
                    account.stopListening();
                }
                account.stopListening = null;
                this.logger.info("AccountManager", `[${name}] Listener stopped`);
            } catch (err) {
                this.logger.debug(
                    "AccountManager",
                    `[${name}] Stop listener error: ${err.message}`
                );
            }
        }

        // Stop realtime listener if exists
        if (account && account.realtimeEmitter) {
            try {
                if (typeof account.realtimeEmitter.stop === "function") {
                    account.realtimeEmitter.stop();
                }
                account.realtimeEmitter.removeAllListeners();
                account.realtimeEmitter = null;
                this.logger.debug("AccountManager", `[${name}] Realtime listener stopped`);
            } catch (err) {
                this.logger.debug(
                    "AccountManager",
                    `[${name}] Stop realtime listener error: ${err.message}`
                );
            }
        }
    }

    /**
     * Stop all listeners
     */
    stopAllListeners() {
        for (const [name] of this.accounts) {
            this.stopListenerForAccount(name);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GETTERS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Get account by name
     * @param {string} name - Account name
     * @returns {AccountInfo|undefined}
     */
    getAccount(name) {
        return this.accounts.get(name);
    }

    /**
     * Get account by user ID
     * @param {string} userID - Facebook User ID
     * @returns {AccountInfo|undefined}
     */
    getAccountByUserID(userID) {
        return this.accountsByUserID.get(userID);
    }

    /**
     * Get all accounts
     * @returns {AccountInfo[]}
     */
    getAllAccounts() {
        return Array.from(this.accounts.values());
    }

    /**
     * Get all online accounts
     * @returns {AccountInfo[]}
     */
    getOnlineAccounts() {
        return this.getAllAccounts().filter((a) => a.status === "online");
    }

    /**
     * Get primary account (first online account)
     * @returns {AccountInfo|undefined}
     */
    getPrimaryAccount() {
        return this.getOnlineAccounts()[0];
    }

    /**
     * Get account count
     * @returns {{total: number, online: number, offline: number, error: number, deleted: number}}
     */
    getAccountStats() {
        const accounts = this.getAllAccounts();
        return {
            total: accounts.length,
            online: accounts.filter((a) => a.status === "online").length,
            offline: accounts.filter((a) => a.status === "offline").length,
            error: accounts.filter((a) => a.status === "error").length,
            deleted: accounts.filter((a) => a.status === "deleted").length,
        };
    }

    /**
     * Check if any account is online
     * @returns {boolean}
     */
    hasOnlineAccounts() {
        return this.getOnlineAccounts().length > 0;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UTILITY
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Delay execution
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }

    /**
     * Increment command count for an account
     * @param {string} nameOrUserID - Account name or user ID
     */
    incrementCommandCount(nameOrUserID) {
        const account = this.accounts.get(nameOrUserID) || this.accountsByUserID.get(nameOrUserID);
        if (account) {
            account.commandCount++;
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = AccountManager;
