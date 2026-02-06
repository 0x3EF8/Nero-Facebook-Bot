"use strict";

const { makeParsable } = require("./constants");

// ═══════════════════════════════════════════════════════════════════════════════
// DTSG AUTO-REFRESH CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * DTSG refresh state tracking per context
 * @type {WeakMap<Object, {lastRefresh: number, isRefreshing: boolean, refreshCount: number}>}
 */
const dtsgRefreshState = new WeakMap();

/**
 * Default refresh interval (45 minutes in milliseconds)
 * Facebook's DTSG token can expire unpredictably, 45 min is safe buffer
 */
const DTSG_REFRESH_INTERVAL = 45 * 60 * 1000; // 45 minutes

/**
 * Minimum time between refresh attempts (5 minutes)
 */
const MIN_REFRESH_INTERVAL = 5 * 60 * 1000;

/**
 * Formats a cookie array into a string for use in a cookie jar.
 * @param {Array<string>} arr - An array containing cookie parts.
 * @param {string} url - The base URL for the cookie domain.
 * @returns {string} The formatted cookie string.
 */
function formatCookie(arr, url) {
    return arr[0] + "=" + arr[1] + "; Path=" + arr[3] + "; Domain=" + url + ".com";
}

/**
 * Parses a response from Facebook, checks for login status, and handles retries.
 * @param {Object} ctx - The application context.
 * @param {Object} http - The HTTP request functions.
 * @param {number} [retryCount=0] - The current retry count for the request.
 * @returns {function(data: Object): Promise<Object>} A function that processes the response data.
 */
function parseAndCheckLogin(ctx, http, retryCount = 0) {
    const delay = (ms) =>
        new Promise((resolve) => {
            setTimeout(resolve, ms);
        });

    return async (data) => {
        if (data.statusCode >= 500 && data.statusCode < 600) {
            if (retryCount >= 5) {
                const err = new Error(
                    "Request retry failed. Check the `res` and `statusCode` property on this error."
                );
                err.statusCode = data.statusCode;
                err.res = data.body;
                err.error =
                    "Request retry failed. Check the `res` and `statusCode` property on this error.";
                throw err;
            }

            retryCount++;
            const retryTime = Math.floor(Math.random() * 5000);
            const url =
                data.request.uri.protocol +
                "//" +
                data.request.uri.hostname +
                data.request.uri.pathname;

            await delay(retryTime);

            // Safe content-type check with null/undefined handling
            const contentType =
                data.request.headers && data.request.headers["content-type"]
                    ? data.request.headers["content-type"].split(";")[0]
                    : "";

            if (contentType === "multipart/form-data") {
                const newData = await http.postFormData(
                    url,
                    ctx.jar,
                    data.request.formData,
                    data.request.qs,
                    ctx.globalOptions,
                    ctx
                );
                return await parseAndCheckLogin(ctx, http, retryCount)(newData);
            } else {
                const newData = await http.post(
                    url,
                    ctx.jar,
                    data.request.form,
                    ctx.globalOptions,
                    ctx
                );
                return await parseAndCheckLogin(ctx, http, retryCount)(newData);
            }
        }

        if (data.statusCode === 404) return;

        if (data.statusCode !== 200) {
            throw new Error(
                "parseAndCheckLogin got status code: " +
                    data.statusCode +
                    ". Bailing out of trying to parse response."
            );
        }

        let res = null;

        if (typeof data.body === "object" && data.body !== null) {
            res = data.body;
        } else if (typeof data.body === "string") {
            try {
                res = JSON.parse(makeParsable(data.body));
            } catch (e) {
                const err = new Error(
                    "JSON.parse error. Check the `detail` property on this error."
                );
                err.error = "JSON.parse error. Check the `detail` property on this error.";
                err.detail = e;
                err.res = data.body;
                throw err;
            }
        } else {
            throw new Error("Unknown response body type: " + typeof data.body);
        }

        if (res.redirect && data.request.method === "GET") {
            const redirectRes = await http.get(res.redirect, ctx.jar);
            return await parseAndCheckLogin(ctx, http)(redirectRes);
        }

        if (
            res.jsmods &&
            res.jsmods.require &&
            Array.isArray(res.jsmods.require[0]) &&
            res.jsmods.require[0][0] === "Cookie"
        ) {
            res.jsmods.require[0][3][0] = res.jsmods.require[0][3][0].replace("_js_", "");
            const requireCookie = res.jsmods.require[0][3];
            ctx.jar.setCookie(formatCookie(requireCookie, "facebook"), "https://www.facebook.com");
            ctx.jar.setCookie(
                formatCookie(requireCookie, "messenger"),
                "https://www.messenger.com"
            );
        }

        if (res.jsmods && Array.isArray(res.jsmods.require)) {
            const arr = res.jsmods.require;
            for (const i in arr) {
                if (arr[i][0] === "DTSG" && arr[i][1] === "setToken") {
                    ctx.fb_dtsg = arr[i][3][0];
                    ctx.ttstamp = "2";
                    for (let j = 0; j < ctx.fb_dtsg.length; j++) {
                        ctx.ttstamp += ctx.fb_dtsg.charCodeAt(j);
                    }
                    // Update last refresh time on successful token update
                    updateDtsgRefreshState(ctx);
                }
            }
        }

        if (res.error === 1357001) {
            const err = new Error("Facebook blocked the login");
            err.error = "Not logged in.";
            throw err;
        }

        // Handle error 1357004 - Session tokens expired, need DTSG refresh
        if (res.error === 1357004) {
            const debug = require("./debug");
            debug.warn("DTSG", "Error 1357004 detected - Session tokens may be stale");
            
            // Attempt to refresh DTSG token
            const refreshed = await refreshDtsgToken(ctx, http);
            if (refreshed) {
                console.log("[DTSG] ✓ Token refreshed successfully, retrying request...");
                // Retry the original request after refresh
                if (retryCount < 2) {
                    await delay(1000);
                    const url =
                        data.request.uri.protocol +
                        "//" +
                        data.request.uri.hostname +
                        data.request.uri.pathname;
                    
                    const contentType =
                        data.request.headers && data.request.headers["content-type"]
                            ? data.request.headers["content-type"].split(";")[0]
                            : "";

                    if (contentType === "multipart/form-data") {
                        const newData = await http.postFormData(
                            url,
                            ctx.jar,
                            data.request.formData,
                            data.request.qs,
                            ctx.globalOptions,
                            ctx
                        );
                        return await parseAndCheckLogin(ctx, http, retryCount + 1)(newData);
                    } else {
                        const newData = await http.post(
                            url,
                            ctx.jar,
                            data.request.form,
                            ctx.globalOptions,
                            ctx
                        );
                        return await parseAndCheckLogin(ctx, http, retryCount + 1)(newData);
                    }
                }
            }
            
            // If refresh failed or max retries exceeded, throw descriptive error
            const err = new Error(`Error 1357004: ${res.errorSummary || "Session expired"}`);
            err.error = res.errorDescription || "Please refresh your session tokens.";
            err.errorCode = 1357004;
            throw err;
        }

        return res;
    };
}

/**
 * Saves cookies from a response to the cookie jar.
 * @param {Object} jar - The cookie jar instance.
 * @returns {function(res: Object): Object} A function that processes the response and returns it.
 */
function saveCookies(jar) {
    return function (res) {
        const cookies = res.headers["set-cookie"] || [];
        cookies.forEach(function (c) {
            if (c.indexOf(".facebook.com") > -1) {
                jar.setCookie(c, "https://www.facebook.com");
            }
            const c2 = c.replace(/domain=\.facebook\.com/, "domain=.messenger.com");
            jar.setCookie(c2, "https://www.messenger.com");
        });
        return res;
    };
}

/**
 * Retrieves an access token from a business account page.
 * @param {Object} jar - The cookie jar instance.
 * @param {Object} Options - Global request options.
 * @returns {function(res: Object): Promise<[string, string|null]>}
 */
function getAccessFromBusiness(jar, Options) {
    return async function (res) {
        const html = res ? res.body : null;
        const { get } = require("./request");
        try {
            const businessRes = await get(
                "https://business.facebook.com/content_management",
                jar,
                null,
                Options,
                null,
                { noRef: true }
            );
            const token = /"accessToken":"([^.]+)","clientID":/g.exec(businessRes.body)[1];
            return [html, token];
        } catch (_e) {
            return null;
        }
    };
}

/**
 * Retrieves all cookies from the jar for both Facebook and Messenger domains.
 * @param {Object} jar - The cookie jar instance.
 * @returns {Array<Object>} An array of cookie objects.
 */
function getAppState(jar) {
    return jar
        .getCookiesSync("https://www.facebook.com")
        .concat(jar.getCookiesSync("https://www.messenger.com"));
}

// ═══════════════════════════════════════════════════════════════════════════════
// DTSG AUTO-REFRESH FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Updates the DTSG refresh state for a context
 * @param {Object} ctx - The application context
 */
function updateDtsgRefreshState(ctx) {
    if (!ctx) return;
    dtsgRefreshState.set(ctx, {
        lastRefresh: Date.now(),
        isRefreshing: false,
        refreshCount: (dtsgRefreshState.get(ctx)?.refreshCount || 0) + 1
    });
}

/**
 * Gets the DTSG refresh state for a context
 * @param {Object} ctx - The application context
 * @returns {Object} The refresh state
 */
function getDtsgRefreshState(ctx) {
    if (!ctx) return { lastRefresh: 0, isRefreshing: false, refreshCount: 0 };
    return dtsgRefreshState.get(ctx) || { lastRefresh: 0, isRefreshing: false, refreshCount: 0 };
}

/**
 * Checks if DTSG token needs refresh based on time
 * @param {Object} ctx - The application context
 * @returns {boolean} Whether refresh is needed
 */
function needsDtsgRefresh(ctx) {
    const state = getDtsgRefreshState(ctx);
    const timeSinceLastRefresh = Date.now() - state.lastRefresh;
    return timeSinceLastRefresh > DTSG_REFRESH_INTERVAL;
}

/**
 * Refreshes the DTSG token by fetching a fresh page from Facebook
 * This is the core auto-refresh mechanism for long-running sessions
 * 
 * @param {Object} ctx - The application context
 * @param {Object} http - The HTTP request functions (optional, will use network module if not provided)
 * @returns {Promise<boolean>} Whether refresh was successful
 */
async function refreshDtsgToken(ctx, http) {
    const debug = require("./debug");
    
    if (!ctx || !ctx.jar) {
        debug.error("DTSG", "Cannot refresh: Invalid context or missing cookie jar");
        return false;
    }

    const state = getDtsgRefreshState(ctx);
    
    // Prevent concurrent refreshes
    if (state.isRefreshing) {
        debug.debug("DTSG", "Refresh already in progress, waiting...");
        // Wait for ongoing refresh to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        return ctx.fb_dtsg ? true : false;
    }

    // Rate limit refreshes
    const timeSinceLastRefresh = Date.now() - state.lastRefresh;
    if (timeSinceLastRefresh < MIN_REFRESH_INTERVAL && state.lastRefresh > 0) {
        debug.debug("DTSG", `Refresh rate limited. Last refresh was ${Math.round(timeSinceLastRefresh / 1000)}s ago`);
        return false;
    }

    // Mark as refreshing
    dtsgRefreshState.set(ctx, { ...state, isRefreshing: true });

    try {
        console.log("[DTSG] 🔄 Initiating DTSG token refresh...");

        // Use provided http or fall back to network module
        const network = http || require("./network");
        
        // Fetch fresh Facebook page to get new DTSG token
        const response = await network.get(
            "https://www.facebook.com/",
            ctx.jar,
            null,
            ctx.globalOptions || {},
            ctx,
            { noRef: true }
        );

        if (!response || !response.body) {
            debug.error("DTSG", "Failed to fetch Facebook page for token refresh");
            return false;
        }

        const html = response.body;

        // Method 1: Extract DTSG from script tags (preferred)
        let newDtsg = null;
        let newJazoest = null;

        // Try to find DTSG in JSON script blocks
        const scriptRegex = /<script type="application\/json"[^>]*>(.*?)<\/script>/gs;
        let match;
        
        while ((match = scriptRegex.exec(html)) !== null) {
            try {
                const jsonData = JSON.parse(match[1]);
                const dtsgToken = findDtsgInObject(jsonData);
                if (dtsgToken) {
                    newDtsg = dtsgToken;
                    break;
                }
            } catch (_e) {
                // Continue to next script block
            }
        }

        // Method 2: Regex fallback for DTSG token - multiple patterns
        if (!newDtsg) {
            const patterns = [
                /"token":"([^"]+)"/,
                /\["DTSGInitialData",\[\],\{"token":"([^"]+)"/,
                /"DTSGInitialData":\{"token":"([^"]+)"/,
                /name="fb_dtsg"\s*value="([^"]+)"/,
                /\{"name":"fb_dtsg","value":"([^"]+)"/,
                /"fb_dtsg":"([^"]+)"/,
                /fb_dtsg=([^&"]+)/,
                /__spin_r":(\d+),"__spin_b":"([^"]+)","__spin_t":\d+,"fb_dtsg":"([^"]+)"/,
            ];
            
            for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match) {
                    // Get the last capture group (token is usually in last group)
                    newDtsg = match[match.length - 1];
                    if (newDtsg && newDtsg.length > 10) break;
                    newDtsg = null;
                }
            }
        }

        // Method 3: Try DTSGInitialData pattern with broader matching
        if (!newDtsg) {
            const dtsgInitMatch = html.match(/DTSGInitialData[^}]*token['":\s]+['"]([^'"]+)['"]/);
            if (dtsgInitMatch && dtsgInitMatch[1]) {
                newDtsg = dtsgInitMatch[1];
            }
        }

        // Method 4: Try searching in __comet_req patterns
        if (!newDtsg) {
            const cometMatch = html.match(/__comet_req=\d+.*?dtsg.*?token.*?([A-Za-z0-9_-]{20,})/);
            if (cometMatch && cometMatch[1]) {
                newDtsg = cometMatch[1];
            }
        }

        // Method 5: Try extracting from inline scripts with require pattern
        if (!newDtsg) {
            const requireMatch = html.match(/require\s*\(\s*["']DTSGInitialData["']\s*\)\s*\.token\s*=\s*["']([^"']+)["']/);
            if (requireMatch && requireMatch[1]) {
                newDtsg = requireMatch[1];
            }
        }

        // Method 6: Look for token in data-btmanifest or similar data attributes  
        if (!newDtsg) {
            const dataMatch = html.match(/data-[^=]*=["'][^"']*token["':\s]+["']?([A-Za-z0-9:_-]{20,})["']?/i);
            if (dataMatch && dataMatch[1]) {
                newDtsg = dataMatch[1];
            }
        }

        if (!newDtsg) {
            // Not critical - the existing token might still be valid
            debug.warn("DTSG", "Could not extract new DTSG token from page (Facebook may have changed their structure)");
            debug.debug("DTSG", "Continuing with existing token - most features should still work");
            return false;
        }

        // Calculate new jazoest
        newJazoest = "2" + Array.from(newDtsg).reduce((sum, char) => sum + char.charCodeAt(0), 0);

        // Update context with new tokens
        const oldDtsg = ctx.fb_dtsg;
        ctx.fb_dtsg = newDtsg;
        ctx.jazoest = newJazoest;
        ctx.ttstamp = newJazoest; // ttstamp is same format as jazoest

        // Update refresh state
        updateDtsgRefreshState(ctx);

        // Also save any new cookies that came with the response
        if (response.headers && response.headers["set-cookie"]) {
            saveCookies(ctx.jar)(response);
        }

        console.log(`[DTSG] ✅ Token refreshed successfully (${oldDtsg?.substring(0, 10)}... → ${newDtsg.substring(0, 10)}...)`);
        debug.debug("DTSG", `New jazoest: ${newJazoest}`);
        
        return true;

    } catch (error) {
        debug.error("DTSG", `Token refresh failed: ${error.message}`);
        return false;
    } finally {
        // Clear refreshing flag
        const currentState = getDtsgRefreshState(ctx);
        dtsgRefreshState.set(ctx, { ...currentState, isRefreshing: false });
    }
}

/**
 * Recursively searches an object for DTSG token
 * @param {*} obj - Object to search
 * @param {number} depth - Current recursion depth
 * @returns {string|null} DTSG token if found
 */
function findDtsgInObject(obj, depth = 0) {
    if (depth > 15) return null; // Prevent infinite recursion
    if (!obj || typeof obj !== "object") return null;

    // Direct token property - validate it looks like a DTSG token
    if (obj.token && typeof obj.token === "string" && obj.token.length > 10 && /^[A-Za-z0-9:_-]+$/.test(obj.token)) {
        return obj.token;
    }

    // Check for DTSGInitialData pattern
    if (obj.DTSGInitialData && obj.DTSGInitialData.token) {
        return obj.DTSGInitialData.token;
    }

    // Check for fb_dtsg direct property
    if (obj.fb_dtsg && typeof obj.fb_dtsg === "string" && obj.fb_dtsg.length > 10) {
        return obj.fb_dtsg;
    }

    // Check for require arrays (Facebook's module system)
    if (Array.isArray(obj)) {
        for (const item of obj) {
            // Pattern: ["DTSGInitialData", [], {"token": "..."}]
            if (Array.isArray(item) && item[0] === "DTSGInitialData") {
                if (item[2]?.token) return item[2].token;
                if (item[3]?.token) return item[3].token;
            }
            // Pattern: ["DTSG", "setToken", [], ["token_value"]]
            if (Array.isArray(item) && item[0] === "DTSG" && item[1] === "setToken") {
                if (Array.isArray(item[3]) && item[3][0]) return item[3][0];
            }
            const found = findDtsgInObject(item, depth + 1);
            if (found) return found;
        }
    }

    // Recurse into object properties
    for (const key of Object.keys(obj)) {
        // Skip large arrays and known non-token keys for performance
        if (key === "styles" || key === "css" || key === "html" || key === "text") continue;
        const found = findDtsgInObject(obj[key], depth + 1);
        if (found) return found;
    }

    return null;
}

/**
 * Starts automatic DTSG refresh interval for a context
 * Call this after successful login to keep the session alive
 * 
 * @param {Object} ctx - The application context
 * @param {Object} http - The HTTP request functions
 * @param {number} [intervalMs] - Custom interval in milliseconds (default: 1 hour)
 * @returns {Function} Function to stop the auto-refresh
 */
function startDtsgAutoRefresh(ctx, http, intervalMs = DTSG_REFRESH_INTERVAL) {
    const debug = require("./debug");
    
    if (!ctx) {
        console.error("[DTSG] Cannot start auto-refresh: Invalid context");
        return () => {};
    }

    // Clear any existing interval
    if (ctx._dtsgRefreshInterval) {
        clearInterval(ctx._dtsgRefreshInterval);
    }

    console.log(`[DTSG] 🕐 Auto-refresh enabled - Refreshing every ${Math.round(intervalMs / 60000)} minutes`);

    // Initial state
    updateDtsgRefreshState(ctx);

    // Set up periodic refresh
    ctx._dtsgRefreshInterval = setInterval(async () => {
        debug.debug("DTSG", "Scheduled auto-refresh triggered");
        await refreshDtsgToken(ctx, http);
    }, intervalMs);

    // Return cleanup function
    return () => {
        if (ctx._dtsgRefreshInterval) {
            clearInterval(ctx._dtsgRefreshInterval);
            ctx._dtsgRefreshInterval = null;
            console.log("[DTSG] Auto-refresh stopped");
        }
    };
}

/**
 * Stops automatic DTSG refresh for a context
 * @param {Object} ctx - The application context
 */
function stopDtsgAutoRefresh(ctx) {
    if (ctx && ctx._dtsgRefreshInterval) {
        clearInterval(ctx._dtsgRefreshInterval);
        ctx._dtsgRefreshInterval = null;
    }
}

module.exports = {
    parseAndCheckLogin,
    saveCookies,
    getAccessFromBusiness,
    getAppState,
    // DTSG Auto-Refresh exports
    refreshDtsgToken,
    startDtsgAutoRefresh,
    stopDtsgAutoRefresh,
    needsDtsgRefresh,
    getDtsgRefreshState,
    DTSG_REFRESH_INTERVAL,
};
