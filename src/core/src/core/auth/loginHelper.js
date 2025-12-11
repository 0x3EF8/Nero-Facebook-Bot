/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                         NERO - Login Helper                                  ║
 * ║                    Authentication Flow Orchestration                          ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module core/auth/loginHelper
 * @author 0x3EF8
 * @version 2.0.0
 */

"use strict";

const utils = require("../../lib/utils");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const qs = require("querystring");

/**
 * Processes appState and loads cookies into the jar
 * @param {Object|Array|string} appState - Session cookies
 * @param {Object} jar - Cookie jar
 */
function loadAppState(appState, jar) {
    let cookieStrings = [];

    if (Array.isArray(appState)) {
        cookieStrings = appState.map((c) => [c.name || c.key, c.value].join("="));
    } else if (typeof appState === "string") {
        cookieStrings = appState
            .split(";")
            .map((s) => s.trim())
            .filter(Boolean);
    } else {
        throw new Error(
            "Invalid appState format. Please provide an array of cookie objects or a cookie string."
        );
    }

    utils.debug(`INJECTING ${cookieStrings.length} SESSION TOKENS INTO COOKIE JAR...`);
    utils.logAuth(`Injecting ${cookieStrings.length} session tokens`);

    for (const cookieString of cookieStrings) {
        const domain = ".facebook.com";
        const expires = new Date().getTime() + 1000 * 60 * 60 * 24 * 365;
        const str = `${cookieString}; expires=${expires}; domain=${domain}; path=/;`;
        jar.setCookie(str, `https://${domain}`);
    }

    utils.success("SESSION AUTHENTICATION TOKENS INJECTED SUCCESSFULLY");
    utils.logAuth("Session tokens loaded", true);
}

/**
 * Handles email/password login via API
 * @param {Object} credentials - Login credentials
 * @param {Object} jar - Cookie jar
 */
async function loginWithCredentials(credentials, jar) {
    const url = "https://api.facebook.com/method/auth.login";
    const params = {
        access_token: "350685531728|62f8ce9f74b12f84c123cc23437a4a32",
        format: "json",
        sdk_version: 2,
        email: credentials.email,
        locale: "en_US",
        password: credentials.password,
        generate_session_cookies: 1,
        sig: "c1c640010993db92e5afd11634ced864",
    };

    const query = qs.stringify(params);
    const xurl = `${url}?${query}`;

    try {
        const resp = await axios.get(xurl);
        if (resp.status !== 200) {
            throw new Error("Wrong password / email");
        }

        const cstrs = resp.data["session_cookies"].map((c) => `${c.name}=${c.value}`);
        cstrs.forEach((cstr) => {
            const domain = ".facebook.com";
            const expires = new Date().getTime() + 1000 * 60 * 60 * 24 * 365;
            const str = `${cstr}; expires=${expires}; domain=${domain}; path=/;`;
            jar.setCookie(str, `https://${domain}`);
        });
    } catch (e) {
        throw new Error("Wrong password / email");
    }
}

/**
 * Extracts JSON data from script tags in HTML
 * @param {string} html - HTML content
 * @returns {Array} Parsed JSON data
 */
function extractNetData(html) {
    const allScriptsData = [];
    const scriptRegex = /<script type="application\/json"[^>]*>(.*?)<\/script>/g;
    let match;

    while ((match = scriptRegex.exec(html)) !== null) {
        try {
            allScriptsData.push(JSON.parse(match[1]));
        } catch (e) {
            utils.error("SCRIPT PARSE ERROR IN HTML EXTRACTION", e.message);
        }
    }

    return allScriptsData;
}

/**
 * Loads all API modules from the api directory
 * @param {Object} api - API object to extend
 * @param {Object} defaultFuncs - Default functions
 * @param {Object} ctx - Context object
 */
function loadApiModules(api, defaultFuncs, ctx) {
    const apiPath = path.join(__dirname, "..", "..", "api");

    if (!fs.existsSync(apiPath)) {
        utils.warn("API path not found:", apiPath);
        return;
    }

    const apiFolders = fs
        .readdirSync(apiPath)
        .filter((name) => fs.lstatSync(path.join(apiPath, name)).isDirectory());

    apiFolders.forEach((folder) => {
        const modulePath = path.join(apiPath, folder);

        fs.readdirSync(modulePath)
            .filter((file) => file.endsWith(".js"))
            .forEach((file) => {
                const moduleName = path.basename(file, ".js");
                const fullPath = path.join(modulePath, file);

                try {
                    // Clear require cache for fresh instance per account
                    delete require.cache[require.resolve(fullPath)];
                    api[moduleName] = require(fullPath)(defaultFuncs, api, ctx);
                } catch (e) {
                    utils.error(`Failed to load module ${moduleName} from ${folder}:`, e);
                }
            });
    });

    // Load MQTT listener separately
    const listenPath = path.join(apiPath, "mqtt", "listenMqtt.js");
    const realtimePath = path.join(apiPath, "mqtt", "realtime.js");

    if (fs.existsSync(realtimePath)) {
        delete require.cache[require.resolve(realtimePath)];
        api["realtime"] = require(realtimePath)(defaultFuncs, api, ctx);
    }

    if (fs.existsSync(listenPath)) {
        delete require.cache[require.resolve(listenPath)];
        api["listenMqtt"] = require(listenPath)(defaultFuncs, api, ctx);
    }
}

/**
 * Main login helper function - orchestrates the login process
 *
 * @param {Object} credentials - User credentials or appState
 * @param {Object} globalOptions - Global options for the API
 * @param {Function} callback - Final callback function
 * @param {Function} setOptionsFunc - Reference to setOptions function
 * @param {Function} buildAPIFunc - Reference to buildAPI function
 * @param {Object} initialApi - Initial API object to extend
 * @param {Function} fbLinkFunc - Function to generate Facebook links
 * @param {string} errorRetrievingMsg - Error message for user ID retrieval
 * @returns {Promise<void>}
 */
async function loginHelper(
    credentials,
    globalOptions,
    callback,
    setOptionsFunc,
    buildAPIFunc,
    initialApi,
    fbLinkFunc,
    errorRetrievingMsg
) {
    let ctx = null;
    let defaultFuncs = null;
    const api = initialApi;

    try {
        const jar = utils.getJar();

        utils.log("INITIATING NEURAL AUTH PROTOCOL...");
        utils.logAuth("Starting login process");

        // Handle authentication
        if (credentials.appState) {
            utils.info("LOADING SESSION CREDENTIALS FROM APPSTATE BUFFER...");
            loadAppState(credentials.appState, jar);
        } else if (credentials.email && credentials.password) {
            await loginWithCredentials(credentials, jar);
        } else {
            throw new Error(
                "No cookie or credentials found. Please provide cookies or credentials."
            );
        }

        // Setup base API methods
        api.setOptions = setOptionsFunc.bind(null, globalOptions);
        api.getAppState = function () {
            const appState = utils.getAppState(jar);
            if (!Array.isArray(appState)) return [];
            const uniqueAppState = appState.filter(
                (item, index, self) => self.findIndex((t) => t.key === item.key) === index
            );
            return uniqueAppState.length > 0 ? uniqueAppState : appState;
        };

        // Connect to Facebook
        utils.log("ESTABLISHING SECURE CONNECTION TO FACEBOOK SERVERS...");
        const resp = await utils
            .get(fbLinkFunc(), jar, null, globalOptions, { noRef: true })
            .then(utils.saveCookies(jar));

        utils.success("SECURE CONNECTION ESTABLISHED → facebook.com");

        // Parse page data
        utils.debug("PARSING PAGE METADATA & EXTRACTING SCRIPT BLOCKS...");
        const netData = extractNetData(resp.body);
        utils.debug(`DATA EXTRACTION COMPLETE → ${netData.length} BLOCKS CAPTURED`);

        // Build API context
        utils.log("COMPILING API CONTEXT & BUILDING FUNCTION REGISTRY...");
        const [newCtx, newDefaultFuncs] = await buildAPIFunc(
            resp.body,
            jar,
            netData,
            globalOptions,
            fbLinkFunc,
            errorRetrievingMsg
        );

        utils.success("API CONTEXT INITIALIZED → READY FOR OPERATIONS", true);

        ctx = newCtx;
        defaultFuncs = newDefaultFuncs;
        api.message = new Map();
        api.timestamp = {};

        // Core API methods
        api.getCurrentUserID = () => ctx.userID;
        api.getOptions = (key) => (key ? globalOptions[key] : globalOptions);

        // Debug API methods
        api.getDebugStats = () => utils.getStats();
        api.printDebugStats = () => utils.printStats();
        api.resetDebugStats = () => utils.resetStats();

        // Anti-Unsend: Get stored message by ID
        api.getStoredMessage = (messageID) => utils.messageStore.get(messageID);

        // Load all API modules
        loadApiModules(api, defaultFuncs, ctx);

        // Expose internals for advanced usage
        api.ctx = ctx;
        api.defaultFuncs = defaultFuncs;
        api.globalOptions = globalOptions;

        return callback(null, api);
    } catch (error) {
        utils.error("loginHelper", error.error || error);
        return callback(error);
    }
}

module.exports = loginHelper;
