"use strict";

const utils = require("../../lib/utils");

module.exports = function (defaultFuncs, api, ctx) {
    return async function setMessageReactionMqtt(reaction, messageID, threadID) {
        if (!ctx.mqttClient) {
            throw new Error("Not connected to MQTT");
        }

        ctx.wsReqNumber += 1;
        ctx.wsTaskNumber += 1;

        const taskPayload = {
            thread_key: threadID,
            timestamp_ms: Date.now(),
            message_id: messageID,
            reaction,
            actor_id: ctx.userID,
            reaction_style: null,
            sync_group: 1,
            send_attribution: Math.random() < 0.5 ? 65537 : 524289,
        };

        const task = {
            failure_count: null,
            label: "29",
            payload: JSON.stringify(taskPayload),
            queue_name: JSON.stringify(["reaction", messageID]),
            task_id: ctx.wsTaskNumber,
        };

        const content = {
            app_id: "2220391788200892",
            payload: JSON.stringify({
                data_trace_id: null,
                epoch_id: parseInt(utils.generateOfflineThreadingID()), // ✅ fixed here
                tasks: [task],
                version_id: "7158486590867448",
            }),
            request_id: ctx.wsReqNumber,
            type: 3,
        };

        /*if (isCallable(callback)) {
      ctx.reqCallbacks[ctx.wsReqNumber] = callback;
    }*/

        ctx.mqttClient.publish(
            "/ls_req",
            JSON.stringify(content),
            { qos: 0, retain: false },
            (err) => {
                if (err) {
                    utils.error("setMessageReactionMqtt: Failed to publish reaction", err);
                }
            }
        );
    };
};
