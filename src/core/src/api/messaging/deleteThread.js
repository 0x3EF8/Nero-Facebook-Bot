"use strict";

const utils = require("../../lib/utils");

/**
 * @description Deletes threads (conversations) from the inbox.
 * @param {Object} defaultFuncs The default functions provided by the API wrapper.
 * @param {Object} api The full API object.
 * @param {Object} ctx The context object containing the user's session state.
 * @returns {Function} The deleteThread function.
 */
module.exports = function (defaultFuncs, api, ctx) {
    /**
     * Deletes a thread (conversation) from inbox.
     * This removes the conversation from your view but doesn't delete messages for others.
     *
     * @param {string|string[]} threadID The thread ID or array of thread IDs to delete.
     * @param {Function} [callback] Optional callback function.
     * @returns {Promise<Object>} A promise that resolves when the thread is deleted.
     *
     * @example
     * // Delete a single thread
     * api.deleteThread("123456789");
     *
     * // Delete multiple threads
     * api.deleteThread(["123", "456"]);
     */
    return async function deleteThread(threadID, callback) {
        let _callback;
        let resolvePromise, rejectPromise;
        const returnPromise = new Promise((resolve, reject) => {
            resolvePromise = resolve;
            rejectPromise = reject;
        });

        if (typeof callback === "function") {
            _callback = callback;
        } else {
            _callback = (err, data) => {
                if (err) return rejectPromise(err);
                resolvePromise(data);
            };
        }

        // Normalize threadID to array
        const threadIDs = Array.isArray(threadID) ? threadID : [threadID];

        if (threadIDs.length === 0) {
            const error = new Error("At least one threadID is required.");
            _callback(error);
            return returnPromise;
        }

        // Build the form data
        const form = {
            client: "mercury",
        };

        // Add thread IDs to form
        threadIDs.forEach((id, index) => {
            form[`ids[${index}]`] = id;
        });

        try {
            const resData = await defaultFuncs
                .post("https://www.facebook.com/ajax/mercury/delete_thread.php", ctx.jar, form)
                .then(utils.parseAndCheckLogin(ctx, defaultFuncs));

            if (resData && resData.error) {
                throw resData;
            }

            const result = {
                success: true,
                deletedCount: threadIDs.length,
                threadIDs: threadIDs,
                message: `Successfully deleted ${threadIDs.length} thread(s).`,
            };

            _callback(null, result);
            return returnPromise;
        } catch (err) {
            utils.error("deleteThread", err);
            _callback(err);
            return returnPromise;
        }
    };
};
