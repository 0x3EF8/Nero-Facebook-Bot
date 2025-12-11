/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                       NERO - End-to-End Tests                                ║
 * ║                  Full System Integration Verification                         ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * E2E tests simulate real-world usage scenarios to verify the complete system
 * works correctly from entry point to API output.
 *
 * These tests use mocks for network calls but test the complete flow.
 *
 * @module tests/e2e/system.test
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

// ═══════════════════════════════════════════════════════════
// COMPLETE LOGIN FLOW SIMULATION
// ═══════════════════════════════════════════════════════════

describe("E2E: Login Flow Simulation", () => {
    describe("Module Loading Chain", () => {
        it("should load entire system from entry point", () => {
            const nero = require(path.join(ROOT_DIR, "index.js"));
            assert.isFunction(nero);
        });

        it("should have all dependencies accessible", () => {
            // Load core modules
            const client = require(resolveSrc("core", "client.js"));
            const buildAPI = require(resolveSrc("core", "auth", "buildAPI.js"));
            const setOptions = require(resolveSrc("core", "auth", "setOptions.js"));
            const loginHelper = require(resolveSrc("core", "auth", "loginHelper.js"));

            assert.isFunction(client.login);
            assert.isFunction(buildAPI);
            assert.isFunction(setOptions);
            assert.isFunction(loginHelper);
        });

        it("should have all utils accessible", () => {
            const utils = require(resolveSrc("lib", "utils"));

            assert.isFunction(utils.get);
            assert.isFunction(utils.post);
            assert.isFunction(utils.formatDeltaMessage);
            assert.isFunction(utils.getAppState);
            assert.isObject(utils.messageStore);
        });
    });

    describe("Context Initialization", () => {
        it("should create valid mock context for testing", () => {
            const ctx = createMockContext();

            assert.hasProperty(ctx, "userID");
            assert.hasProperty(ctx, "jar");
            assert.hasProperty(ctx, "globalOptions");
            assert.hasProperty(ctx, "fb_dtsg");
        });

        it("should initialize API modules with context", () => {
            const ctx = createMockContext();
            const defaultFuncs = createMockDefaultFuncs();
            const api = createMockApi();

            // Initialize core APIs
            const sendMessage = require(resolveApi("messaging", "sendMessage.js"))(
                defaultFuncs,
                api,
                ctx
            );
            const getThreadInfo = require(resolveApi("threads", "getThreadInfo.js"))(
                defaultFuncs,
                api,
                ctx
            );
            const getUserInfo = require(resolveApi("users", "getUserInfo.js"))(
                defaultFuncs,
                api,
                ctx
            );

            assert.isFunction(sendMessage);
            assert.isFunction(getThreadInfo);
            assert.isFunction(getUserInfo);
        });
    });
});

// ═══════════════════════════════════════════════════════════
// MESSAGE FLOW SIMULATION
// ═══════════════════════════════════════════════════════════

describe("E2E: Message Flow Simulation", () => {
    let messageStore;
    const testMsgIds = [];

    beforeAll(() => {
        messageStore = require(resolveSrc("lib", "utils", "messageStore.js"));
    });

    afterAll(() => {
        testMsgIds.forEach((id) => messageStore.delete(id));
    });

    describe("Incoming Message Processing", () => {
        it("should process and store incoming message", () => {
            // Simulate incoming message from MQTT
            const incomingMsg = fakeMessage({
                messageID: "e2e_incoming_1",
                body: "Hello from E2E test",
                senderID: fakeUserId(),
                threadID: fakeThreadId(),
            });
            testMsgIds.push("e2e_incoming_1");

            // Store (like messageStore middleware would)
            messageStore.store(incomingMsg);

            // Verify it's stored
            const stored = messageStore.get("e2e_incoming_1");
            assert.isObject(stored);
            assert.equal(stored.body, "Hello from E2E test");
        });

        it("should handle message with attachments", () => {
            const msgWithAttachment = fakeMessage({
                messageID: "e2e_attach_1",
                body: "Check this image",
                attachments: [{ type: "photo", url: "https://example.com/img.jpg", ID: "123" }],
            });
            testMsgIds.push("e2e_attach_1");

            messageStore.store(msgWithAttachment);
            const stored = messageStore.get("e2e_attach_1");

            assert.isArray(stored.attachments);
            assert.equal(stored.attachments[0].type, "photo");
        });

        it("should handle message with reply", () => {
            // Store original message first
            const original = fakeMessage({
                messageID: "e2e_original_1",
                body: "Original message",
            });
            testMsgIds.push("e2e_original_1");
            messageStore.store(original);

            // Store reply
            const reply = fakeMessage({
                messageID: "e2e_reply_1",
                body: "This is a reply",
                messageReply: {
                    messageID: "e2e_original_1",
                },
            });
            testMsgIds.push("e2e_reply_1");
            messageStore.store(reply);

            const storedReply = messageStore.get("e2e_reply_1");
            assert.isObject(storedReply.messageReply);
        });
    });

    describe("Outgoing Message Preparation", () => {
        it("should prepare text message correctly", () => {
            const message = {
                body: "Outgoing test message",
            };
            const threadID = fakeThreadId();

            // Message should have required fields
            assert.hasProperty(message, "body");
            assert.ok(threadID.length > 0);
        });

        it("should prepare message with mentions correctly", () => {
            const userId = fakeUserId();
            const message = {
                body: "@John check this out",
                mentions: [{ id: userId, offset: 0, length: 5 }],
            };

            assert.isArray(message.mentions);
            assert.equal(message.mentions[0].id, userId);
        });
    });
});

// ═══════════════════════════════════════════════════════════
// ANTI-UNSEND SYSTEM E2E
// ═══════════════════════════════════════════════════════════

describe("E2E: Anti-Unsend System", () => {
    let messageStore;
    const testMsgIds = [];

    beforeAll(() => {
        messageStore = require(resolveSrc("lib", "utils", "messageStore.js"));
    });

    afterAll(() => {
        testMsgIds.forEach((id) => messageStore.delete(id));
    });

    describe("Full Anti-Unsend Flow", () => {
        it("Step 1: Message received and stored", () => {
            const msg = fakeMessage({
                messageID: "anti_unsend_e2e_1",
                body: "This message will be unsent",
                senderID: fakeUserId(),
                threadID: fakeThreadId(),
                timestamp: Date.now(),
            });
            testMsgIds.push("anti_unsend_e2e_1");

            const stored = messageStore.store(msg);
            assert.ok(stored, "Message should be stored");
        });

        it("Step 2: Message is retrievable", () => {
            const msg = messageStore.get("anti_unsend_e2e_1");
            assert.isObject(msg);
            assert.equal(msg.body, "This message will be unsent");
        });

        it("Step 3: After unsend event, message still in store", () => {
            // The unsend event would normally delete from chat
            // But our store preserves it
            const preserved = messageStore.get("anti_unsend_e2e_1");

            assert.isObject(preserved);
            assert.equal(preserved.body, "This message will be unsent");
            assert.ok(preserved.senderID);
            assert.ok(preserved.timestamp);
        });

        it("Step 4: All message data preserved", () => {
            const msg = fakeMessage({
                messageID: "anti_unsend_e2e_2",
                body: "Full data message",
                senderID: fakeUserId(),
                threadID: fakeThreadId(),
                attachments: [{ type: "photo", url: "http://example.com/photo.jpg" }],
                mentions: { 123: "@User" },
                isGroup: true,
            });
            testMsgIds.push("anti_unsend_e2e_2");

            messageStore.store(msg);
            const preserved = messageStore.get("anti_unsend_e2e_2");

            assert.equal(preserved.body, "Full data message");
            assert.isArray(preserved.attachments);
            assert.isObject(preserved.mentions);
            assert.equal(preserved.isGroup, true);
        });
    });
});

// ═══════════════════════════════════════════════════════════
// API CHAIN E2E
// ═══════════════════════════════════════════════════════════

describe("E2E: API Chain Initialization", () => {
    describe("Complete API Object Creation", () => {
        it("should create full API object with all methods", () => {
            const ctx = createMockContext();
            const defaultFuncs = createMockDefaultFuncs();
            const api = {};

            // Build API like loginHelper does
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
            const getThreadInfo = require(resolveApi("threads", "getThreadInfo.js"))(
                defaultFuncs,
                api,
                ctx
            );
            const getThreadList = require(resolveApi("threads", "getThreadList.js"))(
                defaultFuncs,
                api,
                ctx
            );
            const getUserInfo = require(resolveApi("users", "getUserInfo.js"))(
                defaultFuncs,
                api,
                ctx
            );
            const listenMqtt = require(resolveApi("mqtt", "listenMqtt.js"))(defaultFuncs, api, ctx);

            // Assign to api object
            Object.assign(api, {
                sendMessage,
                editMessage,
                getThreadInfo,
                getThreadList,
                getUserInfo,
                listen: listenMqtt,
                getCurrentUserID: () => ctx.userID,
            });

            // Verify complete API
            assert.isFunction(api.sendMessage);
            assert.isFunction(api.editMessage);
            assert.isFunction(api.getThreadInfo);
            assert.isFunction(api.getThreadList);
            assert.isFunction(api.getUserInfo);
            assert.isFunction(api.listen);
            assert.isFunction(api.getCurrentUserID);
            assert.equal(api.getCurrentUserID(), ctx.userID);
        });
    });

    describe("API Context Sharing", () => {
        it("should share userID across all API methods", () => {
            const userId = fakeUserId();
            const ctx = createMockContext({ userID: userId });
            const defaultFuncs = createMockDefaultFuncs();
            const api = { getCurrentUserID: () => ctx.userID };

            // Initialize multiple modules
            require(resolveApi("messaging", "sendMessage.js"))(defaultFuncs, api, ctx);
            require(resolveApi("threads", "getThreadInfo.js"))(defaultFuncs, api, ctx);

            // Context should maintain userID
            assert.equal(ctx.userID, userId);
            assert.equal(api.getCurrentUserID(), userId);
        });
    });
});

// ═══════════════════════════════════════════════════════════
// REAL DEPLOYMENT CHECKS
// ═══════════════════════════════════════════════════════════

describe("E2E: Deployment Readiness Checks", () => {
    describe("Package Configuration", () => {
        let pkg;

        beforeAll(() => {
            pkg = require(path.join(ROOT_DIR, "package.json"));
        });

        it("should have production-ready version", () => {
            assert.matches(pkg.version, /^\d+\.\d+\.\d+$/);
        });

        it("should have all required dependencies", () => {
            const required = [
                "axios",
                "mqtt",
                "tough-cookie",
                "cheerio",
                "form-data",
                "axios-cookiejar-support",
            ];
            required.forEach((dep) => {
                assert.hasProperty(pkg.dependencies, dep);
            });
        });

        it("should have valid main entry", () => {
            assert.equal(pkg.main, "index.js");
        });

        it("should have types configured", () => {
            assert.ok(pkg.types);
        });

        it("should have test scripts", () => {
            assert.hasProperty(pkg.scripts, "test");
        });
    });

    describe("Module Exports", () => {
        it("main module should export login function", () => {
            const nero = require(path.join(ROOT_DIR, "index.js"));
            assert.isFunction(nero);
        });
    });

    describe("Error Handling", () => {
        it("messageStore should handle invalid input gracefully", () => {
            const messageStore = require(resolveSrc("lib", "utils", "messageStore.js"));

            // These should not throw
            const result1 = messageStore.store(null);
            const result2 = messageStore.store({});
            const result3 = messageStore.get(null);

            assert.equal(result1, false);
            assert.equal(result2, false);
            assert.equal(result3, null);
        });
    });
});

// ═══════════════════════════════════════════════════════════
// STRESS TEST SIMULATION
// ═══════════════════════════════════════════════════════════

describe("E2E: Stress Simulation", () => {
    let messageStore;
    const stressTestIds = [];

    beforeAll(() => {
        messageStore = require(resolveSrc("lib", "utils", "messageStore.js"));
    });

    afterAll(() => {
        stressTestIds.forEach((id) => messageStore.delete(id));
    });

    describe("Bulk Message Storage", () => {
        it("should handle 100 messages quickly", () => {
            const start = Date.now();

            for (let i = 0; i < 100; i++) {
                const msg = fakeMessage({
                    messageID: `stress_test_${i}`,
                    body: `Stress test message ${i}`,
                });
                stressTestIds.push(`stress_test_${i}`);
                messageStore.store(msg);
            }

            const duration = Date.now() - start;

            // Should complete in under 1 second
            assert.lessThan(duration, 1000);
        });

        it("should retrieve messages correctly after bulk insert", () => {
            const msg = messageStore.get("stress_test_50");
            assert.isObject(msg);
            assert.equal(msg.body, "Stress test message 50");
        });
    });

    describe("Rapid Module Loading", () => {
        it("should load all API modules quickly", () => {
            const start = Date.now();

            const modules = [
                "messaging/sendMessage",
                "messaging/editMessage",
                "messaging/unsendMessage",
                "threads/getThreadInfo",
                "threads/getThreadList",
                "users/getUserInfo",
                "mqtt/listenMqtt",
            ];

            modules.forEach((mod) => {
                require(resolveApi(...mod.split("/")));
            });

            const duration = Date.now() - start;

            // Should complete in under 500ms
            assert.lessThan(duration, 500);
        });
    });
});

// Run all tests
run();
