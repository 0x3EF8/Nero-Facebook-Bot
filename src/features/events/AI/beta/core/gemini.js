/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                         GEMINI AI CORE MODULE                                 ║
 * ║        Handles API key rotation, rate limiting, and content generation        ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module core/gemini
 * @author 0x3EF8
 * @version 2.0.0
 *
 * Features:
 * - Multi-key rotation with round-robin strategy
 * - Automatic failure detection and cooldown
 * - Two-pass retry mechanism for maximum reliability
 * - Usage statistics tracking
 */

"use strict";

const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require("../../../../../config/config");
const { MODEL_CONFIG, DEBUG } = require("./constants");

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL LOGGER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Internal logger for Gemini module
 * @private
 */
const log = {
    info: (msg) => DEBUG && console.log(`[Gemini] ℹ ${msg}`),
    success: (msg) => DEBUG && console.log(`[Gemini] ✓ ${msg}`),
    warn: (msg) => DEBUG && console.warn(`[Gemini] ⚠ ${msg}`),
    error: (msg) => console.error(`[Gemini] ✗ ${msg}`),
};

// ═══════════════════════════════════════════════════════════════════════════════
// API KEY MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} KeyFailureData
 * @property {number} failedAt - Timestamp of failure
 * @property {number} failCount - Number of consecutive failures
 * @property {string} reason - Failure reason
 */

/** @type {Map<string, KeyFailureData>} */
const failedKeys = new Map();

/** @type {number} */
let currentKeyIndex = 0;

/**
 * @typedef {Object} GeminiStats
 * @property {number} requests - Total requests made
 * @property {number} success - Successful requests
 * @property {number} failures - Failed requests
 * @property {number} lastRequest - Timestamp of last request
 */

/** @type {GeminiStats} */
const stats = {
    requests: 0,
    success: 0,
    failures: 0,
    lastRequest: 0,
};

/**
 * Get all configured API keys (primary + backups)
 * @returns {string[]} Array of valid API keys
 */
function getAllKeys() {
    const primaryKey = config.apiKeys?.gemini;
    const backupKeys = config.apiKeys?.geminiBackups || [];
    return [primaryKey, ...backupKeys].filter(Boolean);
}

/**
 * Get the key type label for logging
 * @param {string} key - API key
 * @param {string[]} allKeys - Array of all keys
 * @returns {string} Key type label (PRIMARY or BACKUP-N)
 * @private
 */
function getKeyType(key, allKeys) {
    const index = allKeys.indexOf(key);
    return index === 0 ? "PRIMARY" : `BACKUP-${index}`;
}

/**
 * Clean up expired key failures from cache
 * @private
 */
function cleanExpiredFailures() {
    const now = Date.now();
    for (const [key, data] of failedKeys.entries()) {
        if (now - data.failedAt > MODEL_CONFIG.keyCooldown) {
            failedKeys.delete(key);
        }
    }
}

/**
 * Get the key that failed longest ago (for recovery)
 * @param {string[]} allKeys - Array of all keys
 * @returns {string} Oldest failed key
 * @private
 */
function getOldestFailedKey(allKeys) {
    let oldestKey = allKeys[0];
    let oldestTime = Infinity;

    for (const key of allKeys) {
        const failData = failedKeys.get(key);
        if (failData && failData.failedAt < oldestTime) {
            oldestTime = failData.failedAt;
            oldestKey = key;
        }
    }

    log.warn(`All keys on cooldown, retrying oldest: ${oldestKey.substring(0, 12)}...`);
    return oldestKey;
}

/**
 * Get the next available API key using round-robin rotation
 * @returns {string|null} Available API key or null if none configured
 */
function getNextApiKey() {
    const allKeys = getAllKeys();

    if (allKeys.length === 0) {
        log.error("No Gemini API keys configured!");
        return null;
    }

    cleanExpiredFailures();

    // Find available key using round-robin
    for (let attempts = 0; attempts < allKeys.length; attempts++) {
        const key = allKeys[currentKeyIndex];
        const failData = failedKeys.get(key);

        currentKeyIndex = (currentKeyIndex + 1) % allKeys.length;

        if (!failData || Date.now() - failData.failedAt > MODEL_CONFIG.keyCooldown) {
            log.info(`Using ${getKeyType(key, allKeys)} key: ${key.substring(0, 12)}...`);
            return key;
        }
    }

    // All keys on cooldown - use oldest failed key
    return getOldestFailedKey(allKeys);
}

/**
 * Mark an API key as failed
 * @param {string} apiKey - The failed key
 * @param {string} [reason="unknown"] - Failure reason
 */
function markKeyFailed(apiKey, reason = "unknown") {
    const existing = failedKeys.get(apiKey) || { failCount: 0 };

    failedKeys.set(apiKey, {
        failedAt: Date.now(),
        failCount: existing.failCount + 1,
        reason,
    });

    const allKeys = getAllKeys();
    log.warn(`${getKeyType(apiKey, allKeys)} key failed (${reason}), rotating...`);
}

/**
 * Reset all key failures (useful for recovery)
 */
function resetKeyFailures() {
    failedKeys.clear();
    currentKeyIndex = 0;
    log.info("All key failures reset");
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

/** @type {RegExp} Pattern for retryable errors */
const RETRYABLE_PATTERN = /429|quota|rate|Too Many|ECONNRESET|ETIMEDOUT|network|503|500/i;

/** @type {RegExp} Pattern for permanent key errors */
const KEY_ERROR_PATTERN = /leaked|invalid|API key not valid|403/i;

/**
 * Check if error is retryable (rate limits, network issues)
 * @param {Error} error - Error to classify
 * @returns {boolean} True if error is retryable
 * @private
 */
function isRetryable(error) {
    const msg = error.message || String(error);
    return RETRYABLE_PATTERN.test(msg);
}

/**
 * Check if error indicates a permanent key issue
 * @param {Error} error - Error to classify
 * @returns {boolean} True if error is a key error
 * @private
 */
function isKeyError(error) {
    const msg = error.message || String(error);
    return KEY_ERROR_PATTERN.test(msg);
}

/**
 * Sleep helper for delay between retries
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 * @private
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTENT GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate content with aggressive API key rotation (Multi-pass strategy)
 *
 * Strategy: Try every key, then try every key AGAIN (2 full passes)
 * This maximizes chances of success when keys have intermittent issues.
 *
 * @param {string} prompt - The prompt text
 * @param {Array} [imageParts=[]] - Optional image parts for multimodal
 * @returns {Promise<Object>} Generation result from Gemini
 * @throws {Error} If all keys fail after 2 passes
 */
async function generate(prompt, imageParts = []) {
    const allKeys = getAllKeys();

    if (allKeys.length === 0) {
        throw new Error("No Gemini API keys available - check your configuration");
    }

    stats.requests++;
    stats.lastRequest = Date.now();

    let lastError = null;
    const maxAttempts = allKeys.length * 2; // Two full passes

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const keyIndex = attempt % allKeys.length;
        const apiKey = allKeys[keyIndex];
        const isRetryPass = attempt >= allKeys.length;
        const keyType = keyIndex === 0 ? "PRIMARY" : `BACKUP-${keyIndex}`;
        const passLabel = isRetryPass ? " (retry pass)" : "";

        log.info(`Attempt ${attempt + 1}/${maxAttempts} using ${keyType} key${passLabel}...`);

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: MODEL_CONFIG.name });

            const result =
                imageParts.length > 0
                    ? await model.generateContent([prompt, ...imageParts])
                    : await model.generateContent(prompt);

            stats.success++;

            if (keyIndex > 0 || isRetryPass) {
                log.success(`Success using ${keyType} key on attempt ${attempt + 1}!`);
            } else {
                log.success("Response received");
            }

            return result;
        } catch (error) {
            lastError = error;
            stats.failures++;

            // Classify failure reason
            const reason = isKeyError(error) ? "key_error" : isRetryable(error) ? "rate_limit" : "other";

            markKeyFailed(apiKey, reason);
            log.warn(`Key failed (${reason}). Moving to next key...`);

            // Delay between attempts (longer between passes)
            if (attempt < maxAttempts - 1) {
                await sleep(isRetryPass ? 2000 : 500);
            }
        }
    }

    log.error(`All keys failed after ${maxAttempts} attempts (2 full passes)`);
    throw lastError;
}

/**
 * Create a model proxy for compatibility with existing code
 * @returns {Object} Proxy object with generateContent method
 */
function createModelProxy() {
    return {
        generateContent: async (promptOrParts) => {
            if (Array.isArray(promptOrParts)) {
                const [prompt, ...images] = promptOrParts;
                return generate(prompt, images);
            }
            return generate(promptOrParts);
        },
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get API usage statistics
 * @returns {Object} Statistics object
 */
function getStats() {
    const successRate =
        stats.requests > 0 ? ((stats.success / stats.requests) * 100).toFixed(1) + "%" : "N/A";

    return {
        ...stats,
        successRate,
        activeKeys: getAllKeys().length,
        failedKeys: failedKeys.size,
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    gemini: {
        // Core functions
        generate,
        createModelProxy,

        // Key management
        getNextApiKey,
        markKeyFailed,
        resetKeyFailures,
        getAllKeys,

        // Statistics
        getStats,
    },
};
