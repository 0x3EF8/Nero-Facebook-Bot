/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                        USER MANAGEMENT MODULE                                 ║
 * ║            Handles user name resolution and caching                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module core/users
 * @author 0x3EF8
 * @version 2.0.0
 *
 * Features:
 * - Multi-strategy name resolution (event, cache, API, thread info)
 * - LRU cache with configurable size limit
 * - Batch member retrieval for group chats
 * - Graceful fallbacks for API failures
 */

"use strict";

const { NAME_CACHE_CONFIG, DEBUG } = require("./constants");

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL LOGGER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Internal logger for Users module
 * @private
 */
const log = {
    warn: (msg) => DEBUG && console.warn(`[Users] ⚠ ${msg}`),
};

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE STORAGE
// ═══════════════════════════════════════════════════════════════════════════════

/** @type {Map<string, string>} senderID -> displayName */
const nameCache = new Map();

/** @type {string[]} LRU access order for cache eviction */
const cacheAccessOrder = [];

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Add name to cache with LRU eviction
 * @param {string} senderID - User's ID
 * @param {string} name - User's display name
 * @private
 */
function cacheSet(senderID, name) {
    // Update LRU order
    const index = cacheAccessOrder.indexOf(senderID);
    if (index > -1) {
        cacheAccessOrder.splice(index, 1);
    }
    cacheAccessOrder.push(senderID);

    // Evict oldest if over limit
    while (cacheAccessOrder.length > NAME_CACHE_CONFIG.maxSize) {
        const oldestID = cacheAccessOrder.shift();
        if (oldestID) {
            nameCache.delete(oldestID);
        }
    }

    nameCache.set(senderID, name);
}

/**
 * Get name from cache and update LRU order
 * @param {string} senderID - User's ID
 * @returns {string|undefined} Cached name or undefined
 * @private
 */
function cacheGet(senderID) {
    if (nameCache.has(senderID)) {
        // Update LRU order on access
        const index = cacheAccessOrder.indexOf(senderID);
        if (index > -1) {
            cacheAccessOrder.splice(index, 1);
            cacheAccessOrder.push(senderID);
        }
        return nameCache.get(senderID);
    }
    return undefined;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NAME RESOLUTION STRATEGIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Try to get name from event object
 * @param {Object} event - Message event
 * @returns {string|null} Name or null
 * @private
 */
function tryEventName(event) {
    if (!event) return null;
    return event.senderName || event.sender_fullname || event.name || null;
}

/**
 * Try to get name from API getUserInfo
 * @param {Object} api - Facebook API
 * @param {string} senderID - User's ID
 * @returns {Promise<string|null>} Name or null
 * @private
 */
async function tryApiGetUserInfo(api, senderID) {
    if (typeof api.getUserInfo !== "function") return null;

    try {
        // Try array format first, then single ID
        let info = null;
        try {
            info = await api.getUserInfo([senderID]);
        } catch {
            info = await api.getUserInfo(senderID);
        }

        if (!info) return null;

        // Parse array format
        if (Array.isArray(info) && info.length > 0) {
            const entry =
                info.find((e) => e.id === senderID || e.userID === senderID) || info[0];
            return entry?.name || entry?.fullName || entry?.username || entry?.displayName || null;
        }

        // Parse object format
        if (typeof info === "object") {
            if (info[senderID]) {
                const entry = info[senderID];
                return entry?.name || entry?.fullName || entry?.displayName || entry?.username || null;
            }
            return info.name || info.fullName || info.displayName || info.username || null;
        }
    } catch (err) {
        log.warn(`getUserInfo failed: ${err.message || err}`);
    }

    return null;
}

/**
 * Try to get name from thread participant list
 * @param {Object} api - Facebook API
 * @param {string} senderID - User's ID
 * @param {string} threadID - Thread ID
 * @returns {Promise<string|null>} Name or null
 * @private
 */
async function tryThreadParticipants(api, senderID, threadID) {
    if (typeof api.getThreadInfo !== "function" || !threadID) return null;

    try {
        const tinfo = await api.getThreadInfo(threadID);
        if (!tinfo) return null;

        // Check participants array
        if (Array.isArray(tinfo.participants)) {
            const p = tinfo.participants.find(
                (p) =>
                    String(p.id || p.userID) === String(senderID) ||
                    String(p.fbId) === String(senderID)
            );
            if (p?.name || p?.fullName || p?.displayName) {
                return p.name || p.fullName || p.displayName;
            }
        }

        // Check userInfo object
        if (typeof tinfo.userInfo === "object") {
            const entry =
                tinfo.userInfo[senderID] ||
                Object.values(tinfo.userInfo).find((x) => x.id === senderID);
            if (entry?.name || entry?.fullName || entry?.displayName) {
                return entry.name || entry.fullName || entry.displayName;
            }
        }
    } catch {
        // Silent fail - this is a fallback strategy
    }

    return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Robust user name resolver with multiple fallback strategies
 *
 * Resolution order:
 * 1. Event object (immediate)
 * 2. Name cache (LRU)
 * 3. API getUserInfo
 * 4. Thread participant list
 * 5. User ID as fallback
 *
 * @param {Object} api - Facebook API instance
 * @param {string} senderID - User's Facebook ID
 * @param {Object} [event] - Message event object
 * @returns {Promise<string>} User's display name
 */
async function getName(api, senderID, event) {
    // Strategy 1: Check event object for immediate name
    const eventName = tryEventName(event);
    if (eventName) {
        cacheSet(senderID, eventName);
        return eventName;
    }

    // Strategy 2: Check cache
    const cachedName = cacheGet(senderID);
    if (cachedName) {
        return cachedName;
    }

    // Strategy 3: Query API
    const apiName = await tryApiGetUserInfo(api, senderID);
    if (apiName) {
        cacheSet(senderID, apiName);
        return apiName;
    }

    // Strategy 4: Try thread participant list
    const threadName = await tryThreadParticipants(api, senderID, event?.threadID);
    if (threadName) {
        cacheSet(senderID, threadName);
        return threadName;
    }

    // Strategy 5: Use senderID as last resort
    const fallback = String(senderID);
    cacheSet(senderID, fallback);
    return fallback;
}

/**
 * Validate if a string is a valid Facebook user ID
 * @param {string} id - ID to validate
 * @returns {boolean} True if valid
 * @private
 */
function isValidUserID(id) {
    return id && id !== "undefined" && id.length > 5 && /^\d+$/.test(id);
}

/**
 * Get all members in a group chat
 * @param {Object} api - Facebook API instance
 * @param {string} threadID - Thread identifier
 * @returns {Promise<Map<string, string>>} Map of userID -> userName
 */
async function getAllGroupMembers(api, threadID) {
    const members = new Map();

    if (typeof api.getThreadInfo !== "function") {
        return members;
    }

    try {
        const threadInfo = await api.getThreadInfo(threadID);
        if (!threadInfo) return members;

        // Strategy 1: userInfo as array
        if (Array.isArray(threadInfo.userInfo)) {
            for (const user of threadInfo.userInfo) {
                const userID = String(user.id || user.userID);
                const userName = user.name || user.fullName || user.firstName || userID;

                if (isValidUserID(userID)) {
                    members.set(userID, userName);
                    cacheSet(userID, userName);
                }
            }
        }

        // Strategy 2: userInfo as object
        if (typeof threadInfo.userInfo === "object" && !Array.isArray(threadInfo.userInfo)) {
            for (const [uid, info] of Object.entries(threadInfo.userInfo)) {
                const userName = info.name || info.fullName || info.displayName || uid;

                if (isValidUserID(uid)) {
                    members.set(uid, userName);
                    cacheSet(uid, userName);
                }
            }
        }

        // Strategy 3: Deprecated participants array (fallback)
        if (Array.isArray(threadInfo.participants)) {
            for (const participant of threadInfo.participants) {
                const userID = String(participant.id || participant.userID || participant.fbId);
                const userName =
                    participant.name || participant.fullName || participant.displayName || userID;

                if (isValidUserID(userID) && !members.has(userID)) {
                    members.set(userID, userName);
                    cacheSet(userID, userName);
                }
            }
        }
    } catch (err) {
        log.warn(`Failed to get group members: ${err.message || err}`);
    }

    return members;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    users: {
        getName,
        getAllGroupMembers,
    },
};
