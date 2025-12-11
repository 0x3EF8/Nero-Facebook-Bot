/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                              POLL COMMAND                                     ║
 * ║                   Create polls in group conversations                         ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command allows users to create polls in group chats.
 * Polls can have multiple options for members to vote on.
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

/**
 * Parse poll input from message
 * @param {string} input - Raw input string
 * @returns {Object} Parsed question and options
 */
function parsePollInput(input) {
    // Split by - (dash) character
    const parts = input
        .split("-")
        .map((part) => part.trim())
        .filter((part) => part.length > 0);

    if (parts.length < 3) {
        return null;
    }

    return {
        question: parts[0],
        options: parts.slice(1),
    };
}

module.exports = {
    config: {
        name: "poll",
        aliases: ["vote", "createpoll", "survey"],
        description: "Create a poll in the group chat",
        usage: "poll <question> - <option1> - <option2> - [option3] ...",
        category: "user",
        cooldown: 10,
        permissions: "user",
        enabled: true,
        dmOnly: false,
        groupOnly: true,
    },

    /**
     * Command execution function
     * @param {Object} context - Command context
     */
    async execute({ api, event, args }) {
    const threadID = event.threadID;

    // Check if in a group
    if (!event.isGroup) {
        return api.sendMessage(`❌ This command can only be used in group chats!`, threadID);
    }

    // Check if args are provided
    if (args.length === 0) {
        return api.sendMessage(
            `📊 **Poll Command**\n\n` +
                `Create a poll for group members to vote on!\n\n` +
                `📖 Usage:\n` +
                `• poll <question> - <option1> - <option2> - [option3]...\n\n` +
                `📝 Examples:\n` +
                `• poll What's for dinner? - Pizza - Burger - Sushi\n` +
                `• poll Meeting time? - 10 AM - 2 PM - 4 PM - 6 PM\n` +
                `• poll Best programming language? - JavaScript - Python - Rust\n\n` +
                `💡 Tips:\n` +
                `• Use - (dash) to separate question and options\n` +
                `• Minimum 2 options required\n` +
                `• Maximum 10 options recommended`,
            threadID
        );
    }

    // Parse the input
    const input = args.join(" ");
    const parsed = parsePollInput(input);

    if (!parsed) {
        return api.sendMessage(
            `❌ Invalid poll format!\n\n` +
                `Please use: poll <question> - <option1> - <option2> - ...\n\n` +
                `Example: poll What's for lunch? - Pizza - Burger - Salad`,
            threadID
        );
    }

    const { question, options } = parsed;

    // Validate options count
    if (options.length < 2) {
        return api.sendMessage(
            `❌ A poll needs at least 2 options!\n\n` + `You provided: ${options.length} option(s)`,
            threadID
        );
    }

    if (options.length > 10) {
        return api.sendMessage(
            `❌ Too many options! Maximum is 10.\n\n` + `You provided: ${options.length} options`,
            threadID
        );
    }

    // Validate question length
    if (question.length > 500) {
        return api.sendMessage(
            `❌ Question is too long! Maximum 500 characters.\n\n` +
                `Your question: ${question.length} characters`,
            threadID
        );
    }

    // Validate option lengths
    for (let i = 0; i < options.length; i++) {
        if (options[i].length > 100) {
            return api.sendMessage(
                `❌ Option ${i + 1} is too long! Maximum 100 characters.\n\n` +
                    `"${options[i].substring(0, 50)}..." (${options[i].length} characters)`,
                threadID
            );
        }
    }

    // Check if createPoll exists
    if (!api.createPoll) {
        return api.sendMessage(`❌ Poll creation is not available in this API version.`, threadID);
    }

    // Format options for the API
    const pollOptions = options.map((text) => ({ text }));

    try {
        // Create the poll - the poll itself will appear in chat
        await api.createPoll(threadID, question, pollOptions);

        // No confirmation message needed - the poll shows up directly
    } catch (error) {
        console.error("[Poll] Error:", error);

        let errorMessage = "Unknown error occurred";

        if (error) {
            if (typeof error === "string") {
                errorMessage = error;
            } else if (error.message) {
                errorMessage = error.message;
            } else if (error.error) {
                errorMessage =
                    typeof error.error === "string" ? error.error : JSON.stringify(error.error);
            }
        }

        await api.sendMessage(`❌ Failed to create poll!\n\n` + `Error: ${errorMessage}`, threadID);
    }
    },
};
