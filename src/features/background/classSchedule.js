/**
 * Class Schedule Reminder - Background Task
 * Version: 6.1 (Direct Send - No Human Behavior Delays)
 * 
 * Sends reminders 30 minutes before class and at class start time.
 * Features:
 * - Uses sendMessageDirect for accurate timing (no human behavior delays)
 * - Auto-unsends 30-min reminder when class starts
 * - Auto-unsends class-start message after 30 minutes
 * - Clean object literal architecture
 * 
 * @module background/classSchedule
 */

"use strict";

const logger = require('../../utils/logger');
const config = require('../../config/config');

/**
 * @typedef {Object} ClassInfo
 * @property {string} subject - Subject name
 * @property {string} code - Course code
 * @property {string} time - Class time in 12-hour format (e.g., "07:00 AM")
 * @property {number} duration - Duration in minutes
 * @property {string} teacher - Teacher name
 * @property {string} room - Room location
 */

/**
 * @typedef {Object} SentMessageData
 * @property {string} messageId - Message ID from API
 * @property {string} threadId - Thread/Group ID
 * @property {number} sentAt - Timestamp when sent
 */

/**
 * @typedef {Object} TimeComponents
 * @property {number} hours - Hours in 24-hour format
 * @property {number} minutes - Minutes
 */

/**
 * Convert 12-hour time string to 24-hour format
 * @param {string} time12h - Time in 12-hour format (e.g., "07:00 AM")
 * @returns {TimeComponents} Hours and minutes in 24-hour format
 */
function convert12to24(time12h) {
    const [time, modifier] = time12h.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    let adjustedHours = hours;
    
    if (modifier === 'PM' && adjustedHours !== 12) adjustedHours += 12;
    if (modifier === 'AM' && adjustedHours === 12) adjustedHours = 0;
    
    return { hours: adjustedHours, minutes };
}

/**
 * Get current time parts in target timezone
 * @param {string} timezone - Target timezone
 * @returns {{weekday: string, hour: number, minute: number}}
 */
function getTimeParts(timezone) {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'long',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
    });
    
    const parts = formatter.formatToParts(now);
    const partMap = {};
    parts.forEach(({ type, value }) => partMap[type] = value);
    
    return {
        weekday: partMap.weekday,
        hour: parseInt(partMap.hour, 10) % 24, // Handle 24h format
        minute: parseInt(partMap.minute, 10)
    };
}

/**
 * Check if we should send 30-minute reminder
 * @param {string} classTime - Class time in 12-hour format
 * @param {number} currentHour - Current hour (0-23)
 * @param {number} currentMinute - Current minute (0-59)
 * @returns {boolean} True if should send reminder
 */
function shouldSend30MinReminder(classTime, currentHour, currentMinute) {
    const { hours: classHours, minutes: classMinutes } = convert12to24(classTime);
    
    const classTotalMinutes = classHours * 60 + classMinutes;
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    
    // Calculate difference handling day wrap-around (though classes are usually same day)
    let diff = classTotalMinutes - currentTotalMinutes;
    if (diff < 0) diff += 24 * 60; // Handle next day case if needed
    
    return diff === 30;
}

/**
 * Check if we should send exact time reminder
 * @param {string} classTime - Class time in 12-hour format
 * @param {number} currentHour - Current hour (0-23)
 * @param {number} currentMinute - Current minute (0-59)
 * @returns {boolean} True if should send reminder
 */
function shouldSendExactTimeReminder(classTime, currentHour, currentMinute) {
    const { hours: classHours, minutes: classMinutes } = convert12to24(classTime);
    
    const classTotalMinutes = classHours * 60 + classMinutes;
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    
    return classTotalMinutes === currentTotalMinutes;
}

/**
 * Generate class key for tracking
 * @param {string} dayName - Day of the week
 * @param {ClassInfo} classInfo - Class information
 * @returns {string} Unique key for the class
 */
function getClassKey(dayName, classInfo) {
    return `${dayName}-${classInfo.code}-${classInfo.time}`;
}

module.exports = {
    config: {
        name: 'classSchedule',
        description: 'Sends class schedule reminders 30 mins before and at class time with auto-unsend',
        enabled: false,
        interval: 60000,
    },

    /** @type {string[]} Target group IDs */
    TARGET_GROUPS: ['24052714344355754', '24425853360351937'],
    
    /** @type {string} Timezone for time calculations */
    TIMEZONE: config.bot.timeZone,
    
    /** @type {boolean} Whether to unsend 30-min reminder when class starts */
    UNSEND_30MIN_ON_CLASS_START: true,
    
    /** @type {number} Time to wait before unsending class start message (ms) */
    UNSEND_CLASS_START_AFTER: 60 * 60 * 1000, // 60 minutes in ms

    /** 
     * Track sent messages for auto-unsend
     * @type {{thirtyMinReminders: Map<string, SentMessageData>, classStartMessages: Map<string, SentMessageData>}}
     */
    sentMessages: {
        thirtyMinReminders: new Map(),
        classStartMessages: new Map()
    },

    /**
     * Class schedule data organized by day
     * @type {Object<string, ClassInfo[]>}
     */
    schedule: {
        Monday: [
            { subject: 'IT - The Commandments', code: 'Theo 3b (3214)', time: '10:30 AM', duration: 60, teacher: 'Father Garnet', room: '411' },
            { subject: 'IT - IT Elective 1', code: 'IT EL 1 (3220)', time: '11:30 AM', duration: 60, teacher: 'Yvonne Tenio', room: '422' },
            { subject: 'IT - Analytics Modeling', code: 'IT 312 (3216)', time: '04:00 PM', duration: 60, teacher: 'Evangeline Javier', room: '409' }
        ],
        Tuesday: [
            { subject: 'IT - Systems Admin & Maintenance', code: 'IT 314 (3218)', time: '08:30 AM', duration: 60, teacher: 'Marnuld Climaco', room: 'ILLC' },
            { subject: 'IT - Analytic Tools and Techniques', code: 'IT 311 (3215)', time: '02:00 PM', duration: 60, teacher: 'Evangeline Javier', room: 'ILLC' },
            { subject: 'IT - Integrative Programming & Tech 1', code: 'IT 315 (3219)', time: '04:00 PM', duration: 60, teacher: 'Liloy Hoyla', room: 'ILLC' },
            { subject: 'IT - IT Elective 2', code: 'IT EL 2 (3221)', time: '05:00 PM', duration: 60, teacher: 'Liloy Hoyla', room: '407' },
            { subject: 'IT - Social Issues & Professional Practice', code: 'IT 313 (3217)', time: '06:30 PM', duration: 60, teacher: 'Haidee Galdo', room: '409' }
        ],
        Wednesday: [
            { subject: 'IT - The Commandments', code: 'Theo 3b (3214)', time: '10:30 AM', duration: 60, teacher: 'Father Garnet', room: '411' },
            { subject: 'IT - IT Elective 1', code: 'IT EL 1 (3220)', time: '11:30 AM', duration: 60, teacher: 'Yvonne Tenio', room: '422' },
            { subject: 'IT - Analytics Modeling', code: 'IT 312 (3216)', time: '04:00 PM', duration: 60, teacher: 'Evangeline Javier', room: '409' }
        ],
        Thursday: [
            { subject: 'IT - Systems Admin & Maintenance', code: 'IT 314 (3218)', time: '08:30 AM', duration: 60, teacher: 'Marnuld Climaco', room: 'ILLC' },
            { subject: 'IT - Analytic Tools and Techniques', code: 'IT 311 (3215)', time: '02:00 PM', duration: 60, teacher: 'Evangeline Javier', room: 'ILLC' },
            { subject: 'IT - Integrative Programming & Tech 1', code: 'IT 315 (3219)', time: '04:00 PM', duration: 60, teacher: 'Liloy Hoyla', room: 'ILLC' },
            { subject: 'IT - IT Elective 2', code: 'IT EL 2 (3221)', time: '05:00 PM', duration: 60, teacher: 'Liloy Hoyla', room: '407' },
            { subject: 'IT - Social Issues & Professional Practice', code: 'IT 313 (3217)', time: '06:30 PM', duration: 60, teacher: 'Haidee Galdo', room: '409' }
        ],
        Friday: [
            { subject: 'IT - IT Elective 1', code: 'IT EL 1 (3220)', time: '11:30 AM', duration: 60, teacher: 'Yvonne Tenio', room: '422' },
            { subject: 'IT - Analytics Modeling', code: 'IT 312 (3216)', time: '04:00 PM', duration: 60, teacher: 'Evangeline Javier', room: '409' }
        ],
        /*
        Saturday: [
            { subject: 'IT - Systems Admin & Maintenance', code: 'IT 314 (3218)', time: '08:30 AM', duration: 60, teacher: 'Marnuld Climaco', room: 'ILLC' },
            { subject: 'IT - Analytic Tools and Techniques', code: 'IT 311 (3215)', time: '02:00 PM', duration: 60, teacher: 'Evangeline Javier', room: 'ILLC' },
            { subject: 'IT - Integrative Programming & Tech 1', code: 'IT 315 (3219)', time: '04:00 PM', duration: 60, teacher: 'Liloy Hoyla', room: 'ILLC' },
            { subject: 'IT - IT Elective 2', code: 'IT EL 2 (3221)', time: '05:00 PM', duration: 60, teacher: 'Liloy Hoyla', room: '407' },
            { subject: 'IT - Social Issues & Professional Practice', code: 'IT 313 (3217)', time: '06:30 PM', duration: 60, teacher: 'Haidee Galdo', room: '409' }
        ]
        */
    },

    /** @type {Set<string>} Track already sent reminders to prevent duplicates */
    sentReminders: new Set(),

    /**
     * Auto-unsend old class start messages (after 30 minutes)
     * @param {Object} api - Nero API instance
     * @returns {Promise<void>}
     */
    async cleanupOldClassStartMessages(api) {
        const now = Date.now();
        const toDelete = [];

        for (const [key, data] of this.sentMessages.classStartMessages) {
            if (now - data.sentAt >= this.UNSEND_CLASS_START_AFTER) {
                toDelete.push({ key, data });
            }
        }

        for (const { key, data } of toDelete) {
            try {
                await api.unsendMessage(data.messageId);
                this.sentMessages.classStartMessages.delete(key);
                logger.info('ClassSchedule', `Auto-unsent class start message for ${key}`);
            } catch (err) {
                logger.error('ClassSchedule', `Failed to unsend message ${data.messageId}: ${err.message}`);
                this.sentMessages.classStartMessages.delete(key);
            }
        }
    },

    /**
     * Main execution function - called on interval
     * @param {Object} context - Execution context
     * @param {Object} context.api - Nero API instance
     * @param {Object} context.config - Bot configuration
     * @param {Object} context.logger - Logger utility
     * @returns {Promise<void>}
     */
    async execute({ api }) {
        try {
            // Get precise time parts for the target timezone
            const timeParts = getTimeParts(this.TIMEZONE);
            const { weekday: dayName, hour, minute } = timeParts;
            
            const todayClasses = this.schedule[dayName];

            // Cleanup old class start messages
            await this.cleanupOldClassStartMessages(api);

            if (!todayClasses || todayClasses.length === 0) {
                return; // No classes today (weekend)
            }

            for (const classInfo of todayClasses) {
                const classKey = getClassKey(dayName, classInfo);
                const reminderKey30 = `30min-${classKey}`;
                const reminderKeyExact = `exact-${classKey}`;

                // Check for 30-minute reminder
                if (shouldSend30MinReminder(classInfo.time, hour, minute) && !this.sentReminders.has(reminderKey30)) {
                    const message = `📚 𝗖𝗟𝗔𝗦𝗦 𝗥𝗘𝗠𝗜𝗡𝗗𝗘𝗥 (𝟯𝟬 𝗺𝗶𝗻𝘀)\n\n` +
                        `📖 Subject: ${classInfo.subject}\n` +
                        `🔢 Code: ${classInfo.code}\n` +
                        `⏰ Time: ${classInfo.time}\n` +
                        `⏱️ Duration: ${classInfo.duration} mins\n` +
                        `👨‍🏫 Teacher: ${classInfo.teacher}\n` +
                        `🏫 Room: ${classInfo.room}\n\n` +
                        `⚡ Class starts in 30 minutes! Get ready!`;

                    for (const threadId of this.TARGET_GROUPS) {
                        if (config.isThreadBlocked(threadId)) {
                            logger.debug('ClassSchedule', `Skipping blocked thread ${threadId}`);
                            continue;
                        }
                        try {
                            // Use sendMessageDirect for accurate timing (no human behavior delays)
                            const sendFn = api.sendMessageDirect || api.sendMessage;
                            const msgInfo = await sendFn(message, threadId);
                            
                            // Store for auto-unsend when class starts
                            if (this.UNSEND_30MIN_ON_CLASS_START && msgInfo?.messageID) {
                                this.sentMessages.thirtyMinReminders.set(classKey, {
                                    messageId: msgInfo.messageID,
                                    threadId: threadId,
                                    sentAt: Date.now()
                                });
                            }
                            
                            logger.info('ClassSchedule', `Sent 30-min reminder for ${classInfo.code} to ${threadId}`);
                        } catch (err) {
                            logger.error('ClassSchedule', `Failed to send to ${threadId}: ${err.message}`);
                        }
                    }
                    this.sentReminders.add(reminderKey30);
                }

                // Check for exact time reminder
                if (shouldSendExactTimeReminder(classInfo.time, hour, minute) && !this.sentReminders.has(reminderKeyExact)) {
                    
                    // First, unsend the 30-minute reminder if it exists
                    if (this.UNSEND_30MIN_ON_CLASS_START && this.sentMessages.thirtyMinReminders.has(classKey)) {
                        const reminderData = this.sentMessages.thirtyMinReminders.get(classKey);
                        try {
                            await api.unsendMessage(reminderData.messageId);
                            logger.info('ClassSchedule', `Auto-unsent 30-min reminder for ${classInfo.code}`);
                        } catch (err) {
                            logger.error('ClassSchedule', `Failed to unsend 30-min reminder: ${err.message}`);
                        }
                        this.sentMessages.thirtyMinReminders.delete(classKey);
                    }

                    const message = `🔔 𝗖𝗟𝗔𝗦𝗦 𝗦𝗧𝗔𝗥𝗧𝗜𝗡𝗚 𝗡𝗢𝗪!\n\n` +
                        `📖 Subject: ${classInfo.subject}\n` +
                        `🔢 Code: ${classInfo.code}\n` +
                        `⏰ Time: ${classInfo.time}\n` +
                        `⏱️ Duration: ${classInfo.duration} mins\n` +
                        `👨‍🏫 Teacher: ${classInfo.teacher}\n` +
                        `🏫 Room: ${classInfo.room}\n\n` +
                        `🚀 Your class is starting NOW! Don't be late!`;

                    for (const threadId of this.TARGET_GROUPS) {
                        if (config.isThreadBlocked(threadId)) {
                            logger.debug('ClassSchedule', `Skipping blocked thread ${threadId}`);
                            continue;
                        }
                        try {
                            // Use sendMessageDirect for accurate timing (no human behavior delays)
                            const sendFn = api.sendMessageDirect || api.sendMessage;
                            const msgInfo = await sendFn(message, threadId);
                            
                            // Store for auto-unsend after 30 minutes
                            if (msgInfo?.messageID) {
                                this.sentMessages.classStartMessages.set(`${classKey}-${threadId}`, {
                                    messageId: msgInfo.messageID,
                                    threadId: threadId,
                                    sentAt: Date.now()
                                });
                            }
                            
                            logger.info('ClassSchedule', `Sent class start reminder for ${classInfo.code} to ${threadId}`);
                        } catch (err) {
                            logger.error('ClassSchedule', `Failed to send to ${threadId}: ${err.message}`);
                        }
                    }
                    this.sentReminders.add(reminderKeyExact);
                }
            }

            // Clear old reminders at midnight
            if (hour === 0 && minute === 0) {
                this.sentReminders.clear();
                this.sentMessages.thirtyMinReminders.clear();
                this.sentMessages.classStartMessages.clear();
                logger.info('ClassSchedule', 'Cleared daily reminder cache');
            }

        } catch (error) {
            logger.error('ClassSchedule', `Execution error: ${error.message}`);
        }
    },
};
