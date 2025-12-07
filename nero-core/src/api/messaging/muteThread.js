"use strict";

const utils = require("../../lib/utils");

/**
 * @description Mutes or unmutes a thread's notifications.
 * @param {Object} defaultFuncs The default functions provided by the API wrapper.
 * @param {Object} api The full API object.
 * @param {Object} ctx The context object containing the user's session state.
 * @returns {Function} The muteThread function.
 */
module.exports = function (defaultFuncs, api, ctx) {
    /**
     * Mutes or unmutes notifications for a thread.
     *
     * @param {string} threadID The ID of the thread to mute/unmute.
     * @param {number} muteSeconds The duration to mute in seconds:
     *   - -1: Mute permanently (until manually unmuted)
     *   - 0: Unmute the thread
     *   - 60: Mute for 1 minute
     *   - 3600: Mute for 1 hour
     *   - 28800: Mute for 8 hours
     *   - 86400: Mute for 24 hours
     * @param {Function} [callback] Optional callback function.
     * @returns {Promise<Object>} A promise that resolves with the result.
     *
     * @example
     * // Mute permanently
     * api.muteThread("123456789", -1);
     *
     * // Mute for 1 hour
     * api.muteThread("123456789", 3600);
     *
     * // Unmute
     * api.muteThread("123456789", 0);
     */
    return async function muteThread(threadID, muteSeconds, callback) {
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

        // Validate parameters
        if (!threadID) {
            const error = new Error("threadID is required.");
            _callback(error);
            return returnPromise;
        }

        if (typeof muteSeconds !== "number") {
            const error = new Error(
                "muteSeconds must be a number (-1 for permanent, 0 to unmute, or seconds to mute)."
            );
            _callback(error);
            return returnPromise;
        }

        const form = {
            thread_fbid: threadID,
            mute_settings: muteSeconds,
        };

        try {
            const resData = await defaultFuncs
                .post("https://www.facebook.com/ajax/mercury/change_mute_thread.php", ctx.jar, form)
                .then(utils.saveCookies(ctx.jar))
                .then(utils.parseAndCheckLogin(ctx, defaultFuncs));

            if (resData && resData.error) {
                throw resData;
            }

            // Determine action description
            let actionDescription;
            if (muteSeconds === -1) {
                actionDescription = "muted permanently";
            } else if (muteSeconds === 0) {
                actionDescription = "unmuted";
            } else {
                const hours = Math.floor(muteSeconds / 3600);
                const minutes = Math.floor((muteSeconds % 3600) / 60);
                if (hours > 0) {
                    actionDescription = `muted for ${hours} hour(s)`;
                } else {
                    actionDescription = `muted for ${minutes} minute(s)`;
                }
            }

            const result = {
                success: true,
                threadID: threadID,
                muteSeconds: muteSeconds,
                action: actionDescription,
                message: `Thread ${threadID} has been ${actionDescription}.`,
            };

            _callback(null, result);
            return returnPromise;
        } catch (err) {
            utils.error("muteThread", err);
            _callback(err);
            return returnPromise;
        }
    };
};
