"use strict";

const utils = require("../../lib/utils");

/**
 * @description Creates a post on the bot's Facebook timeline.
 * @param {Object} defaultFuncs The default functions provided by the API wrapper.
 * @param {Object} api The full API object.
 * @param {Object} ctx The context object containing the user's session state.
 * @returns {Function} The createPost function.
 */
module.exports = function (defaultFuncs, api, ctx) {
    /**
     * Creates a post on the user's timeline.
     *
     * @param {string} message The text content of the post.
     * @param {Object} [options] Optional settings for the post.
     * @param {string} [options.url] URL to attach to the post.
     * @param {ReadStream|ReadStream[]} [options.attachment] Image/video stream(s) to upload.
     * @param {Function} [callback] Optional callback function.
     * @returns {Promise<Object>} A promise that resolves with the post result.
     *
     * @example
     * // Simple text post
     * api.createPost("Hello world!");
     *
     * // Post with URL
     * api.createPost("Check this out!", { url: "https://example.com" });
     *
     * // Post with image
     * const fs = require('fs');
     * api.createPost("My photo", { attachment: fs.createReadStream("photo.jpg") });
     */
    return async function createPost(message, options, callback) {
        let _callback;
        let resolvePromise, rejectPromise;
        const returnPromise = new Promise((resolve, reject) => {
            resolvePromise = resolve;
            rejectPromise = reject;
        });

        // Handle different argument patterns
        if (typeof options === "function") {
            callback = options;
            options = {};
        }

        options = options || {};

        if (typeof callback === "function") {
            _callback = callback;
        } else {
            _callback = (err, data) => {
                if (err) return rejectPromise(err);
                resolvePromise(data);
            };
        }

        if (!message && !options.attachment) {
            const error = new Error("Message or attachment is required for creating a post.");
            _callback(error);
            return returnPromise;
        }

        try {
            const uploadedMedia = [];

            // Upload attachments if provided
            if (options.attachment) {
                const attachments = Array.isArray(options.attachment)
                    ? options.attachment
                    : [options.attachment];

                for (const attachment of attachments) {
                    const mediaId = await uploadMedia(defaultFuncs, ctx, attachment);
                    if (mediaId) {
                        uploadedMedia.push(mediaId);
                    }
                }
            }

            // Build composer variables
            const variables = {
                input: {
                    composer_entry_point: "inline_composer",
                    composer_source_surface: "timeline",
                    composer_type: "feed",
                    idempotence_token: `${ctx.userID}_FEED_${Date.now()}`,
                    source: "WWW",
                    message: {
                        text: message || "",
                    },
                    audience: {
                        privacy: {
                            allow: [],
                            base_state: "EVERYONE",
                            deny: [],
                            tag_expansion_state: "UNSPECIFIED",
                        },
                    },
                    actor_id: ctx.userID,
                    client_mutation_id: Math.floor(Math.random() * 1000000).toString(),
                },
            };

            // Add media if uploaded
            if (uploadedMedia.length > 0) {
                variables.input.attachments = uploadedMedia.map((mediaId) => ({
                    photo: {
                        id: mediaId,
                    },
                }));
            }

            // Add URL attachment if provided
            if (options.url) {
                variables.input.attachments = variables.input.attachments || [];
                variables.input.attachments.push({
                    link: {
                        share_scrape_data: JSON.stringify({
                            share_type: 100,
                            url: options.url,
                        }),
                    },
                });
            }

            const form = {
                av: ctx.userID,
                __user: ctx.userID,
                __a: "1",
                fb_dtsg: ctx.fb_dtsg,
                jazoest: ctx.jazoest,
                fb_api_caller_class: "RelayModern",
                fb_api_req_friendly_name: "ComposerStoryCreateMutation",
                variables: JSON.stringify(variables),
                doc_id: "7711610262190099",
            };

            const resData = await defaultFuncs
                .post("https://www.facebook.com/api/graphql/", ctx.jar, form)
                .then(utils.parseAndCheckLogin(ctx, defaultFuncs));

            const storyData = resData.data?.story_create?.story;

            // Check if post was actually created (success even if errors array exists)
            if (storyData || resData.data?.story_create) {
                const result = {
                    success: true,
                    postID:
                        storyData?.id || storyData?.post_id || resData.data?.story_create?.post_id,
                    url: storyData?.url,
                    message: "Post created successfully!",
                };

                _callback(null, result);
                return returnPromise;
            }

            // Only throw if there's actually an error and no successful post
            if (resData.errors && resData.errors.length > 0) {
                throw new Error(resData.errors[0]?.message || "Failed to create post");
            }

            // If no story data and no errors, something unexpected happened
            throw new Error("Failed to create post - no response data");
        } catch (err) {
            utils.error("createPost", err);
            _callback(err);
            return returnPromise;
        }
    };
};

/**
 * Upload media to Facebook
 * @param {Object} defaultFuncs - Default functions
 * @param {Object} ctx - Context object
 * @param {ReadStream} attachment - File stream to upload
 * @returns {Promise<string>} Media ID
 */
async function uploadMedia(defaultFuncs, ctx, attachment) {
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

        return null;
    } catch (err) {
        utils.error("uploadMedia", err);
        return null;
    }
}
