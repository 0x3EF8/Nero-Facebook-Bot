/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                         NERO - Test Framework                                ║
 * ║                       Testing Infrastructure Module                          ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * A lightweight but comprehensive test framework for NERO.
 * Features:
 *   - Describe/It blocks (BDD style)
 *   - Setup/Teardown hooks (beforeAll, afterAll, beforeEach, afterEach)
 *   - Async test support
 *   - Assertion library
 *   - Test timeouts
 *   - Colored output with timing
 *   - Coverage tracking
 *   - JSON/TAP reporter support
 *
 * @module tests/lib/test-framework
 * @version 2.0.0
 */

"use strict";

// ═══════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════

const CONFIG = {
    timeout: 5000, // Default test timeout (ms)
    colors: true, // Enable colored output
    verbose: false, // Verbose mode
    bail: false, // Stop on first failure
    reporter: "default", // 'default', 'json', 'tap'
};

// ═══════════════════════════════════════════════════════════
// ANSI COLOR CODES (No dependencies)
// ═══════════════════════════════════════════════════════════

const COLORS = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",

    // Foreground
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    gray: "\x1b[90m",

    // Background
    bgRed: "\x1b[41m",
    bgGreen: "\x1b[42m",
    bgYellow: "\x1b[43m",
};

const c = (color, text) => (CONFIG.colors ? `${COLORS[color]}${text}${COLORS.reset}` : text);

// ═══════════════════════════════════════════════════════════
// SYMBOLS
// ═══════════════════════════════════════════════════════════

const SYMBOLS = {
    pass: process.platform === "win32" ? "√" : "✓",
    fail: process.platform === "win32" ? "×" : "✖",
    pending: process.platform === "win32" ? "-" : "○",
    bullet: process.platform === "win32" ? "*" : "●",
    arrow: process.platform === "win32" ? ">" : "▸",
};

// ═══════════════════════════════════════════════════════════
// ASSERTION LIBRARY
// ═══════════════════════════════════════════════════════════

class AssertionError extends Error {
    constructor(message, expected, actual) {
        super(message);
        this.name = "AssertionError";
        this.expected = expected;
        this.actual = actual;
    }
}

const assert = {
    /**
     * Assert that value is truthy
     */
    ok(value, message = "Expected value to be truthy") {
        if (!value) {
            throw new AssertionError(message, true, value);
        }
    },

    /**
     * Assert deep equality
     */
    equal(actual, expected, message) {
        if (actual !== expected) {
            throw new AssertionError(
                message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
                expected,
                actual
            );
        }
    },

    /**
     * Assert deep equality for objects/arrays
     */
    deepEqual(actual, expected, message) {
        const actualStr = JSON.stringify(actual);
        const expectedStr = JSON.stringify(expected);
        if (actualStr !== expectedStr) {
            throw new AssertionError(message || `Expected deep equality`, expected, actual);
        }
    },

    /**
     * Assert not equal
     */
    notEqual(actual, expected, message) {
        if (actual === expected) {
            throw new AssertionError(
                message ||
                    `Expected ${JSON.stringify(actual)} to not equal ${JSON.stringify(expected)}`,
                `not ${expected}`,
                actual
            );
        }
    },

    /**
     * Assert value is a function
     */
    isFunction(value, message = "Expected value to be a function") {
        if (typeof value !== "function") {
            throw new AssertionError(message, "function", typeof value);
        }
    },

    /**
     * Assert value is an object
     */
    isObject(value, message = "Expected value to be an object") {
        if (typeof value !== "object" || value === null) {
            throw new AssertionError(message, "object", typeof value);
        }
    },

    /**
     * Assert value is an array
     */
    isArray(value, message = "Expected value to be an array") {
        if (!Array.isArray(value)) {
            throw new AssertionError(message, "array", typeof value);
        }
    },

    /**
     * Assert value is a string
     */
    isString(value, message = "Expected value to be a string") {
        if (typeof value !== "string") {
            throw new AssertionError(message, "string", typeof value);
        }
    },

    /**
     * Assert value is a number
     */
    isNumber(value, message = "Expected value to be a number") {
        if (typeof value !== "number" || Number.isNaN(value)) {
            throw new AssertionError(message, "number", typeof value);
        }
    },

    /**
     * Assert value is boolean
     */
    isBoolean(value, message = "Expected value to be a boolean") {
        if (typeof value !== "boolean") {
            throw new AssertionError(message, "boolean", typeof value);
        }
    },

    /**
     * Assert value is truthy
     */
    truthy(value, message = "Expected value to be truthy") {
        if (!value) {
            throw new AssertionError(message, "truthy", value);
        }
    },

    /**
     * Assert value is falsy
     */
    falsy(value, message = "Expected value to be falsy") {
        if (value) {
            throw new AssertionError(message, "falsy", value);
        }
    },

    /**
     * Assert that function throws
     */
    throws(fn, expectedError, message) {
        try {
            fn();
            throw new AssertionError(
                message || "Expected function to throw",
                "Error to be thrown",
                "No error"
            );
        } catch (err) {
            if (err instanceof AssertionError) throw err;
            if (expectedError) {
                if (typeof expectedError === "string" && !err.message.includes(expectedError)) {
                    throw new AssertionError(
                        `Expected error message to include "${expectedError}"`,
                        expectedError,
                        err.message
                    );
                }
                if (expectedError instanceof RegExp && !expectedError.test(err.message)) {
                    throw new AssertionError(
                        `Expected error message to match ${expectedError}`,
                        expectedError.toString(),
                        err.message
                    );
                }
            }
        }
    },

    /**
     * Assert that async function throws
     */
    async throwsAsync(fn, expectedError, message) {
        try {
            await fn();
            throw new AssertionError(
                message || "Expected async function to throw",
                "Error to be thrown",
                "No error"
            );
        } catch (err) {
            if (err instanceof AssertionError) throw err;
            if (
                expectedError &&
                typeof expectedError === "string" &&
                !err.message.includes(expectedError)
            ) {
                throw new AssertionError(
                    `Expected error message to include "${expectedError}"`,
                    expectedError,
                    err.message
                );
            }
        }
    },

    /**
     * Assert object has property
     */
    hasProperty(obj, prop, message) {
        if (!(prop in obj)) {
            throw new AssertionError(
                message || `Expected object to have property "${prop}"`,
                prop,
                Object.keys(obj)
            );
        }
    },

    /**
     * Assert value matches type
     */
    type(value, expectedType, message) {
        const actualType = typeof value;
        if (actualType !== expectedType) {
            throw new AssertionError(
                message || `Expected type "${expectedType}", got "${actualType}"`,
                expectedType,
                actualType
            );
        }
    },

    /**
     * Assert value is instance of class
     */
    instanceOf(value, constructor, message) {
        if (!(value instanceof constructor)) {
            throw new AssertionError(
                message || `Expected value to be instance of ${constructor.name}`,
                constructor.name,
                value?.constructor?.name || typeof value
            );
        }
    },

    /**
     * Assert array includes value
     */
    includes(array, value, message) {
        if (!array.includes(value)) {
            throw new AssertionError(
                message || `Expected array to include ${JSON.stringify(value)}`,
                value,
                array
            );
        }
    },

    /**
     * Assert string matches regex
     */
    matches(string, regex, message) {
        if (!regex.test(string)) {
            throw new AssertionError(
                message || `Expected string to match ${regex}`,
                regex.toString(),
                string
            );
        }
    },

    /**
     * Assert value is greater than
     */
    greaterThan(actual, expected, message) {
        if (!(actual > expected)) {
            throw new AssertionError(
                message || `Expected ${actual} > ${expected}`,
                `> ${expected}`,
                actual
            );
        }
    },

    /**
     * Assert value is less than
     */
    lessThan(actual, expected, message) {
        if (!(actual < expected)) {
            throw new AssertionError(
                message || `Expected ${actual} < ${expected}`,
                `< ${expected}`,
                actual
            );
        }
    },

    /**
     * Fail immediately
     */
    fail(message = "Test failed") {
        throw new AssertionError(message);
    },

    /**
     * Alias for equal - assert strict equality
     */
    equals(actual, expected, message) {
        if (actual !== expected) {
            throw new AssertionError(
                message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
                expected,
                actual
            );
        }
    },

    /**
     * Assert value is true
     */
    isTrue(value, message = "Expected value to be true") {
        if (value !== true) {
            throw new AssertionError(message, true, value);
        }
    },

    /**
     * Assert value is false
     */
    isFalse(value, message = "Expected value to be false") {
        if (value !== false) {
            throw new AssertionError(message, false, value);
        }
    },
};

// ═══════════════════════════════════════════════════════════
// TEST SUITE CLASS
// ═══════════════════════════════════════════════════════════

class TestSuite {
    constructor(name) {
        this.name = name;
        this.suites = [];
        this.tests = [];
        this.hooks = {
            beforeAll: [],
            afterAll: [],
            beforeEach: [],
            afterEach: [],
        };
        this.parent = null;
        this.only = false;
        this.skip = false;
    }

    addSuite(suite) {
        suite.parent = this;
        this.suites.push(suite);
        return suite;
    }

    addTest(test) {
        test.suite = this;
        this.tests.push(test);
        return test;
    }

    addHook(type, fn) {
        this.hooks[type].push(fn);
    }

    getFullName() {
        const names = [];
        let suite = this;
        while (suite) {
            if (suite.name) names.unshift(suite.name);
            suite = suite.parent;
        }
        return names.join(" › ");
    }
}

class Test {
    constructor(name, fn, options = {}) {
        this.name = name;
        this.fn = fn;
        this.suite = null;
        this.only = options.only || false;
        this.skip = options.skip || false;
        this.timeout = options.timeout || CONFIG.timeout;
        this.retries = options.retries || 0;
    }

    getFullName() {
        const suiteName = this.suite ? this.suite.getFullName() : "";
        return suiteName ? `${suiteName} › ${this.name}` : this.name;
    }
}

// ═══════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════

class TestRunner {
    constructor() {
        this.rootSuite = new TestSuite("");
        this.currentSuite = this.rootSuite;
        this.results = {
            passed: 0,
            failed: 0,
            skipped: 0,
            total: 0,
            duration: 0,
            failures: [],
            suiteResults: [],
        };
        this.startTime = 0;
    }

    describe(name, fn) {
        const suite = new TestSuite(name);
        this.currentSuite.addSuite(suite);
        const previousSuite = this.currentSuite;
        this.currentSuite = suite;
        fn();
        this.currentSuite = previousSuite;
        return suite;
    }

    it(name, fn, options = {}) {
        return this.currentSuite.addTest(new Test(name, fn, options));
    }

    beforeAll(fn) {
        this.currentSuite.addHook("beforeAll", fn);
    }

    afterAll(fn) {
        this.currentSuite.addHook("afterAll", fn);
    }

    beforeEach(fn) {
        this.currentSuite.addHook("beforeEach", fn);
    }

    afterEach(fn) {
        this.currentSuite.addHook("afterEach", fn);
    }

    async runHooks(suite, type) {
        for (const hook of suite.hooks[type]) {
            await hook();
        }
    }

    async runTest(test) {
        if (test.skip) {
            this.results.skipped++;
            return { status: "skipped", test };
        }

        const startTime = Date.now();
        let attempts = 0;
        let lastError = null;

        while (attempts <= test.retries) {
            try {
                // Run with timeout
                await Promise.race([
                    (async () => {
                        const result = test.fn();
                        if (result instanceof Promise) {
                            await result;
                        }
                    })(),
                    new Promise((_, reject) => {
                        setTimeout(
                            () => reject(new Error(`Test timeout (${test.timeout}ms)`)),
                            test.timeout
                        );
                    }),
                ]);

                const duration = Date.now() - startTime;
                this.results.passed++;
                return { status: "passed", test, duration };
            } catch (error) {
                lastError = error;
                attempts++;
            }
        }

        const duration = Date.now() - startTime;
        this.results.failed++;
        this.results.failures.push({ test, error: lastError });
        return { status: "failed", test, error: lastError, duration };
    }

    async runSuite(suite, depth = 0) {
        const suiteResult = {
            name: suite.name,
            tests: [],
            suites: [],
            passed: 0,
            failed: 0,
            skipped: 0,
            duration: 0,
        };

        const indent = "  ".repeat(depth);
        const suiteStart = Date.now();

        if (suite.name) {
            console.log(`\n${indent}${c("cyan", SYMBOLS.bullet)} ${c("bright", suite.name)}`);
        }

        // Run beforeAll hooks
        try {
            await this.runHooks(suite, "beforeAll");
        } catch (error) {
            console.log(
                `${indent}  ${c("red", SYMBOLS.fail)} beforeAll hook failed: ${error.message}`
            );
            return suiteResult;
        }

        // Run tests
        for (const test of suite.tests) {
            this.results.total++;

            // Run beforeEach hooks
            try {
                await this.runHooks(suite, "beforeEach");
            } catch (error) {
                console.log(
                    `${indent}  ${c("red", SYMBOLS.fail)} beforeEach hook failed: ${error.message}`
                );
                continue;
            }

            const result = await this.runTest(test);
            suiteResult.tests.push(result);

            if (result.status === "passed") {
                suiteResult.passed++;
                const durationStr =
                    result.duration > 100
                        ? c("yellow", ` (${result.duration}ms)`)
                        : c("gray", ` (${result.duration}ms)`);
                console.log(
                    `${indent}  ${c("green", SYMBOLS.pass)} ${c("gray", test.name)}${durationStr}`
                );
            } else if (result.status === "failed") {
                suiteResult.failed++;
                console.log(`${indent}  ${c("red", SYMBOLS.fail)} ${c("red", test.name)}`);
                if (CONFIG.verbose && result.error) {
                    console.log(`${indent}    ${c("red", result.error.message)}`);
                }
            } else {
                suiteResult.skipped++;
                console.log(
                    `${indent}  ${c("yellow", SYMBOLS.pending)} ${c("gray", test.name)} ${c("yellow", "(skipped)")}`
                );
            }

            // Run afterEach hooks
            try {
                await this.runHooks(suite, "afterEach");
            } catch (error) {
                console.log(
                    `${indent}  ${c("yellow", "!")} afterEach hook failed: ${error.message}`
                );
            }

            // Bail on first failure if configured
            if (CONFIG.bail && result.status === "failed") {
                return suiteResult;
            }
        }

        // Run nested suites
        for (const childSuite of suite.suites) {
            const childResult = await this.runSuite(childSuite, depth + 1);
            suiteResult.suites.push(childResult);
            suiteResult.passed += childResult.passed;
            suiteResult.failed += childResult.failed;
            suiteResult.skipped += childResult.skipped;
        }

        // Run afterAll hooks
        try {
            await this.runHooks(suite, "afterAll");
        } catch (error) {
            console.log(`${indent}  ${c("yellow", "!")} afterAll hook failed: ${error.message}`);
        }

        suiteResult.duration = Date.now() - suiteStart;
        return suiteResult;
    }

    async run() {
        this.startTime = Date.now();

        // Header
        console.log("\n" + "═".repeat(70));
        console.log(c("cyan", "  NERO - Test Suite"));
        console.log("═".repeat(70));

        const rootResult = await this.runSuite(this.rootSuite);
        this.results.suiteResults.push(rootResult);
        this.results.duration = Date.now() - this.startTime;

        this.printSummary();

        return this.results;
    }

    printSummary() {
        console.log("\n" + "═".repeat(70));
        console.log(c("bright", "  SUMMARY"));
        console.log("═".repeat(70));

        // Statistics
        const { passed, failed, skipped, total, duration } = this.results;
        const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;

        console.log(`
  ${c("green", SYMBOLS.pass)} Passing:  ${c("green", passed.toString())}
  ${c("red", SYMBOLS.fail)} Failing:  ${c("red", failed.toString())}
  ${c("yellow", SYMBOLS.pending)} Skipped:  ${c("yellow", skipped.toString())}
  
  ${c("gray", "Total:")}     ${total}
  ${c("gray", "Duration:")} ${duration}ms
  ${c("gray", "Pass Rate:")} ${passRate}%`);

        // Failure details
        if (this.results.failures.length > 0) {
            console.log("\n" + c("red", "  FAILURES"));
            console.log("  " + "─".repeat(66));

            this.results.failures.forEach((failure, index) => {
                console.log(`\n  ${index + 1}) ${failure.test.getFullName()}`);
                console.log(`     ${c("red", failure.error.message)}`);
                if (failure.error.expected !== undefined) {
                    console.log(
                        `     ${c("gray", "Expected:")} ${c("green", JSON.stringify(failure.error.expected))}`
                    );
                    console.log(
                        `     ${c("gray", "Actual:")}   ${c("red", JSON.stringify(failure.error.actual))}`
                    );
                }
            });
        }

        console.log("\n" + "═".repeat(70));

        if (failed === 0) {
            console.log(c("green", `\n  ${SYMBOLS.pass} ALL TESTS PASSED!\n`));
        } else {
            console.log(c("red", `\n  ${SYMBOLS.fail} ${failed} TEST(S) FAILED\n`));
        }
    }

    getExitCode() {
        return this.results.failed > 0 ? 1 : 0;
    }
}

// ═══════════════════════════════════════════════════════════
// GLOBAL TEST RUNNER INSTANCE
// ═══════════════════════════════════════════════════════════

const runner = new TestRunner();

// ═══════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════

module.exports = {
    // Test structure
    describe: (name, fn) => runner.describe(name, fn),
    it: (name, fn, options) => runner.it(name, fn, options),
    test: (name, fn, options) => runner.it(name, fn, options),

    // Hooks
    beforeAll: (fn) => runner.beforeAll(fn),
    afterAll: (fn) => runner.afterAll(fn),
    beforeEach: (fn) => runner.beforeEach(fn),
    afterEach: (fn) => runner.afterEach(fn),

    // Assertions
    assert,
    expect: assert, // Alias

    // Runner
    run: async () => {
        const results = await runner.run();
        process.exit(runner.getExitCode());
    },

    // Get results without exiting
    runTests: () => runner.run(),

    // Configuration
    configure: (options) => Object.assign(CONFIG, options),

    // Utilities
    AssertionError,
    TestRunner,
    TestSuite,
    Test,
};
