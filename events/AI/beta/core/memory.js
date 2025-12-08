/**
 * Memory Management Module
 * Handles chat history and message tracking
 * 
 * @module core/memory
 */

// Chat memory storage
const chatMemory = new Map(); // threadID -> [{ name, message }]
const betaMessageIDs = new Set(); // Track Beta's messages for reply detection

// Configuration
const MAX_HISTORY = 10;
const MAX_TRACKED_MESSAGES = 50;

/**
 * Update chat memory with new message
 * @param {string} threadID - Thread identifier
 * @param {string} name - Sender's display name
 * @param {string} message - Message text
 */
function updateChat(threadID, name, message) {
  if (!chatMemory.has(threadID)) {
    chatMemory.set(threadID, []);
  }

  const history = chatMemory.get(threadID);
  history.push({ name, message });

  // Keep only last N messages
  if (history.length > MAX_HISTORY) {
    history.shift();
  }
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
 * Clear chat history for a thread
 * @param {string} threadID - Thread identifier
 */
function clearHistory(threadID) {
  chatMemory.delete(threadID);
}

/**
 * Track Beta's message ID for reply detection
 * @param {string} messageID - Beta's message ID
 */
function trackBetaMessage(messageID) {
  betaMessageIDs.add(messageID);

  // Limit cache size (FIFO)
  if (betaMessageIDs.size > MAX_TRACKED_MESSAGES) {
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

/**
 * Format chat history for prompt
 * @param {string} threadID - Thread identifier
 * @returns {string} Formatted history
 */
function formatHistoryForPrompt(threadID) {
  const history = getHistory(threadID);
  
  if (history.length === 0) return "";

  return history.map((h) => `${h.name}: ${h.message}`).join("\n");
}

module.exports = {
  memory: {
    updateChat,
    getHistory,
    clearHistory,
    trackBetaMessage,
    isBetaMessage,
    formatHistoryForPrompt,
    MAX_HISTORY,
  },
};
