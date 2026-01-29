/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                     TEMP CLEANUP BACKGROUND TASK                              ║
 * ║              Automatically cleans up old temporary files                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This background task periodically cleans up old temporary files from the
 * data/temp directory to prevent disk space issues.
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const logger = require("../../utils/logger");
const { cleanupTempFiles, getTempDir } = require("../../utils/paths");
const fs = require("fs");

module.exports = {
    config: {
        name: "tempCleanup",
        description: "Automatically cleans up old temporary files",
        interval: 30 * 60 * 1000, // Run every 30 minutes
        enabled: true,
        runOnStart: true,
    },

    /**
     * Execute the cleanup task
     * @param {Object} context - Task execution context
     * @param {Object} context.api - API instance (may be null)
     * @param {Object} context.accountManager - Account manager instance
     */
    async execute({ api, accountManager }) {
        try {
            const tempDir = getTempDir();

            // Check if temp directory exists
            if (!fs.existsSync(tempDir)) {
                return; // Nothing to clean
            }

            // Get file count before cleanup
            const filesBefore = fs.readdirSync(tempDir).filter((f) => {
                const stat = fs.statSync(`${tempDir}/${f}`);
                return stat.isFile();
            }).length;

            // Clean up files older than 1 hour
            const deletedCount = cleanupTempFiles(60 * 60 * 1000);

            // Only log if files were deleted
            if (deletedCount > 0) {
                logger.debug(
                    "TempCleanup",
                    `Cleaned up ${deletedCount} old temp files (${filesBefore - deletedCount} remaining)`
                );
            }
        } catch (error) {
            logger.debug("TempCleanup", `Cleanup error: ${error.message}`);
        }
    },
};
