"use strict";

const axios = require("axios");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");
const FormData = require("form-data");
const { getHeaders } = require("./headers");
const { getType } = require("./constants");
const debug = require("./debug");

// Store proxy configuration globally within this module
let proxyConfig = {};

/**
 * Creates an axios client with the specified cookie jar
 * @param {CookieJar} jar - The cookie jar to use
 * @returns {object} Wrapped axios instance
 */
function createClientWithJar(jar) {
    return wrapper(axios.create({ jar }));
}

/**
 * A utility to introduce a delay, used for retries.
 * @param {number} ms - The delay in milliseconds.
 * @returns {Promise<void>}
 */
const delay = (ms) =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

/**
 * Adapts the axios response/error to match the structure expected by the rest of the application.
 * @param {object} res - The axios response or error object.
 * @returns {object} An object that mimics the old 'request' library's response.
 */
function adaptResponse(res) {
    // If it's an error, axios nests the response object.
    const response = res.response || res;
    return {
        ...response,
        body: response.data,
        statusCode: response.status,
        request: {
            uri: new URL(response.config.url),
            headers: response.config.headers,
            method: response.config.method.toUpperCase(),
            form: response.config.data, // Approximation for compatibility
            formData: response.config.data, // Approximation for compatibility
        },
    };
}

/**
 * Performs a request with retry logic and exponential backoff.
 * @param {Function} requestFunction - A function that returns an axios promise.
 * @param {number} [retries=3] - The number of retries.
 * @param {string} [method='GET'] - HTTP method for logging.
 * @param {string} [url=''] - URL for logging.
 * @returns {Promise<object>}
 */
async function requestWithRetry(requestFunction, retries = 3, method = "GET", url = "") {
    const startTime = Date.now();
    debug.incrementStat("httpRequests");

    for (let i = 0; i < retries; i++) {
        try {
            const res = await requestFunction();
            const duration = Date.now() - startTime;
            debug.logHttpResponse(method, url, res.status, duration);
            // A successful request, even with a non-2xx status code that we allow.
            return adaptResponse(res);
        } catch (error) {
            if (i === retries - 1) {
                debug.incrementStat("httpErrors");
                debug.logHttpError(method, url, error);
                debug.error("HTTP", `Request failed after ${retries} attempts: ${error.message}`);
                // If the error has a response object, adapt it. Otherwise, re-throw.
                if (error.response) {
                    return adaptResponse(error.response);
                }
                throw error;
            }
            // Exponential backoff with jitter (anti-detection): 1s, 2s, 4s + random 0-500ms
            const backoffTime = Math.pow(2, i) * 1000;
            const jitter = Math.floor(Math.random() * 500); // Add random 0-500ms
            const totalDelay = backoffTime + jitter;
            debug.warn("HTTP", `Attempt ${i + 1} failed, retrying in ${totalDelay}ms...`);
            await delay(totalDelay);
        }
    }
}

/**
 * Sets a proxy for all subsequent requests.
 * @param {string} proxyUrl - The proxy URL (e.g., "http://user:pass@host:port").
 */
function setProxy(proxyUrl) {
    if (proxyUrl) {
        try {
            const parsedProxy = new URL(proxyUrl);
            proxyConfig = {
                proxy: {
                    host: parsedProxy.hostname,
                    port: parsedProxy.port,
                    protocol: parsedProxy.protocol.replace(":", ""),
                    auth:
                        parsedProxy.username && parsedProxy.password
                            ? {
                                  username: parsedProxy.username,
                                  password: parsedProxy.password,
                              }
                            : undefined,
                },
            };
        } catch (_e) {
            debug.error(
                "PROXY",
                "Invalid proxy URL. Please use a full URL format (e.g., http://user:pass@host:port)."
            );
            proxyConfig = {};
        }
    } else {
        proxyConfig = {};
    }
}

/**
 * A simple GET request without extra options (uses a temporary cookie jar).
 * @param {string} url - The URL to fetch.
 * @returns {Promise<object>} A promise that resolves with the response.
 */
function cleanGet(url) {
    debug.logHttpRequest("GET", url);
    const client = createClientWithJar(new CookieJar());
    const fn = () => client.get(url, { timeout: 60000, ...proxyConfig });
    return requestWithRetry(fn, 3, "GET", url);
}

/**
 * Performs a GET request with query parameters and custom options.
 * @param {string} url
 * @param {object} reqJar
 * @param {object} qs - Query string parameters.
 * @param {object} options
 * @param {object} ctx
 * @param {object} customHeader
 * @returns {Promise<object>}
 */
async function get(url, reqJar, qs, options, ctx, customHeader) {
    debug.logHttpRequest("GET", url, { params: qs });
    const client = createClientWithJar(reqJar);
    const config = {
        headers: getHeaders(url, options, ctx, customHeader),
        timeout: 60000,
        params: qs,
        ...proxyConfig,
        validateStatus: (status) => status >= 200 && status < 600,
    };
    return requestWithRetry(async () => await client.get(url, config), 3, "GET", url);
}

/**
 * Performs a POST request, automatically handling JSON or URL-encoded form data.
 * @param {string} url
 * @param {object} reqJar
 * @param {object} form - The form data object.
 * @param {object} options
 * @param {object} ctx
 * @param {object} customHeader
 * @returns {Promise<object>}
 */
async function post(url, reqJar, form, options, ctx, customHeader) {
    debug.logHttpRequest("POST", url, { formData: form });
    const client = createClientWithJar(reqJar);
    const headers = getHeaders(url, options, ctx, customHeader);
    let data = form;
    const contentType = headers["Content-Type"] || "application/x-www-form-urlencoded";

    // Automatically handle JSON if the content type suggests it
    if (contentType.includes("json")) {
        data = JSON.stringify(form);
    } else {
        // Handle URL-encoded form data, stringifying nested objects
        const transformedForm = new URLSearchParams();
        for (const key in form) {
            if (Object.prototype.hasOwnProperty.call(form, key)) {
                let value = form[key];
                if (getType(value) === "Object") {
                    value = JSON.stringify(value);
                }
                transformedForm.append(key, value);
            }
        }
        data = transformedForm.toString();
    }

    headers["Content-Type"] = contentType;

    const config = {
        headers,
        timeout: 60000,
        ...proxyConfig,
        validateStatus: (status) => status >= 200 && status < 600,
    };
    return requestWithRetry(async () => await client.post(url, data, config), 3, "POST", url);
}

/**
 * Performs a POST request with multipart/form-data.
 * @param {string} url
 * @param {object} reqJar
 * @param {object} form - The form data object, may contain readable streams.
 * @param {object} qs - Query string parameters.
 * @param {object} options
 * @param {object} ctx
 * @returns {Promise<object>}
 */
async function postFormData(url, reqJar, form, qs, options, ctx) {
    debug.logHttpRequest("POST", url, { formData: form, params: qs });
    const client = createClientWithJar(reqJar);
    const formData = new FormData();
    for (const key in form) {
        if (Object.prototype.hasOwnProperty.call(form, key)) {
            const value = form[key];
            // For streams, try to get filename from stream path or use default
            if (value && typeof value === "object" && typeof value.pipe === "function") {
                // It's a stream - check if it has a path property (fs.createReadStream sets this)
                const streamPath = value.path || value._tempPath;
                if (streamPath) {
                    const path = require("path");
                    const filename = path.basename(streamPath);
                    // Determine content type based on extension
                    const ext = path.extname(filename).toLowerCase();
                    const mimeTypes = {
                        ".mp4": "video/mp4",
                        ".mp3": "audio/mpeg",
                        ".m4a": "audio/mp4",
                        ".aac": "audio/aac",
                        ".wav": "audio/wav",
                        ".ogg": "audio/ogg",
                        ".jpg": "image/jpeg",
                        ".jpeg": "image/jpeg",
                        ".png": "image/png",
                        ".gif": "image/gif",
                        ".webp": "image/webp",
                    };
                    const contentType = mimeTypes[ext] || "application/octet-stream";
                    formData.append(key, value, { filename, contentType });
                } else {
                    formData.append(key, value, {
                        filename: "upload",
                        contentType: "application/octet-stream",
                    });
                }
            } else {
                formData.append(key, value);
            }
        }
    }

    const customHeader = {
        "Content-Type": `multipart/form-data; boundary=${formData.getBoundary()}`,
    };

    const config = {
        headers: getHeaders(url, options, ctx, customHeader),
        timeout: 60000,
        params: qs,
        ...proxyConfig,
        validateStatus: (status) => status >= 200 && status < 600,
    };
    return requestWithRetry(async () => await client.post(url, formData, config), 3, "POST", url);
}

module.exports = {
    cleanGet,
    get,
    post,
    postFormData,
    getJar: () => new CookieJar(), // Create fresh jar for each account
    setProxy,
};
