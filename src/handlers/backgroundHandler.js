/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                        BACKGROUND TASK HANDLER                                ║
 * ║         Handles scheduled and interval-based background tasks                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * This handler is responsible for:
 * - Loading background tasks from designated directories
 * - Registering tasks into a collection
 * - Managing task intervals and scheduling
 * - Executing tasks with proper maintenance mode checks
 * - Tracking task execution statistics
 *
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const fs = require("fs");
const path = require("path");
const config = require("../config/config");
const logger = require("../utils/logger");
const maintenanceManager = require("../utils/maintenanceManager");
const statsTracker = require("../utils/statsTracker");

/**
 * Background Task Handler
 * Manages loading, starting, stopping, and executing background tasks
 */
class BackgroundHandler {
    constructor() {
        /** @type {Map<string, Object>} Registered background tasks */
        this.tasks = new Map();

        /** @type {Map<string, Object>} Category metadata */
        this.categories = new Map();

        /** @type {Map<string, NodeJS.Timer>} Active interval timers */
        this.intervals = new Map();

        /** @type {Object} Handler statistics */
        this.stats = {
            loaded: 0,
            active: 0,
            executions: 0,
            errors: 0,
            lastExecution: null,
        };

        /** @type {Object|null} API reference for task execution */
        this.api = null;

        /** @type {Object|null} Account manager reference */
        this.accountManager = null;

        /** @type {boolean} Whether tasks are currently running */
        this.isRunning = false;
    }

    /**
     * Initialize the background handler
     * Loads all tasks from configured directories
     * @returns {Promise<number>} Number of tasks loaded
     */
    async init() {
        if (!config.background?.enabled) {
            logger.debug("BackgroundHandler", "Background tasks disabled in config");
            return 0;
        }

        const backgroundPath = config.paths.background;

        if (!fs.existsSync(backgroundPath)) {
            logger.warn("BackgroundHandler", `Background directory not found: ${backgroundPath}`);
            return 0;
        }

        // Load tasks from configured directories
        const directories = config.background.directories || [];

        if (directories.length === 0) {
            // Load directly from root background folder
            await this.loadCategory("root");
        } else {
            // Load from subdirectories
            for (const dir of directories) {
                await this.loadCategory(dir);
            }
        }

        logger.success(
            "BackgroundHandler",
            `Loaded ${this.stats.loaded} background tasks. Ready.`
        );
        return this.stats.loaded;
    }

    /**
     * Load tasks from a category directory
     * @param {string} category - Category/directory name ("root" for root folder)
     * @returns {Promise<void>}
     */
    async loadCategory(category) {
        // Handle root folder loading
        const isRoot = category === "root";
        const categoryPath = isRoot 
            ? config.paths.background 
            : path.join(config.paths.background, category);

        if (!fs.existsSync(categoryPath)) {
            logger.debug("BackgroundHandler", `Category directory not found: ${category}`);
            return;
        }

        const dirStats = fs.statSync(categoryPath);
        if (!dirStats.isDirectory()) {
            return;
        }

        // Initialize category
        this.categories.set(category, {
            name: category,
            path: categoryPath,
            tasks: [],
        });

        // Load all task files (only .js files, skip directories)
        const files = fs.readdirSync(categoryPath).filter((file) => {
            const filePath = path.join(categoryPath, file);
            return file.endsWith(".js") && fs.statSync(filePath).isFile();
        });

        for (const file of files) {
            const filePath = path.join(categoryPath, file);
            try {
                await this.loadTask(category, filePath);
            } catch (error) {
                logger.error("BackgroundHandler", `Failed to load task ${file}: ${error.message}`);
                this.stats.errors++;
            }
        }
    }

    /**
     * Load a single background task from file
     * @param {string} category - Category name
     * @param {string} filePath - Path to the task file
     * @returns {Promise<void>}
     */
    async loadTask(category, filePath) {
        // Clear require cache to allow hot reloading
        delete require.cache[require.resolve(filePath)];

        const task = require(filePath);

        // Support both flat structure and config-based structure
        const taskConfig = task.config || task;
        const taskName = taskConfig.name;
        const taskInterval = taskConfig.interval;
        const taskSchedule = taskConfig.schedule;

        // Validate task structure
        if (!taskName) {
            throw new Error(`Task at ${filePath} is missing required 'name' property`);
        }

        if (!taskInterval && !taskSchedule) {
            throw new Error(`Task ${taskName} is missing 'interval' or 'schedule' property`);
        }

        if (typeof task.execute !== "function" && typeof task.init !== "function") {
            throw new Error(`Task ${taskName} is missing 'execute' or 'init' function`);
        }

        // Set default values
        const taskData = {
            name: taskName,
            description: taskConfig.description || "No description provided",
            category: category,
            interval: taskInterval || null, // Interval in milliseconds
            schedule: taskSchedule || null, // Cron-like schedule (future feature)
            runOnStart: taskConfig.runOnStart !== false, // Default: true
            enabled: taskConfig.enabled !== false, // Default: true
            init: task.init ? task.init.bind(task) : null, // Init function (bound to task)
            stop: task.stop ? task.stop.bind(task) : null, // Stop/cleanup function (bound)
            execute: task.execute ? task.execute.bind(task) : null, // Main execution (bound to task for `this`)
            onLoad: task.onLoad ? task.onLoad.bind(task) : null, // Called when task is loaded
            onUnload: task.onUnload ? task.onUnload.bind(task) : null, // Called when task is unloaded
            filePath: filePath,
            lastRun: null,
            runCount: 0,
            errorCount: 0,
        };

        // Register task
        this.tasks.set(taskData.name.toLowerCase(), taskData);

        // Add to category
        const categoryData = this.categories.get(category);
        if (categoryData) {
            categoryData.tasks.push(taskData.name);
        }

        // Call onLoad hook if exists
        if (typeof taskData.onLoad === "function") {
            try {
                await taskData.onLoad();
            } catch (error) {
                logger.warn("BackgroundHandler", `onLoad hook failed for ${taskData.name}: ${error.message}`);
            }
        }

        this.stats.loaded++;
        logger.debug(
            "BackgroundHandler",
            `Loaded task: ${taskData.name} (${category}) - Interval: ${taskData.interval}ms`
        );
    }

    /**
     * Start all background tasks
     * @param {Object} api - Nero API object (or AccountManager for multi-account)
     * @param {Object} accountManager - Account manager instance
     * @returns {Promise<number>} Number of tasks started
     */
    async startAll(api, accountManager) {
        if (!config.background?.enabled) {
            return 0;
        }

        if (this.isRunning) {
            logger.warn("BackgroundHandler", "Background tasks already running");
            return this.stats.active;
        }

        this.api = api;
        this.accountManager = accountManager;
        this.isRunning = true;

        let started = 0;

        for (const [name, task] of this.tasks) {
            if (!task.enabled) {
                logger.debug("BackgroundHandler", `Skipping disabled task: ${name}`);
                continue;
            }

            try {
                await this.startTask(name);
                started++;
            } catch (error) {
                logger.error("BackgroundHandler", `Failed to start task ${name}: ${error.message}`);
                this.stats.errors++;
            }
        }

        this.stats.active = started;
        // Removed duplicate log. Only log from main if needed.
        return started;
    }

    /**
     * Start a single background task
     * @param {string} taskName - Name of the task to start
     * @returns {Promise<boolean>} Success status
     */
    async startTask(taskName) {
        const task = this.tasks.get(taskName.toLowerCase());

        if (!task) {
            logger.warn("BackgroundHandler", `Task not found: ${taskName}`);
            return false;
        }

        if (this.intervals.has(taskName.toLowerCase())) {
            logger.debug("BackgroundHandler", `Task already running: ${taskName}`);
            return true;
        }

        // Call task's init function if exists
        if (typeof task.init === "function") {
            try {
                await task.init(this.api, this.accountManager);
                logger.debug("BackgroundHandler", `Initialized task: ${taskName}`);
            } catch (error) {
                logger.error("BackgroundHandler", `Init failed for ${taskName}: ${error.message}`);
                task.errorCount++;
                this.stats.errors++;
                return false;
            }
        }

        // Run immediately if runOnStart is true
        if (task.runOnStart && typeof task.execute === "function") {
            this.executeTask(task).catch((error) => {
                logger.error("BackgroundHandler", `Initial execution failed for ${taskName}: ${error.message}`);
            });
        }

        // Set up interval if specified
        if (task.interval && task.interval > 0 && typeof task.execute === "function") {
            const intervalId = setInterval(async () => {
                await this.executeTask(task);
            }, task.interval);

            this.intervals.set(taskName.toLowerCase(), intervalId);
            logger.debug(
                "BackgroundHandler",
                `Started interval for ${taskName} (every ${this.formatInterval(task.interval)})`
            );
        }

        return true;
    }

    /**
     * Execute a background task
     * @param {Object} task - Task object to execute
     * @returns {Promise<void>}
     */
    async executeTask(task) {
        if (!task.enabled) return;

        // Skip execution during maintenance mode
        if (maintenanceManager.isEnabled()) {
            logger.debug(
                "BackgroundHandler",
                `Skipping task ${task.name} - maintenance mode active`
            );
            return;
        }

        const startTime = Date.now();

        try {
            // Get API from accountManager if api is null (multi-account mode)
            let api = this.api;
            if (!api && this.accountManager) {
                const primaryAccount = this.accountManager.getPrimaryAccount();
                if (primaryAccount && primaryAccount.api) {
                    api = primaryAccount.api;
                }
            }

            if (!api) {
                logger.warn("BackgroundHandler", `Skipping task ${task.name} - no API available`);
                return;
            }

            await task.execute({ api, config, logger, accountManager: this.accountManager });
            task.lastRun = new Date();
            task.runCount++;
            this.stats.executions++;
            this.stats.lastExecution = task.lastRun;

            const duration = Date.now() - startTime;

            // Track in global stats
            statsTracker.recordBackgroundTask(task.name, true, duration);

            logger.debug(
                "BackgroundHandler",
                `Executed task: ${task.name} (${duration}ms)`
            );
        } catch (error) {
            task.errorCount++;
            this.stats.errors++;

            // Track failed task in global stats
            statsTracker.recordBackgroundTask(task.name, false);

            logger.error(
                "BackgroundHandler",
                `Execution failed for ${task.name}: ${error.message}`
            );
        }
    }

    /**
     * Stop a single background task
     * @param {string} taskName - Name of the task to stop
     * @returns {Promise<boolean>} Success status
     */
    async stopTask(taskName) {
        const name = taskName.toLowerCase();
        const task = this.tasks.get(name);

        if (!task) {
            logger.warn("BackgroundHandler", `Task not found: ${taskName}`);
            return false;
        }

        // Clear interval
        const intervalId = this.intervals.get(name);
        if (intervalId) {
            clearInterval(intervalId);
            this.intervals.delete(name);
        }

        // Call task's stop function if exists
        if (typeof task.stop === "function") {
            try {
                await task.stop();
                logger.debug("BackgroundHandler", `Stopped task: ${taskName}`);
            } catch (error) {
                logger.error("BackgroundHandler", `Stop failed for ${taskName}: ${error.message}`);
            }
        }

        this.stats.active = this.intervals.size;
        return true;
    }

    /**
     * Stop all background tasks
     * @returns {Promise<void>}
     */
    async stopAll() {
        if (!this.isRunning) {
            return;
        }

        logger.info("BackgroundHandler", "Stopping all background tasks...");

        for (const [name] of this.tasks) {
            await this.stopTask(name);
        }

        this.isRunning = false;
        this.api = null;
        this.accountManager = null;
        this.stats.active = 0;

        logger.info("BackgroundHandler", "All background tasks stopped");
    }

    /**
     * Reload a background task
     * @param {string} taskName - Name of the task to reload
     * @returns {Promise<boolean>} Success status
     */
    async reloadTask(taskName) {
        const task = this.tasks.get(taskName.toLowerCase());

        if (!task) {
            logger.warn("BackgroundHandler", `Task not found: ${taskName}`);
            return false;
        }

        try {
            // Stop the task
            await this.stopTask(taskName);

            // Call onUnload hook
            if (typeof task.onUnload === "function") {
                await task.onUnload();
            }

            // Remove from collections
            this.tasks.delete(taskName.toLowerCase());
            const categoryData = this.categories.get(task.category);
            if (categoryData) {
                const index = categoryData.tasks.indexOf(task.name);
                if (index !== -1) {
                    categoryData.tasks.splice(index, 1);
                }
            }

            // Reload
            this.stats.loaded--;
            await this.loadTask(task.category, task.filePath);

            // Restart if was running
            if (this.isRunning) {
                await this.startTask(taskName);
            }

            logger.info("BackgroundHandler", `Reloaded task: ${taskName}`);
            return true;
        } catch (error) {
            logger.error("BackgroundHandler", `Failed to reload task ${taskName}: ${error.message}`);
            return false;
        }
    }

    /**
     * Reload all background tasks
     * @returns {Promise<number>} Number of tasks reloaded
     */
    async reloadAll() {
        logger.info("BackgroundHandler", "Reloading all background tasks...");

        // Stop all tasks first
        await this.stopAll();

        // Clear collections
        this.tasks.clear();
        this.categories.clear();
        this.stats.loaded = 0;
        this.stats.errors = 0;

        // Reinitialize
        const count = await this.init();

        // Restart if was running
        if (this.api) {
            await this.startAll(this.api, this.accountManager);
        }

        return count;
    }

    /**
     * Get a task by name
     * @param {string} taskName - Task name
     * @returns {Object|null} Task data or null
     */
    getTask(taskName) {
        return this.tasks.get(taskName.toLowerCase()) || null;
    }

    /**
     * Get all tasks
     * @returns {Array<Object>} Array of task data
     */
    getAllTasks() {
        return Array.from(this.tasks.values());
    }

    /**
     * Get tasks by category
     * @param {string} category - Category name
     * @returns {Array<Object>} Array of task data
     */
    getTasksByCategory(category) {
        return this.getAllTasks().filter((t) => t.category === category);
    }

    /**
     * Get running tasks
     * @returns {Array<Object>} Array of running task data
     */
    getRunningTasks() {
        const runningNames = Array.from(this.intervals.keys());
        return this.getAllTasks().filter((t) => runningNames.includes(t.name.toLowerCase()));
    }

    /**
     * Get handler statistics
     * @returns {Object} Handler stats
     */
    getStats() {
        return {
            ...this.stats,
            total: this.tasks.size,
            categories: this.categories.size,
            running: this.intervals.size,
        };
    }

    /**
     * Format interval to human-readable string
     * @param {number} ms - Interval in milliseconds
     * @returns {string} Formatted interval
     */
    formatInterval(ms) {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${Math.round(ms / 1000)}s`;
        if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
        return `${Math.round(ms / 3600000)}h`;
    }

    /**
     * Enable a task
     * @param {string} taskName - Task name
     * @returns {boolean} Success status
     */
    enableTask(taskName) {
        const task = this.tasks.get(taskName.toLowerCase());
        if (!task) return false;

        task.enabled = true;
        logger.info("BackgroundHandler", `Enabled task: ${taskName}`);

        // Start if handler is running
        if (this.isRunning) {
            this.startTask(taskName).catch((error) => {
                logger.error("BackgroundHandler", `Failed to start enabled task: ${error.message}`);
            });
        }

        return true;
    }

    /**
     * Disable a task
     * @param {string} taskName - Task name
     * @returns {Promise<boolean>} Success status
     */
    async disableTask(taskName) {
        const task = this.tasks.get(taskName.toLowerCase());
        if (!task) return false;

        task.enabled = false;
        await this.stopTask(taskName);
        logger.info("BackgroundHandler", `Disabled task: ${taskName}`);

        return true;
    }
}

// Export singleton instance
module.exports = new BackgroundHandler();
