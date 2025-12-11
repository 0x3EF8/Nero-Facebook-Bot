/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                          NERO - Core Client                                  ║
 * ║                    Authentication & Session Management                        ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module core/client
 * @author 0x3EF8
 * @version 2.0.0
 */

"use strict";

const utils = require("../lib/utils");
const setOptionsModel = require("./auth/setOptions");
const buildAPIModel = require("./auth/buildAPI");
const loginHelperModel = require("./auth/loginHelper");

const FB_BASE_URL = "https://www.facebook.com";
const fbLink = (ext) => FB_BASE_URL + (ext ? "/" + ext : "");

const ERROR_RETRIEVING =
    "Error retrieving userID. This can be caused by many factors, including " +
    "being blocked by Facebook for logging in from an unknown location. " +
    "Try logging in with a browser to verify.";

/**
 * Default configuration options
 */
const DEFAULT_OPTIONS = {
    selfListen: false,
    listenEvents: true,
    listenTyping: false,
    updatePresence: false,
    forceLogin: false,
    autoMarkDelivery: false,
    autoMarkRead: true,
    autoReconnect: true,
    online: true,
    emitReady: false,
    humanBehavior: false, // Enable human-like behavior to avoid detection
    userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

/**
 * Initiates the login process for a Facebook account.
 *
 * @param {Object} credentials - User credentials (appState or email/password)
 * @param {Object} [options={}] - Optional login configurations
 * @param {Function} callback - Callback invoked upon login completion
 * @returns {Promise<void>}
 *
 * @example
 * // Login with appState
 * login({ appState: cookies }, { listenEvents: true }, (err, api) => {
 *     if (err) return console.error(err);
 *     console.log("Logged in:", api.getCurrentUserID());
 * });
 */
async function login(credentials, options, callback) {
    // Handle optional options parameter
    if (typeof options === "function") {
        callback = options;
        options = {};
    }

    // Initialize logging if specified
    if ("logging" in options) {
        utils.logOptions(options.logging);
    }

    // Create fresh instances for each login (prevents state sharing between accounts)
    const globalOptions = { ...DEFAULT_OPTIONS, ...options };
    const api = {};

    // Apply options
    await setOptionsModel(globalOptions, options);

    // Execute login flow
    loginHelperModel(
        credentials,
        globalOptions,
        (loginError, loginApi) => {
            if (loginError) {
                return callback(loginError);
            }
            return callback(null, loginApi);
        },
        setOptionsModel,
        buildAPIModel,
        api,
        fbLink,
        ERROR_RETRIEVING
    );
}

module.exports = {
    login,
};
