/**
 * Test script for Auto-Save AppState Feature
 * Run: node tests/test-autosave.js
 */

const path = require("path");
const nero = require("../src/fca-redux");
const AccountManager = require("../src/utils/accountManager");
const logger = require("../src/utils/logger");

// Enable all logging
logger.setLevel("verbose");

const accountManager = new AccountManager({
    accountsPath: path.join(__dirname, "..", "accounts"),
    neroOptions: {
        autoReconnect: true,
        listenEvents: true,
        updatePresence: false,
        selfListen: false,
    },
    logger: logger,
    autoSaveAppState: true, // Enable auto-save
    autoSaveInterval: 1, // Save every 1 minute for testing
});

async function main() {
    console.log("\n╔═══════════════════════════════════════════════════════════════╗");
    console.log("║           AUTO-SAVE APPSTATE TEST                             ║");
    console.log("╚═══════════════════════════════════════════════════════════════╝\n");

    // Initialize
    await accountManager.init(nero);

    // Listen for appstate save events
    accountManager.on("appStateSaved", (data) => {
        console.log("\n🎉 APPSTATE SAVED EVENT FIRED!");
        console.log("   Account:", data.account);
        console.log("   User ID:", data.userID);
        console.log("   Cookies:", data.cookieCount);
        console.log("   Reason:", data.reason);
        console.log("   File:", data.filePath);
        console.log("");
    });

    // Login all accounts
    console.log("📦 Discovering accounts...");
    const discovered = accountManager.discoverAccounts();
    console.log(`   Found ${discovered.length} account(s)\n`);

    if (discovered.length === 0) {
        console.log("❌ No accounts found in accounts folder!");
        process.exit(1);
    }

    console.log("🔐 Logging in accounts...\n");
    const result = await accountManager.loginAll();

    console.log("\n📊 Login Results:");
    console.log(`   ✅ Success: ${result.success}`);
    console.log(`   ❌ Failed: ${result.failed}`);

    if (result.success === 0) {
        console.log("\n❌ No accounts logged in successfully!");
        process.exit(1);
    }

    // Get online accounts
    const online = accountManager.getOnlineAccounts();
    console.log(`\n🟢 Online accounts: ${online.length}`);

    // Manual save test
    console.log("\n🧪 Testing manual save for first account...");
    const firstAccount = online[0];
    const saveResult = await accountManager.saveAppState(firstAccount.name, "manual-test");

    if (saveResult.success) {
        console.log(`   ✅ Manual save successful! (${saveResult.cookieCount} cookies)`);
    } else {
        console.log(`   ❌ Manual save failed: ${saveResult.error}`);
    }

    // Show stats
    console.log("\n📈 Save Statistics:");
    const stats = accountManager.getAllAppStateSaveStats();
    for (const [name, data] of Object.entries(stats)) {
        console.log(`   ${name}:`);
        console.log(`     Total Saves: ${data.totalSaves}`);
        console.log(`     Last Save: ${data.lastSaveTime}`);
        console.log(`     Cookie Count: ${data.lastCookieCount}`);
    }

    console.log("\n⏳ Auto-save is running (every 1 minute)...");
    console.log("   Press Ctrl+C to stop\n");

    // Keep running
    process.on("SIGINT", async () => {
        console.log("\n\n🛑 Shutting down...");
        console.log("   Saving final appstate before exit...");
        await accountManager.saveAllAppStates("shutdown");
        console.log("   Logging out all accounts...");
        await accountManager.logoutAll();
        console.log("   ✅ Done!\n");
        process.exit(0);
    });
}

main().catch((err) => {
    console.error("Error:", err);
    process.exit(1);
});
