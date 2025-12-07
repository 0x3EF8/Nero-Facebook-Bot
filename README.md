# Nero Messenger Bot

A modular, multi-account Facebook Messenger bot built with nero-core.

## 📁 Project Structure

```
nero 3000/
├── accounts/                # Appstate/cookie files for each account
│   ├── 100044343889036.json
│   ├── 100091687191806.json1
│   ├── example.json.template
│   └── README.md
├── accounts_backup/         # Backup for moved/old account files
├── commands/
│   ├── admin/               # Admin commands (accounts.js, admin.js, eval.js, etc.)
│   └── user/                # User commands (help.js, info.js, ping.js, etc.)
├── config/
│   ├── config.js            # Main bot config
│   └── settings.js          # Runtime settings
├── data/
│   └── temp/                # Temporary data
├── events/
│   ├── AI/                  # AI event handlers (beta.js)
│   ├── otherEvents/         # Misc event handlers (antiSpam, mentionResponse, etc.)
│   └── welcome/             # Welcome/goodbye events
├── extension/               # Browser extension files (manifest, popup, etc.)
├── handlers/                # Command/event handler logic
│   ├── commandHandler.js
│   ├── eventHandler.js
│   └── index.js
├── logs/                    # Log files (currently empty)
├── nero-core/               # Core library (submodule or local package)
│   ├── examples/
│   ├── src/
│   │   ├── api/
│   │   │   ├── extra/
│   │   │   ├── http/
│   │   │   ├── login/
│   │   │   ├── messaging/
│   │   │   ├── mqtt/
│   │   │   ├── posting/
│   │   │   ├── threads/
│   │   │   └── users/
│   │   ├── core/
│   │   │   ├── auth/
│   │   │   └── client.js
│   │   ├── lib/
│   │   │   └── utils/
│   │   │       ├── humanBehavior.js
│   │   │       ├── logger.js
│   │   │       └── ...
│   ├── tests/
│   │   ├── api/
│   │   ├── e2e/
│   │   ├── integration/
│   │   ├── lib/
│   │   └── unit/
│   ├── package.json
│   └── README.md
├── utils/                   # Utility modules (accountManager, logger, etc.)
├── index.js                 # Main bot entry point
├── server.js                # API server for cookie/appstate submission
├── LICENSE                  # MIT License
├── package.json             # Project manifest
├── README.md                # Project documentation
├── .env, .env.template      # Environment config
├── .editorconfig, .gitignore, .prettierrc, etc.
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm or yarn
- Facebook account with valid session cookies

### Installation

1. **Clone or download the project**

2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Configure your accounts**

    **Option A: Using the Nero Cookie Extractor Extension (Recommended)**

    1. Install the extension:
        - Open your browser (Chrome, Edge, Brave).
        - Go to `chrome://extensions` and enable Developer Mode.
        - Click "Load unpacked" and select the `extension/` folder.
        - The "Nero Cookie Extractor" icon will appear in your toolbar.

    2. Extract cookies:
        - Log in to Facebook at facebook.com.
        - Click the extension icon.
        - The popup will show your Facebook cookies, validate them, and display their health/status.

    3. Send cookies to the bot:
        - Use the popup form/button to send your cookies to the bot.
        - The extension will POST your appstate (cookie array) to your bot’s API endpoint: `http://localhost:3000/api/appstate`.
        - Choose an account name if prompted. The extension will handle formatting and submission.

    4. Bot receives cookies:
        - The bot will save the cookies in the `accounts/` folder and reload the account automatically.
        - You’ll see confirmation in the bot logs.

    **Note:** If no accounts are present, the bot will start in waiting mode and display a message with the host and port, ready to accept cookies via the API.

    **Security:** Cookies are sent only to your local bot server, never to third parties. Never share your appstate with anyone else.

    ---

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
