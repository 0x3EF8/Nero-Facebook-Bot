/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                           BETA AI - CONSTANTS                                 ║
 * ║              Centralized Configuration & Pattern Definitions                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * Single source of truth for all Beta AI configuration, patterns, and messages.
 *
 * @module core/constants
 * @author 0x3EF8
 * @version 3.0.0
 */

"use strict";

// ═══════════════════════════════════════════════════════════════════════════════
// AI IDENTITY & PERSONA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Beta AI identity configuration
 * @type {Readonly<Object>}
 */
const AI_IDENTITY = Object.freeze({
    name: "Nero",
    version: "4.0.0",
    author: "Jay Patrick Cano",
    persona: "intelligent, witty, helpful AI assistant with emotional intelligence",
    triggerPatterns: [/\b@?nero\b/i],
    
    // Personality traits for response generation
    traits: Object.freeze({
        humor: 0.7,         // Balance of playfulness
        formality: 0.4,     // Adaptable formality
        empathy: 0.9,       // High emotional intelligence
        creativity: 0.8,    // Creative problem solving
        precision: 0.95,    // Accuracy priority
    }),
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADVANCED AI CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Advanced reasoning and behavior configuration
 * @type {Readonly<Object>}
 */
const AI_REASONING = Object.freeze({
    // Intent classification thresholds
    confidenceThreshold: 0.7,
    
    // Response strategies
    strategies: Object.freeze({
        EXECUTE: "execute",      // Run a command immediately
        CLARIFY: "clarify",      // Ask for clarification
        RESPOND: "respond",      // Normal conversational response
        ANALYZE: "analyze",      // Deep analysis required
        ASSIST: "assist",        // Step-by-step guidance
    }),
    
    // Intent categories (expanded keywords)
    intents: Object.freeze({
        MUSIC: ["play", "song", "music", "sing", "listen", "audio", "mp3", "kantahin", "kanta", "tugtog", "spotify", "playlist", "album", "artist", "band"],
        VIDEO: ["video", "watch", "show", "clip", "youtube", "panoorin", "palabas", "movie", "trailer", "tiktok"],
        NICKNAME: ["name", "nickname", "pangalan", "tawag", "rename", "call me", "change my", "palitan", "baguhin"],
        WEATHER: ["weather", "temperature", "panahon", "init", "ulan", "rain", "hot", "cold", "forecast", "climate", "humid", "storm", "typhoon", "bagyo"],
        PAIRING: ["pair", "ship", "match", "love", "jowa", "partner", "compatibility", "crush", "mahal", "boyfriend", "girlfriend"],
        DATETIME: ["time", "date", "day", "oras", "araw", "what day", "anong oras", "schedule", "calendar"],
        PROFILE: ["who is", "sino si", "sino yan", "stalk", "profile", "info about", "tell me about", "whois", "describe", "kilala mo ba", "know about"],
        GREETING: ["hi", "hello", "hey", "good morning", "good evening", "kumusta", "musta", "sup", "yo", "uy", "oi"],
        QUESTION: ["what", "why", "how", "when", "where", "who", "ano", "bakit", "paano", "kailan", "saan", "sino", "explain", "define"],
        HELP: ["help", "assist", "tulong", "how to", "paano", "guide", "tutorial", "teach"],
        GRATITUDE: ["thanks", "thank you", "salamat", "ty", "tysm", "appreciate", "grateful"],
        FAREWELL: ["bye", "goodbye", "see you", "paalam", "later", "gotta go", "brb", "gtg"],
        JOKE: ["joke", "funny", "humor", "biro", "chiste", "make me laugh", "knock knock"],
        COMPLIMENT: ["nice", "cool", "awesome", "galing", "ang galing", "great job", "well done", "amazing"],
        TTS: ["tts", "voice", "speak", "boses", "salita", "text to speech", "voice message", "audio"],
    }),
});

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Gemini model configuration
 * @type {Readonly<Object>}
 */
const MODEL_CONFIG = Object.freeze({
    name: "gemini-2.5-flash",
    maxRetries: 4,
    keyCooldown: 60000,
    timeout: 30000,
    
    // Generation parameters for smarter responses
    generation: Object.freeze({
        temperature: 0.8,       // Balanced creativity
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 2048,
    }),
    
    // Safety settings
    safety: Object.freeze({
        blockNone: true,        // Let the prompt handle safety
    }),
});

// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Chat memory settings
 * @type {Readonly<Object>}
 */
const MEMORY_CONFIG = Object.freeze({
    maxHistory: 10,
    maxTrackedMessages: 50,
    contextWindow: 10,
    maxThreads: 500,
    cacheCleanupInterval: 300000,
});

/**
 * Name cache configuration (LRU)
 * @type {Readonly<Object>}
 */
const NAME_CACHE_CONFIG = Object.freeze({
    maxSize: 1000,
    ttl: 3600000, // 1 hour
});

/**
 * Debug mode flag
 * @type {boolean}
 */
const DEBUG = process.env.NODE_ENV !== "production";

// ═══════════════════════════════════════════════════════════════════════════════
// MEDIA CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Media download limits
 * @type {Readonly<Object>}
 */
const MEDIA_CONFIG = Object.freeze({
    maxDuration: 600,
    minDuration: 30,
    maxImages: 20,
    maxFileSize: 50,
    maxSearchResults: 20,
    aiScoringLimit: 10,
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND PATTERNS (Single Source of Truth)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * AI response command patterns - used by handlers/commands.js
 * Note: Patterns use [^\`]+ or trim backticks to handle AI markdown formatting
 * @type {Readonly<Object>}
 */
const COMMAND_PATTERNS = Object.freeze({
    // Nickname commands
    NICKNAME_BULK: /NICKNAME_BULK:\s*([^`]+)/i,
    NICKNAME_CLEAR_ALL: /NICKNAME_CLEAR_ALL/i,
    NICKNAME_CLEAR: /NICKNAME_CLEAR:\s*(\d+)/i,
    NICKNAME_CHANGE: /NICKNAME_CHANGE:\s*(\d+)\s*\|\s*([^`]+)/i,

    // Media commands
    MUSIC_SUGGESTION: /MUSIC_SUGGESTION:\s*([^|`]+?)\s*\|\s*([^`]+)/i,
    MUSIC_DOWNLOAD: /MUSIC_DOWNLOAD:\s*([^`]+)/i,
    VIDEO_DOWNLOAD: /VIDEO_DOWNLOAD:\s*([^`]+)/i,

    // Utility commands
    WEATHER_CHECK: /WEATHER_CHECK:\s*([^`]+)/i,
    DATETIME_CHECK: /DATETIME_CHECK/i,
    STALK_USER: /STALK_USER:\s*([^`]+)/i,

    // Pairing commands
    PAIR_ME: /PAIR_ME/i,
    PAIR_WITH: /PAIR_WITH/i,
    PAIR_RANDOM: /PAIR_RANDOM/i,

    // TTS commands
    TTS_ENABLE: /TTS_ENABLE/i,
    TTS_DISABLE: /TTS_DISABLE/i,
    TTS_STATUS: /TTS_STATUS/i,
    TTS_VOICE: /TTS_VOICE:\s*([^`]+)/i,

    // Reminder commands
    REMINDER_SET: /REMINDER_SET:\s*(.+)/i,
    REMINDER_LIST: /REMINDER_LIST/i,
    REMINDER_CLEAR: /REMINDER_CLEAR/i,

    // Detection helpers
    WANTS_LYRICS: /\b(lyrics?|letra|lirika)\b/i,
    MY_NAME: /my name|my nickname/i,
});

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE MESSAGES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Standard response messages with nested error messages
 * @type {Readonly<Object>}
 */
const MESSAGES = Object.freeze({
    // General responses
    greeting: "👋 Hi! I'm Nero, your AI assistant.\n\n💡 Type 'nero help' to see what I can do!\n✨ Or just chat naturally - I'll understand!",
    noResponse: "Sorry, I couldn't generate a response. Please try again.",
    thinking: "🤔 Let me think about that...",

    // Error messages
    error: "❌ Sorry, something went wrong. Please try again.",
    rateLimited: "⚠️ I'm a bit overwhelmed right now. Please wait a moment and try again.",
    noPermission: "❌ I don't have permission to do that.",
    notEnoughMembers: "❌ Not enough members in the group for that action.",
    noMatch: "❌ Couldn't find a match. Try again!",
    timeout: "⏱️ Request timed out. Please try again.",

    // Nested error messages for specific contexts
    errors: Object.freeze({
        invalidUserID: "❌ Invalid user ID provided. Please try again.",
        nicknameFailed: "❌ Failed to change nickname. I might not have permission.",
        downloadFailed: "❌ Download failed. Please try a different query.",
        searchFailed: "❌ Search failed. Please try different keywords.",
        weatherFailed: "❌ Could not fetch weather data for that location.",
        noResults: "❌ No results found for your query.",
        fileTooLarge: "❌ File is too large to send (max 50MB).",
        invalidFormat: "❌ Invalid format. Please check your input.",
        apiError: "❌ API error occurred. Please try again later.",
        missingParams: "❌ Missing required parameters.",
    }),

    // Success messages
    success: Object.freeze({
        nicknameSingle: "✅ Nickname changed successfully!",
        nicknameBulk: "✨ Nicknames changed successfully!",
        nicknameClear: "✅ Nickname cleared!",
    }),

    // Help hints
    hints: Object.freeze({
        newUser: "💡 New here? Type 'nero help' to see what I can do!",
        moreCommands: "📖 Type 'nero menu' for quick commands or 'nero help' for full guide",
        needHelp: "🤔 Need help? Type 'nero examples' to see command examples",
    }),
});

// ═══════════════════════════════════════════════════════════════════════════════
// REACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Message reactions for different states
 * @type {Readonly<Object>}
 */
const REACTIONS = Object.freeze({
    // Processing states
    loading: "⏳",
    processing: "⚙️",
    searching: "🔍",
    downloading: "⬇️",
    uploading: "🔃",
    thinking: "🧠",

    // Result states
    success: "✅",
    error: "❌",
    warning: "⚠️",

    // Feature-specific
    love: "💕",
    music: "🎵",
    video: "🎬",
    weather: "🌤️",
    ai: "🧠",
    laugh: "😂",
    cool: "😎",
    fire: "🔥",
});

// ═══════════════════════════════════════════════════════════════════════════════
// SMART RESPONSE TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    AI_IDENTITY,
    AI_REASONING,
    MODEL_CONFIG,
    MEMORY_CONFIG,
    NAME_CACHE_CONFIG,
    MEDIA_CONFIG,
    COMMAND_PATTERNS,
    MESSAGES,
    REACTIONS,
    DEBUG,
};
