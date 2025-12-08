/**
 * Gemini AI Core Module
 * Handles API key rotation, rate limiting, and content generation
 * 
 * @module core/gemini
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const chalk = require("chalk");
const config = require("../../../../config/config");

// Rate limited keys tracker
const rateLimitedKeys = new Map();

/**
 * Get the next available API key (rotates on rate limit)
 * @returns {string|null} Available API key or null if all exhausted
 */
function getAvailableApiKey() {
  const primaryKey = config.apiKeys?.gemini;
  const backupKeys = config.apiKeys?.geminiBackups || [];
  const allKeys = [primaryKey, ...backupKeys].filter(Boolean);

  if (allKeys.length === 0) return null;

  // Clean up expired rate limits (reset after 60 seconds)
  const now = Date.now();
  for (const [key, timestamp] of rateLimitedKeys.entries()) {
    if (now - timestamp > 60000) {
      rateLimitedKeys.delete(key);
    }
  }

  // Find first non-rate-limited key
  for (const key of allKeys) {
    if (!rateLimitedKeys.has(key)) {
      return key;
    }
  }

  // All keys rate limited - return the one that was limited longest ago
  let oldestKey = allKeys[0];
  let oldestTime = Infinity;
  for (const [key, timestamp] of rateLimitedKeys.entries()) {
    if (timestamp < oldestTime && allKeys.includes(key)) {
      oldestTime = timestamp;
      oldestKey = key;
    }
  }
  return oldestKey;
}

/**
 * Mark an API key as rate limited
 * @param {string} apiKey - The key that hit rate limit
 */
function markKeyRateLimited(apiKey) {
  rateLimitedKeys.set(apiKey, Date.now());
  console.log(chalk.yellow(`⚠ API key ${apiKey.substring(0, 10)}... rate limited, rotating to backup`));
}

/**
 * Generate content with automatic API key rotation on rate limit
 * @param {string} prompt - The prompt text
 * @param {Array} imageParts - Optional image parts for multimodal
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<Object>} Generation result
 */
async function generate(prompt, imageParts = [], maxRetries = 3) {
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const apiKey = getAvailableApiKey();

    if (!apiKey) {
      throw new Error("No Gemini API keys available");
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      let result;
      if (imageParts.length > 0) {
        result = await model.generateContent([prompt, ...imageParts]);
      } else {
        result = await model.generateContent(prompt);
      }

      return result;
    } catch (error) {
      lastError = error;
      const errorMsg = error.message || String(error);

      // Check if it's a rate limit error (429)
      if (
        errorMsg.includes("429") ||
        errorMsg.includes("quota") ||
        errorMsg.includes("rate") ||
        errorMsg.includes("Too Many Requests")
      ) {
        markKeyRateLimited(apiKey);
        console.log(chalk.cyan(`🔄 Retrying with backup key (attempt ${attempt + 2}/${maxRetries})...`));

        // Small delay before retry
        await new Promise((resolve) => { setTimeout(resolve, 1000); });
        continue;
      }

      // For other errors, don't retry
      throw error;
    }
  }

  throw lastError || new Error("All API key attempts failed");
}

/**
 * Create a model proxy that uses the fallback system
 * @returns {Object} Model proxy with generateContent method
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

module.exports = {
  gemini: {
    generate,
    createModelProxy,
    getAvailableApiKey,
    markKeyRateLimited,
  },
};
