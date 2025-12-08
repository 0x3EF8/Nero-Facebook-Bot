/**
 * Nickname Utilities Module
 * Handles changing user nicknames in group chats
 * 
 * @module utils/nickname
 */

const chalk = require("chalk");

/**
 * Change nickname for a user in the group
 * @param {Object} api - Facebook API instance
 * @param {string} threadID - Thread identifier
 * @param {string} targetID - Target user ID
 * @param {string} nickname - New nickname
 * @returns {Promise<boolean>} Success status
 */
async function changeNickname(api, threadID, targetID, nickname) {
  try {
    console.log(chalk.cyan(`   └─ Calling api.nickname("${nickname}", "${threadID}", "${targetID}")`));

    const result = await api.nickname(nickname, threadID, targetID);

    console.log(chalk.green(`   └─ API result:`, result));

    if (result === false || (result && result.error)) {
      throw new Error(result.error || "API returned false");
    }

    return true;
  } catch (err) {
    console.error(chalk.red("❌ Failed to change nickname:"), err.message || err);
    return false;
  }
}

module.exports = {
  changeNickname,
};
