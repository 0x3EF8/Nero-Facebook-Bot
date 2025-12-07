"use strict";

const utils = require("../../../lib/utils");

async function parseDelta(defaultFuncs, api, ctx, globalCallback, v) {
    if (v.delta.class == "NewMessage") {
        utils.logEvent("NewMessage", {
            threadID:
                v.delta.messageMetadata?.threadKey?.threadFbId ||
                v.delta.messageMetadata?.threadKey?.otherUserFbId,
        });

        if (ctx.globalOptions.pageID && ctx.globalOptions.pageID != v.queue) return;
        (async function resolveAttachmentUrl(i) {
            if (v.delta.attachments && i == v.delta.attachments.length) {
                let fmtMsg;
                try {
                    fmtMsg = utils.formatDeltaMessage(v);
                } catch (err) {
                    utils.error("DELTA", `Error parsing message: ${err.message || err}`);
                    utils.error(
                        "DELTA",
                        `Attachment data: ${JSON.stringify(v.delta.attachments, null, 2)}`
                    );
                    return globalCallback({
                        error: "Problem parsing message object. Please open an issue at .",
                        detail: err.message || String(err),
                        res: v,
                        type: "parse_error",
                    });
                }
                if (fmtMsg) {
                    utils.incrementStat("messagesReceived");
                    utils.logMessage(fmtMsg);
                    if (ctx.globalOptions.autoMarkDelivery)
                        api.markAsDelivered(fmtMsg.threadID, fmtMsg.messageID);

                    // Auto-store message for anti-unsend (always enabled)
                    utils.messageStore.store(fmtMsg);
                }

                if (!ctx.globalOptions.selfListen && fmtMsg.senderID === ctx.userID) {
                    return;
                } else {
                    return globalCallback(null, fmtMsg);
                }
            } else {
                if (v.delta.attachments && v.delta.attachments[i].mercury.attach_type == "photo") {
                    api.resolvePhotoUrl(v.delta.attachments[i].fbid, (err, url) => {
                        if (!err) v.delta.attachments[i].mercury.metadata.url = url;
                        return resolveAttachmentUrl(i + 1);
                    });
                } else return resolveAttachmentUrl(i + 1);

                return resolveAttachmentUrl(i + 1);
            }
        })(0);
    }

    if (v.delta.class == "ClientPayload") {
        const clientPayload = utils.decodeClientPayload(v.delta.payload);
        if (clientPayload && clientPayload.deltas) {
            for (const i in clientPayload.deltas) {
                var delta = clientPayload.deltas[i];
                // console.log(delta);
                if (delta.deltaMessageReaction && !!ctx.globalOptions.listenEvents) {
                    utils.logEvent("message_reaction", {
                        threadID:
                            delta.deltaMessageReaction.threadKey.threadFbId ||
                            delta.deltaMessageReaction.threadKey.otherUserFbId,
                        senderID: delta.deltaMessageReaction.senderId,
                    });
                    globalCallback(null, {
                        type: "message_reaction",
                        threadID: (
                            delta.deltaMessageReaction.threadKey.threadFbId ||
                            delta.deltaMessageReaction.threadKey.otherUserFbId
                        ).toString(),
                        messageID: delta.deltaMessageReaction.messageId,
                        reaction: delta.deltaMessageReaction.reaction,
                        senderID: delta.deltaMessageReaction.senderId.toString(),
                        userID: delta.deltaMessageReaction.userId.toString(),
                    });
                } else if (delta.deltaRecallMessageData && !!ctx.globalOptions.listenEvents) {
                    utils.logEvent("message_unsend", {
                        threadID:
                            delta.deltaRecallMessageData.threadKey.threadFbId ||
                            delta.deltaRecallMessageData.threadKey.otherUserFbId,
                        senderID: delta.deltaRecallMessageData.senderID,
                    });
                    globalCallback(null, {
                        type: "message_unsend",
                        threadID: (
                            delta.deltaRecallMessageData.threadKey.threadFbId ||
                            delta.deltaRecallMessageData.threadKey.otherUserFbId
                        ).toString(),
                        messageID: delta.deltaRecallMessageData.messageID,
                        senderID: delta.deltaRecallMessageData.senderID.toString(),
                        deletionTimestamp: delta.deltaRecallMessageData.deletionTimestamp,
                        timestamp: delta.deltaRecallMessageData.timestamp,
                    });
                } else if (delta.deltaMessageReply) {
                    const mdata = delta.deltaMessageReply.message?.data?.prng
                        ? JSON.parse(delta.deltaMessageReply.message.data.prng)
                        : [];
                    var mentions = {};
                    if (mdata) {
                        mdata.forEach(
                            (m) =>
                                (mentions[m.i] = (
                                    delta.deltaMessageReply.message.body || ""
                                ).substring(m.o, m.o + m.l))
                        );
                    }

                    const callbackToReturn = {
                        type: "message_reply",
                        threadID: (
                            delta.deltaMessageReply.message.messageMetadata.threadKey.threadFbId ||
                            delta.deltaMessageReply.message.messageMetadata.threadKey.otherUserFbId
                        ).toString(),
                        messageID: delta.deltaMessageReply.message.messageMetadata.messageId,
                        senderID:
                            delta.deltaMessageReply.message.messageMetadata.actorFbId.toString(),
                        attachments: delta.deltaMessageReply.message.attachments.map((att) => {
                            try {
                                const mercury = JSON.parse(att.mercuryJSON);
                                Object.assign(att, mercury);
                                return utils._formatAttachment(att);
                            } catch (ex) {
                                return { ...att, error: ex, type: "unknown" };
                            }
                        }),
                        body: delta.deltaMessageReply.message.body || "",
                        isGroup:
                            !!delta.deltaMessageReply.message.messageMetadata.threadKey.threadFbId,
                        mentions: mentions,
                        timestamp: delta.deltaMessageReply.message.messageMetadata.timestamp,
                        participantIDs: (delta.deltaMessageReply.message.participants || []).map(
                            (e) => e.toString()
                        ),
                    };

                    if (delta.deltaMessageReply.repliedToMessage) {
                        var rmentions = {};
                        const rmdata = delta.deltaMessageReply.repliedToMessage?.data?.prng
                            ? JSON.parse(delta.deltaMessageReply.repliedToMessage.data.prng)
                            : [];
                        if (rmdata) {
                            rmdata.forEach(
                                (m) =>
                                    (rmentions[m.i] = (
                                        delta.deltaMessageReply.repliedToMessage.body || ""
                                    ).substring(m.o, m.o + m.l))
                            );
                        }

                        callbackToReturn.messageReply = {
                            threadID: (
                                delta.deltaMessageReply.repliedToMessage.messageMetadata.threadKey
                                    .threadFbId ||
                                delta.deltaMessageReply.repliedToMessage.messageMetadata.threadKey
                                    .otherUserFbId
                            ).toString(),
                            messageID:
                                delta.deltaMessageReply.repliedToMessage.messageMetadata.messageId,
                            senderID:
                                delta.deltaMessageReply.repliedToMessage.messageMetadata.actorFbId.toString(),
                            attachments: delta.deltaMessageReply.repliedToMessage.attachments.map(
                                (att) => {
                                    try {
                                        const mercury = JSON.parse(att.mercuryJSON);
                                        Object.assign(att, mercury);
                                        return utils._formatAttachment(att);
                                    } catch (ex) {
                                        return { ...att, error: ex, type: "unknown" };
                                    }
                                }
                            ),
                            body: delta.deltaMessageReply.repliedToMessage.body || "",
                            isGroup:
                                !!delta.deltaMessageReply.repliedToMessage.messageMetadata.threadKey
                                    .threadFbId,
                            mentions: rmentions,
                            timestamp:
                                delta.deltaMessageReply.repliedToMessage.messageMetadata.timestamp,
                            participantIDs: (
                                delta.deltaMessageReply.repliedToMessage.participants || []
                            ).map((e) => e.toString()),
                        };
                    }
                    if (ctx.globalOptions.autoMarkDelivery)
                        api.markAsDelivered(callbackToReturn.threadID, callbackToReturn.messageID);

                    // Auto-store reply message for anti-unsend (always enabled)
                    utils.messageStore.store(callbackToReturn);

                    if (!ctx.globalOptions.selfListen && callbackToReturn.senderID === ctx.userID)
                        return;
                    return globalCallback(null, callbackToReturn);
                }
            }
            return;
        }
    }

    if (v.delta.class !== "NewMessage" && !ctx.globalOptions.listenEvents) return;
    switch (v.delta.class) {
        case "ReadReceipt":
            var fmtMsg;
            try {
                fmtMsg = utils.formatDeltaReadReceipt(v.delta);
            } catch (err) {
                return globalCallback({
                    error: "Problem parsing read receipt",
                    detail: err,
                    res: v.delta,
                    type: "parse_error",
                });
            }
            return globalCallback(null, fmtMsg);
        case "AdminTextMessage":
        case "ThreadName":
        case "ParticipantsAddedToGroupThread":
        case "ParticipantLeftGroupThread":
            var fmtEvent;
            try {
                fmtEvent = utils.formatDeltaEvent(v.delta);
            } catch (err) {
                return globalCallback({
                    error: "Problem parsing event",
                    detail: err,
                    res: v.delta,
                    type: "parse_error",
                });
            }
            return globalCallback(null, fmtEvent);
    }
}

module.exports = {
    parseDelta,
};
