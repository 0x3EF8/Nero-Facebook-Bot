/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                         NERO - HTTP Headers                                  ║
 * ║                    Request Header Generation                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module lib/utils/headers
 * @author 0x3EF8
 * @version 2.0.0
 */

"use strict";

const { randomUserAgent } = require("./user-agents");

/**
 * Viewport width options for anti-detection
 */
const VIEWPORT_VARIANTS = [
    "1920",
    "1536",
    "1440",
    "1366",
    "2560",
    "1280",
    "1680",
    "1600",
    "3840",
    "2048",
];

/**
 * Accept-Language header variants
 */
const LANGUAGE_VARIANTS = [
    "en-US,en;q=0.9",
    "en-US,en;q=0.9,es;q=0.8",
    "en-GB,en;q=0.9",
    "en-US,en;q=0.9,fr;q=0.8",
    "en-US,en;q=0.9,de;q=0.8",
];

/**
 * Generates a comprehensive and realistic set of headers for requests to Facebook.
 * @param {string} url - The target URL
 * @param {Object} options - Global options from context
 * @param {Object} ctx - The application context
 * @param {Object} customHeader - Extra headers to merge
 * @returns {Object} Complete headers object
 */
function getHeaders(url, options, ctx, customHeader) {
    const { userAgent, secChUa, secChUaFullVersionList, secChUaPlatform, secChUaPlatformVersion } =
        randomUserAgent();

    const host = new URL(url).hostname;
    const referer = `https://${host}/`;

    // Anti-detection: Random viewport and language
    const randomViewport = VIEWPORT_VARIANTS[Math.floor(Math.random() * VIEWPORT_VARIANTS.length)];
    const acceptLanguage = LANGUAGE_VARIANTS[Math.floor(Math.random() * LANGUAGE_VARIANTS.length)];

    // Anti-detection: Occasionally omit optional headers
    const includeColorScheme = Math.random() > 0.1;
    const includeDpr = Math.random() > 0.1;
    const includeViewportWidth = Math.random() > 0.15;

    const headers = {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": acceptLanguage,
        "Cache-Control": "max-age=0",
        Connection: "keep-alive",
        Host: host,
        Origin: `https://${host}`,
        Referer: referer,
        "Sec-Ch-Ua": secChUa,
        "Sec-Ch-Ua-Full-Version-List": secChUaFullVersionList,
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Model": '""',
        "Sec-Ch-Ua-Platform": secChUaPlatform,
        "Sec-Ch-Ua-Platform-Version": secChUaPlatformVersion,
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        "User-Agent": userAgent,
        ...(includeViewportWidth && { "Viewport-Width": randomViewport }),
        ...(includeDpr && { Dpr: "1" }),
        ...(includeColorScheme && { "Sec-Ch-Prefers-Color-Scheme": "light" }),
    };

    // Add context-specific headers
    if (ctx) {
        if (ctx.fb_dtsg) {
            headers["X-Fb-Lsd"] = ctx.lsd;
        }
        if (ctx.region) {
            headers["X-MSGR-Region"] = ctx.region;
        }
        if (ctx.master) {
            const { __spin_r, __spin_b, __spin_t } = ctx.master;
            if (__spin_r) headers["X-Fb-Spin-R"] = String(__spin_r);
            if (__spin_b) headers["X-Fb-Spin-B"] = String(__spin_b);
            if (__spin_t) headers["X-Fb-Spin-T"] = String(__spin_t);
        }
    }

    // Merge custom headers
    if (customHeader) {
        Object.assign(headers, customHeader);
        if (customHeader.noRef) {
            delete headers.Referer;
        }
    }

    return headers;
}

const meta = (prop) => new RegExp(`<meta property="${prop}" content="([^"]*)"`);

module.exports = {
    getHeaders,
    meta,
};
