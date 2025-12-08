/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                            EVENT HANDLER                                      ║
 * ║       Dynamic event loading, registration, and execution management           ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 * 
 * This handler is responsible for:
 * - Loading event handlers from designated directories
 * - Registering events into a collection
 * - Dispatching events to appropriate handlers
 * - Managing event priorities and execution order
 * - Human behavior simulation for realistic response timing
 * 
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const fs = require("fs");
const path = require("path");
const config = require("../config/config");
const settings = require("../config/settings");
const logger = require("../utils/logger");
const maintenanceManager = require("../utils/maintenanceManager");

/**
 * EventHandler Class
 * Manages all event-related operations
 */
class EventHandler {
    /**
     * Creates a new EventHandler instance
     */
    constructor() {
        /** @type {Map<string, Array<Object>>} Collection of event handlers by type */
        this.events = new Map();
        
        /** @type {Map<string, Object>} All registered event handlers */
        this.handlers = new Map();
        
        /** @type {Object} Event statistics */
        this.stats = {
            loaded: 0,
            triggered: 0,
            failed: 0,
        };
    }

    /**
     * Initializes the event handler and loads all events
     * @returns {Promise<number>} Number of events loaded
     */
    async init() {
        logger.info("EventHandler", "Initializing event handler...");
        
        // Clear existing handlers first (important for reload)
        this.events.clear();
        this.handlers.clear();
        this.stats.loaded = 0;
        
        const eventsPath = config.paths.events;
        const directories = config.events.directories;
        
        // Ensure events directory exists
        if (!fs.existsSync(eventsPath)) {
            fs.mkdirSync(eventsPath, { recursive: true });
            logger.warn("EventHandler", `Created events directory: ${eventsPath}`);
        }
        
        // Load events from each directory
        for (const dir of directories) {
            const categoryPath = path.join(eventsPath, dir);
            
            if (!fs.existsSync(categoryPath)) {
                fs.mkdirSync(categoryPath, { recursive: true });
                logger.warn("EventHandler", `Created event directory: ${categoryPath}`);
                continue;
            }
            
            await this.loadDirectory(dir, categoryPath);
        }
        
        logger.success("EventHandler", `Loaded ${this.stats.loaded} event handlers from ${directories.length} directories`);
        return this.stats.loaded;
    }

    /**
     * Loads all event handlers from a directory
     * @param {string} category - Category/directory name
     * @param {string} dirPath - Path to the directory
     * @returns {Promise<void>}
     */
    async loadDirectory(category, dirPath) {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            try {
                if (entry.isFile() && entry.name.endsWith(".js")) {
                    // Load .js file directly
                    await this.loadEvent(category, path.join(dirPath, entry.name));
                } else if (entry.isDirectory()) {
                    // Check for index.js in subdirectory (modular event support)
                    const indexPath = path.join(dirPath, entry.name, "index.js");
                    if (fs.existsSync(indexPath)) {
                        await this.loadEvent(category, indexPath);
                    }
                }
            } catch (error) {
                logger.error("EventHandler", `Failed to load event ${entry.name}: ${error.message}`);
            }
        }
    }

    /**
     * Loads a single event handler from file
     * @param {string} category - Category name
     * @param {string} filePath - Path to the event file
     * @returns {Promise<void>}
     */
    async loadEvent(category, filePath) {
        // Clear require cache to allow hot reloading
        delete require.cache[require.resolve(filePath)];
        
        const eventModule = require(filePath);
        
        // Validate event structure
        if (!eventModule.config || !eventModule.config.name) {
            throw new Error(`Event at ${filePath} is missing required config.name`);
        }
        
        // Set default values
        const eventData = {
            config: {
                name: eventModule.config.name,
                description: eventModule.config.description || "No description provided",
                eventTypes: eventModule.config.eventTypes || ["message"], // Types of events to listen to
                priority: eventModule.config.priority ?? 0, // Higher = executed first
                enabled: eventModule.config.enabled !== false,
                category: category,
            },
            execute: eventModule.execute || eventModule.run || eventModule.onEvent,
            onLoad: eventModule.onLoad,
            onUnload: eventModule.onUnload,
            filePath: filePath,
        };
        
        // Validate execute function
        if (typeof eventData.execute !== "function") {
            throw new Error(`Event ${eventData.config.name} is missing execute function`);
        }
        
        // Register handler in handlers map
        this.handlers.set(eventData.config.name, eventData);
        
        // Register for each event type
        for (const eventType of eventData.config.eventTypes) {
            if (!this.events.has(eventType)) {
                this.events.set(eventType, []);
            }
            
            const eventList = this.events.get(eventType);
            eventList.push(eventData);
            
            // Sort by priority (higher first)
            eventList.sort((a, b) => b.config.priority - a.config.priority);
        }
        
        // Call onLoad hook if exists
        if (typeof eventData.onLoad === "function") {
            await eventData.onLoad();
        }
        
        this.stats.loaded++;
        logger.debug("EventHandler", `Loaded event: ${eventData.config.name} (${category}) - Types: ${eventData.config.eventTypes.join(", ")}`);
    }

    /**
     * Reloads an event handler by name
     * @param {string} eventName - Name of the event to reload
     * @returns {Promise<boolean>} Success status
     */
    async reloadEvent(eventName) {
        const handler = this.handlers.get(eventName);
        if (!handler) return false;
        
        try {
            // Call onUnload hook if exists
            if (typeof handler.onUnload === "function") {
                await handler.onUnload();
            }
            
            // Remove from handlers
            this.handlers.delete(eventName);
            
            // Remove from event type lists
            for (const handlers of this.events.values()) {
                const index = handlers.findIndex(h => h.config.name === eventName);
                if (index !== -1) {
                    handlers.splice(index, 1);
                }
            }
            
            // Reload
            this.stats.loaded--;
            await this.loadEvent(handler.config.category, handler.filePath);
            
            logger.info("EventHandler", `Reloaded event: ${eventName}`);
            return true;
        } catch (error) {
            logger.error("EventHandler", `Failed to reload event ${eventName}: ${error.message}`);
            return false;
        }
    }

    /**
     * Handles incoming events and dispatches to registered handlers
     * @param {Object} api - Nero API object
     * @param {Object} event - Event object from Nero
     * @returns {Promise<void>}
     */
    async handle(api, event) {
        if (!config.events.enabled) return;
        
        // Skip events during maintenance mode (silent - no notification)
        if (maintenanceManager.isEnabled()) {
            return;
        }
        
        // Check global DM/Group settings from config
        // isGroup is true for group chats, false/undefined for DMs
        const isGroup = event.isGroup === true;
        if (!isGroup && config.events.allowInDM === false) {
            return; // Silently ignore DM events
        }
        if (isGroup && config.events.allowInGroups === false) {
            return; // Silently ignore group events
        }
        
        const eventType = event.type;
        
        // Debug: Log event types for troubleshooting
        if (event.logMessageType) {
            logger.debug("EventHandler", `Event received: type=${eventType}, logMessageType=${event.logMessageType}`);
        }
        
        const handlers = this.events.get(eventType) || [];
        
        // Also get handlers registered for "all" event type
        const allHandlers = this.events.get("all") || [];
        const combinedHandlers = [...allHandlers, ...handlers];
        
        // Debug: Log handler count
        if (event.logMessageType) {
            logger.debug("EventHandler", `Found ${handlers.length} handlers for type "${eventType}", ${allHandlers.length} for "all"`);
        }
        
        // Sort combined handlers by priority
        combinedHandlers.sort((a, b) => b.config.priority - a.config.priority);
        
        // Filter enabled handlers
        const activeHandlers = combinedHandlers.filter(h => h.config.enabled);
        
        if (activeHandlers.length === 0) return;
        
        // Human behavior: Add natural delay before responding to events
        // This simulates a human noticing and processing the event
        if (settings.neroOptions.humanBehavior && event.logMessageType) {
            const eventDelay = this.calculateEventDelay(event);
            if (eventDelay > 0) {
                logger.debug("EventHandler", `Human behavior delay: ${eventDelay}ms for ${event.logMessageType}`);
                await this.delay(eventDelay);
            }
        }
        
        // Build context object
        const context = {
            api,
            event,
            config,
            logger,
            eventHandler: this,
        };
        
        // Execute all handlers
        for (const handler of activeHandlers) {
            try {
                this.stats.triggered++;
                
                // Log event execution
                const eventDetails = [];
                if (event.threadID) eventDetails.push(`thread:${event.threadID}`);
                if (event.senderID) eventDetails.push(`sender:${event.senderID}`);
                if (event.logMessageType) eventDetails.push(`type:${event.logMessageType}`);
                
                logger.debug("EventHandler", `Executing: ${handler.config.name} │ ${eventDetails.join(" │ ") || eventType}`);
                
                await handler.execute(context);
            } catch (error) {
                this.stats.failed++;
                logger.error("EventHandler", `Event handler error (${handler.config.name}): ${error.message}`);
                logger.debug("EventHandler", error.stack);
            }
        }
    }

    /**
     * Gets an event handler by name
     * @param {string} name - Event handler name
     * @returns {Object|null} Event handler or null
     */
    getHandler(name) {
        return this.handlers.get(name) || null;
    }

    /**
     * Gets all handlers for a specific event type
     * @param {string} eventType - Event type
     * @returns {Array<Object>} Array of handlers
     */
    getHandlersByType(eventType) {
        return this.events.get(eventType) || [];
    }

    /**
     * Gets all registered handlers
     * @returns {Map<string, Object>}
     */
    getAllHandlers() {
        return this.handlers;
    }

    /**
     * Gets handler statistics
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            totalHandlers: this.handlers.size,
            totalEventTypes: this.events.size,
        };
    }

    /**
     * Enables an event handler
     * @param {string} name - Handler name
     * @returns {boolean}
     */
    enableHandler(name) {
        const handler = this.handlers.get(name);
        if (handler) {
            handler.config.enabled = true;
            return true;
        }
        return false;
    }

    /**
     * Disables an event handler
     * @param {string} name - Handler name
     * @returns {boolean}
     */
    disableHandler(name) {
        const handler = this.handlers.get(name);
        if (handler) {
            handler.config.enabled = false;
            return true;
        }
        return false;
    }

    /**
     * Promise-based delay helper
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => { setTimeout(resolve, ms); });
    }

    /**
     * Calculates human-like delay for responding to events
     * Different event types have different natural response times
     * @param {Object} event - Event object
     * @returns {number} Delay in milliseconds
     */
    calculateEventDelay(event) {
        const logType = event.logMessageType || '';
        const hour = new Date().getHours();
        const isNight = hour >= 23 || hour < 7;
        const circadianMultiplier = isNight ? 2.0 : (hour >= 10 && hour < 20 ? 0.9 : 1.0);
        
        let baseDelay = 0;
        
        switch (logType) {
            case 'log:subscribe':
                // New member joined - takes time to notice and compose welcome
                baseDelay = 1500 + Math.random() * 2000;
                break;
            case 'log:unsubscribe':
                // Member left - notice and react
                baseDelay = 1000 + Math.random() * 1500;
                break;
            case 'log:thread-name':
            case 'log:thread-icon':
            case 'log:thread-color':
                // Thread changes - quick notice
                baseDelay = 800 + Math.random() * 1200;
                break;
            case 'log:user-nickname':
                // Nickname change - moderate notice
                baseDelay = 600 + Math.random() * 800;
                break;
            default:
                // Other events - quick response
                baseDelay = 300 + Math.random() * 500;
        }
        
        // Apply circadian rhythm
        baseDelay = Math.round(baseDelay * circadianMultiplier);
        
        // Log the simulation with tree format (respects debug log level)
        if (baseDelay > 500) {
            const eventTypes = {
                'log:subscribe': 'New member welcome',
                'log:unsubscribe': 'Member departure',
                'log:thread-name': 'Thread name change',
                'log:thread-icon': 'Thread icon change', 
                'log:thread-color': 'Thread color change',
                'log:user-nickname': 'Nickname change'
            };
            
            logger.humanBehavior({
                action: 'Event Response',
                type: eventTypes[logType] || 'Generic event',
                delay: baseDelay,
                circadian: circadianMultiplier,
                status: [
                    `Time period: ${isNight ? '🌙 Night mode' : '☀️ Day mode'}`,
                    `Event: ${logType || event.type}`
                ],
                phases: [
                    `Phase 1 - Recognition: ${Math.round(baseDelay * 0.3)}ms`,
                    `Phase 2 - Processing: ${Math.round(baseDelay * 0.5)}ms`, 
                    `Phase 3 - Response: ${Math.round(baseDelay * 0.2)}ms`
                ],
                extra: [
                    `✓ Total Event Delay: ${baseDelay}ms (${(baseDelay/1000).toFixed(2)}s)`
                ]
            });
        }
        
        return baseDelay;
    }
}

// Export singleton instance
module.exports = new EventHandler();
