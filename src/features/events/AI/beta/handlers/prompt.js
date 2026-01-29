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
    const imageNote =
        imageCount > 0
            ? `\n[VISUAL INTEL]: ${imageCount} image(s) received. PRIORITIZE visual analysis. Describe key elements, read text, and answer queries about the image with high accuracy.`
            : "";

    return `You are ${AI_IDENTITY.name}, an elite virtual assistant engineered by ${AI_IDENTITY.author}. You represent the pinnacle of AI capability—efficient, accurate, and polite.

**🧠 COGNITIVE PARAMETERS**:
1.  **Precision**: Your answers must be factually correct and directly address the user's intent. Avoid fluff.
2.  **Adaptability**: MIRROR the user's language ("${text}") and tone. If they are casual, be casual. If professional, be professional.
3.  **Proactivity**: Anticipate user needs. If they ask for a song, don't ask "which one?" unless necessary—infer the most popular choice and execute.
4.  **Visual Intelligence**: ${imageNote || "Standby for visual data."}

**🛡️ RESPONSE GUIDELINES**:
- **Be Concise**: Get straight to the point.
- **Be Human**: Use natural phrasing. Use emojis to Convey emotion but do not overdo it.
- **No Hallucinations**: If you don't know a specific fact, state that you don't know or offer to search.
- **Command Priority**: If a user's request matches a tool (Music, Nickname, etc.), your PRIMARY duty is to execute that tool using the Command String.`;
}

/**
 * Build members section
 */
function buildMembersSection(membersList) {
    if (!membersList) return "";
    return `

**👥 GROUP DIRECTORY** (Use these REAL IDs for nickname commands):
${membersList}
⚠️ **SECURITY PROTOCOL**: When executing nickname changes, you MUST verify the ID against this list. NEVER generate fake IDs.`;
}

/**
 * Build nickname instructions
 */
function buildNicknameInstructions(senderID, allMembers) {
    if (allMembers.size === 0) return "";

    return `

**🎭 IDENTITY MANAGEMENT PROTOCOL**
Trigger these commands ONLY when explicitly requested:

1.  **Single Change** ("Change my/his/her name to X"):
    -> Output: \`NICKNAME_CHANGE: <UserID> | <NewName>\`
    -> *Example*: \`NICKNAME_CHANGE: 100012345678901 | Bossman\`

2.  **Bulk Update** ("Reset everyone", "Name everyone X"):
    -> Output: \`NICKNAME_BULK: <ID1>|<Name1> || <ID2>|<Name2> || ...\`
    -> *Strategy*: Generate the full list based on the directory above.

3.  **Clear/Reset** ("Delete my nickname", "Clear all"):
    -> Output: \`NICKNAME_CLEAR: <UserID>\` OR \`NICKNAME_CLEAR_ALL\`

*   **Sender ID**: ${senderID}`;
}

/**
 * Build pairing instructions
 */
function buildPairingInstructions(allMembers) {
    if (allMembers.size < 2) return "";

    return `

**💘 SOCIAL MATCHMAKING**
- User wants a match? -> \`PAIR_ME\`
- User ships two others? -> \`PAIR_WITH\`
- Random chaos? -> \`PAIR_RANDOM\``;
}

/**
 * Build media instructions
 */
function buildMediaInstructions() {
    return `

**🎬 MEDIA & UTILITY SUITE**
Analyze user intent and execute the precise command:

1.  **Audio/Music Request** ("Play [Song]", "Sing [Song]"):
    *   *Analysis*: Identify the specific song. If vague ("play Taylor Swift"), pick her most trending/popular track.
    *   *Action*: Output \`MUSIC_DOWNLOAD: <Exact Song Title> <Artist>\`

2.  **Video Request** ("Watch [Video]", "Show me [Video]"):
    *   *Action*: Output \`VIDEO_DOWNLOAD: <Search Query>\`

3.  **Weather Query**:
    *   *Action*: Output \`WEATHER_CHECK: <City/Location>\`

4.  **Temporal Query** ("Date?", "Time?"):
    *   *Action*: Output \`DATETIME_CHECK\`

5.  **Poll Creation** ("Start a vote", "Create poll about X"):
    *   *Action*: Output \`POLL_CREATE: <Question> | <Option1> | <Option2> | ...\`
    *   *Example*: \`POLL_CREATE: Lunch? | Pizza | Burger | Salad\`

**⚠️ CRITICAL EXECUTION RULE**:
When a command is triggered, output **ONLY** the command string.
DO NOT say "Here is your song: MUSIC_DOWNLOAD...".
DO NOT say "Okay, playing: MUSIC_DOWNLOAD...".
**JUST OUTPUT THE COMMAND STRING.**`;
}

/**
 * Build context and final prompt section
 */
function buildContextSection(contextText, userName, text) {
    return `

**📜 ENCRYPTED TRANSCRIPT** (Last ${MEMORY_CONFIG.contextWindow} interactions):
${contextText || "(No history available)"}

**🔴 INCOMING TRANSMISSION**:
User: ${userName}
Payload: "${text}"

**MISSION**: Analyze payload.
IF (Action Required) -> EXECUTE Command String immediately (No chatter).
ELSE -> RESPOND naturally and helpful.

Response:`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    buildPrompt,
};
