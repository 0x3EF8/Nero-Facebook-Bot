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
 * 
 * @author 0x3EF8
 * @version 1.0.0
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
 * @property {string} status - Account status: 'pending' | 'online' | 'offline' | 'error'
 * @property {string|null} error - Error message if status is 'error'
 * @property {Date} loginTime - When the account logged in
 * @property {number} messageCount - Number of messages processed
 * @property {number} commandCount - Number of commands processed
 */

class AccountManager extends EventEmitter {
    /**
     * Creates a new AccountManager instance
     * @param {Object} options - Configuration options
     * @param {string} options.accountsPath - Path to accounts folder
     * @param {Object} options.neroOptions - Nero API options
     * @param {Object} options.logger - Logger instance
     */
    constructor(options = {}) {
        super();
        
        /** @type {string} Path to accounts folder */
        this.accountsPath = options.accountsPath || path.join(process.cwd(), "accounts");
        
        /** @type {Object} Nero API options */
        this.neroOptions = options.neroOptions || {};
        
        /** @type {Object} Logger instance */
        this.logger = options.logger || console;
        
        /** @type {Map<string, AccountInfo>} Map of account name to account info */
        this.accounts = new Map();
        
        /** @type {Map<string, AccountInfo>} Map of userID to account info (for quick lookup) */
        this.accountsByUserID = new Map();
        
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
     * Login a single account
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
        };
        
        // Store in accounts map
        this.accounts.set(name, accountInfo);
        
        // Validate appstate
        const validation = this.validateAppState(filePath);
        
        if (!validation.valid) {
            accountInfo.status = "error";
            accountInfo.error = validation.error;
            this.logger.error("AccountManager", `[${name}] Invalid appstate: ${validation.error}`);
            return accountInfo;
        }
        
        // Login
        return new Promise((resolve) => {
            this.nero.login(
                { appState: validation.appState },
                this.neroOptions,
                (err, api) => {
                    if (err) {
                        accountInfo.status = "error";
                        accountInfo.error = err.message || String(err);
                        this.logger.error(
                            "AccountManager",
                            `[${name}] Login failed: ${accountInfo.error}`
                        );
                        this.emit("loginFailed", accountInfo);
                        resolve(accountInfo);
                        return;
                    }
                    
                    // Successful login
                    accountInfo.api = api;
                    accountInfo.userID = api.getCurrentUserID ? api.getCurrentUserID() : null;
                    accountInfo.status = "online";
                    accountInfo.loginTime = new Date();
                    
                    // Add to userID lookup map
                    if (accountInfo.userID) {
                        this.accountsByUserID.set(accountInfo.userID, accountInfo);
                    }
                    
                    // Fetch user name asynchronously
                    const fetchUserName = async () => {
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
                                        // Fallback profile pic URL
                                        accountInfo.profilePicUrl = `https://graph.facebook.com/${accountInfo.userID}/picture?width=100&height=100&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
                                    }
                                }
                            } catch {
                                // Ignore errors, userName will remain null
                                // Set fallback profile pic
                                accountInfo.profilePicUrl = `https://graph.facebook.com/${accountInfo.userID}/picture?width=100&height=100&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
                            }
                        }
                        
                        const displayName = accountInfo.userName || "Unknown";
                        this.logger.success(
                            "AccountManager",
                            `[${name}] Logged in successfully - ${displayName} (UID: ${accountInfo.userID})`
                        );
                        
                        this.emit("loginSuccess", accountInfo);
                        resolve(accountInfo);
                    };
                    
                    fetchUserName();
                }
            );
        });
    }
    
    /**
     * Login all accounts from the accounts folder
     * @returns {Promise<{success: number, failed: number, accounts: AccountInfo[]}>}
     */
    async loginAll() {
        const discoveredAccounts = this.discoverAccounts();
        
        if (discoveredAccounts.length === 0) {
            this.logger.warn(
                "AccountManager",
                `No appstate files found in ${this.accountsPath}`
            );
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
                this.logger.debug("AccountManager", `[${name}] Stop listening error: ${err.message}`);
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
                if (typeof err === 'object') {
                    errorMsg = err.message || err.error || JSON.stringify(err);
                }
                this.logger.error(
                    "AccountManager",
                    `[${name}] Listener error: ${errorMsg}`
                );
                
                // Handle reconnection
                if (this.neroOptions.autoReconnect) {
                    this.logger.warn("AccountManager", `[${name}] Attempting reconnect...`);
                    await this.delay(5000);
                    
                    if (account.status === "online") {
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
            account.stopListening = account.api.listenMqtt(wrappedCallback);
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
                this.logger.debug("AccountManager", `[${name}] Stop listener error: ${err.message}`);
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
     * @returns {{total: number, online: number, offline: number, error: number}}
     */
    getAccountStats() {
        const accounts = this.getAllAccounts();
        return {
            total: accounts.length,
            online: accounts.filter((a) => a.status === "online").length,
            offline: accounts.filter((a) => a.status === "offline").length,
            error: accounts.filter((a) => a.status === "error").length,
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
        return new Promise((resolve) => { setTimeout(resolve, ms); });
    }
    
    /**
     * Increment command count for an account
     * @param {string} nameOrUserID - Account name or user ID
     */
    incrementCommandCount(nameOrUserID) {
        const account = this.accounts.get(nameOrUserID) || 
                        this.accountsByUserID.get(nameOrUserID);
        if (account) {
            account.commandCount++;
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = AccountManager;
