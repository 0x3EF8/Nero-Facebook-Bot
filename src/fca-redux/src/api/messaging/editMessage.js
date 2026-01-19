"use_strict";
/**
 * @author RFS-ADRENO
 * @rewrittenBy Isai Ivanov
 */
//fixed march 30
const utils = require("../../lib/utils");

/*
function canBeCalled(func) {
    try {
        Reflect.apply(func, null, []);
        return true;
    } catch (_error) {
        return false;
    }
}
*/

/**
 * A function for editing bot's messages.
 * @param {string} text - The text with which the bot will edit its messages.
 * @param {string} messageID - The message ID of the message the bot will edit.
 * @param {Object} callback - Callback for the function.
 */

module.exports = function (defaultFuncs, api, ctx) {
    return async function editMessage(text, messageID, _callback) {
        if (!ctx.mqttClient) {
            throw new Error("Not connected to MQTT");
        }

        // Apply human behavior delay before editing (similar to typing)
        if (ctx.globalOptions.humanBehavior && utils.humanBehavior) {
            await utils.humanBehavior.beforeSendMessage(ctx, api, null, text || "");
        }

        ctx.wsReqNumber += 1;
        ctx.wsTaskNumber += 1;

        const queryPayload = {
            message_id: messageID,
            text,
        };

        const query = {
            failure_count: null,
            label: "742",
            payload: JSON.stringify(queryPayload),
            queue_name: "edit_message",
            task_id: ctx.wsTaskNumber,
        };

        const context = {
            app_id: "2220391788200892",
            payload: {
                data_trace_id: null,
                epoch_id: parseInt(utils.generateOfflineThreadingID()),
                tasks: [query],
                version_id: "6903494529735864",
            },
            request_id: ctx.wsReqNumber,
            type: 3,
        };

        context.payload = JSON.stringify(context.payload);

        // if (canBeCalled(callback)) {
        // 	ctx.reqCallbacks[ctx.wsReqNumber] = callback;
        // }

        ctx.mqttClient.publish("/ls_req", JSON.stringify(context), {
            qos: 0,
            retain: false,
        });
    };
};
