/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                                                                              ║
 * ║   Unofficial Facebook Messenger API for Node.js                              ║
 * ║   Version 2.0.0                                                              ║
 * ║                                                                              ║
 * ║   Author: 0x3EF8                                                             ║
 * ║   License: MIT                                                               ║
 * ║                                                                              ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

"use strict";

const { login } = require("./src/core/client");

// CommonJS default export
module.exports = login;

// Named exports for flexibility
module.exports.login = login;
module.exports.default = login;

// Version info
module.exports.version = "2.0.0";
module.exports.author = "0x3EF8";
