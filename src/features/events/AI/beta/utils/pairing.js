/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                        PAIRING UTILITIES MODULE                               ║
 * ║          Handles intelligent gender-based pairing of group members            ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * Uses AI to analyze names and create male-female pairs
 *
 * @module utils/pairing
 * @author 0x3EF8
 * @version 3.0.0
 *
 * Features:
 * - AI-powered gender analysis from names
 * - Intelligent male-female pair matching (opposite gender only)
 * - Love compatibility scoring
 * - Profile picture love card generation
 * - Cultural name pattern recognition
 */

"use strict";

const { gemini } = require("../core/gemini");
const { DEBUG } = require("../core/constants");
const { createCanvas, loadImage } = require("canvas");
const https = require("https");
const { PassThrough } = require("stream");

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL LOGGER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Internal logger
 * @private
 */
const log = {
    info: (msg) => DEBUG && console.log(`[Pairing] ℹ ${msg}`),
    error: (msg) => console.error(`[Pairing] ✗ ${msg}`),
    success: (msg) => console.log(`[Pairing] ✓ ${msg}`),
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** @type {string} Gender icon for male */
const GENDER_MALE = "♂️";

/** @type {string} Gender icon for female */
const GENDER_FEMALE = "♀️";

/** @type {string} Gender icon for unknown */
const GENDER_UNKNOWN = "❓";

// ═══════════════════════════════════════════════════════════════════════════════
// IMAGE UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch image buffer from URL
 * @param {string} url - Image URL
 * @returns {Promise<Buffer>} Image buffer
 * @private
 */
function fetchImageBuffer(url) {
    return new Promise((resolve, reject) => {
        const makeRequest = (targetUrl) => {
            const protocol = targetUrl.startsWith("https") ? https : require("http");
            protocol.get(targetUrl, { timeout: 10000 }, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                    return makeRequest(response.headers.location);
                }
                if (response.statusCode !== 200) {
                    return reject(new Error(`HTTP ${response.statusCode}`));
                }
                const chunks = [];
                response.on("data", (chunk) => chunks.push(chunk));
                response.on("end", () => resolve(Buffer.concat(chunks)));
                response.on("error", reject);
            }).on("error", reject);
        };
        makeRequest(url);
    });
}

/**
 * Get profile picture URL for a user ID
 * @param {string} uid - User ID
 * @returns {string} Profile picture URL
 * @private
 */
function getProfilePicUrl(uid) {
    return `https://graph.facebook.com/${uid}/picture?width=720&height=720&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
}

/**
 * Create a love match card with two profile pictures and a heart
 * @param {string} uid1 - First person's user ID
 * @param {string} uid2 - Second person's user ID
 * @param {string} name1 - First person's name
 * @param {string} name2 - Second person's name
 * @param {string} gender1 - First person's gender icon
 * @param {string} gender2 - Second person's gender icon
 * @param {number} percent - Compatibility percentage
 * @returns {Promise<PassThrough>} Image stream
 */
async function createLoveMatchCard(uid1, uid2, name1, name2, gender1, gender2, percent) {
    try {
        // Fetch profile pictures
        const [pic1Buffer, pic2Buffer] = await Promise.all([
            fetchImageBuffer(getProfilePicUrl(uid1)),
            fetchImageBuffer(getProfilePicUrl(uid2)),
        ]);

        const pic1 = await loadImage(pic1Buffer);
        const pic2 = await loadImage(pic2Buffer);

        // Canvas dimensions
        const cardWidth = 800;
        const cardHeight = 500;
        const picSize = 200;
        const heartSize = 80;

        const canvas = createCanvas(cardWidth, cardHeight);
        const ctx = canvas.getContext("2d");

        // Enable smooth rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // Background gradient
        const gradient = ctx.createLinearGradient(0, 0, cardWidth, cardHeight);
        gradient.addColorStop(0, "#ff6b6b");
        gradient.addColorStop(0.5, "#ff8e8e");
        gradient.addColorStop(1, "#ffb3b3");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, cardWidth, cardHeight);

        // Draw decorative hearts in background
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * cardWidth;
            const y = Math.random() * cardHeight;
            const size = 10 + Math.random() * 30;
            drawHeart(ctx, x, y, size);
        }

        // Profile picture positions
        const pic1X = 120;
        const pic2X = cardWidth - 120 - picSize;
        const picY = 100;

        // Draw circular profile pictures with white border
        // Person 1 (left)
        ctx.save();
        ctx.beginPath();
        ctx.arc(pic1X + picSize / 2, picY + picSize / 2, picSize / 2 + 5, 0, Math.PI * 2);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pic1X + picSize / 2, picY + picSize / 2, picSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(pic1, pic1X, picY, picSize, picSize);
        ctx.restore();

        // Person 2 (right)
        ctx.save();
        ctx.beginPath();
        ctx.arc(pic2X + picSize / 2, picY + picSize / 2, picSize / 2 + 5, 0, Math.PI * 2);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pic2X + picSize / 2, picY + picSize / 2, picSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(pic2, pic2X, picY, picSize, picSize);
        ctx.restore();

        // Draw center heart
        const heartX = cardWidth / 2;
        const heartY = picY + picSize / 2;
        ctx.fillStyle = "#FF1744";
        drawHeart(ctx, heartX, heartY, heartSize);

        // Draw heart outline
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 3;
        drawHeartStroke(ctx, heartX, heartY, heartSize);

        // Draw names with gender icons
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        ctx.font = "bold 22px Arial, sans-serif";
        
        // Truncate long names
        const maxNameLength = 15;
        const displayName1 = name1.length > maxNameLength ? name1.substring(0, maxNameLength) + "..." : name1;
        const displayName2 = name2.length > maxNameLength ? name2.substring(0, maxNameLength) + "..." : name2;
        
        ctx.fillText(`${gender1} ${displayName1}`, pic1X + picSize / 2, picY + picSize + 35);
        ctx.fillText(`${gender2} ${displayName2}`, pic2X + picSize / 2, picY + picSize + 35);

        // Draw compatibility percentage
        ctx.font = "bold 48px Arial, sans-serif";
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(`${percent}%`, cardWidth / 2, picY + picSize + 50);

        // Draw "Love Match" text
        ctx.font = "bold 28px Arial, sans-serif";
        ctx.fillText("💕 Love Match 💕", cardWidth / 2, 50);

        // Draw footer
        ctx.font = "16px Arial, sans-serif";
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.fillText("Powered by Nero AI", cardWidth / 2, cardHeight - 20);

        // Convert to stream
        const buffer = canvas.toBuffer("image/png");
        const stream = new PassThrough();
        stream.path = "love_match.png";
        stream.end(buffer);

        log.success(`Created love match card for ${name1} & ${name2}`);
        return stream;
    } catch (error) {
        log.error(`Failed to create love card: ${error.message}`);
        return null;
    }
}

/**
 * Draw a filled heart shape
 * @private
 */
function drawHeart(ctx, x, y, size) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y + size / 4);
    ctx.bezierCurveTo(x, y, x - size / 2, y, x - size / 2, y + size / 4);
    ctx.bezierCurveTo(x - size / 2, y + size / 2, x, y + size * 0.75, x, y + size);
    ctx.bezierCurveTo(x, y + size * 0.75, x + size / 2, y + size / 2, x + size / 2, y + size / 4);
    ctx.bezierCurveTo(x + size / 2, y, x, y, x, y + size / 4);
    ctx.fill();
    ctx.restore();
}

/**
 * Draw a heart outline
 * @private
 */
function drawHeartStroke(ctx, x, y, size) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y + size / 4);
    ctx.bezierCurveTo(x, y, x - size / 2, y, x - size / 2, y + size / 4);
    ctx.bezierCurveTo(x - size / 2, y + size / 2, x, y + size * 0.75, x, y + size);
    ctx.bezierCurveTo(x, y + size * 0.75, x + size / 2, y + size / 2, x + size / 2, y + size / 4);
    ctx.bezierCurveTo(x + size / 2, y, x, y, x, y + size / 4);
    ctx.stroke();
    ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Shuffle array using Fisher-Yates algorithm
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array (mutated)
 * @private
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Extract JSON from AI response text
 * @param {string} text - Response text
 * @param {RegExp} pattern - JSON pattern to match
 * @returns {Object|null} Parsed JSON or null
 * @private
 */
function extractJSON(text, pattern) {
    const match = text.match(pattern);
    if (!match) return null;

    try {
        return JSON.parse(match[0]);
    } catch {
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENDER ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Analyze names and determine gender using AI
 *
 * @param {Array<{id: string, name: string}>} members - Array of members
 * @returns {Promise<{males: Array, females: Array, unknown: Array}>} Categorized members
 */
async function analyzeGenders(members) {
    if (members.length === 0) {
        return { males: [], females: [], unknown: [] };
    }

    const nameList = members.map((m, i) => `${i + 1}. ${m.name}`).join("\n");

    const prompt = `Analyze these names and classify each as male (M), female (F), or unknown (U).
Consider Filipino, Western, Asian, and other cultural naming conventions.

Names to analyze:
${nameList}

RESPOND ONLY with JSON array:
[{"index": 1, "gender": "M"}, {"index": 2, "gender": "F"}, ...]

Where gender is: "M" for male, "F" for female, "U" for unknown/unisex`;

    try {
        const result = await gemini.generate(prompt);
        const responseText = result?.response?.text?.() || "";

        const genderData = extractJSON(responseText, /\[[\s\S]*?\]/);

        if (!genderData) {
            throw new Error("No valid JSON in response");
        }

        const males = [];
        const females = [];
        const unknown = [];

        for (const item of genderData) {
            const member = members[item.index - 1];
            if (!member) continue;

            switch (item.gender) {
                case "M":
                    males.push(member);
                    break;
                case "F":
                    females.push(member);
                    break;
                default:
                    unknown.push(member);
            }
        }

        return { males, females, unknown };
    } catch (error) {
        log.error(`Gender analysis failed: ${error.message}`);
        return { males: [], females: [], unknown: members };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAIRING GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Find potential matches for a sender from categorized members
 * STRICT: Only returns opposite gender matches
 * @param {string} senderID - Sender's ID
 * @param {Array} males - Male members
 * @param {Array} females - Female members
 * @returns {{matches: Array, senderGender: string}} Potential matches and sender gender
 * @private
 */
function findMatchesForSender(senderID, males, females) {
    const senderIsMale = males.some((m) => m.id === senderID);
    const senderIsFemale = females.some((m) => m.id === senderID);

    let matches = [];
    let senderGender = GENDER_UNKNOWN;

    if (senderIsMale) {
        senderGender = GENDER_MALE;
        // Male sender → only match with females
        matches = females.filter((m) => m.id !== senderID);
        log.info(`Sender is MALE, found ${matches.length} female matches`);
    } else if (senderIsFemale) {
        senderGender = GENDER_FEMALE;
        // Female sender → only match with males
        matches = males.filter((m) => m.id !== senderID);
        log.info(`Sender is FEMALE, found ${matches.length} male matches`);
    } else {
        // Unknown gender → try to match with either males or females
        const allOpposite = [...males, ...females].filter((m) => m.id !== senderID);
        matches = allOpposite;
        log.info(`Sender gender UNKNOWN, found ${matches.length} potential matches`);
    }

    // NO FALLBACK - strictly opposite gender only
    return { matches, senderGender };
}

/**
 * Generate intelligent male-female pairs from group members
 *
 * @param {Map<string, string>} allMembers - Map of userID -> userName
 * @param {string} [senderID=null] - ID of user requesting pairs (for single pairing)
 * @param {boolean} [includeSender=true] - Whether to include sender in random pairing
 * @returns {Promise<{pairs: Array, stats: Object}>} Generated pairs and statistics
 */
async function generateRandomPairs(allMembers, senderID = null, includeSender = true) {
    const membersArray = Array.from(allMembers.entries()).map(([id, name]) => ({ id, name }));

    // Single user pairing mode
    if (senderID && !includeSender) {
        const sender = membersArray.find((m) => m.id === senderID);
        const others = membersArray.filter((m) => m.id !== senderID);

        if (!sender || others.length === 0) {
            return { pairs: [], stats: null, error: "Not enough members" };
        }

        const { males, females, unknown } = await analyzeGenders([sender, ...others]);
        const { matches, senderGender } = findMatchesForSender(senderID, males, females);

        // STRICT: No opposite gender match found
        if (matches.length === 0) {
            log.info(`No opposite gender match found for sender (${senderGender})`);
            return { 
                pairs: [], 
                stats: {
                    males: males.length,
                    females: females.length,
                    unknown: unknown.length,
                    senderGender: senderGender,
                },
                error: "no_opposite_gender"
            };
        }

        const randomIndex = Math.floor(Math.random() * matches.length);
        const match = matches[randomIndex];

        const matchGender = males.some((m) => m.id === match.id)
            ? GENDER_MALE
            : females.some((m) => m.id === match.id)
                ? GENDER_FEMALE
                : GENDER_UNKNOWN;

        // Verify opposite gender match
        const isOppositeGender = 
            (senderGender === GENDER_MALE && matchGender === GENDER_FEMALE) ||
            (senderGender === GENDER_FEMALE && matchGender === GENDER_MALE);

        if (!isOppositeGender && senderGender !== GENDER_UNKNOWN) {
            log.info(`Match rejected: same gender (${senderGender} + ${matchGender})`);
            return { 
                pairs: [], 
                stats: {
                    males: males.length,
                    females: females.length,
                    unknown: unknown.length,
                    senderGender: senderGender,
                },
                error: "no_opposite_gender"
            };
        }

        log.success(`Matched ${senderGender} with ${matchGender}`);

        return {
            pairs: [
                {
                    person1: { ...sender, gender: senderGender },
                    person2: { ...match, gender: matchGender },
                },
            ],
            stats: {
                males: males.length,
                females: females.length,
                unknown: unknown.length,
                intelligentMatch: senderGender !== GENDER_UNKNOWN,
            },
        };
    }

    // Random pairing of all members
    const { males, females, unknown } = await analyzeGenders(membersArray);

    const pairs = [];
    const usedIds = new Set();

    // Shuffle for randomness
    const shuffledMales = shuffleArray([...males]);
    const shuffledFemales = shuffleArray([...females]);
    const shuffledUnknown = shuffleArray([...unknown]);

    // Create male-female pairs first
    const minPairs = Math.min(shuffledMales.length, shuffledFemales.length);

    for (let i = 0; i < minPairs; i++) {
        pairs.push({
            person1: { ...shuffledMales[i], gender: GENDER_MALE },
            person2: { ...shuffledFemales[i], gender: GENDER_FEMALE },
        });
        usedIds.add(shuffledMales[i].id);
        usedIds.add(shuffledFemales[i].id);
    }

    // Collect remaining unpaired members
    const remaining = shuffleArray([
        ...shuffledMales.filter((m) => !usedIds.has(m.id)).map((m) => ({ ...m, gender: GENDER_MALE })),
        ...shuffledFemales.filter((m) => !usedIds.has(m.id)).map((m) => ({ ...m, gender: GENDER_FEMALE })),
        ...shuffledUnknown.map((m) => ({ ...m, gender: GENDER_UNKNOWN })),
    ]);

    // Pair remaining members
    for (let i = 0; i < remaining.length - 1; i += 2) {
        pairs.push({
            person1: remaining[i],
            person2: remaining[i + 1],
        });
    }

    // Handle odd member (solo)
    if (remaining.length % 2 !== 0) {
        pairs.push({
            person1: remaining[remaining.length - 1],
            person2: null,
        });
    }

    return {
        pairs,
        stats: {
            males: males.length,
            females: females.length,
            unknown: unknown.length,
            maleFemaleMatches: minPairs,
        },
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOVE COMPATIBILITY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Use Gemini AI to analyze love compatibility between two people
 *
 * @param {string} name1 - First person's name
 * @param {string} gender1 - First person's gender (♂️/♀️/❓)
 * @param {string} name2 - Second person's name
 * @param {string} gender2 - Second person's gender (♂️/♀️/❓)
 * @returns {Promise<{percent: number, message: string}>} Compatibility analysis
 */
async function analyzeLoveCompatibility(name1, gender1, name2, gender2) {
    const genderLabel = (g) =>
        g === GENDER_MALE ? "Male" : g === GENDER_FEMALE ? "Female" : "Unknown gender";

    const prompt = `You are a fun love compatibility analyzer. Analyze compatibility between:

Person 1: ${name1} (${genderLabel(gender1)})
Person 2: ${name2} (${genderLabel(gender2)})

Consider name compatibility, letter matching, cultural patterns, and romantic chemistry.

RESPOND ONLY with JSON:
{"percent": 85, "message": "Your fun romantic message ending with 'sana all 😍'"}

Rules:
- percent: 1-100
- message: 1 short sentence with emojis, MUST end with "sana all 😍"`;

    try {
        const result = await gemini.generate(prompt);
        const responseText = result?.response?.text?.() || "";

        const data = extractJSON(responseText, /\{[\s\S]*?\}/);

        if (!data) {
            throw new Error("No valid JSON in response");
        }

        return {
            percent: Math.min(100, Math.max(50, data.percent || 75)),
            message: data.message || "Love is in the air! 💕 sana all 😍",
        };
    } catch (error) {
        log.error(`Love compatibility analysis failed: ${error.message}`);

        // Fallback with random high percentage
        const fallbackPercent = Math.floor(Math.random() * 31) + 70;
        return {
            percent: fallbackPercent,
            message: "The stars align for you two! ✨ sana all 😍",
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE FORMATTING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format pairs for display message with gender icons and compatibility scores
 *
 * @param {Array} pairs - Array of pairs
 * @param {Object} [stats=null] - Gender statistics
 * @returns {Promise<string>} Formatted message
 */
async function formatPairsMessage(pairs, stats = null) {
    if (pairs.length === 0) {
        return "No pairs could be generated.";
    }

    const lines = [];

    for (let index = 0; index < pairs.length; index++) {
        const pair = pairs[index];

        if (pair.person2) {
            const p1 = `${pair.person1.gender || ""} ${pair.person1.name}`.trim();
            const p2 = `${pair.person2.gender || ""} ${pair.person2.name}`.trim();

            // Get AI-powered love analysis
            const { percent, message } = await analyzeLoveCompatibility(
                pair.person1.name,
                pair.person1.gender,
                pair.person2.name,
                pair.person2.gender
            );

            lines.push(`${index + 1}. ${p1}\n    💕\n    ${p2}\n    💯 ${percent}% - ${message}`);
        } else {
            const p1 = `${pair.person1.gender || ""} ${pair.person1.name}`.trim();
            lines.push(`${index + 1}. 🙋 ${p1} (Solo - waiting for the one! 💭)`);
        }
    }

    // Build header
    let header = "💘 AI Love Matching\n";
    header += "🤖 Powered by Gemini AI\n";

    if (stats) {
        header += `\n📊 ${stats.males}${GENDER_MALE} males • ${stats.females}${GENDER_FEMALE} females`;

        if (stats.unknown > 0) {
            header += ` • ${stats.unknown}${GENDER_UNKNOWN} unknown`;
        }

        if (stats.maleFemaleMatches !== undefined && stats.maleFemaleMatches > 0) {
            header += `\n💑 Perfect M×F matches: ${stats.maleFemaleMatches}`;
        }

        header += "\n";
    }

    return `${header}\n${lines.join("\n\n")}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    analyzeGenders,
    generateRandomPairs,
    analyzeLoveCompatibility,
    formatPairsMessage,
    createLoveMatchCard,
    GENDER_MALE,
    GENDER_FEMALE,
};
