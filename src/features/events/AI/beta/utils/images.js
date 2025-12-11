/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                        IMAGE UTILITIES MODULE                                 ║
 * ║            Handles image downloading and conversion                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module utils/images
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const axios = require("axios");
const chalk = require("chalk");

/**
 * Download and convert image to base64 for Gemini API
 * @param {string} imageUrl - URL of the image
 * @param {string} type - Attachment type (photo or animated_image)
 * @returns {Promise<Object|null>} Image data object or null on error
 */
async function downloadImageAsBase64(imageUrl, type = "photo") {
    try {
        const response = await axios({
            url: imageUrl,
            method: "GET",
            responseType: "arraybuffer",
            timeout: 10000,
        });

        const base64Image = Buffer.from(response.data, "binary").toString("base64");
        const mimeType = type === "animated_image" ? "image/gif" : "image/jpeg";

        return {
            inlineData: {
                data: base64Image,
                mimeType: mimeType,
            },
        };
    } catch (err) {
        console.error(chalk.red("❌ Image download error:"), err.message || err);
        return null;
    }
}

module.exports = {
    downloadImageAsBase64,
};
