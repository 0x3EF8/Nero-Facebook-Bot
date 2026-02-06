# Nero Beta AI - Exact Command Syntax Guide

## 🚨 IMPORTANT: Command Accuracy

Nero requires EXACT command syntax to work properly. Commands must be precise - no variations allowed.

---

## 📋 Common Command Mistakes

### ❌ WRONG → ✅ CORRECT

**Voice Commands:**
- ❌ `nero smart voice off` → ✅ `nero smart off`
- ❌ `nero turn on voice` → ✅ `nero voice on`
- ❌ `nero disable smart voice` → ✅ `nero smart off`
- ❌ `nero voice mode` → ✅ `nero mode voice`

**Music Commands:**
- ❌ `nero download song` → ✅ `nero play <song name>`
- ❌ `nero music download` → ✅ `nero play <song name>`
- ❌ `nero play music` → ✅ `nero play <specific song>`

**Help Commands:**
- ❌ `nero show help` → ✅ `nero help`
- ❌ `nero command list` → ✅ `nero menu`
- ❌ `nero bot status` → ✅ `nero status`

---

## 🎤 Voice & Speech Commands (EXACT SYNTAX)

```
nero voice on          ← Enable voice messages
nero voice off         ← Disable voice messages
nero voice <name>      ← Change voice (e.g., nero voice nanami)
nero voices            ← List all available voices
nero voice status      ← Check current voice settings

nero smart on          ← Enable auto language detection
nero smart off         ← Disable auto language detection

nero mode voice        ← Voice only (no text)
nero mode text         ← Text only (no voice)
nero mode textvoice    ← Send both text and voice
```

---

## 🎵 Media Commands (EXACT SYNTAX)

```
nero play <song>       ← Download and play music
nero video <query>     ← Download video from YouTube
nero lyrics <song>     ← Get song lyrics
```

---

## ℹ️ Information Commands (EXACT SYNTAX)

```
nero help              ← Show help menu
nero menu              ← Show all commands
nero menu voice        ← Show voice category commands
nero menu media        ← Show media category commands
nero status            ← Show system status
nero about             ← About Nero
nero examples          ← Usage examples
```

---

## 👥 User Commands (EXACT SYNTAX)

```
nero who is @user      ← Get user profile/info
nero pair me           ← Find a match for yourself
nero ship              ← Random ship two people
```

---

## 🛠️ Utility Commands (EXACT SYNTAX)

```
nero weather <city>    ← Check weather
nero time              ← Get current time
nero date              ← Get current date
nero qr <text>         ← Generate QR code
```

---

## ⚙️ Settings Commands (EXACT SYNTAX)

```
nero setprefix <char>  ← Change command prefix (admin only)
nero maintenance on    ← Enable maintenance mode (admin only)
nero maintenance off   ← Disable maintenance mode (admin only)
```

---

## 💡 Tips for Accurate Commands

1. **Always use "nero" prefix** (unless custom prefix is set)
2. **Use exact command words** - "voice on" not "turn on voice"
3. **Use lowercase** - commands are case-insensitive but lowercase is standard
4. **Check spelling** - "voices" not "voice list"
5. **Use spaces correctly** - "nero voice on" not "nero voiceon"

---

## 🤖 AI Natural Language

While commands require exact syntax, you can still talk naturally to Nero for conversations:

✅ **Natural conversation works fine:**
- "nero who is elon musk?" 
- "nero tell me a joke"
- "nero what's the weather like?"
- "nero can you help me?"

❌ **But feature commands need exact syntax:**
- Use `nero voice on` not "nero turn on voice"
- Use `nero smart off` not "nero disable smart voice"

---

## 📝 How Nero Helps You

When you use wrong command syntax, Nero will:
1. **Execute your intent** (if understood)
2. **Gently correct you** with the proper syntax

Example:
```
You: "nero smart voice off"
Nero: "Smart voice disabled ❌ (Correct command: 'nero smart off')"
```

---

**Last Updated:** February 2026
**Version:** Beta v2.0
