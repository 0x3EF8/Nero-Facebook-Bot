/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                          BETA AI EVENT HANDLER                                ║
 * ║              Neural Core Engine v4.0 - Intelligence Upgrade                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * Context-aware AI chatbot powered by Google Gemini 2.5-Flash.
 * Features: Chain-of-thought reasoning, intent classification, smart commands.
 *
 * @module events/AI/beta
 * @author 0x3EF8
 * @version 4.0.0
 * @license MIT
 */

"use strict";

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORTS
// ═══════════════════════════════════════════════════════════════════════════════

const { gemini } = require("./core/gemini");
const { memory } = require("./core/memory");
const { users } = require("./core/users");
const {
    AI_IDENTITY,
    MESSAGES,
    REACTIONS,
    MEDIA_CONFIG,
} = require("./core/constants");

// Services
require("./services/music");
require("./services/video");
require("./services/weather");
const tts = require("./services/tts");
const reminder = require("./services/reminder");
const fileAnalysis = require("./services/fileAnalysis");

// Handlers
const { handleCommands } = require("./handlers/commands");
const { buildPrompt, analyzeMessage } = require("./handlers/prompt");

// Utilities
const { downloadImageAsBase64 } = require("./utils/images");
const { applyNeroFont, setEnabled: setFontEnabled, isEnabled: isFontEnabled } = require("./utils/fonts");
const {
    buildMainMenu,
    buildQuickMenu,
    buildCategoryMenu,
    buildStatusOverview,
    buildAboutPage,
    buildExamplesPage,
} = require("./utils/commandMenu");

// Config
const config = require("../../../../config/config");

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

module.exports.config = {
    name: "betaAI",
    description: `${AI_IDENTITY.name} v${AI_IDENTITY.version} - Intelligent AI with Chain-of-Thought Reasoning`,
    eventTypes: ["message", "message_reply"],
    priority: 100,
    enabled: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// REMINDER SYSTEM INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

let reminderStarted = false;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EVENT HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Main event handler for Beta AI
 * @param {Object} context - Event context
 * @param {Object} context.api - Facebook API instance
 * @param {Object} context.event - Message event object
 * @param {Object} context.logger - Logger instance
 * @returns {Promise<void>}
 */
module.exports.execute = async function ({ api, event, logger }) {
    // Start reminder checker on first execute (ensures api is available)
    if (!reminderStarted) {
        reminder.startReminderChecker(api);
        reminderStarted = true;
    }

    const { threadID, senderID, body: text, messageID } = event;

    // ─────────────────────────────────────────────────────────────────────────
    // INPUT VALIDATION
    // ─────────────────────────────────────────────────────────────────────────

    if (!text || typeof text !== "string") {
        return;
    }

    const botID = api.getCurrentUserID?.() || config.botID;
    if (senderID === botID) {
        return;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTIVATION CHECK
    // ─────────────────────────────────────────────────────────────────────────

    const isMentioned = AI_IDENTITY.triggerPatterns.some((pattern) => pattern.test(text));
    const isReplyToBeta =
        event.type === "message_reply" &&
        memory.isBetaMessage(event.messageReply?.messageID);

    if (!isMentioned && !isReplyToBeta) {
        return;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEXT PREPROCESSING
    // ─────────────────────────────────────────────────────────────────────────

    let cleanText = text;
    for (const pattern of AI_IDENTITY.triggerPatterns) {
        cleanText = cleanText.replace(new RegExp(pattern, "gi"), "").trim();
    }

    if (!cleanText) {
        return api.sendMessage(MESSAGES.greeting, threadID, null, messageID);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HELP & MENU COMMANDS (handle first for immediate response)
    // NOTE: These return early and bypass TTS - text-only responses
    // ─────────────────────────────────────────────────────────────────────────

    const lowerText = cleanText.toLowerCase();

    // Main help command - TEXT ONLY (no TTS)
    if (lowerText === "help" || lowerText === "commands" || lowerText === "command list" || lowerText === "cmd" || lowerText === "tulong") {
        setReaction(api, messageID, REACTIONS.success);
        return api.sendMessage(buildMainMenu(), threadID, messageID);
    }

    // Quick menu command
    if (lowerText === "menu" || lowerText === "quick" || lowerText === "quick menu" || lowerText === "quick help") {
        setReaction(api, messageID, REACTIONS.success);
        return api.sendMessage(buildQuickMenu(), threadID, messageID);
    }

    // Category-specific help
    const menuMatch = lowerText.match(/(?:menu|help)\s+(\w+)/i);
    if (menuMatch) {
        const category = menuMatch[1];
        const categoryMenu = buildCategoryMenu(category);
        if (categoryMenu) {
            setReaction(api, messageID, REACTIONS.success);
            return api.sendMessage(categoryMenu, threadID, messageID);
        }
    }

    // About command
    if (lowerText === "about" || lowerText === "info" || lowerText === "nero info" || lowerText === "about nero" || lowerText === "tungkol") {
        setReaction(api, messageID, REACTIONS.success);
        return api.sendMessage(buildAboutPage(), threadID, messageID);
    }

    // Examples command
    if (lowerText === "examples" || lowerText === "example" || lowerText === "halimbawa" || lowerText === "show examples") {
        setReaction(api, messageID, REACTIONS.success);
        return api.sendMessage(buildExamplesPage(), threadID, messageID);
    }

    // Status/Settings overview
    if (lowerText === "status" || lowerText === "settings" || lowerText === "config" || lowerText === "configuration" || lowerText === "my settings") {
        setReaction(api, messageID, REACTIONS.success);
        const statusOverview = buildStatusOverview(tts, { isEnabled: isFontEnabled });
        return api.sendMessage(statusOverview, threadID, messageID);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DIRECT TTS/VOICE COMMANDS (handle before AI for faster response)
    // ─────────────────────────────────────────────────────────────────────────

    // Voice ON command (nero voice on)
    if (lowerText === "voice on" || lowerText === "voice enable" || lowerText.includes("tts enable") || lowerText.includes("enable tts") || lowerText.includes("enable voice") || lowerText.includes("enables voice")) {
        tts.enable();
        setReaction(api, messageID, REACTIONS.success);
        const currentVoice = tts.getVoice();
        return api.sendMessage(
            `🔊 𝚅𝚘𝚒𝚌𝚎 𝙴𝚗𝚊𝚋𝚕𝚎𝚍!

✅ TTS is now ON globally
🎤 Current Voice: ${currentVoice.shortcut} (${currentVoice.description})
🌍 Language: ${currentVoice.language}

💡 𝐐𝐔𝐈𝐂𝐊 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒:
• voice off - Disable voice
• voice <name> - Change voice
• voices - List all 35+ voices
• smart on - Auto language detection
• mode voice/text/textvoice - Set output mode

📖 Type 'nero menu voice' for full voice guide`,
            threadID,
            messageID
        );
    }

    // Voice OFF command (nero voice off)
    if (lowerText === "voice off" || lowerText === "voice disable" || lowerText.includes("tts disable") || lowerText.includes("disable tts") || lowerText.includes("disable voice") || lowerText.includes("disables voice")) {
        tts.disable();
        setReaction(api, messageID, REACTIONS.success);
        return api.sendMessage(
            `🔇 𝚅𝚘𝚒𝚌𝚎 𝙳𝚒𝚜𝚊𝚋𝚕𝚎𝚍!

✅ Text-only mode activated

💡 𝐐𝐔𝐈𝐂𝐊 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒:
• voice on - Enable voice again
• mode text - Confirm text-only mode
• mode textvoice - Enable text + voice

📖 Type 'nero help' for all commands`,
            threadID,
            messageID
        );
    }

    // Voice Status command (nero voice status / nero voice)
    if (lowerText === "voice" || lowerText === "voice status" || lowerText.includes("tts status")) {
        const status = tts.getStatus();
        const voiceInfo = tts.getVoice();
        const modeEmoji = status.mode === "voice" ? "🔊" : status.mode === "text" ? "📝" : "🔊📝";
        const modeDesc = status.mode === "voice" ? "Voice Only" : status.mode === "text" ? "Text Only" : "Both (Text + Voice)";
        const smartStatus = status.smartVoice ? "✅ ON (Auto-detect language)" : "❌ OFF (Manual voice)";
        setReaction(api, messageID, REACTIONS.success);
        return api.sendMessage(
            `🎤 𝚅𝚘𝚒𝚌𝚎 𝚂𝚝𝚊𝚝𝚞𝚜

🔊 Status: ${status.enabled ? "✅ ON" : "❌ OFF"}
${modeEmoji} Mode: ${modeDesc}
🧠 Smart Voice: ${smartStatus}
🗣️ Voice: ${voiceInfo.shortcut}
📝 Description: ${voiceInfo.description}
🌍 Language: ${voiceInfo.language}
⚡ Rate: ${status.rate}
🎵 Pitch: ${status.pitch}

💡 QUICK COMMANDS:
• voice on/off - Toggle voice
• smart on/off - Auto language detection
• voice <name> - Change voice
• voices - List all 35+ voices
• mode voice/text/textvoice - Output mode

📖 Type 'nero menu voice' for detailed guide`,
            threadID,
            messageID
        );
    }

    // Voice List command (nero voices)
    if (lowerText === "voices" || lowerText === "voice list" || lowerText === "list voice" || lowerText === "list voices" || lowerText === "available voices" || lowerText === "all voices" || lowerText === "show voices" || lowerText.includes("tts voices") || lowerText.includes("what voices") || lowerText.includes("which voices")) {
        const voiceList = tts.getVoiceListFormatted();
        setReaction(api, messageID, REACTIONS.success);
        return api.sendMessage(voiceList, threadID, null, messageID);
    }

    // Voice Change Command (nero voice nanami)
    const voiceMatch = lowerText.match(/^voice\s+(\w+)$/i) || lowerText.match(/(?:tts\s+voice|change\s+voice|set\s+voice)\s+(\w+)/i);
    if (voiceMatch) {
        const voiceName = voiceMatch[1];
        // Skip if it's a command keyword (these are handled by other commands)
        if (["on", "off", "enable", "disable", "status", "list", "only", "and"].includes(voiceName.toLowerCase())) {
            // Already handled above or will be handled by mode commands below
        } else {
            const result = tts.setVoice(voiceName);
            setReaction(api, messageID, result.success ? REACTIONS.success : REACTIONS.error);
            
            if (result.success) {
                return api.sendMessage(
                    `🎤 𝚅𝚘𝚒𝚌𝚎 𝙲𝚑𝚊𝚗𝚐𝚎𝚍!

✅ Voice: ${result.voice}
🔊 Full Name: ${result.fullName}
📝 Description: ${result.description}
🌍 Language: ${result.language}

💡 𝐓𝐑𝐘 𝐈𝐓 𝐍𝐎𝐖:
Say something and I'll speak with my new voice!

📖 Commands:
• voices - See all 35+ available voices
• smart on - Enable auto language detection
• mode voice - Voice only (no text)`,
                    threadID,
                    messageID
                );
            } else {
                return api.sendMessage(
                    `❌ 𝚅𝚘𝚒𝚌𝚎 𝙽𝚘𝚝 𝙵𝚘𝚞𝚗𝚍: "${voiceName}"

💡 𝐀𝐕𝐀𝐈𝐋𝐀𝐁𝐋𝐄 𝐕𝐎𝐈𝐂𝐄𝐒:
Type 'nero voices' to see all options

📝 𝐄𝐗𝐀𝐌𝐏𝐋𝐄𝐒:
• nero voice nanami (Japanese)
• nero voice aria (English)
• nero voice blessica (Filipino)

📖 Type 'nero menu voice' for voice guide`,
                    threadID,
                    messageID
                );
            }
        }
    }

    // TTS Rate Command
    const rateMatch = lowerText.match(/(?:tts\s+rate|voice\s+rate|speech\s+rate)\s+(\w+)/i);
    if (rateMatch) {
        const rate = rateMatch[1];
        tts.setRate(rate);
        setReaction(api, messageID, REACTIONS.success);
        return api.sendMessage(
            `⚡ Speech Rate Changed!\n\nRate: ${rate}\n\n💡 Options: fast, slow, normal, or custom like +20%`,
            threadID,
            messageID
        );
    }

    // TTS Pitch Command
    const pitchMatch = lowerText.match(/(?:tts\s+pitch|voice\s+pitch)\s+(\w+)/i);
    if (pitchMatch) {
        const pitch = pitchMatch[1];
        tts.setPitch(pitch);
        setReaction(api, messageID, REACTIONS.success);
        return api.sendMessage(
            `🎵 Voice Pitch Changed!\n\nPitch: ${pitch}\n\n💡 Options: high, low, normal, or custom like +10Hz`,
            threadID,
            messageID
        );
    }

    // Mode Commands (voice only, text only, both)
    const modeMatch = lowerText.match(/^mode\s+(\w+)$/i) || lowerText.match(/(?:tts\s+mode|voice\s+mode|set\s+mode|output\s+mode)\s+(\w+)/i);
    if (modeMatch) {
        const mode = modeMatch[1];
        const result = tts.setMode(mode);
        setReaction(api, messageID, result.success ? REACTIONS.success : REACTIONS.error);
        
        if (result.success) {
            const modeEmoji = result.mode === "voice" ? "🔊" : result.mode === "text" ? "📝" : "🔊📝";
            return api.sendMessage(
                `${modeEmoji} 𝙼𝚘𝚍𝚎 𝙲𝚑𝚊𝚗𝚐𝚎𝚍!\n\n✅ Mode: ${result.mode.toUpperCase()}\n📝 ${result.description}\n\n💡 Available modes:\n• voice - Voice only (no text)\n• text - Text only (no voice)\n• both - Text + Voice`,
                threadID,
                messageID
            );
        } else {
            return api.sendMessage(
                `❌ Invalid mode: "${mode}"\n\n💡 Available modes:\n• voice - Voice only\n• text - Text only\n• both - Text + Voice`,
                threadID,
                messageID
            );
        }
    }

    // Quick mode shortcuts
    if (lowerText === "voice only" || lowerText === "voiceonly" || lowerText.includes("only voice")) {
        tts.setMode("voice");
        if (!tts.isEnabled()) tts.enable();
        setReaction(api, messageID, REACTIONS.success);
        return api.sendMessage(
            `🔊 𝚅𝚘𝚒𝚌𝚎 𝙾𝚗𝚕𝚢 𝙼𝚘𝚍𝚎!

✅ I will now send voice messages only
❌ No text messages will be sent

💡 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒:
• mode textvoice - Enable text + voice
• mode text - Text only mode
• voice status - Check settings

📖 Type 'nero menu voice' for voice guide`,
            threadID,
            messageID
        );
    }

    if (lowerText === "text only" || lowerText === "textonly" || lowerText.includes("only text")) {
        tts.setMode("text");
        setReaction(api, messageID, REACTIONS.success);
        return api.sendMessage(
            `📝 𝚃𝚎𝚡𝚝 𝙾𝚗𝚕𝚢 𝙼𝚘𝚍𝚎!

✅ I will now send text messages only
❌ No voice messages will be sent

💡 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒:
• mode textvoice - Enable text + voice
• mode voice - Voice only mode
• voice status - Check settings

📖 Type 'nero help' for all commands`,
            threadID,
            messageID
        );
    }

    if (lowerText === "textvoice" || lowerText === "text and voice" || lowerText === "voice and text" || lowerText === "both") {
        tts.setMode("both");
        if (!tts.isEnabled()) tts.enable();
        setReaction(api, messageID, REACTIONS.success);
        return api.sendMessage(
            `🔊📝 𝚃𝚎𝚡𝚝+𝚅𝚘𝚒𝚌𝚎 𝙼𝚘𝚍𝚎!

✅ I will now send both text AND voice messages

💡 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒:
• mode voice - Voice only
• mode text - Text only
• voice status - Check settings

📖 Type 'nero menu voice' for voice guide`,
            threadID,
            messageID
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SMART VOICE COMMANDS (Auto language detection)
    // ─────────────────────────────────────────────────────────────────────────

    // Smart Voice ON
    if (lowerText === "smart on" || lowerText === "smart voice on" || lowerText === "smart enable" || lowerText === "enable smart" || lowerText === "auto voice" || lowerText === "auto voice on") {
        tts.enableSmartVoice();
        if (!tts.isEnabled()) tts.enable();
        setReaction(api, messageID, REACTIONS.success);
        return api.sendMessage(
            `🧠 𝚂𝚖𝚊𝚛𝚝 𝚅𝚘𝚒𝚌𝚎 𝙴𝚗𝚊𝚋𝚕𝚎𝚍!

✅ Auto language detection is ON
🎤 Voice will automatically match the language!

🌍 𝐒𝐔𝐏𝐏𝐎𝐑𝐓𝐄𝐃 𝐋𝐀𝐍𝐆𝐔𝐀𝐆𝐄𝐒:
🇵🇭 Filipino → Blessica
🇺🇸 English → Aria
🇯🇵 Japanese → Nanami
🇰🇷 Korean → SunHi
🇨🇳 Chinese → Xiaoxiao
...and 30+ more languages!

💡 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒:
• smart off - Use manual voice
• voice <name> - Set specific voice
• smart status - Check current mode

📖 Type 'nero menu voice' for full guide`,
            threadID,
            messageID
        );
    }

    // Smart Voice OFF
    if (lowerText === "smart off" || lowerText === "smart voice off" || lowerText === "smart disable" || lowerText === "disable smart" || lowerText === "auto voice off") {
        tts.disableSmartVoice();
        setReaction(api, messageID, REACTIONS.success);
        const voiceInfo = tts.getVoice();
        return api.sendMessage(
            `🎤 𝚂𝚖𝚊𝚛𝚝 𝚅𝚘𝚒𝚌𝚎 𝙳𝚒𝚜𝚊𝚋𝚕𝚎𝚍!\n\n❌ Auto language detection is OFF\n🗣️ Using manual voice: ${voiceInfo.shortcut}\n\n💡 Use 'voice <name>' to change voice\n💡 Use 'smart on' to enable auto-detection`,
            threadID,
            messageID
        );
    }

    // Smart Voice Status
    if (lowerText === "smart" || lowerText === "smart status" || lowerText === "smart voice" || lowerText === "smart voice status") {
        const isSmartOn = tts.isSmartVoiceEnabled();
        const languages = tts.getSupportedLanguages();
        const langList = Object.keys(languages).slice(0, 10).join(", ");
        setReaction(api, messageID, REACTIONS.success);
        return api.sendMessage(
            `🧠 𝚂𝚖𝚊𝚛𝚝 𝚅𝚘𝚒𝚌𝚎 𝚂𝚝𝚊𝚝𝚞𝚜\n\n${isSmartOn ? "✅ ENABLED - Auto language detection" : "❌ DISABLED - Manual voice"}\n\n🌍 Supported Languages (${Object.keys(languages).length}):\n${langList}...\n\n💡 Commands:\n• smart on - Enable auto-detection\n• smart off - Use manual voice\n• voice <name> - Set manual voice`,
            threadID,
            messageID
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FONT COMMANDS
    // ─────────────────────────────────────────────────────────────────────────

    // Font ON command
    if (lowerText === "font on" || lowerText === "font enable" || lowerText === "enable font" || lowerText === "fancy on" || lowerText === "fancy text on") {
        setFontEnabled(true);
        setReaction(api, messageID, REACTIONS.success);
        return api.sendMessage(
            `✨ 𝙵𝚘𝚗𝚝 𝙴𝚗𝚊𝚋𝚕𝚎𝚍!

✅ Responses will now use 𝙼𝚘𝚗𝚘𝚜𝚙𝚊𝚌𝚎 font style
🎨 Messages will look more stylish and unique!

💡 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒:
• font off - Use plain text
• font status - Check current setting
• status - View all settings

📖 Type 'nero help' for all commands`,
            threadID,
            messageID
        );
    }

    // Font OFF command
    if (lowerText === "font off" || lowerText === "font disable" || lowerText === "disable font" || lowerText === "fancy off" || lowerText === "fancy text off" || lowerText === "normal text" || lowerText === "plain text") {
        setFontEnabled(false);
        setReaction(api, messageID, REACTIONS.success);
        return api.sendMessage(
            `📝 Font Disabled!

✅ Responses will now use normal plain text
📱 Better for some devices and screen readers

💡 COMMANDS:
• font on - Enable fancy font
• font status - Check current setting
• status - View all settings

📖 Type 'nero help' for all commands`,
            threadID,
            messageID
        );
    }

    // Font status command
    if (lowerText === "font" || lowerText === "font status") {
        const fontStatus = isFontEnabled();
        setReaction(api, messageID, REACTIONS.success);
        return api.sendMessage(
            `${fontStatus ? "✨ 𝙵𝚘𝚗𝚝 𝚂𝚝𝚊𝚝𝚞𝚜" : "📝 Font Status"}

Current Setting: ${fontStatus ? "✅ Fancy Font (𝙼𝚘𝚗𝚘𝚜𝚙𝚊𝚌𝚎)" : "❌ Plain Text"}

💡 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒:
• font on - Enable fancy font
• font off - Use plain text
• status - View all settings

📖 Type 'nero help' for all commands`,
            threadID,
            messageID
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MAIN PROCESSING PIPELINE
    // ─────────────────────────────────────────────────────────────────────────

    try {
        setReaction(api, messageID, REACTIONS.thinking);
        logger.debug("BetaAI", `Processing: "${truncateText(cleanText, 50)}"`);

        // Step 1: Resolve user identity
        const userName = await users.getName(api, senderID, event);
        
        // Step 2: Extract images from message
        const images = await extractImages(event);
        
        // Step 2.5: Process file attachments
        // Set API for authenticated downloads (needed for Facebook CDN files)
        fileAnalysis.setApi(api);
        const files = await fileAnalysis.processMessageFiles(event, logger);
        if (files.length > 0) {
            for (const file of files) {
                fileAnalysis.storeFileContext(threadID, file);
                logger.info("BetaAI", `📄 File analyzed: ${file.filename} (${file.wordCount || 0} words)`);
                // Debug: show first 200 chars of content
                if (file.content) {
                    logger.debug("BetaAI", `📄 Content preview: ${file.content.substring(0, 200).replace(/\n/g, " ")}...`);
                }
            }
        }
        
        // Step 3: Pre-analyze message for better logging and memory
        const messageAnalysis = analyzeMessage(cleanText, userName, images);
        logger.debug("BetaAI", `User: ${userName} | Intents: ${messageAnalysis.intents.join(",") || "chat"} | Tone: ${messageAnalysis.tone}`);

        // Step 3.5: Update memory with intent tracking
        const primaryIntent = messageAnalysis.intents[0] || "conversation";
        memory.updateChat(threadID, userName, cleanText, primaryIntent);

        // Step 4: Build AI prompt with full context
        const prompt = await buildPrompt({
            api,
            event,
            text: cleanText,
            userName,
            threadID,
            senderID,
            images,
        });

        // Step 5: Generate AI response with retry
        setReaction(api, messageID, REACTIONS.loading);
        
        let responseText = "";
        let retries = 2;
        
        while (retries > 0) {
            const result = await gemini.generate(prompt, images);
            responseText = result?.response?.text?.() || "";
            
            if (responseText) break;
            retries--;
            
            if (retries > 0) {
                logger.debug("BetaAI", `Retrying AI generation (${retries} left)...`);
                await new Promise(resolve => { setTimeout(resolve, 1000); });
            }
        }

        if (!responseText) {
            setReaction(api, messageID, REACTIONS.error);
            return api.sendMessage(MESSAGES.noResponse, threadID, null, messageID);
        }

        // ─────────────────────────────────────────────────────────────────────
        // COMMAND DETECTION & EXECUTION
        // ─────────────────────────────────────────────────────────────────────

        // Step 6: Check if response is a command
        const commandHandled = await handleCommands({
            api,
            event,
            response: responseText,
            text: cleanText,
            threadID,
            senderID,
            userName,
            messageID,
        });

        if (commandHandled) {
            logger.debug("BetaAI", `Command executed successfully for ${userName}`);
            return;
        }

        // ─────────────────────────────────────────────────────────────────────
        // SEND REGULAR RESPONSE
        // ─────────────────────────────────────────────────────────────────────

        // Apply Nero's custom Unicode font style
        let finalResponse = applyNeroFont(responseText.trim());
        
        // Truncate response if too long (Facebook limit ~20k chars)
        const MAX_LENGTH = 19000;
        
        if (finalResponse.length > MAX_LENGTH) {
            finalResponse = finalResponse.substring(0, MAX_LENGTH) + "\n\n... (response truncated)";
        }

        // Choose reaction based on response content
        const smartReaction = getSmartReaction(finalResponse, messageAnalysis);
        setReaction(api, messageID, smartReaction);

        let sentMessage = null;

        // Check mode settings for text
        if (tts.shouldSendText()) {
            sentMessage = await api.sendMessage(
                finalResponse,
                threadID,
                messageID
            );

            // Track response for reply detection
            if (sentMessage?.messageID) {
                memory.trackBetaMessage(sentMessage.messageID);
            }
        }

        // Send voice message based on mode (voice only or both)
        if (tts.shouldSendVoice()) {
            const voiceMsg = await tts.sendVoiceMessage(api, threadID, finalResponse, senderID);
            // If voice only mode and we sent voice, track that message
            if (!sentMessage && voiceMsg?.messageID) {
                memory.trackBetaMessage(voiceMsg.messageID);
            }
        }

        // Store AI response in memory
        memory.updateChat(threadID, AI_IDENTITY.name, finalResponse, "response");
    } catch (error) {
        handleError(api, event, error, logger);
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract images from message event and replies
 * @param {Object} event - Message event
 * @returns {Promise<Array>} Array of image data objects
 */
async function extractImages(event) {
    const images = [];
    const allAttachments = [
        ...(event.attachments || []),
        ...(event.messageReply?.attachments || []),
    ];

    for (const attachment of allAttachments) {
        if (images.length >= MEDIA_CONFIG.maxImages) {
            break;
        }

        const isImage =
            attachment.type === "photo" ||
            attachment.type === "animated_image";

        if (!isImage) {
            continue;
        }

        const imageUrl =
            attachment.url ||
            attachment.largePreviewUrl ||
            attachment.previewUrl;

        if (!imageUrl) {
            continue;
        }

        const imageData = await downloadImageAsBase64(imageUrl, attachment.type);
        if (imageData) {
            images.push(imageData);
        }
    }

    return images;
}

/**
 * Set message reaction safely
 * @param {Object} api - Facebook API
 * @param {string} messageID - Message ID
 * @param {string} reaction - Reaction emoji
 */
function setReaction(api, messageID, reaction) {
    api.setMessageReaction(reaction, messageID, () => {}, true);
}

/**
 * Truncate string with ellipsis
 * @param {string} str - Input string
 * @param {number} length - Max length
 * @returns {string} Truncated string
 */
function truncateText(str, length) {
    if (!str) return "";
    return str.length > length ? `${str.substring(0, length)}...` : str;
}

/**
 * Get smart reaction based on response content and user tone
 * @param {string} response - AI response text
 * @param {Object} analysis - Message analysis object
 * @returns {string} Appropriate reaction emoji
 */
function getSmartReaction(response, analysis) {
    const lowerResponse = response.toLowerCase();
    
    // Check for humor/jokes
    if (/haha|😂|🤣|joke|funny|lol/i.test(lowerResponse)) {
        return REACTIONS.laugh;
    }
    
    // Check for love/appreciation
    if (/love|❤️|💕|mahal|sweet/i.test(lowerResponse) || analysis.tone === "affectionate") {
        return REACTIONS.love;
    }
    
    // Check for excitement
    if (/🔥|awesome|amazing|galing|grabe|wow/i.test(lowerResponse) || analysis.tone === "excited") {
        return REACTIONS.fire;
    }
    
    // Check for cool/casual
    if (/cool|nice|chill|😎/i.test(lowerResponse)) {
        return REACTIONS.cool;
    }
    
    // Default success
    return REACTIONS.success;
}

/**
 * Handle errors gracefully with appropriate user feedback
 * @param {Object} api - Facebook API
 * @param {Object} event - Message event
 * @param {Error} error - Error object
 * @param {Object} logger - Logger instance
 */
function handleError(api, event, error, logger) {
    const { threadID, messageID } = event;
    const errorMessage = error.message || String(error);

    logger.error("BetaAI", `Error: ${errorMessage}`);
    logger.debug("BetaAI", error.stack);

    setReaction(api, messageID, REACTIONS.error);

    // Determine user-friendly error message
    const isRateLimited =
        errorMessage.includes("429") ||
        errorMessage.includes("quota");

    const userMessage = isRateLimited
        ? MESSAGES.rateLimited
        : MESSAGES.error;

    api.sendMessage(userMessage, threadID, null, messageID);
}
