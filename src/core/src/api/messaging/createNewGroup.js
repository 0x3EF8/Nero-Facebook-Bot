"use strict";

const utils = require("../../lib/utils");

/**
 * @description Creates a new group chat with specified participants.
 * @param {Object} defaultFuncs The default functions provided by the API wrapper.
 * @param {Object} api The full API object.
 * @param {Object} ctx The context object containing the user's session state.
 * @returns {Function} The createNewGroup function.
 */
module.exports = function (defaultFuncs, api, ctx) {
    /**
     * Creates a new group chat with the specified participants.
     *
     * @param {string[]} participantIDs Array of user IDs to add to the group (minimum 2).
     * @param {string} [groupTitle] Optional name for the group chat.
     * @param {Function} [callback] Optional callback function.
     * @returns {Promise<Object>} A promise that resolves with the new group's thread ID and info.
     *
     * @example
     * // Create a group with a name
     * api.createNewGroup(["100001", "100002"], "My Awesome Group", (err, result) => {
     *   console.log("New group created:", result.threadID);
     * });
     *
     * // Create a group without a name
     * api.createNewGroup(["100001", "100002"]).then(result => {
     *   console.log("New group ID:", result.threadID);
     * });
     */
    return async function createNewGroup(participantIDs, groupTitle, callback) {
        let _callback;
        let _groupTitle = groupTitle;
        let resolvePromise, rejectPromise;
        const returnPromise = new Promise((resolve, reject) => {
            resolvePromise = resolve;
            rejectPromise = reject;
        });

        // Handle optional groupTitle parameter
        if (typeof groupTitle === "function") {
            _callback = groupTitle;
            _groupTitle = null;
        } else if (typeof callback === "function") {
            _callback = callback;
        } else {
            _callback = (err, data) => {
                if (err) return rejectPromise(err);
                resolvePromise(data);
            };
        }

        // Validate participantIDs
        if (!Array.isArray(participantIDs)) {
            const error = new Error("participantIDs must be an array of user IDs.");
            _callback(error);
            return returnPromise;
        }

        if (participantIDs.length < 2) {
            const error = new Error("At least 2 participant IDs are required to create a group.");
            _callback(error);
            return returnPromise;
        }

        // Build participants array with current user
        const participants = participantIDs.map((id) => ({ fbid: id }));
        participants.push({ fbid: ctx.userID });

        const form = {
            fb_api_caller_class: "RelayModern",
            fb_api_req_friendly_name: "MessengerGroupCreateMutation",
            av: ctx.userID,
            doc_id: "577041672419534",
            variables: JSON.stringify({
                input: {
                    entry_point: "jewel_new_group",
                    actor_id: ctx.userID,
                    participants: participants,
                    client_mutation_id: Math.round(Math.random() * 1024).toString(),
                    thread_settings: {
                        name: _groupTitle || null,
                        joinable_mode: "PRIVATE",
                        thread_image_fbid: null,
                    },
                },
            }),
        };

        try {
            const resData = await defaultFuncs
                .post("https://www.facebook.com/api/graphql/", ctx.jar, form)
                .then(utils.parseAndCheckLogin(ctx, defaultFuncs));

            if (resData && resData.errors) {
                throw { error: resData.errors };
            }

            const threadData = resData?.data?.messenger_group_thread_create?.thread;

            if (!threadData) {
                throw { error: "Failed to create group. No thread data returned." };
            }

            const threadID = threadData.thread_key?.thread_fbid;

            if (!threadID) {
                throw { error: "Failed to retrieve the new group's thread ID." };
            }

            const result = {
                success: true,
                threadID: threadID,
                name: _groupTitle || null,
                participantIDs: participantIDs,
                totalParticipants: participantIDs.length + 1, // +1 for current user
                message: `Group${_groupTitle ? ` "${_groupTitle}"` : ""} created successfully with ${participantIDs.length + 1} members.`,
            };

            _callback(null, result);
            return returnPromise;
        } catch (err) {
            utils.error("createNewGroup", err);
            _callback(err);
            return returnPromise;
        }
    };
};
