/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * NERO BOT - COOKIE VALIDATOR UTILITY
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Shared cookie/appstate validation logic used by both server.js and extension.
 * Centralizes Facebook authentication cookie validation.
 * 
 * @author Nero Bot Team
 * @version 1.0.0
 * @license MIT
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Required cookies for Facebook authentication
 */
const REQUIRED_COOKIES = ['c_user', 'xs', 'datr'];

/**
 * Recommended cookies for better session stability
 */
const RECOMMENDED_COOKIES = ['sb', 'fr'];

/**
 * All known Facebook cookies
 */
const KNOWN_COOKIES = [
    'c_user',   // User ID
    'xs',       // Session secret
    'datr',     // Browser identifier
    'sb',       // Session binding
    'fr',       // Facebook tracking
    'wd',       // Window dimensions
    'locale',   // User locale
    'presence', // Online presence
    'spin',     // Spinner settings
];

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validates appstate cookies for Facebook authentication
 * @param {Array} cookies - Array of cookie objects
 * @returns {Object} Validation result with valid flag and details
 * 
 * @example
 * const result = validateAppstate(cookies);
 * if (result.valid) {
 *   console.log('UID:', result.details.uid);
 * } else {
 *   console.log('Errors:', result.errors);
 * }
 */
function validateAppstate(cookies) {
    const errors = [];
    const warnings = [];
    
    // Check if cookies is a valid array
    if (!Array.isArray(cookies) || cookies.length === 0) {
        return {
            valid: false,
            errors: ['Appstate must be a non-empty array of cookies'],
            warnings: [],
            details: null
        };
    }
    
    // Get all cookie keys/names
    const cookieMap = new Map();
    for (const cookie of cookies) {
        const key = cookie.key || cookie.name;
        const value = cookie.value;
        
        if (!key) {
            errors.push('Cookie missing key/name property');
            continue;
        }
        
        if (!value || typeof value !== 'string' || value.trim() === '') {
            errors.push(`Cookie "${key}" has empty or invalid value`);
            continue;
        }
        
        cookieMap.set(key, value);
    }
    
    // Check required cookies
    for (const required of REQUIRED_COOKIES) {
        if (!cookieMap.has(required)) {
            errors.push(`Missing required cookie: ${required}`);
        } else {
            const value = cookieMap.get(required);
            
            // Validate c_user is numeric (Facebook UID)
            if (required === 'c_user' && !/^\d+$/.test(value)) {
                errors.push('c_user cookie must be a numeric Facebook UID');
            }
            
            // Validate xs is not empty/placeholder
            if (required === 'xs' && value.length < 10) {
                errors.push('xs cookie appears invalid (too short)');
            }
        }
    }
    
    // Check recommended cookies
    for (const recommended of RECOMMENDED_COOKIES) {
        if (!cookieMap.has(recommended)) {
            warnings.push(`Missing recommended cookie: ${recommended}`);
        }
    }
    
    const uid = cookieMap.get('c_user') || null;
    
    return {
        valid: errors.length === 0,
        errors,
        warnings,
        details: {
            uid,
            totalCookies: cookies.length,
            hasRequired: REQUIRED_COOKIES.every(k => cookieMap.has(k)),
            presentCookies: Array.from(cookieMap.keys())
        }
    };
}

/**
 * Extracts UID from cookies array
 * @param {Array} cookies - Array of cookie objects
 * @returns {string|null} UID or null if not found
 */
function extractUidFromCookies(cookies) {
    if (!Array.isArray(cookies)) return null;
    
    const cUserCookie = cookies.find(c => 
        c.key === 'c_user' || c.name === 'c_user'
    );
    
    return cUserCookie ? (cUserCookie.value || null) : null;
}

/**
 * Formats cookies array into appstate format
 * @param {Array} cookies - Array of cookie objects
 * @returns {Array} Formatted appstate array
 */
function formatAsAppstate(cookies) {
    if (!Array.isArray(cookies)) return [];
    
    return cookies.map(cookie => ({
        key: cookie.key || cookie.name,
        value: cookie.value,
        domain: cookie.domain || '.facebook.com',
        path: cookie.path || '/',
        hostOnly: cookie.hostOnly || false,
        creation: cookie.creation || new Date().toISOString(),
        lastAccessed: new Date().toISOString()
    }));
}

/**
 * Checks if a cookie is a known Facebook cookie
 * @param {string} key - Cookie key/name
 * @returns {boolean}
 */
function isKnownCookie(key) {
    return KNOWN_COOKIES.includes(key);
}

/**
 * Gets a summary of cookie health
 * @param {Object} validationResult - Result from validateAppstate()
 * @returns {Object} Health summary
 */
function getCookieHealth(validationResult) {
    if (!validationResult || !validationResult.valid) {
        return {
            status: 'invalid',
            color: 'red',
            message: 'Invalid appstate - missing required cookies'
        };
    }
    
    const { warnings } = validationResult;
    
    if (warnings.length === 0) {
        return {
            status: 'healthy',
            color: 'green',
            message: 'All cookies present and valid'
        };
    }
    
    if (warnings.length <= 2) {
        return {
            status: 'good',
            color: 'yellow',
            message: `Valid but missing ${warnings.length} recommended cookie(s)`
        };
    }
    
    return {
        status: 'acceptable',
        color: 'orange',
        message: 'Valid but missing multiple recommended cookies'
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    // Main validation function
    validateAppstate,
    
    // Helper functions
    extractUidFromCookies,
    formatAsAppstate,
    isKnownCookie,
    getCookieHealth,
    
    // Constants
    REQUIRED_COOKIES,
    RECOMMENDED_COOKIES,
    KNOWN_COOKIES
};
