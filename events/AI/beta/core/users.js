/**
 * User Management Module
 * Handles user name resolution and caching
 * 
 * @module core/users
 */

const chalk = require("chalk");

// Name cache storage
const nameCache = new Map(); // senderID -> displayName

/**
 * Robust user name resolver with multiple fallback strategies
 * @param {Object} api - Facebook API instance
 * @param {string} senderID - User's Facebook ID
 * @param {Object} event - Message event object
 * @returns {Promise<string>} User's display name
 */
async function getName(api, senderID, event) {
  // Strategy 1: Check event object for immediate name
  if (event && (event.senderName || event.sender_fullname || event.name)) {
    const name = event.senderName || event.sender_fullname || event.name;
    nameCache.set(senderID, name);
    return name;
  }

  // Strategy 2: Check cache for previously resolved name
  if (nameCache.has(senderID)) {
    return nameCache.get(senderID);
  }

  // Strategy 3: Query API for user information
  try {
    if (typeof api.getUserInfo === "function") {
      let info = null;

      // Try both array and single ID formats
      try {
        info = await api.getUserInfo([senderID]);
      } catch {
        info = await api.getUserInfo(senderID);
      }

      // Parse various response formats
      let name = null;

      if (!info) {
        name = null;
      } else if (Array.isArray(info) && info.length > 0) {
        const entry = info.find((e) => e.id === senderID || e.userID === senderID) || info[0];
        name = entry && (entry.name || entry.fullName || entry.username || entry.displayName);
      } else if (typeof info === "object") {
        if (info[senderID]) {
          const entry = info[senderID];
          name = entry && (entry.name || entry.fullName || entry.displayName || entry.username);
        } else {
          name = info.name || info.fullName || info.displayName || info.username;
        }
      }

      if (name) {
        nameCache.set(senderID, name);
        return name;
      }
    }
  } catch (err) {
    console.warn(chalk.yellow("⚠ getUserInfo failed:"), err.message || err);
  }

  // Strategy 4: Try thread participant list
  try {
    if (typeof api.getThreadInfo === "function" && event && event.threadID) {
      const tinfo = await api.getThreadInfo(event.threadID);

      // Check participants array
      if (tinfo && Array.isArray(tinfo.participants)) {
        const p = tinfo.participants.find(
          (p) =>
            String(p.id || p.userID) === String(senderID) ||
            String(p.fbId) === String(senderID)
        );

        if (p) {
          const name = p.name || p.fullName || p.displayName;
          if (name) {
            nameCache.set(senderID, name);
            return name;
          }
        }
      }

      // Check userInfo object
      if (tinfo && typeof tinfo.userInfo === "object") {
        const entry =
          tinfo.userInfo[senderID] ||
          Object.values(tinfo.userInfo).find((x) => x.id === senderID);

        if (entry) {
          const name = entry.name || entry.fullName || entry.displayName;
          if (name) {
            nameCache.set(senderID, name);
            return name;
          }
        }
      }
    }
  } catch {
    // Silent fail - this is a fallback strategy
  }

  // Strategy 5: Use senderID as last resort
  const fallback = String(senderID);
  nameCache.set(senderID, fallback);
  return fallback;
}

/**
 * Get all members in a group chat
 * @param {Object} api - Facebook API instance
 * @param {string} threadID - Thread identifier
 * @returns {Promise<Map>} Map of userID -> userName
 */
async function getAllGroupMembers(api, threadID) {
  const members = new Map();

  try {
    if (typeof api.getThreadInfo === "function") {
      const threadInfo = await api.getThreadInfo(threadID);

      // userInfo is an ARRAY of user objects
      if (threadInfo && Array.isArray(threadInfo.userInfo)) {
        for (const user of threadInfo.userInfo) {
          const userID = String(user.id || user.userID);
          const userName = user.name || user.fullName || user.firstName || userID;

          if (userID && userID !== "undefined" && userID.length > 5 && /^\d+$/.test(userID)) {
            members.set(userID, userName);
            nameCache.set(userID, userName);
          }
        }
      }

      // Fallback: Check if userInfo is an object
      if (threadInfo && typeof threadInfo.userInfo === "object" && !Array.isArray(threadInfo.userInfo)) {
        for (const [uid, info] of Object.entries(threadInfo.userInfo)) {
          const userName = info.name || info.fullName || info.displayName || uid;

          if (uid && uid.length > 5 && /^\d+$/.test(uid)) {
            members.set(uid, userName);
            nameCache.set(uid, userName);
          }
        }
      }

      // Check deprecated participants array format
      if (threadInfo && Array.isArray(threadInfo.participants)) {
        for (const participant of threadInfo.participants) {
          const userID = String(participant.id || participant.userID || participant.fbId);
          const userName = participant.name || participant.fullName || participant.displayName || userID;

          if (userID && userID !== "undefined" && userID.length > 5 && /^\d+$/.test(userID)) {
            if (!members.has(userID)) {
              members.set(userID, userName);
              nameCache.set(userID, userName);
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn(chalk.yellow("⚠ Failed to get all group members:"), err.message || err);
  }

  return members;
}

/**
 * Get cached name for a user
 * @param {string} userID - User ID
 * @returns {string|null} Cached name or null
 */
function getCachedName(userID) {
  return nameCache.get(userID) || null;
}

/**
 * Set cached name for a user
 * @param {string} userID - User ID
 * @param {string} name - User name
 */
function setCachedName(userID, name) {
  nameCache.set(userID, name);
}

module.exports = {
  users: {
    getName,
    getAllGroupMembers,
    getCachedName,
    setCachedName,
  },
};
