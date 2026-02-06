/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                          COMMAND HANDLER MODULE                               ║
 * ║              Processes Special Commands from AI Responses                     ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * Handles execution of AI-generated command strings for:
 * - Nickname management (single, bulk, clear)
 * - Media downloads (music, video)
 * - Utilities (weather, datetime, polls)
 * - Social features (pairing)
 *
 * @module handlers/commands
 * @author 0x3EF8
 * @version 2.0.0
 */

"use strict";

const config = require("../../../../../config/config");

// Services
const { downloadMusic } = require("../services/music");
const { downloadVideo } = require("../services/video");
const { getWeather } = require("../services/weather");
const { getUserProfile } = require("../services/stalk");
const reminder = require("../services/reminder");
const tts = require("../services/tts");

// Core modules
const { users } = require("../core/users");
const { memory } = require("../core/memory");
const {
    COMMAND_PATTERNS,
    REACTIONS,
    MESSAGES,
} = require("../core/constants");

// Utilities
const {
    generateRandomPairs,
    formatPairsMessage,
    analyzeLoveCompatibility,
    analyzeGenders,
    createLoveMatchCard,
    GENDER_MALE,
    GENDER_FEMALE,
} = require("../utils/pairing");
const { changeNickname } = require("../utils/nickname");

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Set reaction on message
 * @param {Object} api - Facebook API
 * @param {string} messageID - Message ID
 * @param {string} emoji - Reaction emoji
 */
function react(api, messageID, emoji) {
    api.setMessageReaction(emoji, messageID, () => {}, true);
}

/**
 * Send reply message
 * @param {Object} api - Facebook API
 * @param {string} threadID - Thread ID
 * @param {string} messageID - Message to reply to
 * @param {string} text - Message text
 * @returns {Promise<Object>} Send result
 */
async function sendReply(api, threadID, messageID, text) {
    return api.sendMessage(text, threadID, null, messageID);
}

/**
 * Delay execution
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function delay(ms) {
    return new Promise((resolve) => { setTimeout(resolve, ms); });
}

/**
 * Validate Facebook user ID format
 * @param {string} id - User ID to validate
 * @returns {boolean} True if valid
 */
function isValidUserID(id) {
    return Boolean(id && id.length > 5 && /^\d+$/.test(id));
}

/**
 * Clean extracted value from AI response (removes backticks, quotes, extra whitespace)
 * @param {string} value - Raw value from regex match
 * @returns {string} Cleaned value
 */
function cleanValue(value) {
    if (!value) return "";
    return value
        .replace(/[`'"]/g, "")  // Remove backticks and quotes
        .replace(/\s+/g, " ")    // Normalize whitespace
        .trim();
}

// ═══════════════════════════════════════════════════════════════════════════════
// NICKNAME HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle bulk nickname changes
 * @param {Object} api - Facebook API
 * @param {string} threadID - Thread ID
 * @param {string} messageID - Message ID
 * @param {string} bulkData - Bulk change data string
 * @param {Map} allMembers - Group members map
 * @returns {Promise<boolean>} True if handled
 */
async function handleBulkNickname(api, threadID, messageID, bulkData, _allMembers) {
    const changes = bulkData
        .split("||")
        .map((pair) => {
            const [id, name] = pair.split("|");
            return { id: id?.trim(), name: name?.trim() };
        })
        .filter((change) => isValidUserID(change.id));

    if (changes.length === 0) {
        await sendReply(api, threadID, messageID, MESSAGES.errors.invalidUserID);
        react(api, messageID, REACTIONS.error);
        return true;
    }

    react(api, messageID, REACTIONS.processing);

    let success = 0;
    let failed = 0;

    for (const change of changes) {
        const result = await changeNickname(api, threadID, change.id, change.name);
        result ? success++ : failed++;
        await delay(500);
    }

    const resultMessage = `✨ Changed ${success} nickname${success !== 1 ? "s" : ""} successfully!${failed > 0 ? ` (${failed} failed)` : ""}\n\n💡 Tip: Try "nero change my name to [nickname]"`;

    await sendReply(api, threadID, messageID, resultMessage);
    react(api, messageID, REACTIONS.success);
    return true;
}

/**
 * Handle clearing all nicknames
 * @param {Object} api - Facebook API
 * @param {string} threadID - Thread ID
 * @param {string} messageID - Message ID
 * @param {Map} allMembers - Group members map
 * @returns {Promise<boolean>} True if handled
 */
async function handleClearAllNicknames(api, threadID, messageID, allMembers) {
    react(api, messageID, REACTIONS.processing);

    let success = 0;
    let failed = 0;

    for (const [userID] of allMembers.entries()) {
        const result = await changeNickname(api, threadID, userID, "");
        result ? success++ : failed++;
        await delay(500);
    }

    await sendReply(
        api,
        threadID,
        messageID,
        `✨ Cleared ${success} nickname${success !== 1 ? "s" : ""}! 🧹`
    );
    react(api, messageID, REACTIONS.success);
    return true;
}

/**
 * Handle clearing single nickname
 * @param {Object} api - Facebook API
 * @param {string} threadID - Thread ID
 * @param {string} messageID - Message ID
 * @param {string} targetID - Target user ID
 * @param {string} text - Original message text
 * @param {string} senderID - Sender's ID
 * @param {Map} allMembers - Group members map
 * @returns {Promise<boolean>} True if handled
 */
async function handleClearNickname(api, threadID, messageID, targetID, text, senderID, allMembers) {
    // Override with sender's ID if "my name" mentioned
    if (COMMAND_PATTERNS.MY_NAME.test(text)) {
        targetID = senderID;
    }

    const targetName = allMembers.get(targetID) || "User";
    const success = await changeNickname(api, threadID, targetID, "");

    react(api, messageID, success ? REACTIONS.success : REACTIONS.error);
    await sendReply(
        api,
        threadID,
        messageID,
        success ? `✅ Nickname cleared for ${targetName}!` : MESSAGES.errors.nicknameFailed
    );
    return true;
}

/**
 * Handle single nickname change
 * @param {Object} api - Facebook API
 * @param {string} threadID - Thread ID
 * @param {string} messageID - Message ID
 * @param {string} targetID - Target user ID
 * @param {string} newNickname - New nickname
 * @returns {Promise<boolean>} True if handled
 */
async function handleNicknameChange(api, threadID, messageID, targetID, newNickname) {
    const success = await changeNickname(api, threadID, targetID, newNickname);

    react(api, messageID, success ? REACTIONS.success : REACTIONS.error);
    await sendReply(
        api,
        threadID,
        messageID,
        success
            ? `✅ Nickname changed to "${newNickname}"!`
            : MESSAGES.errors.nicknameFailed
    );
    return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEDIA HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle music suggestion with explanation
 * @param {Object} api - Facebook API
 * @param {string} threadID - Thread ID
 * @param {string} messageID - Message ID
 * @param {string} query - Search query
 * @param {string} explanation - AI explanation
 * @param {string} text - Original message text
 * @param {string} senderID - Sender's user ID
 * @returns {Promise<boolean>} True if handled
 */
async function handleMusicSuggestion(api, threadID, messageID, query, explanation, text, senderID) {
    await sendReply(api, threadID, messageID, explanation);
    
    // Learn user's music preferences from the query
    learnMusicPreference(senderID, query);
    
    const wantsLyrics = COMMAND_PATTERNS.WANTS_LYRICS.test(text);
    await downloadMusic(api, threadID, messageID, query, null, wantsLyrics);
    return true;
}

/**
 * Handle direct music download
 * @param {Object} api - Facebook API
 * @param {string} threadID - Thread ID
 * @param {string} messageID - Message ID
 * @param {string} query - Search query
 * @param {string} text - Original message text
 * @param {string} senderID - Sender's user ID
 * @returns {Promise<boolean>} True if handled
 */
async function handleMusicDownload(api, threadID, messageID, query, text, senderID) {
    // Learn user's music preferences from the query
    learnMusicPreference(senderID, query);
    
    const wantsLyrics = COMMAND_PATTERNS.WANTS_LYRICS.test(text);
    await downloadMusic(api, threadID, messageID, query, null, wantsLyrics);
    return true;
}

/**
 * Learn music preferences from a query
 * @param {string} senderID - User ID
 * @param {string} query - Music query (e.g., "Song - Artist")
 * @private
 */
function learnMusicPreference(senderID, query) {
    if (!senderID || !query) return;
    
    // Extract artist from query (format: "Song - Artist" or just "Artist")
    const parts = query.split(" - ");
    if (parts.length >= 2) {
        const artist = parts[parts.length - 1].trim();
        memory.updateUserPreference(senderID, { artist });
    }
    
    // Detect genre from keywords
    const genrePatterns = {
        "opm": /opm|tagalog|pinoy/i,
        "kpop": /kpop|korean|bts|blackpink|twice/i,
        "pop": /pop|taylor swift|ariana|justin/i,
        "hiphop": /rap|hiphop|hip-hop|eminem|drake/i,
        "rock": /rock|metal|punk/i,
        "rnb": /r&b|rnb|usher|chris brown/i,
    };
    
    for (const [genre, pattern] of Object.entries(genrePatterns)) {
        if (pattern.test(query)) {
            memory.updateUserPreference(senderID, { musicGenre: genre });
            break;
        }
    }
}

/**
 * Handle video download
 * @param {Object} api - Facebook API
 * @param {string} threadID - Thread ID
 * @param {string} messageID - Message ID
 * @param {string} query - Search query
 * @returns {Promise<boolean>} True if handled
 */
async function handleVideoDownload(api, threadID, messageID, query) {
    await downloadVideo(api, threadID, messageID, query, null);
    return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle weather check
 * @param {Object} api - Facebook API
 * @param {string} threadID - Thread ID
 * @param {string} messageID - Message ID
 * @param {string} location - Location to check
 * @returns {Promise<boolean>} True if handled
 */
async function handleWeatherCheck(api, threadID, messageID, location) {
    await getWeather(api, threadID, messageID, location);
    return true;
}

/**
 * Handle datetime check
 * @param {Object} api - Facebook API
 * @param {string} threadID - Thread ID
 * @param {string} messageID - Message ID
 * @returns {Promise<boolean>} True if handled
 */
async function handleDateTimeCheck(api, threadID, messageID) {
    const now = new Date();
    const manilaTime = now.toLocaleString("en-US", {
        timeZone: config.bot.timeZone,
        dateStyle: "full",
        timeStyle: "long",
    });

    await sendReply(
        api,
        threadID,
        messageID,
        `📅 Current Date & Time\n\n🕐 ${manilaTime}\n📍 Timezone: ${config.bot.timeZone}`
    );
    react(api, messageID, REACTIONS.success);
    return true;
}

/**
 * Handle user profile/stalk request
 * @param {Object} api - Facebook API
 * @param {string} threadID - Thread ID
 * @param {string} messageID - Message ID
 * @param {string} targetIdentifier - User name, mention, or UID
 * @param {Object} event - Message event
 * @param {string} requesterName - Name of the person asking
 * @returns {Promise<boolean>} True if handled
 */
async function handleStalkUser(api, threadID, messageID, targetIdentifier, event, requesterName) {
    await getUserProfile(api, threadID, messageID, targetIdentifier, event, requesterName);
    return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// REMINDER HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle reminder set command
 * @param {Object} api - Facebook API
 * @param {string} threadID - Thread ID
 * @param {string} messageID - Message ID
 * @param {string} senderID - Sender's user ID
 * @param {string} userName - Sender's name
 * @param {string} reminderText - Full reminder text (message + time)
 * @returns {Promise<boolean>} True if handled
 */
async function handleReminderSet(api, threadID, messageID, senderID, userName, reminderText) {
    react(api, messageID, REACTIONS.processing);
    
    // Parse the reminder input
    const parsed = reminder.parseReminderInput(reminderText);
    
    if (!parsed) {
        react(api, messageID, REACTIONS.error);
        await sendReply(
            api,
            threadID,
            messageID,
            `⚠️ I couldn't understand that reminder format.\n\n` +
            `Try something like:\n` +
            `• "remind me meeting 2:30pm today"\n` +
            `• "remind me to call mom in 30 minutes"\n` +
            `• "remind me homework 5pm tomorrow"`
        );
        return true;
    }
    
    // Create the reminder
    const result = reminder.createReminder(
        senderID,
        userName,
        threadID,
        parsed.message,
        parsed.time
    );
    
    if (!result.success) {
        react(api, messageID, REACTIONS.error);
        await sendReply(api, threadID, messageID, `❌ ${result.error}`);
        return true;
    }
    
    // Success!
    react(api, messageID, REACTIONS.success);
    
    const formattedTime = reminder.formatTime(parsed.time);
    const formattedDate = parsed.time.toLocaleDateString("en-US", { 
        weekday: "long", 
        month: "short", 
        day: "numeric" 
    });
    
    // Different message based on whether there's enough time for pre-reminder
    const confirmMessage = result.hasPreReminder
        ? `⏰ **Reminder Set!**\n\n` +
          `📝 **What**: ${parsed.message}\n` +
          `📅 **When**: ${formattedDate} at ${formattedTime}\n\n` +
          `I'll send you a heads-up 15 minutes before, and another notification when it's time! 👍`
        : `⏰ **Reminder Set!**\n\n` +
          `📝 **What**: ${parsed.message}\n` +
          `📅 **When**: ${formattedDate} at ${formattedTime}\n\n` +
          `I'll notify you when it's time! 👍`;
    
    await sendReply(api, threadID, messageID, confirmMessage);
    
    return true;
}

/**
 * Handle reminder list command
 * @param {Object} api - Facebook API
 * @param {string} threadID - Thread ID
 * @param {string} messageID - Message ID
 * @param {string} senderID - Sender's user ID
 * @returns {Promise<boolean>} True if handled
 */
async function handleReminderList(api, threadID, messageID, senderID) {
    const userReminders = reminder.getUserReminders(senderID);
    
    if (userReminders.length === 0) {
        await sendReply(
            api,
            threadID,
            messageID,
            `📋 You don't have any active reminders.\n\nSet one by saying "remind me [what] [when]"!`
        );
        return true;
    }
    
    const list = userReminders.map((r, i) => {
        const time = new Date(r.reminderTime);
        return `${i + 1}. **${r.message}**\n   📅 ${time.toLocaleDateString()} at ${reminder.formatTime(time)}`;
    }).join("\n\n");
    
    await sendReply(
        api,
        threadID,
        messageID,
        `📋 **Your Active Reminders**\n\n${list}`
    );
    
    return true;
}

/**
 * Handle reminder clear command
 * @param {Object} api - Facebook API
 * @param {string} threadID - Thread ID
 * @param {string} messageID - Message ID
 * @param {string} senderID - Sender's user ID
 * @returns {Promise<boolean>} True if handled
 */
async function handleReminderClear(api, threadID, messageID, senderID) {
    const count = reminder.clearUserReminders(senderID);
    
    if (count === 0) {
        await sendReply(
            api,
            threadID,
            messageID,
            `📋 You don't have any reminders to clear.`
        );
    } else {
        react(api, messageID, REACTIONS.success);
        await sendReply(
            api,
            threadID,
            messageID,
            `🗑️ Cleared ${count} reminder${count > 1 ? "s" : ""}!`
        );
    }
    
    return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TTS HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle TTS enable command (GLOBAL - applies to all chats)
 * @param {Object} api - Facebook API
 * @param {string} threadID - Thread ID
 * @param {string} messageID - Message ID
 * @returns {Promise<boolean>} True if handled
 */
async function handleTTSEnable(api, threadID, messageID) {
    tts.enable();
    react(api, messageID, REACTIONS.success);
    
    await sendReply(
        api,
        threadID,
        messageID,
        "🔊 TTS Enabled GLOBALLY!\n\nAll chats will now receive voice messages with my responses~ 🎀✨\nYou'll hear my cute voice everywhere! 💕\n\n💡 Use 'tts disable' to turn off."
    );
    return true;
}

/**
 * Handle TTS disable command (GLOBAL - applies to all chats)
 * @param {Object} api - Facebook API
 * @param {string} threadID - Thread ID
 * @param {string} messageID - Message ID
 * @returns {Promise<boolean>} True if handled
 */
async function handleTTSDisable(api, threadID, messageID) {
    tts.disable();
    react(api, messageID, REACTIONS.success);
    
    await sendReply(
        api,
        threadID,
        messageID,
        "🔇 TTS Disabled GLOBALLY!\n\nAll chats will receive text-only messages now.\n\n💡 Use 'tts enable' to hear my voice again! 🎀"
    );
    return true;
}

/**
 * Handle TTS status command (GLOBAL)
 * @param {Object} api - Facebook API
 * @param {string} threadID - Thread ID
 * @param {string} messageID - Message ID
 * @returns {Promise<boolean>} True if handled
 */
async function handleTTSStatus(api, threadID, messageID) {
    const statusMessage = tts.getStatusMessage();
    react(api, messageID, REACTIONS.success);
    await sendReply(api, threadID, messageID, statusMessage);
    return true;
}

/**
 * Handle TTS voice change command
 * @param {Object} api - Facebook API
 * @param {string} threadID - Thread ID
 * @param {string} messageID - Message ID
 * @param {string} senderID - User ID
 * @param {string} voiceName - Requested voice name
 * @returns {Promise<boolean>} True if handled
 */
async function handleTTSVoice(api, threadID, messageID, senderID, voiceName) {
    const voices = tts.getAvailableVoices();
    const voiceKey = voiceName.toUpperCase();
    
    if (voices[voiceKey]) {
        tts.setVoice(senderID, voiceKey);
        react(api, messageID, REACTIONS.success);
        
        await sendReply(
            api,
            threadID,
            messageID,
            `🎀 Voice Changed!\n\nYour TTS voice is now: ${voiceKey}\n\n💡 Available voices:\n${Object.keys(voices).map(v => `• ${v}`).join('\n')}`
        );
    } else {
        react(api, messageID, REACTIONS.warning);
        
        await sendReply(
            api,
            threadID,
            messageID,
            `⚠️ Voice '${voiceName}' not found!\n\n💡 Available voices:\n${Object.keys(voices).map(v => `• ${v}`).join('\n')}\n\nExample: "nero change voice to NANAMI"`
        );
    }
    return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAIRING HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle "pair me" command
 * @param {Object} api - Facebook API
 * @param {string} threadID - Thread ID
 * @param {string} messageID - Message ID
 * @param {string} senderID - Sender's ID
 * @param {string} userName - Sender's name
 * @param {Map} allMembers - Group members map
 * @returns {Promise<boolean>} True if handled
 */
async function handlePairMe(api, threadID, messageID, senderID, userName, allMembers) {
    react(api, messageID, REACTIONS.searching);

    if (allMembers.size < 2) {
        await sendReply(api, threadID, messageID, MESSAGES.notEnoughMembers);
        return true;
    }

    const { pairs, stats, error } = await generateRandomPairs(allMembers, senderID, false);

    // Handle no opposite gender error
    if (error === "no_opposite_gender") {
        react(api, messageID, REACTIONS.error);
        const genderText = stats?.senderGender === GENDER_MALE ? "female" : 
                          stats?.senderGender === GENDER_FEMALE ? "male" : "opposite gender";
        await sendReply(
            api, 
            threadID, 
            messageID, 
            `I can only pair you with the opposite gender, but I couldn't find any ${genderText} members in this group. The pairing system only matches males with females.`
        );
        return true;
    }

    if (pairs.length > 0 && pairs[0].person2) {
        const p1 = pairs[0].person1;
        const p2 = pairs[0].person2;

        // Verify opposite gender (should always be true now)
        const isOppositeGender = 
            (p1.gender === GENDER_MALE && p2.gender === GENDER_FEMALE) ||
            (p1.gender === GENDER_FEMALE && p2.gender === GENDER_MALE);

        if (!isOppositeGender) {
            react(api, messageID, REACTIONS.error);
            await sendReply(
                api, 
                threadID, 
                messageID, 
                `I can only create love matches between males and females. No suitable opposite gender match was found.`
            );
            return true;
        }

        const { percent, message } = await analyzeLoveCompatibility(
            p1.name,
            p1.gender,
            p2.name,
            p2.gender
        );

        react(api, messageID, REACTIONS.love);

        // Create love match card with profile pictures
        const loveCard = await createLoveMatchCard(
            p1.id,
            p2.id,
            p1.name,
            p2.name,
            p1.gender,
            p2.gender,
            percent
        );

        const messageBody = `💘 Love Match!\n\n${p1.gender} ${p1.name}\n     ❤️\n${p2.gender} ${p2.name}\n\n💯 Compatibility: ${percent}%\n💬 ${message}`;

        if (loveCard) {
            await api.sendMessage(
                { body: messageBody, attachment: loveCard },
                threadID,
                messageID
            );
        } else {
            await sendReply(api, threadID, messageID, messageBody);
        }
    } else {
        react(api, messageID, REACTIONS.error);
        await sendReply(api, threadID, messageID, "No suitable match found. I can only pair males with females.");
    }

    return true;
}

/**
 * Handle "pair with" command (mentions)
 * @param {Object} api - Facebook API
 * @param {string} threadID - Thread ID
 * @param {string} messageID - Message ID
 * @param {Object} event - Message event
 * @param {string} senderID - Sender's ID
 * @param {Map} allMembers - Group members map
 * @returns {Promise<boolean>} True if handled
 */
async function handlePairWith(api, threadID, messageID, event, senderID, allMembers) {
    const mentions = event.mentions || {};
    const mentionedIDs = Object.keys(mentions);

    react(api, messageID, REACTIONS.searching);

    // If no mentions found in event, try to extract name from the original message
    // and search for them in group members
    if (mentionedIDs.length === 0) {
        // Try to find @mentions in the original message text
        const messageBody = event.body || "";
        const atMentionMatch = messageBody.match(/@([^\s@]+(?:\s+[^\s@]+)*)/g);
        
        if (atMentionMatch && atMentionMatch.length > 0) {
            // Extract names from @mentions and search in group members
            for (const mention of atMentionMatch) {
                const searchName = mention.replace(/^@/, "").trim().toLowerCase();
                
                // Search for this name in allMembers
                for (const [id, name] of allMembers.entries()) {
                    const memberName = name.toLowerCase();
                    if (memberName.includes(searchName) || searchName.includes(memberName.split(" ")[0])) {
                        if (id !== senderID) {
                            mentionedIDs.push(id);
                            break;
                        }
                    }
                }
            }
        }
    }

    if (mentionedIDs.length === 0) {
        react(api, messageID, REACTIONS.error);
        await sendReply(
            api,
            threadID,
            messageID,
            "I couldn't find that person in this group. Try using their exact name or mentioning them with @."
        );
        return true;
    }

    let person1, person2;

    if (mentionedIDs.length >= 2) {
        // Two mentions: pair them together
        const id1 = mentionedIDs[0];
        const id2 = mentionedIDs[1];
        person1 = {
            id: id1,
            name: allMembers.get(id1) || mentions[id1]?.replace(/@/g, "") || "User 1",
        };
        person2 = {
            id: id2,
            name: allMembers.get(id2) || mentions[id2]?.replace(/@/g, "") || "User 2",
        };
    } else {
        // One mention: find OPPOSITE gender match
        const targetID = mentionedIDs[0];
        const targetName =
            allMembers.get(targetID) || mentions[targetID]?.replace(/@/g, "") || "User";

        // First, analyze the target's gender
        const targetMember = { id: targetID, name: targetName };
        const allMembersArray = Array.from(allMembers.entries())
            .filter(([id]) => id !== targetID && id !== senderID)
            .map(([id, name]) => ({ id, name }));

        // Analyze genders of target and all potential matches
        const { males, females } = await analyzeGenders([targetMember, ...allMembersArray]);
        
        const targetIsMale = males.some((m) => m.id === targetID);
        const targetIsFemale = females.some((m) => m.id === targetID);

        // Find opposite gender match
        let oppositeGenderPool;
        if (targetIsMale) {
            oppositeGenderPool = females.filter((m) => m.id !== targetID);
        } else if (targetIsFemale) {
            oppositeGenderPool = males.filter((m) => m.id !== targetID);
        } else {
            // Unknown gender, pick randomly from males or females
            oppositeGenderPool = [...males, ...females].filter((m) => m.id !== targetID);
        }

        if (oppositeGenderPool.length === 0) {
            react(api, messageID, REACTIONS.error);
            await sendReply(api, threadID, messageID, "No opposite gender members found to pair with! The AI couldn't find a suitable match.");
            return true;
        }

        const randomMatch = oppositeGenderPool[Math.floor(Math.random() * oppositeGenderPool.length)];
        person1 = { id: targetID, name: targetName };
        person2 = { id: randomMatch.id, name: randomMatch.name };
    }

    // Get AI-powered gender analysis for the final pair
    const { males, females } = await analyzeGenders([person1, person2]);

    const gender1 = males.some((m) => m.id === person1.id)
        ? GENDER_MALE
        : females.some((m) => m.id === person1.id)
            ? GENDER_FEMALE
            : "❓";
    const gender2 = males.some((m) => m.id === person2.id)
        ? GENDER_MALE
        : females.some((m) => m.id === person2.id)
            ? GENDER_FEMALE
            : "❓";

    // Check if same gender (warn user)
    const isSameGender = (gender1 === GENDER_MALE && gender2 === GENDER_MALE) ||
                         (gender1 === GENDER_FEMALE && gender2 === GENDER_FEMALE);

    if (isSameGender) {
        react(api, messageID, REACTIONS.error);
        await sendReply(
            api,
            threadID,
            messageID,
            `${gender1} ${person1.name} and ${gender2} ${person2.name} are both the same gender! I can only pair opposite genders. Try mentioning someone of the opposite gender.`
        );
        return true;
    }

    const { percent, message } = await analyzeLoveCompatibility(
        person1.name,
        gender1,
        person2.name,
        gender2
    );

    react(api, messageID, REACTIONS.love);

    // Create love match card with profile pictures
    const loveCard = await createLoveMatchCard(
        person1.id,
        person2.id,
        person1.name,
        person2.name,
        gender1,
        gender2,
        percent
    );

    const messageBody = `💘 Love Match!\n\n${gender1} ${person1.name}\n     ❤️\n${gender2} ${person2.name}\n\n💯 Compatibility: ${percent}%\n💬 ${message}`;

    if (loveCard) {
        await api.sendMessage(
            { body: messageBody, attachment: loveCard },
            threadID,
            messageID
        );
    } else {
        await sendReply(api, threadID, messageID, messageBody);
    }

    return true;
}

/**
 * Handle random pairs command
 * @param {Object} api - Facebook API
 * @param {string} threadID - Thread ID
 * @param {string} messageID - Message ID
 * @param {Map} allMembers - Group members map
 * @returns {Promise<boolean>} True if handled
 */
async function handlePairRandom(api, threadID, messageID, allMembers) {
    react(api, messageID, REACTIONS.searching);

    if (allMembers.size < 2) {
        await sendReply(api, threadID, messageID, MESSAGES.notEnoughMembers);
        return true;
    }

    const { pairs, stats } = await generateRandomPairs(allMembers, null, true);

    react(api, messageID, REACTIONS.love);
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
 * @param {Object} params.api - Facebook API
 * @param {Object} params.event - Message event
 * @param {string} params.response - AI response text
 * @param {string} params.text - Original user text
 * @param {string} params.threadID - Thread ID
 * @param {string} params.senderID - Sender ID
 * @param {string} params.userName - User's name
 * @param {string} params.messageID - Message ID
 * @returns {Promise<boolean>} True if command was handled
 */
async function handleCommands({
    api,
    event,
    response,
    text,
    threadID,
    senderID,
    userName,
    messageID,
}) {
    const responseText = response.trim();
    const allMembers = await users.getAllGroupMembers(api, threadID);

    // ─────────────────────────────────────────────────────────────────────────
    // NICKNAME COMMANDS (Priority - check first)
    // ─────────────────────────────────────────────────────────────────────────

    const bulkMatch = responseText.match(COMMAND_PATTERNS.NICKNAME_BULK);
    if (bulkMatch) {
        return handleBulkNickname(api, threadID, messageID, bulkMatch[1], allMembers);
    }

    if (COMMAND_PATTERNS.NICKNAME_CLEAR_ALL.test(responseText)) {
        return handleClearAllNicknames(api, threadID, messageID, allMembers);
    }

    const clearMatch = responseText.match(COMMAND_PATTERNS.NICKNAME_CLEAR);
    if (clearMatch) {
        return handleClearNickname(
            api,
            threadID,
            messageID,
            clearMatch[1].trim(),
            text,
            senderID,
            allMembers
        );
    }

    const nicknameMatch = responseText.match(COMMAND_PATTERNS.NICKNAME_CHANGE);
    if (nicknameMatch) {
        return handleNicknameChange(
            api,
            threadID,
            messageID,
            cleanValue(nicknameMatch[1]),
            cleanValue(nicknameMatch[2])
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MEDIA COMMANDS
    // ─────────────────────────────────────────────────────────────────────────

    const musicSuggestionMatch = responseText.match(COMMAND_PATTERNS.MUSIC_SUGGESTION);
    if (musicSuggestionMatch) {
        return handleMusicSuggestion(
            api,
            threadID,
            messageID,
            cleanValue(musicSuggestionMatch[1]),
            cleanValue(musicSuggestionMatch[2]),
            text,
            senderID
        );
    }

    const musicMatch = responseText.match(COMMAND_PATTERNS.MUSIC_DOWNLOAD);
    if (musicMatch) {
        return handleMusicDownload(api, threadID, messageID, cleanValue(musicMatch[1]), text, senderID);
    }

    const videoMatch = responseText.match(COMMAND_PATTERNS.VIDEO_DOWNLOAD);
    if (videoMatch) {
        return handleVideoDownload(api, threadID, messageID, cleanValue(videoMatch[1]));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UTILITY COMMANDS
    // ─────────────────────────────────────────────────────────────────────────

    const weatherMatch = responseText.match(COMMAND_PATTERNS.WEATHER_CHECK);
    if (weatherMatch) {
        return handleWeatherCheck(api, threadID, messageID, cleanValue(weatherMatch[1]));
    }

    if (COMMAND_PATTERNS.DATETIME_CHECK.test(responseText)) {
        return handleDateTimeCheck(api, threadID, messageID);
    }

    const stalkMatch = responseText.match(COMMAND_PATTERNS.STALK_USER);
    if (stalkMatch) {
        return handleStalkUser(api, threadID, messageID, cleanValue(stalkMatch[1]), event, userName);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PAIRING COMMANDS
    // ─────────────────────────────────────────────────────────────────────────

    if (COMMAND_PATTERNS.PAIR_ME.test(responseText)) {
        return handlePairMe(api, threadID, messageID, senderID, userName, allMembers);
    }

    if (COMMAND_PATTERNS.PAIR_WITH.test(responseText)) {
        return handlePairWith(api, threadID, messageID, event, senderID, allMembers);
    }

    if (COMMAND_PATTERNS.PAIR_RANDOM.test(responseText)) {
        return handlePairRandom(api, threadID, messageID, allMembers);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REMINDER COMMANDS
    // ─────────────────────────────────────────────────────────────────────────

    const reminderMatch = responseText.match(COMMAND_PATTERNS.REMINDER_SET);
    if (reminderMatch) {
        return handleReminderSet(api, threadID, messageID, senderID, userName, cleanValue(reminderMatch[1]));
    }

    if (COMMAND_PATTERNS.REMINDER_LIST.test(responseText)) {
        return handleReminderList(api, threadID, messageID, senderID);
    }

    if (COMMAND_PATTERNS.REMINDER_CLEAR.test(responseText)) {
        return handleReminderClear(api, threadID, messageID, senderID);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TTS COMMANDS
    // ─────────────────────────────────────────────────────────────────────────

    if (COMMAND_PATTERNS.TTS_ENABLE.test(responseText)) {
        return handleTTSEnable(api, threadID, messageID);
    }

    if (COMMAND_PATTERNS.TTS_DISABLE.test(responseText)) {
        return handleTTSDisable(api, threadID, messageID);
    }

    if (COMMAND_PATTERNS.TTS_STATUS.test(responseText)) {
        return handleTTSStatus(api, threadID, messageID);
    }

    const voiceMatch = responseText.match(COMMAND_PATTERNS.TTS_VOICE);
    if (voiceMatch) {
        return handleTTSVoice(api, threadID, messageID, senderID, cleanValue(voiceMatch[1]));
    }

    return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    handleCommands,
};
