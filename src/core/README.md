# 🚀 Nero - Facebook Messenger API

<div align="center">

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

**A clean, modular, and feature-rich Facebook Messenger API for Node.js**

[Features](#features) • [Installation](#installation) • [Quick Start](#quick-start) • [API Reference](#api-reference)

</div>

---

## 📁 Project Structure

```
nero/
├── index.js                    # Main entry point
├── package.json                # Package configuration
├── README.md                   # Documentation
│
├── src/                        # Source code
│   ├── core/                   # Core authentication & client
│   │   ├── client.js           # Main login client
│   │   └── auth/               # Authentication modules
│   │       ├── loginHelper.js  # Login orchestration
│   │       ├── buildAPI.js     # API context builder
│   │       └── setOptions.js   # Options configuration
│   │
│   ├── api/                    # API modules (organized by domain)
│   │   ├── messaging/          # Message operations
│   │   ├── threads/            # Thread/group operations
│   │   ├── users/              # User operations
│   │   ├── posting/            # Social posting (comments, stories, shares)
│   │   ├── mqtt/               # Real-time MQTT listener
│   │   ├── http/               # HTTP utilities
│   │   ├── login/              # Login-related APIs
│   │   └── extra/              # Extension modules
│   │
│   └── lib/                    # Shared libraries
│       ├── utils/              # Utility functions
│       │   ├── index.js        # Utils aggregator
│       │   ├── network.js      # HTTP/axios wrapper
│       │   ├── formatters.js   # Data formatters
│       │   ├── constants.js    # Constants & helpers
│       │   ├── headers.js      # Request headers
│       │   ├── clients.js      # Cookie jar & clients
│       │   ├── user-agents.js  # User agent rotation
│       │   ├── debug.js        # Debug logging system
│       │   └── messageStore.js # Anti-unsend storage
│       │
│       └── parsers/            # Delta parsers
│           └── deltaParser.js  # MQTT delta parser
│
├── types/                      # TypeScript definitions
│   └── index.d.ts              # Type declarations
│
└── examples/                   # Usage examples
    └── basic.js                # Basic bot example
```

## ✨ Features

| Category        | Features                                                 |
| --------------- | -------------------------------------------------------- |
| **Messaging**   | Send, edit, unsend, react, typing indicators, stickers   |
| **Groups**      | Create, rename, add/remove members, set rules, nicknames |
| **Threads**     | Get info, history, list, mark as read                    |
| **Social**      | Comment on posts, share, follow/unfollow, stories        |
| **Real-time**   | MQTT listener with auto-reconnect                        |
| **Anti-Unsend** | Built-in message storage (10K msgs, 24hr retention)      |
| **Debug**       | 4-level colored logging system                           |
| **Stickers**    | Search, list packs, AI stickers                          |

## 🚀 Quick Start

```javascript
const nero = require("nero-core");

nero({ appState: JSON.parse(fs.readFileSync("appstate.json")) }, (err, api) => {
    if (err) return console.error(err);

    console.log("Logged in as:", api.getCurrentUserID());

    api.listenMqtt((err, event) => {
        if (event.type === "message") {
            console.log(`${event.senderID}: ${event.body}`);

            if (event.body === "ping") {
                api.sendMessage("pong!", event.threadID);
            }
        }
    });
});
```

## 📖 API Reference

### Core Methods

- `login(credentials, options, callback)` - Authenticate with Facebook
- `getCurrentUserID()` - Get logged-in user ID
- `getAppState()` - Get session cookies
- `setOptions(options)` - Update runtime options
- `logout(callback)` - End session

### Messaging

- `sendMessage(msg, threadID, [replyTo])` - Send a message
- `editMessage(text, messageID)` - Edit a message
- `unsendMessage(messageID, threadID)` - Unsend a message
- `setMessageReaction(emoji, messageID)` - React to a message
- `sendTypingIndicator(typing, threadID)` - Show typing status
- `handleMessageRequest(threadID, accept)` - Accept/decline message requests
- `muteThread(threadID, seconds)` - Mute/unmute thread notifications
- `createPoll(threadID, question, options)` - Create a poll in group
- `createNewGroup(participantIDs, [title])` - Create a new group chat

### Threads

- `getThreadInfo(threadID)` - Get thread details
- `getThreadList(limit, timestamp, tags)` - List threads
- `getThreadHistory(threadID, amount, timestamp)` - Get messages

### Social (Nero Exclusive)

- `comment(msg, postID)` - Comment on a post
- `share(postID)` - Share a post
- `follow(userID, follow)` - Follow/unfollow user
- `story.reply(storyID, message)` - Reply to a story
- `story.create(message, options)` - Create a text story

### Debug

- `getDebugStats()` - Get API statistics
- `printDebugStats()` - Print stats to console
- `resetDebugStats()` - Reset counters

---

## 🛡️ Advanced Human Behavior Engine (Anti-Detection)

Nero includes a **comprehensive Human Behavior Simulation Engine** to evade Facebook's automated behavior detection systems. This system implements multiple layers of human-like behavior patterns.

### Features

| Category                      | Features                                                                    |
| ----------------------------- | --------------------------------------------------------------------------- |
| **Typing Simulation**         | Gaussian-distributed typing speeds, character-level delays, typo simulation |
| **Circadian Rhythm**          | 24-hour activity patterns, day-of-week variations, sleep detection          |
| **Cognitive Modeling**        | Focus decay, mental fatigue, emotional states, attention spans              |
| **Device Profiles**           | Mobile/Desktop/Tablet specific behaviors                                    |
| **Personality Profiles**      | Casual/Professional/Enthusiastic/Busy response patterns                     |
| **Network Simulation**        | Latency jitter, connection quality, spike simulation                        |
| **Rate Limiting**             | Adaptive throttling, burst detection, cooldowns                             |
| **Session Management**        | Micro/short/long breaks, activity bursts                                    |
| **Fingerprint Randomization** | Periodic variance reshuffling                                               |

### Quick Enable

```javascript
// Simple enable with auto-selected profiles
api.setOptions({ humanBehavior: true });
```

### Device & Personality Profiles

```javascript
// Configure specific device and personality
api.setOptions({
    humanBehavior: {
        device: "mobile", // 'mobile' | 'desktop' | 'tablet'
        personality: "casual", // 'casual' | 'professional' | 'enthusiastic' | 'busy'
    },
});
```

### Advanced Configuration

```javascript
api.setOptions({
    humanBehavior: {
        // Device and personality
        device: "desktop",
        personality: "professional",

        // Typing dynamics
        typing: {
            baseWPM: { min: 40, max: 80 },
            charDelay: {
                base: 80,
                variance: 40,
                punctuationMultiplier: 1.8,
            },
            typos: {
                baseRate: 0.025,
                correctionDelay: { min: 200, max: 600 },
            },
        },

        // Circadian rhythm (24-hour patterns)
        circadian: {
            enabled: true,
            hourlyActivity: {
                0: 0.15,
                1: 0.08,
                2: 0.05, // Night (very slow)
                9: 0.95,
                10: 1.0,
                11: 1.0, // Morning (active)
                14: 0.95,
                15: 1.0, // Afternoon
                22: 0.7,
                23: 0.4, // Evening (slowing)
            },
            sleepThreshold: 0.1,
            sleepResponseChance: 0.02,
        },

        // Cognitive load modeling
        cognitive: {
            attention: {
                maxFocusTime: 25 * 60 * 1000, // 25 minutes
                distractionChance: 0.03,
            },
            fatigue: {
                enabled: true,
                onsetTime: 45 * 60 * 1000, // After 45 min
                effectOnTyping: 1.5, // 50% slower
            },
            emotion: {
                enabled: true,
                effectMultipliers: {
                    neutral: 1.0,
                    happy: 0.85, // Faster when happy
                    stressed: 1.3, // Slower when stressed
                    tired: 1.6, // Much slower when tired
                    excited: 0.7, // Very fast when excited
                },
            },
        },

        // Network simulation
        network: {
            latency: {
                base: { min: 50, max: 200 },
                spikeChance: 0.05,
            },
        },

        // Session management
        session: {
            breaks: {
                microBreak: { chance: 0.1, duration: { min: 5000, max: 15000 } },
                shortBreak: { chance: 0.05, duration: { min: 30000, max: 120000 } },
                longBreak: { chance: 0.02, duration: { min: 300000, max: 1800000 } },
            },
        },

        // Rate limiting
        rateLimit: {
            perMinute: { messages: 15, actions: 45 },
            perHour: { messages: 200, actions: 800 },
            adaptive: {
                enabled: true,
                warningThreshold: 0.7,
                criticalThreshold: 0.9,
                criticalMultiplier: 3.0,
            },
        },

        // Fingerprint randomization
        fingerprint: {
            randomization: {
                enabled: true,
                variance: 0.15,
                reshuffleInterval: 3600000, // Every hour
            },
        },
    },
});
```

### Behavior Statistics

```javascript
// Get detailed behavior stats
const stats = humanBehavior.getStats();
console.log(stats);
// {
//   session: { duration: 1800000, actionCount: 45, messageCount: 12 },
//   cognitive: { focusLevel: 0.8, fatigueLevel: 0.2, emotionalState: 'neutral' },
//   profile: { device: 'desktop', personality: 'casual' },
//   multipliers: { circadian: 1.0, cognitive: 1.1, rateLimit: 1.0 },
//   flags: { isSleepTime: false }
// }
```

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    Human Behavior Engine                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Typing    │  │  Circadian  │  │  Cognitive  │              │
│  │  Simulator  │  │   Rhythm    │  │    Model    │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Combined Delay Calculation                   │   │
│  │   delay = base × circadian × cognitive × rateLimit × var │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          │                                       │
│         ┌────────────────┼────────────────┐                     │
│         ▼                ▼                ▼                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Network   │  │   Session   │  │    Rate     │              │
│  │   Latency   │  │   Breaks    │  │   Limiter   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📄 License

MIT © 0x3EF8
