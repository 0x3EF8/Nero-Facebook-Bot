/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                       NERO - Integration Tests                               ║
 * ║                  Cross-Module Communication & Dependencies                    ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Integration tests verify that modules work together correctly.
 * These tests check module dependencies, data flow, and interconnections.
 *
 * @module tests/integration/modules.test
 * @version 2.0.0
 */

"use strict";

const { describe, it, beforeAll, afterAll, assert, run } = require("../lib/test-framework");
const {
    ROOT_DIR,
    resolveSrc,
    resolveApi,
    createMockContext,
    createMockDefaultFuncs,
    createMockApi,
    fakeMessage,
    fakeUserId,
    fakeThreadId,
} = require("../lib/helpers");
const path = require("path");
const fs = require("fs");

// ═══════════════════════════════════════════════════════════
// LOGIN FLOW INTEGRATION
// ═══════════════════════════════════════════════════════════

describe("Login Flow Integration", () => {
    describe("Entry Point Chain", () => {
        it("index.js should correctly delegate to core/client", () => {
            const indexModule = require(path.join(ROOT_DIR, "index.js"));
            const clientModule = require(resolveSrc("core", "client.js"));

            // Both should expose the same login function
            assert.isFunction(indexModule);
            assert.isFunction(clientModule.login);
        });

        it("login function should accept credentials object", () => {
            const nero = require(path.join(ROOT_DIR, "index.js"));
            // Login function signature: login(credentials, options, callback) or login(credentials, callback)
            assert.ok(nero.length >= 1, "Login should accept at least one parameter");
        });
    });

    describe("Authentication Modules Chain", () => {
        it("loginHelper should reference correct API path", () => {
            const helperPath = resolveSrc("core", "auth", "loginHelper.js");
            const content = fs.readFileSync(helperPath, "utf8");

            // The path should be relative from auth/ to api/
            assert.ok(
                content.includes('path.join(__dirname, "..", "..", "api")') ||
                    content.includes("path.resolve"),
                "loginHelper should configure API directory path"
            );
        });

        it("buildAPI should be callable", () => {
            const buildAPI = require(resolveSrc("core", "auth", "buildAPI.js"));
            assert.isFunction(buildAPI);
        });

        it("setOptions should process globalOptions", () => {
            const setOptions = require(resolveSrc("core", "auth", "setOptions.js"));
            const ctx = createMockContext();
            const defaultFuncs = createMockDefaultFuncs();
            const api = createMockApi();

            const result = setOptions(defaultFuncs, api, ctx);
            // setOptions returns an object with handler functions
            assert.isObject(result);
        });
    });
});

// ═══════════════════════════════════════════════════════════
// UTILS DEPENDENCY CHAIN
// ═══════════════════════════════════════════════════════════

describe("Utils Dependency Chain", () => {
    describe("Index Aggregator Integration", () => {
        it("utils/index.js should aggregate all submodules", () => {
            const utils = require(resolveSrc("lib", "utils", "index.js"));

            // From network.js
            assert.isFunction(utils.get);
            assert.isFunction(utils.post);
            assert.isFunction(utils.postFormData);

            // From formatters.js
            assert.isFunction(utils.formatDeltaMessage);
            assert.isFunction(utils.formatMessage);

            // From constants.js
            assert.isFunction(utils.getFrom);

            // From clients.js
            assert.isFunction(utils.getAppState);
            assert.isFunction(utils.parseAndCheckLogin);

            // From messageStore.js
            assert.isObject(utils.messageStore);
        });
    });

    describe("Network Module Dependencies", () => {
        it("network.js should create valid cookie jars", () => {
            const network = require(resolveSrc("lib", "utils", "network.js"));
            const jar = network.getJar();

            assert.isObject(jar);
            assert.isFunction(jar.setCookie);
            assert.isFunction(jar.getCookies);
        });

        it("headers.js should work with network requests", () => {
            const headers = require(resolveSrc("lib", "utils", "headers.js"));
            // getHeaders requires a URL parameter
            const headerObj = headers.getHeaders("https://www.facebook.com/", {}, {}, {});

            assert.hasProperty(headerObj, "User-Agent");
            assert.hasProperty(headerObj, "Accept");
        });
    });

    describe("Formatters Dependencies", () => {
        it("formatters.js should use constants.js utilities", () => {
            // If formatters loads without error, the dependency works
            const formatters = require(resolveSrc("lib", "utils", "formatters.js"));
            assert.isFunction(formatters.formatDeltaMessage);
        });
    });

    describe("Clients Module Dependencies", () => {
        it("clients.js should use network.js getJar", () => {
            const clients = require(resolveSrc("lib", "utils", "clients.js"));
            const network = require(resolveSrc("lib", "utils", "network.js"));

            const jar = network.getJar();
            const appState = clients.getAppState(jar);

            assert.isArray(appState);
        });
    });
});

// ═══════════════════════════════════════════════════════════
// API MODULES INTEGRATION WITH UTILS
// ═══════════════════════════════════════════════════════════

describe("API Modules Integration with Utils", () => {
    describe("Messaging API Utils Access", () => {
        it("sendMessage should use utils correctly", () => {
            const sendMessage = require(resolveApi("messaging", "sendMessage.js"));
            const ctx = createMockContext();
            const defaultFuncs = createMockDefaultFuncs();
            const api = createMockApi();

            // If it initializes without error, utils access works
            const fn = sendMessage(defaultFuncs, api, ctx);
            assert.isFunction(fn);
        });

        it("all messaging modules should initialize", () => {
            const messagingDir = resolveApi("messaging");
            const modules = fs.readdirSync(messagingDir).filter((f) => f.endsWith(".js"));

            modules.forEach((mod) => {
                const factory = require(path.join(messagingDir, mod));
                const ctx = createMockContext();
                const defaultFuncs = createMockDefaultFuncs();
                const api = createMockApi();

                // Should not throw
                const result = factory(defaultFuncs, api, ctx);
                assert.ok(
                    typeof result === "function" || typeof result === "object",
                    `${mod} should initialize correctly`
                );
            });
        });
    });

    describe("MQTT API Utils Access", () => {
        it("listenMqtt should initialize with context", () => {
            const listenMqtt = require(resolveApi("mqtt", "listenMqtt.js"));
            const ctx = createMockContext();
            const defaultFuncs = createMockDefaultFuncs();
            const api = createMockApi();

            const fn = listenMqtt(defaultFuncs, api, ctx);
            assert.isFunction(fn);
        });

        it("MQTT delta parser should be accessible", () => {
            const { parseDelta } = require(resolveApi("mqtt", "deltas", "value.js"));
            assert.isFunction(parseDelta);
        });
    });

    describe("Threads API Utils Access", () => {
        it("getThreadInfo should initialize", () => {
            const getThreadInfo = require(resolveApi("threads", "getThreadInfo.js"));
            const ctx = createMockContext();
            const defaultFuncs = createMockDefaultFuncs();
            const api = createMockApi();

            const fn = getThreadInfo(defaultFuncs, api, ctx);
            assert.isFunction(fn);
        });
    });
});

// ═══════════════════════════════════════════════════════════
// MESSAGE STORE INTEGRATION
// ═══════════════════════════════════════════════════════════

describe("MessageStore Integration", () => {
    let messageStore;
    const testMessages = [];

    beforeAll(() => {
        messageStore = require(resolveSrc("lib", "utils", "messageStore.js"));
    });

    afterAll(() => {
        // Cleanup
        testMessages.forEach((id) => messageStore.delete(id));
    });

    describe("Store and Retrieve Chain", () => {
        it("should store messages with all required fields", () => {
            const msg = fakeMessage({
                messageID: "int_test_1",
                body: "Integration test message",
                senderID: fakeUserId(),
                threadID: fakeThreadId(),
            });
            testMessages.push("int_test_1");

            const stored = messageStore.store(msg);
            assert.ok(stored);
        });

        it("should retrieve stored message with correct data", () => {
            const msg = fakeMessage({
                messageID: "int_test_2",
                body: "Another test message",
                attachments: [{ type: "photo", url: "http://example.com/img.jpg" }],
            });
            testMessages.push("int_test_2");

            messageStore.store(msg);
            const retrieved = messageStore.get("int_test_2");

            assert.isObject(retrieved);
            assert.equal(retrieved.body, "Another test message");
            assert.isArray(retrieved.attachments);
            assert.equal(retrieved.attachments.length, 1);
        });

        it("should track message count correctly", () => {
            const before = messageStore.getStats().count;

            const msg = fakeMessage({ messageID: "int_test_3" });
            testMessages.push("int_test_3");
            messageStore.store(msg);

            const after = messageStore.getStats().count;
            assert.equal(after, before + 1);
        });
    });

    describe("Anti-Unsend Feature", () => {
        it("should preserve message after unsend simulation", () => {
            const msg = fakeMessage({
                messageID: "anti_unsend_test",
                body: "This message will be 'unsent'",
            });
            testMessages.push("anti_unsend_test");

            messageStore.store(msg);

            // Simulate "unsend" - message removed from chat but still in store
            const preserved = messageStore.get("anti_unsend_test");
            assert.isObject(preserved);
            assert.equal(preserved.body, "This message will be 'unsent'");
        });
    });
});

// ═══════════════════════════════════════════════════════════
// COOKIE JAR INTEGRATION
// ═══════════════════════════════════════════════════════════

describe("Cookie Jar Integration", () => {
    describe("Jar Creation and Usage", () => {
        it("network.getJar should create usable jar", async () => {
            const { getJar } = require(resolveSrc("lib", "utils", "network.js"));
            const jar = getJar();

            // Should be able to set cookies
            await jar.setCookie("test=value", "https://www.facebook.com");
            const cookies = await jar.getCookies("https://www.facebook.com");

            assert.isArray(cookies);
        });

        it("getAppState should extract cookies from jar", () => {
            const { getAppState } = require(resolveSrc("lib", "utils", "clients.js"));
            const { getJar } = require(resolveSrc("lib", "utils", "network.js"));

            const jar = getJar();
            const state = getAppState(jar);

            assert.isArray(state);
        });
    });
});

// ═══════════════════════════════════════════════════════════
// DEBUG SYSTEM INTEGRATION
// ═══════════════════════════════════════════════════════════

describe("Debug System Integration", () => {
    let debug;

    beforeAll(() => {
        debug = require(resolveSrc("lib", "utils", "debug.js"));
        // Set to silent for tests
        debug.setDebugLevel("silent");
    });

    describe("Debug Level Control", () => {
        it("should start in silent mode", () => {
            // Already set in beforeAll
            assert.equal(debug.getDebugLevel(), "silent");
        });

        it("should track statistics", () => {
            debug.resetStats();
            const stats = debug.getStats();
            assert.isObject(stats);
        });
    });

    describe("Logging Functions", () => {
        it("logging functions should not throw in silent mode", () => {
            // These should all complete without throwing
            debug.logHttpRequest("GET", "https://example.com");
            debug.logHttpResponse(200, "https://example.com");
            debug.logMqttEvent("connect", {});
            debug.logMessage({});
            debug.logApiCall("sendMessage", {});

            assert.ok(true, "All logging functions executed");
        });
    });
});

// ═══════════════════════════════════════════════════════════
// FULL API INITIALIZATION CHAIN
// ═══════════════════════════════════════════════════════════

describe("Full API Initialization Chain", () => {
    it("should initialize all API modules with shared context", () => {
        const ctx = createMockContext();
        const defaultFuncs = createMockDefaultFuncs();
        const api = createMockApi();

        // Core messaging
        const sendMessage = require(resolveApi("messaging", "sendMessage.js"))(
            defaultFuncs,
            api,
            ctx
        );
        const editMessage = require(resolveApi("messaging", "editMessage.js"))(
            defaultFuncs,
            api,
            ctx
        );

        // Threads
        const getThreadInfo = require(resolveApi("threads", "getThreadInfo.js"))(
            defaultFuncs,
            api,
            ctx
        );

        // Users
        const getUserInfo = require(resolveApi("users", "getUserInfo.js"))(defaultFuncs, api, ctx);

        // MQTT
        const listenMqtt = require(resolveApi("mqtt", "listenMqtt.js"))(defaultFuncs, api, ctx);

        // HTTP utilities
        const httpGet = require(resolveApi("http", "httpGet.js"))(defaultFuncs, api, ctx);
        const httpPost = require(resolveApi("http", "httpPost.js"))(defaultFuncs, api, ctx);

        // All should be functions
        assert.isFunction(sendMessage);
        assert.isFunction(editMessage);
        assert.isFunction(getThreadInfo);
        assert.isFunction(getUserInfo);
        assert.isFunction(listenMqtt);
        assert.isFunction(httpGet);
        assert.isFunction(httpPost);
    });

    it("should share context across modules", () => {
        const userId = fakeUserId();
        const ctx = createMockContext({ userID: userId });
        const defaultFuncs = createMockDefaultFuncs();
        const api = createMockApi();

        // Initialize multiple modules with same context
        require(resolveApi("messaging", "sendMessage.js"))(defaultFuncs, api, ctx);
        require(resolveApi("threads", "getThreadInfo.js"))(defaultFuncs, api, ctx);

        // Context should still have same userID
        assert.equal(ctx.userID, userId);
    });
});

// Run all tests
run();
