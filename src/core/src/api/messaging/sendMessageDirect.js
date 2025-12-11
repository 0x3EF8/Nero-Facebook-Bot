"use strict";

/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                      DIRECT MESSAGE SENDER                                    ║
 * ║         Sends messages without human behavior delays                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * Use this for time-sensitive operations like:
 * - Scheduled notifications (class reminders)
 * - System alerts
 * - Automated responses that need precise timing
 *
 * @module api/messaging/sendMessageDirect
 * @version 1.0.0
 */

const utils = require("../../lib/utils");

const allowedProperties = {
    attachment: true,
    url: true,
    sticker: true,
    emoji: true,
    emojiSize: true,
    body: true,
    mentions: true,
    location: true,
};

module.exports = (defaultFuncs, api, ctx) => {
    /**
     * Upload attachments to Facebook
     * @param {Array} attachments - Array of readable streams
     * @returns {Promise<Array>} Upload metadata
     */
    async function uploadAttachment(attachments) {
        const uploads = [];
        for (let i = 0; i < attachments.length; i++) {
            try {
                const attachment = attachments[i];

                if (!utils.isReadableStream(attachment)) {
                    throw new Error(
                        "Attachment should be a readable stream and not " +
                            utils.getType(attachment) +
                            "."
                    );
                }

                const response = await defaultFuncs
                    .postFormData(
                        "https://upload.facebook.com/ajax/mercury/upload.php",
                        ctx.jar,
                        {
                            upload_1024: attachment,
                            voice_clip: "true",
                        },
                        {}
                    )
                    .then(utils.parseAndCheckLogin(ctx, defaultFuncs));

                if (response.error) {
                    throw new Error(JSON.stringify(response));
                }

                if (response.payload && response.payload.metadata && response.payload.metadata[0]) {
                    uploads.push(response.payload.metadata[0]);
                }
            } catch (err) {
                utils.warn("sendMessageDirect", `Upload error: ${err.message}`);
            }
        }
        return uploads;
    }

    /**
     * Send content to Facebook
     * @param {Object} form - Form data
     * @param {string|Array} threadID - Thread ID(s)
     * @param {boolean} isSingleUser - Is single user chat
     * @param {string} messageAndOTID - Message and OTID
     * @returns {Promise<Object>} Message info
     */
    async function sendContent(form, threadID, isSingleUser, messageAndOTID) {
        if (utils.getType(threadID) === "Array") {
            for (let i = 0; i < threadID.length; i++) {
                form["specific_to_list[" + i + "]"] = "fbid:" + threadID[i];
            }
            form["specific_to_list[" + threadID.length + "]"] = "fbid:" + ctx.userID;
            form["client_thread_id"] = "root:" + messageAndOTID;
        } else {
            if (isSingleUser) {
                form["specific_to_list[0]"] = "fbid:" + threadID;
                form["specific_to_list[1]"] = "fbid:" + ctx.userID;
                form["other_user_fbid"] = threadID;
            } else {
                form["thread_fbid"] = threadID;
            }
        }

        if (ctx.globalOptions.pageID) {
            form["author"] = "fbid:" + ctx.globalOptions.pageID;
            form["specific_to_list[1]"] = "fbid:" + ctx.globalOptions.pageID;
            form["creator_info[creatorID]"] = ctx.userID;
            form["creator_info[creatorType]"] = "direct_admin";
            form["creator_info[labelType]"] = "sent_message";
            form["creator_info[pageID]"] = ctx.globalOptions.pageID;
            form["request_user_id"] = ctx.globalOptions.pageID;
            form["creator_info[profileURI]"] =
                "https://www.facebook.com/profile.php?id=" + ctx.userID;
        }

        const resData = await defaultFuncs
            .post("https://www.facebook.com/messaging/send/", ctx.jar, form)
            .then(utils.parseAndCheckLogin(ctx, defaultFuncs));

        if (!resData) {
            throw new Error("Send message failed.");
        }

        if (resData.error) {
            if (resData.error === 1545012) {
                utils.warn(
                    "sendMessageDirect",
                    "Error 1545012: Not part of conversation " + threadID
                );
            }
            const errMsg = `Error ${resData.error}: ${resData.errorSummary || resData.errorDescription || JSON.stringify(resData)}`;
            throw new Error(errMsg);
        }

        const messageInfo = resData.payload.actions.reduce((p, v) => {
            return p || (v.thread_fbid && v.message_id && v.timestamp
                ? { threadID: v.thread_fbid, messageID: v.message_id, timestamp: v.timestamp }
                : null);
        }, null);

        return messageInfo;
    }

    /**
     * Send message directly without human behavior simulation
     * Ideal for scheduled tasks and time-sensitive notifications
     *
     * @param {string|Object} msg - Message body or object with body/attachment
     * @param {string|Array} threadID - Thread ID(s) to send to
     * @param {string} [replyToMessage] - Message ID to reply to
     * @param {boolean} [isSingleUser=false] - Is single user chat
     * @returns {Promise<Object>} Message info with threadID, messageID, timestamp
     */
    return async (msg, threadID, replyToMessage, isSingleUser = false) => {
        // Convert replyToMessage to primitive string if needed
        if (
            replyToMessage &&
            typeof replyToMessage === "object" &&
            replyToMessage instanceof String
        ) {
            replyToMessage = String(replyToMessage);
        }

        const msgType = utils.getType(msg);
        const threadIDType = utils.getType(threadID);
        const messageIDType = utils.getType(replyToMessage);

        if (msgType !== "String" && msgType !== "Object") {
            throw new Error("Message should be of type string or object and not " + msgType + ".");
        }
        if (threadIDType !== "Array" && threadIDType !== "Number" && threadIDType !== "String") {
            throw new Error(
                "ThreadID should be of type number, string, or array and not " + threadIDType + "."
            );
        }
        if (replyToMessage && messageIDType !== "String") {
            throw new Error("MessageID should be of type string and not " + messageIDType + ".");
        }

        if (msgType === "String") {
            msg = { body: msg };
        }

        // NO HUMAN BEHAVIOR - Direct send for accurate timing
        // This is the key difference from sendMessage

        const disallowedProperties = Object.keys(msg).filter((prop) => !allowedProperties[prop]);
        if (disallowedProperties.length > 0) {
            throw new Error("Disallowed props: `" + disallowedProperties.join(", ") + "`");
        }

        const messageAndOTID = utils.generateOfflineThreadingID();
        const form = {
            client: "mercury",
            action_type: "ma-type:user-generated-message",
            author: "fbid:" + ctx.userID,
            timestamp: Date.now(),
            timestamp_absolute: "Today",
            timestamp_relative: utils.generateTimestampRelative(),
            timestamp_time_passed: "0",
            is_unread: false,
            is_cleared: false,
            is_forward: false,
            is_filtered_content: false,
            is_filtered_content_bh: false,
            is_filtered_content_account: false,
            is_filtered_content_quasar: false,
            is_filtered_content_invalid_app: false,
            is_spoof_warning: false,
            source: "source:chat:web",
            "source_tags[0]": "source:chat",
            body: msg.body ? msg.body.toString() : "",
            html_body: false,
            ui_push_phase: "V3",
            status: "0",
            offline_threading_id: messageAndOTID,
            message_id: messageAndOTID,
            threading_id: utils.generateThreadingID(ctx.clientID),
            "ephemeral_ttl_mode:": "0",
            manual_retry_cnt: "0",
            has_attachment: !!(msg.attachment || msg.url || msg.sticker),
            signatureID: utils.getSignatureID(),
        };

        // Handle mentions
        if (msg.mentions) {
            for (let i = 0; i < msg.mentions.length; i++) {
                const mention = msg.mentions[i];
                form["profile_xmd[" + i + "][id]"] = mention.id;
                form["profile_xmd[" + i + "][offset]"] = mention.offset || 0;
                form["profile_xmd[" + i + "][length]"] = mention.length || mention.tag?.length || 0;
                form["profile_xmd[" + i + "][type]"] = "p";
            }
        }

        // Handle reply
        if (replyToMessage) {
            form["replied_to_message_id"] = replyToMessage;
        }

        // Handle sticker
        if (msg.sticker) {
            form["sticker_id"] = msg.sticker;
        }

        // Handle emoji
        if (msg.emoji && msg.emojiSize) {
            form["body"] = msg.emoji;
            form["hot_emoji_size"] = msg.emojiSize;
        }

        // Handle location
        if (msg.location) {
            if (msg.location.latitude == null || msg.location.longitude == null) {
                throw new Error("location property needs both latitude and longitude");
            }
            form["location_attachment[coordinates][latitude]"] = msg.location.latitude;
            form["location_attachment[coordinates][longitude]"] = msg.location.longitude;
            form["location_attachment[is_current_location]"] = !!msg.location.current;
        }

        // Handle attachments
        if (msg.attachment) {
            const attachments = Array.isArray(msg.attachment) ? msg.attachment : [msg.attachment];
            const uploads = await uploadAttachment(attachments);

            uploads.forEach((upload, i) => {
                if (upload.image_id) {
                    form[`image_ids[${i}]`] = upload.image_id;
                } else if (upload.video_id) {
                    form[`video_ids[${i}]`] = upload.video_id;
                } else if (upload.file_id) {
                    form[`file_ids[${i}]`] = upload.file_id;
                } else if (upload.audio_id) {
                    form[`audio_ids[${i}]`] = upload.audio_id;
                }
            });
        }

        // Handle URL
        if (msg.url) {
            form["shareable_attachment[share_type]"] = "100";
            form["shareable_attachment[share_params][url]"] = msg.url;
        }

        // Send immediately - no delays
        return sendContent(form, threadID, isSingleUser, messageAndOTID);
    };
};
