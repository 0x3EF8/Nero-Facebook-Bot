/**
 * Maintenance Command - Toggle and manage maintenance mode (Admin Only)
 * 
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const maintenanceManager = require("../../utils/maintenanceManager");

module.exports.config = {
    name: "maintenance",
    aliases: ["maint", "mt"],
    description: "Toggle and manage maintenance mode",
    usage: "maintenance <on/off/status> [reason] [--time=minutes]",
    category: "admin",
    cooldown: 0,
    permissions: "admin",
    enabled: true,
    dmOnly: false,
    groupOnly: false,
};

/**
 * Parse time argument from args
 * @param {Array<string>} args - Command arguments
 * @returns {{time: number|null, cleanArgs: Array<string>}}
 */
function parseTimeArg(args) {
    let time = null;
    const cleanArgs = [];
    
    for (const arg of args) {
        const timeMatch = arg.match(/^--time=(\d+)$/i) || arg.match(/^-t=?(\d+)$/i);
        if (timeMatch) {
            time = parseInt(timeMatch[1], 10);
        } else {
            cleanArgs.push(arg);
        }
    }
    
    return { time, cleanArgs };
}

module.exports.execute = async function({ api, event, args, logger }) {
    const threadID = event.threadID;
    const messageID = event.messageID ? String(event.messageID) : null;
    
    if (args.length === 0) {
        // Show status
        const status = maintenanceManager.getStatus();
        
        let response = `🔧 Maintenance Mode\n\n`;
        response += `Status: ${status.enabled ? "🔴 ENABLED" : "🟢 DISABLED"}\n`;
        
        if (status.enabled) {
            response += `Reason: ${status.reason}\n`;
            if (status.startedAt) {
                response += `Duration: ${status.duration}\n`;
            }
            if (status.estimatedEnd) {
                const remaining = status.estimatedEnd.getTime() - Date.now();
                if (remaining > 0) {
                    response += `ETA: ${maintenanceManager.formatDuration(remaining)}\n`;
                }
            }
            response += `Notified Users: ${status.notifiedCount}`;
        }
        
        response += `\n\nUsage:\n`;
        response += `• maintenance on [reason] [--time=minutes]\n`;
        response += `• maintenance off\n`;
        response += `• maintenance status\n`;
        response += `• maintenance reason <new reason>\n`;
        response += `• maintenance time <minutes>\n`;
        response += `• maintenance reset`;
        
        return api.sendMessage(response, threadID, messageID);
    }
    
    const action = args[0].toLowerCase();
    
    switch (action) {
        case "on":
        case "enable":
        case "start": {
            const { time, cleanArgs } = parseTimeArg(args.slice(1));
            const reason = cleanArgs.join(" ") || "The bot is currently under maintenance.";
            
            const status = maintenanceManager.enable({
                reason,
                estimatedMinutes: time,
            });
            
            logger.warn("Maintenance", `Maintenance mode ENABLED by ${event.senderID}`);
            
            let response = `✅ Maintenance mode enabled!\n\n`;
            response += `📝 Reason: ${status.reason}\n`;
            if (status.estimatedEnd) {
                response += `⏱️ ETA: ${maintenanceManager.formatDuration(time * 60 * 1000)}`;
            }
            
            return api.sendMessage(response, threadID, messageID);
        }
        
        case "off":
        case "disable":
        case "stop": {
            maintenanceManager.disable();
            logger.success("Maintenance", `Maintenance mode DISABLED by ${event.senderID}`);
            
            return api.sendMessage(
                `✅ Maintenance mode disabled!\n\nThe bot is now fully operational.`,
                threadID,
                messageID
            );
        }
        
        case "status": {
            const status = maintenanceManager.getStatus();
            
            let response = `🔧 Maintenance Status\n\n`;
            response += `Status: ${status.enabled ? "🔴 ENABLED" : "🟢 DISABLED"}\n`;
            
            if (status.enabled) {
                response += `Reason: ${status.reason}\n`;
                response += `Started: ${status.startedAt ? status.startedAt.toLocaleString() : "N/A"}\n`;
                response += `Duration: ${status.duration || "N/A"}\n`;
                
                if (status.estimatedEnd) {
                    const remaining = status.estimatedEnd.getTime() - Date.now();
                    response += `ETA: ${remaining > 0 ? maintenanceManager.formatDuration(remaining) : "Overdue"}\n`;
                }
                
                response += `Users Notified: ${status.notifiedCount}`;
            }
            
            return api.sendMessage(response, threadID, messageID);
        }
        
        case "reason": {
            if (args.length < 2) {
                return api.sendMessage(
                    `❌ Please provide a reason.\n\nUsage: maintenance reason <new reason>`,
                    threadID,
                    messageID
                );
            }
            
            const newReason = args.slice(1).join(" ");
            maintenanceManager.setReason(newReason);
            
            return api.sendMessage(
                `✅ Maintenance reason updated!\n\n📝 ${newReason}`,
                threadID,
                messageID
            );
        }
        
        case "time":
        case "eta": {
            if (args.length < 2) {
                return api.sendMessage(
                    `❌ Please provide estimated time in minutes.\n\nUsage: maintenance time <minutes>`,
                    threadID,
                    messageID
                );
            }
            
            const minutes = parseInt(args[1], 10);
            
            if (isNaN(minutes) || minutes < 1) {
                return api.sendMessage(
                    `❌ Please provide a valid number of minutes.`,
                    threadID,
                    messageID
                );
            }
            
            maintenanceManager.setEstimatedTime(minutes);
            
            return api.sendMessage(
                `✅ Estimated time updated!\n\n⏱️ ETA: ${maintenanceManager.formatDuration(minutes * 60 * 1000)}`,
                threadID,
                messageID
            );
        }
        
        case "reset": {
            maintenanceManager.resetAllNotifications();
            
            return api.sendMessage(
                `✅ Notification tracking reset!\n\nAll users will be notified again on next command attempt.`,
                threadID,
                messageID
            );
        }
        
        default: {
            return api.sendMessage(
                `❌ Unknown action: ${action}\n\n` +
                `Valid actions: on, off, status, reason, time, reset`,
                threadID,
                messageID
            );
        }
    }
};
