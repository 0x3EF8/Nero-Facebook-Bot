/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                       MEMORY MANAGEMENT MODULE                                ║
 * ║            Handles chat history, message tracking & analytics                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module core/memory
 * @author 0x3EF8
 * @version 1.1.0
 */

"use strict";

const { MEMORY_CONFIG } = require("./constants");

// ═══════════════════════════════════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════════════════════════════════

/** @type {Map<string, Array<{name: string, message: string, timestamp: number}>>} */
const chatMemory = new Map();

/** @type {Set<string>} */
const betaMessageIDs = new Set();

/** @type {Map<string, {totalMessages: number, lastActive: number, users: Set<string>}>} */
const threadStats = new Map();

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT MEMORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Update chat memory with new message
 * @param {string} threadID - Thread identifier
 * @param {string} name - Sender's display name
 * @param {string} message - Message text
 */
function updateChat(threadID, name, message) {
    // Initialize thread memory if needed
    if (!chatMemory.has(threadID)) {
        chatMemory.set(threadID, []);
    }

    const history = chatMemory.get(threadID);
    history.push({
        name,
        message,
        timestamp: Date.now(),
    });

    // Enforce history limit
    while (history.length > MEMORY_CONFIG.maxHistory) {
        history.shift();
    }

    // Update stats
    updateThreadStats(threadID, name);
}

/**
 * Get chat history for a thread
 * @param {string} threadID - Thread identifier
 * @returns {Array} Chat history
 */
function getHistory(threadID) {
    return chatMemory.get(threadID) || [];
}

/**
 * Get formatted history for prompt
 * @param {string} threadID - Thread identifier
 * @param {number} limit - Max messages to return
 * @returns {string} Formatted history
 */
function getFormattedHistory(threadID, limit = MEMORY_CONFIG.contextWindow) {
    const history = getHistory(threadID);
    return history
        .slice(-limit)
        .map((h) => `${h.name}: ${h.message}`)
        .join("\n");
}

/**
 * Clear chat history for a thread
 * @param {string} threadID - Thread identifier
 */
function clearHistory(threadID) {
    chatMemory.delete(threadID);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Track Beta's message ID for reply detection
 * @param {string} messageID - Beta's message ID
 */
function trackBetaMessage(messageID) {
    betaMessageIDs.add(messageID);

    // Enforce cache limit (FIFO)
    if (betaMessageIDs.size > MEMORY_CONFIG.maxTrackedMessages) {
        const firstID = betaMessageIDs.values().next().value;
        betaMessageIDs.delete(firstID);
    }
}

/**
 * Check if a message ID belongs to Beta
 * @param {string} messageID - Message ID to check
 * @returns {boolean} True if message is from Beta
 */
function isBetaMessage(messageID) {
    return betaMessageIDs.has(messageID);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Update thread statistics
 * @param {string} threadID - Thread identifier
 * @param {string} userName - User's name
 */
function updateThreadStats(threadID, userName) {
    if (!threadStats.has(threadID)) {
        threadStats.set(threadID, {
            totalMessages: 0,
            lastActive: Date.now(),
            users: new Set(),
        });
    }

    const stats = threadStats.get(threadID);
    stats.totalMessages++;
    stats.lastActive = Date.now();
    stats.users.add(userName);
}

/**
 * Get statistics for a thread
 * @param {string} threadID - Thread identifier
 * @returns {Object|null} Thread statistics
 */
function getThreadStats(threadID) {
    const stats = threadStats.get(threadID);
    if (!stats) return null;

    return {
        totalMessages: stats.totalMessages,
        lastActive: stats.lastActive,
        uniqueUsers: stats.users.size,
        historySize: (chatMemory.get(threadID) || []).length,
    };
}

/**
 * Get global memory statistics
 * @returns {Object} Memory statistics
 */
function getGlobalStats() {
    return {
        activeThreads: chatMemory.size,
        trackedMessages: betaMessageIDs.size,
        totalMemoryEntries: Array.from(chatMemory.values()).reduce(
            (sum, history) => sum + history.length,
            0
        ),
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    memory: {
        // Chat memory
        updateChat,
        getHistory,
        getFormattedHistory,
        clearHistory,

        // Message tracking
        trackBetaMessage,
        isBetaMessage,

        // Analytics
        getThreadStats,
        getGlobalStats,

        // Config
        MAX_HISTORY: MEMORY_CONFIG.maxHistory,
    },
};
