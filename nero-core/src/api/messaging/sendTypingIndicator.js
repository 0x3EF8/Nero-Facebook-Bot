"use strict";

/**
 * @param {Object} defaultFuncs
 * @param {Object} _api
 * @param {Object} ctx
 */
module.exports = function (defaultFuncs, _api, ctx) {
	/**
	 * Sends a typing indicator to a specific thread.
	 * @param {boolean} sendTyping - True to show typing indicator, false to hide.
	 * @param {string} threadID - The ID of the thread to send the typing indicator to.
	 * @param {Function} [callback] - An optional callback function.
	 * @returns {Promise<void>}
	 */
	return function sendTypingIndicator(sendTyping, threadID, callback) {
		let resolveFunc = function () {};
		let rejectFunc = function () {};

		const returnPromise = new Promise(function (resolve, reject) {
			resolveFunc = resolve;
			rejectFunc = reject;
		});

		if (!callback) {
			callback = function (err, data) {
				if (err) return rejectFunc(err);
				resolveFunc(data);
			};
		}

		// Use MQTT to publish typing state directly
		if (ctx.mqttClient) {
			const isGroup = threadID.toString().length > 15;
			
			// Typing indicator payload for MQTT
			const typingPayload = {
				state: sendTyping ? 1 : 0,
				sender_fbid: ctx.userID,
				thread: threadID.toString(),
				type: isGroup ? 1 : 0
			};

			// Publish to the typing topic
			ctx.mqttClient.publish(
				"/typing",
				JSON.stringify(typingPayload),
				{ qos: 0, retain: false },
				() => {
					callback(null);
				}
			);
		} else {
			// Fallback to HTTP GraphQL endpoint
			const form = {
				fb_api_req_friendly_name: "MessengerTypingMutation",
				variables: JSON.stringify({
					input: {
						thread_id: threadID.toString(),
						is_typing: sendTyping,
						attribution: 0,
						actor_id: ctx.userID,
						client_mutation_id: Math.floor(Math.random() * 1000000).toString()
					}
				}),
				doc_id: "5765875586815225"
			};

			defaultFuncs
				.post("https://www.facebook.com/api/graphql/", ctx.jar, form)
				.then(function () {
					callback(null);
				})
				.catch(function () {
					callback(null);
				});
		}

		return returnPromise;
	};
};
