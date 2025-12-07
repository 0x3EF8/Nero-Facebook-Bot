/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  ✦ Nero Command - stalk
 * ═══════════════════════════════════════════════════════════════════════════
 *  @author 0x3EF8
 *  @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════
 */

const https = require("https");
const { PassThrough } = require("stream");

module.exports.config = {
  name: "stalk",
  aliases: ["profile", "userinfo", "whois", "fbinfo"],
  description: "Get detailed information about a Facebook user including profile picture and cover photo",
  usage: "stalk [@mention | reply to message | UID]",
  category: "user",
  cooldown: 5,
  permissions: {
    user: true,
    admin: true,
    superAdmin: true,
  },
  enabled: true,
  dmOnly: false,
  groupOnly: false,
};

/**
 * Fetch image from URL as stream with proper filename
 */
function fetchImage(url, filename) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { timeout: 10000 }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return fetchImage(response.headers.location, filename).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to fetch image: ${response.statusCode}`));
      }
      const passThrough = new PassThrough();
      passThrough.path = filename; // This tells FB the file type
      response.pipe(passThrough);
      resolve(passThrough);
    });
    request.on("error", reject);
    request.on("timeout", () => {
      request.destroy();
      reject(new Error("Request timeout"));
    });
  });
}

/**
 * Estimate account creation period from UID
 */
function estimateAccountAge(uid) {
  const uidNum = parseInt(uid);
  if (isNaN(uidNum)) return null;
  
  if (uidNum < 1000000) return "2004-2006";
  if (uidNum < 10000000) return "2006-2008";
  if (uidNum < 100000000) return "2008-2010";
  if (uidNum < 1000000000) return "2010-2012";
  if (uidNum < 10000000000) return "2012-2015";
  if (uidNum < 100000000000) return "2015-2018";
  return "2018-Present";
}

module.exports.execute = async function ({ api, event, args }) {
  const { threadID, messageID, senderID, messageReply, mentions } = event;

  let targetID = null;

  if (messageReply && messageReply.senderID) {
    targetID = messageReply.senderID;
  } else if (mentions && Object.keys(mentions).length > 0) {
    targetID = Object.keys(mentions)[0];
  } else if (args[0]) {
    const potentialUID = args[0].replace(/[^0-9]/g, "");
    if (potentialUID && potentialUID.length >= 10) {
      targetID = potentialUID;
    } else {
      return api.sendMessage("Invalid UID format.", threadID, messageID);
    }
  } else {
    targetID = senderID;
  }

  try {
    const userInfo = await new Promise((resolve, reject) => {
      api.getUserInfo(targetID, true, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    if (!userInfo) {
      return api.sendMessage("Could not fetch user information.", threadID, messageID);
    }

    const formatGender = (gender) => {
      if (!gender) return "Not specified";
      const g = gender.toLowerCase();
      if (g === "male" || g === "male_singular") return "Male";
      if (g === "female" || g === "female_singular") return "Female";
      return gender;
    };

    const lines = [
      `𝗨𝗦𝗘𝗥 𝗣𝗥𝗢𝗙𝗜𝗟𝗘`,
      ``,
      `Name: ${userInfo.name || "Unknown"}`,
    ];

    if (userInfo.firstName && userInfo.lastName) {
      lines.push(`First Name: ${userInfo.firstName}`);
      lines.push(`Last Name: ${userInfo.lastName}`);
    }

    lines.push(`User ID: ${userInfo.id || targetID}`);
    
    if (userInfo.vanity) {
      lines.push(`Username: @${userInfo.vanity}`);
    }

    lines.push(`Gender: ${formatGender(userInfo.gender)}`);
    
    if (userInfo.type) {
      lines.push(`Account Type: ${userInfo.type}`);
    }

    const ageEstimate = estimateAccountAge(targetID);
    if (ageEstimate) {
      lines.push(`Est. Created: ${ageEstimate}`);
    }

    if (userInfo.bio) {
      lines.push(``);
      lines.push(`Bio: ${userInfo.bio}`);
    }

    if (userInfo.headline) {
      lines.push(`Headline: ${userInfo.headline}`);
    }

    if (userInfo.live_city) {
      lines.push(`Location: ${userInfo.live_city}`);
    }

    lines.push(``);
    lines.push(`Verified: ${userInfo.isVerified ? "Yes" : "No"}`);
    lines.push(`Birthday Today: ${userInfo.isBirthday ? "Yes" : "No"}`);
    lines.push(`Friend: ${userInfo.isFriend ? "Yes" : "No"}`);

    if (userInfo.followers) {
      lines.push(`Followers: ${userInfo.followers}`);
    }

    if (userInfo.following) {
      lines.push(`Following: ${userInfo.following}`);
    }

    lines.push(``);
    lines.push(`Profile: ${userInfo.profileUrl || `https://facebook.com/${targetID}`}`);

    const message = lines.join("\n");

    // Fetch profile picture and cover photo
    const attachments = [];
    const fetchPromises = [];

    if (userInfo.profilePicUrl) {
      fetchPromises.push(
        fetchImage(userInfo.profilePicUrl, `profile_${targetID}.jpg`)
          .then(stream => { attachments.unshift(stream); })
          .catch(() => {})
      );
    }

    if (userInfo.coverPhoto) {
      fetchPromises.push(
        fetchImage(userInfo.coverPhoto, `cover_${targetID}.jpg`)
          .then(stream => { attachments.push(stream); })
          .catch(() => {})
      );
    }

    await Promise.all(fetchPromises);

    api.sendMessage({ 
      body: message, 
      attachment: attachments.length > 0 ? attachments : undefined 
    }, threadID, messageID);
  } catch (error) {
    console.error("[STALK]", error);
    return api.sendMessage(`Error: ${error.message || "Unknown error"}`, threadID, messageID);
  }
};
