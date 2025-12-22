/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                           EVAL COMMAND                                        ║
 * ║         Execute JavaScript code (Super Admin Only - Use with caution!)        ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command allows super admins to execute arbitrary JavaScript code.
 * WARNING: This is extremely dangerous and should only be used for debugging.
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

/**
 * Formats the result for display
 * @param {*} result - The result to format
 * @param {number} maxLength - Maximum length of output
 * @returns {string}
 */
function formatResult(result, maxLength = 2000) {
    let output;

    if (result === undefined) {
        output = "undefined";
    } else if (result === null) {
        output = "null";
    } else if (typeof result === "object") {
        try {
            output = JSON.stringify(result, null, 2);
        } catch {
            output = String(result);
        }
    } else if (typeof result === "function") {
        output = result.toString();
    } else {
        output = String(result);
    }

    // Truncate if too long
    if (output.length > maxLength) {
        output =
            output.substring(0, maxLength) +
            `\n\n... [Truncated - ${output.length} total characters]`;
    }

    return output;
}

module.exports = {
    config: {
        name: "eval",
        aliases: ["ev", "execute", "run"],
        description: "Execute JavaScript code (Super Admin Only)",
        usage: "eval <code>",
        category: "admin",
        cooldown: 0,
        permissions: "superadmin",
        enabled: true,
        dmOnly: false,
        groupOnly: false,
    },

    /**
     * Command execution function
     * @param {Object} context - Command context
     * @param {Object} context.api - Nero API object
     * @param {Object} context.event - Message event object
     * @param {Array<string>} context.args - Command arguments
     * @param {Object} context.config - Bot configuration
     * @param {Object} context.logger - Logger utility
     */
    async execute({ api, event, args, config, logger }) {
        const threadID = event.threadID;
        const messageID = event.messageID ? String(event.messageID) : null;

        // Check if code was provided
        if (args.length === 0) {
            const actualPrefix = config.bot.prefixEnabled ? config.bot.prefix : '';
            const commandName = this.config.name;
            return api.sendMessage(
                `❌ Please provide code to execute.\n\n` +
                    `Usage: ${actualPrefix}${commandName} <code>\n\n` +
                    `Example: ${actualPrefix}${commandName} return 2 + 2`,
                threadID,
                messageID
            );
        }

        const code = args.join(" ");

        logger.warn("Eval", `Executing code from ${event.senderID}: ${code.substring(0, 100)}...`);

        try {
            // Create a function with access to useful variables
            const startTime = Date.now();

            // Wrap in async function to allow await
            const asyncFunction = new Function(
                "api",
                "event",
                "config",
                "logger",
                "require",
                `return (async () => { ${code} })()`
            );

            // Execute the code
            const result = await asyncFunction(api, event, config, logger, require);

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            // Format the result
            const formattedResult = formatResult(result);

            // Send the result
            const response =
                `✅ Code executed successfully\n` +
                `⏱️ Execution time: ${executionTime}ms\n\n` +
                `📤 Output:\n${formattedResult}`;

            api.sendMessage(response, threadID, messageID);

            logger.success("Eval", `Code executed in ${executionTime}ms`);
        } catch (error) {
            const errorMessage =
                `❌ Execution error\n\n` +
                `🔴 Error: ${error.name}\n` +
                `📝 Message: ${error.message}\n\n` +
                `📍 Stack:\n${error.stack ? error.stack.substring(0, 500) : "No stack trace"}`;

            api.sendMessage(errorMessage, threadID, messageID);

            logger.error("Eval", `Execution failed: ${error.message}`);
        }
    },

    /**
     * Called when the command is loaded
     */
    onLoad() {
        // Loaded silently
    },
};
