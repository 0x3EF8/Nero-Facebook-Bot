"use strict";

const chalk = require("chalk");

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                    NΞRO FRAMEWORK - DEBUG SYSTEM                              ║
// ║                      Logging & Monitoring Module                             ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

/**
 * Debug Levels:
 * ┌──────────┬────────────────────────────────────────────────────────────────┐
 * │  Level   │  Description                                                   │
 * ├──────────┼────────────────────────────────────────────────────────────────┤
 * │  silent  │  No debug output - production mode                             │
 * │  minimal │  Critical errors only - essential monitoring                   │
 * │  normal  │  Standard logging - errors, warnings, key events               │
 * │  verbose │  Full telemetry - HTTP, MQTT, deltas, API calls, everything    │
 * └──────────┴────────────────────────────────────────────────────────────────┘
 */

// ═══════════════════════════════════════════════════════════════════════════════
//  CONFIGURATION STATE
// ═══════════════════════════════════════════════════════════════════════════════

let debugLevel = "silent";
let logTimestamps = true;
const _sessionStartTime = Date.now();

// ═══════════════════════════════════════════════════════════════════════════════
//  COLOR PALETTE - Monochrome with Accent Colors
// ═══════════════════════════════════════════════════════════════════════════════

const theme = {
    // Primary Colors
    primary: chalk.hex("#00D9FF"), // Cyan - Brand color
    secondary: chalk.hex("#7B68EE"), // Purple - Secondary actions
    accent: chalk.hex("#FFD700"), // Gold - Highlights

    // Status Colors
    success: chalk.hex("#00FF88"), // Green - Success states
    warning: chalk.hex("#FFB347"), // Orange - Warnings
    error: chalk.hex("#FF6B6B"), // Red - Errors
    info: chalk.hex("#87CEEB"), // Light blue - Information

    // Category Colors
    http: chalk.hex("#61AFEF"), // Blue - HTTP operations
    mqtt: chalk.hex("#C678DD"), // Purple - MQTT events
    msg: chalk.hex("#98C379"), // Green - Messages
    event: chalk.hex("#E5C07B"), // Gold - Events
    delta: chalk.hex("#56B6C2"), // Cyan - Deltas
    api: chalk.hex("#61AFEF"), // Blue - API calls
    auth: chalk.hex("#C678DD"), // Purple - Authentication
    human: chalk.hex("#FF79C6"), // Pink - Human behavior

    // Utility Colors
    dim: chalk.hex("#6C7A89"), // Gray - Dim text
    muted: chalk.hex("#4A5568"), // Dark gray - Very dim
    bright: chalk.hex("#E2E8F0"), // Light gray - Bright text
    white: chalk.hex("#FFFFFF"), // White - Emphasis

    // Special
    bracket: chalk.hex("#4A5568"), // Brackets and borders
    timestamp: chalk.hex("#718096"), // Timestamps
    separator: chalk.hex("#2D3748"), // Separators
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ICON SET - Clean Symbols
// ═══════════════════════════════════════════════════════════════════════════════

const icons = {
    // Directional
    arrowRight: "→",
    arrowLeft: "←",
    arrowUp: "↑",
    arrowDown: "↓",

    // Status
    success: "✓",
    error: "✗",
    warning: "⚠",
    info: "ℹ",

    // Actions
    send: "▶",
    receive: "◀",
    publish: "◉",
    subscribe: "◎",

    // Connection
    connected: "●",
    disconnected: "○",
    reconnecting: "◐",

    // Categories
    http: "⬡",
    mqtt: "◆",
    message: "◈",
    event: "◇",
    delta: "▲",
    api: "⬢",
    auth: "◉",
    human: "♥",
    debug: "•",

    // Tree structure
    treeStart: "┌",
    treeMid: "├",
    treeEnd: "└",
    treeLine: "│",
    treeHoriz: "─",
};

// ═══════════════════════════════════════════════════════════════════════════════
//  CONFIGURATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Set the debug level
 * @param {'silent' | 'minimal' | 'normal' | 'verbose'} level
 */
function setDebugLevel(level) {
    const validLevels = ["silent", "minimal", "normal", "verbose"];
    if (validLevels.includes(level)) {
        debugLevel = level;
        // No output when setting debug level - respects silent mode
    }
}

/**
 * Get current debug level
 * @returns {string}
 */
function getDebugLevel() {
    return debugLevel;
}

/**
 * Enable/disable timestamps in debug output
 * @param {boolean} enabled
 */
function setTimestamps(enabled) {
    logTimestamps = Boolean(enabled);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a level should log based on current debug level
 * @param {'minimal' | 'normal' | 'verbose'} requiredLevel
 * @returns {boolean}
 */
function shouldLog(requiredLevel) {
    const levels = { silent: 0, minimal: 1, normal: 2, verbose: 3 };
    return levels[debugLevel] >= levels[requiredLevel];
}

/**
 * Get formatted timestamp
 * @returns {string}
 */
function getTimestamp() {
    if (!logTimestamps) return "";
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const mins = String(now.getMinutes()).padStart(2, "0");
    const secs = String(now.getSeconds()).padStart(2, "0");
    const ms = String(now.getMilliseconds()).padStart(3, "0");
    return theme.timestamp(`${hours}:${mins}:${secs}.${ms}`);
}

/**
 * Format a category prefix
 * @param {string} category
 * @param {Function} [colorFn]
 * @returns {string}
 */
function formatPrefix(category, colorFn = theme.primary) {
    const ts = getTimestamp();
    const cat = colorFn(category.padEnd(6));
    return ts ? `${ts} ${theme.bracket("│")} ${cat}` : cat;
}

/**
 * Truncate string with ellipsis
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
function truncate(str, maxLen = 50) {
    if (!str) return "";
    return str.length > maxLen ? str.substring(0, maxLen - 3) + "..." : str;
}

/**
 * Truncate URL for display
 * @param {string} url
 * @param {number} maxLen
 * @returns {string}
 */
function truncateUrl(url, maxLen = 55) {
    if (!url) return "";
    try {
        const parsed = new URL(url);
        const path = parsed.pathname + (parsed.search ? "?" + parsed.search.substring(0, 15) : "");
        const display = parsed.hostname + path;
        return display.length > maxLen ? display.substring(0, maxLen - 3) + "..." : display;
    } catch {
        return truncate(url, maxLen);
    }
}

/**
 * Format bytes to human readable
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * Format duration in ms to human readable
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HTTP REQUEST/RESPONSE LOGGING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Log an HTTP request
 * @param {string} method - HTTP method
 * @param {string} url - Request URL
 * @param {object} [options] - Additional options
 */
function logHttpRequest(method, url, _options = {}) {
    if (!shouldLog("verbose")) return;

    const methodColors = {
        GET: theme.success,
        POST: theme.warning,
        PUT: theme.info,
        DELETE: theme.error,
        PATCH: theme.secondary,
    };
    const color = methodColors[method.toUpperCase()] || theme.dim;

    console.log(
        formatPrefix("HTTP", theme.http),
        theme.dim(icons.arrowRight),
        color(method.toUpperCase().padEnd(6)),
        theme.bright(truncateUrl(url))
    );
}

/**
 * Log an HTTP response
 * @param {string} method - HTTP method
 * @param {string} url - Request URL
 * @param {number} statusCode - Response status
 * @param {number} [duration] - Request duration in ms
 */
function logHttpResponse(method, url, statusCode, duration = null) {
    if (!shouldLog("verbose")) return;

    const statusColor =
        statusCode >= 200 && statusCode < 300
            ? theme.success
            : statusCode >= 400
              ? theme.error
              : theme.warning;
    const durationStr = duration !== null ? theme.dim(`(${duration}ms)`) : "";

    console.log(
        formatPrefix("HTTP", theme.http),
        statusColor(icons.arrowLeft),
        statusColor(String(statusCode).padEnd(6)),
        theme.dim(truncateUrl(url, 45)),
        durationStr
    );
}

/**
 * Log HTTP error
 * @param {string} method - HTTP method
 * @param {string} url - Request URL
 * @param {Error|string} error - Error details
 */
function logHttpError(method, url, error) {
    if (!shouldLog("minimal")) return;

    const errorMsg = error?.message || String(error);
    console.log(
        formatPrefix("HTTP", theme.error),
        theme.error(icons.error),
        theme.error("ERROR"),
        theme.dim(truncateUrl(url, 35)),
        theme.error(truncate(errorMsg, 40))
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MQTT EVENT LOGGING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Log MQTT connection event
 * @param {string} event - Event type
 * @param {object} [details] - Event details
 */
function logMqttEvent(event, details = {}) {
    if (!shouldLog("verbose")) return;

    const eventConfig = {
        connect: { icon: icons.connected, color: theme.success, label: "CONNECTED" },
        disconnect: { icon: icons.disconnected, color: theme.error, label: "DISCONNECTED" },
        reconnect: { icon: icons.reconnecting, color: theme.warning, label: "RECONNECTING" },
        error: { icon: icons.error, color: theme.error, label: "ERROR" },
    };

    const config = eventConfig[event] || {
        icon: icons.mqtt,
        color: theme.mqtt,
        label: event.toUpperCase(),
    };

    console.log(
        formatPrefix("MQTT", theme.mqtt),
        config.color(config.icon),
        config.color(config.label.padEnd(12)),
        details.message ? theme.dim(details.message) : ""
    );
}

/**
 * Log MQTT topic subscription
 * @param {string} topic - Topic name
 */
function logMqttSubscribe(topic) {
    if (!shouldLog("verbose")) return;

    console.log(
        formatPrefix("MQTT", theme.mqtt),
        theme.secondary(icons.subscribe),
        theme.dim("SUBSCRIBE"),
        theme.bright(topic)
    );
}

/**
 * Log MQTT message received
 * @param {string} topic - Topic name
 * @param {string} [messageType] - Message type
 */
function logMqttMessage(topic, messageType = null) {
    if (!shouldLog("verbose")) return;

    const typeStr = messageType ? theme.accent(`<${messageType}>`) : "";

    console.log(
        formatPrefix("MQTT", theme.mqtt),
        theme.success(icons.receive),
        theme.dim("RECEIVED"),
        theme.bright(topic.padEnd(20)),
        typeStr
    );
}

/**
 * Log MQTT publish
 * @param {string} topic - Topic name
 * @param {string} [action] - Action description
 */
function logMqttPublish(topic, action = null) {
    if (!shouldLog("verbose")) return;

    console.log(
        formatPrefix("MQTT", theme.mqtt),
        theme.warning(icons.publish),
        theme.dim("PUBLISH"),
        theme.bright(topic.padEnd(20)),
        action ? theme.accent(`→ ${action}`) : ""
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MESSAGE & EVENT LOGGING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Log incoming message
 * @param {object} message - Message object
 */
function logMessage(message) {
    if (!shouldLog("normal")) return;

    const { type, threadID, senderID, body } = message;
    const preview = body ? truncate(body.replace(/\n/g, " "), 35) : "[attachment]";
    const typeLabel = (type || "message").toUpperCase();

    console.log(
        formatPrefix("MSG", theme.msg),
        theme.success(icons.receive),
        theme.accent(typeLabel.padEnd(12)),
        theme.dim(`T:${String(threadID).substring(0, 10)}...`),
        theme.dim(`U:${String(senderID).substring(0, 10)}...`),
        theme.bright(`"${preview}"`)
    );
}

/**
 * Log event
 * @param {string} eventType - Event type
 * @param {object} [data] - Event data
 */
function logEvent(eventType, data = {}) {
    if (!shouldLog("verbose")) return;

    const parts = [
        formatPrefix("EVENT", theme.event),
        theme.event(icons.event),
        theme.accent(eventType.toUpperCase().padEnd(15)),
    ];

    if (data.threadID) parts.push(theme.dim(`T:${String(data.threadID).substring(0, 12)}`));
    if (data.userID || data.senderID) {
        const uid = data.userID || data.senderID;
        parts.push(theme.dim(`U:${String(uid).substring(0, 12)}`));
    }

    console.log(...parts);
}

/**
 * Log delta/change from Facebook
 * @param {string} deltaClass - Delta class name
 * @param {object} [delta] - Delta data
 */
function logDelta(deltaClass, delta = {}) {
    if (!shouldLog("verbose")) return;

    const threadStr = delta.threadKey?.threadFbId || delta.threadKey?.otherUserFbId || "";

    console.log(
        formatPrefix("DELTA", theme.delta),
        theme.delta(icons.delta),
        theme.bright(deltaClass.padEnd(22)),
        threadStr ? theme.dim(`T:${String(threadStr).substring(0, 12)}`) : ""
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  API CALL LOGGING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Log API method call
 * @param {string} methodName - API method name
 * @param {object} [args] - Method arguments
 */
function logApiCall(methodName, args = {}) {
    if (!shouldLog("verbose")) return;

    // Sanitize sensitive data
    const sanitized = { ...args };
    ["password", "token", "cookie", "appState", "fb_dtsg", "jazoest"].forEach((key) => {
        if (sanitized[key]) sanitized[key] = "***";
    });

    const argsPreview =
        Object.keys(sanitized).length > 0 ? theme.dim(truncate(JSON.stringify(sanitized), 45)) : "";

    console.log(
        formatPrefix("API", theme.api),
        theme.api(icons.api),
        theme.bright(methodName.padEnd(20)),
        argsPreview
    );
}

/**
 * Log API response
 * @param {string} methodName - API method name
 * @param {boolean} success - Whether call succeeded
 * @param {number} [duration] - Call duration in ms
 */
function logApiResponse(methodName, success, duration = null) {
    if (!shouldLog("verbose")) return;

    const statusIcon = success ? theme.success(icons.success) : theme.error(icons.error);
    const durationStr = duration !== null ? theme.dim(`(${duration}ms)`) : "";

    console.log(
        formatPrefix("API", theme.api),
        statusIcon,
        theme.dim(methodName.padEnd(20)),
        durationStr
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  AUTH/LOGIN LOGGING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Log authentication step
 * @param {string} step - Auth step description
 * @param {boolean} [success] - Success state (null for in-progress)
 */
function logAuth(step, success = null) {
    if (!shouldLog("verbose")) return;

    const icon =
        success === true
            ? theme.success(icons.success)
            : success === false
              ? theme.error(icons.error)
              : theme.auth(icons.auth);

    const color = success === true ? theme.success : success === false ? theme.error : theme.bright;

    console.log(formatPrefix("AUTH", theme.auth), icon, color(step));
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GENERAL LOGGING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Human behavior simulation log
 * Only outputs when debugLevel is 'verbose'
 * @param {...any} args - Log arguments
 */
function human(...args) {
    if (!shouldLog("verbose")) return;

    const formattedArgs = args.map((arg) => {
        if (typeof arg === "object") return JSON.stringify(arg);
        return String(arg);
    });
    console.log(...formattedArgs);
}

/**
 * General debug message
 * @param {string} category - Debug category
 * @param {...any} args - Message arguments
 */
function debug(category, ...args) {
    if (!shouldLog("verbose")) return;

    const formattedArgs = args.map((arg) => {
        if (typeof arg === "object") return theme.dim(JSON.stringify(arg));
        return theme.dim(String(arg));
    });

    console.log(
        formatPrefix("DEBUG", theme.dim),
        theme.dim(icons.debug),
        theme.muted(`[${category}]`),
        ...formattedArgs
    );
}

/**
 * Warning message
 * @param {string} category - Warning category
 * @param {...any} args - Message arguments
 */
function warn(category, ...args) {
    if (!shouldLog("normal")) return;

    const formattedArgs = args.map((arg) => {
        if (typeof arg === "object") return theme.warning(JSON.stringify(arg));
        return theme.warning(String(arg));
    });

    console.log(
        formatPrefix("WARN", theme.warning),
        theme.warning(icons.warning),
        theme.warning(`[${category}]`),
        ...formattedArgs
    );
}

/**
 * Error message
 * @param {string} category - Error category
 * @param {...any} args - Message arguments
 */
function error(category, ...args) {
    if (!shouldLog("minimal")) return;

    const formattedArgs = args.map((arg) => {
        if (arg instanceof Error) return theme.error(arg.message);
        if (typeof arg === "object") return theme.error(JSON.stringify(arg));
        return theme.error(String(arg));
    });

    console.log(
        formatPrefix("ERROR", theme.error),
        theme.error(icons.error),
        theme.error(`[${category}]`),
        ...formattedArgs
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STATISTICS & MONITORING
// ═══════════════════════════════════════════════════════════════════════════════

const stats = {
    httpRequests: 0,
    httpErrors: 0,
    mqttMessages: 0,
    messagesReceived: 0,
    messagesSent: 0,
    apiCalls: 0,
    startTime: Date.now(),
};

/**
 * Increment a stat counter
 * @param {'httpRequests' | 'httpErrors' | 'mqttMessages' | 'messagesReceived' | 'messagesSent' | 'apiCalls'} stat
 */
function incrementStat(stat) {
    if (Object.prototype.hasOwnProperty.call(stats, stat)) {
        stats[stat]++;
    }
}

/**
 * Get current stats
 * @returns {object}
 */
function getStats() {
    return {
        ...stats,
        uptime: Math.floor((Date.now() - stats.startTime) / 1000),
    };
}

/**
 * Format uptime to human readable
 * @param {number} seconds
 * @returns {string}
 */
function formatUptime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

/**
 * Print stats summary
 */
function printStats() {
    if (!shouldLog("normal")) return;

    const s = getStats();

    console.log("");
    console.log(theme.primary("╔════════════════════════════════════════════════════════════╗"));
    console.log(
        theme.primary("║") +
            theme.white("           NΞRO FRAMEWORK - SESSION STATISTICS            ") +
            theme.primary("║")
    );
    console.log(theme.primary("╠════════════════════════════════════════════════════════════╣"));
    console.log(
        theme.primary("║") +
            `  ${theme.dim("Uptime")}           ${theme.bright(formatUptime(s.uptime).padEnd(38))}` +
            theme.primary("║")
    );
    console.log(
        theme.primary("║") +
            `  ${theme.dim("HTTP Requests")}    ${theme.http(String(s.httpRequests).padEnd(20))} ${theme.error(`Errors: ${s.httpErrors}`).padEnd(18)}` +
            theme.primary("║")
    );
    console.log(
        theme.primary("║") +
            `  ${theme.dim("MQTT Messages")}    ${theme.mqtt(String(s.mqttMessages).padEnd(38))}` +
            theme.primary("║")
    );
    console.log(
        theme.primary("║") +
            `  ${theme.dim("Messages")}         ${theme.success("↓" + s.messagesReceived)} ${theme.warning("↑" + s.messagesSent).padEnd(33)}` +
            theme.primary("║")
    );
    console.log(
        theme.primary("║") +
            `  ${theme.dim("API Calls")}        ${theme.api(String(s.apiCalls).padEnd(38))}` +
            theme.primary("║")
    );
    console.log(theme.primary("╚════════════════════════════════════════════════════════════╝"));
    console.log("");
}

/**
 * Reset stats
 */
function resetStats() {
    stats.httpRequests = 0;
    stats.httpErrors = 0;
    stats.mqttMessages = 0;
    stats.messagesReceived = 0;
    stats.messagesSent = 0;
    stats.apiCalls = 0;
    stats.startTime = Date.now();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    // Configuration
    setDebugLevel,
    getDebugLevel,
    setTimestamps,

    // HTTP logging
    logHttpRequest,
    logHttpResponse,
    logHttpError,

    // MQTT logging
    logMqttEvent,
    logMqttSubscribe,
    logMqttMessage,
    logMqttPublish,

    // Message/Event logging
    logMessage,
    logEvent,
    logDelta,

    // API logging
    logApiCall,
    logApiResponse,

    // Auth logging
    logAuth,

    // General logging
    debug,
    warn,
    error,
    human,

    // Stats
    incrementStat,
    getStats,
    printStats,
    resetStats,

    // Utilities
    formatDuration,
    formatBytes,
    formatUptime,
    truncate,
    truncateUrl,

    // Theme (for external use)
    theme,
    icons,
};
