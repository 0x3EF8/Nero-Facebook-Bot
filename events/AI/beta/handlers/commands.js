/**
 * Command Handler Module
 * Handles special commands from AI responses
 * 
 * @module handlers/commands
 */

const chalk = require("chalk");

const { downloadMusic } = require("../services/music");
const { downloadVideo } = require("../services/video");
const { getWeather } = require("../services/weather");
const { users } = require("../core/users");
const { generateRandomPairs, formatPairsMessage, analyzeLoveCompatibility } = require("../utils/pairing");
const { changeNickname } = require("../utils/nickname");

/**
 * Handle special commands in AI response
 * @param {Object} params - Handler parameters
 * @returns {Promise<boolean>} True if command was handled
 */
async function handleCommands({ api, _event, response, text, threadID, senderID, userName, messageID }) {
  const reply = response.trim();
  
  // Get all members for nickname commands
  const allMembers = await users.getAllGroupMembers(api, threadID);

  // ═══════════════════════════════════════════════════════════════
  // NICKNAME COMMANDS (Check these FIRST before music to avoid conflicts)
  // ═══════════════════════════════════════════════════════════════

  // Bulk nickname changes (change all members)
  const bulkMatch = reply.match(/NICKNAME_BULK:\s*(.+)/i);
  if (bulkMatch) {
    const bulkData = bulkMatch[1];
    const changes = bulkData.split("||").map((pair) => {
      const [id, name] = pair.split("|");
      return { id: id?.trim(), name: name?.trim() };
    }).filter((change) => {
      // Validate that ID is a real user ID (not an array index)
      const isValid = change.id && change.id.length > 5 && /^\d+$/.test(change.id);
      if (!isValid) {
        console.log(chalk.red(` ├─✗ Invalid ID detected: ${change.id} - Skipping`));
      }
      return isValid;
    });

    if (changes.length === 0) {
      console.log(chalk.red(` ├─✗ No valid user IDs found in bulk change request`));
      await api.sendMessage(
        "⚠️ Please use the actual user IDs from the group members list, not array indexes. Try again!",
        threadID,
        messageID
      );
      api.setMessageReaction("❌", messageID, () => {}, true);
      return true;
    }

    console.log(chalk.cyan(` ├─🎭 Bulk nickname change: ${changes.length} members`));
    api.setMessageReaction("⏳", messageID, () => {}, true);

    let successCount = 0;
    let failCount = 0;

    for (const change of changes) {
      const memberName = allMembers.get(change.id) || "Unknown";
      console.log(chalk.yellow(` ├─  Changing ${memberName} (${change.id}) to "${change.name}"`));
      const success = await changeNickname(api, threadID, change.id, change.name);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
      // Small delay between changes to avoid rate limiting
      await new Promise((resolve) => { setTimeout(resolve, 500); });
    }

    console.log(chalk.green(` ├─✓ Bulk complete: ${successCount} success, ${failCount} failed`));

    await api.sendMessage(
      `✨ Done! Changed ${successCount} nickname${successCount !== 1 ? "s" : ""} successfully! 🎭\n\n💡 Tip: I can also change individual nicknames! Try "beta change my name to [nickname]"`,
      threadID,
      messageID
    );
    api.setMessageReaction("✅", messageID, () => {}, true);
    return true;
  }

  // Clear all nicknames
  const clearAllMatch = reply.match(/NICKNAME_CLEAR_ALL/i);
  if (clearAllMatch) {
    console.log(chalk.cyan(` ├─🧹 Clearing all nicknames`));
    api.setMessageReaction("⏳", messageID, () => {}, true);

    let successCount = 0;
    let failCount = 0;

    for (const [userID, memberName] of allMembers.entries()) {
      console.log(chalk.yellow(` ├─  Clearing nickname for ${memberName} (${userID})`));
      const success = await changeNickname(api, threadID, userID, "");
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
      await new Promise((resolve) => { setTimeout(resolve, 500); });
    }

    console.log(chalk.green(` ├─✓ Clear all complete: ${successCount} success, ${failCount} failed`));

    await api.sendMessage(
      `✨ Cleared ${successCount} nickname${successCount !== 1 ? "s" : ""}! Everyone's back to their default names. 🧹`,
      threadID,
      messageID
    );
    api.setMessageReaction("✅", messageID, () => {}, true);
    return true;
  }

  // Clear single nickname
  const clearMatch = reply.match(/NICKNAME_CLEAR:\s*(\d+)/i);
  if (clearMatch) {
    let targetID = clearMatch[1].trim();

    // Override with sender's ID if "my name" is mentioned
    const textLower = text.toLowerCase();
    if (textLower.includes("my name") || textLower.includes("my nickname")) {
      targetID = senderID;
    }

    const targetName = allMembers.get(targetID) || "User";
    console.log(chalk.cyan(` ├─🧹 Clearing nickname for ${targetName} (${targetID})`));

    const success = await changeNickname(api, threadID, targetID, "");
    if (success) {
      api.setMessageReaction("✅", messageID, () => {}, true);
      await api.sendMessage(`✅ Nickname cleared for ${targetName}!`, threadID, messageID);
    } else {
      api.setMessageReaction("❌", messageID, () => {}, true);
      await api.sendMessage("❌ Failed to clear nickname.", threadID, messageID);
    }
    return true;
  }

  // Single nickname change
  const nicknameMatch = reply.match(/NICKNAME_CHANGE:\s*(\d+)\s*\|\s*(.+)/i);
  if (nicknameMatch) {
    const targetID = nicknameMatch[1].trim();
    const newNickname = nicknameMatch[2].trim();
    console.log(chalk.cyan(` ├─📝 Changing nickname for ${targetID} to "${newNickname}"`));

    const success = await changeNickname(api, threadID, targetID, newNickname);
    if (success) {
      api.setMessageReaction("✅", messageID, () => {}, true);
      await api.sendMessage(`✅ Nickname changed to "${newNickname}"!`, threadID, messageID);
    } else {
      api.setMessageReaction("❌", messageID, () => {}, true);
      await api.sendMessage("❌ Failed to change nickname. I might not have permission.", threadID, messageID);
    }
    return true;
  }

  // ═══════════════════════════════════════════════════════════════
  // MUSIC & VIDEO COMMANDS
  // ═══════════════════════════════════════════════════════════════

  // Music suggestion
  const musicSuggestionMatch = reply.match(/MUSIC_SUGGESTION:\s*(.+?)\s*\|\s*(.+)/i);
  if (musicSuggestionMatch) {
    const searchQuery = musicSuggestionMatch[1].trim();
    const explanation = musicSuggestionMatch[2].trim();
    console.log(chalk.cyan(` ├─🎵 Music suggestion: "${searchQuery}"`));

    await api.sendMessage(explanation, threadID, messageID);
    const wantsLyrics = /\b(lyrics?|letra|lirika)\b/i.test(text);
    await downloadMusic(api, threadID, messageID, searchQuery, null, wantsLyrics);
    return true;
  }

  // Music download
  const musicMatch = reply.match(/MUSIC_DOWNLOAD:\s*(.+)/i);
  if (musicMatch) {
    const searchQuery = musicMatch[1].trim();
    console.log(chalk.cyan(` ├─🎵 Music download: "${searchQuery}"`));

    const wantsLyrics = /\b(lyrics?|letra|lirika)\b/i.test(text);
    await downloadMusic(api, threadID, messageID, searchQuery, null, wantsLyrics);
    return true;
  }

  // Video download
  const videoMatch = reply.match(/VIDEO_DOWNLOAD:\s*(.+)/i);
  if (videoMatch) {
    const searchQuery = videoMatch[1].trim();
    console.log(chalk.cyan(` ├─🎬 Video download: "${searchQuery}"`));

    await downloadVideo(api, threadID, messageID, searchQuery, null);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════
  // OTHER COMMANDS
  // ═══════════════════════════════════════════════════════════════

  // Weather check
  const weatherMatch = reply.match(/WEATHER_CHECK:\s*(.+)/i);
  if (weatherMatch) {
    const location = weatherMatch[1].trim();
    console.log(chalk.cyan(` ├─🌤️ Weather check: "${location}"`));

    await getWeather(api, threadID, messageID, location);
    return true;
  }

  // Date/Time check
  if (reply.includes("DATETIME_CHECK")) {
    const now = new Date();
    const manilaTime = now.toLocaleString("en-US", {
      timeZone: "Asia/Manila",
      dateStyle: "full",
      timeStyle: "long",
    });

    await api.sendMessage(`📅 Current Date & Time\n\n🕐 ${manilaTime}\n📍 Timezone: Asia/Manila (PHT)`, threadID, messageID);
    api.setMessageReaction("✅", messageID, () => {}, true);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════
  // PAIRING COMMANDS
  // ═══════════════════════════════════════════════════════════════

  // Pair me with someone
  if (reply.includes("PAIR_ME")) {
    console.log(chalk.cyan(` ├─💕 AI analyzing genders and pairing ${userName}...`));
    api.setMessageReaction("🔍", messageID, () => {}, true);

    if (allMembers.size < 2) {
      await api.sendMessage("❌ Not enough members in the group for pairing.", threadID, messageID);
      return true;
    }

    const { pairs } = await generateRandomPairs(allMembers, senderID, false);
    
    if (pairs.length > 0 && pairs[0].person2) {
      const p1 = pairs[0].person1;
      const p2 = pairs[0].person2;
      
      // Use Gemini AI for real love compatibility analysis
      const { percent, message } = await analyzeLoveCompatibility(
        p1.name, p1.gender,
        p2.name, p2.gender
      );
      
      api.setMessageReaction("💕", messageID, () => {}, true);
      await api.sendMessage(
        `💘 AI Love Match\n${p1.gender || ""} ${p1.name}\n     💕\n${p2.gender || ""} ${p2.name}\n\n💯 Love compatibility: ${percent}%\n💬 ${message}`,
        threadID,
        messageID
      );
    } else {
      api.setMessageReaction("❌", messageID, () => {}, true);
      await api.sendMessage("❌ Couldn't find a match. Try again!", threadID, messageID);
    }
    return true;
  }

  // Pair with specific @mentioned users
  if (reply.includes("PAIR_WITH")) {
    const mentions = _event.mentions || {};
    const mentionedIDs = Object.keys(mentions);
    
    console.log(chalk.cyan(` ├─💕 AI pairing with mentions: ${mentionedIDs.length} user(s)...`));
    api.setMessageReaction("🔍", messageID, () => {}, true);

    if (mentionedIDs.length === 0) {
      await api.sendMessage("❌ Please mention someone to pair with! Example: beta pair @person", threadID, messageID);
      api.setMessageReaction("❌", messageID, () => {}, true);
      return true;
    }

    let person1, person2;

    if (mentionedIDs.length >= 2) {
      // Two mentions: pair them together
      const id1 = mentionedIDs[0];
      const id2 = mentionedIDs[1];
      const name1 = allMembers.get(id1) || mentions[id1]?.replace(/@/g, "") || "User 1";
      const name2 = allMembers.get(id2) || mentions[id2]?.replace(/@/g, "") || "User 2";
      
      person1 = { id: id1, name: name1 };
      person2 = { id: id2, name: name2 };
    } else {
      // One mention: pair mentioned user with a random member (not sender, not themselves)
      const targetID = mentionedIDs[0];
      const targetName = allMembers.get(targetID) || mentions[targetID]?.replace(/@/g, "") || "User";

      // Build pool of possible matches (exclude sender and mentioned user)
      const pool = Array.from(allMembers.entries())
        .filter(([id]) => id !== targetID && id !== senderID)
        .map(([id, name]) => ({ id, name }));

      if (pool.length === 0) {
        await api.sendMessage("❌ No other members to pair with!", threadID, messageID);
        api.setMessageReaction("❌", messageID, () => {}, true);
        return true;
      }

      // Pick a random member from pool
      const randomIndex = Math.floor(Math.random() * pool.length);
      const randomMember = pool[randomIndex];

      person1 = { id: targetID, name: targetName };
      person2 = { id: randomMember.id, name: randomMember.name };
    }

    // Get AI-powered love analysis
    const { analyzeGenders } = require("../utils/pairing");
    const { males, females } = await analyzeGenders([person1, person2]);
    
    // Determine genders
    const gender1 = males.some(m => m.id === person1.id) ? "♂️" : 
                    females.some(m => m.id === person1.id) ? "♀️" : "❓";
    const gender2 = males.some(m => m.id === person2.id) ? "♂️" : 
                    females.some(m => m.id === person2.id) ? "♀️" : "❓";

    const { percent, message } = await analyzeLoveCompatibility(
      person1.name, gender1,
      person2.name, gender2
    );
    
    api.setMessageReaction("💕", messageID, () => {}, true);
    await api.sendMessage(
      `💘 AI Love Match\n${gender1} ${person1.name}\n     💕\n${gender2} ${person2.name}\n\n💯 Love compatibility: ${percent}%\n💬 ${message}`,
      threadID,
      messageID
    );
    return true;
  }

  // Random pairs for everyone
  if (reply.includes("PAIR_RANDOM")) {
    console.log(chalk.cyan(` ├─💕 AI analyzing genders and creating pairs...`));
    api.setMessageReaction("🔍", messageID, () => {}, true);

    if (allMembers.size < 2) {
      await api.sendMessage("❌ Not enough members for pairing.", threadID, messageID);
      return true;
    }

    const { pairs, stats } = await generateRandomPairs(allMembers, null, true);
    
    api.setMessageReaction("💕", messageID, () => {}, true);
    const formattedMessage = await formatPairsMessage(pairs, stats);
    await api.sendMessage(formattedMessage, threadID, messageID);
    return true;
  }

  return false;
}

module.exports = {
  handleCommands,
};
