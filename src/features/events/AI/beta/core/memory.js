/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                       MEMORY MANAGEMENT MODULE                                ║
 * ║            Handles chat history, message tracking & user learning             ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module core/memory
 * @author 0x3EF8
 * @version 3.0.0
 *
 * Features:
 * - Per-thread chat history with configurable limits
 * - User preference learning and memory
 * - Message ID tracking for reply detection
 * - Conversation summarization for long contexts
 * - Thread activity analytics
 * - Automatic memory cleanup (LRU eviction)
 */

"use strict";

const { MEMORY_CONFIG } = require("./constants");

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} ChatMessage
 * @property {string} name - Sender's display name
 * @property {string} message - Message text
 * @property {number} timestamp - Unix timestamp
 * @property {string} [intent] - Detected intent (optional)
 */

/**
 * @typedef {Object} UserPreference
 * @property {string[]} favoriteTopics - Topics user frequently discusses
 * @property {string} preferredLanguage - User's preferred language
 * @property {string} communicationStyle - casual/formal
 * @property {Object} musicPrefs - Music preferences
 * @property {number} lastInteraction - Last interaction timestamp
 */

/**
 * @typedef {Object} ThreadStatistics
 * @property {number} totalMessages - Total messages in thread
 * @property {number} lastActive - Last activity timestamp
 * @property {Set<string>} users - Unique users who participated
 * @property {Object} topicFrequency - Topic frequency map
 */

// ═══════════════════════════════════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════════════════════════════════

/** @type {Map<string, ChatMessage[]>} Thread ID -> Chat history */
const chatMemory = new Map();

/** @type {Set<string>} Message IDs sent by Nero */
const neroMessageIDs = new Set();

/** @type {Map<string, ThreadStatistics>} Thread ID -> Statistics */
const threadStats = new Map();

/** @type {string[]} LRU queue for thread cleanup */
const threadAccessOrder = [];

/** @type {Map<string, UserPreference>} User ID -> Preferences (NEW) */
const userPreferences = new Map();

/** @type {Map<string, string>} Thread ID -> Summary of older messages (NEW) */
const conversationSummaries = new Map();

// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY MANAGEMENT (LRU Eviction)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Update LRU access order for a thread
 * @param {string} threadID - Thread identifier
 * @private
 */
function touchThread(threadID) {
    const index = threadAccessOrder.indexOf(threadID);
    if (index > -1) {
        threadAccessOrder.splice(index, 1);
    }
    threadAccessOrder.push(threadID);

    // Evict oldest threads if over limit
    while (threadAccessOrder.length > MEMORY_CONFIG.maxThreads) {
        const oldestThread = threadAccessOrder.shift();
        if (oldestThread) {
            chatMemory.delete(oldestThread);
            threadStats.delete(oldestThread);
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT MEMORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Update chat memory with a new message
 * @param {string} threadID - Thread identifier
 * @param {string} name - Sender's display name
 * @param {string} message - Message text
 * @param {string} [intent] - Detected intent (optional)
 */
function updateChat(threadID, name, message, intent = null) {
    // Initialize thread memory if needed
    if (!chatMemory.has(threadID)) {
        chatMemory.set(threadID, []);
    }

    const history = chatMemory.get(threadID);

    history.push({
        name,
        message,
        timestamp: Date.now(),
        intent,
    });

    // Enforce history limit (FIFO)
    while (history.length > MEMORY_CONFIG.maxHistory) {
        history.shift();
    }

    // Update LRU and stats
    touchThread(threadID);
    updateThreadStats(threadID, name, intent);
}

/**
 * Get chat history for a thread
 * @param {string} threadID - Thread identifier
 * @returns {ChatMessage[]} Chat history array
 */
function getHistory(threadID) {
    return chatMemory.get(threadID) || [];
}

/**
 * Get formatted history string for prompt building
 * @param {string} threadID - Thread identifier
 * @param {number} [limit=MEMORY_CONFIG.contextWindow] - Max messages to include
 * @returns {string} Formatted history (name: message format)
 */
function getFormattedHistory(threadID, limit = MEMORY_CONFIG.contextWindow) {
    const history = getHistory(threadID);
    const summary = conversationSummaries.get(threadID);

    let formatted = "";
    
    // Include summary of older messages if available
    if (summary && history.length >= limit) {
        formatted += `[Earlier context: ${summary}]\n\n`;
    }

    formatted += history
        .slice(-limit)
        .map((h) => `${h.name}: ${h.message}`)
        .join("\n");

    return formatted;
}

/**
 * Clear chat history for a specific thread
 * @param {string} threadID - Thread identifier
 */
function clearHistory(threadID) {
    chatMemory.delete(threadID);
    threadStats.delete(threadID);

    const index = threadAccessOrder.indexOf(threadID);
    if (index > -1) {
        threadAccessOrder.splice(index, 1);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Track Nero's message ID for reply detection
 * @param {string} messageID - Nero's message ID
 */
function trackBetaMessage(messageID) {
    neroMessageIDs.add(messageID);

    // Enforce cache limit (FIFO)
    if (neroMessageIDs.size > MEMORY_CONFIG.maxTrackedMessages) {
        const firstID = neroMessageIDs.values().next().value;
        neroMessageIDs.delete(firstID);
    }
}

/**
 * Check if a message ID belongs to Nero
 * @param {string} messageID - Message ID to check
 * @returns {boolean} True if message was sent by Nero
 */
function isBetaMessage(messageID) {
    return neroMessageIDs.has(messageID);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Update thread activity statistics
 * @param {string} threadID - Thread identifier
 * @param {string} userName - User's display name
 * @param {string} [intent] - Detected intent
 * @private
 */
function updateThreadStats(threadID, userName, intent = null) {
    if (!threadStats.has(threadID)) {
        threadStats.set(threadID, {
            totalMessages: 0,
            lastActive: Date.now(),
            users: new Set(),
            topicFrequency: {},
        });
    }

    const stats = threadStats.get(threadID);
    stats.totalMessages++;
    stats.lastActive = Date.now();
    stats.users.add(userName);

    // Track topic/intent frequency
    if (intent) {
        stats.topicFrequency[intent] = (stats.topicFrequency[intent] || 0) + 1;
    }
}

/**
 * Get statistics for a specific thread
 * @param {string} threadID - Thread identifier
 * @returns {Object|null} Thread statistics or null if not found
 */
function getThreadStats(threadID) {
    const stats = threadStats.get(threadID);

    if (!stats) {
        return null;
    }

    return {
        totalMessages: stats.totalMessages,
        lastActive: stats.lastActive,
        uniqueUsers: stats.users.size,
        historySize: (chatMemory.get(threadID) || []).length,
        topTopics: getTopTopics(stats.topicFrequency, 3),
    };
}

/**
 * Get top N topics from frequency map
 * @param {Object} frequency - Topic frequency map
 * @param {number} n - Number of top topics
 * @returns {string[]} Top topics
 * @private
 */
function getTopTopics(frequency, n) {
    return Object.entries(frequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([topic]) => topic);
}

/**
 * Get global memory statistics
 * @returns {Object} Global memory statistics
 */
function getGlobalStats() {
    const totalMemoryEntries = Array.from(chatMemory.values()).reduce(
        (sum, history) => sum + history.length,
        0
    );

    return {
        activeThreads: chatMemory.size,
        trackedMessages: neroMessageIDs.size,
        totalMemoryEntries,
        maxThreads: MEMORY_CONFIG.maxThreads,
        learnedUsers: userPreferences.size,
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER PREFERENCE LEARNING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Update user preferences based on interaction
 * @param {string} userID - User identifier
 * @param {Object} data - Preference data to merge
 */
function updateUserPreference(userID, data) {
    const existing = userPreferences.get(userID) || {
        favoriteTopics: [],
        preferredLanguage: "english",
        communicationStyle: "casual",
        musicPrefs: { genres: [], artists: [] },
        lastInteraction: Date.now(),
    };

    // Merge data intelligently
    if (data.topic && !existing.favoriteTopics.includes(data.topic)) {
        existing.favoriteTopics.push(data.topic);
        // Keep only last 10 topics
        if (existing.favoriteTopics.length > 10) {
            existing.favoriteTopics.shift();
        }
    }

    if (data.language) {
        existing.preferredLanguage = data.language;
    }

    if (data.style) {
        existing.communicationStyle = data.style;
    }

    if (data.musicGenre && !existing.musicPrefs.genres.includes(data.musicGenre)) {
        existing.musicPrefs.genres.push(data.musicGenre);
        if (existing.musicPrefs.genres.length > 5) {
            existing.musicPrefs.genres.shift();
        }
    }

    if (data.artist && !existing.musicPrefs.artists.includes(data.artist)) {
        existing.musicPrefs.artists.push(data.artist);
        if (existing.musicPrefs.artists.length > 10) {
            existing.musicPrefs.artists.shift();
        }
    }

    existing.lastInteraction = Date.now();
    userPreferences.set(userID, existing);
}

/**
 * Get user preferences
 * @param {string} userID - User identifier
 * @returns {UserPreference|null} User preferences or null
 */
function getUserPreference(userID) {
    return userPreferences.get(userID) || null;
}

/**
 * Get formatted user context for prompts
 * @param {string} userID - User identifier
 * @returns {string} Formatted user context
 */
function getUserContext(userID) {
    const prefs = getUserPreference(userID);
    if (!prefs) return "";

    const parts = [];
    
    if (prefs.favoriteTopics.length > 0) {
        parts.push(`Interests: ${prefs.favoriteTopics.slice(-5).join(", ")}`);
    }
    
    if (prefs.musicPrefs.artists.length > 0) {
        parts.push(`Fav artists: ${prefs.musicPrefs.artists.slice(-3).join(", ")}`);
    }
    
    parts.push(`Language pref: ${prefs.preferredLanguage}`);
    parts.push(`Style: ${prefs.communicationStyle}`);

    return parts.join(" | ");
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVERSATION SUMMARIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Set a summary for older conversation parts
 * @param {string} threadID - Thread identifier
 * @param {string} summary - Summary text
 */
function setConversationSummary(threadID, summary) {
    conversationSummaries.set(threadID, summary);
}

/**
 * Get conversation summary
 * @param {string} threadID - Thread identifier
 * @returns {string|null} Summary or null
 */
function getConversationSummary(threadID) {
    return conversationSummaries.get(threadID) || null;
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

        // User learning
        updateUserPreference,
        getUserPreference,
        getUserContext,

        // Summaries
        setConversationSummary,
        getConversationSummary,

        // Configuration
        MAX_HISTORY: MEMORY_CONFIG.maxHistory,
    },
};
