/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                         NERO - Unit Tests: API Modules                       ║
 * ║                    Test All API Module Loading & Factory Functions            ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Comprehensive tests for all API modules in src/api/
 * Each module should be a factory function that returns callable API methods.
 *
 * @module tests/unit/api-modules.test
 * @version 2.0.0
 */

"use strict";

const { describe, it, beforeAll, assert, run } = require("../lib/test-framework");
const {
    resolveApi,
    fileExists,
    dirExists,
    isFactoryFunction,
    createMockContext,
    createMockDefaultFuncs,
    createMockApi,
} = require("../lib/helpers");
const path = require("path");
const fs = require("fs");

// ═══════════════════════════════════════════════════════════
// MESSAGING API MODULES
// ═══════════════════════════════════════════════════════════

describe("Messaging API Modules", () => {
    const messagingDir = resolveApi("messaging");

    const messagingModules = [
        "sendMessage",
        "editMessage",
        "unsendMessage",
        "setMessageReaction",
        "sendTypingIndicator",
        "markAsRead",
        "markAsReadAll",
        "markAsDelivered",
        "markAsSeen",
        "shareContact",
        "resolvePhotoUrl",
        "gcmember",
        "gcname",
        "gcrule",
        "nickname",
        "emoji",
        "theme",
        "stickers",
        "notes",
    ];

    it("should have messaging directory", () => {
        assert.ok(dirExists(messagingDir));
    });

    messagingModules.forEach((mod) => {
        describe(`${mod}.js`, () => {
            const modulePath = path.join(messagingDir, `${mod}.js`);

            it("should exist", () => {
                assert.ok(fileExists(modulePath), `Missing module: ${mod}.js`);
            });

            it("should be a factory function", () => {
                assert.ok(isFactoryFunction(modulePath));
            });

            it("should return function when initialized", () => {
                const factory = require(modulePath);
                const ctx = createMockContext();
                const defaultFuncs = createMockDefaultFuncs();
                const api = createMockApi();

                const result = factory(defaultFuncs, api, ctx);
                // Most modules return a function, some return objects
                assert.ok(
                    typeof result === "function" || typeof result === "object",
                    `${mod} should return function or object`
                );
            });
        });
    });
});

// ═══════════════════════════════════════════════════════════
// MQTT API MODULES
// ═══════════════════════════════════════════════════════════

describe("MQTT API Modules", () => {
    const mqttDir = resolveApi("mqtt");

    const mqttModules = [
        "listenMqtt",
        "listenSpeed",
        "sendMessageMqtt",
        "setMessageReactionMqtt",
        "pinMessage",
        "realtime",
    ];

    it("should have mqtt directory", () => {
        assert.ok(dirExists(mqttDir));
    });

    it("should have deltas subdirectory", () => {
        assert.ok(dirExists(path.join(mqttDir, "deltas")));
    });

    mqttModules.forEach((mod) => {
        describe(`${mod}.js`, () => {
            const modulePath = path.join(mqttDir, `${mod}.js`);

            it("should exist", () => {
                assert.ok(fileExists(modulePath));
            });

            it("should be a factory function", () => {
                assert.ok(isFactoryFunction(modulePath));
            });
        });
    });

    describe("MQTT Delta Parser", () => {
        const deltaPath = path.join(mqttDir, "deltas", "value.js");

        it("should have value.js delta parser", () => {
            assert.ok(fileExists(deltaPath));
        });

        it("should export parseDelta function", () => {
            const delta = require(deltaPath);
            assert.isFunction(delta.parseDelta);
        });
    });
});

// ═══════════════════════════════════════════════════════════
// THREADS API MODULES
// ═══════════════════════════════════════════════════════════

describe("Threads API Modules", () => {
    const threadsDir = resolveApi("threads");

    const threadsModules = ["getThreadInfo", "getThreadList", "getThreadHistory"];

    it("should have threads directory", () => {
        assert.ok(dirExists(threadsDir));
    });

    threadsModules.forEach((mod) => {
        describe(`${mod}.js`, () => {
            const modulePath = path.join(threadsDir, `${mod}.js`);

            it("should exist", () => {
                assert.ok(fileExists(modulePath));
            });

            it("should be a factory function", () => {
                assert.ok(isFactoryFunction(modulePath));
            });

            it("should return function when initialized", () => {
                const factory = require(modulePath);
                const ctx = createMockContext();
                const defaultFuncs = createMockDefaultFuncs();
                const api = createMockApi();

                const result = factory(defaultFuncs, api, ctx);
                assert.isFunction(result);
            });
        });
    });
});

// ═══════════════════════════════════════════════════════════
// USERS API MODULES
// ═══════════════════════════════════════════════════════════

describe("Users API Modules", () => {
    const usersDir = resolveApi("users");

    it("should have users directory", () => {
        assert.ok(dirExists(usersDir));
    });

    describe("getUserInfo.js", () => {
        const modulePath = path.join(usersDir, "getUserInfo.js");

        it("should exist", () => {
            assert.ok(fileExists(modulePath));
        });

        it("should be a factory function", () => {
            assert.ok(isFactoryFunction(modulePath));
        });

        it("should return function when initialized", () => {
            const factory = require(modulePath);
            const ctx = createMockContext();
            const defaultFuncs = createMockDefaultFuncs();
            const api = createMockApi();

            const result = factory(defaultFuncs, api, ctx);
            assert.isFunction(result);
        });
    });
});

// ═══════════════════════════════════════════════════════════
// POSTING API MODULES
// ═══════════════════════════════════════════════════════════

describe("Posting API Modules", () => {
    const postingDir = resolveApi("posting");

    const postingModules = ["story", "comment", "follow", "friend", "share"];

    it("should have posting directory", () => {
        assert.ok(dirExists(postingDir));
    });

    postingModules.forEach((mod) => {
        describe(`${mod}.js`, () => {
            const modulePath = path.join(postingDir, `${mod}.js`);

            it("should exist", () => {
                assert.ok(fileExists(modulePath));
            });

            it("should be a factory function", () => {
                assert.ok(isFactoryFunction(modulePath));
            });
        });
    });
});

// ═══════════════════════════════════════════════════════════
// HTTP API MODULES
// ═══════════════════════════════════════════════════════════

describe("HTTP API Modules", () => {
    const httpDir = resolveApi("http");

    const httpModules = ["httpGet", "httpPost", "httpPostFormData"];

    it("should have http directory", () => {
        assert.ok(dirExists(httpDir));
    });

    httpModules.forEach((mod) => {
        describe(`${mod}.js`, () => {
            const modulePath = path.join(httpDir, `${mod}.js`);

            it("should exist", () => {
                assert.ok(fileExists(modulePath));
            });

            it("should be a factory function", () => {
                assert.ok(isFactoryFunction(modulePath));
            });

            it("should return function when initialized", () => {
                const factory = require(modulePath);
                const ctx = createMockContext();
                const defaultFuncs = createMockDefaultFuncs();
                const api = createMockApi();

                const result = factory(defaultFuncs, api, ctx);
                assert.isFunction(result);
            });
        });
    });
});

// ═══════════════════════════════════════════════════════════
// LOGIN API MODULES
// ═══════════════════════════════════════════════════════════

describe("Login API Modules", () => {
    const loginDir = resolveApi("login");

    const loginModules = ["GetBotInfo", "getBotInitialData", "logout"];

    it("should have login directory", () => {
        assert.ok(dirExists(loginDir));
    });

    loginModules.forEach((mod) => {
        describe(`${mod}.js`, () => {
            const modulePath = path.join(loginDir, `${mod}.js`);

            it("should exist", () => {
                assert.ok(fileExists(modulePath));
            });

            it("should be a factory function", () => {
                assert.ok(isFactoryFunction(modulePath));
            });
        });
    });
});

// ═══════════════════════════════════════════════════════════
// EXTRA API MODULES
// ═══════════════════════════════════════════════════════════

describe("Extra API Modules", () => {
    const extraDir = resolveApi("extra");

    const extraModules = ["addExternalModule", "getAccess"];

    it("should have extra directory", () => {
        assert.ok(dirExists(extraDir));
    });

    extraModules.forEach((mod) => {
        describe(`${mod}.js`, () => {
            const modulePath = path.join(extraDir, `${mod}.js`);

            it("should exist", () => {
                assert.ok(fileExists(modulePath));
            });

            it("should be a factory function", () => {
                assert.ok(isFactoryFunction(modulePath));
            });
        });
    });
});

// ═══════════════════════════════════════════════════════════
// MODULE COUNT VERIFICATION
// ═══════════════════════════════════════════════════════════

describe("API Module Count Summary", () => {
    const expectedCounts = {
        messaging: 23, // Updated after adding handleMessageRequest, muteThread, createPoll, createNewGroup
        mqtt: 6,
        threads: 3,
        users: 1,
        posting: 5,
        http: 3,
        login: 3,
        extra: 2,
    };

    Object.entries(expectedCounts).forEach(([dir, expected]) => {
        it(`should have ${expected} modules in ${dir}/`, () => {
            const dirPath = resolveApi(dir);
            const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".js"));
            assert.equal(
                files.length,
                expected,
                `Expected ${expected} modules in ${dir}/, found ${files.length}`
            );
        });
    });

    it("should have 46+ total API modules", () => {
        let total = 0;
        Object.keys(expectedCounts).forEach((dir) => {
            const dirPath = resolveApi(dir);
            if (fs.existsSync(dirPath)) {
                total += fs.readdirSync(dirPath).filter((f) => f.endsWith(".js")).length;
            }
        });
        assert.greaterThan(total, 44);
    });
});

// Run all tests
run();
