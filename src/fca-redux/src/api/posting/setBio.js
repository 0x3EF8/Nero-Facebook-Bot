"use strict";

const utils = require("../../lib/utils");

/**
 * @description Updates the bot's Facebook bio/intro text.
 * @param {Object} defaultFuncs The default functions provided by the API wrapper.
 * @param {Object} api The full API object.
 * @param {Object} ctx The context object containing the user's session state.
 * @returns {Function} The setBio function.
 */
module.exports = function (defaultFuncs, api, ctx) {
    /**
     * Updates the user's Facebook bio/intro.
     *
     * @param {string} bio The new bio text (max ~101 characters).
     * @returns {Promise<Object>} A promise that resolves with the result.
     *
     * @example
     * api.setBio("Hello, I'm a bot! 🤖");
     */
    return async function setBio(bio) {
        if (typeof bio !== "string") {
            throw new Error("Bio must be a string.");
        }

        // Facebook bio has a character limit (~101 chars)
        if (bio.length > 101) {
            throw new Error(`Bio is too long (${bio.length} chars). Maximum is 101 characters.`);
        }

        const form = {
            av: ctx.userID,
            __user: ctx.userID,
            __a: "1",
            fb_dtsg: ctx.fb_dtsg,
            jazoest: ctx.jazoest,
            fb_api_caller_class: "RelayModern",
            fb_api_req_friendly_name: "ProfileCometSetBioMutation",
            variables: JSON.stringify({
                input: {
                    bio: bio,
                    publish_to_feed: false,
                    actor_id: ctx.userID,
                    client_mutation_id: Math.floor(Math.random() * 1000000).toString(),
                },
                hasProfileTileViewID: false,
                profileTileViewID: null,
                scale: 1,
            }),
            doc_id: "2725043627607610",
        };

        try {
            const resData = await defaultFuncs
                .post("https://www.facebook.com/api/graphql/", ctx.jar, form)
                .then(utils.parseAndCheckLogin(ctx, defaultFuncs));

            // Check for errors
            if (resData.errors && resData.errors.length > 0) {
                throw new Error(resData.errors[0]?.message || "Failed to update bio");
            }

            // Check for successful update
            const bioData = resData.data?.profile_intro_card_set_bio;
            if (bioData) {
                return {
                    success: true,
                    bio: bio,
                    message: "Bio updated successfully!",
                };
            }

            // Try alternate response path
            if (resData.data) {
                return {
                    success: true,
                    bio: bio,
                    message: "Bio updated successfully!",
                };
            }

            throw new Error("Failed to update bio - no response data");
        } catch (err) {
            utils.error("setBio", err);
            throw err;
        }
    };
};
