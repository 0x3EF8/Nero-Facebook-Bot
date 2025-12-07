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

// ═══════════════════════════════════════════════════════════════════════════════
//  COLOR PALETTE - Clean Theme
// ═══════════════════════════════════════════════════════════════════════════════

const c = {
    // Reset
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    
    // Primary Colors
    cyan: "\x1b[36m",
    brightCyan: "\x1b[96m",
    green: "\x1b[32m",
    brightGreen: "\x1b[92m",
    yellow: "\x1b[33m",
    brightYellow: "\x1b[93m",
    red: "\x1b[31m",
    brightRed: "\x1b[91m",
    magenta: "\x1b[35m",
    brightMagenta: "\x1b[95m",
    blue: "\x1b[34m",
    brightBlue: "\x1b[94m",
    white: "\x1b[37m",
    brightWhite: "\x1b[97m",
    gray: "\x1b[90m",
    
    // Background
    bgRed: "\x1b[41m",
    bgGreen: "\x1b[42m",
    bgYellow: "\x1b[43m",
    bgBlue: "\x1b[44m",
};

// ═══════════════════════════════════════════════════════════════════════════════
//  LOG LEVEL CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const LOG_LEVELS = {
    debug: {
        icon: "•",
        label: "DEBUG",
        color: c.gray,
        priority: 0,
    },
    info: {
        icon: "ℹ",
        label: "INFO",
        color: c.brightCyan,
        priority: 1,
    },
    warn: {
        icon: "⚠",
        label: "WARN",
        color: c.brightYellow,
        priority: 2,
    },
    error: {
        icon: "✗",
        label: "ERROR",
        color: c.brightRed,
        priority: 3,
    },
    success: {
        icon: "✓",
        label: "OK",
        color: c.brightGreen,
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
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  PRIVATE HELPERS
    // ─────────────────────────────────────────────────────────────────────────

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
            const header = `\n${"═".repeat(80)}\n` +
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
        const message = args.map(arg => {
            if (arg instanceof Error) {
                return `${arg.name}: ${arg.message}`;
            }
            if (typeof arg === "object" && arg !== null) {
                try { return JSON.stringify(arg); } catch { return String(arg); }
            }
            return String(arg);
        }).join(" ");
        
        // Console output
        if (this.options.console && this.options.colors) {
            const line = `${c.gray}${ts}${c.reset} ${c.gray}│${c.reset} ` +
                `${cfg.color}${cfg.icon} ${cfg.label.padEnd(5)}${c.reset} ${c.gray}│${c.reset} ` +
                `${c.brightWhite}${mod}${c.reset} ${c.gray}│${c.reset} ` +
                `${message}`;
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
        const icon = success ? `${c.brightGreen}✓${c.reset}` : `${c.brightRed}✗${c.reset}`;
        const argsStr = args.length > 0 ? `args: [${args.slice(0, 3).join(", ")}${args.length > 3 ? "..." : ""}]` : "";
        this.info("Command", 
            `${icon} ${c.brightMagenta}${cmdName}${c.reset} ` +
            `${c.gray}│${c.reset} user: ${c.cyan}${userId}${c.reset} ` +
            `${c.gray}│${c.reset} thread: ${c.cyan}${threadId}${c.reset}` +
            (argsStr ? ` ${c.gray}│${c.reset} ${c.dim}${argsStr}${c.reset}` : "")
        );
    }

    /**
     * Log event trigger
     */
    event(eventName, details = {}) {
        this.stats.events++;
        const pairs = Object.entries(details)
            .slice(0, 4)
            .map(([k, v]) => `${k}: ${c.cyan}${v}${c.reset}`)
            .join(` ${c.gray}│${c.reset} `);
        this.info("Event",
            `${c.brightBlue}${eventName}${c.reset}` +
            (pairs ? ` ${c.gray}│${c.reset} ${pairs}` : "")
        );
    }

    /**
     * Log API call
     */
    api(method, endpoint, status = 200, duration = null) {
        const methodColors = {
            GET: c.brightGreen,
            POST: c.brightYellow,
            PUT: c.brightBlue,
            DELETE: c.brightRed,
        };
        const color = methodColors[method.toUpperCase()] || c.white;
        const statusColor = status >= 200 && status < 300 ? c.brightGreen : c.brightRed;
        const dur = duration !== null ? ` ${c.gray}│${c.reset} ${c.dim}${duration}ms${c.reset}` : "";
        
        this.debug("API",
            `${color}${method.toUpperCase().padEnd(6)}${c.reset} ` +
            `${endpoint} ${c.gray}│${c.reset} ${statusColor}${status}${c.reset}${dur}`
        );
    }

    /**
     * Log user authentication
     */
    auth(action, userId, success = true) {
        const icon = success ? `${c.brightGreen}✓${c.reset}` : `${c.brightRed}✗${c.reset}`;
        const status = success ? `${c.brightGreen}SUCCESS${c.reset}` : `${c.brightRed}FAILED${c.reset}`;
        this.info("Auth", `${icon} ${action} ${c.gray}│${c.reset} user: ${c.cyan}${userId}${c.reset} ${c.gray}│${c.reset} ${status}`);
    }

    /**
     * Log network/connection event
     */
    network(type, details = "") {
        const icons = {
            connected: `${c.brightGreen}●${c.reset}`,
            disconnected: `${c.brightRed}○${c.reset}`,
            reconnecting: `${c.brightYellow}◐${c.reset}`,
        };
        const icon = icons[type] || `${c.gray}◆${c.reset}`;
        this.info("Network", `${icon} ${type.toUpperCase()}${details ? ` ${c.gray}│${c.reset} ${details}` : ""}`);
    }

    /**
     * Log message received/sent
     */
    message(direction, threadId, userId, preview = "") {
        const icon = direction === "in" ? `${c.brightGreen}◀${c.reset}` : `${c.brightCyan}▶${c.reset}`;
        const dir = direction === "in" ? "RECV" : "SEND";
        const short = preview.length > 30 ? preview.substring(0, 27) + "..." : preview;
        this.debug("Message",
            `${icon} ${dir} ${c.gray}│${c.reset} ` +
            `thread: ${c.cyan}${threadId}${c.reset} ${c.gray}│${c.reset} ` +
            `user: ${c.cyan}${userId}${c.reset}` +
            (short ? ` ${c.gray}│${c.reset} "${c.dim}${short}${c.reset}"` : "")
        );
    }

    /**
     * Log performance metric
     */
    perf(operation, durationMs, details = "") {
        const color = durationMs < 100 ? c.brightGreen :
                      durationMs < 500 ? c.brightYellow : c.brightRed;
        this.debug("Perf",
            `${operation} ${c.gray}│${c.reset} ${color}${durationMs}ms${c.reset}` +
            (details ? ` ${c.gray}│${c.reset} ${details}` : "")
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
        console.log(`${c.gray}${char.repeat(90)}${c.reset}`);
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
        console.log(`${c.gray}──── ${c.brightCyan}${c.bold}${title.toUpperCase()}${c.reset} ${c.gray}${"─".repeat(Math.max(0, 75 - title.length))}${c.reset}`);
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
        console.log(`${c.cyan}╔${hr}╗${c.reset}`);
        console.log(`${c.cyan}║${c.reset}${c.bold}${c.brightWhite}${title.toUpperCase().padStart((width + title.length) / 2).padEnd(width)}${c.reset}${c.cyan}║${c.reset}`);
        console.log(`${c.cyan}╠${hr}╣${c.reset}`);
        
        for (const line of lines) {
            const stripped = this._stripColors(line);
            const padding = width - stripped.length;
            console.log(`${c.cyan}║${c.reset} ${line}${" ".repeat(Math.max(0, padding - 1))}${c.cyan}║${c.reset}`);
        }
        
        console.log(`${c.cyan}╚${hr}╝${c.reset}`);
        console.log();
    }

    /**
     * Print key-value pair
     */
    kv(key, value, indent = 2) {
        if (this._isSilent()) return;
        const pad = " ".repeat(indent);
        console.log(`${pad}${c.gray}${key}:${c.reset} ${c.brightWhite}${value}${c.reset}`);
    }

    /**
     * Print list item
     */
    li(text, indent = 2, bullet = "•") {
        if (this._isSilent()) return;
        const pad = " ".repeat(indent);
        console.log(`${pad}${c.gray}${bullet}${c.reset} ${text}`);
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
            ? `${c.gray}${new Date().toLocaleTimeString()}${c.reset} │ `
            : "";
        
        // Print title
        console.log(`${ts}${c.magenta}🔮 DEBUG${c.reset} │ ${c.brightMagenta}${module}${c.reset} │ ${c.brightWhite}${title}${c.reset}`);
        
        // Print tree items
        const printItem = (item, prefix = "   ", isLast = false) => {
            const branch = isLast ? "└─" : "├─";
            const line = `${prefix}${c.gray}${branch}${c.reset} ${item.text}`;
            console.log(line);
            
            if (item.children && item.children.length > 0) {
                const newPrefix = prefix + (isLast ? "   " : "│  ");
                item.children.forEach((child, idx) => {
                    const childIsLast = idx === item.children.length - 1;
                    if (typeof child === "string") {
                        const childBranch = childIsLast ? "└─" : "├─";
                        console.log(`${newPrefix}${c.gray}${childBranch}${c.reset} ${child}`);
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
            extra = []
        } = data;
        
        // Calculate total items to know when to use └─
        const hasStatus = status.length > 0;
        const hasPhases = phases.length > 0;
        const hasExtra = extra.length > 0;
        
        // Title line - matches nero format
        console.log(`\n${c.brightMagenta}🧠 Human Behavior${c.reset} ${c.gray}-${c.reset} ${c.brightYellow}${action}:${c.reset}`);
        
        // Type
        console.log(`   ${c.gray}├─${c.reset} Type: ${c.cyan}⚡${c.reset} ${type}`);
        
        // Delay
        console.log(`   ${c.gray}├─${c.reset} Delay: ${c.brightGreen}${delay}ms${c.reset}`);
        
        // Circadian - check if this is the last main item
        const circadianIsLast = !hasStatus && !hasPhases && !hasExtra;
        const circBranch = circadianIsLast ? "└─" : "├─";
        console.log(`   ${c.gray}${circBranch}${c.reset} Circadian: ${c.brightCyan}${circadian.toFixed(2)}x${c.reset}`);
        
        // Status items (typing indicators, checks, etc.) - nested under circadian
        if (hasStatus) {
            const statusIsLast = !hasPhases && !hasExtra;
            status.forEach((s, idx) => {
                const isLastStatus = idx === status.length - 1;
                const vertLine = statusIsLast && isLastStatus ? " " : "│";
                const subBranch = isLastStatus ? "└─" : "├─";
                console.log(`   ${c.gray}${vertLine}  ${subBranch}${c.reset} ${c.green}✓${c.reset} ${s}`);
            });
        }
        
        // Phases
        if (hasPhases) {
            phases.forEach((phase, idx) => {
                const isLast = idx === phases.length - 1 && !hasExtra;
                const branch = isLast ? "└─" : "├─";
                console.log(`   ${c.gray}${branch}${c.reset} ${phase}`);
            });
        }
        
        // Extra info (like total delay)
        if (hasExtra) {
            extra.forEach((e, idx) => {
                const isLast = idx === extra.length - 1;
                const branch = isLast ? "└─" : "├─";
                console.log(`   ${c.gray}${branch}${c.reset} ${e}`);
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
            `${c.gray}Platform:${c.reset}    ${os.platform()} ${os.arch()}`,
            `${c.gray}Node.js:${c.reset}     ${process.version}`,
            `${c.gray}PID:${c.reset}         ${process.pid}`,
            `${c.gray}Hostname:${c.reset}    ${os.hostname()}`,
            `${c.gray}CPUs:${c.reset}        ${os.cpus().length}`,
            `${c.gray}Total Mem:${c.reset}   ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB`,
            `${c.gray}Free Mem:${c.reset}    ${(os.freemem() / 1024 / 1024 / 1024).toFixed(1)} GB`,
            `${c.gray}Heap Used:${c.reset}   ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`,
        ]);
    }

    /**
     * Print session statistics
     */
    printStats() {
        if (this._isSilent()) return;
        
        const total = Object.values(this.stats).reduce((a, b) => a + b, 0);
        
        this.box("Session Statistics", [
            `${c.gray}Session ID:${c.reset}  ${this.sessionId}`,
            `${c.gray}Uptime:${c.reset}      ${this._getUptime()}`,
            `${c.gray}Total Logs:${c.reset}  ${total}`,
            ``,
            `${c.gray}Debug:${c.reset}       ${this.stats.debug}`,
            `${c.gray}Info:${c.reset}        ${this.stats.info}`,
            `${c.gray}Warnings:${c.reset}    ${c.brightYellow}${this.stats.warn}${c.reset}`,
            `${c.gray}Errors:${c.reset}      ${c.brightRed}${this.stats.error}${c.reset}`,
            `${c.gray}Success:${c.reset}     ${c.brightGreen}${this.stats.success}${c.reset}`,
            ``,
            `${c.gray}Commands:${c.reset}    ${c.brightMagenta}${this.stats.commands}${c.reset}`,
            `${c.gray}Events:${c.reset}      ${c.brightBlue}${this.stats.events}${c.reset}`,
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
            const footer = `\n${"═".repeat(80)}\n` +
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
