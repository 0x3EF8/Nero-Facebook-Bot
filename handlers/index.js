/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                          HANDLERS INDEX                                       ║
 * ║              Exports all handlers for convenient importing                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 * 
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const commandHandler = require("./commandHandler");
const eventHandler = require("./eventHandler");

module.exports = {
    commandHandler,
    eventHandler,
};
