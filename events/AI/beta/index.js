/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                          BETA AI EVENT HANDLER                                ║
 * ║              Neural Core Engine v3.0 - SUPER AI EDITION                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 * 
 * @description Context-aware AI chatbot powered by Google Gemini 2.5-Flash
 * @author 0x3EF8
 * @version 3.0.0-SUPER-AI
 * @license MIT
 * 
 * This is the main entry point for the Beta AI module.
 * All functionality is split into modular components for maintainability.
 */

// Import core modules
const { gemini } = require("./core/gemini");
const { memory } = require("./core/memory");
const { users } = require("./core/users");

// Import services (used in handlers)
require("./services/music");
require("./services/video");
require("./services/weather");
require("./services/lyrics");

// Import handlers
const { handleCommands } = require("./handlers/commands");
const { buildPrompt } = require("./handlers/prompt");

// Import utilities
const { downloadImageAsBase64 } = require("./utils/images");
require("./utils/youtube"); // Setup YouTube platform

const config = require("../../../config/config");

/**
 * Event configuration
 */
module.exports.config = {
  name: "betaAI",
  description: "Multilingual AI chatbot powered by Google Gemini - understands and responds in any language",
  eventTypes: ["message", "message_reply"],
  priority: 100,
  enabled: true,
};

/**
 * Main event handler
 */
module.exports.execute = async function ({ api, event, logger }) {
  const { threadID, senderID, body: text, messageID } = event;

  // Skip empty messages
  if (!text || typeof text !== "string") return;

  // Skip bot's own messages
  const botID = api.getCurrentUserID?.() || config.botID;
  if (senderID === botID) return;

  // Check if Beta is mentioned (with or without @) or if user is replying to Beta
  const mentionRegex = /\b@?beta\b/i;
  const isMentioned = mentionRegex.test(text);
  const isReplyToBeta = event.type === "message_reply" && 
    memory.isBetaMessage(event.messageReply?.messageID);

  // If not activated, skip
  if (!isMentioned && !isReplyToBeta) return;

  // Remove @Beta or beta mention from text
  const cleanText = text.replace(/\b@?beta\b/gi, "").trim();

  // If empty after removing mention, send help
  if (!cleanText) {
    return api.sendMessage(
      "👋 Hi! I'm Beta, your AI assistant. How can I help you today?",
      threadID,
      messageID
    );
  }

  try {
    // Set loading reaction
    api.setMessageReaction("⏳", messageID, () => {}, true);
    logger.debug("BetaAI", `Triggered for: "${cleanText.substring(0, 50)}..."`);

    // Get user name
    const userName = await users.getName(api, senderID, event);
    logger.debug("BetaAI", `User: ${userName}`);

    // Update chat memory
    memory.updateChat(threadID, userName, cleanText);

    // Get images if any
    const images = await getImagesFromEvent(event);
    logger.debug("BetaAI", `Images: ${images.length}`);

    // Build the AI prompt
    logger.debug("BetaAI", "Building prompt...");
    const prompt = await buildPrompt({
      api,
      _event: event,
      text: cleanText,
      userName,
      threadID,
      senderID,
      images,
    });

    // Generate AI response
    logger.debug("BetaAI", "Generating AI response...");
    const result = await gemini.generate(prompt, images);
    const responseText = result?.response?.text?.() || "";
    logger.debug("BetaAI", `Response length: ${responseText.length}`);

    if (!responseText) {
      api.setMessageReaction("❌", messageID, () => {}, true);
      return api.sendMessage(
        "Sorry, I couldn't generate a response. Please try again.",
        threadID,
        messageID
      );
    }

    // Handle special commands in response
    const handled = await handleCommands({
      api,
      _event: event,
      response: responseText,
      text: cleanText,
      threadID,
      senderID,
      userName,
      messageID,
    });

    if (handled) return;

    // Send regular response
    api.setMessageReaction("✅", messageID, () => {}, true);
    
    const sentMessage = await api.sendMessage(responseText.trim(), threadID, messageID);
    
    // Track Beta's message for reply detection
    if (sentMessage?.messageID) {
      memory.trackBetaMessage(sentMessage.messageID);
    }

    // Update memory with Beta's response
    memory.updateChat(threadID, "Beta", responseText.trim());

  } catch (error) {
    logger.error("BetaAI", `Error: ${error.message}`);
    logger.debug("BetaAI", error.stack);
    api.setMessageReaction("❌", messageID, () => {}, true);
    
    let errorMsg = "❌ Sorry, something went wrong. Please try again.";
    
    if (error.message?.includes("429") || error.message?.includes("quota")) {
      errorMsg = "⚠️ I'm a bit overwhelmed right now. Please wait a moment and try again.";
    }
    
    return api.sendMessage(errorMsg, threadID, messageID);
  }
};

/**
 * Extract images from event (message or reply)
 */
async function getImagesFromEvent(event) {
  const images = [];
  const maxImages = 20;

  // Get attachments from current message
  const attachments = event.attachments || [];
  
  // Get attachments from replied message
  const replyAttachments = event.messageReply?.attachments || [];
  
  const allAttachments = [...attachments, ...replyAttachments];

  for (const attachment of allAttachments) {
    if (images.length >= maxImages) break;

    if (attachment.type === "photo" || attachment.type === "animated_image") {
      const imageUrl = attachment.url || attachment.largePreviewUrl || attachment.previewUrl;
      
      if (imageUrl) {
        const imageData = await downloadImageAsBase64(imageUrl, attachment.type);
        if (imageData) {
          images.push(imageData);
        }
      }
    }
  }

  return images;
}
