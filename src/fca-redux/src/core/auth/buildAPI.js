/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                         NERO - API Builder                                   ║
 * ║                    Context & Function Registry Setup                          ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module core/auth/buildAPI
 * @author 0x3EF8
 * @version 2.0.0
 */

"use strict";

const utils = require("../../lib/utils");

/**
 * Searches for configuration data in parsed script blocks
 * @param {Array} netData - Array of parsed JSON data
 * @param {string} key - Configuration key to find
 * @returns {*} Configuration value or null
 */
function findConfig(netData, key) {
    for (const scriptData of netData) {
        if (!scriptData.require) continue;

        for (const req of scriptData.require) {
            if (!Array.isArray(req)) continue;

            // Direct match
            if (req[0] === key && req[2]) {
                return req[2];
            }

            // Nested in __bbox.define
            if (req[3]?.[0]?.__bbox?.define) {
                for (const def of req[3][0].__bbox.define) {
                    if (Array.isArray(def) && def[0]?.endsWith(key) && def[2]) {
                        return def[2];
                    }
                }
            }
        }
    }
    return null;
}

/**
 * Extracts user ID from cookies
 * @param {Object} jar - Cookie jar
 * @param {Function} fbLinkFunc - Function to generate FB URLs
 * @param {string} errorMsg - Error message if extraction fails
 * @returns {string} User ID
 */
function extractUserID(jar, fbLinkFunc, errorMsg) {
    const cookies = jar.getCookiesSync(fbLinkFunc());
    const primaryProfile = cookies.find((val) => val.cookieString().startsWith("c_user="));
    const secondaryProfile = cookies.find((val) => val.cookieString().startsWith("i_user="));

    if (!primaryProfile && !secondaryProfile) {
        throw new Error(errorMsg);
    }

    return (
        secondaryProfile?.cookieString().split("=")[1] ||
        primaryProfile.cookieString().split("=")[1]
    );
}

/**
 * Builds the core API context and default functions after successful login.
 *
 * @param {string} html - HTML body from the initial Facebook page
 * @param {Object} jar - Cookie jar
 * @param {Array} netData - Network data extracted from HTML
 * @param {Object} globalOptions - Global options object
 * @param {Function} fbLinkFunc - Function to generate Facebook links
 * @param {string} errorRetrievingMsg - Error message for user ID retrieval
 * @returns {Promise<Array>} [ctx, defaultFuncs, {}]
 */
async function buildAPI(html, jar, netData, globalOptions, fbLinkFunc, errorRetrievingMsg) {
    utils.debug("VALIDATING SESSION & EXTRACTING USER CREDENTIALS...");

    // Extract user ID
    const userID = extractUserID(jar, fbLinkFunc, errorRetrievingMsg);
    utils.info(`USER ID ACQUIRED → ${userID}`);

    // Extract DTSG token
    utils.debug("EXTRACTING DTSG SECURITY TOKENS FROM PAGE DATA...");
    const dtsgData = findConfig(netData, "DTSGInitialData");
    const dtsg = dtsgData?.token || utils.getFrom(html, '"token":"', '"');

    if (!dtsg) {
        throw new Error("Failed to extract DTSG token. The appstate may be invalid or expired.");
    }

    const dtsgResult = {
        fb_dtsg: dtsg,
        jazoest: `2${Array.from(dtsg).reduce((a, b) => a + b.charCodeAt(0), "")}`,
    };
    utils.debug(`DTSG TOKEN ACQUIRED → ${dtsg.substring(0, 20)}...`);

    // Configure MQTT parameters
    utils.debug("CONFIGURING MQTT REALTIME PROTOCOL PARAMETERS...");

    const clientIDData = findConfig(netData, "MqttWebDeviceID");
    const clientID = clientIDData?.clientID;

    const mqttConfigData = findConfig(netData, "MqttWebConfig");
    const mqttAppID = mqttConfigData?.appID;

    const currentUserData = findConfig(netData, "CurrentUserInitialData");
    const userAppID = currentUserData?.APP_ID;

    const primaryAppID = userAppID || mqttAppID;
    utils.info(`APP ID CONFIGURED → ${primaryAppID}`);

    let mqttEndpoint = mqttConfigData?.endpoint;
    let region = mqttEndpoint
        ? new URL(mqttEndpoint).searchParams.get("region")?.toUpperCase()
        : undefined;

    // Handle region bypass
    if (globalOptions.bypassRegion && mqttEndpoint) {
        const currentEndpoint = new URL(mqttEndpoint);
        currentEndpoint.searchParams.set("region", globalOptions.bypassRegion.toLowerCase());
        mqttEndpoint = currentEndpoint.toString();
        region = globalOptions.bypassRegion.toUpperCase();
    }

    // Extract sequence ID for MQTT
    const irisSeqIDMatch = html.match(/irisSeqID:"(.+?)"/);
    const irisSeqID = irisSeqIDMatch ? irisSeqIDMatch[1] : null;

    // Build context object
    const ctx = {
        userID,
        jar,
        clientID,
        appID: primaryAppID,
        mqttAppID,
        userAppID,
        globalOptions,
        loggedIn: true,
        access_token: "NONE",
        clientMutationId: 0,
        mqttClient: undefined,
        lastSeqId: irisSeqID,
        syncToken: undefined,
        mqttEndpoint,
        wsReqNumber: 0,
        wsTaskNumber: 0,
        reqCallbacks: {},
        callback_Task: {},
        region,
        firstListen: true,
        ...dtsgResult,
    };

    // Build default functions
    const defaultFuncs = utils.makeDefaults(html, userID, ctx);

    return [ctx, defaultFuncs, {}];
}

module.exports = buildAPI;
