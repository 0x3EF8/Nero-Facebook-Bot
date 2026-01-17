/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                         NERO - Test Helpers & Mocks                          ║
 * ║                    Shared Utilities for Testing                               ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Comprehensive testing utilities including:
 *   - Mock objects for API testing
 *   - Fake data generators
 *   - Test context builders
 *   - Spy/Stub implementations
 *
 * @module tests/lib/helpers
 * @version 2.0.0
 */

"use strict";

const path = require("path");
const fs = require("fs");

// ═══════════════════════════════════════════════════════════
// PATH HELPERS
// ═══════════════════════════════════════════════════════════

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const SRC_DIR = path.join(ROOT_DIR, "src");
const API_DIR = path.join(SRC_DIR, "api");
const UTILS_DIR = path.join(SRC_DIR, "lib", "utils");
const CORE_DIR = path.join(SRC_DIR, "core");

/**
 * Resolve path relative to project root
 */
function resolveRoot(...segments) {
    return path.join(ROOT_DIR, ...segments);
}

/**
 * Resolve path relative to src
 */
function resolveSrc(...segments) {
    return path.join(SRC_DIR, ...segments);
}

/**
 * Resolve path relative to api
 */
function resolveApi(...segments) {
    return path.join(API_DIR, ...segments);
}

// ═══════════════════════════════════════════════════════════
// MOCK CONTEXT FACTORY
// ═══════════════════════════════════════════════════════════

/**
 * Create a mock context object for API factory functions
 */
function createMockContext(overrides = {}) {
    return {
        userID: overrides.userID || "100000000000001",
        jar: overrides.jar || createMockJar(),
        globalOptions: {
            logLevel: "silent",
            selfListen: false,
            listenEvents: true,
            updatePresence: false,
            forceLogin: false,
            autoMarkDelivery: true,
            autoMarkRead: false,
            ...overrides.globalOptions,
        },
        fb_dtsg: overrides.fb_dtsg || "AQH1234567890abcdef:AQH0987654321fedcba",
        jazoest: overrides.jazoest || "21234",
        ttstamp: overrides.ttstamp || "2654321234567654321",
        revision: overrides.revision || 1234567,
        ...overrides,
    };
}

/**
 * Create mock default functions
 */
function createMockDefaultFuncs(overrides = {}) {
    return {
        get: overrides.get || createMockGet(),
        post: overrides.post || createMockPost(),
        postFormData: overrides.postFormData || createMockPostFormData(),
    };
}

/**
 * Create mock API object
 */
function createMockApi(overrides = {}) {
    return {
        sendMessage: createMockAsyncFn(),
        getUserInfo: createMockAsyncFn(() => ({})),
        getThreadInfo: createMockAsyncFn(() => ({})),
        getCurrentUserID: () => "100000000000001",
        ...overrides,
    };
}

// ═══════════════════════════════════════════════════════════
// HTTP MOCKS
// ═══════════════════════════════════════════════════════════

/**
 * Create mock GET function
 */
function createMockGet(responses = {}) {
    return function mockGet(url, jar, qs, options) {
        const response = responses[url] || { body: '{"payload":null}' };
        return Promise.resolve(response);
    };
}

/**
 * Create mock POST function
 */
function createMockPost(responses = {}) {
    return function mockPost(url, jar, form, options) {
        const response = responses[url] || { body: '{"payload":null}' };
        return Promise.resolve(response);
    };
}

/**
 * Create mock postFormData function
 */
function createMockPostFormData(responses = {}) {
    return function mockPostFormData(url, jar, form, qs, options) {
        const response = responses[url] || { body: '{"payload":null}' };
        return Promise.resolve(response);
    };
}

// ═══════════════════════════════════════════════════════════
// COOKIE JAR MOCK
// ═══════════════════════════════════════════════════════════

/**
 * Create mock cookie jar
 */
function createMockJar() {
    const cookies = new Map();

    return {
        setCookie: (cookie, url) => {
            cookies.set(cookie.key || cookie, cookie);
            return cookie;
        },
        getCookies: (url) => {
            return Array.from(cookies.values());
        },
        getCookieString: (url) => {
            return Array.from(cookies.values())
                .map((c) => (typeof c === "string" ? c : `${c.key}=${c.value}`))
                .join("; ");
        },
        removeAllCookies: () => {
            cookies.clear();
        },
        toJSON: () => ({
            cookies: Array.from(cookies.values()),
        }),
        _cookies: cookies,
    };
}

// ═══════════════════════════════════════════════════════════
// SPY & STUB
// ═══════════════════════════════════════════════════════════

/**
 * Create a spy function that tracks calls
 */
function createSpy(fn = () => {}) {
    const calls = [];

    const spy = function (...args) {
        const call = {
            args,
            timestamp: Date.now(),
            result: undefined,
            error: undefined,
        };

        try {
            call.result = fn.apply(this, args);
            calls.push(call);
            return call.result;
        } catch (err) {
            call.error = err;
            calls.push(call);
            throw err;
        }
    };

    spy.calls = calls;
    spy.callCount = () => calls.length;
    spy.wasCalled = () => calls.length > 0;
    spy.wasCalledWith = (...args) => {
        return calls.some((call) => JSON.stringify(call.args) === JSON.stringify(args));
    };
    spy.getCall = (index) => calls[index];
    spy.lastCall = () => calls[calls.length - 1];
    spy.reset = () => {
        calls.length = 0;
    };

    return spy;
}

/**
 * Create a stub that returns a specified value
 */
function createStub(returnValue) {
    return createSpy(() => returnValue);
}

/**
 * Create an async stub
 */
function createAsyncStub(returnValue) {
    return createSpy(() => Promise.resolve(returnValue));
}

/**
 * Create mock async function
 */
function createMockAsyncFn(impl = () => {}) {
    return (...args) => Promise.resolve(impl(...args));
}

// ═══════════════════════════════════════════════════════════
// FAKE DATA GENERATORS
// ═══════════════════════════════════════════════════════════

/**
 * Generate fake user ID
 */
function fakeUserId() {
    return String(100000000000000 + Math.floor(Math.random() * 100000000));
}

/**
 * Generate fake thread ID
 */
function fakeThreadId() {
    return String(100000000000000 + Math.floor(Math.random() * 100000000));
}

/**
 * Generate fake message ID
 */
function fakeMessageId() {
    const mid = `mid.$${Date.now()}${Math.random().toString(36).substring(7)}`;
    return mid;
}

/**
 * Generate fake message object
 */
function fakeMessage(overrides = {}) {
    const now = Date.now();
    return {
        messageID: overrides.messageID || fakeMessageId(),
        threadID: overrides.threadID || fakeThreadId(),
        senderID: overrides.senderID || fakeUserId(),
        body: overrides.body || "Test message content",
        timestamp: overrides.timestamp || now,
        attachments: overrides.attachments || [],
        mentions: overrides.mentions || {},
        isGroup: overrides.isGroup || false,
        type: overrides.type || "message",
        ...overrides,
    };
}

/**
 * Generate fake thread info
 */
function fakeThreadInfo(overrides = {}) {
    return {
        threadID: overrides.threadID || fakeThreadId(),
        threadName: overrides.threadName || "Test Thread",
        participantIDs: overrides.participantIDs || [fakeUserId(), fakeUserId()],
        isGroup: overrides.isGroup !== undefined ? overrides.isGroup : true,
        messageCount: overrides.messageCount || Math.floor(Math.random() * 1000),
        emoji: overrides.emoji || null,
        color: overrides.color || null,
        nicknames: overrides.nicknames || {},
        ...overrides,
    };
}

/**
 * Generate fake user info
 */
function fakeUserInfo(overrides = {}) {
    const userId = overrides.userID || fakeUserId();
    return {
        [userId]: {
            id: userId,
            name: overrides.name || "Test User",
            firstName: overrides.firstName || "Test",
            vanity: overrides.vanity || "testuser",
            thumbSrc: overrides.thumbSrc || "https://example.com/thumb.jpg",
            profileUrl: overrides.profileUrl || `https://facebook.com/${userId}`,
            gender: overrides.gender || 2,
            type: overrides.type || "user",
            isFriend: overrides.isFriend !== undefined ? overrides.isFriend : true,
            isBirthday: overrides.isBirthday || false,
            ...overrides,
        },
    };
}

/**
 * Generate fake attachment
 */
function fakeAttachment(type = "image", overrides = {}) {
    const base = {
        ID: overrides.ID || String(Math.floor(Math.random() * 1e15)),
        ...overrides,
    };

    switch (type) {
        case "image":
        case "photo":
            return {
                ...base,
                type: "photo",
                url: overrides.url || "https://example.com/image.jpg",
                previewUrl: overrides.previewUrl || "https://example.com/preview.jpg",
                width: overrides.width || 800,
                height: overrides.height || 600,
            };
        case "video":
            return {
                ...base,
                type: "video",
                url: overrides.url || "https://example.com/video.mp4",
                width: overrides.width || 1280,
                height: overrides.height || 720,
                duration: overrides.duration || 30000,
            };
        case "audio":
            return {
                ...base,
                type: "audio",
                url: overrides.url || "https://example.com/audio.mp3",
                duration: overrides.duration || 60000,
                isVoiceMail: overrides.isVoiceMail || false,
            };
        case "file":
            return {
                ...base,
                type: "file",
                url: overrides.url || "https://example.com/file.pdf",
                filename: overrides.filename || "document.pdf",
                fileSize: overrides.fileSize || 1024000,
            };
        case "sticker":
            return {
                ...base,
                type: "sticker",
                url: overrides.url || "https://example.com/sticker.png",
                stickerID: overrides.stickerID || "12345",
                packID: overrides.packID || "54321",
            };
        default:
            return base;
    }
}

// ═══════════════════════════════════════════════════════════
// FILE SYSTEM HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * Check if a file exists
 */
function fileExists(filePath) {
    try {
        return fs.existsSync(filePath);
    } catch {
        return false;
    }
}

/**
 * Check if a directory exists
 */
function dirExists(dirPath) {
    try {
        return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
    } catch {
        return false;
    }
}

/**
 * Get all files in directory recursively
 */
function getAllFiles(dirPath, extension = null) {
    const files = [];

    function walk(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (!extension || entry.name.endsWith(extension)) {
                files.push(fullPath);
            }
        }
    }

    walk(dirPath);
    return files;
}

/**
 * Get module count in a directory
 */
function getModuleCount(dirPath) {
    if (!dirExists(dirPath)) return 0;
    return fs.readdirSync(dirPath).filter((f) => f.endsWith(".js")).length;
}

// ═══════════════════════════════════════════════════════════
// MODULE HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * Safely require a module
 */
function safeRequire(modulePath) {
    try {
        return require(modulePath);
    } catch (err) {
        return { error: err };
    }
}

/**
 * Test if a module is a factory function
 */
function isFactoryFunction(modulePath) {
    const mod = safeRequire(modulePath);
    if (mod.error) return false;
    return typeof mod === "function";
}

/**
 * Test if a module exports specific functions
 */
function exportsFunction(modulePath, ...funcNames) {
    const mod = safeRequire(modulePath);
    if (mod.error) return false;
    return funcNames.every((fn) => typeof mod[fn] === "function");
}

/**
 * Initialize an API module with mock context
 */
function initApiModule(modulePath, contextOverrides = {}) {
    const factory = require(modulePath);
    const ctx = createMockContext(contextOverrides);
    const defaultFuncs = createMockDefaultFuncs();
    const api = createMockApi();

    return factory(defaultFuncs, api, ctx);
}

// ═══════════════════════════════════════════════════════════
// WAIT/ASYNC HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * Wait for specified milliseconds
 */
function wait(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/**
 * Wait until condition is true
 */
async function waitUntil(condition, timeout = 5000, interval = 100) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (await condition()) return true;
        await wait(interval);
    }
    return false;
}

/**
 * Retry a function until it succeeds
 */
async function retry(fn, attempts = 3, delay = 100) {
    let lastError;
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (i < attempts - 1) await wait(delay);
        }
    }
    throw lastError;
}

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════

module.exports = {
    // Paths
    ROOT_DIR,
    SRC_DIR,
    API_DIR,
    UTILS_DIR,
    CORE_DIR,
    resolveRoot,
    resolveSrc,
    resolveApi,

    // Mocks
    createMockContext,
    createMockDefaultFuncs,
    createMockApi,
    createMockGet,
    createMockPost,
    createMockPostFormData,
    createMockJar,
    createMockAsyncFn,

    // Spy/Stub
    createSpy,
    createStub,
    createAsyncStub,

    // Fake data
    fakeUserId,
    fakeThreadId,
    fakeMessageId,
    fakeMessage,
    fakeThreadInfo,
    fakeUserInfo,
    fakeAttachment,

    // File system
    fileExists,
    dirExists,
    getAllFiles,
    getModuleCount,

    // Module helpers
    safeRequire,
    isFactoryFunction,
    exportsFunction,
    initApiModule,

    // Async helpers
    wait,
    waitUntil,
    retry,
};
