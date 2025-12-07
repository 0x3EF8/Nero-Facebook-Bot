/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * NERO BOT - CUSTOM ERROR CLASSES
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Centralized error handling with custom error classes for better
 * error categorization, logging, and user-friendly error messages.
 * 
 * @author Nero Bot Team
 * @version 1.0.0
 * @license MIT
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// BASE ERROR CLASS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Base error class for all Nero Bot errors
 * Provides consistent error structure with codes and context
 */
class BotError extends Error {
    /**
     * @param {string} message - Error message
     * @param {string} code - Error code (e.g., 'AUTH_FAILED', 'RATE_LIMITED')
     * @param {number} statusCode - HTTP status code (default 500)
     * @param {Object} context - Additional context data
     */
    constructor(message, code = 'BOT_ERROR', statusCode = 500, context = {}) {
        super(message);
        this.name = 'BotError';
        this.code = code;
        this.statusCode = statusCode;
        this.context = context;
        this.timestamp = new Date().toISOString();
        
        // Capture stack trace
        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Convert error to JSON-serializable object
     * @param {boolean} includeStack - Include stack trace (default: false)
     * @returns {Object} Error as plain object
     */
    toJSON(includeStack = false) {
        const json = {
            success: false,
            error: {
                name: this.name,
                code: this.code,
                message: this.message,
                statusCode: this.statusCode,
                timestamp: this.timestamp
            }
        };

        if (Object.keys(this.context).length > 0) {
            json.error.context = this.context;
        }

        if (includeStack && this.stack) {
            json.error.stack = this.stack;
        }

        return json;
    }

    /**
     * Create error response for HTTP
     * @returns {Object} HTTP response object
     */
    toResponse() {
        return {
            success: false,
            error: this.message,
            code: this.code,
            ...(Object.keys(this.context).length > 0 && { details: this.context })
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION ERROR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Error for input validation failures
 */
class ValidationError extends BotError {
    /**
     * @param {string} message - Validation error message
     * @param {Object} fields - Object mapping field names to error messages
     */
    constructor(message, fields = {}) {
        super(message, 'VALIDATION_ERROR', 400, { fields });
        this.name = 'ValidationError';
        this.fields = fields;
    }

    /**
     * Create from array of field errors
     * @param {Array<{field: string, message: string}>} errors - Field error array
     * @returns {ValidationError}
     */
    static fromArray(errors) {
        const fields = {};
        for (const { field, message } of errors) {
            fields[field] = message;
        }
        const message = errors.length === 1 
            ? errors[0].message 
            : `Validation failed: ${errors.map(e => e.message).join(', ')}`;
        return new ValidationError(message, fields);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHENTICATION ERROR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Error for authentication/authorization failures
 */
class AuthenticationError extends BotError {
    /**
     * @param {string} message - Auth error message
     * @param {string} code - Specific auth error code
     */
    constructor(message = 'Authentication required', code = 'AUTH_REQUIRED') {
        super(message, code, 401);
        this.name = 'AuthenticationError';
    }

    /**
     * Create invalid API key error
     * @returns {AuthenticationError}
     */
    static invalidApiKey() {
        return new AuthenticationError('Invalid or missing API key', 'INVALID_API_KEY');
    }

    /**
     * Create expired token error
     * @returns {AuthenticationError}
     */
    static expiredToken() {
        return new AuthenticationError('Authentication token has expired', 'TOKEN_EXPIRED');
    }

    /**
     * Create insufficient permissions error
     * @param {string} resource - Resource that was accessed
     * @returns {AuthenticationError}
     */
    static insufficientPermissions(resource = 'resource') {
        const err = new AuthenticationError(
            `Insufficient permissions to access ${resource}`,
            'INSUFFICIENT_PERMISSIONS'
        );
        err.statusCode = 403;
        return err;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMIT ERROR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Error for rate limit violations
 */
class RateLimitError extends BotError {
    /**
     * @param {string} message - Rate limit message
     * @param {number} retryAfter - Seconds until rate limit resets
     * @param {Object} limits - Current limit info
     */
    constructor(message = 'Rate limit exceeded', retryAfter = 60, limits = {}) {
        super(message, 'RATE_LIMITED', 429, { retryAfter, ...limits });
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
        this.limits = limits;
    }

    /**
     * Get headers for rate limit response
     * @returns {Object} Headers object
     */
    getHeaders() {
        return {
            'Retry-After': this.retryAfter,
            'X-RateLimit-Limit': this.limits.limit || 100,
            'X-RateLimit-Remaining': this.limits.remaining || 0,
            'X-RateLimit-Reset': this.limits.reset || Date.now() + (this.retryAfter * 1000)
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOT FOUND ERROR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Error for resource not found
 */
class NotFoundError extends BotError {
    /**
     * @param {string} resource - Resource type that wasn't found
     * @param {string} identifier - Identifier that was searched for
     */
    constructor(resource = 'Resource', identifier = '') {
        const message = identifier 
            ? `${resource} not found: ${identifier}`
            : `${resource} not found`;
        super(message, 'NOT_FOUND', 404, { resource, identifier });
        this.name = 'NotFoundError';
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// API ERROR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Error for external API failures (Facebook API, etc.)
 */
class ApiError extends BotError {
    /**
     * @param {string} message - API error message
     * @param {string} service - Service that failed (e.g., 'Facebook', 'Messenger')
     * @param {Error} originalError - Original error object
     */
    constructor(message, service = 'API', originalError = null) {
        super(message, 'API_ERROR', 502, { 
            service,
            originalMessage: originalError?.message 
        });
        this.name = 'ApiError';
        this.service = service;
        this.originalError = originalError;
    }

    /**
     * Create from Facebook API error
     * @param {Error} error - Original Facebook API error
     * @returns {ApiError}
     */
    static fromFacebook(error) {
        return new ApiError(
            error.message || 'Facebook API request failed',
            'Facebook',
            error
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND ERROR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Error during command execution
 */
class CommandError extends BotError {
    /**
     * @param {string} message - Error message
     * @param {string} command - Command name that failed
     * @param {string} reason - Failure reason code
     */
    constructor(message, command, reason = 'EXECUTION_FAILED') {
        super(message, `COMMAND_${reason}`, 400, { command });
        this.name = 'CommandError';
        this.command = command;
        this.reason = reason;
    }

    /**
     * Create cooldown error
     * @param {string} command - Command name
     * @param {number} remaining - Remaining cooldown seconds
     * @returns {CommandError}
     */
    static cooldown(command, remaining) {
        const err = new CommandError(
            `Command on cooldown. Please wait ${remaining} seconds.`,
            command,
            'COOLDOWN'
        );
        err.context.remaining = remaining;
        return err;
    }

    /**
     * Create permission denied error
     * @param {string} command - Command name
     * @param {string} required - Required permission level
     * @returns {CommandError}
     */
    static permissionDenied(command, required = 'admin') {
        return new CommandError(
            `You don't have permission to use this command. Required: ${required}`,
            command,
            'PERMISSION_DENIED'
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION ERROR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Error for configuration issues
 */
class ConfigurationError extends BotError {
    /**
     * @param {string} message - Config error message
     * @param {string} key - Configuration key that has issues
     */
    constructor(message, key = '') {
        super(message, 'CONFIG_ERROR', 500, { key });
        this.name = 'ConfigurationError';
    }

    /**
     * Create missing config error
     * @param {string} key - Missing configuration key
     * @returns {ConfigurationError}
     */
    static missing(key) {
        return new ConfigurationError(`Missing required configuration: ${key}`, key);
    }

    /**
     * Create invalid config error
     * @param {string} key - Invalid configuration key
     * @param {string} reason - Why it's invalid
     * @returns {ConfigurationError}
     */
    static invalid(key, reason) {
        return new ConfigurationError(`Invalid configuration for ${key}: ${reason}`, key);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR HANDLER UTILITY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Wrap any error into a BotError
 * @param {Error} error - Original error
 * @param {string} defaultMessage - Default message if error has none
 * @returns {BotError} Wrapped error
 */
const wrapError = (error, defaultMessage = 'An unexpected error occurred') => {
    if (error instanceof BotError) {
        return error;
    }

    return new BotError(
        error.message || defaultMessage,
        'INTERNAL_ERROR',
        500,
        { originalName: error.name }
    );
};

/**
 * Check if error is a specific type
 * @param {Error} error - Error to check
 * @param {string} code - Error code to match
 * @returns {boolean}
 */
const isErrorCode = (error, code) => {
    return error instanceof BotError && error.code === code;
};

/**
 * Format error for logging
 * @param {Error} error - Error to format
 * @returns {string} Formatted error string
 */
const formatError = (error) => {
    if (error instanceof BotError) {
        return `[${error.code}] ${error.message}`;
    }
    return `[ERROR] ${error.message || 'Unknown error'}`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    // Error classes
    BotError,
    ValidationError,
    AuthenticationError,
    RateLimitError,
    NotFoundError,
    ApiError,
    CommandError,
    ConfigurationError,

    // Utility functions
    wrapError,
    isErrorCode,
    formatError
};
