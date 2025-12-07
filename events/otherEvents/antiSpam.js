/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                         ANTI-SPAM EVENT HANDLER                               ║
 * ║         Monitors and prevents spam/rapid message sending                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 * 
 * This event handler implements rate limiting to prevent users
 * from spamming commands or messages.
 * 
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

/**
 * Event configuration
 */
module.exports.config = {
    name: "antiSpam",
    description: "Prevents spam by rate limiting users",
    eventTypes: ["message"],
    priority: 100, // High priority - runs before other handlers
    enabled: true,
};

/**
 * User message tracking
 * @type {Map<string, {count: number, lastReset: number, warned: boolean}>}
 */
const userMessages = new Map();

/**
 * Penalty tracking
 * @type {Map<string, number>}
 */
const penalties = new Map();

/**
 * Cleanup interval reference
 * @type {NodeJS.Timeout|null}
 */
let cleanupInterval = null;

/**
 * Cleans up old entries to prevent memory leaks
 */
function cleanup() {
    const now = Date.now();
    const maxAge = 60000; // 1 minute
    
    for (const [key, data] of userMessages) {
        if (now - data.lastReset > maxAge) {
            userMessages.delete(key);
        }
    }
    
    for (const [key, expiry] of penalties) {
        if (now > expiry) {
            penalties.delete(key);
        }
    }
}

/**
 * Event execution function
 * @param {Object} context - Event context
 */
module.exports.execute = async function({ api, event, config, logger }) {
    // Check if anti-spam is enabled
    if (!config.features.antiSpam || !config.rateLimit.enabled) {
        return;
    }
    
    const userID = event.senderID;
    const threadID = event.threadID;
    const now = Date.now();
    
    // Skip admins
    if (config.isAdmin(userID)) {
        return;
    }
    
    // Check if user is in penalty
    const penaltyExpiry = penalties.get(userID);
    if (penaltyExpiry && now < penaltyExpiry) {
        // User is in penalty - silently ignore
        event.__blocked = true;
        return;
    }
    
    // Clear expired penalty
    if (penaltyExpiry && now >= penaltyExpiry) {
        penalties.delete(userID);
    }
    
    // Get or create user tracking data
    const windowMs = config.rateLimit.windowSeconds * 1000;
    let userData = userMessages.get(userID);
    
    if (!userData || now - userData.lastReset > windowMs) {
        userData = {
            count: 0,
            lastReset: now,
            warned: false,
        };
        userMessages.set(userID, userData);
    }
    
    // Increment message count
    userData.count++;
    
    // Check if over limit
    if (userData.count > config.rateLimit.maxMessages) {
        // Apply penalty
        const penaltyMs = config.rateLimit.penaltySeconds * 1000;
        penalties.set(userID, now + penaltyMs);
        
        // Send warning (only once per window)
        if (!userData.warned) {
            userData.warned = true;
            
            try {
                api.sendMessage(config.rateLimit.warningMessage, threadID);
                logger.warn("AntiSpam", `Rate limited user ${userID} in thread ${threadID}`);
            } catch (error) {
                logger.error("AntiSpam", `Failed to send warning: ${error.message}`);
            }
        }
        
        // Block the event from further processing
        event.__blocked = true;
    }
};

/**
 * Called when the event handler is loaded
 */
module.exports.onLoad = function() {
    // Start cleanup interval
    if (!cleanupInterval) {
        cleanupInterval = setInterval(cleanup, 60000);
    }
};

/**
 * Called when the event handler is unloaded
 */
module.exports.onUnload = function() {
    // Clear cleanup interval to prevent memory leak
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
    userMessages.clear();
    penalties.clear();
};
