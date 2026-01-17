# NΞRO Bot

<div align="center">

A modular, multi-account Facebook Messenger chatbot framework featuring human-like behavior simulation, event-driven architecture, and a built-in REST API server.

[Features](#-features) • [Installation](#-installation) • [Configuration](#-configuration) • [Commands](#-commands) • [API Server](#-api-server) • [License](#-license)

</div>

---

## ✨ Features

- **Multi-Account Support** - Run multiple Facebook accounts simultaneously
- **Human Behavior Simulation** - Realistic delays and typing patterns to avoid detection
- **REST API Server** - Built-in HTTP server for remote management and cookie submission
- **Browser Extension** - Cookie extractor extension for easy appstate management
- **Hot Reload** - Reload commands and events without restarting the bot
- **Auto-Update** - Automatic update checking from GitHub
- **Modular Architecture** - Easily add commands and events
- **Anti-Spam Protection** - Rate limiting and spam detection
- **Comprehensive Logging** - Colored console output with file logging support

---

## 📁 Project Structure

```
nero/
├── index.js                 # Main entry point
├── server.js                # REST API server
├── package.json             # Dependencies and scripts
├── .env                     # Environment variables (API keys)
├── accounts/                # Appstate JSON files for each account
├── commands/
│   ├── admin/               # Admin-only commands
│   │   ├── accounts.js      # Account management
│   │   ├── admin.js         # Admin user management
│   │   ├── eval.js          # JavaScript evaluation
│   │   ├── kick.js          # Kick users from groups
│   │   ├── maintenance.js   # Maintenance mode
│   │   ├── messagerequest.js# Handle message requests
│   │   ├── reload.js        # Hot reload commands/events
│   │   ├── restart.js       # Restart the bot
│   │   ├── setprefix.js     # Change command prefix
│   │   └── shell.js         # Execute shell commands
│   └── user/                # User commands
│       ├── help.js          # Command help
│       ├── info.js          # Bot information
│       ├── newgc.js         # Create new group chat
│       ├── ping.js          # Latency check
│       ├── poll.js          # Create polls
│       ├── stalk.js         # User profile lookup
│       ├── uid.js           # Get Facebook UID
│       └── uptime.js        # Bot uptime
├── config/
│   ├── config.js            # Main configuration
│   └── settings.js          # Runtime behavior settings
├── events/
│   ├── AI/
│   │   └── beta/            # AI/Gemini integration
│   ├── protection/
│   │   ├── antiLeave.js     # Prevent users from leaving
│   │   ├── antiSpam.js      # Spam detection
│   │   ├── antiUnsend.js    # Log unsent messages
│   │   ├── mentionResponse.js # Respond to mentions
│   │   └── typingIndicator.js # Typing status handler
│   └── welcome/
│       ├── goodbye.js       # Goodbye messages
│       └── welcome.js       # Welcome messages
├── extension/               # Browser cookie extractor
│   ├── manifest.json
│   ├── popup.html
│   └── popup.js
├── handlers/                # Command and event handlers
├── nero-core/               # Core Facebook API library
├── utils/                   # Utility modules
│   ├── accountManager.js    # Multi-account management
│   ├── cookieValidator.js   # Appstate validation
│   ├── errors.js            # Error classes
│   ├── logger.js            # Logging system
│   ├── maintenanceManager.js# Maintenance mode
│   ├── retry.js             # Retry logic
│   ├── statsTracker.js      # Statistics tracking
│   └── updater.js           # Auto-update system
└── logs/                    # Log files
```

---

## 🚀 Installation

### Prerequisites

- **Node.js** 20.x or higher
- **npm** or **yarn**
- Facebook account with valid session cookies

### Quick Start

1. **Clone the repository**

    ```bash
    git clone https://github.com/0x3EF8/Nero.git
    cd Nero
    ```

2. **Install dependencies**

    ```bash
    npm install
    ```

3. **Configure environment variables**

    ```bash
    cp .env.template .env
    # Edit .env with your API keys (Gemini, etc.)
    ```

4. **Add your Facebook account**

    Place your appstate JSON file in the `accounts/` folder:

    ```
    accounts/
    └── 100044343889036.json    # Named with your Facebook UID
    ```

5. **Start the bot**

    ```bash
    npm start
    ```

    Or with auto-restart on file changes:

    ```bash
    npm run dev
    ```

---

## 🔐 Account Setup

### Option A: Using the Browser Extension (Recommended)

1. **Install the extension**
    - Open Chrome/Edge/Brave and go to `chrome://extensions`
    - Enable "Developer Mode"
    - Click "Load unpacked" and select the `extension/` folder

2. **Extract cookies**
    - Log in to Facebook at facebook.com
    - Click the Nero Cookie Extractor icon
    - Click "Send to Bot" to submit cookies to your bot's API

3. **Bot receives cookies**
    - The bot will save cookies and restart automatically

### Option B: Manual Setup

1. Use a browser extension like "EditThisCookie" to export Facebook cookies
2. Save as JSON array in `accounts/<your-uid>.json`
3. Start the bot

### Waiting Mode

If no accounts are configured, the bot starts in **waiting mode**:

```
🌐 Server running at http://0.0.0.0:30174
📌 Waiting for appstate submission via API...
   POST http://0.0.0.0:30174/api/cookies
```

---

## ⚙️ Configuration

### Main Config (`config/config.js`)

```javascript
bot: {
    name: "Nero Bot",
    prefix: "!",                    // Command prefix
    botPrefix: ".",                 // Bot's own prefix (selfListen)
    admins: ["100044343889036"],    // Admin Facebook UIDs
    superAdmins: ["100044343889036"],
    blockedUsers: [],
    blockedThreads: [],
}
```

### API Server Settings

```javascript
server: {
    enabled: true,
    port: 30174,                    // API server port
    host: '0.0.0.0',                // Bind to all interfaces
    apiKey: process.env.NERO_API_KEY,
    requireAuth: true,
    publicEndpoints: ['/api/stats', '/', '/favicon.ico'],
}
```

### Environment Variables (`.env`)

```env
# Gemini AI API Keys
GEMINI_API_KEY=your_primary_key
GEMINI_BACKUP_KEYS=backup1,backup2,backup3

# Nero API Authentication
NERO_API_KEY=NERO-XXXX-XXXX-XXXX

# Environment
NODE_ENV=development
DEBUG=false

# Security
SUPER_ADMINS=100080000000001,100080000000002
```

---

## 🌐 API Server

The bot includes a REST API server for remote management.

### Endpoints

| Method | Endpoint                | Auth     | Description                 |
| ------ | ----------------------- | -------- | --------------------------- |
| `GET`  | `/`                     | Public   | API info and status         |
| `GET`  | `/api/stats`            | Public   | Bot statistics and accounts |
| `POST` | `/api/cookies`          | Required | Upload or validate cookies  |
| `GET`  | `/api/cookies/appstate` | Required | Retrieve account appstate   |

### Authentication

Protected endpoints require the `X-API-Key` header:

```bash
curl -H "X-API-Key: YOUR_API_KEY" http://localhost:30174/api/cookies/appstate
```

### Upload Cookies

```bash
curl -X POST http://localhost:30174/api/cookies \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"cookies": [...], "action": "upload"}'
```

---

## 📝 Commands

### Admin Commands

| Command                 | Description              | Permission  |
| ----------------------- | ------------------------ | ----------- |
| `!accounts`             | Manage bot accounts      | Admin       |
| `!admin`                | Manage administrators    | Super Admin |
| `!eval <code>`          | Execute JavaScript       | Super Admin |
| `!kick <@user>`         | Kick user from group     | Admin       |
| `!maintenance`          | Toggle maintenance mode  | Admin       |
| `!messagerequest`       | Handle message requests  | Admin       |
| `!reload <type> <name>` | Hot-reload command/event | Admin       |
| `!restart`              | Restart the bot          | Admin       |
| `!setprefix <prefix>`   | Change command prefix    | Admin       |
| `!shell <command>`      | Execute shell command    | Super Admin |

### User Commands

| Command            | Description                  |
| ------------------ | ---------------------------- |
| `!help [command]`  | Show help or command details |
| `!info`            | Bot information and stats    |
| `!newgc <name>`    | Create new group chat        |
| `!ping`            | Check bot latency            |
| `!poll <question>` | Create a poll                |
| `!stalk <@user>`   | User profile information     |
| `!uid [@user]`     | Get Facebook UID             |
| `!uptime`          | Bot uptime                   |

---

## 📡 Events

### AI Events

- **beta.js** - Gemini AI integration for intelligent responses

### Protection Events

- **antiLeave.js** - Prevent/track users leaving groups
- **antiSpam.js** - Detect and block spam messages
- **antiUnsend.js** - Log unsent/deleted messages

### Interaction Events

- **mentionResponse.js** - Respond when bot is mentioned
- **typingIndicator.js** - Handle typing status

### Welcome Events

- **welcome.js** - Greet new group members
- **goodbye.js** - Farewell messages for leaving members

---

## 🔧 Creating Commands

Place commands in `commands/<category>/`:

```javascript
"use strict";

module.exports.config = {
    name: "mycommand",
    aliases: ["mc", "mycmd"],
    description: "What the command does",
    usage: "mycommand <args>",
    category: "user",
    cooldown: 5,
    permissions: "user", // "user", "admin", "superadmin"
    enabled: true,
};

module.exports.execute = async function ({ api, event, args, config, logger }) {
    const { threadID, messageID } = event;

    api.sendMessage("Hello!", threadID, messageID);
};
```

---

## 📡 Creating Events

Place events in `events/<category>/`:

```javascript
"use strict";

module.exports.config = {
    name: "myevent",
    description: "What the event does",
    eventTypes: ["message", "message_reply"],
    priority: 10, // Higher runs first
    enabled: true,
};

module.exports.execute = async function ({ api, event, config, logger }) {
    // Your logic here
    // Block further processing:
    // event.__blocked = true;
};
```

---

## 📋 NPM Scripts

| Script                | Description                        |
| --------------------- | ---------------------------------- |
| `npm start`           | Start the bot                      |
| `npm run dev`         | Start with auto-restart on changes |
| `npm run pm2`         | Start with PM2 (production)        |
| `npm run pm2:stop`    | Stop PM2 process                   |
| `npm run pm2:restart` | Restart PM2 process                |
| `npm run pm2:logs`    | View PM2 logs                      |
| `npm run lint`        | Run ESLint                         |
| `npm run lint:fix`    | Fix ESLint issues                  |
| `npm run format`      | Format code with Prettier          |
| `npm test`            | Run tests                          |
| `npm run clean`       | Remove log files                   |
| `npm run update`      | Check for updates                  |

---

## 🚀 PM2 Production Deployment

PM2 is recommended for production deployment. It provides auto-restart, monitoring, and log management.

### Installation

```bash
npm install -g pm2
```

### Quick Start with PM2

```bash
# Start the bot with PM2
npm run pm2

# Or directly with PM2
pm2 start ecosystem.config.js
```

### PM2 Commands

| Command                         | Description               |
| ------------------------------- | ------------------------- |
| `pm2 start ecosystem.config.js` | Start the bot             |
| `pm2 stop nero`                 | Stop the bot              |
| `pm2 restart nero`              | Restart the bot           |
| `pm2 logs nero`                 | View live logs            |
| `pm2 monit`                     | Open monitoring dashboard |
| `pm2 status`                    | Check process status      |
| `pm2 delete nero`               | Remove from PM2           |

### Auto-Start on System Boot

```bash
# Generate startup script
pm2 startup

# Save current process list
pm2 save
```

This ensures the bot automatically starts when your server/computer restarts.

---

## 🔒 Security Notes

1. **Never share your appstate** - It contains your Facebook session
2. **Secure your API key** - Use environment variables
3. **Use `eval` carefully** - It executes arbitrary code
4. **Add trusted admins only** - Admin commands have full access
5. **Keep dependencies updated** - Run `npm update` regularly

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

<div align="center">

[Report Bug](https://github.com/0x3EF8/Nero/issues) • [Request Feature](https://github.com/0x3EF8/Nero/issues)

</div>
