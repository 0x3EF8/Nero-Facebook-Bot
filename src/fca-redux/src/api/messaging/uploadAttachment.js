"use strict";

const utils = require("../../lib/utils");

module.exports = (defaultFuncs, api, ctx) => {
    return async function uploadAttachment(attachments) {
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
    };
};
