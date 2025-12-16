/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                            AI COMMAND                                         ║
 * ║                 Direct interface to the Gemini AI Engine                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command allows users to query the AI directly for quick answers,
 * explanations, or creative tasks without entering full conversation mode.
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const { gemini } = require("../../events/AI/beta/core/gemini");
const { AI_IDENTITY } = require("../../events/AI/beta/core/constants");

module.exports = {
    config: {
        name: "ai",
        aliases: ["ask", "gemini", "gpt", "bot"],
        description: "Ask the AI a question or request a task",
        usage: "ai <your query>",
        category: "utility",
        cooldown: 5,
        permissions: "user",
        enabled: true,
        dmOnly: false,
        groupOnly: false,
    },

    /**
     * Command execution function
     * @param {Object} context - Command context
     */
    async execute({ api, event, args, prefix }) {
        const { threadID, messageID } = event;

        if (args.length === 0) {
            const actualPrefix = config.bot.prefixEnabled ? config.bot.prefix : '';
            const commandName = this.config.name;
            return api.sendMessage(
                `⚠️ Please provide a query.\nExample: ${actualPrefix}${commandName} Explain quantum physics`,
                threadID,
                messageID
            );
        }

        const query = args.join(" ");

        try {
            // Send loading reaction
            api.setMessageReaction("🧠", messageID, () => {}, true);

            // Construct a lightweight professional system prompt for this command
            const systemPrompt = `You are ${AI_IDENTITY.name}, a professional AI assistant.
User Query: "${query}"

Instructions:
- Provide a direct, accurate, and concise answer.
- Maintain a helpful and professional tone.
- Do not use markdown formatting for headers, but you can use bullet points.
- If the query is a command (like "play music"), explain how to use the bot's specific commands instead.`;

            // Generate response
            const result = await gemini.generate(systemPrompt);
            const responseText = result?.response?.text?.() || "";

            if (!responseText) {
                api.setMessageReaction("❌", messageID, () => {}, true);
                return api.sendMessage(
                    "❌ The AI returned an empty response. Please try again.",
                    threadID,
                    messageID
                );
            }

            // Send response
            api.setMessageReaction("✅", messageID, () => {}, true);
            return api.sendMessage(responseText.trim(), threadID, messageID);

        } catch (error) {
            console.error("AI Command Error:", error);
            api.setMessageReaction("❌", messageID, () => {}, true);
            
            let errorMessage = "❌ An error occurred while processing your request.";
            if (error.message?.includes("quota") || error.message?.includes("429")) {
                errorMessage = "❌ AI usage limit reached. Please try again later.";
            }

            return api.sendMessage(errorMessage, threadID, messageID);
        }
    },
};
