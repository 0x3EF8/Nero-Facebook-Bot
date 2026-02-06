/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                        IMAGE UTILITIES MODULE                                 ║
 * ║            Handles image downloading and conversion                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module utils/images
 * @author 0x3EF8
 * @version 2.0.0
 *
 * Features:
 * - Download images from URLs
 * - Convert to base64 for Gemini API
 * - Support for photos and GIFs
 */

"use strict";

const axios = require("axios");
const { DEBUG } = require("../core/constants");

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** @type {number} Download timeout in milliseconds */
const DOWNLOAD_TIMEOUT = 10000;

/** @type {Object} MIME types for different attachment types */
const MIME_TYPES = Object.freeze({
    photo: "image/jpeg",
    animated_image: "image/gif",
    image: "image/jpeg",
});

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL LOGGER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Internal logger
 * @private
 */
const log = {
    info: (msg) => DEBUG && console.log(`[Images] ℹ ${msg}`),
    error: (msg) => console.error(`[Images] ✗ ${msg}`),
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Download and convert image to base64 for Gemini API
 *
 * @param {string} imageUrl - URL of the image to download
 * @param {string} [type="photo"] - Attachment type (photo, animated_image, image)
 * @returns {Promise<Object|null>} Gemini-compatible image object or null on error
 *
 * @example
 * const imageData = await downloadImageAsBase64("https://example.com/image.jpg");
 * // Returns: { inlineData: { data: "base64...", mimeType: "image/jpeg" } }
 */
async function downloadImageAsBase64(imageUrl, type = "photo") {
    try {
        log.info(`Downloading image: ${imageUrl.substring(0, 50)}...`);

        const response = await axios({
            url: imageUrl,
            method: "GET",
            responseType: "arraybuffer",
            timeout: DOWNLOAD_TIMEOUT,
        });

        const base64Image = Buffer.from(response.data, "binary").toString("base64");
        const mimeType = MIME_TYPES[type] || MIME_TYPES.photo;

        return {
            inlineData: {
                data: base64Image,
                mimeType,
            },
        };
    } catch (err) {
        log.error(`Image download error: ${err.message || err}`);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    downloadImageAsBase64,
};
