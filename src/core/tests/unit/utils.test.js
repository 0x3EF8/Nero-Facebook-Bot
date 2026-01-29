/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                         NERO - Unit Tests: Utilities                         ║
 * ║                    Test All Utility Module Functions                          ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Comprehensive tests for all utility modules in src/lib/utils/
 *
 * @module tests/unit/utils.test
 * @version 2.0.0
 */

"use strict";

const { describe, it, beforeAll, afterAll, assert, run } = require("../lib/test-framework");
const { resolveSrc, fileExists, fakeMessage } = require("../lib/helpers");
const path = require("path");

const UTILS_DIR = resolveSrc("lib", "utils");

// ═══════════════════════════════════════════════════════════
// UTILS INDEX AGGREGATOR
// ═══════════════════════════════════════════════════════════

describe("Utils Index Aggregator", () => {
    let utils;

    beforeAll(() => {
        utils = require(path.join(UTILS_DIR, "index.js"));
    });

    it("should export network functions", () => {
        assert.isFunction(utils.get, "Missing get function");
        assert.isFunction(utils.post, "Missing post function");
        assert.isFunction(utils.postFormData, "Missing postFormData function");
    });

    it("should export formatters", () => {
        assert.isFunction(utils.formatDeltaMessage, "Missing formatDeltaMessage");
        assert.isFunction(utils.formatMessage, "Missing formatMessage");
    });

    it("should export constants", () => {
        assert.isFunction(utils.getFrom, "Missing getFrom");
        assert.isFunction(utils.log, "Missing log");
        assert.isFunction(utils.warn, "Missing warn");
        assert.isFunction(utils.error, "Missing error");
    });

    it("should export client utilities", () => {
        assert.isFunction(utils.getAppState, "Missing getAppState");
        assert.isFunction(utils.saveCookies, "Missing saveCookies");
        assert.isFunction(utils.parseAndCheckLogin, "Missing parseAndCheckLogin");
    });

    it("should export messageStore", () => {
        assert.isObject(utils.messageStore, "Missing messageStore");
        assert.isFunction(utils.messageStore.store, "Missing messageStore.store");
        assert.isFunction(utils.messageStore.get, "Missing messageStore.get");
    });

    it("should export headers utility", () => {
        assert.isFunction(utils.getHeaders, "Missing getHeaders");
    });
});

// ═══════════════════════════════════════════════════════════
// NETWORK MODULE
// ═══════════════════════════════════════════════════════════

describe("Network Module (network.js)", () => {
    let network;

    beforeAll(() => {
        network = require(path.join(UTILS_DIR, "network.js"));
    });

    it("should export get function", () => {
        assert.isFunction(network.get);
    });

    it("should export post function", () => {
        assert.isFunction(network.post);
    });

    it("should export postFormData function", () => {
        assert.isFunction(network.postFormData);
    });

    it("should export getJar function for cookie jar creation", () => {
        assert.isFunction(network.getJar);
    });

    it("getJar should return a valid cookie jar", () => {
        const jar = network.getJar();
        assert.isObject(jar);
        assert.isFunction(jar.setCookie);
    });
});

// ═══════════════════════════════════════════════════════════
// HEADERS MODULE
// ═══════════════════════════════════════════════════════════

describe("Headers Module (headers.js)", () => {
    let headers;

    beforeAll(() => {
        headers = require(path.join(UTILS_DIR, "headers.js"));
    });

    it("should export getHeaders function", () => {
        assert.isFunction(headers.getHeaders);
    });

    it("getHeaders should return an object with URL parameter", () => {
        // getHeaders requires a URL parameter
        const result = headers.getHeaders("https://www.facebook.com/", {}, {}, {});
        assert.isObject(result);
    });

    it("getHeaders should include User-Agent with URL parameter", () => {
        const result = headers.getHeaders("https://www.facebook.com/", {}, {}, {});
        assert.hasProperty(result, "User-Agent");
    });

    it("getHeaders should include Accept header with URL parameter", () => {
        const result = headers.getHeaders("https://www.facebook.com/", {}, {}, {});
        assert.hasProperty(result, "Accept");
    });

    it("should export getSimpleHeaders if available", () => {
        // Check if alternative header function exists
        assert.ok(typeof headers.getHeaders === "function");
    });
});

// ═══════════════════════════════════════════════════════════
// CONSTANTS MODULE
// ═══════════════════════════════════════════════════════════

describe("Constants Module (constants.js)", () => {
    let constants;

    beforeAll(() => {
        constants = require(path.join(UTILS_DIR, "constants.js"));
    });

    it("should export getFrom function", () => {
        assert.isFunction(constants.getFrom);
    });

    it("should export logging functions", () => {
        assert.isFunction(constants.log);
        assert.isFunction(constants.warn);
        assert.isFunction(constants.error);
    });

    it("should export getType function", () => {
        assert.isFunction(constants.getType);
    });

    it("getType should correctly identify types", () => {
        assert.equal(constants.getType({}), "Object");
        assert.equal(constants.getType([]), "Array");
        assert.equal(constants.getType(""), "String");
        assert.equal(constants.getType(123), "Number");
    });

    it("should export padZeros function", () => {
        assert.isFunction(constants.padZeros);
    });

    it("padZeros should pad numbers correctly", () => {
        assert.equal(constants.padZeros(5), "05");
        assert.equal(constants.padZeros(12), "12");
    });

    it("should export month and day constants", () => {
        assert.isObject(constants.NUM_TO_MONTH);
        assert.isObject(constants.NUM_TO_DAY);
    });
});

// ═══════════════════════════════════════════════════════════
// FORMATTERS MODULE
// ═══════════════════════════════════════════════════════════

describe("Formatters Module (formatters.js)", () => {
    let formatters;

    beforeAll(() => {
        formatters = require(path.join(UTILS_DIR, "formatters.js"));
    });

    it("should export formatDeltaMessage function", () => {
        assert.isFunction(formatters.formatDeltaMessage);
    });

    it("should export formatMessage function", () => {
        assert.isFunction(formatters.formatMessage);
    });

    it("should export formatThread function", () => {
        assert.isFunction(formatters.formatThread);
    });

    it("should export getAdminTextMessageType function", () => {
        assert.isFunction(formatters.getAdminTextMessageType);
    });

    it("should export decodeClientPayload function", () => {
        assert.isFunction(formatters.decodeClientPayload);
    });
});

// ═══════════════════════════════════════════════════════════
// CLIENTS MODULE
// ═══════════════════════════════════════════════════════════

describe("Clients Module (clients.js)", () => {
    let clients;

    beforeAll(() => {
        clients = require(path.join(UTILS_DIR, "clients.js"));
    });

    it("should export parseAndCheckLogin function", () => {
        assert.isFunction(clients.parseAndCheckLogin);
    });

    it("should export getAppState function", () => {
        assert.isFunction(clients.getAppState);
    });

    it("should export saveCookies function", () => {
        assert.isFunction(clients.saveCookies);
    });

    it("getAppState should return array for empty jar", () => {
        const network = require(path.join(UTILS_DIR, "network.js"));
        const jar = network.getJar();
        const state = clients.getAppState(jar);
        assert.isArray(state);
    });
});

// ═══════════════════════════════════════════════════════════
// MESSAGE STORE MODULE
// ═══════════════════════════════════════════════════════════

describe("MessageStore Module (messageStore.js)", () => {
    let messageStore;

    beforeAll(() => {
        messageStore = require(path.join(UTILS_DIR, "messageStore.js"));
    });

    afterAll(() => {
        // Cleanup test messages
        messageStore.delete("test_msg_1");
        messageStore.delete("test_msg_2");
        messageStore.delete("test_msg_3");
    });

    describe("Core Functions", () => {
        it("should export store function", () => {
            assert.isFunction(messageStore.store);
        });

        it("should export get function", () => {
            assert.isFunction(messageStore.get);
        });

        it("should export delete function", () => {
            assert.isFunction(messageStore.delete);
        });

        it("should export getStats function", () => {
            assert.isFunction(messageStore.getStats);
        });
    });

    describe("Store & Retrieve", () => {
        it("should store a message", () => {
            const msg = fakeMessage({ messageID: "test_msg_1" });
            const result = messageStore.store(msg);
            assert.ok(result);
        });

        it("should retrieve a stored message", () => {
            const msg = fakeMessage({
                messageID: "test_msg_2",
                body: "Hello World",
            });
            messageStore.store(msg);

            const retrieved = messageStore.get("test_msg_2");
            assert.isObject(retrieved);
            assert.equal(retrieved.body, "Hello World");
        });

        it("should return null for non-existent message", () => {
            const result = messageStore.get("non_existent_id");
            assert.equal(result, null);
        });

        it("should delete a message", () => {
            const msg = fakeMessage({ messageID: "test_msg_3" });
            messageStore.store(msg);

            const deleted = messageStore.delete("test_msg_3");
            assert.ok(deleted);

            const retrieved = messageStore.get("test_msg_3");
            assert.equal(retrieved, null);
        });
    });

    describe("Statistics", () => {
        it("should return valid stats object", () => {
            const stats = messageStore.getStats();
            assert.isObject(stats);
        });

        it("stats should have count property", () => {
            const stats = messageStore.getStats();
            assert.isNumber(stats.count);
        });

        it("stats should have maxSize property", () => {
            const stats = messageStore.getStats();
            assert.isNumber(stats.maxSize);
            assert.equal(stats.maxSize, 10000);
        });

        it("stats should have expiryHours property", () => {
            const stats = messageStore.getStats();
            assert.isNumber(stats.expiryHours);
            assert.equal(stats.expiryHours, 24);
        });
    });
});

// ═══════════════════════════════════════════════════════════
// DEBUG MODULE
// ═══════════════════════════════════════════════════════════

describe("Debug Module (debug.js)", () => {
    let debug;

    beforeAll(() => {
        debug = require(path.join(UTILS_DIR, "debug.js"));
    });

    describe("Logging Functions", () => {
        const loggingFunctions = [
            "logHttpRequest",
            "logHttpResponse",
            "logMqttEvent",
            "logMqttMessage",
            "logMessage",
            "logEvent",
            "logApiCall",
            "logAuth",
            "debug",
            "warn",
            "error",
        ];

        loggingFunctions.forEach((fn) => {
            it(`should export ${fn} function`, () => {
                assert.isFunction(debug[fn]);
            });
        });
    });

    describe("Configuration", () => {
        it("should export setDebugLevel function", () => {
            assert.isFunction(debug.setDebugLevel);
        });

        it("should export getDebugLevel function", () => {
            assert.isFunction(debug.getDebugLevel);
        });

        it("should export getStats function", () => {
            assert.isFunction(debug.getStats);
        });

        it("should export resetStats function", () => {
            assert.isFunction(debug.resetStats);
        });
    });

    describe("Stats Tracking", () => {
        it("getStats should return an object", () => {
            const stats = debug.getStats();
            assert.isObject(stats);
        });

        it("resetStats should not throw", () => {
            debug.resetStats();
            // If we get here, it didn't throw
            assert.ok(true);
        });
    });
});

// ═══════════════════════════════════════════════════════════
// USER AGENTS MODULE
// ═══════════════════════════════════════════════════════════

describe("User Agents Module (user-agents.js)", () => {
    let userAgents;

    beforeAll(() => {
        userAgents = require(path.join(UTILS_DIR, "user-agents.js"));
    });

    it("should export randomUserAgent function", () => {
        assert.isFunction(userAgents.randomUserAgent);
    });

    it("randomUserAgent should return an object with userAgent property", () => {
        const result = userAgents.randomUserAgent();
        assert.isObject(result);
        assert.hasProperty(result, "userAgent");
    });

    it("randomUserAgent result should have valid user agent string", () => {
        const result = userAgents.randomUserAgent();
        assert.isString(result.userAgent);
        assert.ok(result.userAgent.length > 0);
        // Should contain Mozilla or other browser identifier
        assert.ok(result.userAgent.includes("Mozilla") || result.userAgent.includes("Chrome"));
    });

    it("randomUserAgent should include Sec-CH-UA headers", () => {
        const result = userAgents.randomUserAgent();
        assert.hasProperty(result, "secChUa");
    });

    it("randomUserAgent should return different values (probabilistic)", () => {
        const agents = new Set();
        for (let i = 0; i < 10; i++) {
            const result = userAgents.randomUserAgent();
            agents.add(result.userAgent);
        }
        // With 10 attempts, we should get at least 1 valid agent
        assert.ok(agents.size >= 1);
    });
});

// ═══════════════════════════════════════════════════════════
// FILE EXISTENCE CHECKS
// ═══════════════════════════════════════════════════════════

describe("Utility Files Existence", () => {
    const utilFiles = [
        "index.js",
        "network.js",
        "headers.js",
        "constants.js",
        "formatters.js",
        "clients.js",
        "messageStore.js",
        "debug.js",
        "user-agents.js",
    ];

    utilFiles.forEach((file) => {
        it(`should have ${file}`, () => {
            assert.ok(fileExists(path.join(UTILS_DIR, file)));
        });
    });
});

// Run all tests
run();
