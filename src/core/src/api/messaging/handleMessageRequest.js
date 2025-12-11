"use strict";

const utils = require("../../lib/utils");

/**
 * @description Handles message requests by accepting or declining them.
 * @param {Object} defaultFuncs The default functions provided by the API wrapper.
 * @param {Object} api The full API object.
 * @param {Object} ctx The context object containing the user's session state.
 * @returns {Function} The handleMessageRequest function.
 */
module.exports = function (defaultFuncs, api, ctx) {
    /**
     * Accepts or declines a message request.
     *
     * @param {string|string[]} threadID The thread ID or array of thread IDs to handle.
     * @param {boolean} accept True to accept (move to inbox), false to decline (move to other/spam).
     * @param {Function} [callback] Optional callback function.
     * @returns {Promise<Object>} A promise that resolves when the request is handled.
     *
     * @example
     * // Accept a message request
     * api.handleMessageRequest("123456789", true);
     *
     * // Decline multiple requests
     * api.handleMessageRequest(["123", "456"], false);
     */
    return async function handleMessageRequest(threadID, accept, callback) {
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

        // Validate accept parameter
        if (typeof accept !== "boolean") {
            const error = new Error(
                "The 'accept' parameter must be a boolean (true to accept, false to decline)."
            );
            _callback(error);
            return returnPromise;
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

        // "inbox" to accept, "other" to decline
        const messageBox = accept ? "inbox" : "other";

        threadIDs.forEach((id, index) => {
            form[`${messageBox}[${index}]`] = id;
        });

        try {
            const resData = await defaultFuncs
                .post("https://www.facebook.com/ajax/mercury/move_thread.php", ctx.jar, form)
                .then(utils.parseAndCheckLogin(ctx, defaultFuncs));

            if (resData && resData.error) {
                throw resData;
            }

            const result = {
                success: true,
                action: accept ? "accepted" : "declined",
                threadIDs: threadIDs,
                message: `Successfully ${accept ? "accepted" : "declined"} ${threadIDs.length} message request(s).`,
            };

            _callback(null, result);
            return returnPromise;
        } catch (err) {
            utils.error("handleMessageRequest", err);
            _callback(err);
            return returnPromise;
        }
    };
};
