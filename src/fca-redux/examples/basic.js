/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                        NERO - Complete Usage Example                         ║
 * ║                    All Features & Human Behavior Demonstration               ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * This example demonstrates all features of the NERO API including:
 * - Full setOptions configuration
 * - Human Behavior anti-detection system
 * - All messaging APIs
 * - Event handling
 */

"use strict";

const nero = require("../index");
const fs = require("fs");

// Load app state (cookies) from file
let appState;
try {
    appState = JSON.parse(fs.readFileSync("appstate.json", "utf8"));
} catch (_err) {
    console.error("❌ Could not load appstate.json");
    console.log("📝 Please create an appstate.json file with your Facebook session cookies");
    process.exit(1);
}

// Login with appstate
nero({ appState }, (err, api) => {
    if (err) {
        console.error("❌ Login failed:", err.error || err.message);
        return;
    }

    console.log("✅ Logged in successfully!");
    console.log("👤 User ID:", api.getCurrentUserID());

    // ═══════════════════════════════════════════════════════════════════════════
    // COMPLETE SET OPTIONS - All Available Settings
    // ═══════════════════════════════════════════════════════════════════════════

    api.setOptions({
        // ─────────────────────────────────────────────────────────────────────
        // Core Settings
        // ─────────────────────────────────────────────────────────────────────
        listenEvents: true, // Listen for all events (messages, typing, etc.)
        selfListen: true, // Don't trigger on own messages
        logLevel: "verbose", // "silent", "error", "warn", "info", "verbose"
        updatePresence: false, // Don't update online presence
        forceLogin: false, // Don't force re-login if session is valid
        autoMarkDelivery: false, // Don't auto-mark messages as delivered
        autoMarkRead: false, // Don't auto-mark messages as read

        // ─────────────────────────────────────────────────────────────────────
        // 🛡️ HUMAN BEHAVIOR - Enable the Anti-Detection System
        // ─────────────────────────────────────────────────────────────────────
        humanBehavior: true, // Enable human behavior simulation

        // ─────────────────────────────────────────────────────────────────────
        // 🛡️ HUMAN BEHAVIOR CONFIG - Realistic Human-Like Behavior
        // ─────────────────────────────────────────────────────────────────────
        humanBehaviorConfig: {
            // Device Profile - desktop user (most consistent typing)
            device: "desktop", // 'mobile', 'desktop', 'tablet'

            // Personality Profile - professional = thoughtful, consistent responses
            personality: "professional", // 'casual', 'professional', 'enthusiastic', 'busy'

            // Typing Simulation - Realistic human typing
            typing: {
                baseWPM: { min: 45, max: 65 }, // Average human: 40-60 WPM
                typos: {
                    enabled: true,
                    baseRate: 0.03, // 3% typo rate (realistic)
                    neighborKeyChance: 0.6,
                    doubleCharChance: 0.15,
                    transpositionChance: 0.1,
                    correctionDelay: { min: 100, max: 300 }, // Time to notice & fix typo
                },
                burstTyping: {
                    enabled: true,
                    burstLength: { min: 3, max: 8 }, // Type in short bursts
                    burstPause: { min: 50, max: 150 }, // Natural pauses between bursts
                },
                thinkingPause: {
                    enabled: true,
                    wordThreshold: 5, // Pause to think every ~5 words
                    duration: { min: 200, max: 800 }, // Thinking pause duration
                },
            },

            // Reading/Response Delays - Natural reading speed
            reading: {
                minDelay: 500, // Min time before responding
                maxDelay: 4000, // Max delay for long messages
                perCharacterDelay: 25, // ~25ms per character to read
                comprehensionFactor: 1.3, // Extra time for complex messages
            },

            // Circadian Rhythm - Realistic time-of-day behavior
            circadian: {
                enabled: true,
                sleepHours: { start: 23, end: 7 }, // Night: 11pm - 7am (slower)
                peakHours: { start: 10, end: 20 }, // Peak: 10am - 8pm (normal speed)
                activityMultiplier: {
                    sleep: 2.0, // 2x slower at night
                    normal: 1.0, // Normal speed
                    peak: 0.9, // Slightly faster during peak
                },
            },

            // Rate Limiting - Prevent bot-like message spam
            rateLimit: {
                perMinute: { messages: 10, reactions: 8 }, // Conservative limits
                perHour: { messages: 150, reactions: 100 },
                burstDetection: {
                    enabled: true,
                    maxBurst: 5, // Max 5 rapid messages
                    burstWindow: 10000, // Within 10 seconds
                    cooldown: { min: 3000, max: 8000 }, // Cooldown after burst
                },
                adaptive: {
                    enabled: true,
                    warningThreshold: 0.7, // Slow at 70% capacity
                    criticalThreshold: 0.9, // Critical at 90%
                },
            },

            // Session Management - Realistic session behavior
            session: {
                duration: { min: 30, max: 180 }, // 30min - 3hr sessions
                breaks: {
                    shortBreak: { interval: 20, duration: { min: 30, max: 120 } },
                    longBreak: { interval: 90, duration: { min: 300, max: 900 } },
                },
            },

            // Fingerprint Randomization - Unique behavioral patterns
            fingerprint: {
                randomization: {
                    enabled: true,
                    variance: 0.15, // 15% timing variance
                    reshuffleInterval: 900000, // Reshuffle every 15 minutes
                },
                behavioralDNA: {
                    enabled: true,
                    complexity: 0.7, // Higher complexity = more unique
                },
                entropy: {
                    enabled: true,
                    level: 0.2, // 20% randomness injection
                },
            },

            // Cognitive Simulation - Mental state affects responses
            cognitive: {
                fatigue: {
                    enabled: true,
                    onsetTime: 2700000, // 45 min until fatigue starts
                    maxFatigue: 0.25, // Max 25% slowdown when tired
                    recoveryRate: 0.1, // Slow recovery
                },
                attention: {
                    focusDecayRate: 0.05, // Focus decreases over time
                    recoveryRate: 0.1, // Slow recovery
                    distractionChance: 0.03, // 3% chance of distraction delay
                },
            },

            // Network Simulation - Realistic network behavior
            network: {
                latency: {
                    base: { min: 50, max: 150 }, // Base latency
                    variance: 50,
                    spikeChance: 0.05, // 5% chance of latency spike
                },
            },
        },

        // ─────────────────────────────────────────────────────────────────────
        // Message Store (Anti-Unsend)
        // ─────────────────────────────────────────────────────────────────────
        messageStore: {
            enabled: true, // Store messages for anti-unsend
            maxMessages: 5000, // Max messages to store
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days retention
        },

        // ─────────────────────────────────────────────────────────────────────
        // User Agent Settings
        // ─────────────────────────────────────────────────────────────────────
        userAgent: null, // Custom user agent (null = use default)
    });

    console.log("⚙️ Options configured with Human Behavior enabled");

    // ═══════════════════════════════════════════════════════════════════════════
    // HUMAN BEHAVIOR STATS - Monitor Anti-Detection
    // ═══════════════════════════════════════════════════════════════════════════

    const humanBehavior = require("../src/lib/utils/humanBehavior");

    // Display behavior stats periodically (every 10 minutes to avoid spam)
    setInterval(() => {
        const stats = humanBehavior.getStats();
        console.log("\n📊 Human Behavior Stats:");
        console.log(`   Session: ${Math.round(stats.session.duration / 60000)} min`);
        console.log(`   Actions: ${stats.session.actionCount}`);
        console.log(
            `   Device: ${stats.profile.device}, Personality: ${stats.profile.personality}`
        );
        console.log(`   Focus: ${(stats.cognitive.focusLevel * 100).toFixed(0)}%`);
        console.log(`   Fatigue: ${(stats.cognitive.fatigueLevel * 100).toFixed(0)}%`);
        console.log(`   Fingerprint Phase: ${stats.fingerprint.sessionPhase}`);
        console.log(
            `   Consistency Score: ${(stats.fingerprint.consistencyScore * 100).toFixed(0)}%`
        );
        if (stats.flags.isSleepTime) console.log(`   🌙 Night time detected - slower responses`);
        if (stats.rateLimit.status.isWarning) console.log(`   ⚠️ Approaching rate limit`);
    }, 600000); // Every 10 minutes (reduced spam)

    // ═══════════════════════════════════════════════════════════════════════════
    // MESSAGE LISTENER - Full Event Handling
    // ═══════════════════════════════════════════════════════════════════════════

    const stopListening = api.listenMqtt((err, event) => {
        if (err) {
            console.error("Listen error:", err);
            return;
        }

        // ─────────────────────────────────────────────────────────────────────
        // Handle Message Events
        // ─────────────────────────────────────────────────────────────────────
        if (event.type === "message") {
            const receivedTime = Date.now();
            console.log(
                `\n💬 [${event.isGroup ? "Group" : "DM"}] ${event.senderID}: ${event.body || "(attachment)"}`
            );

            const body = event.body?.toLowerCase() || "";
            const threadID = event.threadID;
            const messageID = event.messageID;

            // Show human behavior info when command is detected
            if (body.startsWith("!")) {
                const stats = humanBehavior.getStats();
                console.log(`\n🛡️ Human Behavior Active:`);
                console.log(
                    `   ├─ Device: ${stats.profile.device} | Personality: ${stats.profile.personality}`
                );
                console.log(
                    `   ├─ Focus: ${(stats.cognitive.focusLevel * 100).toFixed(0)}% | Fatigue: ${(stats.cognitive.fatigueLevel * 100).toFixed(0)}%`
                );
                console.log(
                    `   ├─ Phase: ${stats.fingerprint.sessionPhase} | Consistency: ${(stats.fingerprint.consistencyScore * 100).toFixed(0)}%`
                );
                console.log(
                    `   └─ Actions: ${stats.session.actionCount} | Session: ${Math.round(stats.session.duration / 60000)}min`
                );
            }

            // Check if this is a DM (not a group chat)
            const isDM = !event.isGroup;

            // Helper function to send message with response time tracking
            const sendWithTimer = async (message, tid) => {
                const startTime = Date.now();
                try {
                    // For DMs, pass isSingleUser=true as 4th parameter
                    await api.sendMessage(message, tid, null, isDM);
                    const responseTime = Date.now() - startTime;
                    const totalTime = Date.now() - receivedTime;
                    console.log(`\n⏱️ Response Time:`);
                    console.log(
                        `   ├─ Human Behavior Delay: ${responseTime}ms (${(responseTime / 1000).toFixed(2)}s)`
                    );
                    console.log(
                        `   └─ Total Response Time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`
                    );
                } catch (_err) {
                    console.error("Send error:", _err);
                }
            };

            // ─────────────────────────────────────────────────────────────────
            // Command: !ping - Basic response test
            // ─────────────────────────────────────────────────────────────────
            if (body === "!ping") {
                // Human behavior will automatically add typing delay
                sendWithTimer("🏓 Pong!", threadID);
            }

            // ─────────────────────────────────────────────────────────────────
            // Command: !react - React to a message
            // ─────────────────────────────────────────────────────────────────
            if (body === "!react") {
                api.setMessageReaction("❤️", messageID)
                    .then(() => console.log("✅ Reacted with ❤️"))
                    .catch((err) => console.error("React error:", err));
            }

            // ─────────────────────────────────────────────────────────────────
            // Command: !stats - Show human behavior stats
            // ─────────────────────────────────────────────────────────────────
            if (body === "!stats") {
                const stats = humanBehavior.getStats();
                const statsMsg = [
                    "📊 Human Behavior Stats:",
                    `• Session: ${Math.round(stats.session.duration / 60000)} minutes`,
                    `• Actions: ${stats.session.actionCount}`,
                    `• Device: ${stats.profile.device}`,
                    `• Personality: ${stats.profile.personality}`,
                    `• Focus: ${(stats.cognitive.focusLevel * 100).toFixed(0)}%`,
                    `• Fatigue: ${(stats.cognitive.fatigueLevel * 100).toFixed(0)}%`,
                    `• Emotion: ${stats.cognitive.emotionalState}`,
                    `• Fingerprint: ${stats.fingerprint.sessionPhase}`,
                    `• Consistency: ${(stats.fingerprint.consistencyScore * 100).toFixed(0)}%`,
                    `• Response Style: ${stats.fingerprint.behavioralDNA.responseStyle}`,
                ].join("\n");
                sendWithTimer(statsMsg, threadID);
            }

            // ─────────────────────────────────────────────────────────────────
            // Command: !thread - Get thread info
            // ─────────────────────────────────────────────────────────────────
            if (body === "!thread") {
                api.getThreadInfo(threadID)
                    .then((info) => {
                        const msg = [
                            `📋 Thread Info:`,
                            `• Name: ${info.name || "N/A"}`,
                            `• ID: ${info.threadID}`,
                            `• Members: ${info.participantIDs?.length || 0}`,
                            `• Emoji: ${info.emoji || "👍"}`,
                            `• Color: ${info.color || "default"}`,
                        ].join("\n");
                        sendWithTimer(msg, threadID);
                    })
                    .catch((err) => console.error("Thread info error:", err));
            }

            // ─────────────────────────────────────────────────────────────────
            // Command: !user <id> - Get user info
            // ─────────────────────────────────────────────────────────────────
            if (body.startsWith("!user")) {
                const targetID = body.split(" ")[1] || event.senderID;
                api.getUserInfo(targetID)
                    .then((info) => {
                        const user = info[targetID];
                        if (user) {
                            const msg = [
                                `👤 User Info:`,
                                `• Name: ${user.name}`,
                                `• ID: ${targetID}`,
                                `• Gender: ${user.gender}`,
                                `• Vanity: ${user.vanity || "N/A"}`,
                            ].join("\n");
                            sendWithTimer(msg, threadID);
                        }
                    })
                    .catch((err) => console.error("User info error:", err));
            }

            // ─────────────────────────────────────────────────────────────────
            // Command: !friends - Get friends list
            // ─────────────────────────────────────────────────────────────────
            if (body === "!friends") {
                api.getFriendsList()
                    .then((friends) => {
                        const msg = `👥 You have ${friends.length} friends`;
                        sendWithTimer(msg, threadID);
                    })
                    .catch((err) => console.error("Friends list error:", err));
            }

            // ─────────────────────────────────────────────────────────────────
            // Command: !typing - Send typing indicator
            // ─────────────────────────────────────────────────────────────────
            if (body === "!typing") {
                api.sendTypingIndicator(true, threadID).then(() => {
                    setTimeout(() => {
                        api.sendTypingIndicator(false, threadID);
                        sendWithTimer("Done typing!", threadID);
                    }, 3000);
                });
            }

            // ─────────────────────────────────────────────────────────────────
            // Command: !poll - Create a poll
            // ─────────────────────────────────────────────────────────────────
            if (body === "!poll") {
                api.createPoll("What's for lunch?", threadID, {
                    options: ["Pizza 🍕", "Burger 🍔", "Sushi 🍣", "Salad 🥗"],
                })
                    .then(() => console.log("✅ Poll created"))
                    .catch((err) => console.error("Poll error:", err));
            }

            // ─────────────────────────────────────────────────────────────────
            // Command: !help - Show all commands
            // ─────────────────────────────────────────────────────────────────
            if (body === "!help") {
                const helpMsg = [
                    "🤖 NERO Bot Commands:",
                    "",
                    "📊 Info Commands:",
                    "  !ping - Test bot response",
                    "  !stats - Human behavior stats",
                    "  !thread - Get thread info",
                    "  !user [id] - Get user info",
                    "  !friends - Count friends",
                    "",
                    "💬 Message Commands:",
                    "  !react - React to your message",
                    "  !typing - Show typing indicator",
                    "  !poll - Create a poll",
                    "",
                    "🛡️ Human Behavior: ACTIVE",
                    "   Anti-detection enabled with:",
                    `   • Device: ${humanBehavior.getStats().profile.device}`,
                    `   • Personality: ${humanBehavior.getStats().profile.personality}`,
                ].join("\n");
                sendWithTimer(helpMsg, threadID);
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // Handle Typing Indicator Events
        // ─────────────────────────────────────────────────────────────────────
        if (event.type === "typ") {
            console.log(`✏️ ${event.from} is ${event.isTyping ? "typing..." : "stopped typing"}`);
        }

        // ─────────────────────────────────────────────────────────────────────
        // Handle Message Unsend Events (Anti-Unsend)
        // ─────────────────────────────────────────────────────────────────────
        if (event.type === "message_unsend") {
            console.log(`🗑️ Message unsent by ${event.senderID}`);

            // Try to retrieve the unsent message from message store
            const messageStore = require("../src/lib/utils/messageStore");
            const originalMessage = messageStore.get(event.messageID);

            if (originalMessage) {
                console.log(`📜 Original message was: "${originalMessage.body}"`);
                // Optionally notify about unsent message
                // api.sendMessage(`Someone unsent: "${originalMessage.body}"`, event.threadID);
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // Handle Reaction Events
        // ─────────────────────────────────────────────────────────────────────
        if (event.type === "message_reaction") {
            console.log(
                `${event.reaction} reaction by ${event.userID} on message ${event.messageID}`
            );
        }

        // ─────────────────────────────────────────────────────────────────────
        // Handle Read Receipt Events
        // ─────────────────────────────────────────────────────────────────────
        if (event.type === "read_receipt") {
            console.log(`👁️ Message read by ${event.reader} at ${event.time}`);
        }

        // ─────────────────────────────────────────────────────────────────────
        // Handle Presence Events
        // ─────────────────────────────────────────────────────────────────────
        if (event.type === "presence") {
            console.log(`🟢 ${event.userID} is now ${event.statuses === 0 ? "offline" : "online"}`);
        }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // GRACEFUL SHUTDOWN
    // ═══════════════════════════════════════════════════════════════════════════

    process.on("SIGINT", () => {
        console.log("\n🛑 Shutting down gracefully...");

        // Stop listening
        stopListening();

        // Save updated appstate
        try {
            const newAppState = api.getAppState();
            fs.writeFileSync("appstate.json", JSON.stringify(newAppState, null, 2));
            console.log("💾 AppState saved");
        } catch (err) {
            console.error("Failed to save appstate:", err);
        }

        // Display final stats
        const finalStats = humanBehavior.getStats();
        console.log("\n📊 Final Session Stats:");
        console.log(`   Duration: ${Math.round(finalStats.session.duration / 60000)} minutes`);
        console.log(`   Total Actions: ${finalStats.session.actionCount}`);
        console.log(`   Messages Sent: ${finalStats.session.messageCount}`);
        console.log(`   Final Fatigue: ${(finalStats.cognitive.fatigueLevel * 100).toFixed(0)}%`);

        process.exit(0);
    });

    console.log("\n🚀 Bot is running! Send !help for commands.");
    console.log("🛡️ Human Behavior anti-detection is ACTIVE");
    console.log("Press Ctrl+C to stop.\n");
});
