// Global variable to store extracted cookies
let extractedCookiesJSON = "";

/**
 * Validates appstate cookies for Facebook authentication (client-side)
 * @param {Array} cookies - Array of cookie objects
 * @returns {Object} Validation result with valid flag and details
 */
function validateAppstate(cookies) {
    const errors = [];
    const warnings = [];

    // Required cookies for Facebook authentication
    const requiredCookies = ["c_user", "xs", "datr"];
    const recommendedCookies = ["sb", "fr"];

    // Check if cookies is a valid array
    if (!Array.isArray(cookies) || cookies.length === 0) {
        return {
            valid: false,
            errors: ["Appstate must be a non-empty array of cookies"],
            warnings: [],
            details: null,
        };
    }

    // Get all cookie keys/names
    const cookieMap = new Map();
    for (const cookie of cookies) {
        const key = cookie.key || cookie.name;
        const value = cookie.value;

        if (!key) {
            errors.push("Cookie missing key/name property");
            continue;
        }

        if (!value || typeof value !== "string" || value.trim() === "") {
            errors.push(`Cookie "${key}" has empty or invalid value`);
            continue;
        }

        cookieMap.set(key, value);
    }

    // Check required cookies
    for (const required of requiredCookies) {
        if (!cookieMap.has(required)) {
            errors.push(`Missing required cookie: ${required}`);
        } else {
            const value = cookieMap.get(required);
            // Validate c_user is numeric (Facebook UID)
            if (required === "c_user" && !/^\d+$/.test(value)) {
                errors.push("c_user cookie must be a numeric Facebook UID");
            }
            // Validate xs is not empty/placeholder
            if (required === "xs" && value.length < 10) {
                errors.push("xs cookie appears invalid (too short)");
            }
        }
    }

    // Check recommended cookies
    for (const recommended of recommendedCookies) {
        if (!cookieMap.has(recommended)) {
            warnings.push(`Missing recommended cookie: ${recommended}`);
        }
    }

    const uid = cookieMap.get("c_user") || null;

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        details: {
            uid,
            totalCookies: cookies.length,
            hasRequired: requiredCookies.every((k) => cookieMap.has(k)),
            presentCookies: Array.from(cookieMap.keys()),
        },
    };
}

// Configuration
const NERO_CONFIG = {
    serverUrl: "",
    apiKey: "NERO-9F4B-7C2D-A1E8-6H3J-K0LM",
};

// DOM Elements (will be initialized after DOM loads)
let elements = {};

// Dashboard state
const dashboardData = {
    botStatus: "unknown",
    uptime: 0,
    startTime: null,
    messages: 0,
    commands: 0,
    cookieHealth: "unknown",
    lastValidated: null,
    sessionAge: null,
    userId: null,
};

// Live uptime updater
let uptimeInterval = null;

// Load saved API URL from storage
async function loadApiUrl() {
    try {
        // Try chrome.storage first
        if (chrome && chrome.storage && chrome.storage.local) {
            const result = await chrome.storage.local.get(["apiUrl"]);
            NERO_CONFIG.serverUrl = result.apiUrl || "http://localhost:3000";
        } else {
            // Fallback to localStorage
            const saved = localStorage.getItem("nero_apiUrl");
            NERO_CONFIG.serverUrl = saved || "http://localhost:3000";
        }

        if (elements.apiUrl) {
            elements.apiUrl.value = NERO_CONFIG.serverUrl;
        }
        return NERO_CONFIG.serverUrl;
    } catch (err) {
        console.error("Failed to load API URL:", err);
        // Fallback to localStorage
        try {
            const saved = localStorage.getItem("nero_apiUrl");
            NERO_CONFIG.serverUrl = saved || "http://localhost:3000";
        } catch {
            NERO_CONFIG.serverUrl = "http://localhost:3000";
        }
        return NERO_CONFIG.serverUrl;
    }
}

// Save API URL to storage
async function saveApiUrl(url) {
    try {
        // Try chrome.storage first
        if (chrome && chrome.storage && chrome.storage.local) {
            await chrome.storage.local.set({ apiUrl: url });
        } else {
            // Fallback to localStorage
            localStorage.setItem("nero_apiUrl", url);
        }
        NERO_CONFIG.serverUrl = url;
        return true;
    } catch (err) {
        console.error("Failed to save with chrome.storage:", err);
        // Fallback to localStorage
        try {
            localStorage.setItem("nero_apiUrl", url);
            NERO_CONFIG.serverUrl = url;
            return true;
        } catch (localErr) {
            console.error("Failed to save with localStorage:", localErr);
            throw new Error("Failed to save API URL");
        }
    }
}

// Test API connection
async function testApiConnection(url) {
    try {
        const response = await fetch(`${url}/api/stats`, {
            method: "GET",
            headers: {
                "X-API-Key": NERO_CONFIG.apiKey,
            },
            signal: AbortSignal.timeout(5000), // 5 second timeout
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        return { success: true, data };
    } catch (err) {
        if (err.name === "AbortError" || err.name === "TimeoutError") {
            throw new Error("Connection timeout - server not responding");
        }
        throw new Error(`Cannot connect to ${url}`);
    }
}

// Fetch bot stats from server (unified endpoint)
async function fetchBotStats() {
    try {
        const response = await fetch(`${NERO_CONFIG.serverUrl}/api/stats`, {
            method: "GET",
            signal: AbortSignal.timeout(3000),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (err) {
        console.error("Failed to fetch bot stats:", err);
        return null;
    }
}

// Validate cookies with advanced detection
async function _validateCookies() {
    try {
        const response = await fetch(`${NERO_CONFIG.serverUrl}/api/cookies`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": NERO_CONFIG.apiKey,
            },
            body: JSON.stringify({ action: "validate" }),
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (err) {
        console.error("Cookie validation failed:", err);
        return null;
    }
}

// Update dashboard UI
function updateDashboard(data) {
    if (!data) {
        elements.dashBotStatus.textContent = "Offline";
        elements.dashBotStatus.className = "dashboard-card-value error";
        return;
    }

    // Handle nested data structure from /api/stats endpoint
    const bot = data.bot || {};

    // Bot Status
    const isOnline = bot.online || bot.status === "online" || data.success;
    if (isOnline) {
        elements.dashBotStatus.textContent = "Online";
        elements.dashBotStatus.className = "dashboard-card-value success";
    } else {
        elements.dashBotStatus.textContent = "Offline";
        elements.dashBotStatus.className = "dashboard-card-value error";
    }

    // Uptime - get from bot.uptime (number in seconds)
    const uptimeValue = bot.uptime || data.uptime || 0;
    if (uptimeValue > 0) {
        // Store the start time for live updates
        dashboardData.startTime = Date.now() - uptimeValue * 1000;
        dashboardData.uptime = uptimeValue;
        elements.dashUptime.textContent = formatUptime(uptimeValue);

        // Start live uptime counter
        startUptimeCounter();
    } else {
        elements.dashUptime.textContent = "0s";
    }

    // Remove duplicate cards: Only show status and uptime in dashboard cards, detailed stats in botStatsSection
    if (elements.dashMessages) elements.dashMessages.textContent = "";
    if (elements.dashCommands) elements.dashCommands.textContent = "";
}

// Update detailed bot statistics UI
function updateBotStats(data) {
    if (!data || !data.success) {
        // Set offline state
        if (elements.botOnlineStatus) {
            elements.botOnlineStatus.className = "cookie-health-status dead";
            elements.botOnlineText.textContent = "Offline";
        }
        return;
    }

    const { bot, messages, commands, events, activity, system } = data;

    // Update online status
    if (elements.botOnlineStatus && elements.botOnlineText) {
        if (bot && bot.online) {
            elements.botOnlineStatus.className = "cookie-health-status healthy";
            elements.botOnlineText.innerHTML =
                '<span style="color:#10b981;font-weight:600;">Online</span>';
        } else {
            elements.botOnlineStatus.className = "cookie-health-status dead";
            elements.botOnlineText.innerHTML =
                '<span style="color:#ef4444;font-weight:600;">Offline</span>';
        }
    }

    // Messages stats
    if (messages) {
        if (elements.statMsgTotal) {
            elements.statMsgTotal.textContent = messages.total?.toLocaleString() || "0";
        }
        if (elements.statMsgText) {
            elements.statMsgText.textContent = messages.text?.toLocaleString() || "0";
        }
        if (elements.statMsgAttach) {
            elements.statMsgAttach.textContent = messages.attachments?.toLocaleString() || "0";
        }
        if (elements.statMsgReact) {
            elements.statMsgReact.textContent = messages.reactions?.toLocaleString() || "0";
        }
    }
    // Commands stats
    if (commands) {
        if (elements.statCmdTotal) {
            elements.statCmdTotal.textContent = commands.total?.toLocaleString() || "0";
        }
        if (elements.statCmdSuccess) {
            elements.statCmdSuccess.textContent = commands.successful?.toLocaleString() || "0";
        }
        if (elements.statCmdFailed) {
            elements.statCmdFailed.textContent = commands.failed?.toLocaleString() || "0";
        }
        if (elements.statCmdBlocked) {
            elements.statCmdBlocked.textContent = commands.blocked?.toLocaleString() || "0";
        }
    }

    // Activity stats
    if (activity) {
        if (elements.statActiveUsers) {
            elements.statActiveUsers.textContent = activity.activeUsers?.toLocaleString() || "0";
        }
        if (elements.statActiveThreads) {
            elements.statActiveThreads.textContent =
                activity.activeThreads?.toLocaleString() || "0";
        }
        if (elements.statTotalAccounts) {
            elements.statTotalAccounts.textContent =
                activity.totalAccounts?.toLocaleString() || "0";
        }
        // Top commands
        if (
            activity.topCommands &&
            activity.topCommands.length > 0 &&
            elements.topCommandsSection &&
            elements.topCommandsList
        ) {
            elements.topCommandsSection.style.display = "block";
            elements.topCommandsList.innerHTML = activity.topCommands
                .map(
                    (cmd) => `
        <div class="cookie-detail-row"><span class="cookie-detail-label">${cmd.name}:</span><span class="cookie-detail-value">${cmd.count}</span></div>
      `
                )
                .join("");
        } else if (elements.topCommandsSection) {
            elements.topCommandsSection.style.display = "none";
        }
    }

    // Events stats
    if (events) {
        if (elements.statEventsTriggered) {
            elements.statEventsTriggered.textContent = events.triggered?.toLocaleString() || "0";
        }
    }

    // System stats
    if (system) {
        if (system.memory) {
            if (elements.statHeapUsed) {
                elements.statHeapUsed.textContent = system.memory.heapUsed || "0 MB";
            }
            if (elements.statHeapTotal) {
                elements.statHeapTotal.textContent = system.memory.heapTotal || "0 MB";
            }
            if (elements.statRss) elements.statRss.textContent = system.memory.rss || "0 MB";
        }
        if (elements.statNodeVersion) {
            elements.statNodeVersion.textContent = system.nodeVersion || "-";
        }
        if (elements.statPlatform) elements.statPlatform.textContent = system.platform || "-";
    }

    // Start time
    if (bot && bot.startTime && elements.statStartTime) {
        const startDate = new Date(bot.startTime);
        elements.statStartTime.textContent = startDate.toLocaleString();
    }
}

// Update cookie health status
function _updateCookieHealth(validationData) {
    if (!validationData) {
        elements.cookieHealthStatus.className = "cookie-health-status unknown";
        elements.cookieHealthStatus.innerHTML =
            '<div class="cookie-status-dot"></div><span>Unknown</span>';
        elements.lastValidated.textContent = "Never";
        elements.sessionAge.textContent = "Unknown";
        elements.validationMessage.classList.add("hidden");
        return;
    }

    const { status: _status, valid, error, details } = validationData;

    // Update status indicator
    if (valid) {
        elements.cookieHealthStatus.className = "cookie-health-status healthy";
        elements.cookieHealthStatus.innerHTML =
            '<div class="cookie-status-dot"></div><span>Healthy</span>';

        // Success message
        elements.validationMessage.className = "validation-message success";
        elements.validationMessage.textContent = "✓ Cookies are valid and active";
        elements.validationMessage.classList.remove("hidden");

        // Hide death information when healthy
        elements.deathTimeRow.style.display = "none";
        elements.deadDurationRow.style.display = "none";
    } else {
        elements.cookieHealthStatus.className = "cookie-health-status dead";
        elements.cookieHealthStatus.innerHTML =
            '<div class="cookie-status-dot"></div><span>Dead/Invalid</span>';

        // Error message
        elements.validationMessage.className = "validation-message error";
        elements.validationMessage.textContent =
            error ||
            "✗ Cookies are expired or invalid. Please re-login to Facebook and extract new cookies.";
        elements.validationMessage.classList.remove("hidden");

        // Show death information if available
        if (details && details.deathDate) {
            elements.deathTime.textContent = details.deathDate;
            elements.deathTimeRow.style.display = "flex";

            if (details.deadDuration) {
                elements.deadDuration.textContent = details.deadDuration;
                elements.deadDurationRow.style.display = "flex";
            }
        } else {
            elements.deathTimeRow.style.display = "none";
            elements.deadDurationRow.style.display = "none";
        }
    }

    // Update last validated
    elements.lastValidated.textContent = "Just now";

    // Update session age
    if (details && details.sessionAge) {
        elements.sessionAge.textContent = details.sessionAge;
    } else {
        elements.sessionAge.textContent = "Unknown";
    }

    // Update user ID if available
    if (details && details.userId) {
        elements.userId.textContent = details.userId;
    }

    // Update total cookies
    if (details && details.totalCookies !== undefined) {
        elements.totalCookies.textContent = details.totalCookies;
    }

    // Update critical cookies
    if (details && details.criticalCookies !== undefined) {
        elements.criticalCookies.textContent = details.criticalCookies;
    }

    // Update extracted at timestamp
    if (details && details.extractedAt) {
        const extractedDate = new Date(details.extractedAt);
        elements.extractedAt.textContent = extractedDate.toLocaleString();
        elements.extractedAtRow.style.display = "flex";
    } else {
        elements.extractedAtRow.style.display = "none";
    }

    // Update file size
    if (details && details.fileSize) {
        elements.fileSize.textContent = details.fileSize;
    }

    // Update bot status in cookie health
    if (details && details.botOnline !== undefined) {
        elements.botStatusCookie.textContent = details.botOnline ? "Online" : "Offline";
        elements.botStatusCookie.style.color = details.botOnline ? "#10b981" : "#ef4444";
    }
}

// Format uptime
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
}

// Start live uptime counter
function startUptimeCounter() {
    // Clear existing interval
    if (uptimeInterval) {
        clearInterval(uptimeInterval);
    }

    // Update uptime every second
    uptimeInterval = setInterval(() => {
        if (dashboardData.startTime && !elements.dashboard.classList.contains("hidden")) {
            const currentUptime = Math.floor((Date.now() - dashboardData.startTime) / 1000);
            elements.dashUptime.textContent = formatUptime(currentUptime);
        }
    }, 1000);
}

// Stop live uptime counter
function stopUptimeCounter() {
    if (uptimeInterval) {
        clearInterval(uptimeInterval);
        uptimeInterval = null;
    }
}

// Refresh dashboard data
async function refreshDashboard() {
    const refreshBtn = elements.refreshDashboard;
    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.style.opacity = "0.5";
    }

    // Show checking status
    if (elements.botOnlineStatus && elements.botOnlineText) {
        elements.botOnlineStatus.className = "cookie-health-status checking";
        elements.botOnlineText.textContent = "Loading...";
    }

    try {
        // Fetch unified bot stats
        const statsData = await fetchBotStats();
        updateDashboard(statsData);
        updateBotStats(statsData);
    } catch (err) {
        console.error("Dashboard refresh failed:", err);
        // Show error state
        if (elements.botOnlineStatus && elements.botOnlineText) {
            elements.botOnlineStatus.className = "cookie-health-status dead";
            elements.botOnlineText.textContent = "Error";
        }
    }

    if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.style.opacity = "1";
    }
}

// Extract Cookies Function
async function extractCookies() {
    // Reset UI
    elements.loadingState.classList.remove("hidden");
    elements.result.classList.add("hidden");
    elements.copyBtn.classList.add("hidden");
    elements.message.innerHTML = "";
    elements.output.value = "";
    extractedCookiesJSON = "";

    // Update status
    elements.statusDot.className = "status-dot loading";
    elements.statusText.textContent = "Extracting...";
    elements.cookieCount.textContent = "0";

    try {
        // Query active Facebook tab
        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
            url: "*://*.facebook.com/*",
        });

        if (!tab) {
            // Show message to open Facebook manually
            elements.loadingState.classList.add("hidden");
            elements.statusDot.className = "status-dot error";
            elements.statusText.textContent = "Facebook not open";
            elements.message.innerHTML =
                '<div class="message info"><span class="icon">🌐</span><span>Please open Facebook in the active tab to extract cookies.</span></div>';
            return;
        }

        // Get cookies from Facebook
        const cookies = await chrome.cookies.getAll({
            domain: "facebook.com",
        });

        const desired = ["datr", "sb", "ps_l", "ps_n", "wd", "c_user", "xs", "fr"];
        const extracted = [];
        const extractionTimestamp = new Date().toISOString();

        for (const name of desired) {
            const cookie = cookies.find((c) => c.name === name);
            if (cookie) {
                extracted.push({
                    key: cookie.name,
                    value: cookie.value,
                    domain: cookie.domain.replace(/^\./, ""),
                    path: cookie.path,
                    secure: cookie.secure,
                    httpOnly: cookie.httpOnly,
                    sameSite: cookie.sameSite,
                    extractedAt: extractionTimestamp,
                });
            }
        }

        // Check if logged in
        const c_user = extracted.find((c) => c.key === "c_user");
        const xs = extracted.find((c) => c.key === "xs");

        if (!c_user || !xs) {
            // Not logged in - show empty input box for manual paste
            elements.loadingState.classList.add("hidden");
            elements.result.classList.remove("hidden");
            elements.copyBtn.classList.remove("hidden");
            elements.sendBtn.classList.remove("hidden");

            // Show empty output with placeholder guidance
            elements.output.value = "";
            elements.output.placeholder =
                'Paste your appstate/cookies JSON here:\n[\n  {"key": "c_user", "value": "...", "domain": ".facebook.com"},\n  {"key": "xs", "value": "...", "domain": ".facebook.com"},\n  {"key": "datr", "value": "...", "domain": ".facebook.com"}\n]';
            elements.cookieCount.textContent = "0";

            // Update status
            elements.statusDot.className = "status-dot warning";
            elements.statusText.textContent = "Not logged in";

            return;
        }

        // Store and display result
        extractedCookiesJSON = JSON.stringify(extracted, null, 2);
        elements.output.value = extractedCookiesJSON;
        elements.cookieCount.textContent = extracted.length;

        // Update UI
        elements.loadingState.classList.add("hidden");
        elements.result.classList.remove("hidden");
        elements.copyBtn.classList.remove("hidden");
        elements.sendBtn.classList.remove("hidden");

        // Update status
        elements.statusDot.className = "status-dot";
        elements.statusText.textContent = "Ready";

        // Show success message
        elements.message.innerHTML =
            '<div class="message success"><span class="icon">✓</span><span>Cookies extracted successfully!</span></div>';
    } catch (err) {
        // Hide loading
        elements.loadingState.classList.add("hidden");

        // Update status
        elements.statusDot.className = "status-dot error";
        elements.statusText.textContent = "Error";

        // Show error message
        elements.message.innerHTML = `<div class="message error"><span class="icon">✗</span><span>${err.message}</span></div>`;
    }
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", async () => {
    // Initialize DOM Elements
    elements = {
        loadingState: document.getElementById("loadingState"),
        result: document.getElementById("result"),
        output: document.getElementById("output"),
        outputValidationError: document.getElementById("outputValidationError"),
        message: document.getElementById("message"),
        copyBtn: document.getElementById("copyBtn"),
        copyText: document.getElementById("copyText"),
        sendBtn: document.getElementById("sendBtn"),
        refreshBtn: document.getElementById("refreshBtn"),
        cookieCount: document.getElementById("cookieCount"),
        statusDot: document.getElementById("statusDot"),
        statusText: document.getElementById("statusText"),
        apiUrl: document.getElementById("apiUrl"),
        testApiBtn: document.getElementById("testApiBtn"),
        apiStatus: document.getElementById("apiStatus"),
        settingsBtn: document.getElementById("settingsBtn"),
        settingsSection: document.getElementById("settingsSection"),
        syncBrowserBtn: document.getElementById("syncBrowserBtn"),
        // Sync Panel elements
        syncPanel: document.getElementById("syncPanel"),
        syncPanelHeader: document.getElementById("syncPanelHeader"),
        syncPanelContent: document.getElementById("syncPanelContent"),
        syncPanelLoading: document.getElementById("syncPanelLoading"),
        syncPanelEmpty: document.getElementById("syncPanelEmpty"),
        accountsList: document.getElementById("accountsList"),
        syncPanelCustom: document.getElementById("syncPanelCustom"),
        customAppstateSection: document.getElementById("customAppstateSection"),
        customAppstateInput: document.getElementById("customAppstateInput"),
        customAppstateError: document.getElementById("customAppstateError"),
        syncPanelLogin: document.getElementById("syncPanelLogin"),
        refreshSyncPanel: document.getElementById("refreshSyncPanel"),
        // Dashboard elements
        dashboardBtn: document.getElementById("dashboardBtn"),
        dashboard: document.getElementById("dashboard"),
        refreshDashboard: document.getElementById("refreshDashboard"),
        dashBotStatus: document.getElementById("dashBotStatus"),
        dashUptime: document.getElementById("dashUptime"),
        dashMessages: document.getElementById("dashMessages"),
        dashCommands: document.getElementById("dashCommands"),
        // Bot Stats elements
        botOnlineStatus: document.getElementById("botOnlineStatus"),
        botOnlineText: document.getElementById("botOnlineText"),
        statMsgTotal: document.getElementById("statMsgTotal"),
        statMsgText: document.getElementById("statMsgText"),
        statMsgAttach: document.getElementById("statMsgAttach"),
        statMsgReact: document.getElementById("statMsgReact"),
        statCmdTotal: document.getElementById("statCmdTotal"),
        statCmdSuccess: document.getElementById("statCmdSuccess"),
        statCmdFailed: document.getElementById("statCmdFailed"),
        statCmdBlocked: document.getElementById("statCmdBlocked"),
        statActiveUsers: document.getElementById("statActiveUsers"),
        statActiveThreads: document.getElementById("statActiveThreads"),
        statEventsTriggered: document.getElementById("statEventsTriggered"),
        statTotalAccounts: document.getElementById("statTotalAccounts"),
        statHeapUsed: document.getElementById("statHeapUsed"),
        statHeapTotal: document.getElementById("statHeapTotal"),
        statRss: document.getElementById("statRss"),
        statNodeVersion: document.getElementById("statNodeVersion"),
        statPlatform: document.getElementById("statPlatform"),
        statStartTime: document.getElementById("statStartTime"),
        topCommandsSection: document.getElementById("topCommandsSection"),
        topCommandsList: document.getElementById("topCommandsList"),
    };

    // Selected account for sync
    let selectedAccountUid = null;

    // Load saved API URL
    await loadApiUrl();

    // Dashboard Button Handler (Info Icon)
    elements.dashboardBtn.addEventListener("click", () => {
        // Toggle dashboard visibility
        const isHidden = elements.dashboard.classList.toggle("hidden");
        elements.dashboardBtn.classList.toggle("active");

        const content = document.querySelector(".content");
        const actionBar = document.querySelector(".action-bar");

        if (!isHidden) {
            // Dashboard is now OPEN - hide cookie extraction UI and action bar
            // Close sync panel if open
            elements.syncPanel.classList.remove("expanded");
            elements.syncBrowserBtn.classList.remove("active");
            content.classList.remove("sync-active");
            actionBar.classList.remove("sync-active");

            elements.result.classList.add("hidden");
            elements.copyBtn.classList.add("hidden");
            elements.sendBtn.classList.add("hidden");
            elements.refreshBtn.classList.add("hidden");
            elements.message.innerHTML = "";
            content.classList.add("dashboard-active");
            actionBar.classList.add("dashboard-active");
            refreshDashboard();
        } else {
            // Dashboard is now CLOSED - restore cookie extraction UI
            content.classList.remove("dashboard-active");
            actionBar.classList.remove("dashboard-active");
            // Always show the result box (for extracted cookies or manual paste)
            elements.result.classList.remove("hidden");
            elements.copyBtn.classList.remove("hidden");
            elements.sendBtn.classList.remove("hidden");
            elements.refreshBtn.classList.remove("hidden");
            // Stop live uptime counter when dashboard is closed
            stopUptimeCounter();
        }
    });

    // Settings Button Handler
    elements.settingsBtn.addEventListener("click", () => {
        elements.settingsSection.classList.toggle("collapsed");
        elements.settingsBtn.classList.toggle("active");
    });

    // Dashboard Refresh Handler
    elements.refreshDashboard.addEventListener("click", () => {
        refreshDashboard();
    });

    // Copy Button Handler
    elements.copyBtn.addEventListener("click", async () => {
        try {
            // Copy from textarea value (allows custom pasted content)
            const cookiesToCopy = elements.output.value || extractedCookiesJSON;
            await navigator.clipboard.writeText(cookiesToCopy);

            // Update button - use SVG version
            elements.copyBtn.classList.add("copied");
            const _svg = elements.copyBtn.querySelector("svg");
            const text = elements.copyText;
            text.textContent = "Copied!";

            // Show success message
            elements.message.innerHTML =
                '<div class="message success"><span class="icon">✓</span><span>Copied to clipboard!</span></div>';

            // Reset button after 2 seconds
            setTimeout(() => {
                elements.copyBtn.classList.remove("copied");
                text.textContent = "Copy to Clipboard";
            }, 2000);
        } catch (err) {
            elements.message.innerHTML = `<div class="message error"><span class="icon">✗</span><span>Copy failed: ${err.message}</span></div>`;
        }
    });

    // Refresh Button Handler
    elements.refreshBtn.addEventListener("click", () => {
        extractCookies();
    });

    // Real-time validation for main cookie output textarea
    elements.output.addEventListener("input", () => {
        validateMainCookieInput();
    });

    // Also validate on paste event for immediate feedback
    elements.output.addEventListener("paste", () => {
        // Small delay to let paste complete
        setTimeout(() => {
            validateMainCookieInput();
        }, 10);
    });

    // Validate main cookie input and show inline error box (same as sync modal)
    function validateMainCookieInput() {
        const input = elements.output.value.trim();
        const errorEl = elements.outputValidationError;
        const inputEl = elements.output;

        // Reset states
        inputEl.classList.remove("error", "valid");
        errorEl.classList.add("hidden");
        errorEl.classList.remove("success");

        // Clear previous validation message if empty
        if (!input) {
            elements.cookieCount.textContent = "0";
            return;
        }

        // Try to parse JSON
        let cookies;
        try {
            const parsed = JSON.parse(input);
            if (Array.isArray(parsed)) {
                cookies = parsed;
            } else if (parsed.cookies && Array.isArray(parsed.cookies)) {
                cookies = parsed.cookies;
            } else {
                throw new Error("Must be an array of cookies or object with cookies array");
            }
        } catch (e) {
            inputEl.classList.add("error");
            errorEl.innerHTML = `<span>✗</span><span>${e.message === "Must be an array of cookies or object with cookies array" ? e.message : "Invalid JSON format - check your syntax"}</span>`;
            errorEl.classList.remove("hidden", "success");
            elements.cookieCount.textContent = "0";
            return;
        }

        // Validate the appstate
        const validation = validateAppstate(cookies);
        elements.cookieCount.textContent = cookies.length;

        if (!validation.valid) {
            inputEl.classList.add("error");
            const errors = validation.errors
                .slice(0, 3)
                .map((e) => `• ${e}`)
                .join("<br>");
            errorEl.innerHTML = `<span>✗</span><div><strong>Invalid appstate:</strong><br>${errors}</div>`;
            errorEl.classList.remove("hidden", "success");
            return;
        }

        // Valid appstate
        inputEl.classList.add("valid");
        const uid = validation.details.uid || "Unknown";
        const cookieCount = validation.details.totalCookies;
        let successMsg = `<span>✓</span><div><strong>Valid appstate</strong><br>UID: ${uid} • ${cookieCount} cookies`;
        if (validation.warnings.length > 0) {
            successMsg += `<br><span style="color:#f59e0b;font-size:10px;">⚠ ${validation.warnings[0]}</span>`;
        }
        successMsg += "</div>";
        errorEl.innerHTML = successMsg;
        errorEl.classList.remove("hidden");
        errorEl.classList.add("success");
    }

    // Send to Nero Button Handler
    elements.sendBtn.addEventListener("click", async () => {
        console.log("Send button clicked");
        try {
            // Get cookies from textarea (allows custom pasted content)
            const cookiesToSend = elements.output.value || extractedCookiesJSON;

            if (!cookiesToSend) {
                throw new Error("No cookies to send. Please extract or paste cookies first.");
            }

            console.log("Preparing to send cookies...");

            // Update button state
            elements.sendBtn.classList.add("sending");
            elements.sendBtn.disabled = true;
            const sendText = elements.sendBtn.querySelector(".button-text");
            if (sendText) {
                sendText.textContent = "Sending...";
            }

            console.log("Sending to:", `${NERO_CONFIG.serverUrl}/api/cookies`);

            // Parse the JSON string to get the array
            let cookiesArray;
            try {
                cookiesArray = JSON.parse(cookiesToSend);
            } catch (_parseErr) {
                throw new Error("Invalid cookie format. Please check your JSON.");
            }

            // Validate appstate before sending
            const validation = validateAppstate(cookiesArray);
            if (!validation.valid) {
                const errorMsg = validation.errors.slice(0, 2).join(", ");
                throw new Error(`Invalid appstate: ${errorMsg}`);
            }

            console.log("Sending validated cookies array:", cookiesArray);

            // Send cookies to Nero API
            let response;
            try {
                response = await fetch(`${NERO_CONFIG.serverUrl}/api/cookies`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-API-Key": NERO_CONFIG.apiKey,
                    },
                    body: JSON.stringify({
                        cookies: cookiesArray,
                    }),
                });
            } catch (fetchErr) {
                console.error("Network error:", fetchErr);
                throw new Error(
                    `Cannot connect to server. Make sure Nero is running on ${NERO_CONFIG.serverUrl}`
                );
            }

            console.log("Response status:", response.status);

            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}`;
                try {
                    const errorData = await response.json();
                    console.error("Error response:", errorData);

                    // Extract error message from various possible formats
                    if (errorData.error) {
                        if (typeof errorData.error === "string") {
                            errorMessage = errorData.error;
                        } else if (errorData.error.message) {
                            errorMessage = errorData.error.message;
                        } else {
                            errorMessage = JSON.stringify(errorData.error);
                        }
                    } else if (errorData.message) {
                        errorMessage = errorData.message;
                    }
                } catch (parseErr) {
                    console.error("Failed to parse error response:", parseErr);
                }
                throw new Error(errorMessage);
            }

            const result = await response.json();
            console.log("Success:", result);

            // Update button to success state
            elements.sendBtn.classList.remove("sending");
            elements.sendBtn.classList.add("success");
            if (sendText) {
                sendText.textContent = "Sent Successfully!";
            }

            // Show success message
            elements.message.innerHTML =
                '<div class="message success"><span class="icon">✓</span><span>Cookies sent to Nero! Bot will restart automatically.</span></div>';

            // Reset button after 3 seconds
            setTimeout(() => {
                elements.sendBtn.classList.remove("success");
                elements.sendBtn.disabled = false;
                if (sendText) {
                    sendText.textContent = "Send to Nero";
                }
            }, 3000);
        } catch (err) {
            console.error("Send failed:", err);

            // Reset button state
            elements.sendBtn.classList.remove("sending");
            elements.sendBtn.disabled = false;
            const sendText = elements.sendBtn.querySelector(".button-text");
            if (sendText) {
                sendText.textContent = "Send to Nero";
            }

            // Show error message
            elements.message.innerHTML = `<div class="message error"><span class="icon">✗</span><span>Failed to send: ${err.message}</span></div>`;
        }
    });

    // Test API Button Handler
    elements.testApiBtn.addEventListener("click", async () => {
        try {
            const url = elements.apiUrl.value.trim();

            if (!url) {
                elements.apiStatus.className = "api-status error";
                elements.apiStatus.textContent = "✗ Please enter an API URL";
                elements.apiStatus.classList.remove("hidden");
                return;
            }

            // Validate URL format
            try {
                new URL(url);
            } catch {
                elements.apiStatus.className = "api-status error";
                elements.apiStatus.textContent = "✗ Invalid URL format";
                elements.apiStatus.classList.remove("hidden");
                return;
            }

            // Update button state
            elements.testApiBtn.classList.add("testing");
            elements.testApiBtn.disabled = true;
            const btnText = elements.testApiBtn.querySelector(".button-text");
            if (btnText) {
                btnText.textContent = "Testing...";
            }

            // Hide previous status
            elements.apiStatus.classList.add("hidden");

            // Test connection
            const result = await testApiConnection(url);

            // Save URL if connection successful
            await saveApiUrl(url);

            // Show success
            elements.apiStatus.className = "api-status success";
            elements.apiStatus.textContent = `✓ Connected successfully! Bot is ${result.data.status || "online"}`;
            elements.apiStatus.classList.remove("hidden");

            // Update button
            elements.testApiBtn.classList.remove("testing");
            elements.testApiBtn.classList.add("success");
            if (btnText) {
                btnText.textContent = "Connected";
            }

            // Reset button after 2 seconds
            setTimeout(() => {
                elements.testApiBtn.classList.remove("success");
                elements.testApiBtn.disabled = false;
                if (btnText) {
                    btnText.textContent = "Test";
                }
            }, 2000);
        } catch (err) {
            console.error("API test failed:", err);

            // Show error
            elements.apiStatus.className = "api-status error";
            elements.apiStatus.textContent = `✗ ${err.message}`;
            elements.apiStatus.classList.remove("hidden");

            // Reset button
            elements.testApiBtn.classList.remove("testing");
            elements.testApiBtn.disabled = false;
            const btnText = elements.testApiBtn.querySelector(".button-text");
            if (btnText) {
                btnText.textContent = "Test";
            }
        }
    });

    // Update API URL on input change
    elements.apiUrl.addEventListener("input", () => {
        elements.apiStatus.classList.add("hidden");
    });

    // === SYNC PANEL FUNCTIONS ===

    let isCustomMode = false;

    // Toggle sync panel and load accounts
    async function toggleSyncPanel() {
        const isExpanded = elements.syncPanel.classList.toggle("expanded");
        elements.syncBrowserBtn.classList.toggle("active");
        const content = document.querySelector(".content");
        const actionBar = document.querySelector(".action-bar");

        if (isExpanded) {
            // Panel is now open - hide content and action bar
            content.classList.add("sync-active");
            actionBar.classList.add("sync-active");
            // Close dashboard if open
            elements.dashboard.classList.add("hidden");
            elements.dashboardBtn.classList.remove("active");
            content.classList.remove("dashboard-active");
            actionBar.classList.remove("dashboard-active");
            stopUptimeCounter();
            // Load accounts
            loadSyncAccounts();
        } else {
            // Panel is now closed - restore content and action bar
            content.classList.remove("sync-active");
            actionBar.classList.remove("sync-active");
            selectedAccountUid = null;
            isCustomMode = false;
        }
    }

    // Load accounts into sync panel
    async function loadSyncAccounts() {
        selectedAccountUid = null;
        isCustomMode = false;
        elements.syncPanelLogin.disabled = true;

        // Reset custom mode UI
        elements.customAppstateSection.classList.add("hidden");
        elements.customAppstateInput.value = "";
        elements.syncPanelCustom.classList.remove("active");
        elements.syncPanelCustom.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
      </svg>
      Custom
    `;

        // Show loading state
        elements.syncPanelLoading.classList.remove("hidden");
        elements.syncPanelEmpty.classList.add("hidden");
        elements.accountsList.classList.add("hidden");

        try {
            // Fetch accounts from unified stats endpoint
            const response = await fetch(`${NERO_CONFIG.serverUrl}/api/stats`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": NERO_CONFIG.apiKey,
                },
            });

            if (!response.ok) {
                throw new Error("Failed to fetch accounts");
            }

            const data = await response.json();

            elements.syncPanelLoading.classList.add("hidden");

            // Handle new API format: accounts.list contains the array
            const accountsList = data.accounts?.list || data.accounts || [];

            if (!data.success || !accountsList || accountsList.length === 0) {
                elements.syncPanelEmpty.classList.remove("hidden");
                return;
            }

            // Render accounts list
            renderAccountsList(accountsList);
            elements.accountsList.classList.remove("hidden");
        } catch (error) {
            console.error("Failed to load accounts:", error);
            elements.syncPanelLoading.classList.add("hidden");
            elements.syncPanelEmpty.classList.remove("hidden");
            elements.syncPanelEmpty.innerHTML = `
        <div class="sync-empty-icon">⚠️</div>
        <div>Failed to load accounts</div>
        <div style="font-size: 10px; margin-top: 3px; color: #ef4444;">${error.message}</div>
      `;
        }
    }

    // Render accounts list
    function renderAccountsList(accounts) {
        elements.accountsList.innerHTML = accounts
            .map((account) => {
                const uid = account.uid || account.filename?.replace(".json", "") || "Unknown";
                const name = account.name || null;
                const _displayName = name || uid;
                const profilePicUrl =
                    account.profilePicUrl ||
                    `https://graph.facebook.com/${uid}/picture?width=100&height=100&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
                const _statusClass =
                    account.status === "online" ? "status-online" : "status-offline";
                const statusDot = account.status === "online" ? "🟢" : "⚪";
                return `
      <div class="account-item" data-uid="${uid}">
        <div class="account-avatar" style="background-image: url('${profilePicUrl}'); background-size: cover; background-position: center;"></div>
        <div class="account-info">
          <div class="account-uid">${name ? `<strong>${name}</strong>` : uid}</div>
          <div class="account-meta">${statusDot} ${account.filename || uid + ".json"}</div>
        </div>
        <div class="account-check">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      </div>
    `;
            })
            .join("");

        // Add click handlers to account items
        document.querySelectorAll(".account-item").forEach((item) => {
            item.addEventListener("click", () => {
                // Remove selection from all items
                document
                    .querySelectorAll(".account-item")
                    .forEach((i) => i.classList.remove("selected"));
                // Select this item
                item.classList.add("selected");
                selectedAccountUid = item.dataset.uid;
                elements.syncPanelLogin.disabled = false;
            });
        });
    }

    // Close sync panel
    function closeSyncPanel() {
        elements.syncPanel.classList.remove("expanded");
        elements.syncBrowserBtn.classList.remove("active");
        selectedAccountUid = null;
        isCustomMode = false;
    }

    // Toggle custom appstate mode
    function toggleCustomMode() {
        isCustomMode = !isCustomMode;

        if (isCustomMode) {
            // Show custom input, hide accounts list and header
            elements.syncPanelHeader.classList.add("hidden");
            elements.syncPanelLoading.classList.add("hidden");
            elements.syncPanelEmpty.classList.add("hidden");
            elements.accountsList.classList.add("hidden");
            elements.customAppstateSection.classList.remove("hidden");
            elements.syncPanelContent.classList.add("custom-mode");
            elements.syncPanelCustom.classList.add("active");
            elements.syncPanelCustom.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back
      `;
            // Reset validation state and disable login until valid input
            elements.customAppstateInput.classList.remove("error", "valid");
            elements.customAppstateError.classList.add("hidden");
            elements.syncPanelLogin.disabled = true;
            selectedAccountUid = null;
        } else {
            // Go back to accounts list, show header
            elements.syncPanelHeader.classList.remove("hidden");
            elements.customAppstateSection.classList.add("hidden");
            elements.syncPanelContent.classList.remove("custom-mode");
            elements.customAppstateInput.value = "";
            // Reset validation state
            elements.customAppstateInput.classList.remove("error", "valid");
            elements.customAppstateError.classList.add("hidden");
            elements.syncPanelCustom.classList.remove("active");
            elements.syncPanelCustom.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
        Custom
      `;
            elements.syncPanelLogin.disabled = !selectedAccountUid;
            // Reload accounts list
            loadSyncAccounts();
        }
    }

    // Perform login with selected account or custom appstate
    async function performLogin() {
        let cookies = [];
        let loginIdentifier = "";

        // Check if using custom appstate mode
        if (isCustomMode) {
            const customInput = elements.customAppstateInput.value.trim();
            if (!customInput) {
                showSyncNotification("error", "✗ Please paste your appstate JSON", 3000);
                return;
            }

            try {
                const parsed = JSON.parse(customInput);
                // Support both array format and object with cookies array
                if (Array.isArray(parsed)) {
                    cookies = parsed;
                } else if (parsed.cookies && Array.isArray(parsed.cookies)) {
                    cookies = parsed.cookies;
                } else {
                    throw new Error("Invalid format - must be an array of cookies");
                }

                // Validate appstate before proceeding
                const validation = validateAppstate(cookies);
                if (!validation.valid) {
                    const errorMsg = validation.errors.slice(0, 2).join(", ");
                    showSyncNotification("error", `✗ Invalid appstate: ${errorMsg}`, 4000);
                    return;
                }

                loginIdentifier = validation.details.uid
                    ? `UID: ${validation.details.uid}`
                    : "Custom Appstate";
            } catch (e) {
                showSyncNotification("error", `✗ ${e.message || "Invalid JSON format"}`, 3000);
                return;
            }
        } else {
            // Using selected account
            if (!selectedAccountUid) return;
            loginIdentifier = selectedAccountUid;

            try {
                // Fetch cookies for selected account
                const response = await fetch(
                    `${NERO_CONFIG.serverUrl}/api/cookies/appstate?uid=${selectedAccountUid}`,
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                            "x-api-key": NERO_CONFIG.apiKey,
                        },
                    }
                );

                if (!response.ok) {
                    throw new Error("Failed to fetch cookies");
                }

                const data = await response.json();

                // Handle both 'appstate' and 'cookies' keys from API response
                const cookiesData = data.appstate || data.cookies;
                if (!data.success || !cookiesData || cookiesData.length === 0) {
                    throw new Error("No cookies found");
                }

                cookies = cookiesData;
            } catch (error) {
                console.error("Login failed:", error);
                showSyncNotification("error", `✗ ${error.message}`, 4000);
                return;
            }
        }

        elements.syncPanelLogin.disabled = true;
        elements.syncPanelLogin.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin-icon">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      Logging in...
    `;

        try {
            // Inject cookies into browser
            let successCount = 0;
            for (const cookie of cookies) {
                try {
                    const cookieName = cookie.key || cookie.name;
                    let domain = cookie.domain || ".facebook.com";
                    if (!domain.startsWith(".")) domain = "." + domain;

                    const url = "https://www.facebook.com";

                    const cookieDetails = {
                        url: url,
                        name: cookieName,
                        value: cookie.value,
                        domain: domain,
                        path: cookie.path || "/",
                        secure: true,
                        httpOnly: cookie.httpOnly || false,
                        sameSite: "no_restriction",
                    };

                    if (cookie.expires && cookie.expires !== "-1" && cookie.expires !== -1) {
                        const expirationDate = parseInt(cookie.expires);
                        if (!isNaN(expirationDate) && expirationDate > 0) {
                            cookieDetails.expirationDate = expirationDate;
                        }
                    }

                    await chrome.cookies.set(cookieDetails);
                    successCount++;
                } catch (e) {
                    console.error("Cookie set failed:", e);
                }
            }

            closeSyncPanel();

            if (successCount > 0) {
                showSyncNotification(
                    "success",
                    `✓ Logged in with ${loginIdentifier}! Opening Facebook...`,
                    3000
                );
                chrome.tabs.create({ url: "https://www.facebook.com", active: true });
            } else {
                showSyncNotification("error", "✗ Failed to set cookies", 3000);
            }
        } catch (error) {
            console.error("Login failed:", error);
            showSyncNotification("error", `✗ Login failed: ${error.message}`, 4000);

            elements.syncPanelLogin.disabled = false;
            elements.syncPanelLogin.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
          <polyline points="10 17 15 12 10 7"></polyline>
          <line x1="15" y1="12" x2="3" y2="12"></line>
        </svg>
        Login to Facebook
      `;
        }
    }

    // Sync Button Handler - Toggle panel
    elements.syncBrowserBtn.addEventListener("click", toggleSyncPanel);

    // Custom button and refresh handlers
    elements.syncPanelCustom.addEventListener("click", toggleCustomMode);
    elements.refreshSyncPanel.addEventListener("click", loadSyncAccounts);

    // Login button handler
    elements.syncPanelLogin.addEventListener("click", performLogin);

    // Real-time validation for custom appstate input
    elements.customAppstateInput.addEventListener("input", () => {
        validateCustomAppstateInput();
    });

    // Validate custom appstate input and show inline error/success
    function validateCustomAppstateInput() {
        const input = elements.customAppstateInput.value.trim();
        const errorEl = elements.customAppstateError;
        const inputEl = elements.customAppstateInput;

        // Reset states
        inputEl.classList.remove("error", "valid");
        errorEl.classList.add("hidden");
        errorEl.classList.remove("success");
        elements.syncPanelLogin.disabled = true;

        if (!input) {
            return;
        }

        // Try to parse JSON
        let cookies;
        try {
            const parsed = JSON.parse(input);
            if (Array.isArray(parsed)) {
                cookies = parsed;
            } else if (parsed.cookies && Array.isArray(parsed.cookies)) {
                cookies = parsed.cookies;
            } else {
                throw new Error("Must be an array of cookies or object with cookies array");
            }
        } catch (e) {
            inputEl.classList.add("error");
            errorEl.innerHTML = `<span>✗</span><span>${e.message === "Must be an array of cookies or object with cookies array" ? e.message : "Invalid JSON format - check your syntax"}</span>`;
            errorEl.classList.remove("hidden", "success");
            return;
        }

        // Validate the appstate
        const validation = validateAppstate(cookies);

        if (!validation.valid) {
            inputEl.classList.add("error");
            const errors = validation.errors
                .slice(0, 3)
                .map((e) => `• ${e}`)
                .join("<br>");
            errorEl.innerHTML = `<span>✗</span><div><strong>Invalid appstate:</strong><br>${errors}</div>`;
            errorEl.classList.remove("hidden", "success");
            return;
        }

        // Valid appstate
        inputEl.classList.add("valid");
        const uid = validation.details.uid || "Unknown";
        const cookieCount = validation.details.totalCookies;
        let successMsg = `<span>✓</span><div><strong>Valid appstate</strong><br>UID: ${uid} • ${cookieCount} cookies`;
        if (validation.warnings.length > 0) {
            successMsg += `<br><span style="color:#f59e0b;font-size:10px;">⚠ ${validation.warnings[0]}</span>`;
        }
        successMsg += "</div>";
        errorEl.innerHTML = successMsg;
        errorEl.classList.remove("hidden");
        errorEl.classList.add("success");
        elements.syncPanelLogin.disabled = false;
    }

    // Auto-extract on popup open
    extractCookies();
});

// Show sync notification helper
function showSyncNotification(type, message, duration = 3000) {
    const notification = document.getElementById("syncNotification");
    const icon = document.getElementById("syncNotifIcon");
    const text = document.getElementById("syncNotifText");

    // Update icon based on type
    if (type === "success") {
        icon.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
    } else if (type === "error") {
        icon.innerHTML =
            '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>';
    } else if (type === "info") {
        icon.innerHTML =
            '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>';
    }

    // Update text and show notification
    text.textContent = message;
    notification.className = `sync-notification ${type} show`;

    // Auto-hide after duration
    if (duration > 0) {
        setTimeout(() => {
            notification.classList.remove("show");
        }, duration);
    }
}
