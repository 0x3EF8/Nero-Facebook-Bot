"use strict";

const utils = require("../../lib/utils");

/**
 * @description Creates a poll in a group chat thread.
 * @param {Object} defaultFuncs The default functions provided by the API wrapper.
 * @param {Object} api The full API object.
 * @param {Object} ctx The context object containing the user's session state.
 * @returns {Function} The createPoll function.
 */
module.exports = function (defaultFuncs, api, ctx) {
    /**
     * Creates a poll in a group chat.
     *
     * @param {string} threadID The ID of the group thread where the poll will be created.
     * @param {string} question The poll question text.
     * @param {Array<Object>} options Array of poll options. Each option should be:
     *   - { text: "Option text" } or
     *   - { text: "Option text", selected: true } for pre-selected options
     * @param {Function} [callback] Optional callback function.
     * @returns {Promise<Object>} A promise that resolves with the poll creation result.
     *
     * @example
     * // Create a simple poll
     * api.createPoll("123456789", "What's for lunch?", [
     *   { text: "Pizza" },
     *   { text: "Burger" },
     *   { text: "Salad" }
     * ]);
     *
     * // Create a poll with pre-selected option
     * api.createPoll("123456789", "Meeting time?", [
     *   { text: "10 AM", selected: true },
     *   { text: "2 PM" },
     *   { text: "4 PM" }
     * ]);
     */
    return async function createPoll(threadID, question, options, callback) {
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

        if (!question || typeof question !== "string") {
            const error = new Error("A question string is required.");
            _callback(error);
            return returnPromise;
        }

        if (!Array.isArray(options) || options.length < 2) {
            const error = new Error("At least 2 poll options are required.");
            _callback(error);
            return returnPromise;
        }

        // Format options for the API
        const formattedOptions = options.map((opt) => {
            if (typeof opt === "string") {
                return { text: opt, viewer_has_voted: false };
            }
            return {
                text: opt.text || opt,
                viewer_has_voted: opt.selected || false,
            };
        });

        try {
            // Use GraphQL mutation for poll creation
            const form = {
                fb_dtsg: ctx.fb_dtsg,
                jazoest: ctx.ttstamp,
                doc_id: "6140498822679791", // Poll creation doc_id
                variables: JSON.stringify({
                    input: {
                        client_mutation_id: Math.round(Math.random() * 1024).toString(),
                        actor_id: ctx.userID,
                        thread_id: threadID,
                        question_text: question,
                        options: formattedOptions,
                    },
                }),
            };

            const resData = await defaultFuncs
                .post("https://www.facebook.com/api/graphql/", ctx.jar, form)
                .then(utils.parseAndCheckLogin(ctx.jar, defaultFuncs));

            if (!resData) {
                throw new Error("Empty response from poll creation API");
            }

            // Check for errors in response
            if (resData.errors || resData.error) {
                const errorMessage = resData.errors?.[0]?.message || resData.error?.message || "Poll creation failed";
                throw new Error(errorMessage);
            }

            const result = {
                success: true,
                threadID: threadID,
                question: question,
                options: formattedOptions,
                message: `Poll "${question}" created with ${formattedOptions.length} options.`,
            };

            _callback(null, result);
        } catch (_err) {
            // Fallback: Try MQTT method
            console.log("[Poll] GraphQL failed, trying MQTT fallback...");
            
            if (!ctx.mqttClient) {
                const error = new Error("Not connected to MQTT. Please ensure listenMqtt is running.");
                _callback(error);
                return returnPromise;
            }

            try {
                ctx.wsReqNumber = (ctx.wsReqNumber || 0) + 1;
                ctx.wsTaskNumber = (ctx.wsTaskNumber || 0) + 1;

                const mqttOptions = formattedOptions.map(opt => ({
                    text: opt.text,
                    selected: opt.viewer_has_voted || false,
                }));

                const queryPayload = {
                    question_text: question,
                    thread_key: threadID,
                    options: mqttOptions,
                    sync_group: 1,
                };

                const query = {
                    failure_count: null,
                    label: "163",
                    payload: JSON.stringify(queryPayload),
                    queue_name: "poll_creation",
                    task_id: ctx.wsTaskNumber,
                };

                const context = {
                    app_id: ctx.appID,
                    payload: {
                        epoch_id: parseInt(utils.generateOfflineThreadingID()),
                        tasks: [query],
                        version_id: "8768858626531631",
                    },
                    request_id: ctx.wsReqNumber,
                    type: 3,
                };
                context.payload = JSON.stringify(context.payload);

                ctx.mqttClient.publish(
                    "/ls_req",
                    JSON.stringify(context),
                    { qos: 0, retain: false },
                    (publishErr) => {
                        if (publishErr) {
                            _callback(publishErr);
                            return;
                        }

                        const result = {
                            success: true,
                            threadID: threadID,
                            question: question,
                            options: mqttOptions,
                            message: `Poll "${question}" created with ${mqttOptions.length} options.`,
                        };

                        _callback(null, result);
                    }
                );
            } catch (mqttErr) {
                utils.error("createPoll", mqttErr);
                _callback(mqttErr);
            }
        }

        return returnPromise;
    };
};
