/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                         NERO - Unit Tests: Core                              ║
 * ║                    Test Core Module Loading & Structure                       ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Tests the core entry points and authentication modules.
 *
 * @module tests/unit/core.test
 * @version 2.0.0
 */

"use strict";

const { describe, it, beforeAll, assert, run } = require("../lib/test-framework");
const {
    resolveRoot,
    resolveSrc,
    fileExists,
    dirExists,
    isFactoryFunction,
} = require("../lib/helpers");
const path = require("path");
const fs = require("fs");

// ═══════════════════════════════════════════════════════════
// ENTRY POINTS
// ═══════════════════════════════════════════════════════════

describe("Entry Points", () => {
    describe("Main Entry (index.js)", () => {
        it("should exist at project root", () => {
            assert.ok(fileExists(resolveRoot("index.js")));
        });

        it("should export a function (login)", () => {
            const nero = require(resolveRoot("index.js"));
            assert.isFunction(nero);
        });

        it("should be callable with credentials", () => {
            const nero = require(resolveRoot("index.js"));
            // Verify function signature
            assert.greaterThan(nero.length, 0);
        });
    });

    describe("Package Configuration (package.json)", () => {
        let pkg;

        beforeAll(() => {
            pkg = require(resolveRoot("package.json"));
        });

        it("should have valid package.json", () => {
            assert.isObject(pkg);
        });

        it("should have correct name", () => {
            assert.equal(pkg.name, "nero-core");
        });

        it("should have version 2.0.0", () => {
            assert.equal(pkg.version, "2.0.0");
        });

        it("should have main entry pointing to index.js", () => {
            assert.equal(pkg.main, "index.js");
        });

        it("should have TypeScript types configured", () => {
            assert.equal(pkg.types, "types/index.d.ts");
        });

        it("should have required dependencies", () => {
            const requiredDeps = ["axios", "mqtt", "tough-cookie", "cheerio", "form-data"];
            requiredDeps.forEach((dep) => {
                assert.hasProperty(pkg.dependencies, dep, `Missing dependency: ${dep}`);
            });
        });

        it("should have test scripts configured", () => {
            assert.hasProperty(pkg.scripts, "test");
            assert.hasProperty(pkg.scripts, "test:unit");
            assert.hasProperty(pkg.scripts, "test:integration");
            assert.hasProperty(pkg.scripts, "test:api");
        });

        it("should require Node.js >= 14", () => {
            assert.matches(pkg.engines.node, />=14/);
        });
    });

    describe("TypeScript Definitions", () => {
        it("should have types directory", () => {
            assert.ok(dirExists(resolveRoot("types")));
        });

        it("should have index.d.ts file", () => {
            assert.ok(fileExists(resolveRoot("types", "index.d.ts")));
        });
    });
});

// ═══════════════════════════════════════════════════════════
// CORE CLIENT
// ═══════════════════════════════════════════════════════════

describe("Core Client", () => {
    const clientPath = resolveSrc("core", "client.js");

    it("should exist", () => {
        assert.ok(fileExists(clientPath));
    });

    it("should export login function", () => {
        const client = require(clientPath);
        assert.hasProperty(client, "login");
        assert.isFunction(client.login);
    });

    it("login function should accept credentials and callback", () => {
        const client = require(clientPath);
        // login(credentials, options, callback) or login(credentials, callback)
        assert.greaterThan(client.login.length, 0);
    });
});

// ═══════════════════════════════════════════════════════════
// AUTHENTICATION MODULES
// ═══════════════════════════════════════════════════════════

describe("Authentication Modules (src/core/auth)", () => {
    const authDir = resolveSrc("core", "auth");

    describe("Directory Structure", () => {
        it("should have auth directory", () => {
            assert.ok(dirExists(authDir));
        });

        it("should contain required auth files", () => {
            const requiredFiles = ["buildAPI.js", "loginHelper.js", "setOptions.js"];
            requiredFiles.forEach((file) => {
                assert.ok(fileExists(path.join(authDir, file)), `Missing: ${file}`);
            });
        });
    });

    describe("setOptions Module", () => {
        it("should be a factory function", () => {
            assert.ok(isFactoryFunction(path.join(authDir, "setOptions.js")));
        });

        it("should return options handler when initialized", () => {
            const setOptions = require(path.join(authDir, "setOptions.js"));
            // setOptions receives (defaultFuncs, api, ctx)
            const initialized = setOptions({}, {}, { globalOptions: {} });
            // May return function or object depending on implementation
            assert.ok(typeof initialized === "function" || typeof initialized === "object");
        });
    });

    describe("buildAPI Module", () => {
        it("should be a factory function", () => {
            assert.ok(isFactoryFunction(path.join(authDir, "buildAPI.js")));
        });

        it("should be callable", () => {
            const buildAPI = require(path.join(authDir, "buildAPI.js"));
            assert.isFunction(buildAPI);
        });
    });

    describe("loginHelper Module", () => {
        it("should be a factory function", () => {
            assert.ok(isFactoryFunction(path.join(authDir, "loginHelper.js")));
        });

        it("should configure API path correctly", () => {
            const content = fs.readFileSync(path.join(authDir, "loginHelper.js"), "utf8");
            // Should reference the api directory from auth folder
            assert.ok(
                content.includes('path.join(__dirname, "..", "..", "api")'),
                "API path should be configured relative to auth directory"
            );
        });
    });
});

// ═══════════════════════════════════════════════════════════
// DIRECTORY STRUCTURE
// ═══════════════════════════════════════════════════════════

describe("Project Directory Structure", () => {
    describe("Source Directory (src/)", () => {
        it("should exist", () => {
            assert.ok(dirExists(resolveSrc()));
        });

        it("should have core subdirectory", () => {
            assert.ok(dirExists(resolveSrc("core")));
        });

        it("should have api subdirectory", () => {
            assert.ok(dirExists(resolveSrc("api")));
        });

        it("should have lib subdirectory", () => {
            assert.ok(dirExists(resolveSrc("lib")));
        });

        it("should have lib/utils subdirectory", () => {
            assert.ok(dirExists(resolveSrc("lib", "utils")));
        });
    });

    describe("API Directory (src/api/)", () => {
        const apiDir = resolveSrc("api");
        const expectedDirs = [
            "messaging",
            "mqtt",
            "threads",
            "users",
            "posting",
            "http",
            "login",
            "extra",
        ];

        expectedDirs.forEach((dir) => {
            it(`should have ${dir} subdirectory`, () => {
                assert.ok(dirExists(path.join(apiDir, dir)), `Missing directory: ${dir}`);
            });
        });
    });

    describe("Examples Directory", () => {
        it("should have examples directory", () => {
            assert.ok(dirExists(resolveRoot("examples")));
        });

        it("should have basic example", () => {
            assert.ok(fileExists(resolveRoot("examples", "basic.js")));
        });
    });

    describe("Documentation", () => {
        it("should have README.md", () => {
            assert.ok(fileExists(resolveRoot("README.md")));
        });
    });
});

// Run all tests
run();
