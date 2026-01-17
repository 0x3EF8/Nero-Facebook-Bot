"use strict";
const utils = require("../../lib/utils");
const mqtt = require("mqtt");
const websocket = require("websocket-stream");
const HttpsProxyAgent = require("https-proxy-agent");
const EventEmitter = require("events");
const { parseDelta } = require("./deltas/value");

// NOTE: form and getSeqID moved inside module.exports closure to prevent sharing between accounts
const topics = [
    "/legacy_web",
    "/webrtc",
    "/rtc_multi",
    "/onevc",
    "/br_sr",
    "/sr_res",
    "/t_ms",
    "/thread_typing",
    "/orca_typing_notifications",
    "/notify_disconnect",
    "/orca_presence",
    "/inbox",
    "/mercury",
    "/messaging_events",
    "/orca_message_notifications",
    "/pp",
    "/webrtc_response",
];

function generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0,
            v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

function getRandomReconnectTime() {
    const min = 26 * 60 * 1000;
    const max = 60 * 60 * 1000;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * @param {Object} ctx
 * @param {Object} api
 * @param {string} threadID
 */
function markAsRead(ctx, api, threadID) {
    if (ctx.globalOptions.autoMarkRead && threadID) {
        // If human behavior is enabled, delay is handled in markAsRead function itself
        api.markAsRead(threadID, (err) => {
            if (err) utils.error("autoMarkRead", err);
        });
    }
}

/**
 * @param {Object} defaultFuncs
 * @param {Object} api
 * @param {Object} ctx
 * @param {Function} globalCallback
 * @param {Function} reconnectFn - Function to call for reconnection
 */
async function listenMqtt(defaultFuncs, api, ctx, globalCallback, reconnectFn) {
    // Capture userID immediately at function entry to prevent race conditions
    const thisAccountUID = ctx.userID;

    const chatOn = ctx.globalOptions.online;
    const region = ctx.region;
    const foreground = false;
    const sessionID = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) + 1;
    const cid = ctx.clientID;
    const username = {
        u: ctx.userID,
        s: sessionID,
        chat_on: chatOn,
        fg: foreground,
        d: cid,
        ct: "websocket",
        aid: ctx.mqttAppID,
        mqtt_sid: "",
        cp: 3,
        ecp: 10,
        st: [],
        pm: [],
        dc: "",
        no_auto_fg: true,
        gas: null,
        pack: [],
        a: ctx.globalOptions.userAgent,
    };
    const cookies = ctx.jar.getCookiesSync("https://www.facebook.com").join("; ");
    let host;
    const domain = "wss://edge-chat.messenger.com/chat";
    if (region) {
        host = `${domain}?region=${region.toLowerCase()}&sid=${sessionID}&cid=${cid}`;
    } else {
        host = `${domain}?sid=${sessionID}&cid=${cid}`;
    }

    // Shorten URL for display (show domain + first 5 chars of params)
    const shortHost =
        host.length > 80 ? `${domain}?${host.split("?")[1].substring(0, 5)}...` : host;

    utils.log("ESTABLISHING MQTT REALTIME PROTOCOL...", shortHost);

    const options = {
        clientId: "mqttwsclient",
        protocolId: "MQIsdp",
        protocolVersion: 3,
        username: JSON.stringify(username),
        clean: true,
        wsOptions: {
            headers: {
                Cookie: cookies,
                Origin: "https://www.messenger.com",
                "User-Agent": username.a,
                Referer: "https://www.messenger.com/",
                Host: new URL(host).hostname,
            },
            origin: "https://www.messenger.com",
            protocolVersion: 13,
            binaryType: "arraybuffer",
        },
        keepalive: 10 + Math.floor(Math.random() * 5), // ✅ Add jitter: 10-15s (more human-like)
        reschedulePings: true,
        connectTimeout: 60000,
        reconnectPeriod: 5000, // ✅ Changed from 1s to 5s (less aggressive)
    };

    if (ctx.globalOptions.proxy) {
        options.wsOptions.agent = new HttpsProxyAgent(ctx.globalOptions.proxy);
    }
    const mqttClient = new mqtt.Client((_) => websocket(host, options.wsOptions), options);
    mqttClient.publishSync = mqttClient.publish.bind(mqttClient);
    mqttClient.publish = (topic, message, opts = {}, callback = () => {}) =>
        new Promise((resolve, reject) => {
            mqttClient.publishSync(topic, message, opts, (err, data) => {
                if (err) {
                    callback(err);
                    reject(err);
                }
                callback(null, data);
                resolve(data);
            });
        });
    ctx.mqttClient = mqttClient;

    // Track if we're intentionally publishing to avoid reconnect on publish responses
    let isPublishing = false;
    const originalPublish = mqttClient.publish;
    mqttClient.publish = function (...args) {
        isPublishing = true;
        const result = originalPublish.apply(this, args);
        // Reset after a short delay to allow for response
        setTimeout(() => {
            isPublishing = false;
        }, 1000);
        return result;
    };

    mqttClient.on("error", (err) => {
        const errMsg = err?.message || String(err);

        // Ignore certain non-fatal errors that don't require reconnection
        if (isPublishing && /timeout|ETIMEDOUT/i.test(errMsg)) {
            utils.warn("listenMqtt", `Non-fatal publish error (ignoring): ${errMsg}`);
            return;
        }

        // Ignore invalid header flag bits error (PUBACK packet issue) - non-fatal
        if (/Invalid header flag bits|puback/i.test(errMsg)) {
            return;
        }

        // Only log and reconnect for serious errors
        utils.error("listenMqtt", err);
        utils.logMqttEvent("error", { message: errMsg });
        mqttClient.end();
        if (ctx.globalOptions.autoReconnect && reconnectFn) reconnectFn();
        else globalCallback({ type: "stop_listen", error: "Connection refused" });
    });

    mqttClient.on("connect", async () => {
        utils.logMqttEvent("connect", { message: "Connection established" });
        topics.forEach((topic) => {
            mqttClient.subscribe(topic);
            utils.logMqttSubscribe(topic);
        });
        const queue = {
            sync_api_version: 10,
            max_deltas_able_to_process: 1000,
            delta_batch_size: 500,
            encoding: "JSON",
            entity_fbid: ctx.userID,
        };
        let topic;
        if (ctx.syncToken) {
            topic = "/messenger_sync_get_diffs";
            queue.last_seq_id = ctx.lastSeqId;
            queue.sync_token = ctx.syncToken;
        } else {
            topic = "/messenger_sync_create_queue";
            queue.initial_titan_sequence_id = ctx.lastSeqId;
            queue.device_params = null;
        }
        utils.success(`MQTT REALTIME PROTOCOL ESTABLISHED`, true); // true = continuation (├─)

        // Fetch bot name and display authentication complete message as final tree item
        (async () => {
            let botName = "Unknown";
            try {
                if (api.getUserInfo) {
                    const userInfo = await api.getUserInfo(thisAccountUID);
                    if (userInfo && userInfo.name) {
                        botName = userInfo.name;
                    }
                }
            } catch (_e) {
                // Ignore errors, use default name
            }
            utils.info(`AUTHENTICATION COMPLETE → ${botName} [UID: ${thisAccountUID}]`, false); // false = final (└─)
        })();

        // Use QoS 0 to avoid PUBACK header issues with Facebook's MQTT server
        mqttClient.publish(topic, JSON.stringify(queue), { qos: 0, retain: false }, (err) => {
            if (err) {
                utils.error("listenMqtt: Failed to publish sync queue", err);
            }
        });
    });

    let _presenceInterval;
    if (ctx.globalOptions.updatePresence) {
        // Function to schedule next presence update with randomized interval
        const scheduleNextPresence = () => {
            // Random interval 45-75 seconds
            const randomInterval = Math.floor(Math.random() * 30000) + 45000;

            _presenceInterval = setTimeout(() => {
                if (mqttClient.connected) {
                    const presencePayload = utils.generatePresence(ctx.userID);
                    mqttClient.publish(
                        "/orca_presence",
                        JSON.stringify({ p: presencePayload }),
                        (err) => {
                            if (err) {
                                utils.error("Failed to send presence update:", err);
                            }
                        }
                    );
                }
                // Schedule next update with new random interval
                scheduleNextPresence();
            }, randomInterval);
        };

        // Start the randomized presence update cycle
        scheduleNextPresence();
    }

    mqttClient.on("message", async (topic, message, _packet) => {
        try {
            utils.incrementStat("mqttMessages");
            const jsonMessage = JSON.parse(message.toString());
            utils.logMqttMessage(topic, jsonMessage.deltas ? "deltas" : null);
            //const packet = JSON.parse(_packet.payload.toString());
            if (topic === "/t_ms") {
                if (jsonMessage.lastIssuedSeqId) {
                    ctx.lastSeqId = parseInt(jsonMessage.lastIssuedSeqId);
                }
                if (jsonMessage.deltas) {
                    for (const delta of jsonMessage.deltas) {
                        utils.logDelta(delta.class || "unknown", delta);
                        parseDelta(defaultFuncs, api, ctx, globalCallback, { delta });
                    }
                }
            } else if (topic === "/thread_typing" || topic === "/orca_typing_notifications") {
                const typ = {
                    type: "typ",
                    isTyping: !!jsonMessage.state,
                    from: jsonMessage.sender_fbid.toString(),
                    threadID: utils.formatID(
                        (jsonMessage.thread || jsonMessage.sender_fbid).toString()
                    ),
                };
                utils.logEvent("typing", typ);
                globalCallback(null, typ);
            }
        } catch (ex) {
            utils.error("listenMqtt: onMessage", ex);
        }
    });
}

module.exports = (defaultFuncs, api, ctx) => {
    let globalCallback = () => {};
    let reconnectInterval;
    let form = {}; // Instance-specific form data
    const getSeqID = async () => {
        // Instance-specific function
        try {
            form = {
                queries: JSON.stringify({
                    o0: {
                        doc_id: "3336396659757871",
                        query_params: {
                            limit: 1,
                            before: null,
                            tags: ["INBOX"],
                            includeDeliveryReceipts: false,
                            includeSeqID: true,
                        },
                    },
                }),
            };
            const resData = await defaultFuncs
                .post("https://www.facebook.com/api/graphqlbatch/", ctx.jar, form)
                .then(utils.parseAndCheckLogin(ctx, defaultFuncs));
            if (
                utils.getType(resData) !== "Array" ||
                (resData.error && resData.error !== 1357001)
            ) {
                throw resData;
            }
            ctx.lastSeqId = resData[0].o0.data.viewer.message_threads.sync_sequence_id;
            listenMqtt(defaultFuncs, api, ctx, globalCallback, getSeqID);
        } catch (err) {
            // Log actual error for debugging
            utils.error("MQTT", `getSeqID error for UID ${ctx.userID}: ${err?.message || err}`);
            const descriptiveError = new Error(
                "Failed to get sequence ID. This is often caused by an invalid appstate. Please try generating a new appstate.json file."
            );
            descriptiveError.originalError = err;
            return globalCallback(descriptiveError);
        }
    };

    return async (callback) => {
        class MessageEmitter extends EventEmitter {
            stop() {
                globalCallback = () => {};
                if (reconnectInterval) {
                    clearTimeout(reconnectInterval);
                    reconnectInterval = null;
                }
                if (ctx.mqttClient) {
                    ctx.mqttClient.end();
                    ctx.mqttClient = undefined;
                }
                this.emit("stop");
            }
        }

        const msgEmitter = new MessageEmitter();

        globalCallback = (error, message) => {
            if (error) return msgEmitter.emit("error", error);
            if (message.type === "message" || message.type === "message_reply") {
                markAsRead(ctx, api, message.threadID);
            }
            msgEmitter.emit("message", message);
        };

        if (typeof callback === "function") globalCallback = callback;

        if (!ctx.firstListen || !ctx.lastSeqId) await getSeqID();
        else listenMqtt(defaultFuncs, api, ctx, globalCallback, getSeqID);

        if (ctx.firstListen) {
            try {
                await api.markAsReadAll();
            } catch (err) {
                utils.error("Failed to mark all messages as read on startup:", err);
            }
        }

        ctx.firstListen = false;

        async function scheduleReconnect() {
            const time = getRandomReconnectTime();
            utils.log(`AUTO-RECONNECT SCHEDULED IN ${Math.floor(time / 60000)} MINUTES...`);
            reconnectInterval = setTimeout(() => {
                utils.log(`Reconnecting MQTT with new clientID...`);
                if (ctx.mqttClient) ctx.mqttClient.end(true);
                ctx.clientID = generateUUID();
                listenMqtt(defaultFuncs, api, ctx, globalCallback, getSeqID);
                scheduleReconnect();
            }, time);
        }

        scheduleReconnect();

        return msgEmitter;
    };
};
