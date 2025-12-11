/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                         PROMPT BUILDER MODULE                                 ║
 * ║            Builds AI prompts with context and instructions                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module handlers/prompt
 * @author 0x3EF8
 * @version 1.2.0
 */

"use strict";

const { memory } = require("../core/memory");
const { users } = require("../core/users");
const { AI_IDENTITY, MEMORY_CONFIG } = require("../core/constants");
const { buildScheduleContext } = require("../core/schedule");

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build the AI prompt with all context
 * @param {Object} params - Prompt parameters
 * @returns {Promise<string>} Complete prompt
 */
async function buildPrompt({ api, text, userName, threadID, senderID, images }) {
    // Gather context
    const contextText = memory.getFormattedHistory(threadID, MEMORY_CONFIG.contextWindow);
    const { membersList, allMembers } = await getGroupContext(api, threadID);

    // Build instruction sections
    const sections = [
        buildSystemPrompt(text, images.length),
        buildScheduleContext(), // Add class schedule knowledge
        buildMembersSection(membersList),
        buildNicknameInstructions(senderID, allMembers),
        buildPairingInstructions(allMembers),
        buildMediaInstructions(),
        buildContextSection(contextText, userName, text),
    ];

    return sections.filter(Boolean).join("");
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT BUILDERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get group members context
 */
async function getGroupContext(api, threadID) {
    let membersList = "";
    let allMembers = new Map();

    try {
        allMembers = await users.getAllGroupMembers(api, threadID);
        if (allMembers.size > 0) {
            membersList = Array.from(allMembers.entries())
                .map(([id, name]) => `${id}=${name}`)
                .join("\n");
        }
    } catch {
        // Silent fail - group context is optional
    }

    return { membersList, allMembers };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPT SECTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build core system prompt
 */
function buildSystemPrompt(text, imageCount) {
    const imageNote = imageCount > 0
        ? `\n- ${imageCount} IMAGE(S): Analyze immediately. Answer questions, solve problems, read text directly.`
        : "";

    return `You are ${AI_IDENTITY.name}, a ${AI_IDENTITY.persona} by ${AI_IDENTITY.author}.

**CORE RULES**:
- Detect language from: "${text}" → respond in SAME language
- Commands: Output EXACT format (MUSIC_DOWNLOAD:, VIDEO_DOWNLOAD:, etc.)
- Keep replies short & natural. Use emojis, no markdown
- Be helpful, friendly, smart${imageNote}`;
}

/**
 * Build members section
 */
function buildMembersSection(membersList) {
    if (!membersList) return "";
    return `\n\n**GROUP MEMBERS** (Format: ID=Name):\n${membersList}`;
}

/**
 * Build nickname instructions
 */
function buildNicknameInstructions(senderID, allMembers) {
    if (allMembers.size === 0) return "";

    return `

**NICKNAME COMMANDS** (use REAL 15-digit IDs from GROUP MEMBERS):
- Bulk: NICKNAME_BULK: <id1>|<name1>||<id2>|<name2>||...
- Single: NICKNAME_CHANGE: <userID>|<newNickname>
- Clear one: NICKNAME_CLEAR: <userID>
- Clear all: NICKNAME_CLEAR_ALL
- Sender's ID: ${senderID}
❌ NEVER use 0,1,2,3 as IDs - use actual 15-digit numbers!`;
}

/**
 * Build pairing instructions
 */
function buildPairingInstructions(allMembers) {
    if (allMembers.size < 2) return "";

    return `

**LOVE PAIRING** (AI gender-matching):
- PAIR_ME → Pair sender with random opposite gender
- PAIR_WITH → Pair mentioned @users
- PAIR_RANDOM → Pair all members randomly`;
}

/**
 * Build media instructions
 */
function buildMediaInstructions() {
    return `

**MEDIA COMMANDS** (⚠️ MAX 10 MIN):
- MUSIC_DOWNLOAD: <song title artist> → For music/songs/audio
- VIDEO_DOWNLOAD: <query short> → For videos/clips
- MUSIC_SUGGESTION: <song by artist> | <why> → Proactive suggestion
- WEATHER_CHECK: <location> → Weather info (default: maasin)
- DATETIME_CHECK → Current date/time

Rules:
- For vague requests ("play music"), pick a REAL specific song!
- Never generic searches like "sad songs" - use actual titles
- Add "short" to video searches`;
}

/**
 * Build context and final prompt section
 */
function buildContextSection(contextText, userName, text) {
    return `

**CONVERSATION** (last ${MEMORY_CONFIG.contextWindow} messages):
${contextText || "(No previous context)"}

${userName}: "${text}"

Reply as ${AI_IDENTITY.name}:`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    buildPrompt,
};
