"use strict";

const utils = require("../../lib/utils");

module.exports = function (defaultFuncs, api, ctx) {
    /**
     * Changes the admin status of a user in a group chat.
     *
     * @param {string} threadID - The ID of the group chat.
     * @param {string|string[]} userID - The user ID or array of user IDs to change admin status.
     * @param {boolean} adminStatus - true = make admin, false = remove admin.
     * @param {Function} [callback] - Optional callback function.
     * @returns {Promise<object>} A promise that resolves with information about the action.
     *
     * @example
     * // Make a user admin
     * api.changeAdminStatus("threadID", "userID", true);
     *
     * // Remove admin from a user
     * api.changeAdminStatus("threadID", "userID", false);
     *
     * // Make multiple users admin
     * api.changeAdminStatus("threadID", ["user1", "user2"], true);
     */
    return async function changeAdminStatus(threadID, userID, adminStatus, callback) {
        let _callback;
        if (typeof callback === "function") {
            _callback = callback;
        }

        let resolvePromise, rejectPromise;
        const returnPromise = new Promise((resolve, reject) => {
            resolvePromise = resolve;
            rejectPromise = reject;
        });

        if (typeof _callback !== "function") {
            _callback = (err, data) => {
                if (err) return rejectPromise(err);
                resolvePromise(data);
            };
        }

        try {
            // Validation
            if (!threadID || typeof threadID !== "string") {
                return _callback(null, {
                    type: "error_admin",
                    error: "threadID must be a string.",
                });
            }
            if (!userID) {
                return _callback(null, { type: "error_admin", error: "userID is required." });
            }
            if (typeof adminStatus !== "boolean") {
                return _callback(null, {
                    type: "error_admin",
                    error: "adminStatus must be true or false.",
                });
            }
            if (!ctx.mqttClient) {
                return _callback(null, { type: "error_admin", error: "Not connected to MQTT." });
            }

            // Get thread info to verify it's a group
            const threadInfo = await api.getThreadInfo(threadID);
            if (!threadInfo) {
                return _callback(null, {
                    type: "error_admin",
                    error: "Could not retrieve thread information.",
                });
            }
            if (threadInfo.isGroup === false) {
                return _callback(null, {
                    type: "error_admin",
                    error: "This feature is only for group chats.",
                });
            }

            // Check if users are in the group
            const currentMembers = threadInfo.participantIDs || [];
            const usersToModify = Array.isArray(userID) ? userID : [userID];

            const invalidUsers = usersToModify.filter(
                (id) => !currentMembers.includes(id.toString())
            );
            if (invalidUsers.length > 0) {
                return _callback(null, {
                    type: "error_admin",
                    error: `User(s) ${invalidUsers.join(", ")} are not in this group chat.`,
                });
            }

            // Build tasks for each user
            const tasks = [];
            const isAdmin = adminStatus ? 1 : 0;

            ctx.wsReqNumber = (ctx.wsReqNumber || 0) + 1;
            ctx.wsTaskNumber = ctx.wsTaskNumber || 0;

            usersToModify.forEach((id) => {
                ctx.wsTaskNumber++;
                tasks.push({
                    failure_count: null,
                    label: "25",
                    payload: JSON.stringify({
                        thread_key: threadID,
                        contact_id: id.toString(),
                        is_admin: isAdmin,
                    }),
                    queue_name: "admin_status",
                    task_id: ctx.wsTaskNumber,
                });
            });

            const epochId = parseInt(utils.generateOfflineThreadingID());

            const content = {
                app_id: "2220391788200892",
                payload: JSON.stringify({
                    epoch_id: epochId,
                    tasks: tasks,
                    version_id: "8798795233522156",
                }),
                request_id: ctx.wsReqNumber,
                type: 3,
            };

            ctx.mqttClient.publish(
                "/ls_req",
                JSON.stringify(content),
                { qos: 0, retain: false },
                (err) => {
                    if (err) {
                        return _callback(err);
                    }

                    const adminInfo = {
                        type: "admin_status_change",
                        threadID: threadID,
                        userIDs: usersToModify,
                        adminStatus: adminStatus,
                        action: adminStatus ? "promoted" : "demoted",
                        senderID: ctx.userID,
                        timestamp: Date.now(),
                    };

                    utils.log(
                        "changeAdminStatus",
                        `${adminStatus ? "Promoted" : "Demoted"} ${usersToModify.length} user(s) in thread ${threadID}`
                    );
                    return _callback(null, adminInfo);
                }
            );
        } catch (err) {
            return _callback(null, {
                type: "error_admin",
                error: err.message || "An unknown error occurred.",
            });
        }

        return returnPromise;
    };
};
