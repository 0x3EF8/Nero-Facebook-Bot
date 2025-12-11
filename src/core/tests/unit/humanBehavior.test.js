/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                   NERO - Advanced Human Behavior Tests                       ║
 * ║               Anti-Detection System Tests & Validation                       ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

"use strict";

const { describe, it, expect, beforeEach, afterEach } = require("../lib/test-framework");
const humanBehavior = require("../../src/lib/utils/humanBehavior");

describe("Human Behavior Module", () => {
    beforeEach(() => {
        // Reset state before each test
        humanBehavior.reset();
    });

    describe("calculateTypingTime", () => {
        it("should return 0 for empty message", () => {
            expect(humanBehavior.calculateTypingTime("")).toBe(0);
            expect(humanBehavior.calculateTypingTime(null)).toBe(0);
            expect(humanBehavior.calculateTypingTime(undefined)).toBe(0);
        });

        it("should return positive value for non-empty message", () => {
            const result = humanBehavior.calculateTypingTime("Hello world");
            expect(result).toBeGreaterThan(0);
        });

        it("should return larger delay for longer messages", () => {
            const shortMessage = humanBehavior.calculateTypingTime("Hi");
            const longMessage = humanBehavior.calculateTypingTime(
                "This is a much longer message that takes more time to type out completely"
            );
            expect(longMessage).toBeGreaterThan(shortMessage);
        });

        it("should cap typing time at 30 seconds max", () => {
            const veryLongMessage = "word ".repeat(1000);
            const result = humanBehavior.calculateTypingTime(veryLongMessage);
            expect(result).toBeLessThanOrEqual(30000);
        });
    });

    describe("calculateReadDelay", () => {
        it("should return positive value for empty content", () => {
            const result = humanBehavior.calculateReadDelay("");
            expect(result).toBeGreaterThan(0);
        });

        it("should return larger delay for longer content", () => {
            const shortDelay = humanBehavior.calculateReadDelay("Hi");
            const longDelay = humanBehavior.calculateReadDelay(
                "This is a very long message that would take more time to read through carefully"
            );
            expect(longDelay).toBeGreaterThan(shortDelay);
        });

        it("should return value within expected range", () => {
            const result = humanBehavior.calculateReadDelay("Hello");
            expect(result).toBeGreaterThan(500); // At least some delay
            expect(result).toBeLessThan(60000); // Less than a minute
        });
    });

    describe("calculateActionDelay", () => {
        it("should return positive value", () => {
            const result = humanBehavior.calculateActionDelay();
            expect(result).toBeGreaterThan(0);
        });

        it("should return value within expected range", () => {
            const result = humanBehavior.calculateActionDelay();
            // Account for time multiplier which can increase delay
            expect(result).toBeGreaterThan(100);
            expect(result).toBeLessThan(60000);
        });
    });

    describe("delay", () => {
        it("should be a function", () => {
            expect(typeof humanBehavior.delay).toBe("function");
        });

        it("should return a Promise", () => {
            const result = humanBehavior.delay(1);
            expect(result instanceof Promise).toBe(true);
        });

        it("should resolve after specified time", async () => {
            const start = Date.now();
            await humanBehavior.delay(50);
            const elapsed = Date.now() - start;
            expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some tolerance
        });
    });

    describe("getTimeMultiplier", () => {
        it("should return a number between 0.1 and 1.0", () => {
            const result = humanBehavior.getTimeMultiplier();
            expect(typeof result).toBe("number");
            expect(result).toBeGreaterThanOrEqual(0.1);
            expect(result).toBeLessThanOrEqual(1.0);
        });
    });

    describe("getStats", () => {
        it("should return stats object with expected properties", () => {
            const stats = humanBehavior.getStats();
            expect(typeof stats).toBe("object");
            expect(typeof stats.actionsInLastMinute).toBe("number");
            expect(typeof stats.messagesInLastMinute).toBe("number");
            expect(typeof stats.consecutiveActions).toBe("number");
            expect(typeof stats.sessionDuration).toBe("number");
            expect(typeof stats.timeMultiplier).toBe("number");
            expect(typeof stats.nearRateLimit).toBe("boolean");
        });

        it("should have zero counts after reset", () => {
            humanBehavior.reset();
            const stats = humanBehavior.getStats();
            expect(stats.actionsInLastMinute).toBe(0);
            expect(stats.messagesInLastMinute).toBe(0);
            expect(stats.consecutiveActions).toBe(0);
        });
    });

    describe("reset", () => {
        it("should reset all counters", () => {
            // First get some stats to ensure we're testing reset
            humanBehavior.reset();
            const stats = humanBehavior.getStats();
            expect(stats.actionsInLastMinute).toBe(0);
            expect(stats.messagesInLastMinute).toBe(0);
        });
    });

    describe("configure", () => {
        it("should accept configuration object", () => {
            expect(() => {
                humanBehavior.configure({
                    typing: { minWPM: 40 },
                    reading: { minReadDelay: 1000 },
                });
            }).not.toThrow();
        });

        it("should update configuration values", () => {
            const originalConfig = { ...humanBehavior.HUMAN_CONFIG };
            humanBehavior.configure({
                typing: { minWPM: 50 },
            });
            expect(humanBehavior.HUMAN_CONFIG.typing.minWPM).toBe(50);

            // Reset for other tests
            humanBehavior.configure({ typing: { minWPM: originalConfig.typing.minWPM } });
        });
    });

    describe("isNearRateLimit", () => {
        it("should return boolean", () => {
            const result = humanBehavior.isNearRateLimit();
            expect(typeof result).toBe("boolean");
        });

        it("should return false when no actions have been performed", () => {
            humanBehavior.reset();
            expect(humanBehavior.isNearRateLimit()).toBe(false);
        });
    });

    describe("beforeSendMessage", () => {
        it("should be a function", () => {
            expect(typeof humanBehavior.beforeSendMessage).toBe("function");
        });

        it("should return a Promise", () => {
            const ctx = { globalOptions: { humanBehavior: false } };
            const result = humanBehavior.beforeSendMessage(ctx, {}, "123", "test");
            expect(result instanceof Promise).toBe(true);
        });

        it("should resolve quickly when humanBehavior is disabled", async () => {
            const ctx = { globalOptions: { humanBehavior: false } };
            const start = Date.now();
            await humanBehavior.beforeSendMessage(ctx, {}, "123", "test");
            const elapsed = Date.now() - start;
            expect(elapsed).toBeLessThan(50);
        });
    });

    describe("beforeMarkAsRead", () => {
        it("should be a function", () => {
            expect(typeof humanBehavior.beforeMarkAsRead).toBe("function");
        });

        it("should return a Promise", () => {
            const ctx = { globalOptions: { humanBehavior: false } };
            const result = humanBehavior.beforeMarkAsRead(ctx, "test message");
            expect(result instanceof Promise).toBe(true);
        });

        it("should resolve quickly when humanBehavior is disabled", async () => {
            const ctx = { globalOptions: { humanBehavior: false } };
            const start = Date.now();
            await humanBehavior.beforeMarkAsRead(ctx, "test message");
            const elapsed = Date.now() - start;
            expect(elapsed).toBeLessThan(50);
        });
    });

    describe("beforeAction", () => {
        it("should be a function", () => {
            expect(typeof humanBehavior.beforeAction).toBe("function");
        });

        it("should return a Promise", () => {
            const ctx = { globalOptions: { humanBehavior: false } };
            const result = humanBehavior.beforeAction(ctx);
            expect(result instanceof Promise).toBe(true);
        });

        it("should resolve quickly when humanBehavior is disabled", async () => {
            const ctx = { globalOptions: { humanBehavior: false } };
            const start = Date.now();
            await humanBehavior.beforeAction(ctx);
            const elapsed = Date.now() - start;
            expect(elapsed).toBeLessThan(50);
        });
    });

    describe("BEHAVIOR_CONFIG", () => {
        it("should expose configuration object", () => {
            expect(typeof humanBehavior.BEHAVIOR_CONFIG).toBe("object");
        });

        it("should have typing configuration", () => {
            expect(typeof humanBehavior.BEHAVIOR_CONFIG.typing).toBe("object");
            expect(humanBehavior.BEHAVIOR_CONFIG.typing.baseWPM).toBeDefined();
            expect(humanBehavior.BEHAVIOR_CONFIG.typing.charDelay).toBeDefined();
        });

        it("should have reading configuration", () => {
            expect(typeof humanBehavior.BEHAVIOR_CONFIG.reading).toBe("object");
            expect(humanBehavior.BEHAVIOR_CONFIG.reading.baseWPM).toBeDefined();
            expect(humanBehavior.BEHAVIOR_CONFIG.reading.minimumReadTime).toBeDefined();
        });

        it("should have circadian configuration", () => {
            expect(typeof humanBehavior.BEHAVIOR_CONFIG.circadian).toBe("object");
            expect(humanBehavior.BEHAVIOR_CONFIG.circadian.enabled).toBeDefined();
            expect(humanBehavior.BEHAVIOR_CONFIG.circadian.hourlyActivity).toBeDefined();
        });

        it("should have cognitive configuration", () => {
            expect(typeof humanBehavior.BEHAVIOR_CONFIG.cognitive).toBe("object");
            expect(humanBehavior.BEHAVIOR_CONFIG.cognitive.attention).toBeDefined();
            expect(humanBehavior.BEHAVIOR_CONFIG.cognitive.fatigue).toBeDefined();
            expect(humanBehavior.BEHAVIOR_CONFIG.cognitive.emotion).toBeDefined();
        });

        it("should have rate limit configuration", () => {
            expect(typeof humanBehavior.BEHAVIOR_CONFIG.rateLimit).toBe("object");
            expect(humanBehavior.BEHAVIOR_CONFIG.rateLimit.perMinute).toBeDefined();
            expect(humanBehavior.BEHAVIOR_CONFIG.rateLimit.perHour).toBeDefined();
        });

        it("should have session configuration", () => {
            expect(typeof humanBehavior.BEHAVIOR_CONFIG.session).toBe("object");
            expect(humanBehavior.BEHAVIOR_CONFIG.session.breaks).toBeDefined();
        });
    });

    describe("DEVICE_PROFILES", () => {
        it("should have mobile, desktop, and tablet profiles", () => {
            expect(humanBehavior.DEVICE_PROFILES.mobile).toBeDefined();
            expect(humanBehavior.DEVICE_PROFILES.desktop).toBeDefined();
            expect(humanBehavior.DEVICE_PROFILES.tablet).toBeDefined();
        });

        it("should have typing speeds for each device", () => {
            expect(humanBehavior.DEVICE_PROFILES.mobile.typingSpeed).toBeDefined();
            expect(humanBehavior.DEVICE_PROFILES.desktop.typingSpeed).toBeDefined();
        });
    });

    describe("PERSONALITY_PROFILES", () => {
        it("should have multiple personality types", () => {
            expect(humanBehavior.PERSONALITY_PROFILES.casual).toBeDefined();
            expect(humanBehavior.PERSONALITY_PROFILES.professional).toBeDefined();
            expect(humanBehavior.PERSONALITY_PROFILES.enthusiastic).toBeDefined();
            expect(humanBehavior.PERSONALITY_PROFILES.busy).toBeDefined();
        });
    });

    describe("Mathematical Utilities", () => {
        it("should have gaussianRandom function", () => {
            expect(typeof humanBehavior.gaussianRandom).toBe("function");
            const result = humanBehavior.gaussianRandom(0, 1);
            expect(typeof result).toBe("number");
        });

        it("should have logNormalRandom function", () => {
            expect(typeof humanBehavior.logNormalRandom).toBe("function");
            const result = humanBehavior.logNormalRandom(100, 0.5);
            expect(result).toBeGreaterThan(0);
        });
    });

    describe("Cognitive State", () => {
        it("should have getCognitiveMultiplier function", () => {
            expect(typeof humanBehavior.getCognitiveMultiplier).toBe("function");
            const result = humanBehavior.getCognitiveMultiplier();
            expect(typeof result).toBe("number");
            expect(result).toBeGreaterThan(0);
        });

        it("should have getCircadianMultiplier function", () => {
            expect(typeof humanBehavior.getCircadianMultiplier).toBe("function");
            const result = humanBehavior.getCircadianMultiplier();
            expect(typeof result).toBe("number");
            expect(result).toBeGreaterThan(0);
        });
    });

    describe("Session & Breaks", () => {
        it("should have shouldTakeBreak function", () => {
            expect(typeof humanBehavior.shouldTakeBreak).toBe("function");
        });

        it("should have shouldGetDistracted function", () => {
            expect(typeof humanBehavior.shouldGetDistracted).toBe("function");
            const result = humanBehavior.shouldGetDistracted();
            expect(typeof result).toBe("number");
        });

        it("should have isSleepTime function", () => {
            expect(typeof humanBehavior.isSleepTime).toBe("function");
            const result = humanBehavior.isSleepTime();
            expect(typeof result).toBe("boolean");
        });
    });

    describe("Network Simulation", () => {
        it("should have calculateNetworkLatency function", () => {
            expect(typeof humanBehavior.calculateNetworkLatency).toBe("function");
            const result = humanBehavior.calculateNetworkLatency();
            expect(result).toBeGreaterThan(0);
        });
    });
});
