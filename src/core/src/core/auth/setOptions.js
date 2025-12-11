/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                         NERO - Options Manager                               ║
 * ║                      Runtime Configuration Handler                            ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module core/auth/setOptions
 * @author 0x3EF8
 * @version 2.0.0
 */

"use strict";

const utils = require("../../lib/utils");

/**
 * Option handlers for each configurable property
 */
const OPTION_HANDLERS = {
    online: (globalOptions, value) => {
        globalOptions.online = Boolean(value);
    },

    selfListen: (globalOptions, value) => {
        globalOptions.selfListen = Boolean(value);
    },

    selfListenEvent: (globalOptions, value) => {
        globalOptions.selfListenEvent = value;
    },

    listenEvents: (globalOptions, value) => {
        globalOptions.listenEvents = Boolean(value);
    },

    updatePresence: (globalOptions, value) => {
        globalOptions.updatePresence = Boolean(value);
    },

    forceLogin: (globalOptions, value) => {
        globalOptions.forceLogin = Boolean(value);
    },

    userAgent: (globalOptions, value) => {
        globalOptions.userAgent = value;
    },

    autoMarkDelivery: (globalOptions, value) => {
        globalOptions.autoMarkDelivery = Boolean(value);
    },

    autoMarkRead: (globalOptions, value) => {
        globalOptions.autoMarkRead = Boolean(value);
    },

    listenTyping: (globalOptions, value) => {
        globalOptions.listenTyping = Boolean(value);
    },

    proxy: (globalOptions, value) => {
        if (typeof value !== "string") {
            delete globalOptions.proxy;
            utils.setProxy();
        } else {
            globalOptions.proxy = value;
            utils.setProxy(value);
        }
    },

    autoReconnect: (globalOptions, value) => {
        globalOptions.autoReconnect = Boolean(value);
    },

    emitReady: (globalOptions, value) => {
        globalOptions.emitReady = Boolean(value);
    },

    randomUserAgent: (globalOptions, value) => {
        globalOptions.randomUserAgent = Boolean(value);
        if (value) {
            globalOptions.userAgent = utils.randomUserAgent();
        }
    },

    bypassRegion: (globalOptions, value) => {
        globalOptions.bypassRegion = value ? value.toUpperCase() : value;
    },

    debugLevel: (globalOptions, value) => {
        const validLevels = ["silent", "minimal", "normal", "verbose"];
        if (validLevels.includes(value)) {
            globalOptions.debugLevel = value;
            // Set debug level for both debug.js and constants.js logging systems
            if (utils.setDebugLevel) utils.setDebugLevel(value);
        }
    },

    logging: (globalOptions, value) => {
        globalOptions.logging = Boolean(value);
        // For backwards compatibility with logOptions
        if (utils.logOptions) utils.logOptions(Boolean(value));
    },

    debugTimestamps: (globalOptions, value) => {
        globalOptions.debugTimestamps = Boolean(value);
        utils.setTimestamps(Boolean(value));
    },

    /**
     * Human Behavior Mode - Anti-Detection System
     *
     * When enabled, this option activates human-like behavior patterns:
     * - Variable typing delays based on message length
     * - Natural read receipt timing
     * - Typing indicators before sending messages
     * - Rate limiting with jitter
     * - Time-of-day activity patterns
     * - Session break simulation
     *
     * This helps prevent Facebook from flagging the account as automated.
     *
     * @example
     * api.setOptions({ humanBehavior: true });
     *
     * // Or with custom configuration
     * api.setOptions({
     *     humanBehavior: true,
     *     humanBehaviorConfig: {
     *         typing: { minWPM: 40, maxWPM: 80 },
     *         rateLimit: { messagesPerMinute: 15 }
     *     }
     * });
     */
    humanBehavior: (globalOptions, value) => {
        globalOptions.humanBehavior = Boolean(value);
        if (value) {
            utils.info("Human Behavior Mode ENABLED - Bot will simulate human-like patterns");
            // Reset the human behavior state when enabled
            if (utils.humanBehavior && utils.humanBehavior.reset) {
                utils.humanBehavior.reset();
            }
        } else {
            utils.info("Human Behavior Mode DISABLED - Bot will respond immediately");
        }
    },

    /**
     * Human Behavior Configuration
     * Advanced settings for fine-tuning human behavior simulation
     */
    humanBehaviorConfig: (globalOptions, value) => {
        if (typeof value === "object" && value !== null) {
            globalOptions.humanBehaviorConfig = value;
            if (utils.humanBehavior && utils.humanBehavior.configure) {
                utils.humanBehavior.configure(value);
            }
        }
    },
};

/**
 * Sets global options for the API.
 *
 * @param {Object} globalOptions - The global options object to modify
 * @param {Object} [options={}] - New options to apply
 * @returns {Promise<void>}
 */
async function setOptions(globalOptions, options = {}) {
    Object.entries(options).forEach(([key, value]) => {
        const handler = OPTION_HANDLERS[key];
        if (handler) {
            handler(globalOptions, value);
        }
    });
}

module.exports = setOptions;
