/**
 * Class Schedule Reminder - Background Task
 * Version: 6.3 (Fixed Multi-group Unsend)
 */

"use strict";

const logger = require("../../utils/logger");
const config = require("../../config/config");

/**
 * @typedef {Object} ClassInfo
 * @property {string} subject, code, time, teacher, room
 * @property {number} duration
 */

function convert12to24(time12h) {
    const [time, modifier] = time12h.split(" ");
    const [hoursStr, minutesStr] = time.split(":");
    let hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);

    if (modifier === "PM" && hours !== 12) hours += 12;
    if (modifier === "AM" && hours === 12) hours = 0;

    return { hours, minutes };
}

function getTimeParts(timezone) {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "long",
        hour: "numeric",
        minute: "numeric",
        hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const partMap = {};
    parts.forEach(({ type, value }) => (partMap[type] = value));

    return {
        weekday: partMap.weekday,
        hour: parseInt(partMap.hour, 10) % 24,
        minute: parseInt(partMap.minute, 10),
    };
}

function shouldSend30MinReminder(classTime, currentHour, currentMinute) {
    const { hours: classHours, minutes: classMinutes } = convert12to24(classTime);
    const classTotalMinutes = classHours * 60 + classMinutes;
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    let diff = classTotalMinutes - currentTotalMinutes;
    if (diff < 0) diff += 1440;
    return diff === 30;
}

function shouldSendExactTimeReminder(classTime, currentHour, currentMinute) {
    const { hours: classHours, minutes: classMinutes } = convert12to24(classTime);
    return classHours * 60 + classMinutes === currentHour * 60 + currentMinute;
}

function getClassKey(dayName, classInfo) {
    return `${dayName}-${classInfo.code}-${classInfo.time.replace(/\s/g, "")}`;
}

module.exports = {
    config: {
        name: "classSchedule",
        description: "Reminders 30 mins before and at class time with auto-unsend",
        enabled: true,
        interval: 60000,
    },

    TIMEZONE: config.bot?.timeZone || "Asia/Manila",
    UNSEND_30MIN_ON_CLASS_START: true,
    UNSEND_CLASS_START_AFTER: 60 * 60 * 1000,

    sentMessages: {
        thirtyMinReminders: new Map(),
        classStartMessages: new Map(),
    },

    sentReminders: new Set(),

    schedules: [
        {
            name: "Section U",
            targetGroups: ["24052714344355754", "24425853360351937"],
            data: {
                Monday: [
                    {
                        subject: "IT - The Commandments",
                        code: "Theo 3b (3214)",
                        time: "10:30 AM",
                        duration: 60,
                        teacher: "Father Garnet",
                        room: "411",
                    },
                    {
                        subject: "IT - Analytics Modeling",
                        code: "IT 312 (3216)",
                        time: "04:00 PM",
                        duration: 60,
                        teacher: "Evangeline Javier",
                        room: "409",
                    },
                    {
                        subject: "IT - IT Elective 1",
                        code: "IT EL 1 (3220)",
                        time: "05:00 PM",
                        duration: 60,
                        teacher: "Yvonne Tenio",
                        room: "422",
                    },
                ],
                Tuesday: [
                    {
                        subject: "IT - Systems Admin & Maintenance",
                        code: "IT 314 (3218)",
                        time: "08:30 AM",
                        duration: 60,
                        teacher: "Marnuld Climaco",
                        room: "ILLC",
                    },
                    {
                        subject: "IT - Analytic Tools and Techniques",
                        code: "IT 311 (3215)",
                        time: "02:00 PM",
                        duration: 60,
                        teacher: "Evangeline Javier",
                        room: "ILLC",
                    },
                    {
                        subject: "IT - Integrative Programming & Tech 1",
                        code: "IT 315 (3219)",
                        time: "04:00 PM",
                        duration: 60,
                        teacher: "Liloy Hoyla",
                        room: "ILLC",
                    },
                    {
                        subject: "IT - IT Elective 2",
                        code: "IT EL 2 (3221)",
                        time: "05:00 PM",
                        duration: 60,
                        teacher: "Liloy Hoyla",
                        room: "407",
                    },
                    {
                        subject: "IT - Social Issues & Professional Practice",
                        code: "IT 313 (3217)",
                        time: "06:30 PM",
                        duration: 60,
                        teacher: "Haidee Galdo",
                        room: "409",
                    },
                ],
                Wednesday: [
                    {
                        subject: "IT - The Commandments",
                        code: "Theo 3b (3214)",
                        time: "10:30 AM",
                        duration: 60,
                        teacher: "Father Garnet",
                        room: "411",
                    },
                    {
                        subject: "IT - Analytics Modeling",
                        code: "IT 312 (3216)",
                        time: "04:00 PM",
                        duration: 60,
                        teacher: "Evangeline Javier",
                        room: "409",
                    },
                    {
                        subject: "IT - IT Elective 1",
                        code: "IT EL 1 (3220)",
                        time: "05:00 PM",
                        duration: 60,
                        teacher: "Yvonne Tenio",
                        room: "422",
                    },
                ],
                Thursday: [
                    {
                        subject: "IT - Systems Admin & Maintenance",
                        code: "IT 314 (3218)",
                        time: "08:30 AM",
                        duration: 60,
                        teacher: "Marnuld Climaco",
                        room: "ILLC",
                    },
                    {
                        subject: "IT - Analytic Tools and Techniques",
                        code: "IT 311 (3215)",
                        time: "02:00 PM",
                        duration: 60,
                        teacher: "Evangeline Javier",
                        room: "ILLC",
                    },
                    {
                        subject: "IT - Integrative Programming & Tech 1",
                        code: "IT 315 (3219)",
                        time: "04:00 PM",
                        duration: 60,
                        teacher: "Liloy Hoyla",
                        room: "ILLC",
                    },
                    {
                        subject: "IT - IT Elective 2",
                        code: "IT EL 2 (3221)",
                        time: "05:00 PM",
                        duration: 60,
                        teacher: "Liloy Hoyla",
                        room: "407",
                    },
                    {
                        subject: "IT - Social Issues & Professional Practice",
                        code: "IT 313 (3217)",
                        time: "06:30 PM",
                        duration: 60,
                        teacher: "Haidee Galdo",
                        room: "409",
                    },
                ],
                Friday: [
                    {
                        subject: "IT - Analytics Modeling",
                        code: "IT 312 (3216)",
                        time: "04:00 PM",
                        duration: 60,
                        teacher: "Evangeline Javier",
                        room: "409",
                    },
                    {
                        subject: "IT - IT Elective 1",
                        code: "IT EL 1 (3220)",
                        time: "05:00 PM",
                        duration: 60,
                        teacher: "Yvonne Tenio",
                        room: "422",
                    },
                ],
            },
        },
        {
            name: "Section T",
            targetGroups: ["30192447580399370"],
            data: {
                Monday: [
                    {
                        subject: "IT - Integrative Programming and Tech 1",
                        code: "IT 315 (3210)",
                        time: "11:30 AM",
                        duration: 60,
                        teacher: "Liloy Hoyla",
                        room: "409",
                    },
                    {
                        subject: "IT - Analytic Tools and Techniques",
                        code: "IT 311 (3206)",
                        time: "02:00 PM",
                        duration: 60,
                        teacher: "Evangeline Javier",
                        room: "409",
                    },
                    {
                        subject: "IT - Systems Admin and Maintenance",
                        code: "IT 314 (3209)",
                        time: "04:00 PM",
                        duration: 60,
                        teacher: "Marnuld Climaco",
                        room: "408",
                    },
                    {
                        subject: "IT - Analytics Modeling",
                        code: "IT 312 (3207)",
                        time: "05:30 PM",
                        duration: 60,
                        teacher: "Evangeline Javier",
                        room: "421",
                    },
                    {
                        subject: "IT - Social Issues and Professional Practice",
                        code: "IT 313 (3208)",
                        time: "06:30 PM",
                        duration: 60,
                        teacher: "Haidee Galdo",
                        room: "409",
                    },
                ],
                Tuesday: [
                    {
                        subject: "IT - IT Elective 2",
                        code: "IT EL 2 (3212)",
                        time: "11:30 AM",
                        duration: 60,
                        teacher: "Liloy Hoyla",
                        room: "IILC",
                    },
                    {
                        subject: "IT - The Commandments",
                        code: "Theo 3b (3213)",
                        time: "02:00 PM",
                        duration: 60,
                        teacher: "Father Garnet",
                        room: "321",
                    },
                    {
                        subject: "IT - IT Elective 1",
                        code: "IT EL 1 (3211)",
                        time: "03:00 PM",
                        duration: 60,
                        teacher: "Yvonne Tenio",
                        room: "422",
                    },
                ],
                Wednesday: [
                    {
                        subject: "IT - Integrative Programming and Tech 1",
                        code: "IT 315 (3210)",
                        time: "11:30 AM",
                        duration: 60,
                        teacher: "Liloy Hoyla",
                        room: "409",
                    },
                    {
                        subject: "IT - Analytic Tools and Techniques",
                        code: "IT 311 (3206)",
                        time: "02:00 PM",
                        duration: 60,
                        teacher: "Evangeline Javier",
                        room: "409",
                    },
                    {
                        subject: "IT - Systems Admin and Maintenance",
                        code: "IT 314 (3209)",
                        time: "04:00 PM",
                        duration: 60,
                        teacher: "Marnuld Climaco",
                        room: "408",
                    },
                    {
                        subject: "IT - Analytics Modeling",
                        code: "IT 312 (3207)",
                        time: "05:30 PM",
                        duration: 60,
                        teacher: "Evangeline Javier",
                        room: "421",
                    },
                    {
                        subject: "IT - Social Issues and Professional Practice",
                        code: "IT 313 (3208)",
                        time: "06:30 PM",
                        duration: 60,
                        teacher: "Haidee Galdo",
                        room: "409",
                    },
                ],
                Thursday: [
                    {
                        subject: "IT - IT Elective 2",
                        code: "IT EL 2 (3212)",
                        time: "11:30 AM",
                        duration: 60,
                        teacher: "Liloy Hoyla",
                        room: "IILC",
                    },
                    {
                        subject: "IT - The Commandments",
                        code: "Theo 3b (3213)",
                        time: "02:00 PM",
                        duration: 60,
                        teacher: "Father Garnet",
                        room: "321",
                    },
                    {
                        subject: "IT - IT Elective 1",
                        code: "IT EL 1 (3211)",
                        time: "03:00 PM",
                        duration: 60,
                        teacher: "Yvonne Tenio",
                        room: "422",
                    },
                ],
                Friday: [
                    {
                        subject: "IT - Integrative Programming and Tech 1",
                        code: "IT 315 (3210)",
                        time: "11:30 AM",
                        duration: 60,
                        teacher: "Liloy Hoyla",
                        room: "409",
                    },
                    {
                        subject: "IT - Analytic Tools and Techniques",
                        code: "IT 311 (3206)",
                        time: "02:00 PM",
                        duration: 60,
                        teacher: "Evangeline Javier",
                        room: "409",
                    },
                    {
                        subject: "IT - Systems Admin and Maintenance",
                        code: "IT 314 (3209)",
                        time: "04:00 PM",
                        duration: 60,
                        teacher: "Marnuld Climaco",
                        room: "408",
                    },
                    {
                        subject: "IT - Analytics Modeling",
                        code: "IT 312 (3207)",
                        time: "05:30 PM",
                        duration: 60,
                        teacher: "Evangeline Javier",
                        room: "421",
                    },
                    {
                        subject: "IT - Social Issues and Professional Practice",
                        code: "IT 313 (3208)",
                        time: "06:30 PM",
                        duration: 60,
                        teacher: "Haidee Galdo",
                        room: "409",
                    },
                ],
                Saturday: [
                    {
                        subject: "IT - IT Elective 2",
                        code: "IT EL 2 (3212)",
                        time: "11:30 AM",
                        duration: 60,
                        teacher: "Liloy Hoyla",
                        room: "IILC",
                    },
                    {
                        subject: "IT - IT Elective 1",
                        code: "IT EL 1 (3211)",
                        time: "03:00 PM",
                        duration: 60,
                        teacher: "Yvonne Tenio",
                        room: "422",
                    },
                ],
            },
        },
    ],

    async cleanupOldClassStartMessages(api) {
        const now = Date.now();
        for (const [key, data] of this.sentMessages.classStartMessages) {
            if (now - data.sentAt >= this.UNSEND_CLASS_START_AFTER) {
                try {
                    await api.unsendMessage(data.messageId);
                    this.sentMessages.classStartMessages.delete(key);
                } catch (_err) {
                    this.sentMessages.classStartMessages.delete(key);
                }
            }
        }
    },

    async execute({ api }) {
        try {
            const { weekday: dayName, hour, minute } = getTimeParts(this.TIMEZONE);

            await this.cleanupOldClassStartMessages(api);

            // Iterate over each schedule section
            for (const section of this.schedules) {
                const todayClasses = section.data[dayName];
                if (!todayClasses) continue;

                for (const classInfo of todayClasses) {
                    // Make key unique per section
                    const classKey = getClassKey(dayName, classInfo) + `-${section.name}`;
                    const reminderKey30 = `30min-${classKey}`;
                    const reminderKeyExact = `exact-${classKey}`;

                    // 1. Send 30-minute Reminder
                    if (
                        shouldSend30MinReminder(classInfo.time, hour, minute) &&
                        !this.sentReminders.has(reminderKey30)
                    ) {
                        const message =
                            `📚 𝗖𝗟𝗔𝗦𝗦 𝗥𝗘𝗠𝗜𝗡𝗗𝗘𝗥 (𝟯𝟬 𝗺𝗶𝗻𝘀)\n` +
                            `📌 ${section.name}\n\n` +
                            `📖 Subject: ${classInfo.subject}\n` +
                            `🔢 Code: ${classInfo.code}\n` +
                            `⏰ Time: ${classInfo.time}\n` +
                            `👨‍🏫 Teacher: ${classInfo.teacher}\n` +
                            `🏫 Room: ${classInfo.room}\n\n` +
                            `⚡ Class starts in 30 minutes!`;

                        for (const threadId of section.targetGroups) {
                            try {
                                const sendFn = api.sendMessageDirect || api.sendMessage;
                                const msgInfo = await sendFn(message, threadId);

                                if (this.UNSEND_30MIN_ON_CLASS_START && msgInfo?.messageID) {
                                    this.sentMessages.thirtyMinReminders.set(
                                        `${classKey}-${threadId}`,
                                        {
                                            messageId: msgInfo.messageID,
                                            sentAt: Date.now(),
                                        }
                                    );
                                }
                            } catch (_err) {
                                logger.error(
                                    "ClassSchedule",
                                    `30min error (${section.name}): ${_err.message}`
                                );
                            }
                        }
                        this.sentReminders.add(reminderKey30);
                    }

                    // 2. Send Exact Time Reminder & Unsend 30min
                    if (
                        shouldSendExactTimeReminder(classInfo.time, hour, minute) &&
                        !this.sentReminders.has(reminderKeyExact)
                    ) {
                        const message =
                            `🔔 𝗖𝗟𝗔𝗦𝗦 𝗦𝗧𝗔𝗥𝗧𝗜𝗡𝗚 𝗡𝗢𝗪!\n` +
                            `📌 ${section.name}\n\n` +
                            `📖 Subject: ${classInfo.subject}\n` +
                            `🔢 Code: ${classInfo.code}\n` +
                            `⏰ Time: ${classInfo.time}\n` +
                            `👨‍🏫 Teacher: ${classInfo.teacher}\n` +
                            `🏫 Room: ${classInfo.room}\n\n` +
                            `🚀 Your class is starting NOW!`;

                        for (const threadId of section.targetGroups) {
                            const oldKey = `${classKey}-${threadId}`;
                            if (this.sentMessages.thirtyMinReminders.has(oldKey)) {
                                const oldData = this.sentMessages.thirtyMinReminders.get(oldKey);
                                try {
                                    await api.unsendMessage(oldData.messageId);
                                } catch (_e) {
                                    // Ignore unsend errors
                                }
                                this.sentMessages.thirtyMinReminders.delete(oldKey);
                            }

                            try {
                                const sendFn = api.sendMessageDirect || api.sendMessage;
                                const msgInfo = await sendFn(message, threadId);

                                if (msgInfo?.messageID) {
                                    this.sentMessages.classStartMessages.set(
                                        `${classKey}-${threadId}`,
                                        {
                                            messageId: msgInfo.messageID,
                                            sentAt: Date.now(),
                                        }
                                    );
                                }
                            } catch (_err) {
                                logger.error(
                                    "ClassSchedule",
                                    `Start error (${section.name}): ${_err.message}`
                                );
                            }
                        }
                        this.sentReminders.add(reminderKeyExact);
                    }
                }
            }

            if (hour === 0 && minute === 0) {
                this.sentReminders.clear();
                this.sentMessages.thirtyMinReminders.clear();
                this.sentMessages.classStartMessages.clear();
            }
        } catch (error) {
            logger.error("ClassSchedule", `Execution error: ${error.message}`);
        }
    },
};
