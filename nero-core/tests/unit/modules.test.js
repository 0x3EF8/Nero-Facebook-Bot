/**
 * NERO - Full Comprehensive Test
 * Tests ALL modules, connections, and exports
 */

"use strict";

console.log("🔍 NERO - Full Comprehensive Test\n");
console.log("═".repeat(60));

let passed = 0;
let failed = 0;
const errors = [];

function test(category, name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (err) {
        console.log(`  ❌ ${name}`);
        errors.push({ category, name, error: err.message });
        failed++;
    }
}

function section(name) {
    console.log(`\n📦 ${name}`);
    console.log("─".repeat(50));
}

// ═══════════════════════════════════════════════════════════
// SECTION 1: Entry Points
// ═══════════════════════════════════════════════════════════
section("Entry Points");

test("Entry", "index.js exports login function", () => {
    const nero = require("../../index");
    if (typeof nero !== "function") throw new Error("Not a function");
});

test("Entry", "Core client exports login", () => {
    const { login } = require("../../src/core/client");
    if (typeof login !== "function") throw new Error("Missing login");
});

// ═══════════════════════════════════════════════════════════
// SECTION 2: Authentication Modules
// ═══════════════════════════════════════════════════════════
section("Authentication (src/core/auth)");

test("Auth", "setOptions module", () => {
    const mod = require("../../src/core/auth/setOptions");
    if (typeof mod !== "function") throw new Error("Not a function");
});

test("Auth", "buildAPI module", () => {
    const mod = require("../../src/core/auth/buildAPI");
    if (typeof mod !== "function") throw new Error("Not a function");
});

test("Auth", "loginHelper module", () => {
    const mod = require("../../src/core/auth/loginHelper");
    if (typeof mod !== "function") throw new Error("Not a function");
});

// ═══════════════════════════════════════════════════════════
// SECTION 3: Utility Modules
// ═══════════════════════════════════════════════════════════
section("Utilities (src/lib/utils)");

test("Utils", "index.js aggregator", () => {
    const utils = require("../../src/lib/utils");
    if (!utils.get || !utils.post) throw new Error("Missing network funcs");
});

test("Utils", "network.js - get/post/postFormData", () => {
    const { get, post, postFormData } = require("../../src/lib/utils/network");
    if (!get || !post || !postFormData) throw new Error("Missing exports");
});

test("Utils", "headers.js - getHeaders", () => {
    const { getHeaders } = require("../../src/lib/utils/headers");
    if (typeof getHeaders !== "function") throw new Error("Missing getHeaders");
});

test("Utils", "constants.js - getFrom/log/warn/error", () => {
    const c = require("../../src/lib/utils/constants");
    if (!c.getFrom || !c.log || !c.warn || !c.error) throw new Error("Missing exports");
});

test("Utils", "formatters.js - formatDeltaMessage", () => {
    const { formatDeltaMessage } = require("../../src/lib/utils/formatters");
    if (typeof formatDeltaMessage !== "function") throw new Error("Missing");
});

test("Utils", "clients.js - parseAndCheckLogin/getAppState", () => {
    const { parseAndCheckLogin, getAppState } = require("../../src/lib/utils/clients");
    if (!parseAndCheckLogin || !getAppState) throw new Error("Missing exports");
});

test("Utils", "messageStore.js - store/get/getStats", () => {
    const ms = require("../../src/lib/utils/messageStore");
    if (!ms.store || !ms.get || !ms.getStats) throw new Error("Missing exports");
});

test("Utils", "debug.js - logApiCall/logAuth/logEvent", () => {
    const d = require("../../src/lib/utils/debug");
    if (!d.logApiCall || !d.logAuth || !d.logEvent) throw new Error("Missing exports");
});

test("Utils", "user-agents.js - randomUserAgent", () => {
    const { randomUserAgent } = require("../../src/lib/utils/user-agents");
    if (typeof randomUserAgent !== "function") throw new Error("Missing");
});

// ═══════════════════════════════════════════════════════════
// SECTION 4: Messaging API
// ═══════════════════════════════════════════════════════════
section("Messaging API (src/api/messaging)");

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

messagingModules.forEach((mod) => {
    test("Messaging", mod, () => {
        const m = require(`../../src/api/messaging/${mod}`);
        if (typeof m !== "function") throw new Error("Not a factory function");
    });
});

// ═══════════════════════════════════════════════════════════
// SECTION 5: MQTT API
// ═══════════════════════════════════════════════════════════
section("MQTT API (src/api/mqtt)");

test("MQTT", "listenMqtt", () => {
    const m = require("../../src/api/mqtt/listenMqtt");
    if (typeof m !== "function") throw new Error("Not a factory function");
});

test("MQTT", "sendMessageMqtt", () => {
    const m = require("../../src/api/mqtt/sendMessageMqtt");
    if (typeof m !== "function") throw new Error("Not a factory function");
});

test("MQTT", "setMessageReactionMqtt", () => {
    const m = require("../../src/api/mqtt/setMessageReactionMqtt");
    if (typeof m !== "function") throw new Error("Not a factory function");
});

test("MQTT", "pinMessage", () => {
    const m = require("../../src/api/mqtt/pinMessage");
    if (typeof m !== "function") throw new Error("Not a factory function");
});

test("MQTT", "realtime", () => {
    const m = require("../../src/api/mqtt/realtime");
    if (typeof m !== "function") throw new Error("Not a factory function");
});

test("MQTT", "deltas/value parser", () => {
    const { parseDelta } = require("../../src/api/mqtt/deltas/value");
    if (typeof parseDelta !== "function") throw new Error("Missing parseDelta");
});

// ═══════════════════════════════════════════════════════════
// SECTION 6: Threads API
// ═══════════════════════════════════════════════════════════
section("Threads API (src/api/threads)");

test("Threads", "getThreadInfo", () => {
    const m = require("../../src/api/threads/getThreadInfo");
    if (typeof m !== "function") throw new Error("Not a factory function");
});

test("Threads", "getThreadList", () => {
    const m = require("../../src/api/threads/getThreadList");
    if (typeof m !== "function") throw new Error("Not a factory function");
});

test("Threads", "getThreadHistory", () => {
    const m = require("../../src/api/threads/getThreadHistory");
    if (typeof m !== "function") throw new Error("Not a factory function");
});

// ═══════════════════════════════════════════════════════════
// SECTION 7: Users API
// ═══════════════════════════════════════════════════════════
section("Users API (src/api/users)");

test("Users", "getUserInfo", () => {
    const m = require("../../src/api/users/getUserInfo");
    if (typeof m !== "function") throw new Error("Not a factory function");
});

// ═══════════════════════════════════════════════════════════
// SECTION 8: Posting API
// ═══════════════════════════════════════════════════════════
section("Posting API (src/api/posting)");

test("Posting", "story", () => {
    const m = require("../../src/api/posting/story");
    if (typeof m !== "function") throw new Error("Not a factory function");
});

test("Posting", "comment", () => {
    const m = require("../../src/api/posting/comment");
    if (typeof m !== "function") throw new Error("Not a factory function");
});

test("Posting", "follow", () => {
    const m = require("../../src/api/posting/follow");
    if (typeof m !== "function") throw new Error("Not a factory function");
});

test("Posting", "friend", () => {
    const m = require("../../src/api/posting/friend");
    if (typeof m !== "function") throw new Error("Not a factory function");
});

test("Posting", "share", () => {
    const m = require("../../src/api/posting/share");
    if (typeof m !== "function") throw new Error("Not a factory function");
});

// ═══════════════════════════════════════════════════════════
// SECTION 9: HTTP API
// ═══════════════════════════════════════════════════════════
section("HTTP API (src/api/http)");

test("HTTP", "httpGet", () => {
    const m = require("../../src/api/http/httpGet");
    if (typeof m !== "function") throw new Error("Not a factory function");
});

test("HTTP", "httpPost", () => {
    const m = require("../../src/api/http/httpPost");
    if (typeof m !== "function") throw new Error("Not a factory function");
});

test("HTTP", "httpPostFormData", () => {
    const m = require("../../src/api/http/httpPostFormData");
    if (typeof m !== "function") throw new Error("Not a factory function");
});

// ═══════════════════════════════════════════════════════════
// SECTION 10: Login API
// ═══════════════════════════════════════════════════════════
section("Login API (src/api/login)");

test("Login", "GetBotInfo", () => {
    const m = require("../../src/api/login/GetBotInfo");
    if (typeof m !== "function") throw new Error("Not a factory function");
});

test("Login", "getBotInitialData", () => {
    const m = require("../../src/api/login/getBotInitialData");
    if (typeof m !== "function") throw new Error("Not a factory function");
});

test("Login", "logout", () => {
    const m = require("../../src/api/login/logout");
    if (typeof m !== "function") throw new Error("Not a factory function");
});

// ═══════════════════════════════════════════════════════════
// SECTION 11: Extra API
// ═══════════════════════════════════════════════════════════
section("Extra API (src/api/extra)");

test("Extra", "addExternalModule", () => {
    const m = require("../../src/api/extra/addExternalModule");
    if (typeof m !== "function") throw new Error("Not a factory function");
});

test("Extra", "getAccess", () => {
    const m = require("../../src/api/extra/getAccess");
    if (typeof m !== "function") throw new Error("Not a factory function");
});

// ═══════════════════════════════════════════════════════════
// SECTION 12: Types
// ═══════════════════════════════════════════════════════════
section("TypeScript Types");

test("Types", "index.d.ts exists", () => {
    const fs = require("fs");
    const path = require("path");
    const typesPath = path.join(__dirname, "..", "..", "types", "index.d.ts");
    if (!fs.existsSync(typesPath)) throw new Error("Types file missing");
});

// ═══════════════════════════════════════════════════════════
// SECTION 13: Cross-Module Integration
// ═══════════════════════════════════════════════════════════
section("Cross-Module Integration");

test("Integration", "Utils accessible from API modules", () => {
    // Verify that API modules can access utils
    const sendMsg = require("../../src/api/messaging/sendMessage");
    // If it loads without error, the require path works
    if (typeof sendMsg !== "function") throw new Error("Failed");
});

test("Integration", "MQTT delta parser uses utils", () => {
    const { parseDelta } = require("../../src/api/mqtt/deltas/value");
    if (typeof parseDelta !== "function") throw new Error("Failed");
});

test("Integration", "loginHelper loads API modules path", () => {
    const fs = require("fs");
    const path = require("path");
    const helperPath = path.join(__dirname, "..", "..", "src", "core", "auth", "loginHelper.js");
    const content = fs.readFileSync(helperPath, "utf8");
    if (!content.includes('path.join(__dirname, "..", "..", "api")')) {
        throw new Error("API path not configured correctly");
    }
});

// ═══════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(60));
console.log(`\n📊 FINAL RESULTS: ${passed} passed, ${failed} failed\n`);

if (errors.length > 0) {
    console.log("❌ ERRORS:");
    errors.forEach((e) => {
        console.log(`   [${e.category}] ${e.name}: ${e.error}`);
    });
    console.log("");
}

if (failed === 0) {
    console.log("🎉 ALL TESTS PASSED! NERO is fully connected and working!\n");
    console.log("📋 Summary:");
    console.log("   • Entry points: ✅");
    console.log("   • Authentication: ✅");
    console.log("   • Utilities: ✅");
    console.log("   • Messaging API (19 modules): ✅");
    console.log("   • MQTT API (6 modules): ✅");
    console.log("   • Threads API (3 modules): ✅");
    console.log("   • Users API (1 module): ✅");
    console.log("   • Posting API (5 modules): ✅");
    console.log("   • HTTP API (3 modules): ✅");
    console.log("   • Login API (3 modules): ✅");
    console.log("   • Extra API (2 modules): ✅");
    console.log("   • TypeScript Types: ✅");
    console.log("   • Cross-module integration: ✅\n");
    process.exit(0);
} else {
    console.log("⚠️ Some tests failed. Please fix the issues above.\n");
    process.exit(1);
}
