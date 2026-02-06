/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                            SHELL COMMAND                                      ║
 * ║         Execute system shell commands (Super Admin Only)                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command allows super admins to execute system shell commands.
 * WARNING: This is extremely dangerous and should only be used for debugging.
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const { exec } = require("child_process");
const os = require("os");

/**
 * Execute shell command with timeout
 * @param {string} command - Command to execute
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
function executeCommand(command, timeout = 30000) {
    return new Promise((resolve) => {
        const startTime = Date.now();

        exec(
            command,
            {
                timeout,
                maxBuffer: 1024 * 1024, // 1MB buffer
                shell: os.platform() === "win32" ? "cmd.exe" : "/bin/bash",
            },
            (error, stdout, stderr) => {
                const executionTime = Date.now() - startTime;

                resolve({
                    stdout: stdout || "",
                    stderr: stderr || "",
                    exitCode: error ? error.code || 1 : 0,
                    executionTime,
                    killed: error?.killed || false,
                });
            }
        );
    });
}

/**
 * Truncate output if too long
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Max length
 * @returns {string}
 */
function truncate(text, maxLength = 1500) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + `\n\n... [Truncated - ${text.length} total chars]`;
}

module.exports = {
    config: {
        name: "shell",
        aliases: ["sh", "terminal", "exec"],
        description: "Execute shell commands (Super Admin Only)",
        usage: "shell <command>",
        category: "admin",
        cooldown: 0,
        permissions: "superadmin",
        enabled: true,
        dmOnly: false,
        groupOnly: false,
    },

    /**
     * Command execution function
     */
    async execute({ api, event, args, config, logger }) {
        const threadID = event.threadID;
        const messageID = event.messageID ? String(event.messageID) : null;

        if (args.length === 0) {
            const actualPrefix = config.bot.prefixEnabled ? config.bot.prefix : "";
            const commandName = this.config.name;
            const platform = os.platform();
            const shell = platform === "win32" ? "cmd.exe" : "/bin/bash";

            return api.sendMessage(
                `🖥️ SHELL COMMAND\n\n` +
                `Usage: ${actualPrefix}${commandName} <command>\n\n` +
                `📋 System Info:\n` +
                `   Platform: ${platform}\n` +
                `   Shell: ${shell}\n` +
                `   Hostname: ${os.hostname()}\n` +
                `   User: ${os.userInfo().username}\n\n` +
                `⚠️ Warning: Use with caution!\n\n` +
                `Examples:\n` +
                `   ${actualPrefix}${commandName} dir\n` +
                `   ${actualPrefix}${commandName} echo Hello\n` +
                `   ${actualPrefix}${commandName} node -v\n` +
                `   ${actualPrefix}${commandName} npm list --depth=0`,
                threadID,
                messageID
            );
        }

        // Parse command from body to preserve whitespace
        let command = "";
        const fullBody = event.body || "";

        // Remove the command prefix and name
        const prefix = config.bot.prefixEnabled ? (Array.isArray(config.bot.prefix) ? config.bot.prefix[0] : config.bot.prefix) : "";
        const commandMatch = fullBody.match(new RegExp(`^[${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]?\\s*${this.config.name}\\s+`, 'i'));

        if (commandMatch) {
            command = fullBody.substring(commandMatch[0].length);
        } else {
            command = args.join(" ");
        }

        // Log the command execution
        logger.warn("Shell", `Executing: ${command} (by ${event.senderID})`);

        // Send "executing" message
        // await api.sendMessage(`⏳ Executing: ${command}`, threadID);

        // Execute the command
        const result = await executeCommand(command);

        // Build response
        let response = `🖥️ SHELL OUTPUT\n\n`;
        response += `📝 Command: ${command}\n`;
        response += `⏱️ Time: ${result.executionTime}ms\n`;
        response += `📊 Exit Code: ${result.exitCode}\n`;

        if (result.killed) {
            response += `⚠️ Process was killed (timeout)\n`;
        }

        if (result.stdout) {
            response += `\n📤 Output:\n${truncate(result.stdout)}`;
        }

        if (result.stderr) {
            response += `\n\n❌ Errors:\n${truncate(result.stderr)}`;
        }

        if (!result.stdout && !result.stderr) {
            response += `\n📭 No output`;
        }

        await api.sendMessage(response, threadID, null, messageID);

        // Log result
        if (result.exitCode === 0) {
            logger.success("Shell", `Command completed in ${result.executionTime}ms`);
        } else {
            logger.error("Shell", `Command failed with exit code ${result.exitCode}`);
        }
    },

    onLoad() {
        // Loaded silently
    },
};
