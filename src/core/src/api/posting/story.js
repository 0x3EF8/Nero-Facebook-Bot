"use strict";

const utils = require("../../lib/utils");
const { URL } = require("url");

/**
 * @namespace api.story
 * @description A collection of functions for interacting with Facebook Stories.
 * @license Ex-it
 * @author Jonell Magallanes, ChoruOfficial, 0x3EF8
 */
module.exports = function (defaultFuncs, api, ctx) {
    /**
     * (Internal) Extracts the Story ID from a Facebook story URL.
     * @param {string} url The Facebook story URL.
     * @returns {string|null} The extracted Story ID or null if not found.
     */
    function getStoryIDFromURL(url) {
        try {
            const urlObject = new URL(url);
            const pathParts = urlObject.pathname.split("/");
            const storiesIndex = pathParts.indexOf("stories");
            if (storiesIndex !== -1 && pathParts.length > storiesIndex + 2) {
                return pathParts[storiesIndex + 2];
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    /**
     * (Internal) Upload media for story
     * @param {ReadStream} attachment - File stream to upload
     * @returns {Promise<string>} Media ID
     */
    async function uploadStoryMedia(attachment) {
        try {
            const uploadForm = {
                av: ctx.userID,
                __user: ctx.userID,
                fb_dtsg: ctx.fb_dtsg,
                jazoest: ctx.jazoest,
                source: "8",
                profile_id: ctx.userID,
                waterfallxapp: "comet",
                upload_id: `jsc_c_${Date.now()}`,
                farr: attachment,
            };

            const res = await defaultFuncs.postFormData(
                "https://upload.facebook.com/ajax/react_composer/attachments/photo/upload",
                ctx.jar,
                uploadForm
            );

            const responseText = res.body.toString();
            
            // Parse response - Facebook returns "for (;;);{json}"
            let jsonStr = responseText;
            if (responseText.startsWith("for (;;);")) {
                jsonStr = responseText.slice(9);
            }
            
            const data = JSON.parse(jsonStr);
            
            if (data.payload && data.payload.photoID) {
                return data.payload.photoID;
            }

            if (data.payload && data.payload.fbid) {
                return data.payload.fbid;
            }

            // Try alternate response format
            if (data.jsmods && data.jsmods.require) {
                for (const req of data.jsmods.require) {
                    if (req[0] === "PhotoUploader" && req[3] && req[3][0]) {
                        return req[3][0].photoID || req[3][0].fbid;
                    }
                }
            }

            throw new Error("Could not extract photo ID from upload response");
        } catch (err) {
            throw new Error(`Failed to upload story media: ${err.message}`);
        }
    }

    /**
     * (Internal) The core function to send a reply or reaction to a story.
     * @param {string} storyIdOrUrl The ID or URL of the story.
     * @param {string} message The text message or emoji reaction.
     * @param {boolean} isReaction True if the reply is a lightweight reaction.
     * @returns {Promise<object>} The server's response.
     */
    async function sendStoryReply(storyIdOrUrl, message, isReaction) {
        try {
            const allowedReactions = ["❤️", "👍", "🤗", "😆", "😡", "😢", "😮"];

            if (!storyIdOrUrl) throw new Error("Story ID or URL is required.");
            if (!message) throw new Error("A message or reaction is required.");

            let storyID = getStoryIDFromURL(storyIdOrUrl);
            if (!storyID) storyID = storyIdOrUrl;

            const variables = {
                input: {
                    attribution_id_v2:
                        "StoriesCometSuspenseRoot.react,comet.stories.viewer,via_cold_start",
                    message: message,
                    story_id: storyID,
                    story_reply_type: isReaction ? "LIGHT_WEIGHT" : "TEXT",
                    actor_id: ctx.userID,
                    client_mutation_id: Math.floor(Math.random() * 10 + 1).toString(),
                },
            };

            if (isReaction) {
                if (!allowedReactions.includes(message)) {
                    throw new Error(
                        `Invalid reaction. Please use one of: ${allowedReactions.join(" ")}`
                    );
                }
                variables.input.lightweight_reaction_actions = {
                    offsets: [0],
                    reaction: message,
                };
            }

            const form = {
                av: ctx.userID,
                __user: ctx.userID,
                __a: "1",
                fb_dtsg: ctx.fb_dtsg,
                jazoest: ctx.jazoest,
                fb_api_caller_class: "RelayModern",
                fb_api_req_friendly_name: "useStoriesSendReplyMutation",
                variables: JSON.stringify(variables),
                doc_id: "9697491553691692",
            };

            const res = await defaultFuncs.post(
                "https://www.facebook.com/api/graphql/",
                ctx.jar,
                form,
                {}
            );
            if (res.data.errors) throw new Error(JSON.stringify(res.data.errors));

            const storyReplyData = res.data?.data?.direct_message_reply;
            if (!storyReplyData)
                throw new Error("Could not find 'direct_message_reply' in the response data.");

            return { success: true, result: storyReplyData };
        } catch (err) {
            throw err;
        }
    }

    /**
     * Creates a new text-based story.
     * @param {string} message The text content of the story.
     * @param {string} [fontName="classic"] The name of the font to use. Options: `headline`, `classic`, `casual`, `fancy`.
     * @param {string} [backgroundName="blue"] The name of the background to use. Options: `orange`, `blue`, `green`, `modern`.
     * @returns {Promise<{success: boolean, storyID: string}>} A promise that resolves with the new story's ID.
     */
    async function create(message, fontName = "classic", backgroundName = "blue") {
        const fontMap = {
            headline: "1919119914775364",
            classic: "516266749248495",
            casual: "516266749248495",
            fancy: "1790435664339626",
        };
        const bgMap = {
            orange: "2163607613910521",
            blue: "401372137331149",
            green: "367314917184744",
            modern: "554617635055752",
        };

        const fontId = fontMap[fontName.toLowerCase()] || fontMap.classic;
        const bgId = bgMap[backgroundName.toLowerCase()] || bgMap.blue;

        const variables = {
            input: {
                audiences: [{ stories: { self: { target_id: ctx.userID } } }],
                audiences_is_complete: true,
                logging: { composer_session_id: "createStoriesText-" + Date.now() },
                navigation_data: {
                    attribution_id_v2: "StoriesCreateRoot.react,comet.stories.create",
                },
                source: "WWW",
                message: { ranges: [], text: message },
                text_format_metadata: { inspirations_custom_font_id: fontId },
                text_format_preset_id: bgId,
                tracking: [null],
                actor_id: ctx.userID,
                client_mutation_id: "2",
            },
        };

        const form = {
            __a: "1",
            fb_api_caller_class: "RelayModern",
            fb_api_req_friendly_name: "StoriesCreateMutation",
            variables: JSON.stringify(variables),
            doc_id: "24226878183562473",
        };

        try {
            const res = await defaultFuncs.post(
                "https://www.facebook.com/api/graphql/",
                ctx.jar,
                form,
                {}
            );
            if (res.data.errors) throw new Error(JSON.stringify(res.data.errors));

            const storyNode =
                res.data?.data?.story_create?.viewer?.actor?.story_bucket?.nodes[0]
                    ?.first_story_to_show;
            if (!storyNode || !storyNode.id)
                throw new Error("Could not find the storyCardID in the response.");

            return { success: true, storyID: storyNode.id };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Creates a new photo-based story.
     * @param {ReadStream|ReadStream[]} attachment - Image stream(s) to upload.
     * @param {string} [caption=""] - Optional caption/text overlay for the story.
     * @returns {Promise<{success: boolean, storyID: string}>} A promise that resolves with the new story's ID.
     */
    async function createPhoto(attachment, caption = "") {
        try {
            // Handle single or multiple attachments
            const attachments = Array.isArray(attachment) ? attachment : [attachment];
            
            if (attachments.length === 0) {
                throw new Error("At least one image attachment is required.");
            }

            // Upload the first image (Facebook stories typically use one image)
            const photoID = await uploadStoryMedia(attachments[0]);
            
            if (!photoID) {
                throw new Error("Failed to upload image for story.");
            }

            const variables = {
                input: {
                    audiences: [{ stories: { self: { target_id: ctx.userID } } }],
                    audiences_is_complete: true,
                    logging: { composer_session_id: "createStoriesPhoto-" + Date.now() },
                    navigation_data: {
                        attribution_id_v2: "StoriesCreateRoot.react,comet.stories.create",
                    },
                    source: "WWW",
                    tracking: [null],
                    actor_id: ctx.userID,
                    client_mutation_id: Math.floor(Math.random() * 1000000).toString(),
                    media: [{
                        photo: {
                            id: photoID,
                        }
                    }],
                },
            };

            // Add caption/text overlay if provided
            if (caption && caption.trim()) {
                variables.input.message = { ranges: [], text: caption };
            }

            const form = {
                av: ctx.userID,
                __user: ctx.userID,
                __a: "1",
                fb_dtsg: ctx.fb_dtsg,
                jazoest: ctx.jazoest,
                fb_api_caller_class: "RelayModern",
                fb_api_req_friendly_name: "StoriesCreateMutation",
                variables: JSON.stringify(variables),
                doc_id: "24226878183562473",
            };

            const res = await defaultFuncs.post(
                "https://www.facebook.com/api/graphql/",
                ctx.jar,
                form,
                {}
            );

            if (res.data?.errors) {
                throw new Error(JSON.stringify(res.data.errors));
            }

            const storyNode =
                res.data?.data?.story_create?.viewer?.actor?.story_bucket?.nodes[0]
                    ?.first_story_to_show;

            if (!storyNode || !storyNode.id) {
                // Try alternate response path
                const altStoryID = res.data?.data?.story_create?.post_id;
                if (altStoryID) {
                    return { success: true, storyID: altStoryID };
                }
                throw new Error("Could not find the storyID in the response.");
            }

            return { success: true, storyID: storyNode.id };
        } catch (error) {
            throw error;
        }
    }

    return {
        /**
         * Creates a new text-based story.
         * @param {string} message The text content of the story.
         * @param {string} [fontName="classic"] The font to use (`headline`, `classic`, `fancy`).
         * @param {string} [backgroundName="blue"] The background to use (`orange`, `blue`, `green`, `modern`).
         * @returns {Promise<{success: boolean, storyID: string}>}
         */
        create,
        /**
         * Creates a new photo-based story.
         * @param {ReadStream|ReadStream[]} attachment - Image stream(s) to upload.
         * @param {string} [caption=""] - Optional caption/text overlay for the story.
         * @returns {Promise<{success: boolean, storyID: string}>}
         */
        createPhoto,
        /**
         * Reacts to a story with a specific emoji.
         * @param {string} storyIdOrUrl The ID or full URL of the story to react to.
         * @param {string} reaction The emoji to react with. Must be one of: ❤️, 👍, 🤗, 😆, 😡, 😢, 😮.
         * @returns {Promise<{success: boolean, result: object}>}
         */
        react: (storyIdOrUrl, reaction) => sendStoryReply(storyIdOrUrl, reaction, true),
        /**
         * Sends a text message reply to a story.
         * @param {string} storyIdOrUrl The ID or full URL of the story to reply to.
         * @param {string} message The text message to send.
         * @returns {Promise<{success: boolean, result: object}>}
         */
        msg: (storyIdOrUrl, message) => sendStoryReply(storyIdOrUrl, message, false),
    };
};
