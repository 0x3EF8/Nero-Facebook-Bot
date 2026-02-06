/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                        PROFESSIONAL COMMAND MENU                              ║
 * ║              Comprehensive Command List & Documentation System                ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module utils/commandMenu
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const { AI_IDENTITY } = require("../core/constants");

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

const COMMANDS = {
    // Voice & Speech
    voice: {
        category: "🎤 Voice & Speech",
        commands: [
            { name: "voice on", desc: "Enable voice messages", example: "nero voice on" },
            { name: "voice off", desc: "Disable voice messages", example: "nero voice off" },
            { name: "voice <name>", desc: "Change voice (nanami, aria, blessica)", example: "nero voice nanami" },
            { name: "voices", desc: "List all 35+ available voices", example: "nero voices" },
            { name: "voice status", desc: "Check current voice settings", example: "nero voice status" },
            { name: "smart on", desc: "Enable auto language detection", example: "nero smart on" },
            { name: "smart off", desc: "Disable auto language detection", example: "nero smart off" },
            { name: "mode voice", desc: "Voice only (no text)", example: "nero mode voice" },
            { name: "mode text", desc: "Text only (no voice)", example: "nero mode text" },
            { name: "mode textvoice", desc: "Send both text and voice", example: "nero mode textvoice" },
        ]
    },

    // Media & Entertainment
    media: {
        category: "🎵 Media & Entertainment",
        commands: [
            { name: "play <song>", desc: "Download and play music", example: "nero play shape of you" },
            { name: "video <query>", desc: "Download video from YouTube", example: "nero video funny cats" },
            { name: "lyrics <song>", desc: "Get song lyrics", example: "nero lyrics despacito" },
            { name: "music by <artist>", desc: "Find music by artist", example: "nero music by taylor swift" },
        ]
    },

    // Information & Utilities
    info: {
        category: "📊 Information & Utilities",
        commands: [
            { name: "weather <location>", desc: "Check weather for any city", example: "nero weather Manila" },
            { name: "who is <name>", desc: "Look up user profile", example: "nero who is @John" },
            { name: "stalk <name>", desc: "Get detailed user info", example: "nero stalk @Mary" },
            { name: "time", desc: "Get current date and time", example: "nero what time is it" },
            { name: "remind me <time>", desc: "Set a reminder", example: "nero remind me in 30 minutes" },
        ]
    },

    // Group Management
    group: {
        category: "👥 Group Management",
        commands: [
            { name: "change my name to <name>", desc: "Change your nickname", example: "nero change my name to Boss" },
            { name: "rename <@user> to <name>", desc: "Change someone's nickname", example: "nero rename @John to Johnny" },
            { name: "clear nickname", desc: "Remove nickname", example: "nero clear my nickname" },
            { name: "pair me", desc: "Find your match", example: "nero pair me" },
            { name: "ship <@user1> <@user2>", desc: "Check compatibility", example: "nero ship @John @Mary" },
        ]
    },

    // AI Features
    ai: {
        category: "🧠 AI Features",
        commands: [
            { name: "analyze <image>", desc: "Analyze uploaded images", example: "Send image + 'nero what is this'" },
            { name: "read <file>", desc: "Read PDF/Word/Excel files", example: "Upload file + 'nero summarize this'" },
            { name: "translate <text>", desc: "Translate to any language", example: "nero translate this to Spanish" },
            { name: "explain <topic>", desc: "Get detailed explanations", example: "nero explain quantum physics" },
            { name: "help me with <task>", desc: "Get step-by-step guidance", example: "nero help me code a website" },
        ]
    },

    // Settings & Preferences
    settings: {
        category: "⚙️ Settings & Preferences",
        commands: [
            { name: "font on", desc: "Enable fancy Unicode font", example: "nero font on" },
            { name: "font off", desc: "Use normal plain text", example: "nero font off" },
            { name: "status", desc: "Check all current settings", example: "nero status" },
            { name: "reset", desc: "Reset to default settings", example: "nero reset settings" },
        ]
    },

    // General
    general: {
        category: "💬 General",
        commands: [
            { name: "help", desc: "Show this command menu", example: "nero help" },
            { name: "menu", desc: "Show quick command menu", example: "nero menu" },
            { name: "about", desc: "Learn about Nero AI", example: "nero about" },
            { name: "commands", desc: "List all commands", example: "nero commands" },
        ]
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// MENU BUILDERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build the main help menu with all commands
 * @returns {string} Formatted help menu
 */
function buildMainMenu() {
    const header = `𝐍𝐄𝐑𝐎 𝐀𝐈 - 𝐂𝐎𝐌𝐌𝐀𝐍𝐃 𝐌𝐄𝐍𝐔

📚 Comprehensive Command Reference
✨ Version ${AI_IDENTITY.version}

`;

    let menu = header;
    
    // Add category sections
    for (const [_key, section] of Object.entries(COMMANDS)) {
        menu += `\n${section.category}\n`;
        
        for (const cmd of section.commands) {
            menu += `• ${cmd.name}\n  ${cmd.desc}\n`;
        }
    }

    menu += `\n\n💡 TIPS:
• All commands start with "nero" or "@nero"
• Commands work in both English and Tagalog
• You can also just chat naturally!

📖 EXAMPLES:
• "nero play despacito"
• "nero weather New York"
• "nero change my name to Boss"

⌨️ QUICK COMMANDS:
Type "nero menu <category>" for specific help
• nero menu voice
• nero menu media
• nero menu group
• nero menu ai
• nero menu settings

🔗 More Info: github.com/0x3EF8/Nero-Facebook-Bot
`;

    return menu;
}

/**
 * Build a quick reference menu
 * @returns {string} Quick command menu
 */
function buildQuickMenu() {
    return `𝐍𝐄𝐑𝐎 - 𝐐𝐔𝐈𝐂𝐊 𝐑𝐄𝐅𝐄𝐑𝐄𝐍𝐂𝐄

🎤 VOICE
voice on/off • voices • smart on/off

🎵 MEDIA
play <song> • video <query> • lyrics <song>

📊 INFO
weather <city> • who is <name> • time

👥 GROUP
change my name • pair me • ship

🧠 AI
analyze image • read file • explain

⚙️ SETTINGS
font on/off • status • reset

📖 Type "nero help" for detailed guide
💡 Type "nero menu <category>" for specific help`;
}

/**
 * Build category-specific menu
 * @param {string} category - Category name (voice, media, info, group, ai, settings)
 * @returns {string|null} Category menu or null if not found
 */
function buildCategoryMenu(category) {
    const categoryKey = category.toLowerCase();
    const categoryMap = {
        'voice': 'voice',
        'speech': 'voice',
        'tts': 'voice',
        'media': 'media',
        'music': 'media',
        'video': 'media',
        'entertainment': 'media',
        'info': 'info',
        'information': 'info',
        'utility': 'info',
        'utils': 'info',
        'group': 'group',
        'nickname': 'group',
        'management': 'group',
        'ai': 'ai',
        'intelligence': 'ai',
        'smart': 'ai',
        'settings': 'settings',
        'config': 'settings',
        'preferences': 'settings',
        'general': 'general',
        'help': 'general',
    };

    const key = categoryMap[categoryKey];
    if (!key || !COMMANDS[key]) {
        return null;
    }

    const section = COMMANDS[key];
    let menu = `${section.category.toUpperCase()}

`;

    for (const cmd of section.commands) {
        menu += `📌 ${cmd.name}\n   ${cmd.desc}\n   💡 ${cmd.example}\n\n`;
    }

    menu += `\n📖 Type "nero help" for all commands
🔙 Type "nero menu" for quick reference`;

    return menu;
}

/**
 * Build status overview
 * @param {Object} ttsModule - TTS module reference
 * @param {Object} fontModule - Font module reference
 * @returns {string} Status overview
 */
function buildStatusOverview(ttsModule, fontModule) {
    const ttsStatus = ttsModule.getStatus();
    const voiceInfo = ttsModule.getVoice();
    const isFontEnabled = fontModule.isEnabled();
    
    const modeEmoji = ttsStatus.mode === "voice" ? "🔊" : ttsStatus.mode === "text" ? "📝" : "🔊📝";
    const modeText = ttsStatus.mode === "voice" ? "Voice Only" : ttsStatus.mode === "text" ? "Text Only" : "Both";

    // Get system info
    const os = require('os');
    const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
    const usedMem = (totalMem - freeMem).toFixed(2);
    const memUsage = ((usedMem / totalMem) * 100).toFixed(1);
    const uptime = os.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const uptimeStr = `${days}d ${hours}h ${minutes}m`;
    const platform = `${os.type()} ${os.release()}`;
    const cpus = os.cpus();
    const cpuModel = cpus[0].model;
    const cpuCores = cpus.length;
    const processUptime = process.uptime();
    const procDays = Math.floor(processUptime / 86400);
    const procHours = Math.floor((processUptime % 86400) / 3600);
    const procMinutes = Math.floor((processUptime % 3600) / 60);
    const procUptimeStr = `${procDays}d ${procHours}h ${procMinutes}m`;

    return `𝐍𝐄𝐑𝐎 - 𝐒𝐓𝐀𝐓𝐔𝐒 𝐎𝐕𝐄𝐑𝐕𝐈𝐄𝐖

🎤 VOICE SETTINGS
🔊 Status: ${ttsStatus.enabled ? "✅ ON" : "❌ OFF"}
${modeEmoji} Mode: ${modeText}
🗣️ Current Voice: ${voiceInfo.shortcut}
📝 Description: ${voiceInfo.description}
🌍 Language: ${voiceInfo.language}
🧠 Smart Voice: ${ttsStatus.smartVoice ? "✅ ON" : "❌ OFF"}
⚡ Rate: ${ttsStatus.rate}
🎵 Pitch: ${ttsStatus.pitch}

✨ DISPLAY SETTINGS
🎨 Font Style: ${isFontEnabled ? "✅ Fancy (𝙼𝚘𝚗𝚘𝚜𝚙𝚊𝚌𝚎)" : "❌ Plain Text"}

🖥️ SYSTEM INFO
💾 RAM: ${usedMem}GB / ${totalMem}GB (${memUsage}% used)
🔋 CPU: ${cpuModel.split(' ').slice(0, 3).join(' ')}
⚙️ Cores: ${cpuCores} cores
💻 OS: ${platform}
⏱️ System Uptime: ${uptimeStr}
🤖 Bot Uptime: ${procUptimeStr}
🏷️ Version: ${AI_IDENTITY.version}
🌟 Status: ✅ Online & Ready

💡 QUICK TIPS
• Type "nero help" for command list
• Type "nero menu" for quick reference
• Just chat naturally - I understand!`;
}

/**
 * Build about page
 * @returns {string} About information
 */
function buildAboutPage() {
    return `𝐀𝐁𝐎𝐔𝐓 𝐍𝐄𝐑𝐎 𝐀𝐈 🤖

🎯 WHAT IS NERO?

Nero is an advanced AI assistant powered by Google's Gemini AI, designed to help you with various tasks in your Facebook Messenger chats.

🌟 KEY FEATURES

✨ Smart Conversations
   Natural language understanding in multiple languages

🎤 Voice Messages
   Text-to-speech in 35+ languages with auto-detection

🎵 Media Downloads
   Music and videos from YouTube

🌤️ Information
   Weather, time, user profiles, and more

📄 File Analysis
   Read and analyze PDFs, Word docs, Excel files

🖼️ Image Recognition
   Analyze and describe images

👥 Group Features
   Nickname management, pairing, compatibility

🧠 AI Intelligence
   Chain-of-thought reasoning for complex queries

👨‍💻 CREATOR
Developer: ${AI_IDENTITY.author} (0x3EF8)
Version: ${AI_IDENTITY.version}
Platform: Facebook Messenger Bot

🌐 OPEN SOURCE
This project is open source!
GitHub: github.com/0x3EF8/Nero-Facebook-Bot
⭐ Star the repo if you like it!

🤝 CONTRIBUTE
Want to improve Nero? Contributions are welcome!

💡 Type "nero help" to see all commands
📖 Type "nero menu" for quick reference
🔧 Type "nero status" to check settings`;
}

/**
 * Build command examples page
 * @returns {string} Examples page
 */
function buildExamplesPage() {
    return `𝐍𝐄𝐑𝐎 - 𝐂𝐎𝐌𝐌𝐀𝐍𝐃 𝐄𝐗𝐀𝐌𝐏𝐋𝐄𝐒

🎤 VOICE EXAMPLES
• nero voice on
• nero voice nanami
• nero smart on
• nero mode textvoice

🎵 MUSIC & VIDEO
• nero play shape of you
• nero play despacito by luis fonsi
• nero video funny cats compilation
• nero lyrics perfect ed sheeran

📊 INFORMATION
• nero weather Manila
• nero weather Tokyo Japan
• nero what time is it
• nero who is @John
• nero remind me in 30 minutes

👥 GROUP COMMANDS
• nero change my name to Boss
• nero rename @Mary to Queen
• nero pair me
• nero ship @John @Mary

🧠 AI FEATURES
Send an image and say:
• nero what is this
• nero describe this image
• nero analyze this

Upload a file and say:
• nero read this document
• nero summarize this PDF
• nero what's in this file

Ask questions:
• nero explain quantum physics
• nero how do I learn Python
• nero translate this to Spanish

💬 NATURAL CHAT
You can also just chat naturally:
• nero, tell me a joke
• hey nero, how are you?
• nero kumusta ka?
• nero what's the weather like?

💡 Pro Tips:
• Commands work in English & Tagalog
• Mix languages freely (Taglish)
• Reply to Nero's messages to continue context
• Say "nero" or tag @nero to activate

📖 Type "nero help" for full command list`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    buildMainMenu,
    buildQuickMenu,
    buildCategoryMenu,
    buildStatusOverview,
    buildAboutPage,
    buildExamplesPage,
    COMMANDS,
};
