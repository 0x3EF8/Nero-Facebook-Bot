/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                          ANTI-LEAVE EVENT HANDLER                             ║
 * ║          Automatically re-adds users who leave the group chat                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 * 
 * This event handler automatically re-adds users who leave the group,
 * unless they were kicked by an admin.
 * 
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

/**
 * Event configuration
 */
module.exports.config = {
    name: "antiLeave",
    description: "Automatically re-adds users who leave the group",
    eventTypes: ["event"],
    priority: 15, // Higher priority than welcome
    enabled: false,
};

/**
 * Store for recently re-added users to prevent loops
 * @type {Map<string, number>}
 */
const recentlyReadded = new Map();

/**
 * Cooldown time before same user can be re-added again (5 minutes)
 */
const READD_COOLDOWN = 5 * 60 * 1000;

/**
 * Clean up old entries from the map
 */
function cleanupOldEntries() {
    const now = Date.now();
    for (const [key, timestamp] of recentlyReadded.entries()) {
        if (now - timestamp > READD_COOLDOWN) {
            recentlyReadded.delete(key);
        }
    }
}

/**
 * Event execution function
 * @param {Object} context - Event context
 */
module.exports.execute = async function({ api, event, config, logger }) {
    // Check if anti-leave is enabled in settings
    if (!config.features.antiLeave) {
        return;
    }
    
    // Debug: Log all event types we receive
    if (event.logMessageType) {
        logger.debug("AntiLeave", `Received event type: ${event.type}, logMessageType: ${event.logMessageType}`);
    }
    
    // Only handle participant removal events (user left)
    if (event.logMessageType !== "log:unsubscribe") {
        return;
    }
    
    logger.info("AntiLeave", `User leave detected in thread ${event.threadID}`);
    
    const threadID = event.threadID;
    const leftParticipantFbId = event.logMessageData?.leftParticipantFbId;
    
    if (!leftParticipantFbId) {
        return;
    }
    
    // Get bot's user ID
    const botID = api.getCurrentUserID ? api.getCurrentUserID() : null;
    
    // Don't re-add the bot itself
    if (leftParticipantFbId === botID) {
        return;
    }
    
    // Don't re-add admins or superAdmins - let them leave freely
    if (config.isAdmin(leftParticipantFbId)) {
        logger.debug("AntiLeave", `Admin ${leftParticipantFbId} left, not re-adding`);
        return;
    }
    
    // Check if user was kicked by admin (author is different from left user)
    const authorID = event.author;
    const wasKicked = authorID && authorID !== leftParticipantFbId;
    
    // If user was kicked by an admin, don't re-add them
    if (wasKicked && config.isAdmin(authorID)) {
        logger.debug("AntiLeave", `User ${leftParticipantFbId} was kicked by admin ${authorID}, not re-adding`);
        return;
    }
    
    // Check cooldown to prevent re-add loops
    const key = `${threadID}-${leftParticipantFbId}`;
    const lastReadd = recentlyReadded.get(key);
    
    if (lastReadd && Date.now() - lastReadd < READD_COOLDOWN) {
        logger.debug("AntiLeave", `User ${leftParticipantFbId} recently re-added, skipping`);
        return;
    }
    
    // Clean up old entries periodically
    cleanupOldEntries();
    
    try {
        // Get user info for the message
        const userInfo = await new Promise((resolve) => {
            api.getUserInfo([leftParticipantFbId], (err, info) => {
                if (err || !info) {
                    resolve(null);
                } else {
                    resolve(info[leftParticipantFbId]);
                }
            });
        });
        
        const userName = userInfo?.name || "User";
        
        // Re-add the user to the group using gcmember API
        const result = await api.gcmember("add", leftParticipantFbId, threadID);
        
        // Check if there was an error
        if (result && result.type === "error_gc") {
            logger.debug("AntiLeave", `Failed to re-add ${userName}: ${result.error}`);
            recentlyReadded.set(key, Date.now());
            return;
        }
        
        // Mark as recently re-added
        recentlyReadded.set(key, Date.now());
        
        // Send message
        const message = `🚫 Anti-Leave\n\n${userName} tried to leave but was automatically re-added.\n\nYou can't escape that easily! 😄`;
        
        api.sendMessage(message, threadID);
        
        logger.info("AntiLeave", `Re-added ${userName} (${leftParticipantFbId}) to thread ${threadID}`);
        
    } catch (error) {
        // Common errors: user blocked bot, privacy settings, etc.
        logger.debug("AntiLeave", `Failed to re-add user ${leftParticipantFbId}: ${error.message}`);
        
        // Still mark as attempted to prevent spam retries
        recentlyReadded.set(key, Date.now());
    }
};
