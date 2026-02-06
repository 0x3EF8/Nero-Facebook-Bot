/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                           RELOAD COMMAND                                      ║
 * ║         Reload commands or events without restarting (Admin Only)             ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command allows admins to hot-reload commands and events.
 * Useful for development and testing without full restart.
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

module.exports = {
    config: {
        name: "reload",
        aliases: ["rl", "refresh"],
        description: "Reload a command or event (Admin Only)",
        usage: "reload <command|event> <name>",
        category: "admin",
        cooldown: 5,
        permissions: "admin",
        enabled: true,
        dmOnly: false,
        groupOnly: false,
    },

    /**
     * Command execution function
     * @param {Object} context - Command context
     */
    async execute({ api, event, args, config, logger, commandHandler }) {
        const threadID = event.threadID;
        const messageID = event.messageID ? String(event.messageID) : null;
        const eventHandler = require("../../../handlers/eventHandler");
        const fs = require("fs");
        const path = require("path");

        // Check arguments
        if (args.length < 1) {
            const actualPrefix = config.bot.prefixEnabled ? config.bot.prefix : "";
            const commandName = this.config.name;
            return api.sendMessage(
                "❌ Please specify what to reload.\n\n" +
                    "Usage:\n" +
                    `• ${actualPrefix}${commandName} all\n` +
                    `• ${actualPrefix}${commandName} <name>\n\n` +
                    "Examples:\n" +
                    `• ${actualPrefix}${commandName} all\n` +
                    `• ${actualPrefix}${commandName} help\n` +
                    `• ${actualPrefix}${commandName} shell.js\n` +
                    `• ${actualPrefix}${commandName} welcome`,
                threadID,
                messageID
            );
        }

        const name = args[0].toLowerCase().replace(/\.js$/, ""); // Remove .js if present

        // Check for "reload all"
        if (name === "all") {
            try {
                const cmdCount = await commandHandler.init();
                const evtCount = await eventHandler.init();

                logger.success("Reload", `All handlers reloaded by ${event.senderID}`);
                return api.sendMessage(
                    `✅ Reloaded all handlers!\n\n` +
                        `📦 Commands: ${cmdCount}\n` +
                        `📡 Events: ${evtCount}`,
                    threadID,
                    messageID
                );
            } catch (error) {
                logger.error("Reload", `Failed to reload all: ${error.message}`);
                return api.sendMessage(
                    `❌ Failed to reload: ${error.message}`,
                    threadID,
                    messageID
                );
            }
        }

        // Auto-detect: Check if it's a command first, then event
        const command = commandHandler.getCommand(name);
        const handler = eventHandler.getHandler(name);

        // If found as existing command, reload it
        if (command) {
            const success = await commandHandler.reloadCommand(name);

            if (success) {
                logger.success("Reload", `Command "${name}" reloaded by ${event.senderID}`);
                return api.sendMessage(`✅ Command "${name}" reloaded!`, threadID, null, messageID);
            } else {
                return api.sendMessage(
                    `❌ Failed to reload command "${name}".`,
                    threadID,
                    null,
                    messageID
                );
            }
        }

        // If found as existing event, reload it
        if (handler) {
            const success = await eventHandler.reloadEvent(name);

            if (success) {
                logger.success("Reload", `Event "${name}" reloaded by ${event.senderID}`);
                return api.sendMessage(`✅ Event "${name}" reloaded!`, threadID, null, messageID);
            } else {
                return api.sendMessage(`❌ Failed to reload event "${name}".`, threadID, null, messageID);
            }
        }

        // Not found in loaded handlers - check if file exists on disk (new command/event)
        const commandDirs = [
            path.join(__dirname, "..", "user"),
            path.join(__dirname, "..", "admin"),
        ];

        const eventDirs = [
            path.join(__dirname, "..", "..", "events", "welcome"),
            path.join(__dirname, "..", "..", "events", "protection"),
            path.join(__dirname, "..", "..", "events", "media"),
            path.join(__dirname, "..", "..", "events", "AI"),
        ];

        // Check command directories
        for (const dir of commandDirs) {
            const filePath = path.join(dir, `${name}.js`);
            if (fs.existsSync(filePath)) {
                // New command file found - reload all to pick it up
                const cmdCount = await commandHandler.init();
                logger.success("Reload", `New command "${name}" loaded by ${event.senderID}`);
                return api.sendMessage(
                    `✅ New command "${name}" loaded!\n\n📦 Total commands: ${cmdCount}`,
                    threadID,
                    messageID
                );
            }
        }

        // Check event directories
        for (const dir of eventDirs) {
            if (!fs.existsSync(dir)) continue;

            // Read directory to find case-insensitive match
            const files = fs.readdirSync(dir);
            const match = files.find((f) => f.toLowerCase() === `${name}.js`);

            if (match) {
                // Found the file with correct casing!
                // If it was already loaded (but lookup failed due to case), try reloading specific event
                // Otherwise re-init

                const actualName = match.replace(/\.js$/, "");
                const existingHandler = eventHandler.getHandler(actualName);

                if (existingHandler) {
                    const success = await eventHandler.reloadEvent(actualName);
                    if (success) {
                        return api.sendMessage(
                            `✅ Event "${actualName}" reloaded!`,
                            threadID,
                            messageID
                        );
                    }
                }

                // Fallback to full init if specific reload didn't work or wasn't loaded
                const evtCount = await eventHandler.init();
                logger.success(
                    "Reload",
                    `New/Updated event "${match}" loaded by ${event.senderID}`
                );
                return api.sendMessage(
                    `✅ Event "${match}" loaded!\n\n📡 Total events: ${evtCount}`,
                    threadID,
                    messageID
                );
            }
        }

        // Not found anywhere
        return api.sendMessage(`❌ "${name}" not found as command or event.`, threadID, null, messageID);
    },
};
