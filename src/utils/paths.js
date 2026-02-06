/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                         PATH UTILITIES MODULE                                 ║
 * ║              Centralized path management for consistent file operations       ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This module provides centralized path utilities to ensure all temporary files,
 * downloads, and other generated content are stored in consistent locations.
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const fs = require("fs");
const path = require("path");

// ═══════════════════════════════════════════════════════════════════════════════
//                              BASE PATHS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the project root directory
 * @returns {string} Absolute path to project root
 */
const getProjectRoot = () => process.cwd();

/**
 * Get the data directory path
 * @returns {string} Absolute path to data directory
 */
const getDataDir = () => path.join(getProjectRoot(), "data");

/**
 * Get the temp directory path (inside data folder)
 * @returns {string} Absolute path to temp directory
 */
const getTempDir = () => path.join(getDataDir(), "temp");

/**
 * Get the accounts directory path
 * @returns {string} Absolute path to accounts directory
 */
const getAccountsDir = () => path.join(getProjectRoot(), "accounts");

/**
 * Get the logs directory path
 * @returns {string} Absolute path to logs directory
 */
const getLogsDir = () => path.join(getProjectRoot(), "logs");

// ═══════════════════════════════════════════════════════════════════════════════
//                              DIRECTORY MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Ensure a directory exists, creating it recursively if needed
 * @param {string} dirPath - Path to the directory
 * @returns {string} The same directory path (for chaining)
 */
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    return dirPath;
}

/**
 * Get temp directory and ensure it exists
 * @returns {string} Absolute path to temp directory (guaranteed to exist)
 */
function getTempDirSync() {
    return ensureDir(getTempDir());
}

/**
 * Get data directory and ensure it exists
 * @returns {string} Absolute path to data directory (guaranteed to exist)
 */
function getDataDirSync() {
    return ensureDir(getDataDir());
}

// ═══════════════════════════════════════════════════════════════════════════════
//                              TEMP FILE UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a temp file path with timestamp
 * @param {string} prefix - File prefix (e.g., 'audio', 'video', 'image')
 * @param {string} extension - File extension (e.g., 'mp3', 'mp4', 'png')
 * @returns {string} Full path to temp file
 */
function getTempFilePath(prefix, extension) {
    const tempDir = getTempDirSync();
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    return path.join(tempDir, `${prefix}_${timestamp}_${randomId}.${extension}`);
}

/**
 * Generate a temp file path with custom name
 * @param {string} filename - The filename (will be sanitized)
 * @returns {string} Full path to temp file
 */
function getTempFilePathWithName(filename) {
    const tempDir = getTempDirSync();
    // Sanitize filename to remove invalid characters
    const sanitized = filename.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 100);
    return path.join(tempDir, sanitized);
}

/**
 * Clean up old temp files (older than specified age)
 * @param {number} maxAgeMs - Maximum age in milliseconds (default: 1 hour)
 * @returns {number} Number of files deleted
 */
function cleanupTempFiles(maxAgeMs = 60 * 60 * 1000) {
    const tempDir = getTempDir();
    
    if (!fs.existsSync(tempDir)) {
        return 0;
    }

    const now = Date.now();
    let deletedCount = 0;

    try {
        const files = fs.readdirSync(tempDir);
        
        for (const file of files) {
            const filePath = path.join(tempDir, file);
            
            try {
                const stats = fs.statSync(filePath);
                
                // Skip directories
                if (stats.isDirectory()) continue;
                
                // Check file age
                const fileAge = now - stats.mtimeMs;
                
                if (fileAge > maxAgeMs) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
            } catch {
                // Ignore errors for individual files
            }
        }
    } catch {
        // Ignore errors reading directory
    }

    return deletedCount;
}

/**
 * Delete a specific temp file safely
 * @param {string} filePath - Path to the file to delete
 * @returns {boolean} True if deleted, false otherwise
 */
function deleteTempFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
    } catch {
        // Ignore errors
    }
    return false;
}

/**
 * Schedule a temp file for delayed deletion
 * @param {string} filePath - Path to the file
 * @param {number} delayMs - Delay in milliseconds (default: 5 seconds)
 */
function scheduleDelete(filePath, delayMs = 5000) {
    setTimeout(() => {
        deleteTempFile(filePath);
    }, delayMs);
}

// ═══════════════════════════════════════════════════════════════════════════════
//                              EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    // Base paths (used externally)
    getTempDir,
    
    // Directory management
    ensureDir,
    getTempDirSync,
    
    // Temp file utilities
    getTempFilePath,
    cleanupTempFiles,
    deleteTempFile,
    scheduleDelete,
};
