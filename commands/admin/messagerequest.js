/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                        MESSAGE REQUEST COMMAND                                ║
 * ║               Accept or decline pending message requests                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 * 
 * This command allows admins to accept or decline message requests
 * from users who are trying to message the bot.
 * 
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

/**
 * Command configuration
 */
module.exports.config = {
    name: "messagerequest",
    aliases: ["msgreq", "request", "mr"],
    description: "View, accept or decline message requests",
    usage: "messagerequest [accept|decline] [1,2,3... or all]",
    category: "admin",
    cooldown: 3,
    permissions: "admin",
    enabled: true,
    dmOnly: false,
    groupOnly: false,
};

/**
 * Fetches pending message requests
 * @param {Object} api - The API instance
 * @returns {Promise<Array>} List of pending threads
 */
async function getPendingRequests(api) {
    try {
        // Try to get threads from PENDING folder (message requests)
        const pendingThreads = await api.getThreadList(20, null, ["PENDING"]);
        return pendingThreads || [];
    } catch {
        // If PENDING doesn't work, try OTHER folder
        try {
            const otherThreads = await api.getThreadList(20, null, ["OTHER"]);
            return otherThreads || [];
        } catch {
            return [];
        }
    }
}

/**
 * Gets the display name for a thread
 * @param {Object} thread - Thread object
 * @returns {string} Display name
 */
function getThreadDisplayName(thread) {
    // For groups, use threadName
    if (thread.isGroup) {
        return thread.threadName || thread.name || "Unnamed Group";
    }
    
    // For DMs, get name from userInfo array (excludes bot's own ID)
    if (thread.userInfo && thread.userInfo.length > 0) {
        // Find the other user (not the bot) - usually the first one in single chats
        // Or just get the first user's name
        for (const user of thread.userInfo) {
            if (user.name && user.id === thread.threadID) {
                return user.name;
            }
        }
        // Fallback: get first user with a name
        const userWithName = thread.userInfo.find(u => u.name);
        if (userWithName) {
            return userWithName.name;
        }
    }
    
    // Last fallback
    return thread.threadName || thread.name || "Unknown";
}

/**
 * Formats thread info for display
 * @param {Object} thread - Thread object
 * @param {number} index - Index number
 * @returns {string} Formatted string
 */
function formatThreadInfo(thread, index) {
    const name = getThreadDisplayName(thread);
    const id = thread.threadID;
    const isGroup = thread.isGroup;
    
    const typeEmoji = isGroup ? "👥 Group" : "👤 User";
    const participants = thread.participantIDs ? thread.participantIDs.length : 0;
    const snippet = thread.snippet ? thread.snippet.substring(0, 30) + (thread.snippet.length > 30 ? "..." : "") : "No message";
    
    let info = `${index}. ${typeEmoji}: ${name}\n`;
    info += `   📋 ID: ${id}\n`;
    if (isGroup) {
        info += `   👥 Members: ${participants}\n`;
    }
    info += `   💬 Last: "${snippet}"`;
    
    return info;
}

/**
 * Command execution function
 * @param {Object} context - Command context
 */
module.exports.execute = async function({ api, event, args }) {
    const threadID = event.threadID;
    
    // If no arguments, show list of pending message requests
    if (!args[0]) {
        try {
            const pendingRequests = await getPendingRequests(api);
            
            if (pendingRequests.length === 0) {
                return api.sendMessage(
                    `📭 No pending message requests!\n\n` +
                    `All caught up! There are no message requests waiting for approval.`,
                    threadID
                );
            }
            
            let response = `📬 **Pending Message Requests** (${pendingRequests.length})\n`;
            response += `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            
            pendingRequests.forEach((thread, index) => {
                response += formatThreadInfo(thread, index + 1) + "\n\n";
            });
            
            response += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            response += `📖 **Commands:**\n`;
            response += `• msgreq accept 1 - Accept #1\n`;
            response += `• msgreq decline 1,2,3 - Decline multiple\n`;
            response += `• msgreq accept all - Accept all requests`;
            
            return api.sendMessage(response, threadID);
            
        } catch (error) {
            return api.sendMessage(
                `❌ Failed to fetch message requests!\n\n` +
                `Error: ${error.message || error}`,
                threadID
            );
        }
    }
    
    const action = args[0].toLowerCase();
    
    // Handle "list" action explicitly
    if (action === "list" || action === "l") {
        try {
            const pendingRequests = await getPendingRequests(api);
            
            if (pendingRequests.length === 0) {
                return api.sendMessage(
                    `📭 No pending message requests!`,
                    threadID
                );
            }
            
            let response = `📬 **Pending Message Requests** (${pendingRequests.length})\n`;
            response += `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            
            pendingRequests.forEach((thread, index) => {
                response += formatThreadInfo(thread, index + 1) + "\n\n";
            });
            
            return api.sendMessage(response, threadID);
            
        } catch (error) {
            return api.sendMessage(
                `❌ Failed to fetch message requests!\n\n` +
                `Error: ${error.message || error}`,
                threadID
            );
        }
    }
    
    // Validate action
    if (!["accept", "decline", "a", "d"].includes(action)) {
        return api.sendMessage(
            `❌ Invalid action: "${action}"\n\n` +
            `Valid actions:\n` +
            `• (no args) - Show pending requests\n` +
            `• list (or l) - Show pending requests\n` +
            `• accept (or a) - Accept message request\n` +
            `• decline (or d) - Decline message request`,
            threadID
        );
    }
    
    // Get the numbers/arguments after the action
    const targetArgs = args.slice(1);
    
    // Fetch pending requests first (we need them to map numbers to IDs)
    let pendingRequests;
    try {
        pendingRequests = await getPendingRequests(api);
    } catch (error) {
        return api.sendMessage(
            `❌ Failed to fetch pending requests!\n\n` +
            `Error: ${error.message || error}`,
            threadID
        );
    }
    
    if (pendingRequests.length === 0) {
        return api.sendMessage(
            `📭 No pending message requests to ${action}!`,
            threadID
        );
    }
    
    let targetThreadIDs = [];
    let selectedNames = [];
    
    // Handle "accept all" or "decline all"
    if (targetArgs.length === 1 && targetArgs[0].toLowerCase() === "all") {
        targetThreadIDs = pendingRequests.map(t => t.threadID);
        selectedNames = pendingRequests.map(t => getThreadDisplayName(t));
    } else if (targetArgs.length === 0) {
        return api.sendMessage(
            `❌ Please provide at least one number!\n\n` +
            `Usage:\n` +
            `• msgreq ${action} 1 - Single\n` +
            `• msgreq ${action} 1,2,3 - Multiple\n` +
            `• msgreq ${action} 1 2 3 - Multiple\n` +
            `• msgreq ${action} all - All requests`,
            threadID
        );
    } else {
        // Parse numbers - support both "1,2,3" and "1 2 3" formats
        const numbers = targetArgs
            .join(",")
            .split(",")
            .map(n => n.trim())
            .filter(n => n.length > 0)
            .map(n => parseInt(n, 10))
            .filter(n => !isNaN(n));
        
        if (numbers.length === 0) {
            return api.sendMessage(
                `❌ Invalid numbers provided!\n\n` +
                `Use list numbers like: msgreq ${action} 1,2,3`,
                threadID
            );
        }
        
        // Validate numbers are in range
        const invalidNumbers = numbers.filter(n => n < 1 || n > pendingRequests.length);
        if (invalidNumbers.length > 0) {
            return api.sendMessage(
                `❌ Invalid number(s): ${invalidNumbers.join(", ")}\n\n` +
                `Valid range: 1 to ${pendingRequests.length}\n` +
                `Use "msgreq" to see the list.`,
                threadID
            );
        }
        
        // Map numbers to thread IDs (1-indexed to 0-indexed)
        const uniqueNumbers = [...new Set(numbers)]; // Remove duplicates
        for (const num of uniqueNumbers) {
            const thread = pendingRequests[num - 1];
            targetThreadIDs.push(thread.threadID);
            selectedNames.push(getThreadDisplayName(thread));
        }
    }
    
    // Determine if accepting or declining
    const isAccept = ["accept", "a"].includes(action);
    const actionText = isAccept ? "Accepting" : "Declining";
    const actionPast = isAccept ? "accepted" : "declined";
    const emoji = isAccept ? "✅" : "🚫";
    
    // Send processing message
    await api.sendMessage(
        `⏳ ${actionText} ${targetThreadIDs.length} message request(s)...`,
        threadID
    );
    
    try {
        // Check if handleMessageRequest exists
        if (!api.handleMessageRequest) {
            return api.sendMessage(
                `❌ Message request handling is not available in this API version.`,
                threadID
            );
        }
        
        // Handle the message requests
        await api.handleMessageRequest(targetThreadIDs, isAccept);
        
        // Send welcome message to accepted threads
        if (isAccept) {
            const welcomeMessage = `👋 Hello!\n\n` +
                `✅ Your message request has been accepted.\n` +
                `You can now chat with me freely!\n\n` +
                `Type "help" to see available commands.`;
            
            for (const acceptedThreadID of targetThreadIDs) {
                try {
                    await api.sendMessage(welcomeMessage, acceptedThreadID);
                } catch {
                    // Silently ignore if message fails to send
                }
            }
        }
        
        // Build success message
        let response = `${emoji} Successfully ${actionPast} ${targetThreadIDs.length} message request(s)!\n\n`;
        response += `📋 Threads:\n`;
        selectedNames.slice(0, 10).forEach((name, index) => {
            response += `  ${index + 1}. ${name}\n`;
        });
        if (selectedNames.length > 10) {
            response += `  ... and ${selectedNames.length - 10} more`;
        }
        
        if (isAccept) {
            response += `\n\n📨 Welcome messages sent to accepted threads!`;
        }
        
        await api.sendMessage(response, threadID);
        
    } catch (error) {
        await api.sendMessage(
            `❌ Failed to ${action} message request(s)!\n\n` +
            `Error: ${error.message || error}`,
            threadID
        );
    }
};
