/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                           NERO TYPE DEFINITIONS                               ║
 * ║          JSDoc TypeDefs for better IDE support and type checking              ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 * 
 * This file contains JSDoc @typedef definitions for the Nero bot framework.
 * These types are used across handlers, commands, events, and background tasks.
 * 
 * Usage in other files:
 * @example
 * // At the top of your file:
 * // @ts-check
 * // or import types:
 * /** @typedef {import('./types').CommandConfig} CommandConfig *\/
 * 
 * @module types
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * User ID type (Facebook UID)
 * @typedef {string} UserID
 */

/**
 * Thread/Group ID type
 * @typedef {string} ThreadID
 */

/**
 * Message ID type
 * @typedef {string} MessageID
 */

/**
 * Account ID type (matches account JSON filename)
 * @typedef {string} AccountID
 */

// ============================================================================
// API TYPES
// ============================================================================

/**
 * Nero API instance returned from nero-core login
 * @typedef {Object} NeroAPI
 * @property {function(string|Object, ThreadID): Promise<MessageInfo>} sendMessage - Send a message
 * @property {function(MessageID): Promise<void>} unsendMessage - Unsend a message
 * @property {function(ThreadID): Promise<ThreadInfo>} getThreadInfo - Get thread information
 * @property {function(UserID): Promise<UserInfo>} getUserInfo - Get user information
 * @property {function(): UserID} getCurrentUserID - Get current bot user ID
 * @property {function(string, function): void} listenMqtt - Listen for MQTT events
 * @property {function(): void} logout - Logout and cleanup
 */

/**
 * Message info returned from sendMessage
 * @typedef {Object} MessageInfo
 * @property {MessageID} messageID - The sent message's ID
 * @property {number} timestamp - Message timestamp
 * @property {ThreadID} threadID - Thread where message was sent
 */

/**
 * Thread information
 * @typedef {Object} ThreadInfo
 * @property {ThreadID} threadID - Thread ID
 * @property {string} threadName - Thread/group name
 * @property {UserID[]} participantIDs - Array of participant IDs
 * @property {boolean} isGroup - Whether thread is a group
 * @property {number} messageCount - Total message count
 * @property {Object<UserID, string>} nicknames - User nicknames in thread
 */

/**
 * User information
 * @typedef {Object} UserInfo
 * @property {UserID} id - User ID
 * @property {string} name - Full name
 * @property {string} firstName - First name
 * @property {string} vanity - Vanity URL
 * @property {string} thumbSrc - Profile picture URL
 * @property {string} profileUrl - Profile URL
 * @property {boolean} isFriend - Whether user is friend
 * @property {boolean} isBirthday - Whether today is user's birthday
 */

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Message event from MQTT listener
 * @typedef {Object} MessageEvent
 * @property {string} type - Event type (e.g., "message", "message_reply")
 * @property {MessageID} messageID - Message ID
 * @property {ThreadID} threadID - Thread ID
 * @property {UserID} senderID - Sender's user ID
 * @property {string} body - Message body text
 * @property {boolean} isGroup - Whether from group chat
 * @property {number} timestamp - Message timestamp
 * @property {Attachment[]} attachments - Message attachments
 * @property {Mention[]} mentions - User mentions in message
 * @property {MessageReply} [messageReply] - Reply info if replying to message
 */

/**
 * Message mention
 * @typedef {Object} Mention
 * @property {string} tag - Mention tag text
 * @property {UserID} id - Mentioned user's ID
 * @property {number} [fromIndex] - Start index in message
 */

/**
 * Message attachment
 * @typedef {Object} Attachment
 * @property {string} type - Attachment type (photo, video, audio, file, sticker, share)
 * @property {string} ID - Attachment ID
 * @property {string} [url] - Attachment URL
 * @property {string} [filename] - Filename
 */

/**
 * Reply info when message is a reply
 * @typedef {Object} MessageReply
 * @property {MessageID} messageID - Original message ID
 * @property {UserID} senderID - Original sender ID
 * @property {string} body - Original message body
 * @property {Attachment[]} attachments - Original attachments
 */

// ============================================================================
// COMMAND TYPES
// ============================================================================

/**
 * Command configuration object
 * @typedef {Object} CommandConfig
 * @property {string} name - Command name (used to invoke)
 * @property {string[]} [aliases] - Alternative names for command
 * @property {string} description - What the command does
 * @property {string} usage - Usage syntax
 * @property {string} [example] - Example usage
 * @property {string} category - Command category (e.g., "user", "admin")
 * @property {number} [cooldown] - Cooldown in seconds (default: 3)
 * @property {boolean} [adminOnly] - Restrict to admins only
 * @property {boolean} [groupOnly] - Only works in groups
 * @property {boolean} [dmOnly] - Only works in DMs
 */

/**
 * Command module structure
 * @typedef {Object} Command
 * @property {CommandConfig} config - Command configuration
 * @property {CommandExecute} execute - Command execution function
 * @property {CommandInit} [onLoad] - Called when command is loaded
 */

/**
 * Command execute function signature
 * @callback CommandExecute
 * @param {CommandContext} context - Execution context
 * @returns {Promise<void>}
 */

/**
 * Command initialization function
 * @callback CommandInit
 * @returns {void}
 */

/**
 * Command execution context
 * @typedef {Object} CommandContext
 * @property {NeroAPI} api - Nero API instance
 * @property {MessageEvent} event - Message event that triggered command
 * @property {string[]} args - Command arguments
 * @property {Object} Users - User utility methods
 * @property {Object} Threads - Thread utility methods
 */

// ============================================================================
// EVENT HANDLER TYPES
// ============================================================================

/**
 * Event handler configuration
 * @typedef {Object} EventConfig
 * @property {string} name - Event handler name
 * @property {string} description - What the event handler does
 * @property {string[]} eventTypes - Event types to handle (e.g., ["message", "message_reply"])
 * @property {number} [priority] - Execution priority (higher = earlier, default: 0)
 * @property {boolean} [enabled] - Whether handler is enabled (default: true)
 */

/**
 * Event handler module structure
 * @typedef {Object} EventHandler
 * @property {EventConfig} config - Event configuration
 * @property {EventExecute} execute - Event execution function
 * @property {EventInit} [onLoad] - Called when handler is loaded
 */

/**
 * Event execute function signature
 * @callback EventExecute
 * @param {EventContext} context - Execution context
 * @returns {Promise<boolean>} - Return true to stop event propagation
 */

/**
 * Event initialization function
 * @callback EventInit
 * @returns {void}
 */

/**
 * Event execution context
 * @typedef {Object} EventContext
 * @property {NeroAPI} api - Nero API instance
 * @property {MessageEvent} event - Message event
 * @property {Object} Users - User utility methods
 * @property {Object} Threads - Thread utility methods
 */

// ============================================================================
// BACKGROUND TASK TYPES
// ============================================================================

/**
 * Background task module structure
 * @typedef {Object} BackgroundTask
 * @property {string} name - Task unique identifier
 * @property {string} description - What the task does
 * @property {boolean} [enabled] - Whether task is enabled (default: true)
 * @property {number} interval - Execution interval in milliseconds
 * @property {boolean} [runOnStart] - Run immediately on start (default: false)
 * @property {TaskExecute} execute - Task execution function
 * @property {TaskInit} [init] - Called when task starts
 * @property {TaskStop} [stop] - Called when task stops (cleanup)
 */

/**
 * Task execute function signature
 * @callback TaskExecute
 * @param {NeroAPI} api - Nero API instance
 * @param {AccountManager} accountManager - Account manager instance
 * @returns {Promise<void>}
 */

/**
 * Task initialization function
 * @callback TaskInit
 * @param {NeroAPI} api - Nero API instance
 * @param {AccountManager} accountManager - Account manager instance
 * @returns {Promise<void>}
 */

/**
 * Task cleanup function
 * @callback TaskStop
 * @returns {Promise<void>}
 */

// ============================================================================
// ACCOUNT TYPES
// ============================================================================

/**
 * Account manager instance
 * @typedef {Object} AccountManager
 * @property {function(): Map<AccountID, AccountData>} getAccounts - Get all accounts
 * @property {function(AccountID): AccountData|null} getAccount - Get specific account
 * @property {function(): AccountData[]} getActiveAccounts - Get all active accounts
 * @property {function(): number} getAccountCount - Get total account count
 */

/**
 * Account data structure
 * @typedef {Object} AccountData
 * @property {AccountID} id - Account ID
 * @property {string} name - Account display name
 * @property {boolean} active - Whether account is active
 * @property {NeroAPI} [api] - API instance if logged in
 * @property {Object} appState - Cookie/session data
 */

// ============================================================================
// LOGGER TYPES
// ============================================================================

/**
 * Logger instance
 * @typedef {Object} Logger
 * @property {function(string, string): void} info - Log info message
 * @property {function(string, string): void} warn - Log warning message
 * @property {function(string, string): void} error - Log error message
 * @property {function(string, string): void} debug - Log debug message
 * @property {function(string, string): void} success - Log success message
 * @property {function(string, string): void} system - Log system message
 */

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * Main configuration object
 * @typedef {Object} Config
 * @property {string} name - Bot name
 * @property {string} version - Bot version
 * @property {string} prefix - Default command prefix
 * @property {UserID[]} admins - Admin user IDs
 * @property {Object} paths - File/folder paths
 * @property {function(UserID): boolean} isAdmin - Check if user is admin
 */

/**
 * Runtime settings object
 * @typedef {Object} Settings
 * @property {NeroOptions} neroOptions - Nero-core options
 * @property {LoggingOptions} logging - Logging configuration
 * @property {RateLimitOptions} rateLimit - Rate limiting config
 */

/**
 * Nero-core options
 * @typedef {Object} NeroOptions
 * @property {boolean} selfListen - Listen to own messages
 * @property {boolean} listenEvents - Listen to events
 * @property {boolean} updatePresence - Update online presence
 * @property {boolean} autoMarkRead - Auto mark messages as read
 * @property {boolean} humanBehavior - Simulate human behavior
 */

/**
 * Logging options
 * @typedef {Object} LoggingOptions
 * @property {boolean} enabled - Enable logging
 * @property {string} level - Log level (debug, info, warn, error)
 * @property {number} moduleWidth - Module name width in logs
 */

/**
 * Rate limit options
 * @typedef {Object} RateLimitOptions
 * @property {boolean} enabled - Enable rate limiting
 * @property {number} maxMessages - Max messages per window
 * @property {number} windowMs - Time window in milliseconds
 */

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Stats tracker data
 * @typedef {Object} StatsData
 * @property {number} commandsExecuted - Total commands executed
 * @property {number} commandsFailed - Failed command count
 * @property {number} messagesReceived - Messages received
 * @property {number} messagesSent - Messages sent
 * @property {number} uptime - Uptime in milliseconds
 * @property {Date} startTime - Bot start time
 */

/**
 * Maintenance manager
 * @typedef {Object} MaintenanceManager
 * @property {function(): boolean} isEnabled - Check if maintenance mode on
 * @property {function(boolean): void} setEnabled - Set maintenance mode
 * @property {function(): string} getMessage - Get maintenance message
 * @property {function(UserID): boolean} shouldNotify - Check if should notify user
 * @property {function(UserID): void} markNotified - Mark user as notified
 */

// Export empty object for module compatibility
module.exports = {};
