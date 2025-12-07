/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                      TYPING INDICATOR EVENT                                   ║
 * ║              Logs when users start/stop typing (debug)                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 * 
 * This event handler logs typing indicators for debugging purposes.
 * Disabled by default as it can be very noisy.
 * 
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

/**
 * Event configuration
 */
module.exports.config = {
    name: "typingIndicator",
    description: "Logs typing indicators (debug)",
    eventTypes: ["typ"],
    priority: 1,
    enabled: false, // Disabled by default
};

/**
 * Event execution function
 * @param {Object} context - Event context
 */
module.exports.execute = async function({ api: _api, event, config: _config, logger }) {
    const userID = event.from;
    const threadID = event.threadID;
    const isTyping = event.isTyping;
    
    logger.debug("TypingIndicator", 
        `User ${userID} ${isTyping ? "started" : "stopped"} typing in thread ${threadID}`
    );
};
