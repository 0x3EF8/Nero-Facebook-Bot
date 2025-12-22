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
const chalk = require("chalk");

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const GITHUB_OWNER = "0x3EF8";
const GITHUB_REPO = "Nero";
const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;

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
            // Go up two directories from src/utils/ to reach root package.json
            const packagePath = path.join(__dirname, "..", "..", "package.json");
            const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
            return packageJson.version || "0.0.0";
        } catch {
            return "0.0.0";
        }
    }

    /**
     * Make HTTPS request to GitHub API
     */
    async fetchGitHub(endpoint) {
        return new Promise((resolve, reject) => {
            const url = `${GITHUB_API}${endpoint}`;

            const options = {
                headers: {
                    "User-Agent": "Nero-Bot-Updater",
                    Accept: "application/vnd.github.v3+json",
                },
            };

            https
                .get(url, options, (res) => {
                    let data = "";

                    res.on("data", (chunk) => (data += chunk));
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
                })
                .on("error", reject);
        });
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

        console.log();
        console.log(chalk.yellow("[Updater]") + " " + chalk.bold("Update available!"));
        console.log(
            chalk.yellow("[Updater]") +
                " Current: " +
                chalk.red(`v${this.currentVersion}`) +
                " → Latest: " +
                chalk.green(`v${this.latestRelease.version}`)
        );

        if (this.latestRelease.body) {
            const notes = this.latestRelease.body.split("\n")[0].substring(0, 60);
            if (notes) {
                console.log(chalk.yellow("[Updater]") + " " + chalk.dim(notes));
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

            rl.question(
                chalk.cyan("►") + " " + chalk.white("Update now?") + " " + chalk.dim("(Y/N): "),
                (answer) => {
                    rl.close();
                    const choice = answer.trim().toLowerCase();
                    resolve(choice === "y" || choice === "yes");
                }
            );
        });
    }

    /**
     * Perform the update using git
     */
    async performUpdate() {
        console.log();
        console.log(chalk.cyan("[Updater]") + " " + chalk.yellow("Starting update process..."));

        try {
            // Check if git is available
            try {
                execSync("git --version", { stdio: "pipe" });
            } catch {
                console.log(
                    chalk.red("[Updater]") + " Git is not installed. Please update manually."
                );
                console.log(
                    chalk.dim(
                        `          Download from: https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`
                    )
                );
                return false;
            }

            // Check if this is a git repository
            const rootDir = path.join(__dirname, "..", "..");
            const gitDir = path.join(rootDir, ".git");

            if (!fs.existsSync(gitDir)) {
                console.log(chalk.yellow("[Updater]") + " Not a git repository. Initializing...");

                // Initialize git and set remote
                execSync("git init", { cwd: rootDir, stdio: "pipe" });
                execSync(
                    `git remote add origin https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}.git`,
                    {
                        cwd: rootDir,
                        stdio: "pipe",
                    }
                );
            }

            // Stash any local changes
            console.log(chalk.cyan("[Updater]") + " Saving local changes...");
            try {
                execSync("git stash", { cwd: rootDir, stdio: "pipe" });
            } catch {
                // No changes to stash, that's fine
            }

            // Fetch latest
            console.log(chalk.cyan("[Updater]") + " Fetching latest version...");
            execSync("git fetch origin main", { cwd: rootDir, stdio: "pipe" });

            // Reset to latest
            console.log(chalk.cyan("[Updater]") + " Applying update...");
            execSync("git reset --hard origin/main", { cwd: rootDir, stdio: "pipe" });

            // Try to restore local changes
            console.log(chalk.cyan("[Updater]") + " Restoring local changes...");
            try {
                execSync("git stash pop", { cwd: rootDir, stdio: "pipe" });
            } catch {
                // Stash was empty or conflicts - that's okay
            }

            // Install dependencies
            console.log(chalk.cyan("[Updater]") + " Installing dependencies...");
            execSync("npm install", { cwd: rootDir, stdio: "inherit" });

            console.log();
            console.log(
                chalk.green("[Updater]") +
                    " Update successful! Now running " +
                    chalk.cyan(`v${this.latestRelease.version}`)
            );
            console.log(chalk.green("[Updater]") + " Restarting automatically...");
            console.log();

            return true;
        } catch (error) {
            console.log(chalk.red("[Updater]") + ` Git update failed: ${error.message}`);
            console.log(chalk.yellow("[Updater]") + " Attempting direct download fallback...");

            return await this.performDirectUpdate();
        }
    }

    /**
     * Fallback: Download and extract update directly
     */
    async performDirectUpdate() {
        const rootDir = path.join(__dirname, "..", "..");
        
        try {
            // Use tar command which is standard in most containers (uid 999 suggests linux container)
            const tarballUrl = this.latestRelease.tarball;
            
            console.log(chalk.cyan("[Updater]") + " Downloading latest version...");
            // curl -L <url> | tar -xz --strip-components=1
            // This downloads the tarball and extracts it, stripping the root folder (repo-name-version)
            execSync(`curl -L "${tarballUrl}" | tar -xz --strip-components=1`, { 
                cwd: rootDir, 
                stdio: "pipe",
                maxBuffer: 10 * 1024 * 1024 // 10MB buffer
            });

            console.log(chalk.cyan("[Updater]") + " Installing dependencies...");
            execSync("npm install", { cwd: rootDir, stdio: "inherit" });

            console.log();
            console.log(
                chalk.green("[Updater]") +
                    " Direct update successful! Now running " +
                    chalk.cyan(`v${this.latestRelease.version}`)
            );
            console.log(chalk.green("[Updater]") + " Restarting automatically...");
            return true;

        } catch (directError) {
            console.log(chalk.red("[Updater]") + ` Direct update failed: ${directError.message}`);
            console.log(
                chalk.dim(
                    `          Please update manually from: https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`
                )
            );
            return false;
        }
    }

    /**
     * Main update check flow - called on startup
     * Returns true if bot should restart after update
     */
    async checkAndPrompt() {
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
            console.log(
                chalk.yellow("[Updater]") +
                    " Update skipped. You can update later by restarting the bot."
            );
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
