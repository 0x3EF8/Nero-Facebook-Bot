/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                      YOUTUBE PLATFORM UTILITIES                               ║
 * ║            Setup for youtubei.js platform requirements                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module utils/youtube
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const { Platform } = require("youtubei.js");

/**
 * Setup JavaScript evaluator for YouTube URL deciphering
 */
function setupYouTubePlatform() {
    Platform.shim.eval = (data, env) => {
        const properties = [];

        if (env.n) {
            properties.push(`n: exportedVars.nFunction("${env.n}")`);
        }

        if (env.sig) {
            properties.push(`sig: exportedVars.sigFunction("${env.sig}")`);
        }

        const code = `${data.output}\nreturn { ${properties.join(", ")} }`;

        return new Function(code)();
    };
}

// Auto-setup on module load
setupYouTubePlatform();

module.exports = {
    setupYouTubePlatform,
};
