/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * NERO BOT - RETRY UTILITY
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Provides robust retry functionality with exponential backoff for API calls
 * and other async operations that may fail temporarily.
 * 
 * @author Nero Bot Team
 * @version 1.0.0
 * @license MIT
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use strict';

const logger = require('./logger');
const { ApiError, wrapError } = require('./errors');

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_OPTIONS = {
    maxRetries: 3,           // Maximum number of retry attempts
    initialDelay: 1000,      // Initial delay in ms (1 second)
    maxDelay: 30000,         // Maximum delay in ms (30 seconds)
    backoffFactor: 2,        // Exponential backoff multiplier
    jitter: true,            // Add random jitter to prevent thundering herd
    jitterFactor: 0.3,       // Jitter range (0.3 = ±30%)
    retryOn: null,           // Function to determine if should retry (error) => boolean
    onRetry: null,           // Callback on each retry (error, attempt, delay) => void
    shouldRetry: null,       // Alias for retryOn
    timeout: 30000,          // Overall timeout for all retries (30 seconds)
    logRetries: true,        // Log retry attempts
    module: 'Retry'          // Module name for logging
};

// ═══════════════════════════════════════════════════════════════════════════════
// RETRY HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate delay with exponential backoff and optional jitter
 * @param {number} attempt - Current attempt number (0-based)
 * @param {Object} options - Retry options
 * @returns {number} Delay in milliseconds
 */
const calculateDelay = (attempt, options) => {
    const { initialDelay, maxDelay, backoffFactor, jitter, jitterFactor } = options;
    
    // Exponential backoff: delay = initialDelay * (backoffFactor ^ attempt)
    let delay = initialDelay * Math.pow(backoffFactor, attempt);
    
    // Cap at maximum delay
    delay = Math.min(delay, maxDelay);
    
    // Add jitter to prevent thundering herd
    if (jitter) {
        const jitterRange = delay * jitterFactor;
        const randomJitter = (Math.random() * 2 - 1) * jitterRange;
        delay = Math.max(0, delay + randomJitter);
    }
    
    return Math.round(delay);
};

/**
 * Default function to determine if error is retryable
 * @param {Error} error - The error that occurred
 * @returns {boolean} True if should retry
 */
const isRetryableError = (error) => {
    // Network errors
    if (error.code === 'ECONNRESET' || 
        error.code === 'ETIMEDOUT' || 
        error.code === 'ECONNREFUSED' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'EPIPE') {
        return true;
    }
    
    // HTTP 5xx errors (server errors)
    if (error.statusCode >= 500 && error.statusCode < 600) {
        return true;
    }
    
    // Rate limiting (429)
    if (error.statusCode === 429) {
        return true;
    }
    
    // Specific error messages that indicate transient failures
    const retryableMessages = [
        'timeout',
        'network error',
        'temporarily unavailable',
        'too many requests',
        'service unavailable',
        'internal server error',
        'bad gateway',
        'gateway timeout'
    ];
    
    const message = error.message?.toLowerCase() || '';
    if (retryableMessages.some(msg => message.includes(msg))) {
        return true;
    }
    
    // Don't retry validation errors, auth errors, etc.
    if (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
        return false;
    }
    
    return false;
};

/**
 * Sleep for specified duration
 * @param {number} ms - Duration in milliseconds
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => { setTimeout(resolve, ms); });

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN RETRY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Execute an async function with retry logic and exponential backoff
 * 
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry options
 * @returns {Promise<*>} Result of successful execution
 * @throws {Error} Last error if all retries exhausted
 * 
 * @example
 * // Basic usage
 * const result = await withRetry(() => api.sendMessage(msg));
 * 
 * @example
 * // With options
 * const result = await withRetry(
 *   () => api.sendMessage(msg),
 *   { 
 *     maxRetries: 5, 
 *     initialDelay: 500,
 *     module: 'Messenger'
 *   }
 * );
 * 
 * @example
 * // With custom retry condition
 * const result = await withRetry(
 *   () => fetchData(),
 *   { retryOn: (err) => err.code === 'RATE_LIMITED' }
 * );
 */
const withRetry = async (fn, options = {}) => {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const retryCondition = opts.retryOn || opts.shouldRetry || isRetryableError;
    
    let lastError;
    const startTime = Date.now();
    
    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        try {
            // Check timeout
            if (opts.timeout && (Date.now() - startTime) > opts.timeout) {
                throw new ApiError(
                    `Operation timed out after ${opts.timeout}ms`,
                    'RetryTimeout'
                );
            }
            
            // Execute the function
            return await fn();
            
        } catch (error) {
            lastError = error;
            
            // Check if we should retry
            const shouldRetry = attempt < opts.maxRetries && retryCondition(error);
            
            if (!shouldRetry) {
                // No more retries or error not retryable
                if (opts.logRetries && attempt > 0) {
                    logger.error(opts.module, `Failed after ${attempt + 1} attempts: ${error.message}`);
                }
                throw wrapError(error);
            }
            
            // Calculate delay for next retry
            const delay = calculateDelay(attempt, opts);
            
            // Log retry attempt
            if (opts.logRetries) {
                logger.warn(
                    opts.module, 
                    `Attempt ${attempt + 1}/${opts.maxRetries + 1} failed: ${error.message}. ` +
                    `Retrying in ${delay}ms...`
                );
            }
            
            // Call onRetry callback if provided
            if (opts.onRetry) {
                opts.onRetry(error, attempt + 1, delay);
            }
            
            // Wait before retrying
            await sleep(delay);
        }
    }
    
    // Should never reach here, but just in case
    throw lastError;
};

// ═══════════════════════════════════════════════════════════════════════════════
// SPECIALIZED RETRY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Retry with specific settings for Nero API calls (Facebook Messenger)
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Additional options
 * @returns {Promise<*>}
 */
const withNeroRetry = (fn, options = {}) => {
    return withRetry(fn, {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        module: 'Nero',
        retryOn: (error) => {
            // Facebook-specific retry conditions
            if (error.error === 1545012 || // Temporarily blocked
                error.error === 1545034 || // Rate limited
                error.errorSummary?.includes('temporarily blocked')) {
                return true;
            }
            return isRetryableError(error);
        },
        ...options
    });
};

/**
 * Retry with aggressive settings for critical operations
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Additional options
 * @returns {Promise<*>}
 */
const withAggressiveRetry = (fn, options = {}) => {
    return withRetry(fn, {
        maxRetries: 5,
        initialDelay: 500,
        maxDelay: 60000,
        timeout: 120000,
        module: 'Critical',
        ...options
    });
};

/**
 * Retry with minimal settings for fast operations
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Additional options
 * @returns {Promise<*>}
 */
const withQuickRetry = (fn, options = {}) => {
    return withRetry(fn, {
        maxRetries: 2,
        initialDelay: 200,
        maxDelay: 2000,
        timeout: 10000,
        jitter: false,
        logRetries: false,
        ...options
    });
};

// ═══════════════════════════════════════════════════════════════════════════════
// RETRY DECORATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a retryable version of a function
 * @param {Function} fn - Function to wrap
 * @param {Object} options - Retry options
 * @returns {Function} Wrapped function with retry logic
 * 
 * @example
 * const retryableSend = retryable(api.sendMessage.bind(api), { maxRetries: 3 });
 * await retryableSend(messageId, message);
 */
const retryable = (fn, options = {}) => {
    return (...args) => withRetry(() => fn(...args), options);
};

/**
 * Create multiple retryable methods from an object
 * @param {Object} obj - Object containing methods
 * @param {string[]} methodNames - Names of methods to make retryable
 * @param {Object} options - Retry options
 * @returns {Object} Object with retryable methods
 * 
 * @example
 * const retryableApi = makeRetryable(api, ['sendMessage', 'getThreadInfo']);
 */
const makeRetryable = (obj, methodNames, options = {}) => {
    const result = {};
    for (const name of methodNames) {
        if (typeof obj[name] === 'function') {
            result[name] = retryable(obj[name].bind(obj), options);
        }
    }
    return result;
};

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    // Main retry function
    withRetry,
    
    // Specialized retry functions
    withNeroRetry,
    withAggressiveRetry,
    withQuickRetry,
    
    // Utility functions
    retryable,
    makeRetryable,
    isRetryableError,
    calculateDelay,
    sleep,
    
    // Default options (for reference)
    DEFAULT_OPTIONS
};
