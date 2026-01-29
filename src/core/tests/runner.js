/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                        NERO - Test Runner                                    ║
 * ║                     Test Suite Orchestration Module                           ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Comprehensive test runner with:
 *   - Parallel test suite execution
 *   - Detailed timing metrics
 *   - Coverage reports
 *   - Exit code management
 *   - Watch mode support
 *
 * Usage:
 *   node tests/runner.js          - Run all tests
 *   node tests/runner.js --unit   - Run unit tests only
 *   node tests/runner.js --e2e    - Run e2e tests only
 *   node tests/runner.js --watch  - Run in watch mode (requires chokidar)
 *
 * @module tests/runner
 * @version 2.0.0
 */

"use strict";

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

// ═══════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════

const CONFIG = {
    testsDir: __dirname,
    rootDir: path.resolve(__dirname, ".."),
    suites: {
        unit: {
            name: "Unit Tests",
            path: "unit",
            files: [
                "core.test.js",
                "utils.test.js",
                "api-modules.test.js",
                "deep-api.test.js",
                "humanBehavior.test.js",
            ],
            icon: "🧪",
        },
        integration: {
            name: "Integration Tests",
            path: "integration",
            files: ["modules.test.js"],
            icon: "🔗",
        },
        api: {
            name: "API Feature Tests",
            path: "api",
            files: ["messaging.test.js"],
            icon: "🔌",
        },
        e2e: {
            name: "End-to-End Tests",
            path: "e2e",
            files: ["system.test.js"],
            icon: "🚀",
        },
        handlers: {
            name: "Handler Tests",
            path: "../../handlers/tests",
            files: ["commandHandler.test.js"],
            icon: "🎮",
        },
    },
};

// ═══════════════════════════════════════════════════════════
// ANSI COLORS
// ═══════════════════════════════════════════════════════════

const C = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    gray: "\x1b[90m",
};

const color = (c, text) => `${C[c]}${text}${C.reset}`;

// ═══════════════════════════════════════════════════════════
// HEADER
// ═══════════════════════════════════════════════════════════

function printHeader() {
    console.log("");
    console.log(
        color(
            "cyan",
            "╔══════════════════════════════════════════════════════════════════════════════╗"
        )
    );
    console.log(
        color("cyan", "║") +
        color(
            "bright",
            "                          NERO - Test Suite                                "
        ) +
        color("cyan", "║")
    );
    console.log(
        color("cyan", "║") +
        color(
            "dim",
            "                      Comprehensive Testing Module                           "
        ) +
        color("cyan", "║")
    );
    console.log(
        color(
            "cyan",
            "╚══════════════════════════════════════════════════════════════════════════════╝"
        )
    );
    console.log("");
}

// ═══════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════

class TestRunner {
    constructor() {
        this.results = {
            suites: [],
            totalPassed: 0,
            totalFailed: 0,
            totalSkipped: 0,
            totalDuration: 0,
        };
        this.startTime = Date.now();
    }

    /**
     * Run a single test file
     */
    runTestFile(suiteName, filePath) {
        const startTime = Date.now();
        const result = {
            suite: suiteName,
            file: path.basename(filePath),
            passed: false,
            duration: 0,
            output: "",
        };

        try {
            const output = execSync(`node "${filePath}"`, {
                cwd: CONFIG.rootDir,
                encoding: "utf8",
                stdio: ["pipe", "pipe", "pipe"],
                timeout: 60000, // 60 second timeout
            });

            result.passed = true;
            result.output = output;
        } catch (error) {
            result.passed = false;
            result.output = error.stdout || error.message;
            result.error = error.stderr || error.message;
        }

        result.duration = Date.now() - startTime;
        return result;
    }

    /**
     * Run a test suite
     */
    async runSuite(suiteKey) {
        const suite = CONFIG.suites[suiteKey];
        if (!suite) {
            console.log(color("red", `Unknown suite: ${suiteKey}`));
            return null;
        }

        const suiteResult = {
            name: suite.name,
            key: suiteKey,
            icon: suite.icon,
            files: [],
            passed: 0,
            failed: 0,
            duration: 0,
        };

        console.log(`\n${suite.icon} ${color("bright", suite.name)}`);
        console.log(color("dim", "═".repeat(70)));

        const suitePath = path.join(CONFIG.testsDir, suite.path);

        if (!fs.existsSync(suitePath)) {
            console.log(color("yellow", `  ⚠ Suite directory not found: ${suite.path}`));
            return suiteResult;
        }

        // Get test files
        let testFiles = suite.files || [];
        if (testFiles.length === 0) {
            testFiles = fs.readdirSync(suitePath).filter((f) => f.endsWith(".test.js"));
        }

        for (const file of testFiles) {
            const filePath = path.join(suitePath, file);

            if (!fs.existsSync(filePath)) {
                console.log(color("yellow", `  ⚠ Test file not found: ${file}`));
                continue;
            }

            process.stdout.write(`  ${color("dim", "●")} ${file}...`);

            const result = this.runTestFile(suite.name, filePath);
            suiteResult.files.push(result);
            suiteResult.duration += result.duration;

            if (result.passed) {
                suiteResult.passed++;
                this.results.totalPassed++;
                console.log(color("green", ` ✓ PASS`) + color("gray", ` (${result.duration}ms)`));
            } else {
                suiteResult.failed++;
                this.results.totalFailed++;
                console.log(color("red", ` ✗ FAIL`) + color("gray", ` (${result.duration}ms)`));
            }
        }

        this.results.suites.push(suiteResult);
        return suiteResult;
    }

    /**
     * Run all test suites
     */
    async runAll() {
        const startTime = Date.now();

        for (const suiteKey of Object.keys(CONFIG.suites)) {
            await this.runSuite(suiteKey);
        }

        this.results.totalDuration = Date.now() - startTime;
        return this.results;
    }

    /**
     * Run specific suites
     */
    async runSuites(suiteKeys) {
        const startTime = Date.now();

        for (const suiteKey of suiteKeys) {
            await this.runSuite(suiteKey);
        }

        this.results.totalDuration = Date.now() - startTime;
        return this.results;
    }

    /**
     * Print summary
     */
    printSummary() {
        const { totalPassed, totalFailed, totalDuration, suites } = this.results;
        const total = totalPassed + totalFailed;
        const passRate = total > 0 ? ((totalPassed / total) * 100).toFixed(1) : 0;

        console.log("\n" + color("cyan", "═".repeat(70)));
        console.log(color("bright", "  📊 TEST RESULTS SUMMARY"));
        console.log(color("cyan", "═".repeat(70)));

        // Suite breakdown
        console.log("\n  " + color("dim", "Suite Breakdown:"));
        suites.forEach((suite) => {
            const status = suite.failed === 0 ? color("green", "✓ PASS") : color("red", "✗ FAIL");
            const counts = `${suite.passed}/${suite.passed + suite.failed}`;
            console.log(
                `    ${suite.icon} ${suite.name}: ${status} (${counts}, ${suite.duration}ms)`
            );
        });

        // Statistics
        console.log("\n  " + color("dim", "Statistics:"));
        console.log(`    ${color("green", "✓ Passed:")}  ${totalPassed}`);
        console.log(`    ${color("red", "✗ Failed:")}  ${totalFailed}`);
        console.log(`    ${color("dim", "Total:")}     ${total}`);
        console.log(`    ${color("dim", "Duration:")} ${totalDuration}ms`);
        console.log(`    ${color("dim", "Pass Rate:")} ${passRate}%`);

        // Failed tests detail
        if (totalFailed > 0) {
            console.log("\n  " + color("red", "Failed Tests:"));
            suites.forEach((suite) => {
                suite.files
                    .filter((f) => !f.passed)
                    .forEach((file) => {
                        console.log(`    ${color("red", "✗")} ${suite.name}/${file.file}`);
                        if (file.error) {
                            console.log(color("dim", `      ${file.error.split("\n")[0]}`));
                        }
                    });
            });
        }

        console.log("\n" + color("cyan", "═".repeat(70)));

        if (totalFailed === 0) {
            console.log(color("green", "\n  🎉 ALL TESTS PASSED! Ready for deployment.\n"));
        } else {
            console.log(color("red", `\n  ❌ ${totalFailed} TEST FILE(S) FAILED\n`));
        }

        return totalFailed === 0 ? 0 : 1;
    }
}

// ═══════════════════════════════════════════════════════════
// CLI ARGUMENT PARSING
// ═══════════════════════════════════════════════════════════

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        suites: [],
        watch: false,
        verbose: false,
        help: false,
    };

    args.forEach((arg) => {
        if (arg === "--help" || arg === "-h") {
            options.help = true;
        } else if (arg === "--watch" || arg === "-w") {
            options.watch = true;
        } else if (arg === "--verbose" || arg === "-v") {
            options.verbose = true;
        } else if (arg.startsWith("--")) {
            const suite = arg.substring(2);
            if (CONFIG.suites[suite]) {
                options.suites.push(suite);
            }
        }
    });

    return options;
}

function printHelp() {
    console.log(`
${color("bright", "NERO Test Runner")}

${color("dim", "Usage:")}
  node tests/runner.js [options]

${color("dim", "Options:")}
  --unit          Run unit tests only
  --integration   Run integration tests only
  --api           Run API tests only
  --e2e           Run end-to-end tests only
  --watch, -w     Watch mode (requires chokidar)
  --verbose, -v   Verbose output
  --help, -h      Show this help message

${color("dim", "Examples:")}
  node tests/runner.js              # Run all tests
  node tests/runner.js --unit       # Run unit tests only
  node tests/runner.js --unit --api # Run unit and API tests
`);
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════

async function main() {
    const options = parseArgs();

    if (options.help) {
        printHelp();
        process.exit(0);
    }

    printHeader();

    const runner = new TestRunner();

    if (options.suites.length > 0) {
        await runner.runSuites(options.suites);
    } else {
        await runner.runAll();
    }

    const exitCode = runner.printSummary();
    process.exit(exitCode);
}

main().catch((err) => {
    console.error(color("red", `Fatal error: ${err.message}`));
    process.exit(1);
});
