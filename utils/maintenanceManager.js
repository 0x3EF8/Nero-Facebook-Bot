/**
 * Maintenance Manager
 * Handles bot maintenance mode with anti-spam notification system
 * 
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

/**
 * MaintenanceManager Class
 * Manages maintenance mode state and user notifications
 */
class MaintenanceManager {
    constructor() {
        /** @type {boolean} Whether maintenance mode is active */
        this.enabled = false;
        
        /** @type {string} Maintenance reason/message */
        this.reason = "The bot is currently under maintenance.";
        
        /** @type {Date|null} When maintenance started */
        this.startedAt = null;
        
        /** @type {Date|null} Estimated end time */
        this.estimatedEnd = null;
        
        /** @type {Set<string>} Users who have been notified (prevents spam) */
        this.notifiedUsers = new Set();
        
        /** @type {number} How long (ms) before a user can be notified again */
        this.notificationCooldown = 5 * 60 * 1000; // 5 minutes
        
        /** @type {Map<string, number>} Track when users were last notified */
        this.lastNotified = new Map();
    }
    
    /**
     * Enable maintenance mode
     * @param {Object} options - Maintenance options
     * @param {string} [options.reason] - Reason for maintenance
     * @param {number} [options.estimatedMinutes] - Estimated duration in minutes
     * @returns {Object} Maintenance status
     */
    enable(options = {}) {
        this.enabled = true;
        this.reason = options.reason || "The bot is currently under maintenance.";
        this.startedAt = new Date();
        
        if (options.estimatedMinutes) {
            this.estimatedEnd = new Date(Date.now() + options.estimatedMinutes * 60 * 1000);
        } else {
            this.estimatedEnd = null;
        }
        
        // Clear notified users when enabling (fresh start)
        this.notifiedUsers.clear();
        this.lastNotified.clear();
        
        return this.getStatus();
    }
    
    /**
     * Disable maintenance mode
     * @returns {Object} Maintenance status
     */
    disable() {
        this.enabled = false;
        this.reason = "";
        this.startedAt = null;
        this.estimatedEnd = null;
        this.notifiedUsers.clear();
        this.lastNotified.clear();
        
        return this.getStatus();
    }
    
    /**
     * Check if maintenance mode is active
     * @returns {boolean}
     */
    isEnabled() {
        return this.enabled;
    }
    
    /**
     * Get current maintenance status
     * @returns {Object}
     */
    getStatus() {
        return {
            enabled: this.enabled,
            reason: this.reason,
            startedAt: this.startedAt,
            estimatedEnd: this.estimatedEnd,
            duration: this.startedAt ? this.formatDuration(Date.now() - this.startedAt.getTime()) : null,
            notifiedCount: this.notifiedUsers.size,
        };
    }
    
    /**
     * Check if a user should receive maintenance notification
     * Prevents spam by only notifying once per cooldown period
     * @param {string} userId - User ID to check
     * @returns {boolean} Whether to send notification
     */
    shouldNotify(userId) {
        if (!this.enabled) return false;
        
        const lastTime = this.lastNotified.get(userId);
        const now = Date.now();
        
        // If never notified or cooldown has passed
        if (!lastTime || (now - lastTime) > this.notificationCooldown) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Mark user as notified
     * @param {string} userId - User ID
     */
    markNotified(userId) {
        this.notifiedUsers.add(userId);
        this.lastNotified.set(userId, Date.now());
    }
    
    /**
     * Get maintenance message for users
     * @returns {string}
     */
    getMessage() {
        let message = `🔧 Maintenance Mode\n\n${this.reason}`;
        
        if (this.estimatedEnd) {
            const remaining = this.estimatedEnd.getTime() - Date.now();
            if (remaining > 0) {
                message += `\n\n⏱️ Estimated time remaining: ${this.formatDuration(remaining)}`;
            } else {
                message += `\n\n⏱️ Should be back online soon...`;
            }
        }
        
        message += `\n\nPlease try again later. Thank you for your patience.`;
        
        return message;
    }
    
    /**
     * Format duration to human readable string
     * @param {number} ms - Duration in milliseconds
     * @returns {string}
     */
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }
    
    /**
     * Update maintenance reason
     * @param {string} reason - New reason
     */
    setReason(reason) {
        this.reason = reason;
    }
    
    /**
     * Update estimated end time
     * @param {number} minutes - Minutes from now
     */
    setEstimatedTime(minutes) {
        this.estimatedEnd = new Date(Date.now() + minutes * 60 * 1000);
    }
    
    /**
     * Clear estimated end time
     */
    clearEstimatedTime() {
        this.estimatedEnd = null;
    }
    
    /**
     * Reset notification tracking for a specific user
     * @param {string} userId - User ID
     */
    resetUserNotification(userId) {
        this.notifiedUsers.delete(userId);
        this.lastNotified.delete(userId);
    }
    
    /**
     * Reset all notification tracking
     */
    resetAllNotifications() {
        this.notifiedUsers.clear();
        this.lastNotified.clear();
    }
}

// Export singleton instance
module.exports = new MaintenanceManager();
