/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                         BETA AI CONSTANTS                                     ║
 * ║              Centralized configuration for the AI module                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module core/constants
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

// ═══════════════════════════════════════════════════════════════════════════════
// AI CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Beta AI identity and persona
 */
const AI_IDENTITY = {
    name: "Beta",
    version: "3.1.0",
    author: "Jay Patrick Cano",
    persona: "casual, friendly, helpful AI assistant",
    triggerPatterns: [/\b@?beta\b/i],
};

/**
 * Model configuration
 */
const MODEL_CONFIG = {
    name: "gemini-2.5-flash",
    maxRetries: 4,
    keyCooldown: 60000, // 60 seconds
    timeout: 30000, // 30 seconds
};

// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Chat memory settings
 */
const MEMORY_CONFIG = {
    maxHistory: 10,
    maxTrackedMessages: 50,
    contextWindow: 10, // Messages to include in prompt
};

// ═══════════════════════════════════════════════════════════════════════════════
// MEDIA CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Media download limits
 */
const MEDIA_CONFIG = {
    maxDuration: 600, // 10 minutes in seconds
    minDuration: 30, // 30 seconds minimum
    maxImages: 20, // Max images per message
    maxSearchResults: 20,
    aiScoringLimit: 10, // Videos to score with AI
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * AI response command patterns
 */
const COMMAND_PATTERNS = {
    // Nicknames
    nicknameBulk: /NICKNAME_BULK:\s*(.+)/i,
    nicknameClear: /NICKNAME_CLEAR:\s*(\d+)/i,
    nicknameClearAll: /NICKNAME_CLEAR_ALL/i,
    nicknameChange: /NICKNAME_CHANGE:\s*(\d+)\s*\|\s*(.+)/i,
    
    // Media
    musicDownload: /MUSIC_DOWNLOAD:\s*(.+)/i,
    musicSuggestion: /MUSIC_SUGGESTION:\s*(.+?)\s*\|\s*(.+)/i,
    videoDownload: /VIDEO_DOWNLOAD:\s*(.+)/i,
    
    // Utilities
    weatherCheck: /WEATHER_CHECK:\s*(.+)/i,
    datetimeCheck: /DATETIME_CHECK/i,
    
    // Pairing
    pairMe: /PAIR_ME/i,
    pairWith: /PAIR_WITH/i,
    pairRandom: /PAIR_RANDOM/i,
};

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE MESSAGES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Standard response messages
 */
const MESSAGES = {
    greeting: "👋 Hi! I'm Beta, your AI assistant. How can I help you today?",
    noResponse: "Sorry, I couldn't generate a response. Please try again.",
    error: "❌ Sorry, something went wrong. Please try again.",
    rateLimited: "⚠️ I'm a bit overwhelmed right now. Please wait a moment and try again.",
    noPermission: "❌ I don't have permission to do that.",
    notEnoughMembers: "❌ Not enough members in the group for that action.",
    noMatch: "❌ Couldn't find a match. Try again!",
};

// ═══════════════════════════════════════════════════════════════════════════════
// REACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Message reactions for different states
 */
const REACTIONS = {
    loading: "⏳",
    success: "✅",
    error: "❌",
    downloading: "⬇️",
    searching: "🔍",
    love: "💕",
    music: "🎵",
    video: "🎬",
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    AI_IDENTITY,
    MODEL_CONFIG,
    MEMORY_CONFIG,
    MEDIA_CONFIG,
    COMMAND_PATTERNS,
    MESSAGES,
    REACTIONS,
};
