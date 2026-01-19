"use strict";

const utils = require("../../lib/utils");

module.exports = function (defaultFuncs, api, ctx) {
    return async (messageID) => {
        try {
            // Apply human behavior delay before unsending
            if (ctx.globalOptions.humanBehavior && utils.humanBehavior) {
                await utils.humanBehavior.beforeAction(ctx, "generic");
            }

            const defData = await defaultFuncs.post(
                "https://www.facebook.com/messaging/unsend_message/",
                ctx.jar,
                {
                    message_id: messageID,
                }
            );
            const resData = await utils.parseAndCheckLogin(ctx, defaultFuncs)(defData);

            if (resData.error) {
                const errorMsg =
                    typeof resData.error === "string"
                        ? resData.error
                        : JSON.stringify(resData.error);
                throw new Error(`Failed to unsend message: ${errorMsg}`);
            }

            return resData;
        } catch (error) {
            // Properly format error message
            const errorMsg = error.message || error.toString();
            throw new Error(`Unsend message failed: ${errorMsg}`);
        }
    };
};
