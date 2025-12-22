"use strict";

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
    async function uploadAttachment(attachments) {
        const uploads = [];
        for (let i = 0; i < attachments.length; i++) {
            try {
                const attachment = attachments[i];
                utils.log(
                    "uploadAttachment",
                    `Processing attachment ${i + 1}/${attachments.length}, type: ${utils.getType(attachment)}`
                );

                if (!utils.isReadableStream(attachment)) {
                    utils.warn(
                        "uploadAttachment",
                        `Attachment is not a readable stream, it's: ${utils.getType(attachment)}`
                    );
                    throw new Error(
                        "Attachment should be a readable stream and not " +
                            utils.getType(attachment) +
                            "."
                    );
                }

                utils.log("uploadAttachment", `Starting upload to Facebook...`);
                const oksir = await defaultFuncs
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

                utils.log(
                    "uploadAttachment",
                    `Raw response received: ${JSON.stringify(oksir).substring(0, 500)}`
                );

                if (oksir.error) {
                    utils.warn("uploadAttachment", `Upload error: ${JSON.stringify(oksir)}`);
                    throw new Error(JSON.stringify(oksir));
                }

                // Validate metadata exists before pushing
                if (oksir.payload && oksir.payload.metadata && oksir.payload.metadata[0]) {
                    utils.log(
                        "uploadAttachment",
                        `Success! Metadata: ${JSON.stringify(oksir.payload.metadata[0])}`
                    );
                    uploads.push(oksir.payload.metadata[0]);
                } else {
                    utils.warn(
                        "uploadAttachment",
                        "Upload response missing metadata: " + JSON.stringify(oksir)
                    );
                }
            } catch (uploadErr) {
                utils.warn(
                    "uploadAttachment",
                    `Exception uploading attachment ${i + 1}: ${uploadErr.message}`
                );
            }
        }
        return uploads;
    }

    async function getUrl(url) {
        const resData = await defaultFuncs
            .post("https://www.facebook.com/message_share_attachment/fromURI/", ctx.jar, {
                image_height: 960,
                image_width: 960,
                uri: url,
            })
            .then(utils.parseAndCheckLogin(ctx, defaultFuncs));
        if (!resData || resData.error || !resData.payload) {
            throw new Error(resData);
        }
    }

    async function sendContent(form, threadID, isSingleUser, messageAndOTID, callback) {
        // There are three cases here:
        // 1. threadID is of type array, where we're starting a new group chat with users
        //    specified in the array.
        // 2. User is sending a message to a specific user.
        // 3. No additional form params and the message goes to an existing group chat.
        if (utils.getType(threadID) === "Array") {
            for (let i = 0; i < threadID.length; i++) {
                form["specific_to_list[" + i + "]"] = "fbid:" + threadID[i];
            }
            form["specific_to_list[" + threadID.length + "]"] = "fbid:" + ctx.userID;
            form["client_thread_id"] = "root:" + messageAndOTID;
            utils.log("sendMessage", "Sending message to multiple users: " + threadID);
        } else {
            // This means that threadID is the id of a user, and the chat
            // is a single person chat
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
                    "sendMessage",
                    "Got error 1545012. This might mean that you're not part of the conversation " +
                        threadID
                );
            }
            const errMsg = `Error ${resData.error}: ${resData.errorSummary || resData.errorDescription || JSON.stringify(resData)}`;
            throw new Error(errMsg);
        }
        const messageInfo = resData.payload.actions.reduce((p, v) => {
            return (
                { threadID: v.thread_fbid, messageID: v.message_id, timestamp: v.timestamp } || p
            );
        }, null);
        return messageInfo;
    }

    return async (msg, threadID, replyToMessage, isSingleUser = false) => {
        utils.incrementStat("apiCalls");
        utils.logApiCall("sendMessage", {
            threadID,
            hasBody: !!msg.body || typeof msg === "string",
            hasAttachment: !!msg.attachment,
            hasReply: !!replyToMessage,
        });

        // Convert replyToMessage to primitive string if it's a String object
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
        if (msgType !== "String" && msgType !== "Object")
            throw new Error("Message should be of type string or object and not " + msgType + ".");
        if (threadIDType !== "Array" && threadIDType !== "Number" && threadIDType !== "String")
            throw new Error(
                "ThreadID should be of type number, string, or array and not " + threadIDType + "."
            );
        if (replyToMessage && messageIDType !== "String")
            throw new Error("MessageID should be of type string and not " + messageIDType + ".");
        if (msgType === "String") {
            msg = { body: msg };
        }

        // Human behavior: simulate typing before sending
        if (ctx.globalOptions.humanBehavior && utils.humanBehavior) {
            await utils.humanBehavior.beforeSendMessage(ctx, api, threadID, msg.body || "");
        }

        const disallowedProperties = Object.keys(msg).filter((prop) => !allowedProperties[prop]);
        if (disallowedProperties.length > 0) {
            throw new Error("Dissallowed props: `" + disallowedProperties.join(", ") + "`");
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
            ...(msg.body && {
                body: msg.body,
            }),
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
            ...(replyToMessage && {
                replied_to_message_id: replyToMessage,
            }),
        };

        if (msg.location) {
            if (!msg.location.latitude || !msg.location.longitude)
                throw new Error("location property needs both latitude and longitude");
            form["location_attachment[coordinates][latitude]"] = msg.location.latitude;
            form["location_attachment[coordinates][longitude]"] = msg.location.longitude;
            form["location_attachment[is_current_location]"] = !!msg.location.current;
        }
        if (msg.sticker) {
            form["sticker_id"] = msg.sticker;
        }
        if (msg.attachment) {
            form.image_ids = [];
            form.gif_ids = [];
            form.file_ids = [];
            form.video_ids = [];
            form.audio_ids = [];
            if (utils.getType(msg.attachment) !== "Array") {
                msg.attachment = [msg.attachment];
            }
            utils.log("sendMessage", `Uploading ${msg.attachment.length} attachment(s)...`);
            const files = await uploadAttachment(msg.attachment);
            utils.log(
                "sendMessage",
                `Upload returned ${files.length} file metadata: ${JSON.stringify(files)}`
            );
            files.forEach((file) => {
                if (file && typeof file === "object") {
                    const type = Object.keys(file)[0];
                    utils.log(
                        "sendMessage",
                        `Processing file type: ${type}, value: ${JSON.stringify(file[type])}`
                    );
                    if (type && form["" + type + "s"]) {
                        form["" + type + "s"].push(file[type]);
                        utils.log("sendMessage", `Added to form.${type}s`);
                    } else {
                        utils.warn("sendMessage", `Unknown type '${type}' or missing form array`);
                    }
                } else {
                    utils.warn("sendMessage", `Invalid file object: ${JSON.stringify(file)}`);
                }
            });
            utils.log(
                "sendMessage",
                `Final form arrays - image_ids: ${form.image_ids.length}, audio_ids: ${form.audio_ids.length}, video_ids: ${form.video_ids.length}, file_ids: ${form.file_ids.length}`
            );

            // Check if uploads failed silently (empty arrays despite attachments provided)
            const totalUploaded = form.image_ids.length + form.audio_ids.length + form.video_ids.length + form.file_ids.length;
            if (msg.attachment.length > 0 && totalUploaded === 0) {
                const err = new Error("Upload failed: missing metadata (Facebook rejected file)");
                utils.warn("sendMessage", err.message);
                throw err;
            }
        }
        if (msg.url) {
            form["shareable_attachment[share_type]"] = "100";
            const params = await getUrl(msg.url);
            form["shareable_attachment[share_params]"] = params;
        }
        if (msg.emoji) {
            if (!msg.emojiSize) {
                msg.emojiSize = "medium";
            }
            if (
                msg.emojiSize !== "small" &&
                msg.emojiSize !== "medium" &&
                msg.emojiSize !== "large"
            ) {
                throw new Error("emojiSize property is invalid");
            }
            if (!form.body) {
                throw new Error("body is not empty");
            }
            form.body = msg.emoji;
            form["tags[0]"] = "hot_emoji_size:" + msg.emojiSize;
        }
        if (msg.mentions) {
            for (let i = 0; i < msg.mentions.length; i++) {
                const mention = msg.mentions[i];
                const tag = mention.tag;
                if (typeof tag !== "string") {
                    throw new Error("Mention tags must be strings.");
                }
                const offset = msg.body.indexOf(tag, mention.fromIndex || 0);
                if (offset < 0)
                    utils.warn(
                        "handleMention",
                        'Mention for "' + tag + '" not found in message string.'
                    );
                if (!mention.id) utils.warn("handleMention", "Mention id should be non-null.");
                const id = mention.id || 0;
                const emptyChar = "\u200E";
                form["body"] = emptyChar + msg.body;
                form["profile_xmd[" + i + "][offset]"] = offset + 1;
                form["profile_xmd[" + i + "][length]"] = tag.length;
                form["profile_xmd[" + i + "][id]"] = id;
                form["profile_xmd[" + i + "][type]"] = "p";
            }
        }
        const result = await sendContent(form, threadID, isSingleUser, messageAndOTID);
        utils.incrementStat("messagesSent");
        utils.logApiResponse("sendMessage", true);
        return result;
    };
};
