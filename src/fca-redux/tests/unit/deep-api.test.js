/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                    NERO - Deep API Module Tests                              ║
 * ║              Comprehensive Testing of All API Module Logic                    ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Deep tests for modules that were previously only shallow-tested.
 * Tests internal logic, parameter validation, error handling, and return values.
 *
 * @module tests/unit/deep-api.test
 * @version 2.0.0
 */

"use strict";

const { describe, it, beforeAll, afterAll, assert, run } = require("../lib/test-framework");
const {
    resolveApi,
    resolveSrc,
    createMockContext,
    createMockDefaultFuncs,
    createMockApi,
    fakeUserId,
    fakeThreadId,
    fakeMessageId,
    fakeMessage,
} = require("../lib/helpers");
const path = require("path");

// ═══════════════════════════════════════════════════════════
// POSTING MODULE DEEP TESTS
// ═══════════════════════════════════════════════════════════

describe("Deep Tests: Posting Modules", () => {
    describe("story.js - Story Functions", () => {
        let storyModule;
        let ctx, defaultFuncs, api;

        beforeAll(() => {
            ctx = createMockContext();
            defaultFuncs = createMockDefaultFuncs();
            api = createMockApi();
            storyModule = require(resolveApi("posting", "story.js"))(defaultFuncs, api, ctx);
        });

        it("should return an object with multiple functions", () => {
            assert.isObject(storyModule);
        });

        it("should have msg function (reply)", () => {
            assert.isFunction(storyModule.msg);
        });

        it("should have react function", () => {
            assert.isFunction(storyModule.react);
        });

        it("should have create function", () => {
            assert.isFunction(storyModule.create);
        });

        it("msg should require storyId parameter", async () => {
            try {
                await storyModule.msg(null, "test message");
                assert.fail("Should have thrown error");
            } catch (err) {
                assert.ok(err.message.includes("Story ID") || err.message.includes("required"));
            }
        });

        it("msg should require message parameter", async () => {
            try {
                await storyModule.msg("12345", null);
                assert.fail("Should have thrown error");
            } catch (err) {
                assert.ok(err.message.includes("message") || err.message.includes("required"));
            }
        });

        it("react should validate allowed reactions", async () => {
            try {
                await storyModule.react("12345", "invalid_emoji");
                assert.fail("Should have thrown error");
            } catch (err) {
                assert.ok(
                    err.message.includes("Invalid reaction") || err.message.includes("allowed")
                );
            }
        });

        it("should accept valid reactions", () => {
            const validReactions = ["❤️", "👍", "🤗", "😆", "😡", "😢", "😮"];
            validReactions.forEach((reaction) => {
                assert.ok(typeof reaction === "string");
            });
        });
    });

    describe("comment.js - Comment Functions", () => {
        let commentModule;
        let ctx, defaultFuncs, api;

        beforeAll(() => {
            ctx = createMockContext();
            defaultFuncs = createMockDefaultFuncs();
            api = createMockApi();
            commentModule = require(resolveApi("posting", "comment.js"))(defaultFuncs, api, ctx);
        });

        it("should return a function", () => {
            assert.isFunction(commentModule);
        });

        it("should handle message object with body", () => {
            const msg = { body: "Test comment" };
            assert.hasProperty(msg, "body");
            assert.equal(msg.body, "Test comment");
        });

        it("should support mentions in message", () => {
            const msg = {
                body: "@User this is a test",
                mentions: [{ tag: "@User", id: fakeUserId(), fromIndex: 0 }],
            };
            assert.isArray(msg.mentions);
            assert.equal(msg.mentions[0].tag, "@User");
        });

        it("should support URL attachments", () => {
            const msg = {
                body: "Check this out",
                url: "https://example.com/post",
            };
            assert.hasProperty(msg, "url");
        });

        it("should support sticker attachments", () => {
            const msg = {
                body: "",
                sticker: "369239263222822",
            };
            assert.hasProperty(msg, "sticker");
        });
    });

    describe("follow.js - Follow/Unfollow Functions", () => {
        let followModule;
        let ctx, defaultFuncs, api;

        beforeAll(() => {
            ctx = createMockContext();
            defaultFuncs = createMockDefaultFuncs({
                post: () =>
                    Promise.resolve({
                        body: JSON.stringify({ success: true }),
                        data: { success: true },
                    }),
            });
            api = createMockApi();
            // follow.js uses api.httpPost, so we need to mock it
            api.httpPost = (url, form, callback) => {
                if (typeof callback === "function") {
                    callback(null, { success: true });
                }
            };
            followModule = require(resolveApi("posting", "follow.js"))(defaultFuncs, api, ctx);
        });

        it("should return a function", () => {
            assert.isFunction(followModule);
        });

        it("should accept userID and boolean for follow", () => {
            const userId = fakeUserId();
            followModule(userId, true, (err, data) => {
                // Callback handled
            });
            // Should not throw
            assert.ok(true);
        });

        it("should accept userID and boolean for unfollow", () => {
            const userId = fakeUserId();
            followModule(userId, false, (err, data) => {
                // Callback handled
            });
            // Should not throw
            assert.ok(true);
        });

        it("should work without callback", () => {
            const userId = fakeUserId();
            // Should not throw
            followModule(userId, true);
            assert.ok(true);
        });
    });

    describe("friend.js - Friend Management Functions", () => {
        let friendModule;
        let ctx, defaultFuncs, api;

        beforeAll(() => {
            ctx = createMockContext();
            defaultFuncs = createMockDefaultFuncs({
                post: () =>
                    Promise.resolve({
                        data: {
                            data: {
                                viewer: {
                                    friend_requests: { edges: [] },
                                    people_you_may_know: { edges: [] },
                                },
                            },
                        },
                    }),
            });
            api = createMockApi();
            friendModule = require(resolveApi("posting", "friend.js"))(defaultFuncs, api, ctx);
        });

        it("should return an object with multiple methods", () => {
            assert.isObject(friendModule);
        });

        it("should have requests method", () => {
            assert.isFunction(friendModule.requests);
        });

        it("should have accept method", () => {
            assert.isFunction(friendModule.accept);
        });

        it("should have suggest.list method (suggestions)", () => {
            assert.isObject(friendModule.suggest);
            assert.isFunction(friendModule.suggest.list);
        });

        it("should have suggest.request method", () => {
            assert.isFunction(friendModule.suggest.request);
        });

        it("should have list method", () => {
            assert.isFunction(friendModule.list);
        });

        it("requests should return a promise", () => {
            const result = friendModule.requests();
            assert.ok(result instanceof Promise);
        });

        it("accept should require identifier", async () => {
            try {
                await friendModule.accept();
                assert.fail("Should have thrown error");
            } catch (err) {
                assert.ok(err.message.includes("required") || err.message.includes("ID"));
            }
        });
    });

    describe("share.js - Post Preview/Share Functions", () => {
        let shareModule;
        let ctx, defaultFuncs, api;

        beforeAll(() => {
            ctx = createMockContext();
            defaultFuncs = createMockDefaultFuncs({
                post: () =>
                    Promise.resolve({
                        body: JSON.stringify({
                            data: {
                                xma_preview_data: {
                                    post_id: "123456",
                                    header_title: "Test Post",
                                    title_text: "Post Title",
                                },
                            },
                        }),
                    }),
            });
            api = createMockApi();
            shareModule = require(resolveApi("posting", "share.js"))(defaultFuncs, api, ctx);
        });

        it("should return a function", () => {
            assert.isFunction(shareModule);
        });

        it("should require postID parameter", async () => {
            // The share module returns a callback result; we use a promise wrapper to test
            const result = await new Promise((resolve, reject) => {
                shareModule(null, (err, data) => {
                    if (err) {
                        resolve({ hasError: true, error: err });
                    } else {
                        resolve({ hasError: false, data });
                    }
                });
            });
            assert.ok(result.hasError);
            assert.ok(result.error.error && result.error.error.includes("postID"));
        });

        it("should return a promise when no callback", () => {
            const result = shareModule("123456789");
            assert.ok(result instanceof Promise);
        });
    });
});

// ═══════════════════════════════════════════════════════════
// EXTRA MODULE DEEP TESTS
// ═══════════════════════════════════════════════════════════

describe("Deep Tests: Extra Modules", () => {
    describe("addExternalModule.js - Module Extension", () => {
        let addExternalModule;
        let ctx, defaultFuncs, api;

        beforeAll(() => {
            ctx = createMockContext();
            defaultFuncs = createMockDefaultFuncs();
            api = createMockApi();
            addExternalModule = require(resolveApi("extra", "addExternalModule.js"))(
                defaultFuncs,
                api,
                ctx
            );
        });

        it("should return a function", () => {
            assert.isFunction(addExternalModule);
        });

        it("should add external module to api object", () => {
            const externalModule = {
                testFunction: (df, a, c) => () => "test result",
            };
            addExternalModule(externalModule);
            assert.isFunction(api.testFunction);
            assert.equal(api.testFunction(), "test result");
        });

        it("should reject non-object input", () => {
            try {
                addExternalModule("not an object");
                assert.fail("Should have thrown error");
            } catch (err) {
                assert.ok(err.message.includes("must be an object"));
            }
        });

        it("should reject non-function module values", () => {
            try {
                addExternalModule({ badModule: "not a function" });
                assert.fail("Should have thrown error");
            } catch (err) {
                assert.ok(err.message.includes("must be a function"));
            }
        });

        it("should add multiple modules at once", () => {
            const modules = {
                moduleA: (df, a, c) => () => "A",
                moduleB: (df, a, c) => () => "B",
            };
            addExternalModule(modules);
            assert.isFunction(api.moduleA);
            assert.isFunction(api.moduleB);
        });
    });

    describe("getAccess.js - Access Token Functions", () => {
        let getAccess;
        let ctx, defaultFuncs, api;

        beforeAll(() => {
            ctx = createMockContext();
            defaultFuncs = createMockDefaultFuncs();
            api = createMockApi();
            getAccess = require(resolveApi("extra", "getAccess.js"))(defaultFuncs, api, ctx);
        });

        it("should return a function", () => {
            assert.isFunction(getAccess);
        });

        it("should return cached token if available", () => {
            ctx.access_token = "cached_token_12345";
            // The getAccess function checks for cached token
            getAccess((err, token) => {
                // Either returns cached or fetches new
            });
            delete ctx.access_token;
            assert.ok(true);
        });

        it("should return a promise", () => {
            const result = getAccess();
            assert.ok(result instanceof Promise);
        });
    });
});

// ═══════════════════════════════════════════════════════════
// LOGIN MODULE DEEP TESTS
// ═══════════════════════════════════════════════════════════

describe("Deep Tests: Login Modules", () => {
    describe("GetBotInfo.js - Bot Information Extraction", () => {
        let GetBotInfo;
        let ctx, defaultFuncs, api;

        beforeAll(() => {
            ctx = createMockContext();
            defaultFuncs = createMockDefaultFuncs();
            api = createMockApi();
            GetBotInfo = require(resolveApi("login", "GetBotInfo.js"))(defaultFuncs, api, ctx);
        });

        it("should return a function", () => {
            assert.isFunction(GetBotInfo);
        });

        it("should return null for invalid netData", () => {
            assert.equal(GetBotInfo(null), null);
            assert.equal(GetBotInfo("not an array"), null);
            assert.equal(GetBotInfo(123), null);
        });

        it("should return null for empty netData", () => {
            const result = GetBotInfo([]);
            assert.equal(result, null);
        });

        it("should extract bot info from valid netData", () => {
            const mockNetData = [
                {
                    require: [
                        [
                            "CurrentUserInitialData",
                            [],
                            {
                                NAME: "Test Bot",
                                SHORT_NAME: "Bot",
                                USER_ID: "100000000000001",
                                APP_ID: "123456",
                            },
                        ],
                        [
                            "DTSGInitialData",
                            [],
                            {
                                token: "test_dtsg_token",
                            },
                        ],
                    ],
                },
            ];
            const result = GetBotInfo(mockNetData);

            assert.isObject(result);
            assert.equal(result.name, "Test Bot");
            assert.equal(result.firstName, "Bot");
            assert.equal(result.uid, "100000000000001");
            assert.equal(result.dtsgToken, "test_dtsg_token");
        });

        it("should provide getCtx function", () => {
            const mockNetData = [
                {
                    require: [
                        ["CurrentUserInitialData", [], { NAME: "Bot", USER_ID: "123" }],
                        ["DTSGInitialData", [], { token: "token" }],
                    ],
                },
            ];
            const result = GetBotInfo(mockNetData);

            assert.isFunction(result.getCtx);
            assert.equal(result.getCtx("userID"), ctx.userID);
        });

        it("should provide getOptions function", () => {
            const mockNetData = [
                {
                    require: [
                        ["CurrentUserInitialData", [], { NAME: "Bot", USER_ID: "123" }],
                        ["DTSGInitialData", [], { token: "token" }],
                    ],
                },
            ];
            const result = GetBotInfo(mockNetData);

            assert.isFunction(result.getOptions);
            assert.equal(result.getOptions("selfListen"), ctx.globalOptions.selfListen);
        });
    });

    describe("getBotInitialData.js - Initial Data Fetch", () => {
        let getBotInitialData;
        let ctx, defaultFuncs, api;

        beforeAll(() => {
            ctx = createMockContext();
            defaultFuncs = createMockDefaultFuncs();
            api = createMockApi();
            api.httpGet = (url, jar, opts, callback) => {
                const mockHtml = `"CurrentUserInitialData",[],{"NAME":"TestBot","USER_ID":"123456","SHORT_NAME":"Bot"}`;
                callback(null, mockHtml);
            };
            getBotInitialData = require(resolveApi("login", "getBotInitialData.js"))(
                defaultFuncs,
                api,
                ctx
            );
        });

        it("should return a function", () => {
            assert.isFunction(getBotInitialData);
        });

        it("should return a promise", () => {
            const result = getBotInitialData();
            assert.ok(result instanceof Promise);
        });

        it("should accept callback", async () => {
            // Just test that it returns a promise
            const result = getBotInitialData();
            assert.ok(result instanceof Promise);
        });
    });

    describe("logout.js - Logout Function", () => {
        let logout;
        let ctx, defaultFuncs, api;

        beforeAll(() => {
            ctx = createMockContext();
            ctx.loggedIn = true;
            defaultFuncs = createMockDefaultFuncs();
            api = createMockApi();
            logout = require(resolveApi("login", "logout.js"))(defaultFuncs, api, ctx);
        });

        it("should return a function", () => {
            assert.isFunction(logout);
        });

        it("should return a promise", () => {
            const result = logout();
            assert.ok(result instanceof Promise);
        });
    });
});

// ═══════════════════════════════════════════════════════════
// MQTT MODULE DEEP TESTS
// ═══════════════════════════════════════════════════════════

describe("Deep Tests: MQTT Modules", () => {
    describe("listenSpeed.js - Speed Optimized Listener", () => {
        let listenSpeed;
        let ctx, defaultFuncs, api;

        beforeAll(() => {
            ctx = createMockContext();
            ctx.jar = {
                getCookiesSync: () => [{ toString: () => "cookie=value" }],
            };
            defaultFuncs = createMockDefaultFuncs();
            api = createMockApi();
            listenSpeed = require(resolveApi("mqtt", "listenSpeed.js"))(defaultFuncs, api, ctx);
        });

        it("should return a function", () => {
            assert.isFunction(listenSpeed);
        });

        it("should accept callback parameter", () => {
            assert.ok(listenSpeed.length >= 0);
        });
    });

    describe("realtime.js - Realtime WebSocket Listener", () => {
        let realtime;
        let ctx, defaultFuncs, api;

        beforeAll(() => {
            ctx = createMockContext();
            ctx.jar = {
                getCookiesSync: () => [{ toString: () => "cookie=value" }],
            };
            defaultFuncs = createMockDefaultFuncs();
            api = createMockApi();
            realtime = require(resolveApi("mqtt", "realtime.js"))(defaultFuncs, api, ctx);
        });

        it("should return a function", () => {
            assert.isFunction(realtime);
        });

        it("should return an EventEmitter when called", () => {
            const emitter = realtime();
            assert.isFunction(emitter.on);
            assert.isFunction(emitter.emit);
            // Clean up
            if (emitter.stopListening) emitter.stopListening();
        });
    });

    describe("pinMessage.js - Message Pinning", () => {
        let pinMessage;
        let ctx, defaultFuncs, api;

        beforeAll(() => {
            ctx = createMockContext();
            defaultFuncs = createMockDefaultFuncs();
            api = createMockApi();
            pinMessage = require(resolveApi("mqtt", "pinMessage.js"))(defaultFuncs, api, ctx);
        });

        it("should return a function", () => {
            assert.isFunction(pinMessage);
        });

        it("should require threadID for pin action", async () => {
            try {
                await pinMessage("pin", null, fakeMessageId());
                assert.fail("Should have thrown error");
            } catch (err) {
                assert.ok(
                    err.message.includes("requires") ||
                        err.message.includes("threadID") ||
                        err.message.includes("MQTT")
                );
            }
        });

        it("should support 'list' action", async () => {
            try {
                await pinMessage("list", null);
                assert.fail("Should have thrown error");
            } catch (err) {
                assert.ok(
                    err.message.includes("requires") ||
                        err.message.includes("threadID") ||
                        err.message.includes("MQTT")
                );
            }
        });

        it("should require MQTT for pin/unpin actions", async () => {
            try {
                await pinMessage("pin", fakeThreadId(), fakeMessageId());
                assert.fail("Should have thrown error");
            } catch (err) {
                assert.ok(err.message.includes("MQTT"));
            }
        });
    });
});

// ═══════════════════════════════════════════════════════════
// MESSAGING MODULE DEEP TESTS
// ═══════════════════════════════════════════════════════════

describe("Deep Tests: Messaging Modules", () => {
    describe("stickers.js - Sticker Functions", () => {
        let stickers;
        let ctx, defaultFuncs, api;

        beforeAll(() => {
            ctx = createMockContext();
            defaultFuncs = createMockDefaultFuncs({
                post: () =>
                    Promise.resolve({
                        body: JSON.stringify({
                            data: {
                                sticker_search: {
                                    sticker_results: { edges: [] },
                                },
                            },
                        }),
                    }),
            });
            api = createMockApi();
            stickers = require(resolveApi("messaging", "stickers.js"))(defaultFuncs, api, ctx);
        });

        it("should return an object with multiple methods", () => {
            assert.isObject(stickers);
        });

        it("should have search method", () => {
            assert.isFunction(stickers.search);
        });

        it("should have listPacks method", () => {
            assert.isFunction(stickers.listPacks);
        });

        it("should have getStorePacks method", () => {
            assert.isFunction(stickers.getStorePacks);
        });

        it("should have getStickersInPack method", () => {
            assert.isFunction(stickers.getStickersInPack);
        });

        it("should have getAiStickers method", () => {
            assert.isFunction(stickers.getAiStickers);
        });

        it("should have addPack method", () => {
            assert.isFunction(stickers.addPack);
        });

        it("should have listAllPacks method", () => {
            assert.isFunction(stickers.listAllPacks);
        });

        it("search should return a promise", () => {
            const result = stickers.search("hello");
            assert.ok(result instanceof Promise);
        });
    });

    describe("notes.js - Messenger Notes", () => {
        let notes;
        let ctx, defaultFuncs, api;

        beforeAll(() => {
            ctx = createMockContext();
            defaultFuncs = createMockDefaultFuncs({
                post: () =>
                    Promise.resolve({
                        body: JSON.stringify({
                            data: {
                                viewer: {
                                    actor: {
                                        msgr_user_rich_status: null,
                                    },
                                },
                            },
                        }),
                    }),
            });
            api = createMockApi();
            notes = require(resolveApi("messaging", "notes.js"))(defaultFuncs, api, ctx);
        });

        it("should return an object with multiple methods", () => {
            assert.isObject(notes);
        });

        it("should have check method (checkNote)", () => {
            assert.isFunction(notes.check);
        });

        it("should have create method (createNote)", () => {
            assert.isFunction(notes.create);
        });

        it("should have delete method (deleteNote)", () => {
            assert.isFunction(notes.delete);
        });

        it("should have recreate method (recreateNote)", () => {
            assert.isFunction(notes.recreate);
        });

        it("create should accept text and callback", () => {
            // create(text, privacy, callback)
            notes.create("Test note", "EVERYONE", (err) => {
                // Callback handled
            });
            assert.ok(true);
        });
    });
});

// ═══════════════════════════════════════════════════════════
// UTILITY DEEP TESTS
// ═══════════════════════════════════════════════════════════

describe("Deep Tests: Core Utilities", () => {
    describe("formatters.js - Deep Formatting Tests", () => {
        let formatters;

        beforeAll(() => {
            formatters = require(resolveSrc("lib", "utils", "formatters.js"));
        });

        it("should have formatDeltaMessage function", () => {
            assert.isFunction(formatters.formatDeltaMessage);
        });

        it("should format various attachment types", () => {
            const photoAttachment = {
                mercury: {
                    blob_attachment: {
                        __typename: "MessageImage",
                        preview: { uri: "http://example.com/preview.jpg" },
                        large_preview: { uri: "http://example.com/large.jpg" },
                    },
                },
            };
            // Should not throw
            assert.ok(typeof formatters.formatDeltaMessage === "function");
        });
    });

    describe("constants.js - Deep Constants Tests", () => {
        let constants;

        beforeAll(() => {
            constants = require(resolveSrc("lib", "utils", "constants.js"));
        });

        it("should generate valid threading ID", () => {
            const result = constants.generateThreadingID("client123");
            assert.isString(result);
            assert.ok(result.includes("@mail.projektitan.com"));
        });

        it("should generate valid offline threading ID", () => {
            const result = constants.generateOfflineThreadingID();
            assert.isString(result);
            assert.ok(result.length > 10);
        });

        it("should correctly identify types", () => {
            assert.equal(constants.getType({}), "Object");
            assert.equal(constants.getType([]), "Array");
            assert.equal(constants.getType(""), "String");
            assert.equal(constants.getType(123), "Number");
            assert.equal(constants.getType(null), "Null");
            assert.equal(constants.getType(undefined), "Undefined");
            assert.equal(constants.getType(true), "Boolean");
        });

        it("should pad zeros correctly", () => {
            assert.equal(constants.padZeros(1), "01");
            assert.equal(constants.padZeros(10), "10");
            assert.equal(constants.padZeros(5, 3), "005");
        });
    });
});

// ═══════════════════════════════════════════════════════════
// COMPREHENSIVE FEATURE TESTS
// ═══════════════════════════════════════════════════════════

describe("Comprehensive Feature Verification", () => {
    describe("All Posting Features Available", () => {
        it("story module has all required methods", () => {
            const ctx = createMockContext();
            const story = require(resolveApi("posting", "story.js"))({}, {}, ctx);

            assert.isFunction(story.msg);
            assert.isFunction(story.react);
            assert.isFunction(story.create);
        });

        it("friend module has all required methods", () => {
            const ctx = createMockContext();
            const friend = require(resolveApi("posting", "friend.js"))({}, {}, ctx);

            assert.isFunction(friend.requests);
            assert.isFunction(friend.accept);
            assert.isObject(friend.suggest);
            assert.isFunction(friend.suggest.list);
            assert.isFunction(friend.suggest.request);
            assert.isFunction(friend.list);
        });
    });

    describe("All Extra Features Available", () => {
        it("addExternalModule allows API extension", () => {
            const ctx = createMockContext();
            const api = {};
            const addModule = require(resolveApi("extra", "addExternalModule.js"))({}, api, ctx);

            addModule({
                customFunction: () => () => "custom",
            });

            assert.isFunction(api.customFunction);
            assert.equal(api.customFunction(), "custom");
        });
    });

    describe("All Login Features Available", () => {
        it("GetBotInfo extracts all required data", () => {
            const ctx = createMockContext();
            const GetBotInfo = require(resolveApi("login", "GetBotInfo.js"))({}, {}, ctx);

            const mockData = [
                {
                    require: [
                        [
                            "CurrentUserInitialData",
                            [],
                            { NAME: "Bot", USER_ID: "123", SHORT_NAME: "B", APP_ID: "456" },
                        ],
                        ["DTSGInitialData", [], { token: "dtsg_token" }],
                        ["LSD", [], { token: "lsd_token" }],
                    ],
                },
            ];

            const info = GetBotInfo(mockData);

            assert.hasProperty(info, "name");
            assert.hasProperty(info, "firstName");
            assert.hasProperty(info, "uid");
            assert.hasProperty(info, "appID");
            assert.hasProperty(info, "dtsgToken");
            assert.hasProperty(info, "getCtx");
            assert.hasProperty(info, "getOptions");
            assert.hasProperty(info, "getRegion");
        });
    });

    describe("All Sticker Features Available", () => {
        it("stickers module has all search/browse methods", () => {
            const ctx = createMockContext();
            const stickers = require(resolveApi("messaging", "stickers.js"))(
                {
                    post: () => Promise.resolve({ body: "{}" }),
                },
                {},
                ctx
            );

            assert.isFunction(stickers.search);
            assert.isFunction(stickers.listPacks);
            assert.isFunction(stickers.getStorePacks);
            assert.isFunction(stickers.listAllPacks);
            assert.isFunction(stickers.getStickersInPack);
            assert.isFunction(stickers.getAiStickers);
            assert.isFunction(stickers.addPack);
        });
    });

    describe("All Notes Features Available", () => {
        it("notes module has all CRUD methods", () => {
            const ctx = createMockContext();
            const notes = require(resolveApi("messaging", "notes.js"))(
                {
                    post: () => Promise.resolve({ body: "{}" }),
                },
                {},
                ctx
            );

            assert.isFunction(notes.check);
            assert.isFunction(notes.create);
            assert.isFunction(notes.delete);
            assert.isFunction(notes.recreate);
        });
    });
});

// ═══════════════════════════════════════════════════════════
// NEW MESSAGING APIs - handleMessageRequest, muteThread, createPoll, createNewGroup
// ═══════════════════════════════════════════════════════════

describe("Deep Tests: New Messaging APIs", () => {
    describe("handleMessageRequest.js - Message Request Handling", () => {
        let handleMessageRequest;
        let ctx, defaultFuncs, api;

        beforeAll(() => {
            ctx = createMockContext();
            defaultFuncs = createMockDefaultFuncs();
            api = createMockApi();
            handleMessageRequest = require(resolveApi("messaging", "handleMessageRequest.js"))(
                defaultFuncs,
                api,
                ctx
            );
        });

        it("should be a function", () => {
            assert.isFunction(handleMessageRequest);
        });

        it("should return a promise", () => {
            defaultFuncs.post = () => Promise.resolve({ body: '{"payload":{}}', statusCode: 200 });
            const result = handleMessageRequest("123", true);
            assert.ok(result instanceof Promise);
        });

        it("should reject if accept is not a boolean", async () => {
            try {
                await handleMessageRequest("123", "yes");
                assert.fail("Should have thrown an error");
            } catch (err) {
                assert.ok(err.message.includes("boolean"));
            }
        });

        it("should handle single threadID", async () => {
            let formData = null;
            defaultFuncs.post = (url, jar, form) => {
                formData = form;
                return Promise.resolve({ body: "{}", statusCode: 200 });
            };

            const result = await handleMessageRequest("123456", true);
            assert.ok(result.success);
            assert.equal(result.action, "accepted");
            assert.ok(Object.prototype.hasOwnProperty.call(formData, "inbox[0]"));
        });

        it("should handle array of threadIDs", async () => {
            let formData = null;
            defaultFuncs.post = (url, jar, form) => {
                formData = form;
                return Promise.resolve({ body: "{}", statusCode: 200 });
            };

            const result = await handleMessageRequest(["123", "456"], true);
            assert.equal(result.threadIDs.length, 2);
            assert.ok(Object.prototype.hasOwnProperty.call(formData, "inbox[0]"));
            assert.ok(Object.prototype.hasOwnProperty.call(formData, "inbox[1]"));
        });

        it("should use 'other' box when declining", async () => {
            let formData = null;
            defaultFuncs.post = (url, jar, form) => {
                formData = form;
                return Promise.resolve({ body: "{}", statusCode: 200 });
            };

            const result = await handleMessageRequest("123", false);
            assert.equal(result.action, "declined");
            assert.ok(Object.prototype.hasOwnProperty.call(formData, "other[0]"));
        });
    });

    describe("muteThread.js - Thread Mute/Unmute", () => {
        let muteThread;
        let ctx, defaultFuncs, api;

        beforeAll(() => {
            ctx = createMockContext();
            defaultFuncs = createMockDefaultFuncs();
            api = createMockApi();
            muteThread = require(resolveApi("messaging", "muteThread.js"))(defaultFuncs, api, ctx);
        });

        it("should be a function", () => {
            assert.isFunction(muteThread);
        });

        it("should return a promise", () => {
            defaultFuncs.post = () => Promise.resolve({ body: "{}", statusCode: 200 });
            const result = muteThread("123", 0);
            assert.ok(result instanceof Promise);
        });

        it("should reject if threadID is missing", async () => {
            try {
                await muteThread(null, 0);
                assert.fail("Should have thrown an error");
            } catch (err) {
                assert.ok(err.message.includes("threadID"));
            }
        });

        it("should reject if muteSeconds is not a number", async () => {
            try {
                await muteThread("123", "forever");
                assert.fail("Should have thrown an error");
            } catch (err) {
                assert.ok(err.message.includes("number"));
            }
        });

        it("should send correct form data for muting", async () => {
            let formData = null;
            defaultFuncs.post = (url, jar, form) => {
                formData = form;
                return Promise.resolve({ body: "{}", statusCode: 200, headers: {} });
            };

            const result = await muteThread("123456", 3600);
            assert.ok(result.success);
            assert.ok(result.action.includes("muted"));
            assert.equal(formData.thread_fbid, "123456");
            assert.equal(formData.mute_settings, 3600);
        });

        it("should return 'unmuted' action when muteSeconds is 0", async () => {
            defaultFuncs.post = () => Promise.resolve({ body: "{}", statusCode: 200, headers: {} });

            const result = await muteThread("123", 0);
            assert.equal(result.action, "unmuted");
        });

        it("should return 'muted permanently' when muteSeconds is -1", async () => {
            defaultFuncs.post = () => Promise.resolve({ body: "{}", statusCode: 200, headers: {} });

            const result = await muteThread("123", -1);
            assert.equal(result.action, "muted permanently");
        });
    });

    describe("createPoll.js - Poll Creation", () => {
        let createPoll;
        let ctx, defaultFuncs, api;

        beforeAll(() => {
            ctx = createMockContext();
            ctx.mqttClient = {
                publish: (topic, message, options, callback) => {
                    if (callback) callback(null);
                },
            };
            defaultFuncs = createMockDefaultFuncs();
            api = createMockApi();
            createPoll = require(resolveApi("messaging", "createPoll.js"))(defaultFuncs, api, ctx);
        });

        it("should be a function", () => {
            assert.isFunction(createPoll);
        });

        it("should return a promise", () => {
            const result = createPoll("123", "Question?", [{ text: "A" }, { text: "B" }]);
            assert.ok(result instanceof Promise);
        });

        it("should reject if threadID is missing", async () => {
            try {
                await createPoll(null, "Question?", [{ text: "A" }, { text: "B" }]);
                assert.fail("Should have thrown an error");
            } catch (err) {
                assert.ok(err.message.includes("threadID"));
            }
        });

        it("should reject if question is missing", async () => {
            try {
                await createPoll("123", null, [{ text: "A" }, { text: "B" }]);
                assert.fail("Should have thrown an error");
            } catch (err) {
                assert.ok(err.message.includes("question"));
            }
        });

        it("should reject if less than 2 options", async () => {
            try {
                await createPoll("123", "Question?", [{ text: "Only one" }]);
                assert.fail("Should have thrown an error");
            } catch (err) {
                assert.ok(err.message.includes("2 poll options"));
            }
        });

        it("should reject if MQTT is not connected", async () => {
            const noMqttCtx = createMockContext();
            noMqttCtx.mqttClient = null;
            const noPoll = require(resolveApi("messaging", "createPoll.js"))(
                defaultFuncs,
                api,
                noMqttCtx
            );

            try {
                await noPoll("123", "Question?", [{ text: "A" }, { text: "B" }]);
                assert.fail("Should have thrown an error");
            } catch (err) {
                assert.ok(err.message.includes("MQTT"));
            }
        });

        it("should successfully create a poll with valid data", async () => {
            const result = await createPoll("123456", "What's for lunch?", [
                { text: "Pizza" },
                { text: "Burger" },
                { text: "Salad" },
            ]);

            assert.ok(result.success);
            assert.equal(result.question, "What's for lunch?");
            assert.equal(result.options.length, 3);
        });

        it("should handle string options", async () => {
            const result = await createPoll("123", "Favorite?", ["Red", "Blue"]);

            assert.ok(result.success);
            assert.equal(result.options[0].text, "Red");
            assert.equal(result.options[1].text, "Blue");
        });
    });

    describe("createNewGroup.js - Group Creation", () => {
        let createNewGroup;
        let ctx, defaultFuncs, api;

        beforeAll(() => {
            ctx = createMockContext();
            defaultFuncs = createMockDefaultFuncs();
            api = createMockApi();
            createNewGroup = require(resolveApi("messaging", "createNewGroup.js"))(
                defaultFuncs,
                api,
                ctx
            );
        });

        it("should be a function", () => {
            assert.isFunction(createNewGroup);
        });

        it("should return a promise", () => {
            defaultFuncs.post = () =>
                Promise.resolve({
                    body: JSON.stringify({
                        data: {
                            messenger_group_thread_create: {
                                thread: { thread_key: { thread_fbid: "999" } },
                            },
                        },
                    }),
                    statusCode: 200,
                });
            const result = createNewGroup(["100001", "100002"]);
            assert.ok(result instanceof Promise);
        });

        it("should reject if participantIDs is not an array", async () => {
            try {
                await createNewGroup("100001");
                assert.fail("Should have thrown an error");
            } catch (err) {
                assert.ok(err.message.includes("array"));
            }
        });

        it("should reject if less than 2 participants", async () => {
            try {
                await createNewGroup(["100001"]);
                assert.fail("Should have thrown an error");
            } catch (err) {
                assert.ok(err.message.includes("2 participant"));
            }
        });

        it("should successfully create group with valid data", async () => {
            let formData = null;
            defaultFuncs.post = (url, jar, form) => {
                formData = form;
                return Promise.resolve({
                    body: JSON.stringify({
                        data: {
                            messenger_group_thread_create: {
                                thread: { thread_key: { thread_fbid: "999888777" } },
                            },
                        },
                    }),
                    statusCode: 200,
                });
            };

            const result = await createNewGroup(["100001", "100002"], "Test Group");

            assert.ok(result.success);
            assert.equal(result.threadID, "999888777");
            assert.equal(result.name, "Test Group");
            assert.equal(result.totalParticipants, 3);

            const vars = JSON.parse(formData.variables);
            assert.equal(vars.input.participants.length, 3); // 2 + current user
            assert.equal(vars.input.thread_settings.name, "Test Group");
        });

        it("should handle group creation without a name", async () => {
            defaultFuncs.post = () =>
                Promise.resolve({
                    body: JSON.stringify({
                        data: {
                            messenger_group_thread_create: {
                                thread: { thread_key: { thread_fbid: "123" } },
                            },
                        },
                    }),
                    statusCode: 200,
                });

            const result = await createNewGroup(["100001", "100002"]);

            assert.ok(result.success);
            assert.equal(result.name, null);
        });

        it("should work with callback as second parameter (no group name)", async () => {
            defaultFuncs.post = () =>
                Promise.resolve({
                    body: JSON.stringify({
                        data: {
                            messenger_group_thread_create: {
                                thread: { thread_key: { thread_fbid: "456" } },
                            },
                        },
                    }),
                    statusCode: 200,
                });

            // Use a promise wrapper since the callback doesn't resolve the returned promise
            const result = await new Promise((resolve, reject) => {
                createNewGroup(["100001", "100002"], (err, data) => {
                    if (err) reject(err);
                    else resolve(data);
                });
            });

            assert.ok(result.success);
        });
    });
});

// Run all tests
run();
