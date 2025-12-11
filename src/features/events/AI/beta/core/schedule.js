/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                         CLASS SCHEDULE MODULE                                 ║
 * ║              IT Schedule Knowledge Base for Beta AI                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module core/schedule
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULE DATA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Complete IT class schedule
 * @type {Object}
 */
const CLASS_SCHEDULE = {
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
    Saturday: [
        { subject: 'IT - Systems Admin & Maintenance', code: 'IT 314 (3218)', time: '08:30 AM', duration: 60, teacher: 'Marnuld Climaco', room: 'ILLC' },
        { subject: 'IT - Analytic Tools and Techniques', code: 'IT 311 (3215)', time: '02:00 PM', duration: 60, teacher: 'Evangeline Javier', room: 'ILLC' },
        { subject: 'IT - Integrative Programming & Tech 1', code: 'IT 315 (3219)', time: '04:00 PM', duration: 60, teacher: 'Liloy Hoyla', room: 'ILLC' },
        { subject: 'IT - IT Elective 2', code: 'IT EL 2 (3221)', time: '05:00 PM', duration: 60, teacher: 'Liloy Hoyla', room: '407' },
        { subject: 'IT - Social Issues & Professional Practice', code: 'IT 313 (3217)', time: '06:30 PM', duration: 60, teacher: 'Haidee Galdo', room: '409' }
    ],
    Sunday: []
};

/**
 * Subject quick reference
 * @type {Object}
 */
const SUBJECTS = {
    'Theo 3b': { name: 'IT - The Commandments', teacher: 'Father Garnet', days: 'MW', time: '10:30 AM', room: '411' },
    'IT 311': { name: 'IT - Analytic Tools and Techniques', teacher: 'Evangeline Javier', days: 'TThS', time: '2:00 PM', room: 'ILLC' },
    'IT 312': { name: 'IT - Analytics Modeling', teacher: 'Evangeline Javier', days: 'MWF', time: '4:00 PM', room: '409' },
    'IT 313': { name: 'IT - Social Issues & Professional Practice', teacher: 'Haidee Galdo', days: 'TThS', time: '6:30 PM', room: '409' },
    'IT 314': { name: 'IT - Systems Admin & Maintenance', teacher: 'Marnuld Climaco', days: 'TThS', time: '8:30 AM', room: 'ILLC' },
    'IT 315': { name: 'IT - Integrative Programming & Tech 1', teacher: 'Liloy Hoyla', days: 'TThS', time: '4:00 PM', room: 'ILLC' },
    'IT EL 1': { name: 'IT - IT Elective 1', teacher: 'Yvonne Tenio', days: 'MWF', time: '11:30 AM', room: '422' },
    'IT EL 2': { name: 'IT - IT Elective 2', teacher: 'Liloy Hoyla', days: 'TThS', time: '5:00 PM', room: '407' }
};

/**
 * Timezone for schedule calculations
 */
const TIMEZONE = 'Asia/Manila';

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get current Manila time
 * @returns {Date}
 */
function getManilaTime() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
}

/**
 * Convert 12-hour time to minutes since midnight
 * @param {string} time12h - Time in 12-hour format
 * @returns {number}
 */
function timeToMinutes(time12h) {
    const [time, modifier] = time12h.split(' ');
    const [h, minutes] = time.split(':').map(Number);
    let hours = h;
    
    if (modifier === 'PM' && hours !== 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    
    return hours * 60 + minutes;
}

/**
 * Get today's day name
 * @returns {string}
 */
function getTodayName() {
    return getManilaTime().toLocaleDateString('en-US', { weekday: 'long', timeZone: TIMEZONE });
}

/**
 * Get tomorrow's day name
 * @returns {string}
 */
function getTomorrowName() {
    const tomorrow = getManilaTime();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toLocaleDateString('en-US', { weekday: 'long', timeZone: TIMEZONE });
}

/**
 * Get next school day (skips Sunday)
 * @returns {string}
 */
function getNextSchoolDay() {
    const tomorrow = getTomorrowName();
    return tomorrow === 'Sunday' ? 'Monday' : tomorrow;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get today's classes
 * @returns {Array}
 */
function getTodayClasses() {
    const today = getTodayName();
    return CLASS_SCHEDULE[today] || [];
}

/**
 * Get tomorrow's classes
 * @returns {Array}
 */
function getTomorrowClasses() {
    const tomorrow = getTomorrowName();
    return CLASS_SCHEDULE[tomorrow] || [];
}

/**
 * Get next class (current or upcoming today)
 * @returns {Object|null}
 */
function getNextClass() {
    const now = getManilaTime();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const todayClasses = getTodayClasses();
    
    // Find next class today
    for (const cls of todayClasses) {
        const classMinutes = timeToMinutes(cls.time);
        if (classMinutes > currentMinutes) {
            return { ...cls, day: getTodayName(), isToday: true };
        }
    }
    
    // No more classes today, get first class of next school day
    const nextDay = getNextSchoolDay();
    const nextDayClasses = CLASS_SCHEDULE[nextDay] || [];
    if (nextDayClasses.length > 0) {
        return { ...nextDayClasses[0], day: nextDay, isToday: false };
    }
    
    return null;
}

/**
 * Get current ongoing class
 * @returns {Object|null}
 */
function getCurrentClass() {
    const now = getManilaTime();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const todayClasses = getTodayClasses();
    
    for (const cls of todayClasses) {
        const startMinutes = timeToMinutes(cls.time);
        const endMinutes = startMinutes + cls.duration;
        
        if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
            return { ...cls, day: getTodayName() };
        }
    }
    
    return null;
}

/**
 * Get remaining classes for today
 * @returns {Array}
 */
function getRemainingClassesToday() {
    const now = getManilaTime();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const todayClasses = getTodayClasses();
    
    return todayClasses.filter(cls => {
        const classMinutes = timeToMinutes(cls.time);
        return classMinutes > currentMinutes;
    });
}

/**
 * Get classes for a specific day
 * @param {string} dayName 
 * @returns {Array}
 */
function getClassesForDay(dayName) {
    const normalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1).toLowerCase();
    return CLASS_SCHEDULE[normalizedDay] || [];
}

/**
 * Search for a specific subject
 * @param {string} query 
 * @returns {Object|null}
 */
function findSubject(query) {
    const lowerQuery = query.toLowerCase();
    
    for (const [code, info] of Object.entries(SUBJECTS)) {
        if (code.toLowerCase().includes(lowerQuery) || 
            info.name.toLowerCase().includes(lowerQuery) ||
            info.teacher.toLowerCase().includes(lowerQuery)) {
            return { code, ...info };
        }
    }
    
    return null;
}

/**
 * Get full weekly schedule summary
 * @returns {string}
 */
function getWeeklyScheduleSummary() {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let summary = '';
    
    for (const day of days) {
        const classes = CLASS_SCHEDULE[day];
        if (classes.length > 0) {
            summary += `\n${day}: ${classes.length} class(es)\n`;
            classes.forEach(cls => {
                summary += `  • ${cls.time} - ${cls.subject} (${cls.room})\n`;
            });
        }
    }
    
    return summary;
}

/**
 * Format class info for display
 * @param {Object} cls 
 * @returns {string}
 */
function formatClassInfo(cls) {
    return `📖 ${cls.subject}\n🔢 ${cls.code}\n⏰ ${cls.time}\n👨‍🏫 ${cls.teacher}\n🏫 Room ${cls.room}`;
}

/**
 * Get time of day greeting
 * @returns {string}
 */
function getTimeGreeting() {
    const now = getManilaTime();
    const hour = now.getHours();
    
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
}

/**
 * Calculate time until next class
 * @param {Object} nextClass 
 * @returns {string|null}
 */
function getTimeUntilClass(nextClass) {
    if (!nextClass || !nextClass.isToday) return null;
    
    const now = getManilaTime();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const classMinutes = timeToMinutes(nextClass.time);
    const diff = classMinutes - currentMinutes;
    
    if (diff <= 0) return null;
    
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    
    if (hours > 0) {
        return `${hours}h ${mins}m`;
    }
    return `${mins} minutes`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULE CONTEXT FOR AI
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build schedule context for AI prompt
 * @returns {string}
 */
function buildScheduleContext() {
    const now = getManilaTime();
    const today = getTodayName();
    const currentDate = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: TIMEZONE
    });
    const currentTime = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true,
        timeZone: TIMEZONE 
    });
    
    const timeOfDay = getTimeGreeting();
    const currentClass = getCurrentClass();
    const nextClass = getNextClass();
    const remainingToday = getRemainingClassesToday();
    const tomorrowClasses = getTomorrowClasses();
    const timeUntil = nextClass ? getTimeUntilClass(nextClass) : null;
    
    // Build concise data for AI
    let scheduleData = `
[SYSTEM TIME AWARENESS]
Current: ${currentDate}, ${currentTime} (Manila)
Day Period: ${timeOfDay}

[CLASS STATUS]
`;

    if (currentClass) {
        scheduleData += `NOW: ${currentClass.subject} with ${currentClass.teacher} @ Room ${currentClass.room}\n`;
    }
    
    if (nextClass) {
        const when = timeUntil ? `in ${timeUntil}` : nextClass.day;
        scheduleData += `NEXT: ${nextClass.subject} at ${nextClass.time} (${when}) - ${nextClass.teacher} @ ${nextClass.room}\n`;
    }
    
    if (remainingToday.length > 0) {
        scheduleData += `TODAY LEFT: ${remainingToday.length} classes\n`;
    } else if (today !== 'Sunday') {
        scheduleData += `TODAY: Done! No more classes!\n`;
    }

    if (tomorrowClasses.length > 0) {
        scheduleData += `TOMORROW: ${tomorrowClasses.length} classes, first at ${tomorrowClasses[0].time}\n`;
    }

    scheduleData += `
[FULL SCHEDULE DATA]
MW: Theo 3b 10:30AM (Father Garnet/411), IT EL 1 11:30AM (Yvonne Tenio/422)
MWF: IT 312 4PM (Evangeline Javier/409)
TThS: IT 314 8:30AM (Marnuld Climaco/ILLC), IT 311 2PM (Evangeline Javier/ILLC), IT 315 4PM (Liloy Hoyla/ILLC), IT EL 2 5PM (Liloy Hoyla/407), IT 313 6:30PM (Haidee Galdo/409)

[RESPONSE INSTRUCTIONS]
When user asks about schedule/class/time, respond NATURALLY like this:

Example responses:
- "Hey! It's ${currentTime} right now. ${nextClass ? `Your next class is ${nextClass.subject} at ${nextClass.time}${timeUntil ? ` - that's ${timeUntil} from now` : ''}. Good luck! 🍀` : `No more classes today! Rest well! 🎉`}"
- "Oh! ${timeOfDay === 'morning' ? 'Good morning!' : timeOfDay === 'afternoon' ? 'Good afternoon!' : timeOfDay === 'evening' ? 'Good evening!' : 'Still awake?'} ${remainingToday.length > 0 ? `You still have ${remainingToday.length} class${remainingToday.length > 1 ? 'es' : ''} today.` : `You're done for today! 🎉`}"
- "It's ${currentDate}. ${currentClass ? `You're in ${currentClass.subject} right now - stay focused! 📚` : nextClass ? `Next up: ${nextClass.subject} at ${nextClass.time}. You got this! 💪` : `Free time! Enjoy! 🌟`}"

IMPORTANT RESPONSE STYLE:
- Sound like a friendly AI assistant, NOT a schedule bot
- Be conversational: "Hey!", "Oh!", "Hmm let me check...", "Alright!"
- Add encouragement naturally: "Good luck!", "You got this!", "You can do it!"
- Use emojis sparingly but warmly: 🍀 💪 📚 🎉 ✨
- DON'T list all classes unless asked - just answer what they need
- DON'T use bullet points or formatted lists - talk naturally
- If class is coming up: wish them luck!
- If classes are done: celebrate with them!
- Sound human and caring, not robotic`;

    return scheduleData;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    CLASS_SCHEDULE,
    SUBJECTS,
    TIMEZONE,
    getManilaTime,
    getTodayName,
    getTomorrowName,
    getTodayClasses,
    getTomorrowClasses,
    getNextClass,
    getCurrentClass,
    getRemainingClassesToday,
    getClassesForDay,
    findSubject,
    getWeeklyScheduleSummary,
    formatClassInfo,
    buildScheduleContext,
};
