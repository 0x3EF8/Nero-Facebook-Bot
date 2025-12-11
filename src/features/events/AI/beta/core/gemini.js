/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                         GEMINI AI CORE MODULE                                 ║
 * ║        Handles API key rotation, rate limiting, and content generation        ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module core/gemini
 * @author 0x3EF8
 * @version 1.2.0
 */

"use strict";

const { GoogleGenerativeAI } = require("@google/generative-ai");
const chalk = require("chalk");
const config = require("../../../../../config/config");
const { MODEL_CONFIG } = require("./constants");

// ═══════════════════════════════════════════════════════════════════════════════
// API KEY MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/** @type {Map<string, {failedAt: number, failCount: number, reason: string}>} */
const failedKeys = new Map();

/** @type {number} */
let currentKeyIndex = 0;

/** @type {{requests: number, success: number, failures: number, lastRequest: number}} */
const stats = {
    requests: 0,
    success: 0,
    failures: 0,
    lastRequest: 0,
};

/**
 * Get all configured API keys (main + backups)
 * @returns {string[]} Array of API keys
 */
function getAllKeys() {
    const primaryKey = config.apiKeys?.gemini;
    const backupKeys = config.apiKeys?.geminiBackups || [];
    return [primaryKey, ...backupKeys].filter(Boolean);
}

/**
 * Get the next API key using round-robin rotation
 * @returns {string|null} Available API key or null
 */
function getNextApiKey() {
    const allKeys = getAllKeys();
    
    if (allKeys.length === 0) {
        console.log(chalk.red("✗ No Gemini API keys configured!"));
        return null;
    }

    const now = Date.now();
    
    // Clean up expired failures
    for (const [key, data] of failedKeys.entries()) {
        if (now - data.failedAt > MODEL_CONFIG.keyCooldown) {
            failedKeys.delete(key);
        }
    }

    // Find available key (round-robin)
    let attempts = 0;
    while (attempts < allKeys.length) {
        const key = allKeys[currentKeyIndex];
        const failData = failedKeys.get(key);
        
        currentKeyIndex = (currentKeyIndex + 1) % allKeys.length;
        attempts++;
        
        if (!failData || (now - failData.failedAt > MODEL_CONFIG.keyCooldown)) {
            const keyType = getKeyType(key, allKeys);
            console.log(chalk.cyan(`► Using ${keyType} key: ${key.substring(0, 12)}...`));
            return key;
        }
    }

    // All keys on cooldown - use oldest failed key
    return getOldestFailedKey(allKeys);
}

/**
 * Get key type label
 */
function getKeyType(key, allKeys) {
    const index = allKeys.indexOf(key);
    return index === 0 ? "PRIMARY" : `BACKUP-${index}`;
}

/**
 * Get the key that failed longest ago
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
    
    console.log(chalk.yellow(`⚠ All keys on cooldown, retrying: ${oldestKey.substring(0, 12)}...`));
    return oldestKey;
}

/**
 * Mark an API key as failed
 * @param {string} apiKey - The failed key
 * @param {string} reason - Failure reason
 */
function markKeyFailed(apiKey, reason = "unknown") {
    const existing = failedKeys.get(apiKey) || { failCount: 0 };
    failedKeys.set(apiKey, {
        failedAt: Date.now(),
        failCount: existing.failCount + 1,
        reason,
    });
    
    const allKeys = getAllKeys();
    const keyType = getKeyType(apiKey, allKeys);
    console.log(chalk.yellow(`⚠ ${keyType} key failed (${reason}), rotating...`));
}

/**
 * Reset all key failures
 */
function resetKeyFailures() {
    failedKeys.clear();
    currentKeyIndex = 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if error is retryable
 */
function isRetryable(error) {
    const msg = error.message || String(error);
    return /429|quota|rate|Too Many|ECONNRESET|ETIMEDOUT|network|503|500/i.test(msg);
}

/**
 * Check if error is a permanent key error
 */
function isKeyError(error) {
    const msg = error.message || String(error);
    return /leaked|invalid|API key not valid|403/i.test(msg);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTENT GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate content with smart API key rotation
 * @param {string} prompt - The prompt text
 * @param {Array} imageParts - Optional image parts
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<Object>} Generation result
 */
async function generate(prompt, imageParts = [], maxRetries = MODEL_CONFIG.maxRetries) {
    const allKeys = getAllKeys();
    const totalAttempts = Math.min(maxRetries, allKeys.length + 1);
    
    stats.requests++;
    stats.lastRequest = Date.now();
    
    let lastError = null;
    
    for (let attempt = 1; attempt <= totalAttempts; attempt++) {
        const apiKey = getNextApiKey();
        
        if (!apiKey) {
            throw new Error("No Gemini API keys available - check your .env file");
        }
        
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: MODEL_CONFIG.name });
            
            const result = imageParts.length > 0
                ? await model.generateContent([prompt, ...imageParts])
                : await model.generateContent(prompt);
            
            stats.success++;
            console.log(chalk.green(`✓ Gemini response received`));
            return result;
            
        } catch (error) {
            lastError = error;
            stats.failures++;
            
            // Classify and handle failure
            if (isKeyError(error)) {
                markKeyFailed(apiKey, "key_error");
            } else if (isRetryable(error)) {
                markKeyFailed(apiKey, "rate_limit");
            } else {
                markKeyFailed(apiKey, "other");
            }
            
            // Retry with backoff
            if (attempt < totalAttempts) {
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                console.log(chalk.yellow(`⚠ Attempt ${attempt}/${totalAttempts} failed. Retrying in ${delay}ms...`));
                await sleep(delay);
            }
        }
    }
    
    console.log(chalk.red(`✗ All ${totalAttempts} attempts failed`));
    throw lastError;
}

/**
 * Sleep helper
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a model proxy for compatibility
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
 */
function getStats() {
    return {
        ...stats,
        successRate: stats.requests > 0 
            ? ((stats.success / stats.requests) * 100).toFixed(1) + "%" 
            : "N/A",
        activeKeys: getAllKeys().length,
        failedKeys: failedKeys.size,
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    gemini: {
        generate,
        createModelProxy,
        getNextApiKey,
        markKeyFailed,
        resetKeyFailures,
        getAllKeys,
        getStats,
    },
};
