/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                            QR CODE COMMAND                                    ║
 * ║              Generate QR codes from text or URLs                              ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This command generates a QR code image from the provided text or URL.
 * If a name is provided, it creates a styled card with the name below.
 * Uses the QR Server API for generation.
 *
 * @author 0x3EF8
 * @version 1.1.0
 */

"use strict";

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");

/**
 * Check if the input looks like a person's name
 * @param {string} text - Input text
 * @returns {boolean}
 */
function isName(text) {
    // Names typically:
    // - Don't contain URLs, emails, or code-like characters
    // - Are 1-5 words (allowing commas for "Last, First Middle" format)
    // - Don't start with numbers
    
    const urlPattern = /^(https?:\/\/|www\.|[a-zA-Z0-9.-]+\.[a-z]{2,})/i;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // Allow commas, periods, hyphens (common in names like "Jr." or "Mary-Jane")
    const codeChars = /[!@#$%^&*()_+=[\]{};':"\\|<>/?0-9]/;
    
    if (urlPattern.test(text)) return false;
    if (emailPattern.test(text)) return false;
    if (codeChars.test(text)) return false;
    
    // Check if it looks like a name (1-5 words)
    // Remove commas and periods for word counting
    const cleanText = text.replace(/[,.]/g, " ").trim();
    const words = cleanText.split(/\s+/).filter(w => w.length > 0);
    if (words.length < 1 || words.length > 6) return false;
    
    // Each word should be reasonable length for a name
    for (const word of words) {
        if (word.length < 1 || word.length > 25) return false;
    }
    
    return true;
}

/**
 * Create a styled QR card with name label
 * @param {Buffer} qrImageBuffer - QR code image buffer
 * @param {string} name - Name to display
 * @returns {Promise<Buffer>}
 */
async function createNameCard(qrImageBuffer, name) {
    const qrImage = await loadImage(qrImageBuffer);
    
    // Card dimensions
    const padding = 40;
    const qrSize = 300;
    const nameHeight = 60;
    const cardWidth = qrSize + (padding * 2);
    const cardHeight = qrSize + nameHeight + (padding * 2);
    
    // Create canvas
    const canvas = createCanvas(cardWidth, cardHeight);
    const ctx = canvas.getContext("2d");
    
    // White background with rounded corners effect
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, cardWidth, cardHeight);
    
    // Draw QR code centered
    const qrX = (cardWidth - qrSize) / 2;
    const qrY = padding;
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
    
    // Draw separator line
    ctx.strokeStyle = "#E0E0E0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, qrY + qrSize + 15);
    ctx.lineTo(cardWidth - padding, qrY + qrSize + 15);
    ctx.stroke();
    
    // Draw name text (uppercase, bold)
    const displayName = name.toUpperCase();
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // Calculate font size to fit
    let fontSize = 28;
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    
    // Reduce font size if text is too wide
    while (ctx.measureText(displayName).width > cardWidth - (padding * 2) && fontSize > 14) {
        fontSize -= 2;
        ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    }
    
    // Draw name centered below QR
    const nameY = qrY + qrSize + 15 + (nameHeight / 2);
    ctx.fillText(displayName, cardWidth / 2, nameY);
    
    return canvas.toBuffer("image/png");
}

module.exports = {
    config: {
        name: "qr",
        aliases: ["qrcode", "qrgen"],
        description: "Generate a QR code from text or URL",
        usage: "qr <text, URL, or name>",
        category: "user",
        cooldown: 5,
        permissions: "user",
        enabled: true,
        dmOnly: false,
        groupOnly: false,
    },

    /**
     * Command execution function
     * @param {Object} context - Command context
     */
    async execute({ api, event, args }) {
        const threadID = event.threadID;
        const messageID = event.messageID;

        // Check if data was provided
        if (!args.length) {
            return api.sendMessage(
                "⚠️ Please provide text, URL, or name to generate QR code.\n\n" +
                "Usage:\n" +
                "• qr <URL> - Generate plain QR code\n" +
                "• qr <name> - Generate styled QR card with name\n\n" +
                "Examples:\n" +
                "• qr https://google.com\n" +
                "• qr Cano, Reginald A.",
                threadID,
                messageID
            );
        }

        const data = args.join(" ");
        const encodedData = encodeURIComponent(data);
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedData}`;

        try {
            // React to show processing
            api.setMessageReaction("⏳", messageID, () => {}, true);

            // Download the QR code image
            const response = await axios({
                method: "GET",
                url: qrUrl,
                responseType: "arraybuffer",
            });

            // Save to temp file
            const tempDir = path.join(__dirname, "..", "..", "..", "..", "data", "temp");
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            let finalImage;
            let messageBody;
            
            // Check if input is a name - create styled card
            if (isName(data)) {
                try {
                    finalImage = await createNameCard(response.data, data);
                    messageBody = `📱 QR Name Card Generated`;
                } catch (_cardError) {
                    // Fallback to regular QR
                    finalImage = response.data;
                    messageBody = `📱 QR Code Generated\n\n📝 Data: ${data}`;
                }
            } else {
                // Regular QR code
                finalImage = response.data;
                messageBody = `📱 QR Code Generated\n\n📝 Data: ${data.length > 50 ? data.substring(0, 50) + "..." : data}`;
            }

            const tempFile = path.join(tempDir, `qr_${Date.now()}.png`);
            fs.writeFileSync(tempFile, finalImage);

            // Send the QR code
            await api.sendMessage(
                {
                    body: messageBody,
                    attachment: fs.createReadStream(tempFile),
                },
                threadID,
                messageID
            );

            // Clean up temp file
            fs.unlinkSync(tempFile);

            // Success reaction
            api.setMessageReaction("✅", messageID, () => {}, true);

        } catch (error) {
            api.setMessageReaction("❌", messageID, () => {}, true);
            return api.sendMessage(
                `❌ Failed to generate QR code: ${error.message}`,
                threadID,
                messageID
            );
        }
    },
};
