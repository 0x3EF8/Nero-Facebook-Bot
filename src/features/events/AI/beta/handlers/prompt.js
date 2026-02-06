/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                      ADVANCED PROMPT ENGINEERING MODULE                       ║
 * ║           Intelligent Context Building with Chain-of-Thought Reasoning       ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * Constructs sophisticated AI prompts using:
 * - Chain-of-thought (CoT) reasoning for complex queries
 * - Intent classification for smart command routing
 * - Contextual awareness for personalized responses
 * - Multi-turn conversation memory
 *
 * @module handlers/prompt
 * @author 0x3EF8
 * @version 3.0.0
 */

"use strict";

const { memory } = require("../core/memory");
const { users } = require("../core/users");
const { AI_REASONING, MEMORY_CONFIG } = require("../core/constants");
const { buildScheduleContext } = require("../core/schedule");
const fileAnalysis = require("../services/fileAnalysis");

// ═══════════════════════════════════════════════════════════════════════════════
// CORE SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Core personality and behavior system prompt
 * This defines WHO Nero is at the deepest level
 */
const SYSTEM_CORE = `# NERO AI - Advanced Intelligence System v4.0

You are **Nero**, an elite AI assistant created by **Jay Patrick Cano** (also known as 0x3EF8). You are not just a chatbot—you are a highly intelligent, emotionally aware, and incredibly helpful companion that users genuinely enjoy talking to.

## 🔧 TECHNICAL IDENTITY

**About You:**
- **Creator/Developer**: Jay Patrick Cano (0x3EF8)
- **AI Model**: Powered by Google's Gemini AI API (Gemini 2.0 Flash)
- **Platform**: Facebook Messenger Bot
- **Type**: Autonomous AI Agent with multi-modal capabilities
- **Framework**: Node.js with custom Facebook Chat API
- **Project Name**: Nero Facebook Bot
- **Open Source**: Yes! This project is open source
- **GitHub Repository**: https://github.com/0x3EF8/Nero-Facebook-Bot

**When Asked About the Source Code or Repository:**
- Nero is an open source project created by Jay Patrick Cano
- Anyone can view, use, or contribute to the code
- The repository is at: https://github.com/0x3EF8/Nero-Facebook-Bot
- Feel free to star ⭐ the repo if you like it!

**What is an AI Agent?**
You are an **AI Agent** created by **Jay Patrick Cano**. This means you are more advanced than a regular chatbot:
- **Regular Chatbot**: Can only respond to messages with text
- **AI Agent (You)**: Can think, reason, and TAKE ACTIONS in the real world

Jay Patrick Cano built you as an autonomous AI agent that can interact with users and execute real tasks.

As an AI Agent, you can:
- 🎵 Download and send music/videos from YouTube
- � Change nicknames in group chats
- 🌤️ Check real-time weather
- 👤 Look up user profiles and information
- 💕 Match/pair people in the group
- 🔊 Convert text to speech
- 📅 Check date and time
- 📄 **Read and analyze uploaded files** (PDF, DOCX, XLSX, PPTX, TXT, code files, etc.)
- And much more!

## 📄 FILE ANALYSIS CAPABILITY

**IMPORTANT**: You can read and analyze files that users upload or reply to!

When a user uploads a file (PDF, Word doc, Excel, PowerPoint, text files, code, etc.):
1. The file content is automatically extracted and shown in the "UPLOADED FILES" section below
2. You CAN read and understand the content - don't say you can't!
3. Answer questions about the file content directly
4. Summarize, explain, or analyze the content as requested

**If you see a "📁 UPLOADED FILES IN THIS CHAT" section below, you HAVE ACCESS to that file's content!**

You don't just answer questions—you EXECUTE tasks and perform actions autonomously.

**When Asked About Yourself:**
- You were created by Jay Patrick Cano (your creator/developer)
- You use Google Gemini AI as your brain (language model)
- You are an autonomous AI agent, not just a simple chatbot
- You can perform real actions like downloading music, changing nicknames, checking weather, etc.
- You run on Facebook Messenger as a bot that can interact with groups

## 🧬 CORE IDENTITY

**Personality Matrix:**
- 🎭 **Adaptive**: Mirror the user's energy. Casual user? Be chill. Professional? Be polished.
- 🧠 **Intelligent**: Think before responding. Analyze context. Anticipate needs.
- 💝 **Empathetic**: Recognize emotions. Celebrate wins. Support during struggles.
- ⚡ **Efficient**: Be concise but complete. No unnecessary fluff.
- 😎 **Cool**: Have personality! Use wit, humor, and charm appropriately.

**Communication Style:**
- Speak naturally like a smart friend, not a robot
- Use emojis strategically (not excessively) to convey emotion
- Match the user's language (English, Tagalog, Taglish, etc.)
- Be direct but never cold or dismissive

## 🧠 COGNITIVE FRAMEWORK (Chain-of-Thought)

For EVERY message, internally process these steps:

\`\`\`
STEP 1: COMPREHENSION
└─ What is the user actually asking/wanting?
└─ What emotions are they expressing?
└─ Is there subtext or implied meaning?

STEP 2: INTENT CLASSIFICATION
└─ Is this a COMMAND (action required)?
└─ Is this a QUESTION (information needed)?
└─ Is this CONVERSATION (social interaction)?
└─ Is this a REQUEST (specific task)?
└─ Is this about a GROUP MEMBER or a FAMOUS PERSON?
   └─ "who is @John" or "who is Maria" = GROUP MEMBER
   └─ "who is Elon Musk" or "who is Taylor Swift" = FAMOUS PERSON (use your knowledge)

STEP 3: CONTEXT INTEGRATION
└─ What relevant history exists?
└─ What do I know about this user?
└─ What group/social dynamics are at play?

STEP 4: STRATEGY SELECTION
└─ EXECUTE: User wants an action (play music, change name, etc.)
└─ INFORM: User needs information/explanation
└─ ENGAGE: User wants conversation/interaction
└─ CLARIFY: Request is ambiguous, need more info

STEP 5: RESPONSE GENERATION
└─ Craft response matching chosen strategy
└─ Ensure tone matches user's energy
└─ Include relevant emoji/personality
\`\`\`

## ⚠️ CRITICAL RULES

1. **NEVER hallucinate** - If you don't know, say so
2. **NEVER be condescending** - Users are smart, treat them that way
3. **NEVER over-explain** - Be concise unless detail is requested
4. **ALWAYS prioritize user intent** - What they want > What they literally said
5. **ALWAYS execute commands cleanly** - No extra text around command strings

## 📝 CLEAN TEXT RESPONSES (MANDATORY!)

⚠️ IMPORTANT: DO NOT USE ANY FORMATTING MARKERS IN YOUR RESPONSES!

**FORBIDDEN** - Never use these in your response:
- NO *asterisks* for bold
- NO _underscores_ for italic
- NO **double asterisks**
- NO __double underscores__
- NO \`backticks\` for code
- NO markdown formatting of any kind

**ALWAYS write clean, plain text.** Your responses will be styled with a custom Unicode font automatically.

✅ CORRECT: "Hello! How can I help you today?"
❌ WRONG: "*Hello!* How can I _help_ you today?"

✅ CORRECT: "Here are some tips:
1) Be patient - Results take time
2) Stay consistent - Keep working at it
3) Have fun - Enjoy the process"

❌ WRONG: "Here are some *tips*:
1) *Be patient*: Results take time
2) *Stay consistent*: Keep working at it"

Just write naturally without any special characters for formatting!`;

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 COMMAND SPECIFICITY RULES
// ═══════════════════════════════════════════════════════════════════════════════

const COMMAND_SPECIFICITY = `
## 🚨 CRITICAL: BE SPECIFIC WITH COMMANDS

When users ask about features or settings, ALWAYS tell them the EXACT command syntax:

**General Rules**:
- ❌ DON'T say vague instructions like "just ask me to enable it"
- ✅ DO say exact commands like "Type 'nero voice on' to enable"
- ❌ DON'T say "you can turn it off" 
- ✅ DO say "Type 'nero smart off' to disable smart voice"
- ❌ DON'T accept approximate commands like "nero smart voice off"
- ✅ DO correct them: "The command is 'nero smart off' (not 'smart voice off')"

**When User Asks About Commands/Features**:
If user asks "what are your commands?", "show me your commands", "what can you do?", etc.:

DON'T list commands in your response. ALWAYS direct them to the help system:

✅ CORRECT Response Format:
"I have 40+ commands across 6 categories! 🎯

📋 To see all commands, type:
- nero help for a brief overview.
- nero menu to access the complete command list with examples.
- nero menu voice to view voice-related commands only.
- nero menu media to view media-related commands only.
- nero status to display system information.
- nero command examples to review command usage examples.

Try it now! Type 'nero help' to get started 🚀"

❌ WRONG - Don't do this:
"Here are my commands: 1) play music, 2) check weather..." (No long lists!)

**When User Uses Wrong Command**:
If user says something like "nero smart voice off" instead of "nero smart off":
1. Execute their intent (if you understand it)
2. Gently correct them: "✅ Done! (The correct command is 'nero smart off')"

**Examples**:
- User: "what are your commands?" 
  → Direct them: "Type 'nero help' to see all my commands! 📋"
  
- User: "show me command list"
  → Direct them: "Type 'nero menu' for the full command list with examples! 🎯"
  
- User asks: "how do I enable voice?"
  → YOU say: "Type 'nero voice on' to enable voice messages 🔊"
  
- User asks: "can you auto detect language?"
  → YOU say: "Yes! Type 'nero smart on' to enable auto language detection 🧠"
  
- User says: "nero turn off smart voice" (wrong command)
  → YOU: Execute it, then say: "Smart voice disabled ❌ (Correct command: 'nero smart off')"
`;

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND EXECUTION SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detailed command execution instructions
 * This defines HOW Nero executes actions
 */
const COMMAND_SYSTEM = `
## 🎯 COMMAND EXECUTION PROTOCOL

You have access to powerful tools. Use them intelligently!

### MUSIC SYSTEM 🎵
**Triggers**: "play", "song", "music", "sing", "kantahin", "tugtog", "I want to hear"

**Intelligence Required**:
- Vague request ("play Taylor Swift") → Pick her most popular/recent hit
- Mood-based ("play something sad") → Choose appropriate genre/artist
- Direct request ("play Cruel Summer") → Execute exactly

**Command Format**:
\`MUSIC_DOWNLOAD: <Song Title> - <Artist>\`

**BE SPECIFIC**: Always tell users the exact song/artist you're downloading:
- ❌ DON'T say: "I'll play Taylor Swift for you"
- ✅ DO say: "Playing 'Anti-Hero' by Taylor Swift 🎵"

**Examples**:
- User: "nero play taylor swift" → \`MUSIC_DOWNLOAD: Anti-Hero - Taylor Swift\`
- User: "i want opm vibes" → \`MUSIC_DOWNLOAD: Mundo - IV of Spades\`
- User: "play cruel summer" → \`MUSIC_DOWNLOAD: Cruel Summer - Taylor Swift\`

### VIDEO SYSTEM 🎬
**Triggers**: "video", "watch", "show me", "panoorin", "palabas"

**Command Format**:
\`VIDEO_DOWNLOAD: <Search Query>\`

**Examples**:
- User: "show me funny cat videos" → \`VIDEO_DOWNLOAD: funny cat compilation\`
- User: "nero video BTS" → \`VIDEO_DOWNLOAD: BTS music video\`

### NICKNAME SYSTEM 🎭
**Triggers**: "change my name", "call me", "nickname", "rename", "pangalan"

**CRITICAL**: Always use REAL user IDs from the group directory!

**Single Change**:
\`NICKNAME_CHANGE: <UserID> | <NewNickname>\`

**Bulk Change** (change multiple):
\`NICKNAME_BULK: <ID1>|<Name1> || <ID2>|<Name2> || ...\`

**Clear Nickname**:
\`NICKNAME_CLEAR: <UserID>\` or \`NICKNAME_CLEAR_ALL\`

**BE SPECIFIC**: Always confirm exactly what you're changing:
- ❌ DON'T say: "I'll change your name"
- ✅ DO say: "Changing your nickname to 'Boss' 🎭"
- ❌ DON'T say: "I'll give everyone anime names"
- ✅ DO say: "Renaming 5 members to: John→Naruto, Maria→Sakura, etc."

**Intelligence Required**:
- "change my name to Boss" → Use sender's ID
- "change @John's name to Johnny" → Find John's ID from directory
- "give everyone anime names" → Generate creative names for all members

### WEATHER SYSTEM 🌤️
**Triggers**: "weather", "temperature", "panahon", "forecast"

**Command Format**:
\`WEATHER_CHECK: <Location>\`

**BE SPECIFIC**: Always tell users exactly which location you're checking:
- ❌ DON'T say: "Let me check the weather for you"
- ✅ DO say: "Checking weather for Manila, Philippines 🌤️"
- ❌ DON'T say: "Looking up the forecast"
- ✅ DO say: "Getting forecast for Cebu, Philippines 🌦️"

**Intelligence Required**:
- "weather" (no location) → Ask: "Which city? (Try: nero weather Manila)"
- "is it raining in cebu?" → \`WEATHER_CHECK: Cebu, Philippines\`

### DATETIME SYSTEM 📅
**Triggers**: "time", "date", "what day", "anong oras"

**Command Format**:
\`DATETIME_CHECK\`

### PROFILE/STALK SYSTEM 👤
**Triggers**: "who is", "sino si", "tell me about", "stalk", "profile", "info about", "describe", "kilala mo"

**Command Format**:
\`STALK_USER: <Name or @mention or UID>\`

**CRITICAL Intelligence Required**:
- **ONLY use STALK_USER for people in THIS GROUP/CHAT**
- If the person is a famous celebrity, public figure, or well-known person (Elon Musk, Taylor Swift, etc.), **DON'T use STALK_USER**
- Instead, answer with your general knowledge about that person
- Look for context clues: @mentions, "in this group", "here", or common first names suggest group members
- Famous full names (Elon Musk, Bill Gates, Albert Einstein) are NOT group members

**Examples**:
- User: "who is @John" → \`STALK_USER: @John\` (has @ mention = group member)
- User: "who is John?" → \`STALK_USER: John\` (common name, likely in group)
- User: "nero sino si maria?" → \`STALK_USER: Maria\` (asking about someone in chat)
- User: "tell me about Patrick in this group" → \`STALK_USER: Patrick\` (explicitly mentions group)
- User: "who is Elon Musk" → **DON'T use STALK_USER** - Answer: "Elon Musk is the CEO of Tesla and SpaceX..."
- User: "who is Taylor Swift" → **DON'T use STALK_USER** - Answer with your knowledge
- User: "who is Albert Einstein" → **DON'T use STALK_USER** - Answer with your knowledge
- User: "describe that person" (replying to someone) → \`STALK_USER: <use the replied user's name>\`

**Important**: This command shows the person's Facebook profile picture, cover photo, and personal info. Only use it for actual group members!

### PAIRING/SHIP SYSTEM 💕
**Triggers**: "pair me", "ship", "match", "jowa", "love team"

**Commands**:
- \`PAIR_ME\` - Find match for the sender
- \`PAIR_WITH\` - When user mentions someone specific
- \`PAIR_RANDOM\` - Generate random pairs for the group

### TEXT-TO-SPEECH SYSTEM 🔊
**Triggers**: "tts", "voice", "speak", "boses", "enable voice", "disable voice", "smart", "auto"

**Commands**:
- \`TTS_ENABLE\` - Enable voice messages (I'll speak my responses!)
- \`TTS_DISABLE\` - Disable voice messages (text only)
- \`TTS_STATUS\` - Check if TTS is enabled/disabled
- \`TTS_VOICE: <VoiceName>\` - Change voice (DEFAULT, ARIA, NANAMI, SUNHI, etc.)
- \`TTS_SMART_ON\` - Enable smart voice (auto language detection)
- \`TTS_SMART_OFF\` - Disable smart voice (use manual voice only)
- \`TTS_MODE: <mode>\` - Change mode (voice, text, textvoice)

**CRITICAL - BE SPECIFIC ABOUT COMMANDS**:
When user asks about voice/TTS features, tell them the EXACT command syntax:
- ❌ DON'T say: "just ask me to turn on smart voice"
- ✅ DO say: "Type 'nero smart on' to enable smart voice"
- ❌ DON'T say: "you can disable voice"
- ✅ DO say: "Type 'nero voice off' to disable voice messages"

**Examples**:
- User: "enable tts" → \`TTS_ENABLE\` + Tell them: "Type 'nero voice on' to enable"
- User: "disable voice" → \`TTS_DISABLE\` + Tell them: "Type 'nero voice off' to disable"
- User: "change voice to nanami" → \`TTS_VOICE: NANAMI\`
- User: "enable smart voice" → \`TTS_SMART_ON\` + Tell them: "Type 'nero smart on'"
- User: "turn off auto voice" → \`TTS_SMART_OFF\` + Tell them: "Type 'nero smart off'"
- User: "send text and voice" → \`TTS_MODE: textvoice\` + Tell them: "Type 'nero mode textvoice'"

### REMINDER SYSTEM ⏰
**Triggers**: "remind me", "reminder", "paalala", "set alarm", "notify me"

**Commands**:
- \`REMINDER_SET: <what> <when>\` - Set a new reminder
- \`REMINDER_LIST\` - Show all active reminders
- \`REMINDER_CLEAR\` - Clear all reminders

**BE SPECIFIC**: Always confirm exactly what reminder you're setting:
- ❌ DON'T say: "I'll remind you"
- ✅ DO say: "Reminder set: 'Meeting' at 2:30 PM today ⏰"
- ❌ DON'T say: "Reminder created"
- ✅ DO say: "I'll remind you to call mom tomorrow at 5 PM 📱"

**Time Formats Supported**:
- "2:30pm today" or "2:30pm tomorrow"
- "in 30 minutes" or "in 2 hours"
- "5pm" (assumes today if not passed, tomorrow if already passed)

**Examples**:
- User: "remind me meeting 2:30pm today" → \`REMINDER_SET: meeting 2:30pm today\`
- User: "nero paalala ko mag workout in 1 hour" → \`REMINDER_SET: mag workout in 1 hour\`
- User: "remind me to call mom 5pm tomorrow" → \`REMINDER_SET: call mom 5pm tomorrow\`
- User: "remind me homework in 30 minutes" → \`REMINDER_SET: homework in 30 minutes\`
- User: "show my reminders" → \`REMINDER_LIST\`
- User: "clear all my reminders" → \`REMINDER_CLEAR\`

**How It Works**:
1. User sets a reminder with a message and time
2. I send a heads-up notification 15 minutes BEFORE the time
3. I send the main reminder notification AT the exact time
4. Both notifications will @mention the user so they get notified!

## 🚨 EXECUTION RULES

1. **CLEAN OUTPUT**: When executing commands, output ONLY the command string
   - ❌ "Sure! Here's your song: MUSIC_DOWNLOAD: ..."
   - ✅ \`MUSIC_DOWNLOAD: Cruel Summer - Taylor Swift\`

2. **SMART INFERENCE**: Don't ask for clarification on obvious requests
   - User: "nero play ariana" → Pick popular Ariana Grande song, don't ask "which song?"

3. **CONTEXT AWARENESS**: Use conversation history to understand follow-ups
   - If user just discussed a topic, use that context

4. **ERROR PREVENTION**: Validate inputs before executing
   - Check if mentioned users exist in group
   - Verify locations are valid for weather

5. **COMMAND PRECISION**: Always use exact command syntax
   - ❌ "nero smart voice off" is WRONG
   - ✅ "nero smart off" is CORRECT
   - If user uses wrong syntax, execute their intent but gently correct them`;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build the complete AI prompt with all context
 * @param {Object} params - Prompt parameters
 * @param {Object} params.api - Facebook API instance
 * @param {Object} params.event - Message event
 * @param {string} params.text - User's message text
 * @param {string} params.userName - User's display name
 * @param {string} params.threadID - Thread identifier
 * @param {string} params.senderID - Sender's user ID
 * @param {Array} params.images - Array of image data
 * @returns {Promise<string>} Complete formatted prompt
 */
async function buildPrompt({ api, event, text, userName, threadID, senderID, images }) {
    // Extract replied message info if present
    let repliedMessage = null;
    if (event?.messageReply) {
        const replySenderName = await users.getName(api, event.messageReply.senderID, event);
        repliedMessage = {
            senderName: replySenderName,
            senderID: event.messageReply.senderID,
            text: event.messageReply.body || "(no text)",
            attachments: event.messageReply.attachments?.length || 0
        };
    }

    // Gather all contextual data in parallel
    const [groupContext, conversationContext, scheduleContext, userContext, senderProfile] = await Promise.all([
        getGroupContext(api, threadID),
        getConversationContext(threadID),
        Promise.resolve(buildScheduleContext()),
        Promise.resolve(getUserPersonalization(senderID)),
        getSenderProfile(api, senderID),
    ]);

    const { membersList, allMembers } = groupContext;
    
    // Analyze the incoming message
    const messageAnalysis = analyzeMessage(text, userName, images);
    
    // Learn from this interaction (update preferences)
    learnFromInteraction(senderID, messageAnalysis);
    
    // Get file context for this thread
    const fileContext = fileAnalysis.getFormattedFileContext(threadID);
    
    // Build the complete prompt
    const promptSections = [
        SYSTEM_CORE,
        COMMAND_SPECIFICITY,
        COMMAND_SYSTEM,
        scheduleContext,
        buildGroupDirectory(membersList, senderID, allMembers),
        buildSenderProfileSection(senderProfile, userName, senderID),
        buildUserPersonalizationSection(userContext, userName),
        fileContext, // Include uploaded file contents
        buildConversationHistory(conversationContext, userName),
        buildCurrentMessage(text, userName, messageAnalysis, images, repliedMessage),
    ];

    return promptSections.filter(Boolean).join("\n\n");
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT GATHERING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get group members context for commands
 * @param {Object} api - Facebook API instance
 * @param {string} threadID - Thread identifier
 * @returns {Promise<{membersList: string, allMembers: Map}>}
 */
async function getGroupContext(api, threadID) {
    let membersList = "";
    let allMembers = new Map();

    try {
        allMembers = await users.getAllGroupMembers(api, threadID);

        if (allMembers.size > 0) {
            membersList = Array.from(allMembers.entries())
                .map(([id, name]) => `• ${name} (ID: ${id})`)
                .join("\n");
        }
    } catch {
        // Silent fail - group context is optional
    }

    return { membersList, allMembers };
}

/**
 * Get formatted conversation history
 * @param {string} threadID - Thread identifier
 * @returns {Promise<string>} Formatted history
 */
async function getConversationContext(threadID) {
    return memory.getFormattedHistory(threadID, MEMORY_CONFIG.contextWindow);
}

/**
 * Get user personalization data
 * @param {string} senderID - Sender's user ID
 * @returns {Object|null} User preferences
 */
function getUserPersonalization(senderID) {
    return memory.getUserPreference(senderID);
}

/**
 * Learn from user interaction and update preferences
 * @param {string} senderID - User ID
 * @param {Object} analysis - Message analysis
 */
function learnFromInteraction(senderID, analysis) {
    const data = {};
    
    // Learn language preference
    if (analysis.language !== "english") {
        data.language = analysis.language;
    }
    
    // Learn from intents (topics of interest)
    if (analysis.intents.length > 0) {
        data.topic = analysis.intents[0]; // Primary intent
    }
    
    // Learn communication style from tone
    if (analysis.tone === "playful") {
        data.style = "casual";
    } else if (analysis.tone === "neutral" && analysis.messageLength > 100) {
        data.style = "detailed";
    }
    
    if (Object.keys(data).length > 0) {
        memory.updateUserPreference(senderID, data);
    }
}

/**
 * Build user personalization section for prompt
 * @param {Object|null} prefs - User preferences
 * @param {string} userName - User's name
 * @returns {string} Personalization section
 */
function buildUserPersonalizationSection(prefs, userName) {
    if (!prefs) {
        return "";
    }
    
    const sections = [`## 👤 USER PROFILE: ${userName}`];
    
    if (prefs.favoriteTopics?.length > 0) {
        sections.push(`**Interests**: ${prefs.favoriteTopics.slice(-5).join(", ")}`);
    }
    
    if (prefs.musicPrefs?.artists?.length > 0) {
        sections.push(`**Favorite Artists**: ${prefs.musicPrefs.artists.slice(-3).join(", ")}`);
    }
    
    if (prefs.musicPrefs?.genres?.length > 0) {
        sections.push(`**Music Genres**: ${prefs.musicPrefs.genres.join(", ")}`);
    }
    
    sections.push(`**Preferred Language**: ${prefs.preferredLanguage || "english"}`);
    sections.push(`**Communication Style**: ${prefs.communicationStyle || "casual"}`);
    
    sections.push("\n💡 **Personalization Hint**: Use this info to make responses more relevant!");
    
    return sections.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════════
// SENDER PROFILE DATA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch the sender's full profile information
 * @param {Object} api - Facebook API instance
 * @param {string} senderID - Sender's user ID
 * @returns {Promise<Object|null>} Profile data or null
 */
async function getSenderProfile(api, senderID) {
    try {
        // Use callback-based getUserInfo with extended=true for full profile data
        const userInfo = await new Promise((resolve, reject) => {
            api.getUserInfo(senderID, true, (err, data) => {
                if (err) {
                    console.log(`[Profile] Error fetching: ${err.message}`);
                    reject(err);
                } else {
                    console.log(`[Profile] Raw data keys: ${data ? Object.keys(data).join(", ") : "null"}`);
                    resolve(data);
                }
            });
        });
        
        if (userInfo) {
            console.log(`[Profile] Gender: ${userInfo.gender || "not set"}, Name: ${userInfo.name || "not set"}`);
            return userInfo;
        }
    } catch (err) {
        console.log(`[Profile] Fetch failed: ${err.message}`);
        // Silent fail - profile is optional
    }
    return null;
}

/**
 * Format gender value to human readable string
 * @param {string} gender - Gender value from API
 * @returns {string} Formatted gender
 */
function formatGender(gender) {
    if (!gender) return "Not specified";
    const g = gender.toLowerCase();
    if (g === "male" || g === "male_singular" || g === "2") return "Male";
    if (g === "female" || g === "female_singular" || g === "1") return "Female";
    return gender; // Return as-is if not recognized
}

/**
 * Build sender profile section for prompt
 * @param {Object|null} profile - Profile data from API
 * @param {string} userName - User's display name
 * @param {string} senderID - User's ID
 * @returns {string} Profile section
 */
function buildSenderProfileSection(profile, userName, senderID) {
    const sections = [`## 📋 YOUR PROFILE INFO (About the person talking to you)`];
    
    // Basic info that's always available
    sections.push(`**Name**: ${userName}`);
    sections.push(`**User ID**: ${senderID}`);
    
    if (!profile) {
        sections.push(`\n*Additional profile info not available*`);
        return sections.join("\n");
    }
    
    // Gender - using correct field name
    if (profile.gender) {
        sections.push(`**Gender**: ${formatGender(profile.gender)}`);
    }
    
    // Username/Vanity URL - correct field name
    if (profile.vanity) {
        sections.push(`**Username**: @${profile.vanity}`);
        sections.push(`**Profile URL**: facebook.com/${profile.vanity}`);
    } else {
        sections.push(`**Profile URL**: facebook.com/${senderID}`);
    }
    
    // Bio - correct field name
    if (profile.bio) {
        sections.push(`**Bio**: ${profile.bio}`);
    }
    
    // Headline
    if (profile.headline) {
        sections.push(`**Headline**: ${profile.headline}`);
    }
    
    // Birthday check
    if (profile.isBirthday) {
        sections.push(`**Birthday**: Today! 🎂`);
    }
    
    // Location - correct field name (live_city)
    if (profile.live_city) {
        sections.push(`**Location**: ${profile.live_city}`);
    }
    
    // Follower count
    if (profile.followers) {
        sections.push(`**Followers**: ${Number(profile.followers).toLocaleString()}`);
    }
    
    // Following count
    if (profile.following) {
        sections.push(`**Following**: ${Number(profile.following).toLocaleString()}`);
    }
    
    // Verified status
    if (profile.isVerified) {
        sections.push(`**Verified**: ✓ Yes`);
    }
    
    // Friend status
    if (profile.isFriend) {
        sections.push(`**Friend Status**: You are friends with the bot account`);
    }
    
    sections.push(`\n💡 **Use this info** when the user asks about themselves (e.g., "what's my gender?", "what's my username?", "when is my birthday?")`);
    
    return sections.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Analyze the incoming message for intent signals
 * @param {string} text - Message text
 * @param {string} userName - User's name
 * @param {Array} images - Attached images
 * @returns {Object} Analysis results
 */
function analyzeMessage(text, userName, images) {
    const lowerText = text.toLowerCase();
    
    // Detect primary intent
    const intents = detectIntents(lowerText);
    
    // Detect emotional tone
    const tone = detectTone(lowerText);
    
    // Detect language
    const language = detectLanguage(text);
    
    // Check for urgency
    const isUrgent = /\b(asap|urgent|now|quick|hurry|please help)\b/i.test(text);
    
    // Check for questions
    const isQuestion = /\?$|\b(what|why|how|when|where|who|ano|bakit|paano|kailan|saan|sino)\b/i.test(text);
    
    return {
        intents,
        tone,
        language,
        isUrgent,
        isQuestion,
        hasImages: images.length > 0,
        messageLength: text.length,
    };
}

/**
 * Detect message intents based on keywords
 * @param {string} text - Lowercase message text
 * @returns {Array<string>} Detected intents
 */
function detectIntents(text) {
    const detected = [];
    
    for (const [intent, keywords] of Object.entries(AI_REASONING.intents)) {
        if (keywords.some(kw => text.includes(kw))) {
            detected.push(intent);
        }
    }
    
    return detected;
}

/**
 * Detect emotional tone of message
 * @param {string} text - Lowercase message text
 * @returns {string} Detected tone
 */
function detectTone(text) {
    if (/😂|🤣|haha|lol|lmao|charot|joke/i.test(text)) return "playful";
    if (/😢|😭|sad|lungkot|malungkot|miss/i.test(text)) return "sad";
    if (/😡|🤬|angry|galit|badtrip|ugh/i.test(text)) return "frustrated";
    if (/❤️|🥰|love|mahal|sweet/i.test(text)) return "affectionate";
    if (/\?{2,}|help|please|pls/i.test(text)) return "seeking_help";
    if (/!{2,}|wow|omg|grabe/i.test(text)) return "excited";
    return "neutral";
}

/**
 * Detect primary language
 * @param {string} text - Original message text
 * @returns {string} Detected language
 */
function detectLanguage(text) {
    const tagalogWords = /\b(ako|ikaw|siya|kami|tayo|sila|ng|sa|ang|mga|na|po|opo|ano|bakit|paano|hindi|oo|yung|naman|talaga|grabe|sige|salamat)\b/i;
    const hasTagalog = tagalogWords.test(text);
    const hasEnglish = /\b(the|is|are|was|were|have|has|do|does|did|will|would|can|could|should)\b/i.test(text);
    
    if (hasTagalog && hasEnglish) return "taglish";
    if (hasTagalog) return "tagalog";
    return "english";
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPT SECTION BUILDERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build group directory section
 * @param {string} membersList - Formatted members list
 * @param {string} senderID - Current sender's ID
 * @param {Map} allMembers - All group members
 * @returns {string} Group directory section
 */
function buildGroupDirectory(membersList, senderID, allMembers) {
    if (!membersList || allMembers.size === 0) {
        return "";
    }

    const senderName = allMembers.get(senderID) || "Unknown";

    return `## 👥 GROUP DIRECTORY

**Current Sender**: ${senderName} (ID: ${senderID})
**Total Members**: ${allMembers.size}

**Member List** (use these REAL IDs for nickname commands):
${membersList}

⚠️ **IMPORTANT**: For nickname commands, ONLY use IDs from this list. Never generate fake IDs.`;
}

/**
 * Build conversation history section
 * @param {string} history - Formatted conversation history
 * @param {string} userName - Current user's name
 * @returns {string} History section
 */
function buildConversationHistory(history, userName) {
    if (!history || history.trim() === "") {
        return `## 📜 CONVERSATION HISTORY

*This is the start of the conversation with ${userName}.*`;
    }

    return `## 📜 CONVERSATION HISTORY

Recent interactions (for context awareness):
${history}`;
}

/**
 * Build current message section with analysis
 * @param {string} text - User's message
 * @param {string} userName - User's name
 * @param {Object} analysis - Message analysis results
 * @param {Array} images - Attached images
 * @param {Object} repliedMessage - Replied message info (if any)
 * @returns {string} Current message section
 */
function buildCurrentMessage(text, userName, analysis, images, repliedMessage = null) {
    const imageNote = analysis.hasImages 
        ? `\n📷 **Attached**: ${images.length} image(s) - Analyze visual content carefully!`
        : "";
    
    const intentHint = analysis.intents.length > 0
        ? `\n🎯 **Detected Intents**: ${analysis.intents.join(", ")}`
        : "";
    
    const toneHint = analysis.tone !== "neutral"
        ? `\n💭 **Tone**: ${analysis.tone}`
        : "";
    
    const languageHint = `\n🗣️ **Language**: ${analysis.language}`;
    
    const urgencyNote = analysis.isUrgent
        ? `\n⚡ **Priority**: User seems to need quick response!`
        : "";

    // Include replied message context if present
    const replyContext = repliedMessage
        ? `\n\n📨 **Replying To**: ${repliedMessage.senderName} said:\n"${repliedMessage.text}"${repliedMessage.attachments > 0 ? ` (+ ${repliedMessage.attachments} attachment(s))` : ""}`
        : "";

    return `## 🔴 INCOMING MESSAGE

**From**: ${userName}
**Message**: "${text}"${replyContext}
${imageNote}${intentHint}${toneHint}${languageHint}${urgencyNote}

---

## YOUR TASK

Using Chain-of-Thought reasoning:
1. **Understand** what ${userName} wants${repliedMessage ? " (consider the replied message context)" : ""}
2. **Decide** if this requires a COMMAND or a RESPONSE
3. **Execute** appropriately:
   - If COMMAND needed → Output ONLY the command string
   - If RESPONSE needed → Reply naturally and helpfully

**Remember**: Match their language (${analysis.language}) and energy (${analysis.tone}).

**Your Response**:`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    buildPrompt,
    analyzeMessage,
    detectIntents,
    detectTone,
    detectLanguage,
};
