/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                        COMMAND HANDLER MODULE                                 ║
 * ║            Handles special commands from AI responses                         ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module handlers/commands
 * @author 0x3EF8
 * @version 1.1.0
 */

"use strict";

const chalk = require("chalk");
const config = require("../../../../../config/config");

const { downloadMusic } = require("../services/music");
const { downloadVideo } = require("../services/video");
const { getWeather } = require("../services/weather");
const { createPoll } = require("../services/poll");
const { users } = require("../core/users");
const {
    generateRandomPairs,
    formatPairsMessage,
    analyzeLoveCompatibility,
    analyzeGenders,
} = require("../utils/pairing");
const { changeNickname } = require("../utils/nickname");
const { REACTIONS, MESSAGES } = require("../core/constants");

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════

const PATTERNS = {
    // Nickname commands
    NICKNAME_BULK: /NICKNAME_BULK:\s*(.+)/i,
    NICKNAME_CLEAR_ALL: /NICKNAME_CLEAR_ALL/i,
    NICKNAME_CLEAR: /NICKNAME_CLEAR:\s*(\d+)/i,
    NICKNAME_CHANGE: /NICKNAME_CHANGE:\s*(\d+)\s*\|\s*(.+)/i,
    
    // Media commands
    MUSIC_SUGGESTION: /MUSIC_SUGGESTION:\s*(.+?)\s*\|\s*(.+)/i,
    MUSIC_DOWNLOAD: /MUSIC_DOWNLOAD:\s*(.+)/i,
    VIDEO_DOWNLOAD: /VIDEO_DOWNLOAD:\s*(.+)/i,
    
    // Utility commands
    WEATHER_CHECK: /WEATHER_CHECK:\s*(.+)/i,
    DATETIME_CHECK: /DATETIME_CHECK/i,
    
    // Poll commands
    POLL_CREATE: /POLL_CREATE:\s*(.+)/i,
    
    // Pairing commands
    PAIR_ME: /PAIR_ME/i,
    PAIR_WITH: /PAIR_WITH/i,
    PAIR_RANDOM: /PAIR_RANDOM/i,
    
    // Detection helpers
    WANTS_LYRICS: /\b(lyrics?|letra|lirika)\b/i,
    MY_NAME: /my name|my nickname/i,
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Set reaction on message
 */
function react(api, messageID, emoji) {
    api.setMessageReaction(emoji, messageID, () => {}, true);
}

/**
 * Send reply message
 */
async function sendReply(api, threadID, messageID, text) {
    return api.sendMessage(text, threadID, messageID);
}

/**
 * Delay helper
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Log command action
 */
function logCommand(icon, action) {
    console.log(chalk.cyan(` ├─${icon} ${action}`));
}

/**
 * Validate user ID
 */
function isValidUserID(id) {
    return id && id.length > 5 && /^\d+$/.test(id);
}

/**
 * Format love match message
 */
function formatLoveMatch(p1, p2, percent, message) {
    return `💘 AI Love Match\n${p1.gender || ""} ${p1.name}\n     💕\n${p2.gender || ""} ${p2.name}\n\n💯 Love compatibility: ${percent}%\n💬 ${message}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NICKNAME HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle bulk nickname changes
 */
async function handleBulkNickname(api, threadID, messageID, bulkData, allMembers) {
    const changes = bulkData
        .split("||")
        .map(pair => {
            const [id, name] = pair.split("|");
            return { id: id?.trim(), name: name?.trim() };
        })
        .filter(change => {
            const isValid = isValidUserID(change.id);
            if (!isValid) {
                console.log(chalk.red(` ├─✗ Invalid ID: ${change.id}`));
            }
            return isValid;
        });

    if (changes.length === 0) {
        await sendReply(api, threadID, messageID, MESSAGES.errors.invalidUserID);
        react(api, messageID, REACTIONS.error);
        return true;
    }

    logCommand("🎭", `Bulk nickname: ${changes.length} members`);
    react(api, messageID, REACTIONS.processing);

    let success = 0, failed = 0;

    for (const change of changes) {
        const name = allMembers.get(change.id) || "Unknown";
        console.log(chalk.yellow(` ├─  ${name} → "${change.name}"`));
        
        const result = await changeNickname(api, threadID, change.id, change.name);
        result ? success++ : failed++;
        await delay(500);
    }

    console.log(chalk.green(` ├─✓ Bulk: ${success} success, ${failed} failed`));
    await sendReply(api, threadID, messageID, 
        `✨ Changed ${success} nickname${success !== 1 ? "s" : ""} successfully! 🎭\n\n💡 Tip: Try "beta change my name to [nickname]"`
    );
    react(api, messageID, REACTIONS.success);
    return true;
}

/**
 * Handle clear all nicknames
 */
async function handleClearAllNicknames(api, threadID, messageID, allMembers) {
    logCommand("🧹", "Clearing all nicknames");
    react(api, messageID, REACTIONS.processing);

    let success = 0, failed = 0;

    for (const [userID, memberName] of allMembers.entries()) {
        console.log(chalk.yellow(` ├─  Clearing: ${memberName}`));
        const result = await changeNickname(api, threadID, userID, "");
        result ? success++ : failed++;
        await delay(500);
    }

    console.log(chalk.green(` ├─✓ Cleared: ${success} success, ${failed} failed`));
    await sendReply(api, threadID, messageID,
        `✨ Cleared ${success} nickname${success !== 1 ? "s" : ""}! 🧹`
    );
    react(api, messageID, REACTIONS.success);
    return true;
}

/**
 * Handle clear single nickname
 */
async function handleClearNickname(api, threadID, messageID, targetID, text, senderID, allMembers) {
    // Override with sender's ID if "my name" mentioned
    if (PATTERNS.MY_NAME.test(text)) {
        targetID = senderID;
    }

    const targetName = allMembers.get(targetID) || "User";
    logCommand("🧹", `Clearing nickname: ${targetName}`);

    const success = await changeNickname(api, threadID, targetID, "");
    react(api, messageID, success ? REACTIONS.success : REACTIONS.error);
    await sendReply(api, threadID, messageID,
        success ? `✅ Nickname cleared for ${targetName}!` : "❌ Failed to clear nickname."
    );
    return true;
}

/**
 * Handle single nickname change
 */
async function handleNicknameChange(api, threadID, messageID, targetID, newNickname) {
    logCommand("📝", `Nickname: ${targetID} → "${newNickname}"`);

    const success = await changeNickname(api, threadID, targetID, newNickname);
    react(api, messageID, success ? REACTIONS.success : REACTIONS.error);
    await sendReply(api, threadID, messageID,
        success 
            ? `✅ Nickname changed to "${newNickname}"!`
            : "❌ Failed to change nickname. I might not have permission."
    );
    return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEDIA HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle music suggestion
 */
async function handleMusicSuggestion(api, threadID, messageID, query, explanation, text) {
    logCommand("🎵", `Music suggestion: "${query}"`);
    
    await sendReply(api, threadID, messageID, explanation);
    const wantsLyrics = PATTERNS.WANTS_LYRICS.test(text);
    await downloadMusic(api, threadID, messageID, query, null, wantsLyrics);
    return true;
}

/**
 * Handle music download
 */
async function handleMusicDownload(api, threadID, messageID, query, text) {
    logCommand("🎵", `Music download: "${query}"`);
    
    const wantsLyrics = PATTERNS.WANTS_LYRICS.test(text);
    await downloadMusic(api, threadID, messageID, query, null, wantsLyrics);
    return true;
}

/**
 * Handle video download
 */
async function handleVideoDownload(api, threadID, messageID, query) {
    logCommand("🎬", `Video download: "${query}"`);
    
    await downloadVideo(api, threadID, messageID, query, null);
    return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle weather check
 */
async function handleWeatherCheck(api, threadID, messageID, location) {
    logCommand("🌤️", `Weather: "${location}"`);
    
    await getWeather(api, threadID, messageID, location);
    return true;
}

/**
 * Handle datetime check
 */
async function handleDateTimeCheck(api, threadID, messageID) {
    const now = new Date();
    const manilaTime = now.toLocaleString("en-US", {
        timeZone: config.bot.timeZone,
        dateStyle: "full",
        timeStyle: "long",
    });

    await sendReply(api, threadID, messageID,
        `📅 Current Date & Time\n\n🕐 ${manilaTime}\n📍 Timezone: ${config.bot.timeZone}`
    );
    react(api, messageID, REACTIONS.success);
    return true;
}

/**
 * Handle poll creation
 */
async function handlePollCreate(api, threadID, messageID, argsString) {
    // Parse: Question | Option1 | Option2...
    const parts = argsString.split("|").map(s => s.trim()).filter(Boolean);
    
    if (parts.length < 3) {
        react(api, messageID, REACTIONS.error);
        return api.sendMessage("❌ Poll needs a question and at least 2 options.", threadID, messageID);
    }

    const question = parts[0];
    const options = parts.slice(1);

    return createPoll(api, threadID, messageID, question, options);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAIRING HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle pair me command
 */
async function handlePairMe(api, threadID, messageID, senderID, userName, allMembers) {
    logCommand("💕", `Pairing ${userName}...`);
    react(api, messageID, "🔍");

    if (allMembers.size < 2) {
        await sendReply(api, threadID, messageID, "❌ Not enough members for pairing.");
        return true;
    }

    const { pairs } = await generateRandomPairs(allMembers, senderID, false);

    if (pairs.length > 0 && pairs[0].person2) {
        const p1 = pairs[0].person1;
        const p2 = pairs[0].person2;

        const { percent, message } = await analyzeLoveCompatibility(
            p1.name, p1.gender, p2.name, p2.gender
        );

        react(api, messageID, "💕");
        await sendReply(api, threadID, messageID, formatLoveMatch(p1, p2, percent, message));
    } else {
        react(api, messageID, REACTIONS.error);
        await sendReply(api, threadID, messageID, "❌ Couldn't find a match. Try again!");
    }
    return true;
}

/**
 * Handle pair with mentioned users
 */
async function handlePairWith(api, threadID, messageID, _event, senderID, allMembers) {
    const mentions = _event.mentions || {};
    const mentionedIDs = Object.keys(mentions);

    logCommand("💕", `Pairing with ${mentionedIDs.length} mention(s)...`);
    react(api, messageID, "🔍");

    if (mentionedIDs.length === 0) {
        react(api, messageID, REACTIONS.error);
        await sendReply(api, threadID, messageID,
            "❌ Please mention someone to pair with! Example: beta pair @person"
        );
        return true;
    }

    let person1, person2;

    if (mentionedIDs.length >= 2) {
        // Two mentions: pair them together
        const id1 = mentionedIDs[0];
        const id2 = mentionedIDs[1];
        person1 = { id: id1, name: allMembers.get(id1) || mentions[id1]?.replace(/@/g, "") || "User 1" };
        person2 = { id: id2, name: allMembers.get(id2) || mentions[id2]?.replace(/@/g, "") || "User 2" };
    } else {
        // One mention: pair with random member
        const targetID = mentionedIDs[0];
        const targetName = allMembers.get(targetID) || mentions[targetID]?.replace(/@/g, "") || "User";

        const pool = Array.from(allMembers.entries())
            .filter(([id]) => id !== targetID && id !== senderID)
            .map(([id, name]) => ({ id, name }));

        if (pool.length === 0) {
            react(api, messageID, REACTIONS.error);
            await sendReply(api, threadID, messageID, "❌ No other members to pair with!");
            return true;
        }

        const randomMember = pool[Math.floor(Math.random() * pool.length)];
        person1 = { id: targetID, name: targetName };
        person2 = { id: randomMember.id, name: randomMember.name };
    }

    // Get AI-powered gender analysis
    const { males, females } = await analyzeGenders([person1, person2]);

    const gender1 = males.some(m => m.id === person1.id) ? "♂️" 
        : females.some(m => m.id === person1.id) ? "♀️" : "❓";
    const gender2 = males.some(m => m.id === person2.id) ? "♂️"
        : females.some(m => m.id === person2.id) ? "♀️" : "❓";

    const { percent, message } = await analyzeLoveCompatibility(
        person1.name, gender1, person2.name, gender2
    );

    react(api, messageID, "💕");
    await sendReply(api, threadID, messageID, formatLoveMatch(
        { ...person1, gender: gender1 },
        { ...person2, gender: gender2 },
        percent, message
    ));
    return true;
}

/**
 * Handle random pairs command
 */
async function handlePairRandom(api, threadID, messageID, allMembers) {
    logCommand("💕", "Creating random pairs...");
    react(api, messageID, "🔍");

    if (allMembers.size < 2) {
        await sendReply(api, threadID, messageID, "❌ Not enough members for pairing.");
        return true;
    }

    const { pairs, stats } = await generateRandomPairs(allMembers, null, true);

    react(api, messageID, "💕");
    const formattedMessage = await formatPairsMessage(pairs, stats);
    await sendReply(api, threadID, messageID, formattedMessage);
    return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle special commands in AI response
 * @param {Object} params - Handler parameters
 * @returns {Promise<boolean>} True if command was handled
 */
async function handleCommands({
    api,
    _event,
    response,
    text,
    threadID,
    senderID,
    userName,
    messageID,
}) {
    const responseText = response.trim();
    const allMembers = await users.getAllGroupMembers(api, threadID);

    // ─────────────────────────────────────────────────────────────────
    // NICKNAME COMMANDS (Priority - check first)
    // ─────────────────────────────────────────────────────────────────

    const bulkMatch = responseText.match(PATTERNS.NICKNAME_BULK);
    if (bulkMatch) {
        return handleBulkNickname(api, threadID, messageID, bulkMatch[1], allMembers);
    }

    if (PATTERNS.NICKNAME_CLEAR_ALL.test(responseText)) {
        return handleClearAllNicknames(api, threadID, messageID, allMembers);
    }

    const clearMatch = responseText.match(PATTERNS.NICKNAME_CLEAR);
    if (clearMatch) {
        return handleClearNickname(api, threadID, messageID, clearMatch[1].trim(), text, senderID, allMembers);
    }

    const nicknameMatch = responseText.match(PATTERNS.NICKNAME_CHANGE);
    if (nicknameMatch) {
        return handleNicknameChange(api, threadID, messageID, nicknameMatch[1].trim(), nicknameMatch[2].trim());
    }

    // ─────────────────────────────────────────────────────────────────
    // MEDIA COMMANDS
    // ─────────────────────────────────────────────────────────────────

    const musicSuggestionMatch = responseText.match(PATTERNS.MUSIC_SUGGESTION);
    if (musicSuggestionMatch) {
        return handleMusicSuggestion(api, threadID, messageID, musicSuggestionMatch[1].trim(), musicSuggestionMatch[2].trim(), text);
    }

    const musicMatch = responseText.match(PATTERNS.MUSIC_DOWNLOAD);
    if (musicMatch) {
        return handleMusicDownload(api, threadID, messageID, musicMatch[1].trim(), text);
    }

    const videoMatch = responseText.match(PATTERNS.VIDEO_DOWNLOAD);
    if (videoMatch) {
        return handleVideoDownload(api, threadID, messageID, videoMatch[1].trim());
    }

    // ─────────────────────────────────────────────────────────────────
    // UTILITY COMMANDS
    // ─────────────────────────────────────────────────────────────────

    const weatherMatch = responseText.match(PATTERNS.WEATHER_CHECK);
    if (weatherMatch) {
        return handleWeatherCheck(api, threadID, messageID, weatherMatch[1].trim());
    }

    if (PATTERNS.DATETIME_CHECK.test(responseText)) {
        return handleDateTimeCheck(api, threadID, messageID);
    }

    const pollMatch = responseText.match(PATTERNS.POLL_CREATE);
    if (pollMatch) {
        return handlePollCreate(api, threadID, messageID, pollMatch[1]);
    }

    // ─────────────────────────────────────────────────────────────────
    // PAIRING COMMANDS
    // ─────────────────────────────────────────────────────────────────

    if (PATTERNS.PAIR_ME.test(responseText)) {
        return handlePairMe(api, threadID, messageID, senderID, userName, allMembers);
    }

    if (PATTERNS.PAIR_WITH.test(responseText)) {
        return handlePairWith(api, threadID, messageID, _event, senderID, allMembers);
    }

    if (PATTERNS.PAIR_RANDOM.test(responseText)) {
        return handlePairRandom(api, threadID, messageID, allMembers);
    }

    return false;
}

module.exports = {
    handleCommands,
};
