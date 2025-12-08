/**
 * Image Utilities Module
 * Handles image downloading and conversion
 * 
 * @module utils/images
 */

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

/**
 * Check if URL is a valid image URL
 * @param {string} url - URL to check
 * @returns {boolean} True if valid image URL
 */
function isValidImageUrl(url) {
  if (!url || typeof url !== "string") return false;
  
  const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"];
  const lowerUrl = url.toLowerCase();
  
  return (
    imageExtensions.some((ext) => lowerUrl.includes(ext)) ||
    lowerUrl.includes("fbcdn") ||
    lowerUrl.includes("scontent")
  );
}

module.exports = {
  downloadImageAsBase64,
  isValidImageUrl,
};
