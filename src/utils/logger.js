/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                        NERO BOT - LOGGER SYSTEM                               ║
 * ║               Configurable Logging with Clean Output Format                  ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Features:
 * • Clean, aligned log output with timestamps
 * • Color-coded log levels and categories
 * • Module-based logging with consistent formatting
 * • Command, event, and API logging helpers
 * • Session statistics and metrics tracking
 * • File logging with rotation support
 * • Visual helpers (dividers, sections, tables)
 *
 * @author 0x3EF8
 * @version 3.0.0
 */

"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const chalk = require("chalk");

// ═══════════════════════════════════════════════════════════════════════════════
//  LOG LEVEL CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const LOG_LEVELS = {
    debug: {
        icon: "•",
        label: "DEBUG",
        color: chalk.gray,
        priority: 0,
    },
    info: {
        icon: "ℹ",
        label: "INFO",
        color: chalk.cyanBright,
        priority: 1,
    },
    warn: {
        icon: "⚠",
        label: "WARN",
        color: chalk.yellowBright,
        priority: 2,
    },
    error: {
        icon: "✗",
        label: "ERROR",
        color: chalk.redBright,
        priority: 3,
    },
    success: {
        icon: "✓",
        label: "OK",
        color: chalk.greenBright,
        priority: 4,
    },
};

// Level presets for easy configuration
const LEVEL_PRESETS = {
    silent: [],
    error: ["error"],
    warn: ["warn", "error"],
    info: ["info", "warn", "error", "success"],
    verbose: ["debug", "info", "warn", "error", "success"],
    debug: ["debug", "info", "warn", "error", "success"],
    all: ["debug", "info", "warn", "error", "success"],
};

/**
 * Resolve levels from preset string or array
 */
function resolveLevels(levels) {
    if (typeof levels === "string") {
        const preset = LEVEL_PRESETS[levels.toLowerCase()];
        return preset || [levels];
    }
    return Array.isArray(levels) ? levels : ["info", "warn", "error", "success"];
}

// ═══════════════════════════════════════════════════════════════════════════════
//  LOGGER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class Logger {
    constructor(options = {}) {
        this.options = {
            console: options.console !== false,
            file: options.file || false,
            filePath: options.filePath || null,
            levels: resolveLevels(options.levels),
            timestamps: options.timestamps !== false,
            timestampFormat: options.timestampFormat || "HH:mm:ss.SSS",
            colors: options.colors !== false,
            maxFileSize: options.maxFileSize || 10, // MB
            showPid: options.showPid || false,
            showMemory: options.showMemory || false,
            moduleWidth: options.moduleWidth || 18,
        };

        this.fileStream = null;
        this.startTime = Date.now();
        this.sessionId = this._generateSessionId();
        this.stats = {
            debug: 0,
            info: 0,
            warn: 0,
            error: 0,
            success: 0,
            commands: 0,
            events: 0,
        };

        if (this.options.file && this.options.filePath) {
            this._initFileLogging();
        }

        // Initialize console overrides to filter spam
        this._initConsoleOverrides();
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  PRIVATE HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    _initConsoleOverrides() {
        const originalWarn = console.warn;
        const originalError = console.error;
        const originalLog = console.log;

        // Filters for noisy logs from external libraries
        const SPAM_FILTERS = [
            "WebSocket closed. Reconnecting...",
            "Connected via undici.WebSocket",
            "[MQTT] getSeqID error",
            "Facebook blocked the login", // We handle this in AccountManager, suppress raw log
        ];

        const shouldFilter = (args) => {
            const msg = args.map(String).join(" ");
            return SPAM_FILTERS.some((filter) => msg.includes(filter));
        };

        console.warn = (...args) => {
            if (shouldFilter(args)) return;
            originalWarn.apply(console, args);
        };

        console.error = (...args) => {
            if (shouldFilter(args)) return;
            originalError.apply(console, args);
        };

        // Also filter standard log if needed (some libs use console.log for status)
        console.log = (...args) => {
            if (shouldFilter(args)) return;
            originalLog.apply(console, args);
        };
    }

    _generateSessionId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    _initFileLogging() {
        try {
            const logDir = path.dirname(this.options.filePath);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            // Rotate if file too large
            if (fs.existsSync(this.options.filePath)) {
                const stats = fs.statSync(this.options.filePath);
                if (stats.size / (1024 * 1024) >= this.options.maxFileSize) {
                    const ts = new Date().toISOString().replace(/[:.]/g, "-");
                    fs.renameSync(
                        this.options.filePath,
                        this.options.filePath.replace(".log", `-${ts}.log`)
                    );
                }
            }

            this.fileStream = fs.createWriteStream(this.options.filePath, {
                flags: "a",
                encoding: "utf8",
            });

            // Session header
            const header =
                `\n${"═".repeat(80)}\n` +
                `SESSION: ${new Date().toISOString()} | ID: ${this.sessionId} | PID: ${process.pid}\n` +
                `${"═".repeat(80)}\n\n`;
            this.fileStream.write(header);
        } catch (err) {
            console.error(`[Logger] File init failed: ${err.message}`);
        }
    }

    _getTimestamp() {
        const now = new Date();
        const H = String(now.getHours()).padStart(2, "0");
        const M = String(now.getMinutes()).padStart(2, "0");
        const S = String(now.getSeconds()).padStart(2, "0");
        const ms = String(now.getMilliseconds()).padStart(3, "0");
        return `${H}:${M}:${S}.${ms}`;
    }

    _formatModule(module) {
        if (!module) return " ".repeat(this.options.moduleWidth);
        const w = this.options.moduleWidth;
        return module.length > w ? module.substring(0, w - 2) + ".." : module.padEnd(w);
    }

    _stripColors(str) {
        return str.replace(/\x1b\[[0-9;]*m/g, "");
    }

    _getMemoryMB() {
        return (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    }

    _getUptime() {
        const ms = Date.now() - this.startTime;
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        const h = Math.floor(m / 60);
        if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
        if (m > 0) return `${m}m ${s % 60}s`;
        return `${s}s`;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  CORE LOG METHOD
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Main log function
     * @param {string} level - Log level
     * @param {string} module - Module/category name
     * @param {...any} args - Log message parts
     */
    log(level, module, ...args) {
        if (!this.options.levels.includes(level)) return;

        // Update stats
        if (Object.prototype.hasOwnProperty.call(this.stats, level)) {
            this.stats[level]++;
        }

        const cfg = LOG_LEVELS[level];
        const ts = this.options.timestamps ? this._getTimestamp() : "";
        const mod = this._formatModule(module);

        // Format message
        const message = args
            .map((arg) => {
                if (arg instanceof Error) {
                    return `${arg.name}: ${arg.message}`;
                }
                if (typeof arg === "object" && arg !== null) {
                    try {
                        return JSON.stringify(arg);
                    } catch {
                        return String(arg);
                    }
                }
                return String(arg);
            })
            .join(" ");

        // Console output
        if (this.options.console && this.options.colors) {
            const line =
                chalk.gray(ts) +
                " " +
                chalk.gray("│") +
                " " +
                cfg.color(`${cfg.icon} ${cfg.label.padEnd(5)}`) +
                " " +
                chalk.gray("│") +
                " " +
                chalk.whiteBright(mod) +
                " " +
                chalk.gray("│") +
                " " +
                message;
            console.log(line);
        } else if (this.options.console) {
            console.log(`${ts} │ ${cfg.icon} ${cfg.label.padEnd(5)} │ ${mod} │ ${message}`);
        }

        // File output
        if (this.fileStream) {
            const fileLine = `${ts} │ ${cfg.icon} ${cfg.label.padEnd(5)} │ ${mod} │ ${this._stripColors(message)}`;
            this.fileStream.write(fileLine + "\n");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  LOG LEVEL SHORTCUTS
    // ─────────────────────────────────────────────────────────────────────────

    debug(module, ...args) {
        this.log("debug", module, ...args);
    }

    info(module, ...args) {
        this.log("info", module, ...args);
    }

    warn(module, ...args) {
        this.log("warn", module, ...args);
    }

    error(module, ...args) {
        this.log("error", module, ...args);
    }

    success(module, ...args) {
        this.log("success", module, ...args);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  SPECIALIZED LOGGING METHODS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Log command execution
     */
    command(cmdName, userId, threadId, args = [], success = true) {
        this.stats.commands++;
        const icon = success ? chalk.greenBright("✓") : chalk.redBright("✗");
        const argsStr =
            args.length > 0
                ? `args: [${args.slice(0, 3).join(", ")}${args.length > 3 ? "..." : ""}]`
                : "";
        this.info(
            "Command",
            icon +
                " " +
                chalk.magentaBright(cmdName) +
                " " +
                chalk.gray("│") +
                " user: " +
                chalk.cyan(userId) +
                " " +
                chalk.gray("│") +
                " thread: " +
                chalk.cyan(threadId) +
                (argsStr ? " " + chalk.gray("│") + " " + chalk.dim(argsStr) : "")
        );
    }

    /**
     * Log event trigger
     */
    event(eventName, details = {}) {
        this.stats.events++;
        const pairs = Object.entries(details)
            .slice(0, 4)
            .map(([k, v]) => `${k}: ${chalk.cyan(v)}`)
            .join(" " + chalk.gray("│") + " ");
        this.info(
            "Event",
            chalk.blueBright(eventName) + (pairs ? " " + chalk.gray("│") + " " + pairs : "")
        );
    }

    /**
     * Log API call
     */
    api(method, endpoint, status = 200, duration = null) {
        const methodColors = {
            GET: chalk.greenBright,
            POST: chalk.yellowBright,
            PUT: chalk.blueBright,
            DELETE: chalk.redBright,
        };
        const color = methodColors[method.toUpperCase()] || chalk.white;
        const statusColor = status >= 200 && status < 300 ? chalk.greenBright : chalk.redBright;
        const dur =
            duration !== null ? " " + chalk.gray("│") + " " + chalk.dim(`${duration}ms`) : "";

        this.debug(
            "API",
            color(method.toUpperCase().padEnd(6)) +
                " " +
                endpoint +
                " " +
                chalk.gray("│") +
                " " +
                statusColor(status) +
                dur
        );
    }

    /**
     * Log user authentication
     */
    auth(action, userId, success = true) {
        const icon = success ? chalk.greenBright("✓") : chalk.redBright("✗");
        const status = success ? chalk.greenBright("SUCCESS") : chalk.redBright("FAILED");
        this.info(
            "Auth",
            icon +
                " " +
                action +
                " " +
                chalk.gray("│") +
                " user: " +
                chalk.cyan(userId) +
                " " +
                chalk.gray("│") +
                " " +
                status
        );
    }

    /**
     * Log network/connection event
     */
    network(type, details = "") {
        const icons = {
            connected: chalk.greenBright("●"),
            disconnected: chalk.redBright("○"),
            reconnecting: chalk.yellowBright("◐"),
        };
        const icon = icons[type] || chalk.gray("◆");
        this.info(
            "Network",
            icon + " " + type.toUpperCase() + (details ? " " + chalk.gray("│") + " " + details : "")
        );
    }

    /**
     * Log message received/sent
     */
    message(direction, threadId, userId, preview = "") {
        const icon = direction === "in" ? chalk.greenBright("◀") : chalk.cyanBright("▶");
        const dir = direction === "in" ? "RECV" : "SEND";
        const short = preview.length > 30 ? preview.substring(0, 27) + "..." : preview;
        this.debug(
            "Message",
            icon +
                " " +
                dir +
                " " +
                chalk.gray("│") +
                " " +
                "thread: " +
                chalk.cyan(threadId) +
                " " +
                chalk.gray("│") +
                " " +
                "user: " +
                chalk.cyan(userId) +
                (short ? " " + chalk.gray("│") + ' "' + chalk.dim(short) + '"' : "")
        );
    }

    /**
     * Log performance metric
     */
    perf(operation, durationMs, details = "") {
        const color =
            durationMs < 100
                ? chalk.greenBright
                : durationMs < 500
                  ? chalk.yellowBright
                  : chalk.redBright;
        this.debug(
            "Perf",
            operation +
                " " +
                chalk.gray("│") +
                " " +
                color(`${durationMs}ms`) +
                (details ? " " + chalk.gray("│") + " " + details : "")
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  VISUAL HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Check if logging is silent (no output)
     */
    _isSilent() {
        return !this.options.console || this.options.levels.length === 0;
    }

    /**
     * Print horizontal divider
     */
    divider(char = "─") {
        if (this._isSilent()) return;
        console.log(chalk.gray(char.repeat(90)));
    }

    /**
     * Print blank line
     */
    blank() {
        if (this._isSilent()) return;
        console.log();
    }

    /**
     * Print section header
     */
    section(title) {
        if (this._isSilent()) return;
        console.log();
        console.log(
            chalk.gray("──── ") +
                chalk.cyanBright.bold(title.toUpperCase()) +
                " " +
                chalk.gray("─".repeat(Math.max(0, 75 - title.length)))
        );
        console.log();
    }

    /**
     * Print boxed message
     */
    box(title, lines = []) {
        if (this._isSilent()) return;

        const width = 70;
        const hr = "═".repeat(width);

        console.log();
        console.log(chalk.cyan("╔" + hr + "╗"));
        console.log(
            chalk.cyan("║") +
                chalk.bold.whiteBright(
                    title
                        .toUpperCase()
                        .padStart((width + title.length) / 2)
                        .padEnd(width)
                ) +
                chalk.cyan("║")
        );
        console.log(chalk.cyan("╠" + hr + "╣"));

        for (const line of lines) {
            const stripped = this._stripColors(line);
            const padding = width - stripped.length;
            console.log(
                chalk.cyan("║") +
                    " " +
                    line +
                    " ".repeat(Math.max(0, padding - 1)) +
                    chalk.cyan("║")
            );
        }

        console.log(chalk.cyan("╚" + hr + "╝"));
        console.log();
    }

    /**
     * Print key-value pair
     */
    kv(key, value, indent = 2) {
        if (this._isSilent()) return;
        const pad = " ".repeat(indent);
        console.log(pad + chalk.gray(key + ":") + " " + chalk.whiteBright(value));
    }

    /**
     * Print list item
     */
    li(text, indent = 2, bullet = "•") {
        if (this._isSilent()) return;
        const pad = " ".repeat(indent);
        console.log(pad + chalk.gray(bullet) + " " + text);
    }

    /**
     * Print tree-style formatted output for human behavior logging
     * @param {string} module - Module name (e.g., "HumanBehavior")
     * @param {string} title - Main title line
     * @param {Array<{text: string, last?: boolean, children?: Array}>} items - Tree items
     */
    tree(module, title, items = []) {
        if (!this._shouldLog("debug")) return;

        const ts = this.options.timestamps
            ? chalk.gray(new Date().toLocaleTimeString()) + " │ "
            : "";

        // Print title
        console.log(
            ts +
                chalk.magenta("🔮 DEBUG") +
                " │ " +
                chalk.magentaBright(module) +
                " │ " +
                chalk.whiteBright(title)
        );

        // Print tree items
        const printItem = (item, prefix = "   ", isLast = false) => {
            const branch = isLast ? "└─" : "├─";
            const line = prefix + chalk.gray(branch) + " " + item.text;
            console.log(line);

            if (item.children && item.children.length > 0) {
                const newPrefix = prefix + (isLast ? "   " : "│  ");
                item.children.forEach((child, idx) => {
                    const childIsLast = idx === item.children.length - 1;
                    if (typeof child === "string") {
                        const childBranch = childIsLast ? "└─" : "├─";
                        console.log(newPrefix + chalk.gray(childBranch) + " " + child);
                    } else {
                        printItem(child, newPrefix, childIsLast);
                    }
                });
            }
        };

        items.forEach((item, idx) => {
            printItem(item, "   ", idx === items.length - 1);
        });
    }

    /**
     * Specialized human behavior logging with tree format
     * Matches nero framework's debug.human() style
     * @param {Object} data - Human behavior data
     */
    humanBehavior(data) {
        if (!this._shouldLog("debug")) return;

        const {
            action = "Action",
            type = "Generic action",
            delay = 0,
            circadian = 1.0,
            phases = [],
            status = [],
            extra = [],
        } = data;

        // Calculate total items to know when to use └─
        const hasStatus = status.length > 0;
        const hasPhases = phases.length > 0;
        const hasExtra = extra.length > 0;

        // Title line - matches nero format
        console.log(
            "\n" +
                chalk.magentaBright("🧠 Human Behavior") +
                " " +
                chalk.gray("-") +
                " " +
                chalk.yellowBright(action + ":")
        );

        // Type
        console.log("   " + chalk.gray("├─") + " Type: " + chalk.cyan("⚡") + " " + type);

        // Delay
        console.log("   " + chalk.gray("├─") + " Delay: " + chalk.greenBright(delay + "ms"));

        // Circadian - check if this is the last main item
        const circadianIsLast = !hasStatus && !hasPhases && !hasExtra;
        const circBranch = circadianIsLast ? "└─" : "├─";
        console.log(
            "   " +
                chalk.gray(circBranch) +
                " Circadian: " +
                chalk.cyanBright(circadian.toFixed(2) + "x")
        );

        // Status items (typing indicators, checks, etc.) - nested under circadian
        if (hasStatus) {
            const statusIsLast = !hasPhases && !hasExtra;
            status.forEach((s, idx) => {
                const isLastStatus = idx === status.length - 1;
                const vertLine = statusIsLast && isLastStatus ? " " : "│";
                const subBranch = isLastStatus ? "└─" : "├─";
                console.log(
                    "   " +
                        chalk.gray(vertLine + "  " + subBranch) +
                        " " +
                        chalk.green("✓") +
                        " " +
                        s
                );
            });
        }

        // Phases
        if (hasPhases) {
            phases.forEach((phase, idx) => {
                const isLast = idx === phases.length - 1 && !hasExtra;
                const branch = isLast ? "└─" : "├─";
                console.log("   " + chalk.gray(branch) + " " + phase);
            });
        }

        // Extra info (like total delay)
        if (hasExtra) {
            extra.forEach((e, idx) => {
                const isLast = idx === extra.length - 1;
                const branch = isLast ? "└─" : "├─";
                console.log("   " + chalk.gray(branch) + " " + e);
            });
        }
    }

    /**
     * Simple human behavior line (for individual tree lines)
     * @param {string} line - Line to print
     */
    human(line) {
        if (!this._shouldLog("debug")) return;
        console.log(line);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  STATS & INFO
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Print system information
     */
    systemInfo() {
        if (this._isSilent()) return;

        const mem = process.memoryUsage();

        this.box("System Information", [
            chalk.gray("Platform:") + "    " + os.platform() + " " + os.arch(),
            chalk.gray("Node.js:") + "     " + process.version,
            chalk.gray("PID:") + "         " + process.pid,
            chalk.gray("Hostname:") + "    " + os.hostname(),
            chalk.gray("CPUs:") + "        " + os.cpus().length,
            chalk.gray("Total Mem:") +
                "   " +
                (os.totalmem() / 1024 / 1024 / 1024).toFixed(1) +
                " GB",
            chalk.gray("Free Mem:") +
                "    " +
                (os.freemem() / 1024 / 1024 / 1024).toFixed(1) +
                " GB",
            chalk.gray("Heap Used:") + "   " + (mem.heapUsed / 1024 / 1024).toFixed(1) + " MB",
        ]);
    }

    /**
     * Print session statistics
     */
    printStats() {
        if (this._isSilent()) return;

        const total = Object.values(this.stats).reduce((a, b) => a + b, 0);

        this.box("Session Statistics", [
            chalk.gray("Session ID:") + "  " + this.sessionId,
            chalk.gray("Uptime:") + "      " + this._getUptime(),
            chalk.gray("Total Logs:") + "  " + total,
            "",
            chalk.gray("Debug:") + "       " + this.stats.debug,
            chalk.gray("Info:") + "        " + this.stats.info,
            chalk.gray("Warnings:") + "    " + chalk.yellowBright(this.stats.warn),
            chalk.gray("Errors:") + "      " + chalk.redBright(this.stats.error),
            chalk.gray("Success:") + "     " + chalk.greenBright(this.stats.success),
            "",
            chalk.gray("Commands:") + "    " + chalk.magentaBright(this.stats.commands),
            chalk.gray("Events:") + "      " + chalk.blueBright(this.stats.events),
        ]);
    }

    /**
     * Get stats object
     */
    getStats() {
        return {
            ...this.stats,
            uptime: this._getUptime(),
            sessionId: this.sessionId,
            memoryMB: this._getMemoryMB(),
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  LIFECYCLE
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Close file stream
     */
    close() {
        if (this.fileStream) {
            const footer =
                `\n${"═".repeat(80)}\n` +
                `SESSION END: ${new Date().toISOString()} | UPTIME: ${this._getUptime()}\n` +
                `STATS: commands=${this.stats.commands} events=${this.stats.events} ` +
                `errors=${this.stats.error} warnings=${this.stats.warn}\n` +
                `${"═".repeat(80)}\n`;
            this.fileStream.write(footer);
            this.fileStream.end();
            this.fileStream = null;
        }
    }

    /**
     * Update configuration
     */
    configure(newOptions) {
        if (newOptions.levels) {
            newOptions.levels = resolveLevels(newOptions.levels);
        }
        this.options = { ...this.options, ...newOptions };

        if (this.options.file && this.options.filePath && !this.fileStream) {
            this._initFileLogging();
        } else if (!this.options.file && this.fileStream) {
            this.close();
        }
    }

    /**
     * Get current log level
     */
    getLevel() {
        for (const [name, preset] of Object.entries(LEVEL_PRESETS)) {
            if (JSON.stringify(preset.sort()) === JSON.stringify([...this.options.levels].sort())) {
                return name;
            }
        }
        return "custom";
    }

    /**
     * Set log level
     */
    setLevel(level) {
        this.options.levels = resolveLevels(level);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DEFAULT INSTANCE EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

const logger = new Logger({
    console: true,
    file: false,
    levels: "verbose",
    timestamps: true,
    colors: true,
    showPid: false,
    showMemory: false,
    moduleWidth: 18,
});

module.exports = logger;
