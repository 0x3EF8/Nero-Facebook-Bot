/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                          BETA AI EVENT HANDLER                                ║
 * ║              Neural Core Engine v3.1 - Professional Edition                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * @description Context-aware AI chatbot powered by Google Gemini 2.5-Flash
 *              Features: Multi-modal support, intelligent caching, smart commands
 * @author 0x3EF8
 * @version 3.1.0
 * @license MIT
 */

"use strict";

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORTS
// ═══════════════════════════════════════════════════════════════════════════════

// Core modules
const { gemini } = require("./core/gemini");
const { memory } = require("./core/memory");
const { users } = require("./core/users");
const { AI_IDENTITY, MESSAGES, REACTIONS, MEDIA_CONFIG } = require("./core/constants");

// Services (initialized on import)
require("./services/music");
require("./services/video");
require("./services/weather");
require("./services/lyrics");
require("./services/poll");

// Handlers
const { handleCommands } = require("./handlers/commands");
const { buildPrompt } = require("./handlers/prompt");

// Utilities
const { downloadImageAsBase64 } = require("./utils/images");
require("./utils/youtube");

// Config
const config = require("../../../../config/config");

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

module.exports.config = {
    name: "betaAI",
    description: `${AI_IDENTITY.name} v${AI_IDENTITY.version} - Multilingual AI powered by Gemini`,
    eventTypes: ["message", "message_reply"],
    priority: 100,
    enabled: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Main event handler for Beta AI
 * @param {Object} context - Event context
 */
module.exports.execute = async function ({ api, event, logger }) {
    const { threadID, senderID, body: text, messageID } = event;

    // ─────────────────────────────────────────────────────────────────────────
    // VALIDATION
    // ─────────────────────────────────────────────────────────────────────────
    
    if (!text || typeof text !== "string") return;

    const botID = api.getCurrentUserID?.() || config.botID;
    if (senderID === botID) return;

    // ─────────────────────────────────────────────────────────────────────────
    // ACTIVATION CHECK
    // ─────────────────────────────────────────────────────────────────────────
    
    const isMentioned = AI_IDENTITY.triggerPatterns.some(pattern => pattern.test(text));
    const isReplyToBeta = event.type === "message_reply" && 
                          memory.isBetaMessage(event.messageReply?.messageID);

    if (!isMentioned && !isReplyToBeta) return;

    // ─────────────────────────────────────────────────────────────────────────
    // PREPROCESSING
    // ─────────────────────────────────────────────────────────────────────────
    
    let cleanText = text;
    for (const pattern of AI_IDENTITY.triggerPatterns) {
        cleanText = cleanText.replace(new RegExp(pattern, "gi"), "").trim();
    }

    if (!cleanText) {
        return api.sendMessage(MESSAGES.greeting, threadID, messageID);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MAIN PROCESSING
    // ─────────────────────────────────────────────────────────────────────────
    
    try {
        setReaction(api, messageID, REACTIONS.loading);
        logger.debug("BetaAI", `Processing: "${truncate(cleanText, 50)}"`);

        // Resolve user & update memory
        const userName = await users.getName(api, senderID, event);
        memory.updateChat(threadID, userName, cleanText);

        // Extract images
        const images = await extractImages(event);
        logger.debug("BetaAI", `User: ${userName} | Images: ${images.length}`);

        // Build prompt & generate response
        const prompt = await buildPrompt({
            api, _event: event, text: cleanText,
            userName, threadID, senderID, images,
        });

        const result = await gemini.generate(prompt, images);
        const responseText = result?.response?.text?.() || "";

        if (!responseText) {
            setReaction(api, messageID, REACTIONS.error);
            return api.sendMessage(MESSAGES.noResponse, threadID, messageID);
        }

        // ─────────────────────────────────────────────────────────────────────
        // COMMAND DETECTION & RESPONSE
        // ─────────────────────────────────────────────────────────────────────
        
        const handled = await handleCommands({
            api, _event: event, response: responseText,
            text: cleanText, threadID, senderID, userName, messageID,
        });

        if (handled) return;

        // Send regular response
        setReaction(api, messageID, REACTIONS.success);
        const sentMessage = await api.sendMessage(responseText.trim(), threadID, messageID);

        if (sentMessage?.messageID) {
            memory.trackBetaMessage(sentMessage.messageID);
        }
        memory.updateChat(threadID, AI_IDENTITY.name, responseText.trim());

    } catch (error) {
        handleError(api, event, error, logger);
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract images from message event
 */
async function extractImages(event) {
    const images = [];
    const allAttachments = [
        ...(event.attachments || []),
        ...(event.messageReply?.attachments || []),
    ];

    for (const attachment of allAttachments) {
        if (images.length >= MEDIA_CONFIG.maxImages) break;

        const isImage = attachment.type === "photo" || attachment.type === "animated_image";
        if (!isImage) continue;

        const imageUrl = attachment.url || attachment.largePreviewUrl || attachment.previewUrl;
        if (!imageUrl) continue;

        const imageData = await downloadImageAsBase64(imageUrl, attachment.type);
        if (imageData) images.push(imageData);
    }

    return images;
}

/**
 * Set message reaction safely
 */
function setReaction(api, messageID, reaction) {
    api.setMessageReaction(reaction, messageID, () => {}, true);
}

/**
 * Truncate string with ellipsis
 */
function truncate(str, length) {
    return str.length > length ? `${str.substring(0, length)}...` : str;
}

/**
 * Handle errors gracefully
 */
function handleError(api, event, error, logger) {
    const { threadID, messageID } = event;
    
    logger.error("BetaAI", `Error: ${error.message}`);
    logger.debug("BetaAI", error.stack);
    setReaction(api, messageID, REACTIONS.error);

    const errorStr = error.message || "";
    const errorMsg = (errorStr.includes("429") || errorStr.includes("quota"))
        ? MESSAGES.rateLimited
        : MESSAGES.error;

    api.sendMessage(errorMsg, threadID, messageID);
}
