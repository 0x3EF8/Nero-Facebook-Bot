/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                    NERO - Advanced Human Behavior Engine                     ║
 * ║              Anti-Detection & Behavioral Simulation Module                   ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  ⚠️  BETA STATUS - EXPERIMENTAL MODULE                                       ║
 * ║                                                                              ║
 * ║  This module is currently in BETA and under active development.              ║
 * ║  Many features are implemented but NOT YET FULLY UTILIZED in the bot:        ║
 * ║                                                                              ║
 * ║  ✅ ACTIVE:                                                                  ║
 * ║     - Basic typing delays                                                    ║
 * ║     - Simple response timing                                                 ║
 * ║     - Read receipts simulation                                               ║
 * ║                                                                              ║
 * ║  🔬 EXPERIMENTAL (implemented but testing):                                  ║
 * ║     - Circadian rhythm patterns                                              ║
 * ║     - Session fatigue simulation                                             ║
 * ║     - Cognitive load modeling                                                ║
 * ║     - Emotional state variations                                             ║
 * ║                                                                              ║
 * ║  📋 PLANNED (code exists, not connected):                                    ║
 * ║     - Full behavioral DNA system                                             ║
 * ║     - Advanced fingerprint spoofing                                          ║
 * ║     - Device profile switching                                               ║
 * ║     - Network latency simulation                                             ║
 * ║     - Pattern breaking algorithms                                            ║
 * ║     - Multi-tasking delay simulation                                         ║
 * ║                                                                              ║
 * ║  The goal is to make bot behavior indistinguishable from human users.        ║
 * ║  Features will be enabled gradually after thorough testing.                  ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * This module implements a sophisticated human behavior simulation engine designed
 * to evade Facebook's automated behavior detection systems. It utilizes:
 *
 * - Statistical typing models with Gaussian distributions
 * - Circadian rhythm simulation for time-based patterns
 * - Cognitive load modeling for response timing
 * - Session fatigue simulation
 * - Attention drift patterns
 * - Network latency simulation
 * - Device-specific behavior profiles
 * - Emotional state modeling for response variations
 * - Reading comprehension speed modeling
 * - Multi-tasking simulation (delayed responses)
 * - Advanced fingerprint & anti-detection system
 * - Behavioral DNA generation for session uniqueness
 * - Pattern breaking and entropy injection
 *
 * @module lib/utils/humanBehavior
 * @author 0x3EF8
 * @version 2.0.0-beta
 * @license MIT
 */

"use strict";

const crypto = require("crypto");
const debug = require("./debug");

// ═══════════════════════════════════════════════════════════════════════════════
// MATHEMATICAL UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Box-Muller transform for generating normally distributed random numbers
 * More realistic than uniform random for human behavior simulation
 */
function gaussianRandom(mean = 0, stdev = 1) {
    // Guard against Math.random() returning exactly 0 (which would cause Math.log(0) = -Infinity)
    let u1 = Math.random();
    let u2 = Math.random();

    // Ensure u1 is never 0 or 1 (to avoid log(0) = -Infinity or log(1) = 0 edge cases)
    if (u1 === 0 || u1 === 1) u1 = 0.5;
    if (u2 === 0 || u2 === 1) u2 = 0.5;

    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

    const result = z0 * stdev + mean;

    // Final guard - if somehow we still got NaN/Infinity, return mean
    if (!isFinite(result) || isNaN(result)) {
        return mean;
    }

    return result;
}

/**
 * Generates a random value with log-normal distribution
 * Better models human response times (skewed right)
 */
function logNormalRandom(median, sigma = 0.5) {
    // Guard: ensure median is valid
    if (!isFinite(median) || isNaN(median) || median <= 0) {
        median = 500;
    }
    if (!isFinite(sigma) || isNaN(sigma)) {
        sigma = 0.5;
    }

    const normal = gaussianRandom(0, sigma);
    const result = median * Math.exp(normal);

    // Guard against NaN/Infinity
    if (!isFinite(result) || isNaN(result)) {
        return median;
    }

    return result;
}

/**
 * Exponential distribution for modeling wait times
 */
function exponentialRandom(lambda) {
    // Guard: ensure lambda is valid
    if (!isFinite(lambda) || isNaN(lambda) || lambda <= 0) {
        lambda = 0.01;
    }

    // Avoid log(0)
    let rand = Math.random();
    if (rand === 0 || rand === 1) rand = 0.5;

    const result = -Math.log(1 - rand) / lambda;

    // Guard against NaN/Infinity
    if (!isFinite(result) || isNaN(result)) {
        return 1 / lambda;
    }

    return result;
}

/**
 * Weibull distribution for more realistic timing
 */
function weibullRandom(scale, shape) {
    // Guard parameters
    if (!isFinite(scale) || isNaN(scale) || scale <= 0) scale = 1;
    if (!isFinite(shape) || isNaN(shape) || shape <= 0) shape = 1;

    // Avoid log(0)
    let rand = Math.random();
    if (rand === 0 || rand === 1) rand = 0.5;

    const result = scale * Math.pow(-Math.log(rand), 1 / shape);

    // Guard against NaN/Infinity
    if (!isFinite(result) || isNaN(result)) {
        return scale;
    }

    return result;
}

/**
 * Clamps a value between min and max (with NaN protection)
 */
function clamp(value, min, max) {
    // Guard: if value is NaN or not finite, return the middle of min/max
    if (!isFinite(value) || isNaN(value)) {
        return (min + max) / 2;
    }
    return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation
 */
function lerp(a, b, t) {
    // Guard parameters
    if (!isFinite(a) || isNaN(a)) a = 0;
    if (!isFinite(b) || isNaN(b)) b = 0;
    if (!isFinite(t) || isNaN(t)) t = 0.5;

    return a + (b - a) * t;
}

/**
 * Smooth step interpolation (eased)
 */
function smoothStep(a, b, t) {
    t = clamp((t - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADVANCED CONFIGURATION SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Device behavior profiles - different devices have different usage patterns
 */
const DEVICE_PROFILES = {
    mobile: {
        name: "Mobile Phone",
        typingSpeed: { min: 25, max: 45 }, // Slower on mobile
        typoRate: 0.04, // More typos on mobile
        scrollSpeed: 1.2, // Faster scrolling
        responseDelay: { min: 2000, max: 8000 }, // Slower responses
        sessionLength: { min: 5, max: 30 }, // Shorter sessions (minutes)
        multitaskChance: 0.3, // Often multitasking
    },
    desktop: {
        name: "Desktop Computer",
        typingSpeed: { min: 40, max: 80 }, // Faster on desktop
        typoRate: 0.02, // Fewer typos
        scrollSpeed: 0.8, // Slower scrolling
        responseDelay: { min: 1000, max: 5000 }, // Faster responses
        sessionLength: { min: 15, max: 120 }, // Longer sessions
        multitaskChance: 0.5, // Often multitasking
    },
    tablet: {
        name: "Tablet",
        typingSpeed: { min: 30, max: 55 }, // Medium speed
        typoRate: 0.03, // Medium typos
        scrollSpeed: 1.0, // Normal scrolling
        responseDelay: { min: 1500, max: 6000 }, // Medium responses
        sessionLength: { min: 10, max: 60 }, // Medium sessions
        multitaskChance: 0.4, // Sometimes multitasking
    },
};

/**
 * Personality profiles affect response patterns
 */
const PERSONALITY_PROFILES = {
    casual: {
        name: "Casual User",
        responseTimeMultiplier: 1.5, // Takes time to respond
        messageLength: "short", // Brief messages
        emojiUsage: 0.4, // Uses emojis often
        typoTolerance: 0.8, // Doesn't always fix typos
        readReceiptDelay: 1.2, // Takes time to read
    },
    professional: {
        name: "Professional User",
        responseTimeMultiplier: 0.8, // Responds quickly
        messageLength: "medium", // Moderate messages
        emojiUsage: 0.1, // Rarely uses emojis
        typoTolerance: 0.2, // Fixes most typos
        readReceiptDelay: 0.8, // Reads quickly
    },
    enthusiastic: {
        name: "Enthusiastic User",
        responseTimeMultiplier: 0.6, // Responds very quickly
        messageLength: "long", // Detailed messages
        emojiUsage: 0.6, // Loves emojis
        typoTolerance: 0.5, // Sometimes fixes typos
        readReceiptDelay: 0.6, // Reads very quickly
    },
    busy: {
        name: "Busy User",
        responseTimeMultiplier: 2.5, // Very slow to respond
        messageLength: "short", // Very brief
        emojiUsage: 0.2, // Minimal emojis
        typoTolerance: 0.9, // Rarely fixes typos
        readReceiptDelay: 2.0, // Delayed reading
    },
};

/**
 * Advanced human behavior configuration
 */
const BEHAVIOR_CONFIG = {
    // ═══════════════════════════════════════════════════════════════════════════
    // TYPING DYNAMICS
    // ═══════════════════════════════════════════════════════════════════════════
    typing: {
        // Base typing speed (words per minute)
        baseWPM: { min: 35, max: 75 },

        // Character-level timing variations (milliseconds)
        charDelay: {
            base: 80, // Base delay between characters
            variance: 40, // Random variance
            punctuationMultiplier: 1.8, // Slower after punctuation
            capitalMultiplier: 1.3, // Slower for capitals
            numberMultiplier: 1.5, // Slower for numbers
            specialCharMultiplier: 2.0, // Slower for special chars
        },

        // Word-level timing
        wordDelay: {
            base: 150, // Base delay between words
            variance: 100, // Random variance
            longWordThreshold: 8, // Characters to be "long"
            longWordMultiplier: 1.4, // Slower for long words
        },

        // Thinking pauses (before starting to type)
        thinkingPause: {
            short: { min: 300, max: 1500 }, // Quick responses
            medium: { min: 1500, max: 4000 }, // Normal responses
            long: { min: 4000, max: 12000 }, // Thoughtful responses
        },

        // Typo simulation
        typos: {
            baseRate: 0.025, // 2.5% base typo rate
            fatigueMultiplier: 2.0, // Doubles when fatigued
            correctionDelay: { min: 200, max: 600 }, // Time to notice typo
            backspaceDelay: { min: 50, max: 120 }, // Backspace timing
            adjacentKeyChance: 0.7, // Chance of hitting adjacent key
        },

        // Pause patterns (simulates thinking mid-message)
        midTypingPauses: {
            enabled: true,
            chancePerWord: 0.05, // 5% chance per word
            duration: { min: 500, max: 3000 },
        },

        // Burst typing (fast typing followed by pause)
        burstTyping: {
            enabled: true,
            burstLength: { min: 3, max: 8 }, // Words per burst
            burstPause: { min: 800, max: 2500 },
        },
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // READING & COMPREHENSION
    // ═══════════════════════════════════════════════════════════════════════════
    reading: {
        // Base reading speed (words per minute)
        baseWPM: { min: 200, max: 350 },

        // Comprehension factors
        comprehension: {
            simpleTextMultiplier: 0.8, // Faster for simple text
            complexTextMultiplier: 1.5, // Slower for complex text
            foreignLanguageMultiplier: 2.5, // Much slower for foreign
        },

        // Visual scanning before reading
        scanningDelay: { min: 200, max: 800 },

        // Re-reading chance (didn't understand first time)
        reReadChance: 0.1,
        reReadMultiplier: 0.6, // Re-read is faster

        // Minimum read time (even for short messages)
        minimumReadTime: 400,

        // Attachment viewing time
        attachmentDelay: {
            photo: { min: 1500, max: 4000 },
            video: "duration", // Based on video duration
            audio: "duration",
            file: { min: 500, max: 1500 },
            sticker: { min: 300, max: 1000 },
        },
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // CIRCADIAN RHYTHM (24-hour patterns)
    // ═══════════════════════════════════════════════════════════════════════════
    circadian: {
        enabled: true,
        timezone: "auto", // Auto-detect or specify offset

        // Activity levels by hour (0-23)
        // 1.0 = normal, <1.0 = slower, >1.0 = faster (but capped at 1.2)
        hourlyActivity: {
            0: 0.15,
            1: 0.08,
            2: 0.05,
            3: 0.03,
            4: 0.03,
            5: 0.1,
            6: 0.35,
            7: 0.6,
            8: 0.85,
            9: 0.95,
            10: 1.0,
            11: 1.0,
            12: 0.9,
            13: 0.85,
            14: 0.95,
            15: 1.0,
            16: 1.0,
            17: 0.95,
            18: 0.9,
            19: 0.95,
            20: 1.0,
            21: 0.9,
            22: 0.7,
            23: 0.4,
        },

        // Day of week multipliers
        dayOfWeek: {
            0: 0.85, // Sunday - more relaxed
            1: 1.0, // Monday
            2: 1.0, // Tuesday
            3: 1.0, // Wednesday
            4: 1.0, // Thursday
            5: 0.95, // Friday - end of week
            6: 0.8, // Saturday - weekend
        },

        // Sleep detection (very low activity)
        sleepThreshold: 0.1,
        sleepResponseChance: 0.02, // 2% chance to respond while "sleeping"
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // COGNITIVE LOAD MODELING
    // ═══════════════════════════════════════════════════════════════════════════
    cognitive: {
        // Attention span simulation
        attention: {
            maxFocusTime: 25 * 60 * 1000, // 25 minutes max focus
            focusDecayRate: 0.02, // Focus decreases over time
            recoveryRate: 0.05, // Focus recovers during breaks
            distractionChance: 0.03, // 3% chance of distraction
            distractionDuration: { min: 5000, max: 60000 },
        },

        // Mental fatigue
        fatigue: {
            enabled: true,
            onsetTime: 45 * 60 * 1000, // Fatigue starts after 45 min
            maxFatigue: 0.8, // Max fatigue level (0-1)
            recoveryMultiplier: 2.0, // Recovery during breaks
            effectOnTyping: 1.5, // Slows typing by 50%
            effectOnErrors: 2.0, // Doubles error rate
        },

        // Emotional state (affects response patterns)
        emotion: {
            enabled: true,
            states: ["neutral", "happy", "stressed", "tired", "excited"],
            transitionChance: 0.01, // 1% chance to change state per action
            effectMultipliers: {
                neutral: 1.0,
                happy: 0.85, // Responds faster when happy
                stressed: 1.3, // Slower when stressed
                tired: 1.6, // Much slower when tired
                excited: 0.7, // Very fast when excited
            },
        },
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // NETWORK SIMULATION
    // ═══════════════════════════════════════════════════════════════════════════
    network: {
        // Simulated network latency
        latency: {
            base: { min: 50, max: 200 }, // Base latency
            variance: 50, // Jitter
            spikeChance: 0.05, // 5% chance of latency spike
            spikeDuration: { min: 500, max: 2000 },
        },

        // Connection quality simulation
        connectionQuality: {
            excellent: { latencyMult: 0.5, dropChance: 0.001 },
            good: { latencyMult: 1.0, dropChance: 0.005 },
            fair: { latencyMult: 1.5, dropChance: 0.02 },
            poor: { latencyMult: 3.0, dropChance: 0.05 },
        },

        // Retry behavior
        retryDelay: { min: 1000, max: 3000 },
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // SESSION MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════
    session: {
        // Session duration limits
        duration: {
            min: 5 * 60 * 1000, // 5 minutes minimum
            max: 4 * 60 * 60 * 1000, // 4 hours maximum
            average: 45 * 60 * 1000, // 45 minutes average
        },

        // Break patterns
        breaks: {
            microBreak: {
                interval: { min: 5, max: 15 }, // Minutes between
                duration: { min: 5000, max: 15000 },
                chance: 0.1,
            },
            shortBreak: {
                interval: { min: 20, max: 40 },
                duration: { min: 30000, max: 120000 },
                chance: 0.05,
            },
            longBreak: {
                interval: { min: 60, max: 120 },
                duration: { min: 5 * 60000, max: 30 * 60000 },
                chance: 0.02,
            },
        },

        // Activity bursts
        activityBursts: {
            enabled: true,
            duration: { min: 2, max: 10 }, // Minutes of high activity
            cooldown: { min: 5, max: 20 }, // Minutes of low activity
        },
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // RATE LIMITING (Anti-Spam Protection)
    // ═══════════════════════════════════════════════════════════════════════════
    rateLimit: {
        // Per-minute limits
        perMinute: {
            messages: 15,
            reactions: 30,
            actions: 45,
        },

        // Per-hour limits
        perHour: {
            messages: 200,
            reactions: 500,
            actions: 800,
        },

        // Burst detection
        burst: {
            threshold: 5, // Actions in window
            window: 10000, // Window size (ms)
            cooldown: { min: 5000, max: 15000 },
        },

        // Adaptive throttling
        adaptive: {
            enabled: true,
            warningThreshold: 0.7, // 70% of limit
            throttleMultiplier: 1.5, // Slow down by 50%
            criticalThreshold: 0.9, // 90% of limit
            criticalMultiplier: 3.0, // Slow down by 200%
        },
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // ADVANCED BEHAVIORAL FINGERPRINT & ANTI-DETECTION SYSTEM
    // ═══════════════════════════════════════════════════════════════════════════
    fingerprint: {
        // Core randomization settings
        randomization: {
            enabled: true,
            variance: 0.15, // 15% variance in all timings
            reshuffleInterval: 3600000, // Reshuffle every hour
            microVariance: 0.05, // 5% micro-variance per action
        },

        // Behavioral DNA - unique per session
        behavioralDNA: {
            enabled: true,
            // These create a unique "behavioral signature" that changes each session
            typingRhythm: null, // Generated on init
            pausePattern: null, // Generated on init
            responseStyle: null, // Generated on init
            activityCurve: null, // Generated on init
        },

        // Anti-pattern detection evasion
        antiPattern: {
            enabled: true,
            // Avoid detectable patterns
            avoidExactIntervals: true, // Never use exact timing intervals
            avoidRoundNumbers: true, // Avoid delays like 1000, 2000, 5000
            jitterPercentage: 0.12, // Add 12% jitter to everything
            randomizeActionOrder: false, // Randomize non-dependent actions
        },

        // Entropy injection (adds unpredictability)
        entropy: {
            enabled: true,
            sources: ["time", "action_count", "message_length", "thread_id"],
            mixingFunction: "xorshift", // Algorithm for mixing entropy
            entropyPool: null, // Generated on init
        },

        // Stealth mode features
        stealth: {
            enabled: true,
            // Mimics real user inconsistencies
            occasionalSlowdown: 0.08, // 8% chance of random slowdown
            occasionalSpeedup: 0.05, // 5% chance of speedup
            doubleCheckChance: 0.03, // 3% chance to "re-read" before action
            hesitationChance: 0.04, // 4% chance of hesitation mid-action
            abandonChance: 0.01, // 1% chance to start but not complete action
        },

        // Device fingerprint spoofing
        deviceSpoof: {
            enabled: true,
            rotateUserAgent: false, // Don't rotate UA (can cause detection)
            simulateHardwareVariance: true, // Simulate different device speeds
            cpuThrottleSimulation: true, // Simulate CPU throttling on mobile
            memoryPressureSimulation: true, // Simulate low memory conditions
        },

        // Temporal fingerprint obfuscation
        temporal: {
            enabled: true,
            avoidPreciseTimestamps: true, // Add noise to all timestamps
            timestampJitter: 50, // ±50ms jitter on timestamps
            avoidSystemClockSync: true, // Slight drift from system clock
            clockDrift: 0, // Generated on init (-500 to +500ms)
        },

        // Behavioral consistency scoring
        consistency: {
            enabled: true,
            targetScore: 0.75, // Target 75% consistency (humans aren't 100%)
            varianceWindow: 0.15, // ±15% variance allowed
            adaptiveCorrection: true, // Auto-correct if too consistent/inconsistent
        },

        // Mouse movement simulation (for web contexts)
        mouse: {
            enabled: false,
            speed: { min: 200, max: 800 },
            jitter: 5,
            curveType: "bezier", // Natural mouse curves
            overshoot: 0.1, // 10% overshoot on targets
        },

        // Keyboard dynamics simulation
        keyboard: {
            enabled: true,
            keyHoldTime: { min: 50, max: 150 },
            flightTime: { min: 30, max: 200 }, // Time between key releases and next press
            errorCorrection: {
                enabled: true,
                backspaceDelay: { min: 80, max: 250 },
                pauseBeforeCorrect: { min: 100, max: 500 },
            },
            fatigueEffect: true, // Typing slows over time
            rhythmVariation: 0.2, // 20% rhythm variation
        },
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // ADVANCED ANTI-DETECTION EVASION TECHNIQUES
    // ═══════════════════════════════════════════════════════════════════════════
    antiDetection: {
        // Request pattern obfuscation
        requestObfuscation: {
            enabled: true,
            varyRequestTiming: true,
            varyPayloadSize: false, // Don't vary payload (can break API)
            addDecoyPauses: true, // Add pauses that look like page loads
            simulateNetworkConditions: true,
        },

        // Behavioral anomaly prevention
        anomalyPrevention: {
            enabled: true,
            maxActionsPerMinute: 40,
            maxMessagesPerThread: 50, // Per hour
            minTimeBetweenActions: 200,
            maxConsecutiveActions: 8,
            requiredBreakAfterBurst: true,
        },

        // Bot detection signal avoidance
        botSignalAvoidance: {
            enabled: true,
            // Avoid these bot-like behaviors:
            avoidPerfectTiming: true,
            avoidInstantResponses: true,
            avoidRepeatedPatterns: true,
            avoidMachineReadableOutput: true,
            avoid24x7Activity: true,
            avoidUnhumanlyFastTyping: true,
        },

        // Session authenticity
        sessionAuthenticity: {
            enabled: true,
            simulateSessionStart: true, // Warm-up period at session start
            simulateSessionEnd: true, // Cool-down before session end
            warmupDuration: 60000, // 1 minute warmup
            cooldownDuration: 30000, // 30 second cooldown
            activityCurve: "bell", // Activity follows bell curve
        },

        // Geographic consistency
        geoConsistency: {
            enabled: true,
            maintainTimezone: true,
            respectLocalHolidays: false, // Optional: slower on holidays
            simulateCommute: false, // Optional: gaps during commute hours
        },
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // MACHINE LEARNING EVASION (Pattern Breaking)
    // ═══════════════════════════════════════════════════════════════════════════
    mlEvasion: {
        enabled: true,

        // Pattern breaking
        patternBreaking: {
            enabled: true,
            breakInterval: 300000, // Every 5 minutes
            breakIntensity: 0.3, // 30% deviation during breaks
            breakDuration: 30000, // 30 second break patterns
        },

        // Feature poisoning (adds noise to ML features)
        featurePoisoning: {
            enabled: true,
            timingNoise: true,
            sequenceNoise: true,
            volumeNoise: true,
        },

        // Adversarial patterns
        adversarialPatterns: {
            enabled: true,
            mimicHumanErrors: true,
            mimicDistraction: true,
            mimicMultitasking: true,
            mimicTiredness: true,
        },
    },
};

// ═══════════════════════════════════════════════════════════════════════════════
// STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Advanced fingerprint state
 */
const fingerprintState = {
    // Behavioral DNA (unique per session)
    behavioralDNA: {
        typingRhythm: null, // Array of rhythm modifiers
        pausePattern: null, // Pause tendency profile
        responseStyle: null, // Quick/slow/variable responder
        activityCurve: null, // Daily activity curve modifier
        uniqueSeed: null, // Session-unique seed
    },

    // Entropy pool for unpredictability
    entropy: {
        pool: [],
        index: 0,
        lastRefresh: Date.now(),
    },

    // Temporal state
    temporal: {
        clockDrift: 0,
        driftDirection: 1,
        lastDriftUpdate: Date.now(),
    },

    // Consistency tracking
    consistency: {
        recentDelays: [],
        recentActions: [],
        currentScore: 0.75,
        adjustmentFactor: 1.0,
    },

    // Pattern breaking state
    patternBreaking: {
        lastBreak: Date.now(),
        inBreakMode: false,
        breakEndTime: 0,
    },

    // Session authenticity
    sessionPhase: "warmup", // warmup, active, cooldown
    sessionStartTime: Date.now(),

    // Action history for anti-pattern
    actionHistory: [],
    lastActionTimes: [],
};

/**
 * Global behavioral state tracker
 */
const behaviorState = {
    // Session tracking
    session: {
        startTime: Date.now(),
        lastActionTime: Date.now(),
        actionCount: 0,
        messageCount: 0,
        isActive: true,
    },

    // Rate limiting
    rateLimit: {
        minuteActions: [],
        hourActions: [],
        burstActions: [],
    },

    // Cognitive state
    cognitive: {
        focusLevel: 1.0,
        fatigueLevel: 0,
        emotionalState: "neutral",
        lastStateChange: Date.now(),
    },

    // Device profile (randomized on init)
    device: null,
    personality: null,

    // Timing variations (reshuffled periodically)
    timingVariance: 1.0,
    lastVarianceUpdate: Date.now(),
};

/**
 * Initialize behavioral state
 */
function initializeBehaviorState() {
    // Randomly select device profile
    const devices = Object.keys(DEVICE_PROFILES);
    behaviorState.device = devices[Math.floor(Math.random() * devices.length)];

    // Randomly select personality
    const personalities = Object.keys(PERSONALITY_PROFILES);
    behaviorState.personality = personalities[Math.floor(Math.random() * personalities.length)];

    // Initialize timing variance
    updateTimingVariance();

    // Initialize fingerprint state
    initializeFingerprintState();

    return behaviorState;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADVANCED FINGERPRINT & ANTI-DETECTION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Initialize the fingerprint anti-detection system
 */
function initializeFingerprintState() {
    const config = BEHAVIOR_CONFIG.fingerprint;

    // Generate unique behavioral DNA for this session
    fingerprintState.behavioralDNA = generateBehavioralDNA();

    // Initialize entropy pool
    fingerprintState.entropy = initializeEntropyPool();

    // Initialize temporal state with clock drift
    fingerprintState.temporal = initializeTemporalState();

    // Initialize consistency tracking
    fingerprintState.consistency = {
        recentDelays: [],
        recentActions: [],
        currentScore: gaussianRandom(0.7, 0.1), // Slightly random starting score
        adjustmentFactor: 1.0,
    };

    // Initialize pattern breaking
    fingerprintState.patternBreaking = {
        lastBreak: Date.now(),
        inBreakMode: false,
        breakEndTime: 0,
    };

    // Session phase warmup
    fingerprintState.sessionPhase = "warmup";
    fingerprintState.sessionStartTime = Date.now();

    return fingerprintState;
}

/**
 * Generates unique behavioral DNA for session
 * This creates a unique "personality" for timing patterns
 */
function generateBehavioralDNA() {
    const config = BEHAVIOR_CONFIG.fingerprint.behavioralDNA;

    // Generate typing rhythm modifiers (how rhythm varies across session)
    const typingRhythm = [];
    for (let i = 0; i < config.typingRhythmSamples; i++) {
        typingRhythm.push(gaussianRandom(1.0, config.rhythmVariance));
    }

    // Generate pause pattern (tendency for different pause lengths)
    const pausePattern = {
        shortPauseTendency: gaussianRandom(1.0, 0.2),
        mediumPauseTendency: gaussianRandom(1.0, 0.2),
        longPauseTendency: gaussianRandom(1.0, 0.3),
        pauseBetweenWords: gaussianRandom(1.0, 0.15),
        pauseBetweenSentences: gaussianRandom(1.0, 0.25),
    };

    // Generate response style profile
    const responseStyles = ["quick", "slow", "variable", "consistent"];
    const responseStyle = responseStyles[Math.floor(Math.random() * responseStyles.length)];

    // Generate daily activity curve modifier
    const activityCurve = [];
    for (let hour = 0; hour < 24; hour++) {
        activityCurve.push(gaussianRandom(1.0, 0.15));
    }

    // Generate unique seed for this session
    const uniqueSeed = crypto.randomBytes(32).toString("hex");

    return {
        typingRhythm,
        pausePattern,
        responseStyle,
        activityCurve,
        uniqueSeed,
        generatedAt: Date.now(),
    };
}

/**
 * Initializes entropy pool for unpredictable variations
 */
function initializeEntropyPool() {
    const config = BEHAVIOR_CONFIG.fingerprint.entropy || { enabled: true };
    const poolSize = 100; // Default pool size
    const pool = [];

    if (!config.enabled) {
        return { pool: [], index: 0, lastRefresh: Date.now() };
    }

    // Fill entropy pool with varied random sources
    for (let i = 0; i < poolSize; i++) {
        // Mix multiple random sources for better entropy
        const base = Math.random();
        const gaussian = gaussianRandom(0, 1);
        const logNorm = logNormalRandom(0, 0.5);

        // Create complex entropy value
        pool.push({
            value: (base + gaussian * 0.3 + logNorm * 0.2) / 1.5,
            type: ["timing", "pause", "variation"][i % 3],
            used: false,
        });
    }

    // Shuffle the pool
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    return {
        pool,
        index: 0,
        lastRefresh: Date.now(),
    };
}

/**
 * Gets next entropy value from pool
 */
function getEntropy(type = "timing") {
    const entropyConfig = BEHAVIOR_CONFIG.fingerprint.entropy || { enabled: true };

    if (!entropyConfig.enabled) return 0;

    const now = Date.now();
    const refreshInterval = 3600000; // Refresh every hour
    const noiseLevel = 0.1; // Default noise level

    // Ensure entropy pool exists
    if (!fingerprintState.entropy || !fingerprintState.entropy.pool) {
        fingerprintState.entropy = initializeEntropyPool();
    }

    // Refresh pool if needed
    if (now - fingerprintState.entropy.lastRefresh > refreshInterval) {
        fingerprintState.entropy = initializeEntropyPool();
    }

    const pool = fingerprintState.entropy.pool;

    if (!pool || pool.length === 0) return 0;

    // Find next matching entry or any unused entry
    let entropy = 0;
    let found = false;

    for (let i = 0; i < pool.length; i++) {
        const idx = (fingerprintState.entropy.index + i) % pool.length;
        if (!pool[idx].used && (pool[idx].type === type || !found)) {
            entropy = pool[idx].value * noiseLevel;
            pool[idx].used = true;
            fingerprintState.entropy.index = (idx + 1) % pool.length;
            found = true;
            if (pool[idx].type === type) break;
        }
    }

    // If all used, reset and get fresh value
    if (!found) {
        pool.forEach((p) => (p.used = false));
        entropy = pool[0].value * noiseLevel;
        pool[0].used = true;
        fingerprintState.entropy.index = 1;
    }

    return entropy;
}

/**
 * Initializes temporal state with clock drift simulation
 */
function initializeTemporalState() {
    const config = BEHAVIOR_CONFIG.fingerprint.temporal || { enabled: true };
    const timestampJitter = config.timestampJitter || 50;

    return {
        clockDrift: 0,
        driftDirection: Math.random() > 0.5 ? 1 : -1,
        driftVelocity: gaussianRandom(0.1, 0.05), // Small drift velocity
        lastDriftUpdate: Date.now(),
        microVariations: generateMicroVariations(timestampJitter),
    };
}

/**
 * Generates micro-timing variations
 */
function generateMicroVariations(amount = 50) {
    const count = 50;
    const variations = [];
    const variationAmount = amount || 50;

    for (let i = 0; i < count; i++) {
        variations.push({
            offset: gaussianRandom(0, variationAmount),
            frequency: Math.random(),
        });
    }

    return variations;
}

/**
 * Gets current temporal offset (simulated clock imprecision)
 */
function getTemporalOffset() {
    const config = BEHAVIOR_CONFIG.fingerprint.temporal || { enabled: true };

    if (!config.enabled) return 0;

    // Ensure temporal state is initialized
    if (!fingerprintState.temporal) {
        fingerprintState.temporal = initializeTemporalState();
    }

    const maxDrift = 500; // Max ±500ms drift
    const now = Date.now();
    const elapsed = now - fingerprintState.temporal.lastDriftUpdate;

    // Update clock drift
    if (elapsed > 1000) {
        fingerprintState.temporal.clockDrift +=
            fingerprintState.temporal.driftDirection *
            fingerprintState.temporal.driftVelocity *
            (elapsed / 1000);

        // Bound drift and occasionally reverse direction
        if (Math.abs(fingerprintState.temporal.clockDrift) > maxDrift) {
            fingerprintState.temporal.driftDirection *= -1;
            fingerprintState.temporal.clockDrift =
                Math.sign(fingerprintState.temporal.clockDrift) * maxDrift;
        }

        // Random direction changes
        if (Math.random() < 0.01) {
            fingerprintState.temporal.driftDirection *= -1;
        }

        fingerprintState.temporal.lastDriftUpdate = now;
    }

    // Add micro-variation
    if (
        fingerprintState.temporal.microVariations &&
        fingerprintState.temporal.microVariations.length > 0
    ) {
        const microIndex = Math.floor(
            (now / 100) % fingerprintState.temporal.microVariations.length
        );
        const microOffset = fingerprintState.temporal.microVariations[microIndex].offset;
        return fingerprintState.temporal.clockDrift + microOffset;
    }

    return fingerprintState.temporal.clockDrift;
}

/**
 * Gets behavioral DNA modifier for current action
 */
function getBehavioralDNAModifier(actionType = "typing") {
    const dna = fingerprintState.behavioralDNA;

    if (!dna || !dna.typingRhythm) return 1.0;

    let modifier = 1.0;

    // Get rhythm modifier based on action count
    const rhythmIndex = behaviorState.session.actionCount % dna.typingRhythm.length;
    modifier *= dna.typingRhythm[rhythmIndex];

    // Apply response style
    switch (dna.responseStyle) {
        case "quick":
            modifier *= 0.85;
            break;
        case "slow":
            modifier *= 1.2;
            break;
        case "variable":
            modifier *= gaussianRandom(1.0, 0.2);
            break;
        case "consistent":
            // Keep consistent with small variance
            modifier *= gaussianRandom(1.0, 0.05);
            break;
    }

    // Apply hourly activity curve
    const hour = new Date().getHours();
    modifier *= dna.activityCurve[hour];

    return modifier;
}

/**
 * Applies pattern breaking to avoid detection
 */
function applyPatternBreaking(delay) {
    // Use stealth config for pattern breaking (occasional slowdowns, speedups, etc.)
    const stealthConfig = BEHAVIOR_CONFIG.fingerprint.stealth || { enabled: true };

    if (!stealthConfig.enabled) return delay;

    // Ensure pattern breaking state is initialized
    if (!fingerprintState.patternBreaking) {
        fingerprintState.patternBreaking = {
            lastBreak: Date.now(),
            inBreakMode: false,
            breakEndTime: 0,
        };
    }

    const breakInterval = 300000; // 5 minutes
    const breakDuration = 30000; // 30 seconds
    const breakProbability = 0.2; // 20% chance

    const now = Date.now();

    // Check if we should trigger a pattern break
    if (now - fingerprintState.patternBreaking.lastBreak > breakInterval) {
        if (Math.random() < breakProbability) {
            fingerprintState.patternBreaking.inBreakMode = true;
            fingerprintState.patternBreaking.breakEndTime = now + breakDuration;
            fingerprintState.patternBreaking.lastBreak = now;
        }
    }

    // If in break mode, apply break modifications
    if (fingerprintState.patternBreaking.inBreakMode) {
        if (now > fingerprintState.patternBreaking.breakEndTime) {
            fingerprintState.patternBreaking.inBreakMode = false;
        } else {
            // During break, vary timing more dramatically
            const breakModifier = gaussianRandom(1.0, 0.4);
            delay = Math.max(delay * breakModifier, 10);

            // Occasionally add longer pause during break
            if (Math.random() < 0.3) {
                delay += exponentialRandom(500);
            }
        }
    }

    // Apply stealth mode occasional variations
    if (Math.random() < (stealthConfig.occasionalSlowdown || 0.08)) {
        delay *= gaussianRandom(1.5, 0.3);
    } else if (Math.random() < (stealthConfig.occasionalSpeedup || 0.05)) {
        delay *= gaussianRandom(0.7, 0.1);
    }

    // Occasional hesitation
    if (Math.random() < (stealthConfig.hesitationChance || 0.04)) {
        delay += exponentialRandom(300);
    }

    return delay;
}

/**
 * Updates consistency tracker with new action
 */
function updateConsistencyTracker(delay, actionType) {
    const maxHistory = 50;

    // Ensure consistency state is initialized
    if (!fingerprintState.consistency) {
        fingerprintState.consistency = {
            recentDelays: [],
            recentActions: [],
            currentScore: 0.75,
            adjustmentFactor: 1.0,
        };
    }

    if (!fingerprintState.consistency.recentDelays) {
        fingerprintState.consistency.recentDelays = [];
    }
    if (!fingerprintState.consistency.recentActions) {
        fingerprintState.consistency.recentActions = [];
    }

    // Add to recent delays
    fingerprintState.consistency.recentDelays.push(delay);
    if (fingerprintState.consistency.recentDelays.length > maxHistory) {
        fingerprintState.consistency.recentDelays.shift();
    }

    // Add to recent actions
    fingerprintState.consistency.recentActions.push({
        type: actionType,
        delay,
        timestamp: Date.now(),
    });
    if (fingerprintState.consistency.recentActions.length > maxHistory) {
        fingerprintState.consistency.recentActions.shift();
    }

    // Calculate consistency score
    if (fingerprintState.consistency.recentDelays.length >= 5) {
        const delays = fingerprintState.consistency.recentDelays;
        const mean = delays.reduce((a, b) => a + b, 0) / delays.length;
        if (mean > 0) {
            const variance =
                delays.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / delays.length;
            const cv = Math.sqrt(variance) / mean; // Coefficient of variation

            // Target CV between 0.2 and 0.5 for natural behavior
            if (cv < 0.2) {
                // Too consistent, need more variation
                fingerprintState.consistency.adjustmentFactor = 1.3;
            } else if (cv > 0.5) {
                // Too random, need more consistency
                fingerprintState.consistency.adjustmentFactor = 0.8;
            } else {
                // Good range
                fingerprintState.consistency.adjustmentFactor = 1.0;
            }

            fingerprintState.consistency.currentScore = Math.min(
                1,
                Math.max(0, 1 - Math.abs(cv - 0.35))
            );
        }
    }

    return fingerprintState.consistency.adjustmentFactor || 1.0;
}

/**
 * Gets session phase modifier
 */
function getSessionPhaseModifier() {
    const now = Date.now();
    const sessionAge = now - (fingerprintState.sessionStartTime || now);
    const warmupDuration = 60000; // 1 minute warmup
    const cooldownThreshold = 0.7; // 70% fatigue threshold

    // Update session phase
    if (sessionAge < warmupDuration) {
        fingerprintState.sessionPhase = "warmup";
        // Slower during warmup
        return 1.2 + 0.3 * (1 - sessionAge / warmupDuration);
    } else if (
        behaviorState.cognitive &&
        behaviorState.cognitive.fatigueLevel > cooldownThreshold
    ) {
        fingerprintState.sessionPhase = "cooldown";
        // Slower during cooldown
        return 1.3;
    } else {
        fingerprintState.sessionPhase = "active";
        return 1.0;
    }
}

/**
 * Detects if current pattern might trigger detection
 */
function detectPatternAnomaly() {
    // Ensure action history exists
    if (!fingerprintState.actionHistory) {
        fingerprintState.actionHistory = [];
    }

    const history = fingerprintState.actionHistory;

    if (!history || history.length < 10) return { detected: false, type: null };

    const recentActions = history.slice(-10);

    // Check for too-regular intervals
    const intervals = [];
    for (let i = 1; i < recentActions.length; i++) {
        intervals.push(recentActions[i].timestamp - recentActions[i - 1].timestamp);
    }

    if (intervals.length === 0) return { detected: false, type: null };

    const meanInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance =
        intervals.reduce((sum, i) => sum + Math.pow(i - meanInterval, 2), 0) / intervals.length;
    const cv = meanInterval > 0 ? Math.sqrt(variance) / meanInterval : 0;

    // Too regular (CV < 0.1) is suspicious
    if (cv < 0.1 && cv > 0) {
        return { detected: true, type: "regular_intervals" };
    }

    // Check for burst patterns
    const shortIntervals = intervals.filter((i) => i < 500);
    if (shortIntervals.length > 7) {
        return { detected: true, type: "burst_pattern" };
    }

    // Check for identical delays
    const delayMap = {};
    recentActions.forEach((a) => {
        if (a && a.delay) {
            const roundedDelay = Math.round(a.delay / 10) * 10;
            delayMap[roundedDelay] = (delayMap[roundedDelay] || 0) + 1;
        }
    });

    const delayValues = Object.values(delayMap);
    const maxSameDelay = delayValues.length > 0 ? Math.max(...delayValues) : 0;
    if (maxSameDelay > 5) {
        return { detected: true, type: "repeated_delays" };
    }

    return { detected: false, type: null };
}
/**
 * Applies anti-detection modifications to delay
 */
function applyAntiDetection(baseDelay, actionType = "generic") {
    // Guard against NaN/undefined input
    let delay = typeof baseDelay === "number" && !isNaN(baseDelay) ? baseDelay : 500;

    // Ensure actionHistory is initialized
    if (!fingerprintState.actionHistory) {
        fingerprintState.actionHistory = [];
    }

    // Ensure consistency is initialized
    if (!fingerprintState.consistency) {
        fingerprintState.consistency = {
            recentDelays: [],
            recentActions: [],
            currentScore: 0.75,
            adjustmentFactor: 1.0,
        };
    }

    // Record action for pattern detection
    fingerprintState.actionHistory.push({
        type: actionType,
        delay,
        timestamp: Date.now(),
    });

    // Keep only last 100 actions
    if (fingerprintState.actionHistory.length > 100) {
        fingerprintState.actionHistory.shift();
    }

    // Check for pattern anomalies
    const anomaly = detectPatternAnomaly();
    if (anomaly.detected) {
        // Apply corrective measures
        switch (anomaly.type) {
            case "regular_intervals":
                // Add significant random variation
                const variation = gaussianRandom(1.0, 0.4);
                if (!isNaN(variation)) delay *= variation;
                break;
            case "burst_pattern":
                // Add longer pause
                const burst = exponentialRandom(1000);
                if (!isNaN(burst)) delay += burst;
                break;
            case "repeated_delays":
                // Offset delay slightly
                const offset = gaussianRandom(0, 200);
                if (!isNaN(offset)) delay += offset;
                break;
        }
    }

    // Apply behavioral DNA modifier (with NaN guard)
    const dnaModifier = getBehavioralDNAModifier(actionType);
    if (typeof dnaModifier === "number" && !isNaN(dnaModifier)) {
        delay *= dnaModifier;
    }

    // Apply pattern breaking
    const patternDelay = applyPatternBreaking(delay);
    if (typeof patternDelay === "number" && !isNaN(patternDelay)) {
        delay = patternDelay;
    }

    // Add entropy (with NaN guard)
    const entropy = getEntropy("timing");
    if (typeof entropy === "number" && !isNaN(entropy)) {
        delay += entropy * delay * 0.1;
    }

    // Add temporal offset (with NaN guard)
    const temporalOffset = getTemporalOffset();
    if (typeof temporalOffset === "number" && !isNaN(temporalOffset)) {
        delay += temporalOffset;
    }

    // Apply session phase modifier (with NaN guard)
    const phaseModifier = getSessionPhaseModifier();
    if (typeof phaseModifier === "number" && !isNaN(phaseModifier)) {
        delay *= phaseModifier;
    }

    // Update consistency tracker and apply adjustment (with NaN guard)
    const consistencyAdjustment = updateConsistencyTracker(delay, actionType);
    if (typeof consistencyAdjustment === "number" && !isNaN(consistencyAdjustment)) {
        delay *= consistencyAdjustment;
    }

    // Final NaN guard - ensure we return a valid number
    if (typeof delay !== "number" || isNaN(delay) || delay < 0) {
        delay = 500; // Default fallback
    }

    // Ensure minimum delay
    delay = Math.max(delay, 10);

    return Math.round(delay);
}

/**
 * Generates browser-like fingerprint data for session
 */
function generateSessionFingerprint() {
    const config = BEHAVIOR_CONFIG.fingerprint;
    const dna = fingerprintState.behavioralDNA;

    return {
        sessionId: dna.uniqueSeed,
        deviceProfile: behaviorState.device,
        personality: behaviorState.personality,
        responseStyle: dna.responseStyle,
        sessionPhase: fingerprintState.sessionPhase,
        consistencyScore: fingerprintState.consistency.currentScore,
        startTime: fingerprintState.sessionStartTime,
        actionCount: behaviorState.session.actionCount,
        timezone: new Date().getTimezoneOffset(),
        language: "en-US",
        platform: getPlatformFingerprint(),
    };
}

/**
 * Gets platform fingerprint based on device profile
 */
function getPlatformFingerprint() {
    const device = DEVICE_PROFILES[behaviorState.device];

    const platforms = {
        mobile: ["iPhone", "Android", "iPad"],
        desktop: ["Windows NT 10.0", "Macintosh", "Linux x86_64"],
        tablet: ["iPad", "Android Tablet"],
    };

    const platformList = platforms[behaviorState.device] || platforms.desktop;
    return platformList[Math.floor(Math.random() * platformList.length)];
}

/**
 * Update timing variance (called periodically)
 */
function updateTimingVariance() {
    if (!BEHAVIOR_CONFIG.fingerprint.randomization.enabled) return;

    const now = Date.now();
    if (
        now - behaviorState.lastVarianceUpdate >
        BEHAVIOR_CONFIG.fingerprint.randomization.reshuffleInterval
    ) {
        const variance = BEHAVIOR_CONFIG.fingerprint.randomization.variance || 0.1;
        behaviorState.timingVariance = 1.0 + (Math.random() - 0.5) * 2 * variance;

        // Guard: ensure timingVariance is valid
        if (!isFinite(behaviorState.timingVariance) || isNaN(behaviorState.timingVariance)) {
            behaviorState.timingVariance = 1.0;
        }

        behaviorState.lastVarianceUpdate = now;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CIRCADIAN RHYTHM ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Gets the current circadian multiplier based on time of day
 */
function getCircadianMultiplier() {
    if (!BEHAVIOR_CONFIG.circadian.enabled) return 1.0;

    const now = new Date();
    const hour = now.getHours();

    // Check if we're in sleep hours (from config or default)
    const sleepStart = BEHAVIOR_CONFIG.circadian.sleepHours?.start ?? 23;
    const sleepEnd = BEHAVIOR_CONFIG.circadian.sleepHours?.end ?? 7;
    const peakStart = BEHAVIOR_CONFIG.circadian.peakHours?.start ?? 10;
    const peakEnd = BEHAVIOR_CONFIG.circadian.peakHours?.end ?? 20;

    // Determine if current hour is in sleep period
    let isInSleep = false;
    if (sleepStart > sleepEnd) {
        // Wraps around midnight (e.g., 23:00 to 07:00)
        isInSleep = hour >= sleepStart || hour < sleepEnd;
    } else {
        isInSleep = hour >= sleepStart && hour < sleepEnd;
    }

    // Determine if current hour is in peak period
    const isInPeak = hour >= peakStart && hour < peakEnd;

    // Get multipliers from config
    const activityMult = BEHAVIOR_CONFIG.circadian.activityMultiplier || {};

    if (isInSleep) {
        return activityMult.sleep ?? 2.0; // Slower at night
    } else if (isInPeak) {
        return activityMult.peak ?? 0.9; // Faster during peak
    } else {
        return activityMult.normal ?? 1.0; // Normal speed
    }
}

/**
 * Checks if it's "sleep time" based on circadian rhythm
 */
function isSleepTime() {
    if (!BEHAVIOR_CONFIG.circadian.enabled) return false;

    const hour = new Date().getHours();
    const sleepStart = BEHAVIOR_CONFIG.circadian.sleepHours?.start ?? 23;
    const sleepEnd = BEHAVIOR_CONFIG.circadian.sleepHours?.end ?? 7;

    // Handle wrap around midnight
    if (sleepStart > sleepEnd) {
        return hour >= sleepStart || hour < sleepEnd;
    }
    return hour >= sleepStart && hour < sleepEnd;
}

/**
 * Gets time-based activity multiplier (legacy compatibility)
 */
function getTimeMultiplier() {
    return getCircadianMultiplier();
}

/**
 * Checks if near rate limit (legacy compatibility)
 */
function isNearRateLimit() {
    const status = getRateLimitStatus();
    return status.isWarning || status.isCritical;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COGNITIVE STATE ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Updates cognitive state (focus, fatigue, emotion)
 */
function updateCognitiveState() {
    const now = Date.now();
    const sessionDuration = now - behaviorState.session.startTime;
    const timeSinceLastAction = now - behaviorState.session.lastActionTime;

    // Update focus level
    if (timeSinceLastAction > 60000) {
        // Focus recovers during inactivity
        behaviorState.cognitive.focusLevel = Math.min(
            1.0,
            behaviorState.cognitive.focusLevel + BEHAVIOR_CONFIG.cognitive.attention.recoveryRate
        );
    } else {
        // Focus decays during activity
        behaviorState.cognitive.focusLevel = Math.max(
            0.2,
            behaviorState.cognitive.focusLevel - BEHAVIOR_CONFIG.cognitive.attention.focusDecayRate
        );
    }

    // Update fatigue
    if (BEHAVIOR_CONFIG.cognitive.fatigue.enabled) {
        if (sessionDuration > BEHAVIOR_CONFIG.cognitive.fatigue.onsetTime) {
            const fatigueProgress =
                (sessionDuration - BEHAVIOR_CONFIG.cognitive.fatigue.onsetTime) /
                (BEHAVIOR_CONFIG.session.duration.max -
                    BEHAVIOR_CONFIG.cognitive.fatigue.onsetTime);
            behaviorState.cognitive.fatigueLevel = Math.min(
                BEHAVIOR_CONFIG.cognitive.fatigue.maxFatigue,
                fatigueProgress
            );
        }
    }

    // Random emotion state changes
    if (BEHAVIOR_CONFIG.cognitive.emotion.enabled) {
        if (Math.random() < BEHAVIOR_CONFIG.cognitive.emotion.transitionChance) {
            const states = BEHAVIOR_CONFIG.cognitive.emotion.states;
            behaviorState.cognitive.emotionalState =
                states[Math.floor(Math.random() * states.length)];
            behaviorState.cognitive.lastStateChange = now;
        }
    }
}

/**
 * Gets the cognitive multiplier for timing adjustments
 */
function getCognitiveMultiplier() {
    updateCognitiveState();

    let multiplier = 1.0;

    // Focus effect (less focus = slower)
    const focusLevel = behaviorState.cognitive.focusLevel || 0.5;
    multiplier *= 1.0 + (1.0 - focusLevel) * 0.5;

    // Fatigue effect
    if (BEHAVIOR_CONFIG.cognitive.fatigue.enabled) {
        const fatigueLevel = behaviorState.cognitive.fatigueLevel || 0;
        const effectOnTyping = BEHAVIOR_CONFIG.cognitive.fatigue.effectOnTyping || 1.0;
        multiplier *= 1.0 + fatigueLevel * (effectOnTyping - 1.0);
    }

    // Emotional state effect
    if (BEHAVIOR_CONFIG.cognitive.emotion.enabled) {
        const emotionMult =
            BEHAVIOR_CONFIG.cognitive.emotion.effectMultipliers[
                behaviorState.cognitive.emotionalState
            ] || 1.0;
        multiplier *= emotionMult;
    }

    // Guard: ensure multiplier is valid
    if (!isFinite(multiplier) || isNaN(multiplier) || multiplier <= 0) {
        return 1.0;
    }

    return multiplier;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITING ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Cleans up old rate limit entries
 */
function cleanupRateLimits() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;
    const burstWindow = now - BEHAVIOR_CONFIG.rateLimit.burst.window;

    behaviorState.rateLimit.minuteActions = behaviorState.rateLimit.minuteActions.filter(
        (t) => t > oneMinuteAgo
    );
    behaviorState.rateLimit.hourActions = behaviorState.rateLimit.hourActions.filter(
        (t) => t > oneHourAgo
    );
    behaviorState.rateLimit.burstActions = behaviorState.rateLimit.burstActions.filter(
        (t) => t > burstWindow
    );
}

/**
 * Records an action for rate limiting
 */
function recordAction(isMessage = false) {
    const now = Date.now();

    behaviorState.rateLimit.minuteActions.push(now);
    behaviorState.rateLimit.hourActions.push(now);
    behaviorState.rateLimit.burstActions.push(now);

    behaviorState.session.lastActionTime = now;
    behaviorState.session.actionCount++;

    if (isMessage) {
        behaviorState.session.messageCount++;
    }

    cleanupRateLimits();
}

/**
 * Checks if we're approaching rate limits
 */
function getRateLimitStatus() {
    cleanupRateLimits();

    const minuteCount = behaviorState.rateLimit.minuteActions.length;
    const hourCount = behaviorState.rateLimit.hourActions.length;
    const burstCount = behaviorState.rateLimit.burstActions.length;

    const minuteRatio = minuteCount / BEHAVIOR_CONFIG.rateLimit.perMinute.actions;
    const hourRatio = hourCount / BEHAVIOR_CONFIG.rateLimit.perHour.actions;
    const burstDetected = burstCount >= BEHAVIOR_CONFIG.rateLimit.burst.threshold;

    return {
        minuteRatio,
        hourRatio,
        burstDetected,
        isWarning:
            minuteRatio >= BEHAVIOR_CONFIG.rateLimit.adaptive.warningThreshold ||
            hourRatio >= BEHAVIOR_CONFIG.rateLimit.adaptive.warningThreshold,
        isCritical:
            minuteRatio >= BEHAVIOR_CONFIG.rateLimit.adaptive.criticalThreshold ||
            hourRatio >= BEHAVIOR_CONFIG.rateLimit.adaptive.criticalThreshold,
    };
}

/**
 * Gets rate limit delay multiplier
 */
function getRateLimitMultiplier() {
    const status = getRateLimitStatus();

    let multiplier = 1.0;

    if (status.isCritical) {
        multiplier = BEHAVIOR_CONFIG.rateLimit.adaptive.criticalMultiplier || 3.0;
    } else if (status.isWarning) {
        multiplier = BEHAVIOR_CONFIG.rateLimit.adaptive.throttleMultiplier || 2.0;
    } else if (status.burstDetected) {
        multiplier = 1.5;
    }

    // Guard: ensure multiplier is valid
    if (!isFinite(multiplier) || isNaN(multiplier) || multiplier <= 0) {
        return 1.0;
    }

    return multiplier;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPING SIMULATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculates realistic typing time for a message
 * Uses character-by-character simulation
 */
function calculateTypingTime(message, options = {}) {
    if (!message || typeof message !== "string" || message.length === 0) {
        return 0;
    }

    const config = BEHAVIOR_CONFIG.typing;
    const deviceProfile = DEVICE_PROFILES[behaviorState.device || "desktop"];
    const personalityProfile = PERSONALITY_PROFILES[behaviorState.personality || "casual"];

    // Get device-specific typing speed
    const wpmRange = deviceProfile.typingSpeed;
    const baseWPM = wpmRange.min + Math.random() * (wpmRange.max - wpmRange.min);

    // Calculate base milliseconds per character
    const avgCharsPerWord = 5;
    const charsPerMinute = baseWPM * avgCharsPerWord;
    const baseCharDelay = 60000 / charsPerMinute;

    let totalTime = 0;
    let wordLength = 0;
    let inWord = false;

    // Character-by-character timing simulation
    for (let i = 0; i < message.length; i++) {
        const char = message[i];
        let charDelay = baseCharDelay;

        // Apply character-specific multipliers
        if (/[.!?;:]/.test(char)) {
            charDelay *= config.charDelay.punctuationMultiplier;
        } else if (/[A-Z]/.test(char)) {
            charDelay *= config.charDelay.capitalMultiplier;
        } else if (/[0-9]/.test(char)) {
            charDelay *= config.charDelay.numberMultiplier;
        } else if (/[^a-zA-Z0-9\s]/.test(char)) {
            charDelay *= config.charDelay.specialCharMultiplier;
        }

        // Word boundary detection
        if (/\s/.test(char)) {
            if (inWord) {
                // End of word - add word delay
                let wordDelay = config.wordDelay.base;
                if (wordLength >= config.wordDelay.longWordThreshold) {
                    wordDelay *= config.wordDelay.longWordMultiplier;
                }
                totalTime += wordDelay + (Math.random() - 0.5) * config.wordDelay.variance;
                wordLength = 0;
                inWord = false;
            }
        } else {
            inWord = true;
            wordLength++;
        }

        // Add character delay with variance
        charDelay += (Math.random() - 0.5) * config.charDelay.variance;
        totalTime += Math.max(20, charDelay);

        // Random mid-typing pause
        if (
            config.midTypingPauses.enabled &&
            Math.random() < config.midTypingPauses.chancePerWord / avgCharsPerWord
        ) {
            totalTime +=
                config.midTypingPauses.duration.min +
                Math.random() *
                    (config.midTypingPauses.duration.max - config.midTypingPauses.duration.min);
        }
    }

    // Add thinking pause before typing
    const thinkingPause = selectThinkingPause(message.length);
    totalTime += thinkingPause;

    // Apply typo simulation
    const typoRate = deviceProfile.typoRate * (1 + behaviorState.cognitive.fatigueLevel);
    const estimatedTypos = Math.floor(message.length * typoRate);
    if (estimatedTypos > 0) {
        const typoTime =
            estimatedTypos *
            (config.typos.correctionDelay.min +
                Math.random() *
                    (config.typos.correctionDelay.max - config.typos.correctionDelay.min) +
                3 *
                    (config.typos.backspaceDelay.min +
                        Math.random() *
                            (config.typos.backspaceDelay.max - config.typos.backspaceDelay.min)));
        totalTime += typoTime;
    }

    // Apply multipliers
    totalTime *= getCircadianMultiplier();
    totalTime *= getCognitiveMultiplier();
    totalTime *= getRateLimitMultiplier();
    totalTime *= behaviorState.timingVariance;
    totalTime *= personalityProfile.responseTimeMultiplier;

    // Apply advanced anti-detection system
    totalTime = applyAntiDetection(totalTime, "typing");

    // Final NaN guard
    if (typeof totalTime !== "number" || isNaN(totalTime)) {
        totalTime = 1000; // Default 1 second
    }

    // Cap at reasonable maximum (2 minutes for very long messages)
    return Math.min(Math.max(totalTime, 500), 120000);
}

/**
 * Selects appropriate thinking pause based on message length
 */
function selectThinkingPause(messageLength) {
    const config = BEHAVIOR_CONFIG.typing.thinkingPause;

    let pauseRange;
    if (messageLength < 20) {
        pauseRange = config.short;
    } else if (messageLength < 100) {
        pauseRange = config.medium;
    } else {
        pauseRange = config.long;
    }

    return logNormalRandom((pauseRange.min + pauseRange.max) / 2, 0.4);
}

// ═══════════════════════════════════════════════════════════════════════════════
// READING SIMULATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculates realistic reading time for a message
 */
function calculateReadDelay(messageContent = "", attachments = []) {
    const config = BEHAVIOR_CONFIG.reading;
    const personalityProfile = PERSONALITY_PROFILES[behaviorState.personality || "casual"];

    let totalTime = 0;

    // Text reading time
    if (messageContent && messageContent.length > 0) {
        const wordCount = messageContent.split(/\s+/).length;
        const wpm = config.baseWPM.min + Math.random() * (config.baseWPM.max - config.baseWPM.min);
        const baseReadTime = (wordCount / wpm) * 60000;

        // Apply comprehension multiplier based on text complexity
        let complexityMultiplier = 1.0;
        const avgWordLength = messageContent.length / Math.max(wordCount, 1);
        if (avgWordLength > 7) {
            complexityMultiplier = config.comprehension.complexTextMultiplier;
        } else if (avgWordLength < 4) {
            complexityMultiplier = config.comprehension.simpleTextMultiplier;
        }

        totalTime += baseReadTime * complexityMultiplier;

        // Re-reading chance
        if (Math.random() < config.reReadChance) {
            totalTime += baseReadTime * config.reReadMultiplier;
        }
    }

    // Attachment viewing time
    if (attachments && attachments.length > 0) {
        for (const attachment of attachments) {
            const type = attachment.type || "file";
            const delay = config.attachmentDelay[type] || config.attachmentDelay.file;

            if (typeof delay === "object") {
                totalTime += delay.min + Math.random() * (delay.max - delay.min);
            }
        }
    }

    // Add scanning delay
    totalTime +=
        config.scanningDelay.min +
        Math.random() * (config.scanningDelay.max - config.scanningDelay.min);

    // Ensure minimum read time
    totalTime = Math.max(totalTime, config.minimumReadTime);

    // Apply multipliers
    totalTime *= getCircadianMultiplier();
    totalTime *= getCognitiveMultiplier();
    totalTime *= personalityProfile.readReceiptDelay;
    totalTime *= behaviorState.timingVariance;

    // Apply advanced anti-detection system
    totalTime = applyAntiDetection(totalTime, "reading");

    // Final NaN guard
    if (typeof totalTime !== "number" || isNaN(totalTime)) {
        totalTime = 500;
    }

    return Math.min(totalTime, 60000); // Cap at 1 minute
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION DELAY ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculates delay for generic API actions
 */
function calculateActionDelay(actionType = "generic") {
    // Base delay using log-normal distribution
    let delay = logNormalRandom(500, 0.5);

    // Action-specific adjustments
    const actionMultipliers = {
        send: 1.0,
        read: 0.8,
        react: 1.2,
        typing: 0.5,
        generic: 1.0,
    };
    delay *= actionMultipliers[actionType] || 1.0;

    // Apply all multipliers
    delay *= getCircadianMultiplier();
    delay *= getCognitiveMultiplier();
    delay *= getRateLimitMultiplier();
    delay *= behaviorState.timingVariance;

    // Check for burst cooldown
    const status = getRateLimitStatus();
    if (status.burstDetected) {
        const cooldown = BEHAVIOR_CONFIG.rateLimit.burst.cooldown;
        delay += cooldown.min + Math.random() * (cooldown.max - cooldown.min);
    }

    // Apply advanced anti-detection system
    delay = applyAntiDetection(delay, actionType);

    // Final NaN guard - ensure we never return NaN
    if (!isFinite(delay) || isNaN(delay)) {
        delay = 500 + Math.random() * 500; // Safe fallback
    }

    return clamp(delay, 100, 30000);
}

/**
 * Calculates network latency simulation
 */
function calculateNetworkLatency() {
    const config = BEHAVIOR_CONFIG.network.latency;

    let latency = config.base.min + Math.random() * (config.base.max - config.base.min);
    latency += (Math.random() - 0.5) * config.variance;

    // Random latency spike
    if (Math.random() < config.spikeChance) {
        latency +=
            config.spikeDuration.min +
            Math.random() * (config.spikeDuration.max - config.spikeDuration.min);
    }

    return Math.max(latency, 20);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BREAK & SESSION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Checks if a break should occur
 */
function shouldTakeBreak() {
    const sessionDuration = Date.now() - behaviorState.session.startTime;
    const sessionMinutes = sessionDuration / 60000;
    const config = BEHAVIOR_CONFIG.session.breaks;

    // Check for long break
    if (
        sessionMinutes >= config.longBreak.interval.min &&
        Math.random() < config.longBreak.chance
    ) {
        return {
            type: "long",
            duration:
                config.longBreak.duration.min +
                Math.random() * (config.longBreak.duration.max - config.longBreak.duration.min),
        };
    }

    // Check for short break
    if (
        sessionMinutes >= config.shortBreak.interval.min &&
        Math.random() < config.shortBreak.chance
    ) {
        return {
            type: "short",
            duration:
                config.shortBreak.duration.min +
                Math.random() * (config.shortBreak.duration.max - config.shortBreak.duration.min),
        };
    }

    // Check for micro break
    if (Math.random() < config.microBreak.chance) {
        return {
            type: "micro",
            duration:
                config.microBreak.duration.min +
                Math.random() * (config.microBreak.duration.max - config.microBreak.duration.min),
        };
    }

    return null;
}

/**
 * Checks for distraction
 */
function shouldGetDistracted() {
    if (Math.random() < BEHAVIOR_CONFIG.cognitive.attention.distractionChance) {
        const duration = BEHAVIOR_CONFIG.cognitive.attention.distractionDuration;
        return duration.min + Math.random() * (duration.max - duration.min);
    }
    return 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN API FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Promise-based delay with NaN protection
 */
function delay(ms) {
    // Guard against NaN, undefined, or negative values
    const safeMs = typeof ms === "number" && !isNaN(ms) && ms > 0 ? Math.round(ms) : 1;
    return new Promise((resolve) => setTimeout(resolve, safeMs));
}

/**
 * Main function called before sending a message
 * Simulates realistic typing behavior
 */
async function beforeSendMessage(ctx, api, threadID, messageBody) {
    if (!ctx.globalOptions.humanBehavior) return;

    // Update variance if needed
    updateTimingVariance();

    const msgLength = (messageBody || "").length;
    const wordCount = (messageBody || "").split(/\s+/).filter((w) => w).length;
    const isNight = isSleepTime();

    debug.human(`\n🧠 Human Behavior Simulation:`);
    debug.human(`   ├─ Message: ${msgLength} chars, ${wordCount} words`);
    debug.human(`   ├─ Time of Day: ${isNight ? "🌙 Night (slower)" : "☀️ Day (normal)"}`);

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1: Reading/Processing Time (like a human reading before responding)
    // ═══════════════════════════════════════════════════════════════════════
    const readingTime = Math.round(300 + Math.random() * 500);
    debug.human(`   ├─ Phase 1 - Reading: ${readingTime}ms`);
    await delay(readingTime);

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2: Thinking Time (cognitive processing before typing)
    // ═══════════════════════════════════════════════════════════════════════
    let thinkingTime = 0;
    let thinkingType = "";
    if (wordCount <= 3) {
        thinkingTime = Math.round(200 + Math.random() * 400);
        thinkingType = "quick";
    } else if (wordCount <= 10) {
        thinkingTime = Math.round(500 + Math.random() * 800);
        thinkingType = "medium";
    } else {
        thinkingTime = Math.round(800 + Math.random() * 1500);
        thinkingType = "long";
    }
    debug.human(`   ├─ Phase 2 - Thinking (${thinkingType}): ${thinkingTime}ms`);
    await delay(thinkingTime);

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 3: Typing Simulation (realistic typing with indicator)
    // ═══════════════════════════════════════════════════════════════════════
    const baseTypingSpeed = Math.round(45 + Math.random() * 20);
    let typingTime = msgLength * baseTypingSpeed;

    const varianceFactor = 0.8 + Math.random() * 0.4;
    typingTime *= varianceFactor;

    const wordPauses = wordCount * (50 + Math.random() * 100);
    typingTime += wordPauses;

    typingTime = Math.min(typingTime, 8000);
    typingTime = Math.max(typingTime, 500);
    typingTime = Math.round(typingTime);

    const estimatedWPM = Math.round((wordCount / (typingTime / 1000)) * 60) || 0;
    debug.human(`   ├─ Phase 3 - Typing: ${typingTime}ms (~${estimatedWPM} WPM)`);

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 4: Apply Circadian Rhythm (time of day affects speed)
    // ═══════════════════════════════════════════════════════════════════════
    const circadianMult = getCircadianMultiplier();
    const originalTypingTime = typingTime;
    typingTime = Math.round(typingTime * circadianMult);

    let tiredPause = 0;
    if (isNight && Math.random() < 0.3) {
        tiredPause = Math.round(500 + Math.random() * 1500);
        typingTime += tiredPause;
    }

    if (circadianMult !== 1 || tiredPause > 0) {
        debug.human(
            `   ├─ Phase 4 - Circadian: ${circadianMult.toFixed(2)}x multiplier${tiredPause > 0 ? ` + ${tiredPause}ms tired pause` : ""}`
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 5: Send Typing Indicator (shows "typing..." to recipient)
    // ═══════════════════════════════════════════════════════════════════════
    debug.human(`   ├─ Phase 5 - Typing Indicator: ${typingTime}ms`);

    let sendPause = 0;
    if (api.sendTypingIndicator && msgLength > 2 && threadID) {
        try {
            debug.human(`   │  ├─ Starting typing indicator...`);
            await api.sendTypingIndicator(true, threadID, null, true); // skipHumanBehavior = true
            debug.human(`   │  ├─ ✓ Typing indicator ON`);
            await delay(typingTime);
            await api.sendTypingIndicator(false, threadID, null, true); // skipHumanBehavior = true
            debug.human(`   │  └─ ✓ Typing indicator OFF`);

            sendPause = Math.round(100 + Math.random() * 200);
            debug.human(`   ├─ Phase 6 - Send Pause: ${sendPause}ms`);
            await delay(sendPause);
        } catch (e) {
            debug.human(`   │  └─ ❌ Typing indicator error: ${e.message}`);
            await delay(typingTime);
        }
    } else {
        const reason = !threadID ? "no threadID" : msgLength <= 2 ? "msg too short" : "API missing";
        debug.human(`   │  └─ ⚠️ Typing indicator skipped (${reason})`);
        await delay(typingTime);
    }

    const totalTime = readingTime + thinkingTime + typingTime + sendPause;
    debug.human(`   └─ ✓ Total Human Delay: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);

    // Record the action
    recordAction(true);
}

/**
 * Main function called before marking as read
 */
async function beforeMarkAsRead(ctx, messageContent = "", attachments = []) {
    if (!ctx.globalOptions.humanBehavior) return;

    updateTimingVariance();

    // Realistic read delay - humans take time to actually read
    const wordCount = (messageContent || "").split(/\s+/).filter((w) => w).length;
    const hasAttachments = attachments && attachments.length > 0;

    // Base reading time: ~200-300ms per word (average reading speed)
    let readDelay = wordCount * (150 + Math.random() * 100);

    // Attachments take longer to view
    if (hasAttachments) {
        readDelay += attachments.length * (500 + Math.random() * 1000);
    }

    // Minimum delay even for empty messages
    readDelay = Math.max(readDelay, 300 + Math.random() * 400);

    // Cap at reasonable max
    readDelay = Math.min(readDelay, 5000);

    // Apply circadian multiplier
    const circadianMult = getCircadianMultiplier();
    readDelay = Math.round(readDelay * circadianMult);

    debug.human(`\n👁️ Human Behavior - Mark as Read:`);
    debug.human(
        `   ├─ Content: ${wordCount} words${hasAttachments ? `, ${attachments.length} attachment(s)` : ""}`
    );
    debug.human(`   ├─ Reading Time: ${readDelay}ms`);
    debug.human(`   ├─ Circadian: ${circadianMult.toFixed(2)}x`);
    debug.human(`   └─ ✓ Read Simulation Complete`);

    await delay(readDelay);

    recordAction();
}

/**
 * Main function called before any API action (reactions, unsend, etc.)
 */
async function beforeAction(ctx, actionType = "generic") {
    if (!ctx.globalOptions.humanBehavior) return;

    updateTimingVariance();

    // Different actions have different natural delays
    let actionDelay;
    let actionDesc;

    switch (actionType) {
        case "react":
            actionDelay = Math.round(400 + Math.random() * 600);
            actionDesc = "❤️ React (find emoji, tap)";
            break;
        case "unsend":
            actionDelay = Math.round(800 + Math.random() * 1200);
            actionDesc = "🗑️ Unsend (long press, confirm)";
            break;
        case "edit":
            actionDelay = Math.round(600 + Math.random() * 800);
            actionDesc = "✏️ Edit (open editor, position cursor)";
            break;
        default:
            actionDelay = Math.round(300 + Math.random() * 500);
            actionDesc = "⚡ Generic action";
    }

    // Apply circadian multiplier
    const circadianMult = getCircadianMultiplier();
    actionDelay = Math.round(actionDelay * circadianMult);

    debug.human(`\n🎯 Human Behavior - Action:`);
    debug.human(`   ├─ Type: ${actionDesc}`);
    debug.human(`   ├─ Delay: ${actionDelay}ms`);
    debug.human(`   ├─ Circadian: ${circadianMult.toFixed(2)}x`);
    debug.human(`   └─ ✓ Action Ready`);

    await delay(actionDelay);

    recordAction();
}

/**
 * Gets comprehensive behavior statistics
 */
function getStats() {
    cleanupRateLimits();
    updateCognitiveState();

    return {
        // Session info
        session: {
            duration: Date.now() - behaviorState.session.startTime,
            actionCount: behaviorState.session.actionCount,
            messageCount: behaviorState.session.messageCount,
        },

        // Rate limits
        rateLimit: {
            actionsPerMinute: behaviorState.rateLimit.minuteActions.length,
            actionsPerHour: behaviorState.rateLimit.hourActions.length,
            burstCount: behaviorState.rateLimit.burstActions.length,
            status: getRateLimitStatus(),
        },

        // Cognitive state
        cognitive: {
            focusLevel: behaviorState.cognitive.focusLevel,
            fatigueLevel: behaviorState.cognitive.fatigueLevel,
            emotionalState: behaviorState.cognitive.emotionalState,
        },

        // Multipliers
        multipliers: {
            circadian: getCircadianMultiplier(),
            cognitive: getCognitiveMultiplier(),
            rateLimit: getRateLimitMultiplier(),
            variance: behaviorState.timingVariance,
        },

        // Profile info
        profile: {
            device: behaviorState.device,
            personality: behaviorState.personality,
        },

        // Fingerprint & Anti-Detection
        fingerprint: {
            sessionPhase: fingerprintState.sessionPhase,
            consistencyScore: fingerprintState.consistency.currentScore,
            adjustmentFactor: fingerprintState.consistency.adjustmentFactor,
            patternBreakMode: fingerprintState.patternBreaking.inBreakMode,
            behavioralDNA: {
                responseStyle: fingerprintState.behavioralDNA?.responseStyle,
                generatedAt: fingerprintState.behavioralDNA?.generatedAt,
            },
            entropyPoolSize: fingerprintState.entropy?.pool?.length || 0,
            temporalDrift: fingerprintState.temporal?.clockDrift || 0,
            actionHistorySize: fingerprintState.actionHistory?.length || 0,
        },

        // Flags
        flags: {
            isSleepTime: isSleepTime(),
            patternAnomalyDetected: detectPatternAnomaly().detected,
        },

        // Legacy compatibility
        actionsInLastMinute: behaviorState.rateLimit.minuteActions.length,
        messagesInLastMinute: behaviorState.session.messageCount,
        consecutiveActions: behaviorState.rateLimit.burstActions.length,
        sessionDuration: Date.now() - behaviorState.session.startTime,
        timeMultiplier: getCircadianMultiplier(),
        nearRateLimit: isNearRateLimit(),
    };
}

/**
 * Resets all behavior state
 */
function reset() {
    behaviorState.session = {
        startTime: Date.now(),
        lastActionTime: Date.now(),
        actionCount: 0,
        messageCount: 0,
        isActive: true,
    };
    behaviorState.rateLimit = {
        minuteActions: [],
        hourActions: [],
        burstActions: [],
    };
    behaviorState.cognitive = {
        focusLevel: 1.0,
        fatigueLevel: 0,
        emotionalState: "neutral",
        lastStateChange: Date.now(),
    };
    behaviorState.timingVariance = 1.0;
    behaviorState.lastVarianceUpdate = Date.now();

    // Reset fingerprint state
    initializeFingerprintState();
}

/**
 * Configures behavior settings
 */
function configure(newConfig) {
    if (newConfig.typing) Object.assign(BEHAVIOR_CONFIG.typing, newConfig.typing);
    if (newConfig.reading) Object.assign(BEHAVIOR_CONFIG.reading, newConfig.reading);
    if (newConfig.circadian) Object.assign(BEHAVIOR_CONFIG.circadian, newConfig.circadian);
    if (newConfig.cognitive) Object.assign(BEHAVIOR_CONFIG.cognitive, newConfig.cognitive);
    if (newConfig.network) Object.assign(BEHAVIOR_CONFIG.network, newConfig.network);
    if (newConfig.session) Object.assign(BEHAVIOR_CONFIG.session, newConfig.session);
    if (newConfig.rateLimit) Object.assign(BEHAVIOR_CONFIG.rateLimit, newConfig.rateLimit);
    if (newConfig.fingerprint) Object.assign(BEHAVIOR_CONFIG.fingerprint, newConfig.fingerprint);

    // Allow setting device/personality profile
    if (newConfig.device && DEVICE_PROFILES[newConfig.device]) {
        behaviorState.device = newConfig.device;
    }
    if (newConfig.personality && PERSONALITY_PROFILES[newConfig.personality]) {
        behaviorState.personality = newConfig.personality;
    }
}

// Initialize on module load
initializeBehaviorState();

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    // Main API functions
    beforeSendMessage,
    beforeMarkAsRead,
    beforeAction,
    delay,

    // Calculation functions
    calculateTypingTime,
    calculateReadDelay,
    calculateActionDelay,
    calculateNetworkLatency,

    // State functions
    getCircadianMultiplier,
    getCognitiveMultiplier,
    getRateLimitMultiplier,
    getRateLimitStatus,
    getTimeMultiplier,
    isNearRateLimit,
    isSleepTime,
    shouldTakeBreak,
    shouldGetDistracted,

    // Anti-Detection & Fingerprint functions
    applyAntiDetection,
    getBehavioralDNAModifier,
    getEntropy,
    getTemporalOffset,
    getSessionPhaseModifier,
    detectPatternAnomaly,
    generateSessionFingerprint,
    initializeFingerprintState,

    // Utility functions
    getStats,
    reset,
    configure,
    initializeBehaviorState,

    // Configuration (for advanced users)
    BEHAVIOR_CONFIG,
    DEVICE_PROFILES,
    PERSONALITY_PROFILES,

    // Expose internal state for monitoring
    get behaviorState() {
        return behaviorState;
    },
    get fingerprintState() {
        return fingerprintState;
    },

    // Math utilities (exposed for testing)
    gaussianRandom,
    logNormalRandom,
    exponentialRandom,
    weibullRandom,
};
