"use strict";

const utils = require("../../lib/utils");

/**
 * @param {Object} defaultFuncs
 * @param {Object} api
 * @param {Object} ctx
 * @returns {function(string[]|string): Promise<void>}
 */
module.exports = function (defaultFuncs, api, ctx) {
    /**
     * Deletes one or more threads.
     * @param {string|string[]} threadOrThreads - The thread ID or an array of thread IDs to delete.
     * @returns {Promise<void>}
     */
    return async function deleteThread(threadOrThreads) {
        if (!Array.isArray(threadOrThreads)) {
            threadOrThreads = [threadOrThreads];
        }

        const form = {
            client: "mercury",
        };

        for (let i = 0; i < threadOrThreads.length; i++) {
            form["ids[" + i + "]"] = threadOrThreads[i];
        }

        try {
            const resData = await defaultFuncs
                .post("https://www.facebook.com/ajax/mercury/delete_thread.php", ctx.jar, form)
                .then(utils.parseAndCheckLogin(ctx, defaultFuncs));

            if (resData.error) {
                throw resData;
            }

            return;
        } catch (err) {
            utils.error("deleteThread", err);
            throw err;
        }
    };
};
