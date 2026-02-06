/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                         REMINDER SERVICE MODULE                               ║
 * ║              Smart Reminder System with Pre-notification Alerts               ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * Features:
 * - Set reminders with natural language parsing
 * - 15-minute pre-reminder notification
 * - On-time reminder notification
 * - Mentions the user who set the reminder
 * - Persists reminders to file
 *
 * @module services/reminder
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const fs = require("fs");
const path = require("path");
const log = require("../../../../../utils/logger");

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const REMINDERS_FILE = path.join(__dirname, "../data/reminders.json");
const CHECK_INTERVAL = 30 * 1000; // Check every 30 seconds
const PRE_REMINDER_MINUTES = 15; // Send reminder 15 minutes before

// Ensure data directory exists
const dataDir = path.dirname(REMINDERS_FILE);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// ═══════════════════════════════════════════════════════════════════════════════
// REMINDER STORAGE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * In-memory reminders cache
 * Structure: { id: { id, userID, userName, threadID, message, reminderTime, preReminderSent, reminderSent, createdAt } }
 */
let reminders = {};

/**
 * Load reminders from file
 */
function loadReminders() {
    try {
        if (fs.existsSync(REMINDERS_FILE)) {
            const data = fs.readFileSync(REMINDERS_FILE, "utf8");
            reminders = JSON.parse(data);
            log.info(`[Reminder] Loaded ${Object.keys(reminders).length} reminders`);
        }
    } catch (err) {
        log.error(`[Reminder] Failed to load reminders: ${err.message}`);
        reminders = {};
    }
}

/**
 * Save reminders to file
 */
function saveReminders() {
    try {
        fs.writeFileSync(REMINDERS_FILE, JSON.stringify(reminders, null, 2));
    } catch (err) {
        log.error(`[Reminder] Failed to save reminders: ${err.message}`);
    }
}

// Load on startup
loadReminders();

// ═══════════════════════════════════════════════════════════════════════════════
// TIME PARSING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse natural language time to Date object
 * Examples:
 * - "2:30pm today"
 * - "3:00 PM tomorrow"
 * - "14:30"
 * - "in 30 minutes"
 * - "in 2 hours"
 * 
 * @param {string} timeStr - Natural language time string
 * @returns {Date|null} Parsed date or null if invalid
 */
function parseTime(timeStr) {
    const now = new Date();
    const lowerStr = timeStr.toLowerCase().trim();
    
    // Handle relative times: "in X minutes/hours"
    const relativeMatch = lowerStr.match(/in\s+(\d+)\s*(min(?:ute)?s?|hour?s?|hr?s?)/i);
    if (relativeMatch) {
        const amount = parseInt(relativeMatch[1]);
        const unit = relativeMatch[2].toLowerCase();
        
        if (unit.startsWith("min")) {
            return new Date(now.getTime() + amount * 60 * 1000);
        } else if (unit.startsWith("h")) {
            return new Date(now.getTime() + amount * 60 * 60 * 1000);
        }
    }
    
    // Handle absolute times: "2:30pm", "14:30", "2:30 PM"
    const timeMatch = lowerStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
    if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const period = timeMatch[3]?.toLowerCase();
        
        // Convert to 24-hour format
        if (period === "pm" && hours !== 12) {
            hours += 12;
        } else if (period === "am" && hours === 12) {
            hours = 0;
        }
        
        // Determine the date (today or tomorrow)
        const targetDate = new Date(now);
        targetDate.setHours(hours, minutes, 0, 0);
        
        // Check for "tomorrow" keyword
        if (lowerStr.includes("tomorrow")) {
            targetDate.setDate(targetDate.getDate() + 1);
        }
        // If the time has already passed today and no "today" specified, assume tomorrow
        else if (targetDate <= now && !lowerStr.includes("today")) {
            targetDate.setDate(targetDate.getDate() + 1);
        }
        
        return targetDate;
    }
    
    // Handle just hour: "2pm", "14"
    const hourMatch = lowerStr.match(/(\d{1,2})\s*(am|pm)/i);
    if (hourMatch) {
        let hours = parseInt(hourMatch[1]);
        const period = hourMatch[2].toLowerCase();
        
        if (period === "pm" && hours !== 12) {
            hours += 12;
        } else if (period === "am" && hours === 12) {
            hours = 0;
        }
        
        const targetDate = new Date(now);
        targetDate.setHours(hours, 0, 0, 0);
        
        if (lowerStr.includes("tomorrow")) {
            targetDate.setDate(targetDate.getDate() + 1);
        } else if (targetDate <= now && !lowerStr.includes("today")) {
            targetDate.setDate(targetDate.getDate() + 1);
        }
        
        return targetDate;
    }
    
    return null;
}

/**
 * Extract reminder message and time from user input
 * Examples:
 * - "remind me meeting 2:30pm today" → { message: "meeting", time: "2:30pm today" }
 * - "remind me to call mom in 30 minutes" → { message: "to call mom", time: "in 30 minutes" }
 * 
 * @param {string} input - User input string
 * @returns {{ message: string, timeStr: string, time: Date } | null}
 */
function parseReminderInput(input) {
    // Remove "remind me" prefix
    const cleanInput = input
        .replace(/^(nero[,\s]*)?remind\s+me\s*/i, "")
        .replace(/^(to\s+)?/i, "")
        .trim();
    
    // Try to find time patterns
    const timePatterns = [
        // "in X minutes/hours"
        /(in\s+\d+\s*(?:min(?:ute)?s?|hour?s?|hr?s?))/i,
        // "at 2:30pm today/tomorrow"
        /((?:at\s+)?\d{1,2}:\d{2}\s*(?:am|pm)?\s*(?:today|tomorrow)?)/i,
        // "2pm today/tomorrow"
        /(\d{1,2}\s*(?:am|pm)\s*(?:today|tomorrow)?)/i,
        // "today at 2:30pm"
        /((?:today|tomorrow)\s+(?:at\s+)?\d{1,2}:\d{2}\s*(?:am|pm)?)/i,
    ];
    
    let timeStr = null;
    let message = cleanInput;
    
    for (const pattern of timePatterns) {
        const match = cleanInput.match(pattern);
        if (match) {
            timeStr = match[1].replace(/^at\s+/i, "").trim();
            message = cleanInput.replace(pattern, "").trim();
            break;
        }
    }
    
    if (!timeStr) {
        return null;
    }
    
    const time = parseTime(timeStr);
    if (!time) {
        return null;
    }
    
    // Clean up message
    message = message
        .replace(/\s+/g, " ")
        .replace(/^(to|about|for)\s+/i, "")
        .trim();
    
    if (!message) {
        message = "Reminder";
    }
    
    return { message, timeStr, time };
}

// ═══════════════════════════════════════════════════════════════════════════════
// REMINDER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate unique reminder ID
 * @returns {string}
 */
function generateId() {
    return `rem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new reminder
 * 
 * @param {string} userID - User who set the reminder
 * @param {string} userName - User's display name
 * @param {string} threadID - Group chat thread ID
 * @param {string} message - Reminder message
 * @param {Date} reminderTime - When to send the reminder
 * @returns {{ success: boolean, reminder?: Object, error?: string }}
 */
function createReminder(userID, userName, threadID, message, reminderTime) {
    try {
        // Validate time is in the future
        if (reminderTime <= new Date()) {
            return { success: false, error: "The reminder time must be in the future!" };
        }
        
        // Validate time is not too far (max 30 days)
        const maxTime = new Date();
        maxTime.setDate(maxTime.getDate() + 30);
        if (reminderTime > maxTime) {
            return { success: false, error: "Reminders can only be set up to 30 days in advance." };
        }
        
        const id = generateId();
        const reminder = {
            id,
            userID,
            userName,
            threadID,
            message,
            reminderTime: reminderTime.toISOString(),
            preReminderSent: false,
            reminderSent: false,
            createdAt: new Date().toISOString(),
        };
        
        reminders[id] = reminder;
        saveReminders();
        
        // Check if there's enough time for a pre-reminder (15 minutes)
        const now = new Date();
        const preReminderTime = new Date(reminderTime.getTime() - PRE_REMINDER_MINUTES * 60 * 1000);
        const hasPreReminder = preReminderTime > now;
        
        log.info(`[Reminder] Created: "${message}" for ${userName} at ${reminderTime.toLocaleString()} (pre-reminder: ${hasPreReminder})`);
        
        return { success: true, reminder, hasPreReminder };
    } catch (err) {
        log.error(`[Reminder] Failed to create: ${err.message}`);
        return { success: false, error: "Failed to create reminder." };
    }
}

/**
 * Get all reminders for a user
 * @param {string} userID - User ID
 * @returns {Object[]}
 */
function getUserReminders(userID) {
    return Object.values(reminders).filter(r => r.userID === userID && !r.reminderSent);
}

/**
 * Get all reminders for a thread
 * @param {string} threadID - Thread ID
 * @returns {Object[]}
 */
function getThreadReminders(threadID) {
    return Object.values(reminders).filter(r => r.threadID === threadID && !r.reminderSent);
}

/**
 * Delete a reminder
 * @param {string} id - Reminder ID
 * @returns {boolean}
 */
function deleteReminder(id) {
    if (reminders[id]) {
        delete reminders[id];
        saveReminders();
        return true;
    }
    return false;
}

/**
 * Clear all reminders for a user
 * @param {string} userID - User ID
 * @returns {number} Number of reminders cleared
 */
function clearUserReminders(userID) {
    let count = 0;
    for (const id in reminders) {
        if (reminders[id].userID === userID) {
            delete reminders[id];
            count++;
        }
    }
    if (count > 0) {
        saveReminders();
    }
    return count;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REMINDER CHECKER (Background Task)
// ═══════════════════════════════════════════════════════════════════════════════

let checkInterval = null;
let apiInstance = null;

/**
 * Format time nicely
 * @param {Date} date 
 * @returns {string}
 */
function formatTime(date) {
    return date.toLocaleTimeString("en-US", { 
        hour: "numeric", 
        minute: "2-digit",
        hour12: true 
    });
}

/**
 * Check and send due reminders
 */
async function checkReminders() {
    if (!apiInstance) return;
    
    const now = new Date();
    
    for (const id in reminders) {
        const reminder = reminders[id];
        const reminderTime = new Date(reminder.reminderTime);
        
        // Skip if already fully sent
        if (reminder.reminderSent) continue;
        
        // Calculate pre-reminder time (15 minutes before)
        const preReminderTime = new Date(reminderTime.getTime() - PRE_REMINDER_MINUTES * 60 * 1000);
        
        // Check for pre-reminder (15 minutes before)
        // Only send if the pre-reminder time is in the future when the reminder was created
        // (i.e., skip if the reminder was set for less than 15 minutes from creation)
        const createdAt = new Date(reminder.createdAt);
        const wasSetWithEnoughTime = preReminderTime > createdAt;
        
        if (!reminder.preReminderSent && wasSetWithEnoughTime && now >= preReminderTime && now < reminderTime) {
            try {
                const message = `⏰ **Reminder Alert!**\n\n` +
                    `Hey @${reminder.userName}! Just a heads up—your reminder is coming up in ${PRE_REMINDER_MINUTES} minutes!\n\n` +
                    `📝 **Reminder**: ${reminder.message}\n` +
                    `🕐 **Time**: ${formatTime(reminderTime)}\n\n` +
                    `Get ready! I'll remind you again when it's time. 💪`;
                
                await apiInstance.sendMessage(
                    {
                        body: message,
                        mentions: [{ tag: `@${reminder.userName}`, id: reminder.userID }],
                    },
                    reminder.threadID
                );
                
                reminder.preReminderSent = true;
                saveReminders();
                
                log.info(`[Reminder] Pre-reminder sent for: ${reminder.message}`);
            } catch (err) {
                log.error(`[Reminder] Failed to send pre-reminder: ${err.message}`);
            }
        }
        
        // Check for main reminder (at the time)
        if (!reminder.reminderSent && now >= reminderTime) {
            try {
                const message = `🔔 **TIME'S UP!**\n\n` +
                    `@${reminder.userName}, this is your reminder!\n\n` +
                    `📝 **${reminder.message}**\n\n` +
                    `⏰ It's now ${formatTime(now)}. Time to get moving! 🚀`;
                
                await apiInstance.sendMessage(
                    {
                        body: message,
                        mentions: [{ tag: `@${reminder.userName}`, id: reminder.userID }],
                    },
                    reminder.threadID
                );
                
                reminder.reminderSent = true;
                
                log.success(`[Reminder] Reminder sent for: ${reminder.message}`);
                
                // Delete reminder immediately after sending
                deleteReminder(id);
                log.info(`[Reminder] Removed from storage: ${reminder.message}`);
                
            } catch (err) {
                log.error(`[Reminder] Failed to send reminder: ${err.message}`);
            }
        }
    }
}

/**
 * Start the reminder checker background task
 * @param {Object} api - Facebook API instance
 */
function startReminderChecker(api) {
    if (checkInterval) {
        clearInterval(checkInterval);
    }
    
    apiInstance = api;
    checkInterval = setInterval(checkReminders, CHECK_INTERVAL);
    
    // Run immediately
    checkReminders();
    
    log.info(`[Reminder] Background checker started (interval: ${CHECK_INTERVAL / 1000}s)`);
}

/**
 * Stop the reminder checker
 */
function stopReminderChecker() {
    if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
    }
    apiInstance = null;
    log.info("[Reminder] Background checker stopped");
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    parseReminderInput,
    createReminder,
    getUserReminders,
    getThreadReminders,
    deleteReminder,
    clearUserReminders,
    startReminderChecker,
    stopReminderChecker,
    formatTime,
};
