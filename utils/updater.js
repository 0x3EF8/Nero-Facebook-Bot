/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                        NERO BOT - AUTO UPDATER                            ║
 * ║              GitHub Release Checker & Auto-Update System                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const readline = require("readline");

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const GITHUB_OWNER = "0x3EF8";
const GITHUB_REPO = "Nero";
const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;

// Colors for console output
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    magenta: "\x1b[35m",
    blue: "\x1b[34m",
    white: "\x1b[37m",
    bgBlue: "\x1b[44m",
    bgGreen: "\x1b[42m",
    bgYellow: "\x1b[43m",
};

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class Updater {
    constructor() {
        this.currentVersion = this.getCurrentVersion();
        this.latestRelease = null;
        this.updateAvailable = false;
    }

    /**
     * Get current version from package.json
     */
    getCurrentVersion() {
        try {
            const packagePath = path.join(__dirname, "..", "package.json");
            const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
            return packageJson.version || "0.0.0";
        } catch {
            return "0.0.0";
        }
    }

    /**
     * Make HTTPS request to GitHub API with timeout
     */
    async fetchGitHub(endpoint) {
        const timeoutMs = 5000; // 5 second timeout
        
        const fetchPromise = new Promise((resolve, reject) => {
            const url = `${GITHUB_API}${endpoint}`;
            
            const options = {
                headers: {
                    "User-Agent": "Nero-Bot-Updater",
                    "Accept": "application/vnd.github.v3+json",
                },
            };

            const req = https.get(url, options, (res) => {
                let data = "";
                
                res.on("data", (chunk) => { data += chunk; });
                res.on("end", () => {
                    try {
                        if (res.statusCode === 200) {
                            resolve(JSON.parse(data));
                        } else if (res.statusCode === 404) {
                            resolve(null);
                        } else {
                            reject(new Error(`GitHub API returned ${res.statusCode}`));
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            
            req.on("error", reject);
        });
        
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Request timeout")), timeoutMs);
        });
        
        return Promise.race([fetchPromise, timeoutPromise]);
    }

    /**
     * Check for updates from GitHub releases
     */
    async checkForUpdates() {
        try {
            // Try releases first
            const releases = await this.fetchGitHub("/releases/latest");
            
            if (releases && releases.tag_name) {
                const latestVersion = releases.tag_name.replace(/^v/, "");
                this.latestRelease = {
                    version: latestVersion,
                    tag: releases.tag_name,
                    name: releases.name || releases.tag_name,
                    body: releases.body || "",
                    url: releases.html_url,
                    publishedAt: releases.published_at,
                    tarball: releases.tarball_url,
                    zipball: releases.zipball_url,
                };
                
                this.updateAvailable = this.compareVersions(latestVersion, this.currentVersion) > 0;
                return this.updateAvailable;
            }

            // Fallback: check tags if no releases
            const tags = await this.fetchGitHub("/tags");
            
            if (tags && tags.length > 0) {
                const latestTag = tags[0];
                const latestVersion = latestTag.name.replace(/^v/, "");
                
                this.latestRelease = {
                    version: latestVersion,
                    tag: latestTag.name,
                    name: latestTag.name,
                    body: "",
                    url: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/${latestTag.name}`,
                    tarball: latestTag.tarball_url,
                    zipball: latestTag.zipball_url,
                };
                
                this.updateAvailable = this.compareVersions(latestVersion, this.currentVersion) > 0;
                return this.updateAvailable;
            }

            // No releases or tags found
            this.updateAvailable = false;
            return false;

        } catch {
            // Silently fail - don't block startup
            this.updateAvailable = false;
            return false;
        }
    }

    /**
     * Compare two semantic versions
     * Returns: 1 if a > b, -1 if a < b, 0 if equal
     */
    compareVersions(a, b) {
        const partsA = a.split(".").map(Number);
        const partsB = b.split(".").map(Number);
        
        for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
            const numA = partsA[i] || 0;
            const numB = partsB[i] || 0;
            
            if (numA > numB) return 1;
            if (numA < numB) return -1;
        }
        
        return 0;
    }

    /**
     * Display update notification
     */
    displayUpdateBanner() {
        if (!this.updateAvailable || !this.latestRelease) return;

        const c = colors;
        
        console.log();
        console.log(`${c.yellow}[Updater]${c.reset} ${c.bright}Update available!${c.reset}`);
        console.log(`${c.yellow}[Updater]${c.reset} Current: ${c.red}v${this.currentVersion}${c.reset} → Latest: ${c.green}v${this.latestRelease.version}${c.reset}`);
        
        if (this.latestRelease.body) {
            const notes = this.latestRelease.body.split("\n")[0].substring(0, 60);
            if (notes) {
                console.log(`${c.yellow}[Updater]${c.reset} ${c.dim}${notes}${c.reset}`);
            }
        }
        
        console.log();
    }

    /**
     * Prompt user for update confirmation
     */
    async promptForUpdate() {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });

            const c = colors;
            
            rl.question(`${c.cyan}►${c.reset} ${c.white}Update now?${c.reset} ${c.dim}(Y/N):${c.reset} `, (answer) => {
                rl.close();
                const choice = answer.trim().toLowerCase();
                resolve(choice === "y" || choice === "yes");
            });
        });
    }

    /**
     * Perform the update using git
     */
    async performUpdate() {
        const c = colors;
        
        console.log();
        console.log(`${c.cyan}[Updater]${c.reset} ${c.yellow}Starting update process...${c.reset}`);

        try {
            // Check if git is available
            try {
                execSync("git --version", { stdio: "pipe" });
            } catch {
                console.log(`${c.red}[Updater]${c.reset} Git is not installed. Please update manually.`);
                console.log(`${c.dim}          Download from: https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases${c.reset}`);
                return false;
            }

            // Check if this is a git repository
            const rootDir = path.join(__dirname, "..");
            const gitDir = path.join(rootDir, ".git");
            
            if (!fs.existsSync(gitDir)) {
                console.log(`${c.yellow}[Updater]${c.reset} Not a git repository. Initializing...`);
                
                // Initialize git and set remote
                execSync("git init", { cwd: rootDir, stdio: "pipe" });
                execSync(`git remote add origin https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}.git`, { 
                    cwd: rootDir, 
                    stdio: "pipe" 
                });
            }

            // Stash any local changes
            console.log(`${c.cyan}[Updater]${c.reset} Saving local changes...`);
            try {
                execSync("git stash", { cwd: rootDir, stdio: "pipe" });
            } catch {
                // No changes to stash, that's fine
            }

            // Fetch latest
            console.log(`${c.cyan}[Updater]${c.reset} Fetching latest version...`);
            execSync("git fetch origin main", { cwd: rootDir, stdio: "pipe" });

            // Reset to latest
            console.log(`${c.cyan}[Updater]${c.reset} Applying update...`);
            execSync("git reset --hard origin/main", { cwd: rootDir, stdio: "pipe" });

            // Try to restore local changes
            console.log(`${c.cyan}[Updater]${c.reset} Restoring local changes...`);
            try {
                execSync("git stash pop", { cwd: rootDir, stdio: "pipe" });
            } catch {
                // Stash was empty or conflicts - that's okay
            }

            // Install dependencies
            console.log(`${c.cyan}[Updater]${c.reset} Installing dependencies...`);
            execSync("npm install", { cwd: rootDir, stdio: "inherit" });

            console.log();
            console.log(`${c.green}[Updater]${c.reset} Update successful! Now running ${c.cyan}v${this.latestRelease.version}${c.reset}`);
            console.log(`${c.green}[Updater]${c.reset} Restarting automatically...`);
            console.log();

            return true;

        } catch (error) {
            console.log(`${c.red}[Updater]${c.reset} Update failed: ${error.message}`);
            console.log(`${c.dim}          Please update manually from: https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}${c.reset}`);
            return false;
        }
    }

    /**
     * Main update check flow - called on startup
     * Returns true if bot should restart after update
     */
    async checkAndPrompt() {
        const c = colors;

        // Check for updates
        const hasUpdate = await this.checkForUpdates();
        
        if (!hasUpdate) {
            return false;
        }

        // Display update banner
        this.displayUpdateBanner();

        // Ask user
        const shouldUpdate = await this.promptForUpdate();
        
        if (!shouldUpdate) {
            console.log(`${c.yellow}[Updater]${c.reset} Update skipped. You can update later by restarting the bot.`);
            console.log();
            return false;
        }

        // Perform update
        const success = await this.performUpdate();
        
        if (success) {
            // Return true to signal restart needed
            return true;
        }

        return false;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = Updater;
