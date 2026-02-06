/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                       NICKNAME UTILITIES MODULE                               ║
 * ║          Handles changing user nicknames in group chats                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module utils/nickname
 * @author 0x3EF8
 * @version 2.0.0
 *
 * Features:
 * - Single nickname change with error handling
 * - Bulk nickname operations
 * - Detailed error logging in debug mode
 */

"use strict";

const { DEBUG } = require("../core/constants");

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL LOGGER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Internal logger
 * @private
 */
const log = {
    info: (msg) => DEBUG && console.log(`[Nickname] ℹ ${msg}`),
    success: (msg) => DEBUG && console.log(`[Nickname] ✓ ${msg}`),
    error: (msg) => console.error(`[Nickname] ✗ ${msg}`),
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Change nickname for a user in the group
 *
 * @param {Object} api - Facebook API instance
 * @param {string} threadID - Thread identifier
 * @param {string} targetID - Target user ID
 * @param {string} nickname - New nickname (empty string to clear)
 * @returns {Promise<boolean>} Success status
 */
async function changeNickname(api, threadID, targetID, nickname) {
    try {
        log.info(`Changing nickname for ${targetID} to "${nickname || "(clear)"}"`);

        const result = await api.nickname(nickname, threadID, targetID);

        // Check for API errors
        if (result === false || (result && result.error)) {
            throw new Error(result?.error || "API returned false");
        }

        log.success(`Nickname changed for ${targetID}`);
        return true;
    } catch (err) {
        log.error(`Failed to change nickname: ${err.message || err}`);
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    changeNickname,
};
