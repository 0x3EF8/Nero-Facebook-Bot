/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                      STALK/PROFILE SERVICE MODULE                             ║
 * ║              Get user profile information with picture                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module services/stalk
 * @author 0x3EF8
 * @version 1.0.0
 *
 * Features:
 * - Fetch user profile by UID, mention, or name search
 * - Display profile picture and cover photo
 * - AI-powered profile summary
 */

"use strict";

const https = require("https");
const { PassThrough } = require("stream");

const { gemini } = require("../core/gemini");
const { users } = require("../core/users");
const { REACTIONS } = require("../core/constants");

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Internal logger
 * @private
 */
const log = {
    info: (msg) => console.log(`[Stalk] ℹ ${msg}`),
    success: (msg) => console.log(`[Stalk] ✓ ${msg}`),
    warn: (msg) => console.warn(`[Stalk] ⚠ ${msg}`),
    error: (msg) => console.error(`[Stalk] ✗ ${msg}`),
};

/**
 * Set message reaction (non-blocking)
 * @private
 */
function react(api, messageID, reaction) {
    api.setMessageReaction(reaction, messageID, () => {}, true);
}

/**
 * Fetch image from URL as stream
 * @param {string} url - Image URL
 * @param {string} filename - Output filename
 * @returns {Promise<PassThrough>} Image stream
 * @private
 */
function fetchImage(url, filename) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, { timeout: 10000 }, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                return fetchImage(response.headers.location, filename)
                    .then(resolve)
                    .catch(reject);
            }
            if (response.statusCode !== 200) {
                return reject(new Error(`Failed to fetch image: ${response.statusCode}`));
            }
            const passThrough = new PassThrough();
            passThrough.path = filename;
            response.pipe(passThrough);
            resolve(passThrough);
        });
        request.on("error", reject);
        request.on("timeout", () => {
            request.destroy();
            reject(new Error("Request timeout"));
        });
    });
}


/**
 * Find user ID by name search in group
 * @param {Map} members - Group members map
 * @param {string} searchName - Name to search
 * @returns {string|null} User ID if found
 * @private
 */
function findUserByName(members, searchName) {
    const lowerSearch = searchName.toLowerCase().trim();
    
    for (const [id, name] of members.entries()) {
        const lowerName = name.toLowerCase();
        
        // Exact match
        if (lowerName === lowerSearch) {
            return id;
        }
        
        // First name match
        const firstName = lowerName.split(" ")[0];
        if (firstName === lowerSearch) {
            return id;
        }
        
        // Contains match
        if (lowerName.includes(lowerSearch)) {
            return id;
        }
    }
    
    return null;
}

/**
 * Generate AI summary of the user profile
 * @param {Object} userInfo - User info object
 * @param {string} requesterName - Name of person asking
 * @param {string} targetID - User ID
 * @returns {Promise<string>} AI-generated full profile summary
 * @private
 */
async function generateProfileSummary(userInfo, requesterName, targetID) {
    try {
        const model = gemini.createModelProxy();
        
        const profileData = {
            name: userInfo.name,
            firstName: userInfo.firstName || null,
            lastName: userInfo.lastName || null,
            uid: userInfo.id || targetID,
            username: userInfo.vanity ? `@${userInfo.vanity}` : null,
            gender: userInfo.gender || "not specified",
            bio: userInfo.bio || null,
            headline: userInfo.headline || null,
            location: userInfo.live_city || null,
            isVerified: userInfo.isVerified || false,
            isBirthday: userInfo.isBirthday || false,
            followers: userInfo.followers || null,
            following: userInfo.following || null,
            profileUrl: userInfo.profileUrl || `https://facebook.com/${targetID}`,
        };
        
        const prompt = `You are Nero, a friendly AI assistant. ${requesterName} asked about a Facebook user's profile.

Here is all the profile data:
${JSON.stringify(profileData, null, 2)}

Write a natural, conversational response that includes ALL the important profile information. 
Guidelines:
- Be friendly and natural, like you're telling a friend about someone
- Include their name, UID, username (if available), gender, and profile link
- Mention their bio/headline if they have one
- Note if they're verified or if it's their birthday
- Include follower count if available
- Do NOT use emojis
- Do NOT use separators like "━━━" or "---"
- Do NOT use bold/special unicode characters
- Keep it concise but informative (3-5 sentences)
- End with their profile link

Example style: "Here's what I found about [Name]. Their Facebook UID is [uid] and they go by [username]. They're [gender]. [Any bio/location info]. You can check out their profile at [link]."`;

        const result = await model.generateContent(prompt);
        const text = result?.response?.text?.();
        
        return text?.trim() || null;
    } catch {
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get user profile information with picture
 *
 * @param {Object} api - Facebook API instance
 * @param {string} threadID - Thread identifier
 * @param {string} messageID - Message ID for reactions
 * @param {string} targetIdentifier - User ID, name, or "@mention"
 * @param {Object} event - Message event (for mentions)
 * @param {string} requesterName - Name of person asking
 * @returns {Promise<void>}
 */
async function getUserProfile(api, threadID, messageID, targetIdentifier, event, requesterName) {
    try {
        react(api, messageID, REACTIONS.searching);
        
        let targetID = null;
        
        // Clean up the identifier (remove @ symbol if present)
        const cleanIdentifier = targetIdentifier.replace(/^@/, "").trim();
        
        // Debug: log what we're working with
        log.info(`Target identifier: "${targetIdentifier}" → clean: "${cleanIdentifier}"`);
        log.info(`Event mentions: ${JSON.stringify(event?.mentions || {})}`);
        
        // Check if it's a UID (numeric string)
        if (/^\d{10,}$/.test(cleanIdentifier)) {
            targetID = cleanIdentifier;
            log.info(`Looking up UID: ${targetID}`);
        }
        // PRIORITY 1: Check mentions in event FIRST (most reliable for @ mentions)
        else if (event?.mentions && Object.keys(event.mentions).length > 0) {
            const mentionUIDs = Object.keys(event.mentions);
            
            // If target had @ prefix, use the first mention directly
            if (targetIdentifier.startsWith("@") && mentionUIDs.length > 0) {
                targetID = mentionUIDs[0];
                log.info(`Using @ mention directly: ${targetID}`);
            } else {
                // Try to match by name
                for (const [uid, mentionName] of Object.entries(event.mentions)) {
                    const cleanMention = mentionName.replace(/^@/, "").toLowerCase().trim();
                    const cleanTarget = cleanIdentifier.toLowerCase();
                    
                    if (cleanMention === cleanTarget ||
                        cleanMention.includes(cleanTarget) || 
                        cleanTarget.includes(cleanMention)) {
                        targetID = uid;
                        log.info(`Found mention match: "${mentionName}" → ${uid}`);
                        break;
                    }
                }
                
                // Fallback: use the first mention if we have one
                if (!targetID && mentionUIDs.length > 0) {
                    targetID = mentionUIDs[0];
                    log.info(`Using first mention as fallback: ${targetID}`);
                }
            }
        }
        
        // PRIORITY 2: Search by name in group members
        if (!targetID) {
            log.info(`Searching group members for: "${cleanIdentifier}"`);
            const allMembers = await users.getAllGroupMembers(api, threadID);
            targetID = findUserByName(allMembers, cleanIdentifier);
            
            if (targetID) {
                log.info(`Found by name search: "${cleanIdentifier}" → ${targetID}`);
            } else {
                log.warn(`Could not find user: "${cleanIdentifier}"`);
                react(api, messageID, REACTIONS.error);
                return api.sendMessage(
                    `I couldn't find anyone named "${cleanIdentifier}" in this group. Try mentioning them with @ or use their full name.`,
                    threadID,
                    null,
                    messageID
                );
            }
        }
        
        // Fetch user info
        log.info(`Fetching profile for: ${targetID}`);
        
        const userInfo = await new Promise((resolve, reject) => {
            api.getUserInfo(targetID, true, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });
        
        if (!userInfo) {
            react(api, messageID, REACTIONS.error);
            return api.sendMessage("I couldn't fetch that user's information. They might have privacy settings enabled.", threadID, null, messageID);
        }
        
        // Generate AI summary with all profile data
        const aiSummary = await generateProfileSummary(userInfo, requesterName, targetID);
        
        // Build fallback message if AI fails
        let message;
        if (aiSummary) {
            message = aiSummary;
        } else {
            // Simple fallback without emojis/separators
            const parts = [];
            parts.push(`Here's what I found about ${userInfo.name || "this user"}.`);
            parts.push(`Their Facebook UID is ${userInfo.id || targetID}.`);
            if (userInfo.vanity) parts.push(`They go by @${userInfo.vanity}.`);
            if (userInfo.gender) parts.push(`Gender: ${userInfo.gender === "male_singular" || userInfo.gender === "male" ? "Male" : userInfo.gender === "female_singular" || userInfo.gender === "female" ? "Female" : userInfo.gender}.`);
            if (userInfo.bio) parts.push(`Their bio says: "${userInfo.bio}"`);
            if (userInfo.live_city) parts.push(`They're from ${userInfo.live_city}.`);
            if (userInfo.followers) parts.push(`They have ${userInfo.followers.toLocaleString()} followers.`);
            parts.push(`Profile: ${userInfo.profileUrl || `https://facebook.com/${targetID}`}`);
            message = parts.join(" ");
        }
        
        // Fetch profile picture and cover photo
        const attachments = [];
        const fetchPromises = [];
        
        if (userInfo.profilePicUrl) {
            fetchPromises.push(
                fetchImage(userInfo.profilePicUrl, `profile_${targetID}.jpg`)
                    .then((stream) => {
                        attachments.unshift(stream); // Profile pic first
                    })
                    .catch((err) => {
                        log.warn(`Failed to fetch profile pic: ${err.message}`);
                    })
            );
        }
        
        if (userInfo.coverPhoto) {
            fetchPromises.push(
                fetchImage(userInfo.coverPhoto, `cover_${targetID}.jpg`)
                    .then((stream) => {
                        attachments.push(stream); // Cover second
                    })
                    .catch((err) => {
                        log.warn(`Failed to fetch cover photo: ${err.message}`);
                    })
            );
        }
        
        await Promise.all(fetchPromises);
        
        log.success(`Sending profile for: ${userInfo.name}`);
        react(api, messageID, REACTIONS.success);
        
        await api.sendMessage(
            {
                body: message,
                attachment: attachments.length > 0 ? attachments : undefined,
            },
            threadID,
            null,
            messageID
        );
        
    } catch (error) {
        log.error(`Profile fetch error: ${error.message}`);
        react(api, messageID, REACTIONS.error);
        
        return api.sendMessage(
            `❌ Error fetching profile: ${error.message}`,
            threadID,
            null,
            messageID
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    getUserProfile,
};
