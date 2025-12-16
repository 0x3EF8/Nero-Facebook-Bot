/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                              KICK COMMAND                                     ║
 * ║            Remove members from a group chat by mention, reply, or all         ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command removes members from a group chat:
 * - By mentioning specific users
 * - By replying to a user's message
 * - Remove all members (except bot and sender)
 * - Exclude specific users with "expt" flag
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

module.exports = {
    config: {
        name: "kick",
        aliases: ["remove", "boot", "out", "rm"],
        description: "Remove members from a group chat",
        usage: "kick [@mentions...] | [reply] | [all] [expt @excludes...]",
        category: "user",
        cooldown: 5,
        permissions: "user",
        enabled: true,
        dmOnly: false,
        groupOnly: true,
    },

    /**
     * Command execution function
     * @param {Object} context - Command context
     */
    async execute({ api, event, args, config, logger }) {
    const threadID = event.threadID;
    const senderID = event.senderID;
    const isGroup = event.isGroup;

    // Must be in a group
    if (!isGroup) {
        return api.sendMessage(`❌ This command only works in group chats!`, threadID);
    }

    // Check if gcmember API exists
    if (!api.gcmember) {
        return api.sendMessage(`❌ Member removal is not available in this API version.`, threadID);
    }

    // Check if bot is admin in this group
    try {
        const threadInfo = await api.getThreadInfo(threadID);
        const botID = api.getCurrentUserID();
        const adminIDs = threadInfo.adminIDs ? threadInfo.adminIDs.map((a) => a.id || a) : [];

        if (!adminIDs.includes(botID)) {
            return api.sendMessage(
                `❌ I need to be an admin to kick members!\n\n` +
                    `Please make me an admin first, then try again.`,
                threadID
            );
        }
    } catch (error) {
        return api.sendMessage(
            `❌ Could not verify admin status!\n\n` + `Error: ${error.message || error}`,
            threadID
        );
    }

    // Check if we have mentions
    const mentions = event.mentions || {};
    const mentionedIDs = Object.keys(mentions);

    // Parse arguments
    let removeAllMembers = false;
    let excludeMembers = false;
    let excludedIDs = [];
    let excludedNames = [];
    let argsLower = args.map((a) => a.toLowerCase());

    // Check for "all" flag - remove all members
    if (argsLower.includes("all")) {
        removeAllMembers = true;
        // Remove "all" from args
        args = args.filter((_, i) => argsLower[i] !== "all");
        argsLower = args.map((a) => a.toLowerCase());
    }

    // Check for "expt" (except) flag - exclude mentioned users from removal
    if (argsLower.includes("expt") || argsLower.includes("except") || argsLower.includes("exc")) {
        excludeMembers = true;
        // Remove "expt/except/exc" from args
        args = args.filter((_, i) => !["expt", "except", "exc"].includes(argsLower[i]));
        argsLower = args.map((a) => a.toLowerCase());

        // When using expt with all, mentioned users are the ones to KEEP
        if (removeAllMembers) {
            excludedIDs = [...mentionedIDs];
            excludedNames = Object.values(mentions).map((name) => name.replace("@", ""));
        }
    }

    let usersToKick = [];
    let userNames = [];

    // Case 1: Remove ALL members
    if (removeAllMembers) {
        try {
            // Send loading message
            const loadingMsg = await api.sendMessage("⏳ Fetching group members...", threadID);

            // Get current thread info
            const threadInfo = await api.getThreadInfo(threadID);

            if (!threadInfo || !threadInfo.participantIDs) {
                return api.sendMessage(
                    `❌ Could not get group members!\n\n` + `Please try again later.`,
                    threadID
                );
            }

            // Get all participant IDs (excluding the bot and sender)
            const botID = api.getCurrentUserID();
            let allParticipantIDs = threadInfo.participantIDs.filter(
                (id) => id.toString() !== botID.toString() && id.toString() !== senderID.toString()
            );

            // If excludeMembers is true, don't remove excluded users
            if (excludeMembers && excludedIDs.length > 0) {
                allParticipantIDs = allParticipantIDs.filter(
                    (id) => !excludedIDs.map((e) => e.toString()).includes(id.toString())
                );
            }

            usersToKick = allParticipantIDs;

            // Get user info for names
            try {
                const userInfo = await api.getUserInfo(usersToKick);
                userNames = usersToKick.map((id) => {
                    const user = userInfo[id];
                    return user ? user.name : `User ${id}`;
                });
            } catch {
                userNames = usersToKick.map((_, i) => `Member ${i + 1}`);
            }

            // Delete loading message
            if (loadingMsg && loadingMsg.messageID) {
                try {
                    await api.unsendMessage(String(loadingMsg.messageID));
                } catch {
                    // Ignore unsend error
                }
            }
        } catch (error) {
            return api.sendMessage(
                `❌ Failed to get group members!\n\n` + `Error: ${error.message || error}`,
                threadID
            );
        }
    }
    // Case 2: Remove by reply
    else if (event.messageReply && event.messageReply.senderID) {
        const replyUserID = event.messageReply.senderID;
        const botID = api.getCurrentUserID();

        // Don't allow kicking the bot
        if (replyUserID === botID) {
            return api.sendMessage(`❌ You can't kick me! 😅`, threadID);
        }

        // Don't allow kicking yourself
        if (replyUserID === senderID) {
            return api.sendMessage(`❌ You can't kick yourself!`, threadID);
        }

        usersToKick = [replyUserID];

        // Add mentioned users too if any
        if (mentionedIDs.length > 0) {
            mentionedIDs.forEach((id) => {
                if (id !== botID && id !== senderID && !usersToKick.includes(id)) {
                    usersToKick.push(id);
                }
            });
        }

        // Get user names
        try {
            const userInfo = await api.getUserInfo(usersToKick);
            userNames = usersToKick.map((id) => {
                const user = userInfo[id];
                return user ? user.name : `User ${id}`;
            });
        } catch {
            userNames = usersToKick.map((_, i) => `User ${i + 1}`);
        }
    }
    // Case 3: Remove by mentions
    else if (mentionedIDs.length > 0) {
        const botID = api.getCurrentUserID();

        // Filter out bot and sender
        usersToKick = mentionedIDs.filter((id) => id !== botID && id !== senderID);

        if (usersToKick.length === 0) {
            return api.sendMessage(
                `❌ Can't kick those users!\n\n` + `You can't kick the bot or yourself.`,
                threadID
            );
        }

        userNames = usersToKick.map((id) => {
            const name = mentions[id];
            return name ? name.replace("@", "") : `User ${id}`;
        });
    }
    // No target specified
    else {
        const actualPrefix = config.bot.prefixEnabled ? config.bot.prefix : '';
        const commandName = this.config.name;
        return api.sendMessage(
            `❌ Please specify who to kick!\n\n` +
                `📖 Usage:\n` +
                `• ${actualPrefix}${commandName} @user1 @user2 - Kick mentioned users\n` +
                `• ${actualPrefix}${commandName} [reply] - Reply to a message to kick that user\n` +
                `• ${actualPrefix}${commandName} all - Kick all members (except you and bot)\n` +
                `• ${actualPrefix}${commandName} all expt @user1 @user2 - Kick all except mentioned\n\n` +
                `📝 Options:\n` +
                `• "all" = kick all members\n` +
                `• "expt" = except/exclude mentioned users`,
            threadID
        );
    }

    // Check if there are users to kick
    if (usersToKick.length === 0) {
        // If using "all" and no one to kick, check if bot should leave
        if (removeAllMembers) {
            try {
                const threadInfo = await api.getThreadInfo(threadID);
                const botID = api.getCurrentUserID();
                const remainingMembers = threadInfo.participantIDs || [];
                const othersLeft = remainingMembers.filter((id) => id !== senderID && id !== botID);

                if (othersLeft.length === 0) {
                    // Only sender and bot left - leave the group
                    await api.sendMessage(`👋 No other members in group. Leaving...`, threadID);
                    await new Promise((resolve) => {
                        setTimeout(resolve, 1000);
                    });

                    if (api.gcmember) {
                        await api.gcmember("remove", botID, threadID);
                    }
                    return;
                }
            } catch {
                // Ignore error
            }
        }

        return api.sendMessage(
            `❌ No users to kick!\n\n` +
                `${removeAllMembers ? "All members are excluded or it's just you and the bot." : "Please mention users to kick."}`,
            threadID
        );
    }

    // Confirmation message
    let confirmMsg = `⏳ Kicking ${usersToKick.length} member${usersToKick.length > 1 ? "s" : ""}...\n`;
    if (excludeMembers && excludedNames.length > 0) {
        confirmMsg += `🛡️ Keeping: ${excludedNames.join(", ")}\n`;
    }

    await api.sendMessage(confirmMsg, threadID);

    // Kick users one by one (API limitation)
    let successCount = 0;
    let failedCount = 0;
    const failedUsers = [];

    for (let i = 0; i < usersToKick.length; i++) {
        const userID = usersToKick[i];
        const userName = userNames[i] || `User ${i + 1}`;

        try {
            const result = await api.gcmember("remove", userID, threadID);

            if (result && result.type !== "error_gc") {
                successCount++;
            } else if (result && result.error && result.error.includes("not in this group")) {
                // User already removed or left - count as success
                successCount++;
            } else {
                failedCount++;
                failedUsers.push(userName);
                // Log the error for debugging
                if (logger) {
                    logger.warn(`Failed to kick ${userName}: ${result?.error || "Unknown error"}`);
                }
            }

            // Longer delay between kicks to allow Facebook/MQTT to process and avoid rate limiting
            if (i < usersToKick.length - 1) {
                await new Promise((resolve) => {
                    setTimeout(resolve, 3000);
                });
            }
        } catch {
            failedCount++;
            failedUsers.push(userName);
        }
    }

    // Build result message
    let resultMsg = "";

    if (successCount > 0 && failedCount === 0) {
        resultMsg = `✅ Successfully kicked ${successCount} member${successCount > 1 ? "s" : ""}!\n\n`;
        resultMsg += `👢 **Kicked:**\n`;
        const displayLimit = 15;
        const displayNames = userNames.slice(0, displayLimit);
        displayNames.forEach((name, index) => {
            resultMsg += `  ${index + 1}. ${name}\n`;
        });
        if (userNames.length > displayLimit) {
            resultMsg += `  ... and ${userNames.length - displayLimit} more\n`;
        }
    } else if (successCount > 0 && failedCount > 0) {
        resultMsg = `⚠️ Partially completed!\n\n`;
        resultMsg += `✅ Kicked: ${successCount} member${successCount > 1 ? "s" : ""}\n`;
        resultMsg += `❌ Failed: ${failedCount} member${failedCount > 1 ? "s" : ""}\n\n`;
        if (failedUsers.length <= 10) {
            resultMsg += `**Failed to kick:**\n`;
            failedUsers.forEach((name, index) => {
                resultMsg += `  ${index + 1}. ${name}\n`;
            });
        }
    } else {
        resultMsg = `❌ Failed to kick members!\n\n`;
        resultMsg += `This might happen if:\n`;
        resultMsg += `• The bot doesn't have admin rights\n`;
        resultMsg += `• The users are admins\n`;
        resultMsg += `• Network issues occurred\n`;
    }

    // Show excluded users if any
    if (excludeMembers && excludedNames.length > 0) {
        resultMsg += `\n🛡️ **Protected (${excludedNames.length} users):**\n`;
        excludedNames.forEach((name, index) => {
            resultMsg += `  ${index + 1}. ${name}\n`;
        });
    }

    await api.sendMessage(resultMsg, threadID);

    // If we used "all" flag, check if only sender and bot are left, then leave automatically
    if (removeAllMembers) {
        try {
            // Wait a bit for Facebook to update
            await new Promise((resolve) => {
                setTimeout(resolve, 2000);
            });

            // Re-fetch thread info to check remaining members
            const updatedThreadInfo = await api.getThreadInfo(threadID);

            if (updatedThreadInfo && updatedThreadInfo.participantIDs) {
                const botID = api.getCurrentUserID();
                const remainingMembers = updatedThreadInfo.participantIDs;

                // Check if only sender (or sender + bot) is left
                const othersLeft = remainingMembers.filter(
                    (id) =>
                        id.toString() !== senderID.toString() && id.toString() !== botID.toString()
                );

                if (othersLeft.length === 0) {
                    // Only sender (and maybe bot) left - leave the group
                    await api.sendMessage(`👋 No other members left. Leaving group...`, threadID);

                    await new Promise((resolve) => {
                        setTimeout(resolve, 1000);
                    });

                    // Bot leaves the group
                    if (api.gcmember) {
                        await api.gcmember("remove", botID.toString(), threadID);
                    }
                }
            }
        } catch {
            // Silently fail - not critical
        }
    }
    },
};
