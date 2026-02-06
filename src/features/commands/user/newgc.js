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
        const messageID = event.messageID;
        const senderID = event.senderID;
        const isGroup = event.isGroup;

        // Check if we have metadata mentions
        let mentions = { ...(event.mentions || {}) };
        let mentionedIDs = Object.keys(mentions);

        // Parse arguments
        let groupName = null;
        let addAllMembers = false;
        let excludeMembers = false;
        let excludedIDs = [];
        let excludedNames = [];
        let argsLower = args.map((a) => a.toLowerCase());

        // 1. Check for "all" flag - add all members from current group
        if (argsLower.includes("all")) {
            addAllMembers = true;
        }

        // 2. Check for "expt" (except) flag
        if (
            argsLower.includes("expt") ||
            argsLower.includes("except") ||
            argsLower.includes("exc")
        ) {
            excludeMembers = true;
        }

        // 3. Robust Group Name Parsing (gn flag)
        const gnIndex = argsLower.indexOf("gn");
        if (gnIndex !== -1) {
            let nameParts = [];
            for (let i = gnIndex + 1; i < args.length; i++) {
                const arg = args[i];
                const argL = arg.toLowerCase();
                // Stop if we hit a mention or another flag
                if (arg.startsWith("@") || ["expt", "except", "exc", "all"].includes(argL)) break;
                nameParts.push(arg);
            }
            if (nameParts.length > 0) {
                groupName = nameParts.join(" ").trim();
            }
        }

        // 4. Fallback: Resolve textual mentions if metadata is missing (The "Fix")
        // This handles cases where the user types @Name but the platform doesn't send it as a mention object
        if (mentionedIDs.length === 0 && !addAllMembers && isGroup) {
            const hasAtSymbol = args.some(a => a.includes("@"));
            if (hasAtSymbol) {
                try {
                    // Fetch group members to match names
                    const threadInfo = await api.getThreadInfo(threadID);
                    if (threadInfo && threadInfo.participantIDs) {
                        const userInfo = await api.getUserInfo(threadInfo.participantIDs);
                        const fullText = args.join(" ").toLowerCase();
                        
                        for (const id in userInfo) {
                            const name = userInfo[id].name.toLowerCase();
                            const firstName = name.split(" ")[0];
                            
                            // Check for various ways a name might be typed with or without @
                            if (fullText.includes("@" + name.replace(/\s/g, "")) || 
                                fullText.includes("@" + name) ||
                                (firstName.length > 2 && fullText.includes("@" + firstName))) {
                                if (!mentionedIDs.includes(id) && id !== api.getCurrentUserID()) {
                                    mentionedIDs.push(id);
                                    mentions[id] = userInfo[id].name;
                                }
                            }
                        }
                    }
                } catch (err) {
                    // Fallback failed, continue with whatever we have
                }
            }
        }

        // If using exclude mode, move found mentions to excluded list
        if (excludeMembers) {
            excludedIDs = [...mentionedIDs];
            excludedNames = Object.values(mentions).map((name) => name.replace("@", ""));
            // Clear mentions so they aren't added as participants later
            mentionedIDs = [];
            mentions = {};
        }

        let participantIDs = [];
        let memberNames = [];

        // If "all" flag is used, get all members from current group
        if (addAllMembers) {
            if (!isGroup) {
                const actualPrefix = config.bot.prefixEnabled ? config.bot.prefix : "";
                const commandName = this.config.name;
                return api.sendMessage(
                    `❌ The "all" option only works in group chats!\n\n` +
                        `📖 Usage in groups:\n` +
                        `• ${actualPrefix}${commandName} all - Add all current members\n` +
                        `• ${actualPrefix}${commandName} all gn NewGroup - With group name\n` +
                        `• ${actualPrefix}${commandName} all gn NewGroup expt @user - Exclude users`,
                    threadID,
                    messageID
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
                        threadID,
                        messageID
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
                    threadID,
                    messageID
                );
            }
        } else {
            // Use mentioned users (not in exclude mode)
            if (mentionedIDs.length < 1) {
                const actualPrefix = config.bot.prefixEnabled ? config.bot.prefix : "";
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
                    threadID,
                    messageID
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
                threadID,
                messageID
            );
        }

        try {
            // Check if createNewGroup exists
            if (!api.createNewGroup) {
                return api.sendMessage(
                    `❌ Group creation is not available in this API version.`,
                    threadID,
                    messageID
                );
            }

            // Send creating message
            let creatingMsg =
                `⏳ Creating group${groupName ? ` "${groupName}"` : ""}...\n` +
                `👥 Adding ${participantIDs.length} members...`;

            if (excludeMembers && excludedNames.length > 0) {
                creatingMsg += `\n🚫 Excluding: ${excludedNames.join(", ")}`;
            }

            await api.sendMessage(creatingMsg, threadID, null, messageID);

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

                await api.sendMessage(response, threadID, null, messageID);

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
                    threadID,
                    messageID
                );
            }
        } catch (error) {
            await api.sendMessage(
                `❌ Failed to create group!\n\n` +
                    `Error: ${error.message || error.error || error}`,
                threadID,
                messageID
            );
        }
    },
};
