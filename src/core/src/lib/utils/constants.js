"use strict";

const chalk = require("chalk");
const Table = require("cli-table3");
const os = require("os");

const _ws = chalk.cyan("⚡ NΞRO-CORE");

let h;
const i = {};
const j = {
    _: "%",
    A: "%2",
    B: "000",
    C: "%7d",
    D: "%7b%22",
    E: "%2c%22",
    F: "%22%3a",
    G: "%2c%22ut%22%3a1",
    H: "%2c%22bls%22%3a",
    I: "%2c%22n%22%3a%22%",
    J: "%22%3a%7b%22i%22%3a0%7d",
    K: "%2c%22pt%22%3a0%2c%22vis%22%3a",
    L: "%2c%22ch%22%3a%7b%22h%22%3a%22",
    M: "%7b%22v%22%3a2%2c%22time%22%3a1",
    N: ".channel%22%2c%22sub%22%3a%5b",
    O: "%2c%22sb%22%3a1%2c%22t%22%3a%5b",
    P: "%2c%22ud%22%3a100%2c%22lc%22%3a0",
    Q: "%5d%2c%22f%22%3anull%2c%22uct%22%3a",
    R: ".channel%22%2c%22sub%22%3a%5b1%5d",
    S: "%22%2c%22m%22%3a0%7d%2c%7b%22i%22%3a",
    T: "%2c%22blc%22%3a1%2c%22snd%22%3a1%2c%22ct%22%3a",
    U: "%2c%22blc%22%3a0%2c%22snd%22%3a1%2c%22ct%22%3a",
    V: "%2c%22blc%22%3a0%2c%22snd%22%3a0%2c%22ct%22%3a",
    W: "%2c%22s%22%3a0%2c%22blo%22%3a0%7d%2c%22bl%22%3a%7b%22ac%22%3a",
    X: "%2c%22ri%22%3a0%7d%2c%22state%22%3a%7b%22p%22%3a0%2c%22ut%22%3a1",
    Y: "%2c%22pt%22%3a0%2c%22vis%22%3a1%2c%22bls%22%3a0%2c%22blc%22%3a0%2c%22snd%22%3a1%2c%22ct%22%3a",
    Z: "%2c%22sb%22%3a1%2c%22t%22%3a%5b%5d%2c%22f%22%3anull%2c%22uct%22%3a0%2c%22s%22%3a0%2c%22blo%22%3a0%7d%2c%22bl%22%3a%7b%22ac%22%3a",
};
(function () {
    const l = [];
    for (const m in j) {
        i[j[m]] = m;
        l.push(j[m]);
    }
    l.reverse();
    h = new RegExp(l.join("|"), "g");
})();

const NUM_TO_MONTH = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];
const NUM_TO_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function padZeros(val, len) {
    val = String(val);
    len = len || 2;
    while (val.length < len) val = "0" + val;
    return val;
}

function generateThreadingID(clientID) {
    const k = Date.now();
    const l = Math.floor(Math.random() * 4294967295);
    const m = clientID;
    return "<" + k + ":" + l + "-" + m + "@mail.projektitan.com>";
}

function binaryToDecimal(data) {
    let ret = "";
    while (data !== "0") {
        let end = 0;
        let fullName = "";
        let i = 0;
        for (; i < data.length; i++) {
            end = 2 * end + parseInt(data[i], 10);
            if (end >= 10) {
                fullName += "1";
                end -= 10;
            } else {
                fullName += "0";
            }
        }
        ret = end.toString() + ret;
        data = fullName.slice(fullName.indexOf("1"));
    }
    return ret;
}

function generateOfflineThreadingID() {
    const ret = Date.now();
    const value = Math.floor(Math.random() * 4294967295);
    const str = ("0000000000000000000000" + value.toString(2)).slice(-22);
    const msgs = ret.toString(2) + str;
    return binaryToDecimal(msgs);
}

function presenceEncode(str) {
    return encodeURIComponent(str)
        .replace(/([_A-Z])|%../g, function (m, n) {
            return n ? "%" + n.charCodeAt(0).toString(16) : m;
        })
        .toLowerCase()
        .replace(h, function (m) {
            return i[m];
        });
}

function presenceDecode(str) {
    return decodeURIComponent(
        str.replace(/[_A-Z]/g, function (m) {
            return j[m];
        })
    );
}

function generatePresence(userID) {
    const time = Date.now();
    return (
        "E" +
        presenceEncode(
            JSON.stringify({
                v: 3,
                time: parseInt(time / 1000, 10),
                user: userID,
                state: {
                    ut: 0,
                    t2: [],
                    lm2: null,
                    uct2: time,
                    tr: null,
                    tw: Math.floor(Math.random() * 4294967295) + 1,
                    at: time,
                },
                ch: {
                    ["p_" + userID]: 0,
                },
            })
        )
    );
}

function generateAccessiblityCookie() {
    const time = Date.now();
    return encodeURIComponent(
        JSON.stringify({
            sr: 0,
            "sr-ts": time,
            jk: 0,
            "jk-ts": time,
            kb: 0,
            "kb-ts": time,
            hcm: 0,
            "hcm-ts": time,
        })
    );
}

function getGUID() {
    let sectionLength = Date.now();
    const id = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = Math.floor((sectionLength + Math.random() * 16) % 16);
        sectionLength = Math.floor(sectionLength / 16);
        const _guid = (c === "x" ? r : (r & 7) | 8).toString(16);
        return _guid;
    });
    return id;
}

function getFrom(str, startToken, endToken) {
    const start = str.indexOf(startToken) + startToken.length;
    if (start < startToken.length) return "";

    const lastHalf = str.substring(start);
    const end = lastHalf.indexOf(endToken);
    if (end === -1) {
        throw Error("Could not find endTime `" + endToken + "` in the given string.");
    }
    return lastHalf.substring(0, end);
}

function makeParsable(html) {
    const withoutForLoop = html.replace(/for\s*\(\s*;\s*;\s*\)\s*;\s*/, "");
    const maybeMultipleObjects = withoutForLoop.split(/\}\r\n *\{/);
    if (maybeMultipleObjects.length === 1) return maybeMultipleObjects;

    return "[" + maybeMultipleObjects.join("},{") + "]";
}

function arrToForm(form) {
    return arrayToObject(
        form,
        function (v) {
            return v.name;
        },
        function (v) {
            return v.val;
        }
    );
}

function arrayToObject(arr, getKey, getValue) {
    return arr.reduce(function (acc, val) {
        acc[getKey(val)] = getValue(val);
        return acc;
    }, {});
}

function getSignatureID() {
    return Math.floor(Math.random() * 2147483648).toString(16);
}

function generateTimestampRelative() {
    const d = new Date();
    return d.getHours() + ":" + padZeros(d.getMinutes());
}

function getType(obj) {
    return Object.prototype.toString.call(obj).slice(8, -1);
}

// ═════════════════════════════════════════════════════════════════
// 🎨 LOGGING SYSTEM - Controlled by shared debugLevel
// ═════════════════════════════════════════════════════════════════

// Import debug module to share the same debug level
const debugModule = require("./debug");

let hasShownBanner = false;

// Level values for comparison
const LEVELS = { silent: 0, minimal: 1, normal: 2, verbose: 3 };

/**
 * Check if should log based on required level
 * Uses debug.js's getDebugLevel() for single source of truth
 * @param {string} requiredLevel - minimum level required to log
 * @returns {boolean}
 */
function shouldLog(requiredLevel) {
    const currentLevel = debugModule.getDebugLevel();
    return LEVELS[currentLevel] >= LEVELS[requiredLevel];
}

/**
 * Legacy function for backwards compatibility
 * @param {boolean} bool - true enables logging, false disables
 */
function logOptions(bool) {
    debugModule.setDebugLevel(bool ? "verbose" : "silent");
}

// Neofetch-style banner with side-by-side layout
function showBanner() {
    if (hasShownBanner || !shouldLog("normal")) return;
    hasShownBanner = true;

    try {
        // Simple ASCII art for NΞRO
        const asciiLines = [
            chalk.cyan.bold("    ███╗   ██╗███████╗██████╗  ██████╗ "),
            chalk.cyan.bold("    ████╗  ██║██╔════╝██╔══██╗██╔═══██╗"),
            chalk.cyan.bold("    ██╔██╗ ██║█████╗  ██████╔╝██║   ██║"),
            chalk.cyan.bold("    ██║╚██╗██║██╔══╝  ██╔══██╗██║   ██║"),
            chalk.cyan.bold("    ██║ ╚████║███████╗██║  ██║╚██████╔╝"),
            chalk.cyan.bold("    ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ "),
        ];

        // System information (right side)
        const _ws = require("ws");
        const hostname = os.hostname();
        const platform = os.platform();
        const osName = platform === "win32" ? "Windows" : platform === "darwin" ? "macOS" : "Linux";

        const info = [
            chalk.cyan.bold("nero@facebook"),
            chalk.gray("─────────────────────────"),
            chalk.yellow.bold("OS: ") + chalk.green.bold(osName),
            chalk.yellow.bold("Host: ") + chalk.green.bold(hostname),
            chalk.yellow.bold("Version: ") + chalk.white("2.6.0-BETA"),
            chalk.yellow.bold("Build: ") + chalk.cyan.bold("NEURAL-CORE-ENGINE"),
        ];

        console.log("");
        // Print side by side
        for (let i = 0; i < Math.max(asciiLines.length, info.length); i++) {
            const left = asciiLines[i] || " ".repeat(45);
            const right = info[i] || "";
            console.log(left + "  " + right);
        }

        console.log("");
    } catch (_err) {
        log("Utils", "warn", "request", "error sending data");
        console.log("\n" + chalk.cyan.bold("  NΞRO NEURAL CORE") + "\n");
    }
}

// Track if we've shown the section header
let hasShownHeader = false;
let logCount = 0;

// Show header once for the entire operation session (normal level)
function showHeader() {
    if (!hasShownHeader && shouldLog("normal")) {
        console.log(chalk.cyan(" ┌─[") + chalk.cyan.bold("NΞRO-CORE") + chalk.cyan("]"));
        hasShownHeader = true;
        logCount = 0;
    }
}

// Close the tree structure
function closeTree() {
    if (hasShownHeader && logCount > 0) {
        hasShownHeader = false;
        logCount = 0;
    }
}

// Log - normal level (detailed operations)
function log(...args) {
    if (!shouldLog("normal")) return;
    showBanner();
    showHeader();
    console.log(chalk.cyan(" ├─[") + chalk.white("▸"), chalk.white(...args));
    logCount++;
}

// Error - minimal level (always show critical errors unless silent)
function error(...args) {
    if (!shouldLog("minimal")) return;
    showBanner();
    showHeader();
    console.error(chalk.cyan(" ├─[") + chalk.red.bold("✖"), chalk.red(...args));
}

// Warning - normal level
function warn(...args) {
    if (!shouldLog("normal")) return;
    showBanner();
    showHeader();
    console.warn(chalk.cyan(" ├─[") + chalk.yellow.bold("⚠"), chalk.yellow(...args));
}

// Info - normal level (detailed info)
function info(...args) {
    if (!shouldLog("normal")) return;
    showBanner();
    showHeader();

    let isContinuation = true;
    if (typeof args[args.length - 1] === "boolean") {
        isContinuation = args.pop();
    }

    const prefix = isContinuation ? " ├─[" : " └─[";
    console.log(chalk.cyan(prefix) + chalk.white("►"), chalk.white(...args));

    if (!isContinuation) {
        console.log("");
        hasShownHeader = false;
    } else {
        logCount++;
    }
}

// Success - normal level (key events)
function success(...args) {
    if (!shouldLog("normal")) return;
    showBanner();
    showHeader();

    let isContinuation = false;
    if (typeof args[args.length - 1] === "boolean") {
        isContinuation = args.pop();
    }

    const prefix = isContinuation ? " ├─[" : " └─[";
    console.log(chalk.cyan(prefix) + chalk.green.bold("✓"), chalk.green(...args));

    if (!isContinuation) {
        console.log("");
        hasShownHeader = false;
    }
}

// Debug - verbose level only
function debug(...args) {
    if (!shouldLog("verbose")) return;
    showHeader();
    console.log(chalk.cyan(" ├─[") + chalk.gray("◆"), chalk.gray(...args));
}

// Table - verbose level only
function table(data, headers) {
    if (!shouldLog("verbose")) return;
    showBanner();

    const tbl = new Table({
        head: headers.map((h) => chalk.cyan.bold(h)),
        style: {
            head: [],
            border: ["cyan"],
        },
    });

    data.forEach((row) => tbl.push(row));
    console.log(tbl.toString());
}

module.exports = {
    logOptions,
    log,
    error,
    warn,
    info,
    success,
    debug,
    table,
    showBanner,
    closeTree,
    getRandom,
    padZeros,
    generateThreadingID,
    binaryToDecimal,
    generateOfflineThreadingID,
    presenceEncode,
    presenceDecode,
    generatePresence,
    generateAccessiblityCookie,
    getGUID,
    getFrom,
    makeParsable,
    arrToForm,
    arrayToObject,
    getSignatureID,
    generateTimestampRelative,
    getType,
    NUM_TO_MONTH,
    NUM_TO_DAY,
};
