# Nero Messenger Bot

A modular, multi-account Facebook Messenger bot built with nero-core.

## 📁 Project Structure

```
core/
├── index.js                    # Main entry point
├── package.json                # Project dependencies
├── appstate.json              # Facebook session cookies (legacy)
├── accounts/                  # Multi-account appstate files
│   ├── README.md              # Account setup instructions
│   └── *.json                 # Account appstate files
├── config/
│   ├── config.js              # Bot configuration
│   └── settings.js            # Runtime behavior settings
├── commands/
│   ├── admin/                 # Admin-level commands
│   │   ├── accounts.js        # Multi-account management
│   │   ├── admin.js           # Manage bot administrators
│   │   ├── eval.js            # Execute JavaScript code
│   │   ├── reload.js          # Hot-reload commands/events
│   │   ├── restart.js         # Restart the bot
│   │   └── setprefix.js       # Change command prefix
│   └── user/                  # User-level commands
│       ├── help.js            # Display command list
│       ├── info.js            # Bot information/stats
│       ├── ping.js            # Check bot latency
│       ├── uid.js             # Get Facebook User ID
│       └── uptime.js          # Display bot uptime
├── events/
│   ├── welcome/               # Welcome/goodbye events
│   │   ├── welcome.js         # New member welcome
│   │   └── goodbye.js         # Member departure message
│   └── otherEvents/           # Other event handlers
│       ├── antiSpam.js        # Rate limiting/anti-spam
│       ├── mentionResponse.js # Respond to bot mentions
│       ├── messageLogger.js   # Debug message logging
│       └── typingIndicator.js # Debug typing logging
├── handlers/
│   ├── index.js               # Handler exports
│   ├── commandHandler.js      # Command loading & execution
│   └── eventHandler.js        # Event loading & dispatch
├── utils/
│   ├── logger.js              # Custom logging utility
│   └── accountManager.js      # Multi-account manager
└── nero/                      # Nero framework core
    ├── core/
    ├── deltas/
    ├── types/
    └── utils/
```

## 🚀 Getting Started

### Prerequisites

- Node.js 16.x or higher
- npm or yarn
- Facebook account with valid session cookies

### Installation

1. **Clone or download the project**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure your accounts**
   
   **Option A: Multi-Account Setup (Recommended)**
   
   Place your appstate JSON files in the `accounts/` folder:
   ```
   accounts/
   ├── main.json        # Primary bot account
   ├── backup.json      # Backup account
   └── helper.json      # Additional account
   ```

   **Option B: Single Account (Legacy)**
   
   Place `appstate.json` in the root directory.

4. **Configure the bot**
   
   Edit `config/config.js` to customize:
   - Bot name and prefix
   - Admin user IDs
   - Feature flags
   - Rate limiting settings
   - And more!

5. **Start the bot**
   ```bash
   npm start
   ```

   Or with auto-restart on file changes:
   ```bash
   npm run dev
   ```

## 🔐 Multi-Account Support

The bot supports running multiple Facebook accounts simultaneously!

### Setup

1. Create the `accounts/` folder (auto-created on first run)
2. Add your appstate JSON files (one per account)
3. Each file should contain a valid cookie array

### Account Management

Use the `!accounts` command to manage your accounts:

```
!accounts            - Show all accounts status
!accounts list       - List accounts with details
!accounts stats      - View statistics
!accounts info main  - Get info about specific account
```

### How It Works

- Each account gets its own API instance
- All accounts share the same command/event handlers
- Events include account info (`event.__account`)
- Commands can access the account manager for cross-account operations

## 📝 Creating Commands

Commands are placed in `commands/<category>/` directories.

### Command Template

```javascript
/**
 * Command description
 */

"use strict";

module.exports.config = {
    name: "commandname",           // Command name (required)
    aliases: ["alias1", "alias2"], // Alternative names
    description: "What it does",   // Description for help menu
    usage: "commandname <args>",   // Usage syntax
    category: "user",              // Category (matches folder)
    cooldown: 5,                   // Cooldown in seconds
    permissions: "user",           // "user", "admin", or "superadmin"
    enabled: true,                 // Enable/disable command
    dmOnly: false,                 // Only work in DMs
    groupOnly: false,              // Only work in groups
};

module.exports.execute = async function({ api, event, args, config, logger }) {
    const threadID = event.threadID;
    const messageID = event.messageID;
    
    // Your command logic here
    api.sendMessage("Hello!", threadID, messageID);
};

// Optional: Called when command is loaded
module.exports.onLoad = function() {
    console.log("Command loaded!");
};

// Optional: Called when command is unloaded
module.exports.onUnload = function() {
    console.log("Command unloaded!");
};
```

## 📡 Creating Events

Events are placed in `events/<category>/` directories.

### Event Template

```javascript
/**
 * Event description
 */

"use strict";

module.exports.config = {
    name: "eventname",              // Event handler name (required)
    description: "What it does",    // Description
    eventTypes: ["message"],        // Event types to listen for
    priority: 10,                   // Higher = runs first
    enabled: true,                  // Enable/disable handler
};

module.exports.execute = async function({ api, event, config, logger }) {
    // Your event logic here
    
    // To block further processing (e.g., in anti-spam):
    // event.__blocked = true;
};
```

### Event Types

- `message` - Regular messages
- `message_reply` - Reply messages
- `event` - Group events (join, leave, etc.)
- `typ` - Typing indicators
- `read` - Read receipts
- `all` - All events

## ⚙️ Configuration

Edit `config/config.js` to customize the bot:

### Bot Settings
```javascript
bot: {
    name: "Nero Bot",
    prefix: "!",
    admins: ["your-facebook-uid"],
    superAdmins: ["your-facebook-uid"],
}
```

### Feature Flags
```javascript
features: {
    mentionResponse: true,
    welcomeMessages: true,
    goodbyeMessages: true,
    antiSpam: true,
}
```

### Rate Limiting
```javascript
rateLimit: {
    enabled: true,
    maxMessages: 5,
    windowSeconds: 10,
    penaltySeconds: 30,
}
```

## 🛠️ Admin Commands

| Command | Description | Permission |
|---------|-------------|------------|
| `!admin` | Manage bot administrators | Super Admin |
| `!eval <code>` | Execute JavaScript code | Super Admin |
| `!reload <type> <name>` | Hot-reload command/event | Admin |
| `!restart` | Restart the bot | Admin |
| `!setprefix <prefix>` | Change command prefix | Admin |

## 👤 User Commands

| Command | Description |
|---------|-------------|
| `!help [command]` | Display command list or command details |
| `!info` | Display bot information and statistics |
| `!ping` | Check bot response time |
| `!uid [@mention]` | Get Facebook User ID |
| `!uptime` | Display bot uptime |

## 📋 Logs

The bot uses a custom logging system with colored output:

- 🟦 **INFO** - General information
- 🟨 **WARN** - Warnings
- 🟥 **ERROR** - Errors
- 🟩 **SUCCESS** - Success messages
- ⬜ **DEBUG** - Debug information (when enabled)

## 🔒 Security Notes

1. **Never share your `appstate.json`** - It contains your Facebook session
2. **Use `eval` carefully** - It can execute arbitrary code
3. **Add trusted admins only** - Admin commands have significant power
4. **Keep your bot updated** - Update dependencies regularly

## 📄 License

MIT License - See LICENSE file for details

## 👨‍💻 Author

Created by **0x3EF8**

---

**Built with ❤️ by 0x3EF8 using nero-core**
