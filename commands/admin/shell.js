/**
 * Shell Command - Execute system shell commands (Super Admin Only)
 * WARNING: This is extremely dangerous and should only be used for debugging.
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const { exec } = require("child_process");
const os = require("os");

module.exports.config = {
    name: "shell",
    aliases: ["sh", "cmd", "terminal", "exec"],
    description: "Execute shell commands (Super Admin Only)",
    usage: "shell <command>",
    category: "admin",
    cooldown: 0,
    permissions: "superadmin",
    enabled: true,
    dmOnly: false,
    groupOnly: false,
};

/**
 * Execute shell command with timeout
 * @param {string} command - Command to execute
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
function executeCommand(command, timeout = 30000) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        
        exec(command, {
            timeout,
            maxBuffer: 1024 * 1024, // 1MB buffer
            shell: os.platform() === "win32" ? "cmd.exe" : "/bin/bash",
        }, (error, stdout, stderr) => {
            const executionTime = Date.now() - startTime;
            
            resolve({
                stdout: stdout || "",
                stderr: stderr || "",
                exitCode: error ? error.code || 1 : 0,
                executionTime,
                killed: error?.killed || false,
            });
        });
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

/**
 * Command execution function
 */
module.exports.execute = async function({ api, event, args, logger }) {
    const threadID = event.threadID;
    const messageID = event.messageID ? String(event.messageID) : null;
    
    if (args.length === 0) {
        const platform = os.platform();
        const shell = platform === "win32" ? "cmd.exe" : "/bin/bash";
        
        return api.sendMessage(
            `🖥️ SHELL COMMAND\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `Usage: !shell <command>\n\n` +
            `📋 System Info:\n` +
            `   Platform: ${platform}\n` +
            `   Shell: ${shell}\n` +
            `   Hostname: ${os.hostname()}\n` +
            `   User: ${os.userInfo().username}\n\n` +
            `⚠️ Warning: Use with caution!\n\n` +
            `Examples:\n` +
            `   !shell dir\n` +
            `   !shell echo Hello\n` +
            `   !shell node -v\n` +
            `   !shell npm list --depth=0`,
            threadID,
            messageID
        );
    }
    
    const command = args.join(" ");
    
    // Log the command execution
    logger.warn("Shell", `Executing: ${command} (by ${event.senderID})`);
    
    // Send "executing" message
   // await api.sendMessage(`⏳ Executing: ${command}`, threadID);
    
    // Execute the command
    const result = await executeCommand(command);
    
    // Build response
    let response = `🖥️ SHELL OUTPUT\n`;
    response += `━━━━━━━━━━━━━━━━━━━━\n\n`;
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
    
    await api.sendMessage(response, threadID, messageID);
    
    // Log result
    if (result.exitCode === 0) {
        logger.success("Shell", `Command completed in ${result.executionTime}ms`);
    } else {
        logger.error("Shell", `Command failed with exit code ${result.exitCode}`);
    }
};

module.exports.onLoad = function() {
    // Loaded silently
};
