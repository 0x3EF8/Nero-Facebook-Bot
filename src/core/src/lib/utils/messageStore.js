/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                         NERO - Message Store                                 ║
 * ║                    Built-in Anti-Unsend Support                               ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Automatically stores all messages for anti-unsend functionality.
 * Always enabled - no configuration needed.
 *
 * @module lib/utils/messageStore
 * @author 0x3EF8
 * @version 2.0.0
 */

"use strict";

/** Maximum messages to store */
const MAX_MESSAGES = 10000;

/** Message expiry: 24 hours */
const EXPIRY_TIME = 24 * 60 * 60 * 1000;

/** Cleanup interval: 1 hour */
const CLEANUP_INTERVAL = 60 * 60 * 1000;

/** Message storage */
const messages = new Map();

/**
 * Store a message (called automatically by Nero)
 * @param {Object} message - The formatted message object
 * @returns {boolean} Success status
 */
function store(message) {
    if (!message || !message.messageID) return false;

    const now = Date.now();

    // Remove old messages if limit reached
    if (messages.size >= MAX_MESSAGES) {
        const toRemove = Math.floor(MAX_MESSAGES * 0.1);
        const iterator = messages.keys();
        for (let i = 0; i < toRemove; i++) {
            const key = iterator.next().value;
            if (key) messages.delete(key);
        }
    }

    // Store message with all data needed for anti-unsend
    messages.set(message.messageID, {
        messageID: message.messageID,
        threadID: message.threadID,
        senderID: message.senderID,
        body: message.body || "",
        timestamp: message.timestamp || now,
        attachments: message.attachments || [],
        messageReply: message.messageReply || null,
        isGroup: message.isGroup || false,
        mentions: message.mentions || {},
        expiresAt: now + EXPIRY_TIME,
    });

    return true;
}

/**
 * Get a stored message by ID
 * @param {string} messageID - The message ID
 * @returns {Object|null} The stored message or null
 */
function get(messageID) {
    if (!messageID) return null;

    const stored = messages.get(messageID);
    if (!stored) return null;

    // Check expiry
    if (Date.now() > stored.expiresAt) {
        messages.delete(messageID);
        return null;
    }

    return stored;
}

/**
 * Delete a stored message
 * @param {string} messageID - Message ID to delete
 * @returns {boolean} Success status
 */
function deleteMessage(messageID) {
    return messages.delete(messageID);
}

/**
 * Get store statistics
 * @returns {Object} Store stats
 */
function getStats() {
    return {
        count: messages.size,
        maxSize: MAX_MESSAGES,
        expiryHours: EXPIRY_TIME / (60 * 60 * 1000),
    };
}

/**
 * Cleanup expired messages (runs automatically)
 */
function cleanup() {
    const now = Date.now();
    for (const [messageID, stored] of messages) {
        if (now > stored.expiresAt) {
            messages.delete(messageID);
        }
    }
}

// Start automatic cleanup
setInterval(cleanup, CLEANUP_INTERVAL);

module.exports = {
    store,
    get,
    delete: deleteMessage,
    getStats,
};
