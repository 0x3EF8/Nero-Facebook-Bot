/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                         NERO - User Agents                                   ║
 * ║                    Browser Fingerprint Generation                             ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module lib/utils/user-agents
 * @author 0x3EF8
 * @version 2.0.0
 */

"use strict";

/**
 * Browser data for realistic user agent generation
 */
const BROWSER_DATA = {
    windows: {
        platform: "Windows NT 10.0; Win64; x64",
        chromeVersions: ["126.0.0.0", "125.0.0.0", "124.0.0.0"],
        platformVersion: '"15.0.0"',
    },
    mac: {
        platform: "Macintosh; Intel Mac OS X 10_15_7",
        chromeVersions: ["126.0.0.0", "125.0.0.0", "124.0.0.0"],
        platformVersion: '"15.7.9"',
    },
};

const DEFAULT_USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/**
 * Get random element from array
 * @param {Array} arr - Source array
 * @returns {*} Random element
 */
function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generates a realistic, randomized User-Agent string and related Sec-CH headers.
 * @returns {Object} User agent data with all required headers
 */
function randomUserAgent() {
    const os = getRandom(Object.keys(BROWSER_DATA));
    const data = BROWSER_DATA[os];
    const version = getRandom(data.chromeVersions);
    const majorVersion = version.split(".")[0];

    const userAgent = `Mozilla/5.0 (${data.platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;

    // Construct the Sec-CH-UA header
    const brands = [
        `"Not/A)Brand";v="8"`,
        `"Chromium";v="${majorVersion}"`,
        `"Google Chrome";v="${majorVersion}"`,
    ];
    const secChUa = brands.join(", ");
    const secChUaFullVersionList = brands.map((b) => b.replace(/"$/, `.0.0.0"`)).join(", ");

    return {
        userAgent,
        secChUa,
        secChUaFullVersionList,
        secChUaPlatform: `"${os === "windows" ? "Windows" : "macOS"}"`,
        secChUaPlatformVersion: data.platformVersion,
    };
}

module.exports = {
    defaultUserAgent: DEFAULT_USER_AGENT,
    windowsUserAgent: DEFAULT_USER_AGENT,
    randomUserAgent,
};
