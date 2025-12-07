/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * NERO BOT - REST API SERVER
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * A lightweight HTTP server for the Nero Bot extension interface.
 * Handles bot statistics, account management, and cookie synchronization.
 * 
 * Features:
 * - API Key Authentication
 * - Rate Limiting (per IP)
 * - Input Validation
 * - CORS Support
 * - Comprehensive Error Handling
 * 
 * @author Nero Bot Team
 * @version 2.1.0
 * @license MIT
 * 
 * API ENDPOINTS:
 * ──────────────────────────────────────────────────────────────────────────────
 * GET  /api/stats              - Bot status, statistics, and accounts list (public)
 * POST /api/cookies            - Upload or validate cookies (requires API key)
 * GET  /api/cookies/appstate   - Retrieve appstate (requires API key)
 * ══════════════════════════════════════════════════════════════════════════════
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// DEPENDENCIES
// ═══════════════════════════════════════════════════════════════════════════════

const http = require('http');
const fs = require('fs');
const path = require('path');
const statsTracker = require('./utils/statsTracker');
const logger = require('./utils/logger');
const config = require('./config/config');
const { 
    AuthenticationError, 
    RateLimitError, 
    ValidationError,
    NotFoundError,
    wrapError 
} = require('./utils/errors');
const { 
    validateAppstate, 
    formatAsAppstate 
} = require('./utils/cookieValidator');

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
    port: config.server?.port || 3000,
    host: config.server?.host || 'localhost',
    accountsDir: path.join(__dirname, 'accounts'),
    cors: {
        origin: '*',
        methods: 'GET, POST, OPTIONS',
        headers: 'Content-Type, Accept, X-API-Key, x-api-key'
    },
    // Security settings
    apiKey: config.server?.apiKey || 'NERO-9F4B-7C2D-A1E8-6H3J-K0LM',
    requireAuth: config.server?.requireAuth ?? true,
    publicEndpoints: config.server?.publicEndpoints || ['/api/stats'],
    // Rate limiting
    rateLimit: {
        enabled: config.server?.rateLimit?.enabled ?? true,
        windowMs: config.server?.rateLimit?.windowMs || 60000,
        maxRequests: config.server?.rateLimit?.maxRequests || 100,
        message: config.server?.rateLimit?.message || 'Too many requests, please try again later'
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * In-memory rate limiter using sliding window algorithm
 */
const rateLimiter = {
    requests: new Map(), // Map<ip, { count, windowStart }>
    
    /**
     * Check if request is allowed and update counter
     * @param {string} ip - Client IP address
     * @returns {{ allowed: boolean, remaining: number, resetTime: number }}
     */
    check(ip) {
        const now = Date.now();
        const windowMs = CONFIG.rateLimit.windowMs;
        const maxRequests = CONFIG.rateLimit.maxRequests;
        
        let record = this.requests.get(ip);
        
        // New IP or window expired
        if (!record || (now - record.windowStart) > windowMs) {
            record = { count: 1, windowStart: now };
            this.requests.set(ip, record);
            return { 
                allowed: true, 
                remaining: maxRequests - 1,
                resetTime: now + windowMs
            };
        }
        
        // Within window
        record.count++;
        
        if (record.count > maxRequests) {
            const resetTime = record.windowStart + windowMs;
            return { 
                allowed: false, 
                remaining: 0,
                resetTime,
                retryAfter: Math.ceil((resetTime - now) / 1000)
            };
        }
        
        return { 
            allowed: true, 
            remaining: maxRequests - record.count,
            resetTime: record.windowStart + windowMs
        };
    },
    
    /**
     * Cleanup expired entries (call periodically)
     */
    cleanup() {
        const now = Date.now();
        const windowMs = CONFIG.rateLimit.windowMs;
        
        for (const [ip, record] of this.requests.entries()) {
            if ((now - record.windowStart) > windowMs) {
                this.requests.delete(ip);
            }
        }
    }
};

// Cleanup rate limiter every 5 minutes
setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000);

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Creates standard CORS headers for API responses
 * @returns {Object} CORS headers object
 */
const getCorsHeaders = () => ({
    'Access-Control-Allow-Origin': CONFIG.cors.origin,
    'Access-Control-Allow-Methods': CONFIG.cors.methods,
    'Access-Control-Allow-Headers': CONFIG.cors.headers
});

/**
 * Sends a JSON response with proper headers
 * @param {http.ServerResponse} res - Response object
 * @param {number} statusCode - HTTP status code
 * @param {Object} data - Data to send as JSON
 */
const sendJson = (res, statusCode, data) => {
    const headers = {
        ...getCorsHeaders(),
        'Content-Type': 'application/json'
    };
    res.writeHead(statusCode, headers);
    res.end(JSON.stringify(data, null, 2));
};

/**
 * Parses JSON body from incoming request
 * @param {http.IncomingMessage} req - Request object
 * @returns {Promise<Object>} Parsed JSON body
 */
const parseJsonBody = (req) => {
    return new Promise((resolve, reject) => {
        let body = '';
        const maxSize = 1024 * 1024; // 1MB limit
        
        req.on('data', chunk => {
            body += chunk.toString();
            // Prevent large payload attacks
            if (body.length > maxSize) {
                reject(new ValidationError('Request body too large (max 1MB)'));
            }
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch {
                reject(new ValidationError('Invalid JSON body'));
            }
        });
        req.on('error', reject);
    });
};

/**
 * Get client IP from request (supports proxies)
 * @param {http.IncomingMessage} req - Request object
 * @returns {string} Client IP address
 */
const getClientIP = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.socket?.remoteAddress ||
           'unknown';
};

/**
 * Extract API key from request headers
 * @param {http.IncomingMessage} req - Request object
 * @returns {string|null} API key or null
 */
const getApiKey = (req) => {
    return req.headers['x-api-key'] || 
           req.headers['authorization']?.replace('Bearer ', '') ||
           null;
};

/**
 * Check if endpoint is public (no auth required)
 * @param {string} pathname - Request pathname
 * @returns {boolean}
 */
const isPublicEndpoint = (pathname) => {
    return CONFIG.publicEndpoints.some(endpoint => 
        pathname === endpoint || pathname.startsWith(endpoint + '/')
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Authentication middleware
 * @param {http.IncomingMessage} req - Request object
 * @param {http.ServerResponse} res - Response object
 * @param {string} pathname - Request pathname
 * @returns {boolean} True if authenticated, false otherwise
 */
const authenticate = (req, res, pathname) => {
    // Skip auth if disabled or public endpoint
    if (!CONFIG.requireAuth || isPublicEndpoint(pathname)) {
        return true;
    }
    
    const apiKey = getApiKey(req);
    
    if (!apiKey) {
        const error = AuthenticationError.invalidApiKey();
        sendJson(res, error.statusCode, error.toResponse());
        logger.warn('Server', `Auth failed: Missing API key from ${getClientIP(req)}`);
        return false;
    }
    
    if (apiKey !== CONFIG.apiKey) {
        const error = AuthenticationError.invalidApiKey();
        sendJson(res, error.statusCode, error.toResponse());
        logger.warn('Server', `Auth failed: Invalid API key from ${getClientIP(req)}`);
        return false;
    }
    
    return true;
};

/**
 * Rate limiting middleware
 * @param {http.IncomingMessage} req - Request object
 * @param {http.ServerResponse} res - Response object
 * @returns {boolean} True if allowed, false if rate limited
 */
const checkRateLimit = (req, res) => {
    if (!CONFIG.rateLimit.enabled) {
        return true;
    }
    
    const ip = getClientIP(req);
    const result = rateLimiter.check(ip);
    
    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', CONFIG.rateLimit.maxRequests);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', result.resetTime);
    
    if (!result.allowed) {
        const error = new RateLimitError(
            CONFIG.rateLimit.message,
            result.retryAfter,
            {
                limit: CONFIG.rateLimit.maxRequests,
                remaining: 0,
                reset: result.resetTime
            }
        );
        
        const headers = {
            ...getCorsHeaders(),
            'Content-Type': 'application/json',
            'Retry-After': result.retryAfter,
            ...error.getHeaders()
        };
        
        res.writeHead(429, headers);
        res.end(JSON.stringify(error.toResponse(), null, 2));
        
        logger.warn('Server', `Rate limited: ${ip} (${result.retryAfter}s cooldown)`);
        return false;
    }
    
    return true;
};

/**
 * Input sanitization - removes potentially dangerous characters
 * @param {string} input - Input string to sanitize
 * @returns {string} Sanitized string
 */
const sanitizeInput = (input) => {
    if (typeof input !== 'string') return input;
    return input
        .replace(/[<>]/g, '') // Remove potential HTML
        .trim();
};

/**
 * Validate UID format (numeric Facebook ID)
 * @param {string} uid - UID to validate
 * @returns {boolean}
 */
const isValidUid = (uid) => {
    return typeof uid === 'string' && /^\d{10,20}$/.test(uid);
};

/**
 * Retrieves list of accounts from accounts directory with user names
 * @returns {Array} Array of account objects with uid, filename, and name
 */
const getAccountsList = () => {
    try {
        if (!fs.existsSync(CONFIG.accountsDir)) {
            return [];
        }
        
        const files = fs.readdirSync(CONFIG.accountsDir);
        
        // Try to get accountManager from main module if available
        let mainModule = null;
        try {
            mainModule = require('./index');
        } catch {
            // index.js not fully loaded yet, that's ok
        }
        
        const fileAccounts = files
            .filter(file => file.endsWith('.json') && !file.includes('example') && !file.includes('template'))
            .map(file => {
                const uid = path.basename(file, '.json');
                // Try to get user name from accountManager if account is logged in
                let loggedInAccount = null;
                if (mainModule && mainModule.accountManager) {
                    loggedInAccount = mainModule.accountManager.getAccountByUserID(uid);
                }
                return {
                    uid: uid,
                    filename: file,
                    name: loggedInAccount?.userName || null,
                    profilePicUrl: loggedInAccount?.profilePicUrl || `https://graph.facebook.com/${uid}/picture?width=100&height=100&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`,
                    status: loggedInAccount?.status || 'offline'
                };
            });
        return fileAccounts;
    } catch (error) {
        logger.error('Server', `Error reading accounts: ${error.message}`);
        return [];
    }
};

/**
 * Reads appstate from a specific account file
 * @param {string} uid - User ID to read appstate for
 * @returns {Object|null} Appstate data or null if not found
 */
const readAppstate = (uid) => {
    try {
        const filePath = path.join(CONFIG.accountsDir, `${uid}.json`);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(content);
        }
        return null;
    } catch (error) {
        logger.error('Server', `Error reading appstate for ${uid}: ${error.message}`);
        return null;
    }
};

/**
 * Saves appstate to account file
 * @param {string} uid - User ID to save appstate for
 * @param {Object} appstate - Appstate data to save
 * @returns {boolean} Success status
 */
const saveAppstate = (uid, appstate) => {
    try {
        if (!fs.existsSync(CONFIG.accountsDir)) {
            fs.mkdirSync(CONFIG.accountsDir, { recursive: true });
        }
        
        const filePath = path.join(CONFIG.accountsDir, `${uid}.json`);
        fs.writeFileSync(filePath, JSON.stringify(appstate, null, 2));
        return true;
    } catch (error) {
        logger.error('Server', `Error saving appstate for ${uid}: ${error.message}`);
        return false;
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// API ROUTE HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

const handlers = {
    
    /**
     * GET /api/stats
     * Returns comprehensive bot statistics and account information
     */
    getStats: (req, res) => {
        const stats = statsTracker.getStats();
        const accounts = getAccountsList();
        const memUsage = process.memoryUsage();
        
        const response = {
            success: true,
            timestamp: new Date().toISOString(),
            
            // Bot info
            bot: {
                name: 'Nero Bot',
                version: '2.0.0',
                online: true,
                status: 'online',
                uptime: stats.uptime || process.uptime(),
                uptimeFormatted: stats.uptimeFormatted || '0s',
                startTime: stats.startTime || new Date().toISOString()
            },
            
            // Messages stats
            messages: {
                total: stats.messages?.total || 0,
                text: stats.messages?.text || 0,
                attachments: stats.messages?.attachments || 0,
                reactions: stats.messages?.reactions || 0
            },
            
            // Commands stats
            commands: {
                total: stats.commands?.total || 0,
                successful: stats.commands?.successful || 0,
                failed: stats.commands?.failed || 0,
                blocked: stats.commands?.blocked || 0
            },
            
            // Events stats
            events: {
                total: stats.events?.total || 0,
                triggered: stats.events?.triggered || 0,
                failed: stats.events?.failed || 0
            },
            
            // Activity stats
            activity: {
                totalAccounts: accounts.length,
                activeUsers: stats.activeUsers || 0,
                activeThreads: stats.activeThreads || 0,
                topCommands: stats.topCommands || []
            },
            
            // System stats
            system: {
                memory: {
                    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
                    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
                    rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`
                },
                nodeVersion: process.version,
                platform: process.platform
            },
            
            // Accounts list
            accounts: {
                total: accounts.length,
                list: accounts
            }
        };
        
        sendJson(res, 200, response);
    },

    /**
     * POST /api/cookies
     * Handles cookie operations: upload or validate
     * Body: { action: 'upload'|'validate', cookies: [...], uid?: string }
     */
    handleCookies: async (req, res) => {
        try {
            const body = await parseJsonBody(req);
            const { action = 'upload', cookies, uid } = body;
            
            // Validate cookies presence
            if (!cookies || !Array.isArray(cookies)) {
                return sendJson(res, 400, {
                    success: false,
                    error: 'Invalid or missing cookies array'
                });
            }

            // Perform strict validation
            const validation = validateAppstate(cookies);

            // Handle validate action
            if (action === 'validate') {
                return sendJson(res, 200, {
                    success: true,
                    valid: validation.valid,
                    uid: validation.details?.uid || null,
                    cookieCount: cookies.length,
                    hasRequired: validation.details?.hasRequired || false,
                    errors: validation.errors,
                    warnings: validation.warnings,
                    message: validation.valid 
                        ? 'Cookies are valid for Facebook authentication'
                        : `Invalid appstate: ${validation.errors.join(', ')}`
                });
            }

            // Handle upload action (default) - STRICT VALIDATION
            if (!validation.valid) {
                return sendJson(res, 400, {
                    success: false,
                    error: 'Invalid appstate - cannot save',
                    details: {
                        errors: validation.errors,
                        warnings: validation.warnings,
                        message: 'Appstate must contain valid c_user, xs, and datr cookies'
                    }
                });
            }

            const targetUid = uid || validation.details.uid;
            
            if (!targetUid) {
                return sendJson(res, 400, {
                    success: false,
                    error: 'Could not determine UID from cookies. Please provide uid in request body.'
                });
            }

            // Format cookies as appstate using shared utility
            const appstate = formatAsAppstate(cookies);

            // Save appstate
            const saved = saveAppstate(targetUid, appstate);
            
            if (saved) {
                sendJson(res, 200, {
                    success: true,
                    message: `Appstate saved successfully for UID: ${targetUid}. System will restart in 3 seconds...`,
                    uid: targetUid,
                    cookieCount: appstate.length,
                    warnings: validation.warnings,
                    restarting: true
                });
                
                // Restart the system after a short delay to allow response to be sent
                logger.info('Server', `New cookies received for UID: ${targetUid}. Restarting system...`);
                setTimeout(() => {
                    logger.info('Server', 'Restarting bot to apply new cookies...');
                    process.exit(0); // Exit cleanly - process manager (pm2/nodemon) will restart
                }, 3000);
            } else {
                sendJson(res, 500, {
                    success: false,
                    error: 'Failed to save appstate to file'
                });
            }
            
        } catch (error) {
            sendJson(res, 400, {
                success: false,
                error: error.message
            });
        }
    },

    /**
     * GET /api/cookies/appstate
     * Retrieves appstate for a specific UID or lists available accounts
     * Query: ?uid=123456789 (optional)
     */
    getAppstate: (req, res) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const uid = sanitizeInput(url.searchParams.get('uid'));
        
        // If UID provided, return specific appstate
        if (uid) {
            // Validate UID format
            if (!isValidUid(uid)) {
                const error = new ValidationError('Invalid UID format. Must be a 10-20 digit number.', { uid: 'invalid format' });
                return sendJson(res, error.statusCode, error.toResponse());
            }
            
            const appstate = readAppstate(uid);
            
            if (appstate) {
                return sendJson(res, 200, {
                    success: true,
                    uid: uid,
                    appstate: appstate,
                    cookieCount: Array.isArray(appstate) ? appstate.length : 0
                });
            } else {
                const error = new NotFoundError('Appstate', uid);
                return sendJson(res, error.statusCode, error.toResponse());
            }
        }
        
        // No UID provided, list available accounts
        const accounts = getAccountsList();
        sendJson(res, 200, {
            success: true,
            message: 'Available accounts. Use ?uid=<uid> to get specific appstate.',
            accounts: accounts,
            total: accounts.length
        });
    },

    /**
     * OPTIONS handler for CORS preflight requests
     */
    handleOptions: (req, res) => {
        res.writeHead(204, getCorsHeaders());
        res.end();
    },

    /**
     * Root endpoint handler - API info
     */
    getRoot: (req, res) => {
        sendJson(res, 200, {
            success: true,
            name: 'Nero Bot API',
            version: '2.1.0',
            status: 'online',
            endpoints: [
                'GET  /              - API info (public)',
                'GET  /api/stats     - Bot statistics (public)',
                'POST /api/cookies   - Upload/validate cookies (auth)',
                'GET  /api/cookies/appstate - Retrieve appstate (auth)'
            ]
        });
    },

    /**
     * 404 handler for unknown routes
     */
    notFound: (req, res) => {
        sendJson(res, 404, {
            success: false,
            error: 'Endpoint not found',
            availableEndpoints: [
                'GET  /api/stats',
                'POST /api/cookies',
                'GET  /api/cookies/appstate'
            ]
        });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// REQUEST ROUTER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Routes incoming requests to appropriate handlers with security middleware
 * @param {http.IncomingMessage} req - Request object
 * @param {http.ServerResponse} res - Response object
 */
const router = async (req, res) => {
    const { method, url } = req;
    const parsedUrl = new URL(url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;
    const clientIP = getClientIP(req);

    // Log request (respects logging config)
    if (config.server?.logRequests !== false) {
        logger.api(method, `${pathname} [${clientIP}]`);
    }

    // CORS preflight - always allowed
    if (method === 'OPTIONS') {
        return handlers.handleOptions(req, res);
    }

    try {
        // 1. Rate Limiting Check
        if (!checkRateLimit(req, res)) {
            return; // Rate limited response already sent
        }

        // 2. Authentication Check
        if (!authenticate(req, res, pathname)) {
            return; // Auth error response already sent
        }

        // 3. Route matching
        const routes = {
            'GET:/': handlers.getRoot,
            'GET:/api/stats': handlers.getStats,
            'POST:/api/cookies': handlers.handleCookies,
            'GET:/api/cookies/appstate': handlers.getAppstate
        };

        const routeKey = `${method}:${pathname}`;
        const handler = routes[routeKey];

        if (handler) {
            await handler(req, res);
        } else {
            handlers.notFound(req, res);
        }
    } catch (error) {
        // Global error handler
        const wrappedError = wrapError(error);
        logger.error('Server', `Request error: ${wrappedError.message}`);
        sendJson(res, wrappedError.statusCode, wrappedError.toResponse());
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// SERVER INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

const server = http.createServer(router);

/**
 * Start the server
 * @param {boolean} silent - Whether to suppress startup logs
 */
const startServer = (silent = false) => {
    server.listen(CONFIG.port, CONFIG.host, () => {
        // Use logger for server startup (respects logging config)
        // Skip logging if silent mode or config says no startup logs
        if (!silent && config.server?.logStartup !== false) {
            logger.divider();
            logger.info('Server', 'API Server starting...');
            logger.info('Server', `Status: ONLINE`);
            logger.info('Server', `Address: http://${CONFIG.host}:${CONFIG.port}`);
            logger.info('Server', '');
            logger.info('Server', 'Security:');
            logger.info('Server', `  Auth Required: ${CONFIG.requireAuth ? 'YES' : 'NO'}`);
            logger.info('Server', `  Rate Limiting: ${CONFIG.rateLimit.enabled ? `${CONFIG.rateLimit.maxRequests} req/${CONFIG.rateLimit.windowMs/1000}s` : 'DISABLED'}`);
            logger.info('Server', `  Public Endpoints: ${CONFIG.publicEndpoints.join(', ')}`);
            logger.info('Server', '');
            logger.info('Server', 'Endpoints:');
            logger.info('Server', '  GET  /api/stats              - Bot statistics (public)');
            logger.info('Server', '  POST /api/cookies            - Upload/validate cookies (auth)');
            logger.info('Server', '  GET  /api/cookies/appstate   - Retrieve appstate (auth)');
            logger.divider();
        }
    });

    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            logger.error('Server', `Port ${CONFIG.port} is already in use`);
        } else {
            logger.error('Server', `Error: ${error.message}`);
        }
        process.exit(1);
    });
};

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE EXPORTS & AUTO-START
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = { server, startServer, CONFIG };

// Auto-start if run directly
if (require.main === module) {
    startServer();
}
