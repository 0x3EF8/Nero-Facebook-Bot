/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                          NEW GROUP CHAT COMMAND                               ║
 * ║                  Create a new group chat with mentions or all members         ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command creates a new group chat with:
 * - Specific mentioned users
 * - All members from the current group (using "all" flag)
 * - Exclude specific users with "expt" flag
 *
 * @author 0x3EF8
 * @version 2.1.0
 */

"use strict";

module.exports = {
    config: {
        name: "newgc",
        aliases: ["creategc", "newgroup", "creategroup", "mkgc"],
        description: "Create a new group chat with mentioned users or all current members",
        usage: "newgc [all] [gn <groupname>] [expt @excludes...] [@mentions...]",
        category: "user",
        cooldown: 10,
        permissions: "user",
        enabled: true,
        dmOnly: false,
        groupOnly: false,
    },

    /**
     * Command execution function
     * @param {Object} context - Command context
     */
    async execute({ api, event, args, config, logger: _logger }) {
    const threadID = event.threadID;
    const senderID = event.senderID;
    const isGroup = event.isGroup;

    // Check if we have mentions
    const mentions = event.mentions || {};
    const mentionedIDs = Object.keys(mentions);

    // Parse arguments
    let groupName = null;
    let addAllMembers = false;
    let excludeMembers = false;
    let excludedIDs = [];
    let excludedNames = [];
    let argsLower = args.map((a) => a.toLowerCase());

    // Check for "all" flag - add all members from current group
    if (argsLower.includes("all")) {
        addAllMembers = true;
        // Remove "all" from args
        args = args.filter((_, i) => argsLower[i] !== "all");
        argsLower = args.map((a) => a.toLowerCase());
    }

    // Check for "expt" (except) flag - exclude mentioned users
    if (argsLower.includes("expt") || argsLower.includes("except") || argsLower.includes("exc")) {
        excludeMembers = true;
        // Remove "expt/except/exc" from args
        args = args.filter((_, i) => !["expt", "except", "exc"].includes(argsLower[i]));
        argsLower = args.map((a) => a.toLowerCase());

        // When using expt, mentioned users are the ones to EXCLUDE
        excludedIDs = [...mentionedIDs];
        excludedNames = Object.values(mentions).map((name) => name.replace("@", ""));
    }

    // Check if "gn" flag exists for group name
    const gnIndex = argsLower.indexOf("gn");
    if (gnIndex !== -1) {
        // Get everything after "gn" until a mention or end
        const argsAfterGn = args.slice(gnIndex + 1).join(" ");

        if (mentionedIDs.length > 0) {
            // Find the first mention's text in the message
            const firstMentionText = Object.values(mentions)[0];
            const mentionIndex = argsAfterGn.indexOf(firstMentionText);

            if (mentionIndex > 0) {
                groupName = argsAfterGn.substring(0, mentionIndex).trim();
            } else if (mentionIndex === -1) {
                groupName = argsAfterGn.trim();
            }
        } else {
            groupName = argsAfterGn.trim();
        }
    }

    // If no group name from "gn", check if first arg looks like a name (not a mention)
    if (!groupName && args.length > 0 && !args[0].startsWith("@") && argsLower[0] !== "gn") {
        // Use first arg(s) before any mention as group name
        const argsText = args.join(" ");
        if (mentionedIDs.length > 0) {
            const firstMentionText = Object.values(mentions)[0];
            const mentionIndex = argsText.indexOf(firstMentionText);
            if (mentionIndex > 0) {
                groupName = argsText.substring(0, mentionIndex).trim();
            }
        }
    }

    let participantIDs = [];
    let memberNames = [];

    // If "all" flag is used, get all members from current group
    if (addAllMembers) {
        if (!isGroup) {
            const actualPrefix = config.bot.prefixEnabled ? config.bot.prefix : '';
            const commandName = this.config.name;
            return api.sendMessage(
                `❌ The "all" option only works in group chats!\n\n` +
                    `📖 Usage in groups:\n` +
                    `• ${actualPrefix}${commandName} all - Add all current members\n` +
                    `• ${actualPrefix}${commandName} all gn NewGroup - With group name\n` +
                    `• ${actualPrefix}${commandName} all gn NewGroup expt @user - Exclude users`,
                threadID
            );
        }

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

            // Get all participant IDs (excluding the bot)
            const botID = api.getCurrentUserID();
            let allParticipantIDs = threadInfo.participantIDs.filter((id) => id !== botID);

            // If excludeMembers is true, remove excluded users
            if (excludeMembers && excludedIDs.length > 0) {
                allParticipantIDs = allParticipantIDs.filter((id) => !excludedIDs.includes(id));
            }

            participantIDs = allParticipantIDs;

            // Get user info for names
            try {
                const userInfo = await api.getUserInfo(participantIDs);
                memberNames = participantIDs.map((id) => {
                    const user = userInfo[id];
                    return user ? user.name : `User ${id}`;
                });
            } catch {
                memberNames = participantIDs.map((_, i) => `Member ${i + 1}`);
            }

            // Update loading message
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
    } else {
        // Use mentioned users (not in exclude mode)
        if (mentionedIDs.length < 1) {
            const actualPrefix = config.bot.prefixEnabled ? config.bot.prefix : '';
            const commandName = this.config.name;
            return api.sendMessage(
                `❌ Please mention users or use "all" to add everyone!\n\n` +
                    `📖 Usage:\n` +
                    `• ${actualPrefix}${commandName} @user1 @user2 - Specific users\n` +
                    `• ${actualPrefix}${commandName} gn MyGroup @user1 @user2 - With name\n` +
                    `• ${actualPrefix}${commandName} all - All current group members\n` +
                    `• ${actualPrefix}${commandName} all gn NewGroup - All members with name\n` +
                    `• ${actualPrefix}${commandName} all gn NewGroup expt @user1 @user2 - Exclude users\n\n` +
                    `📝 Options:\n` +
                    `• "gn" = group name\n` +
                    `• "all" = add all members from current group\n` +
                    `• "expt" = except/exclude mentioned users (use with "all")`,
                threadID
            );
        }

        participantIDs = [...mentionedIDs];
        memberNames = Object.values(mentions).map((name) => name.replace("@", ""));
    }

    // Add the sender if not already included
    if (!participantIDs.includes(senderID)) {
        participantIDs.push(senderID);
    }

    // Need at least 2 participants (API requirement)
    if (participantIDs.length < 2) {
        return api.sendMessage(
            `❌ Need at least 2 participants to create a group!\n\n` +
                `${addAllMembers ? "The current group needs more members." : "Mention more users to add them."}`,
            threadID
        );
    }

    try {
        // Check if createNewGroup exists
        if (!api.createNewGroup) {
            return api.sendMessage(
                `❌ Group creation is not available in this API version.`,
                threadID
            );
        }

        // Send creating message
        let creatingMsg =
            `⏳ Creating group${groupName ? ` "${groupName}"` : ""}...\n` +
            `👥 Adding ${participantIDs.length} members...`;

        if (excludeMembers && excludedNames.length > 0) {
            creatingMsg += `\n🚫 Excluding: ${excludedNames.join(", ")}`;
        }

        await api.sendMessage(creatingMsg, threadID);

        // Create the group
        const result = await api.createNewGroup(participantIDs, groupName);

        if (result && result.success) {
            let response = `✅ Group created successfully!\n\n`;
            response += `📋 **Details:**\n`;
            if (groupName) {
                response += `• Name: ${groupName}\n`;
            }
            response += `• Members: ${result.totalParticipants || participantIDs.length}\n`;
            response += `• Thread ID: ${result.threadID}\n\n`;

            // Show member list (limit to 20 for readability)
            response += `👥 **Added (${memberNames.length} users):**\n`;
            const displayLimit = 20;
            const displayNames = memberNames.slice(0, displayLimit);
            displayNames.forEach((name, index) => {
                response += `  ${index + 1}. ${name}\n`;
            });

            if (memberNames.length > displayLimit) {
                response += `  ... and ${memberNames.length - displayLimit} more\n`;
            }

            // Show excluded users if any
            if (excludeMembers && excludedNames.length > 0) {
                response += `\n🚫 **Excluded (${excludedNames.length} users):**\n`;
                excludedNames.forEach((name, index) => {
                    response += `  ${index + 1}. ${name}\n`;
                });
            }

            // Make the command executor an admin in the new group
            if (api.changeAdminStatus) {
                try {
                    // Small delay to ensure group is fully created
                    await new Promise((resolve) => {
                        setTimeout(resolve, 1500);
                    });

                    const adminResult = await api.changeAdminStatus(
                        result.threadID,
                        senderID,
                        true
                    );
                    if (adminResult && adminResult.type !== "error_admin") {
                        response += `\n👑 **Admin:** You have been promoted to admin!`;
                    }
                } catch {
                    // Silently fail if admin promotion fails
                    // The group is still created successfully
                }
            }

            response += `\n💬 The group has been created! Check your messages.`;

            await api.sendMessage(response, threadID);

            // Send a welcome message to the new group
            const welcomeMsg =
                `👋 Welcome to${groupName ? ` "${groupName}"` : " the group"}!\n\n` +
                `This group was created with ${participantIDs.length} members.\n` +
                `Type "!help" to see available commands.`;

            try {
                await api.sendMessage(welcomeMsg, result.threadID);
            } catch {
                // Ignore if welcome message fails
            }
        } else {
            await api.sendMessage(
                `❌ Failed to create group!\n\n` + `Please try again later.`,
                threadID
            );
        }
    } catch (error) {
        await api.sendMessage(
            `❌ Failed to create group!\n\n` + `Error: ${error.message || error.error || error}`,
            threadID
        );
    }
    },
};
