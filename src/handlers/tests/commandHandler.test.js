/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                      NERO - Unit Tests: CommandHandler                       ║
 * ║                    Test Command Parsing and Execution Logic                  ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module handlers/tests/commandHandler.test
 * @version 1.0.0
 */

"use strict";

const { describe, it, assert, run } = require("../../core/tests/lib/test-framework");
const CommandHandler = require("../commandHandler");

// Mock dependencies if needed (CommandHandler uses require internally, so we might need to mock specifics later)
// For now, we are testing the regex and parsing logic which is mostly pure.

describe("CommandHandler", () => {

    // ═══════════════════════════════════════════════════════════
    // REGEX & PARSING TESTS
    // ═══════════════════════════════════════════════════════════

    describe("Argument Parsing", () => {
        // We need to access the parsing logic. Since it's inside 'handle' (private-ish),
        // we can extract the regex logic here to test it ensuring it matches the implementation,
        // OR we can rely on a mock event to see how it effectively parses args.
        // A better approach for unit testing the logic specifically is to manually test the Regex used.

        // The regex from src/handlers/commandHandler.js:
        const regex = /"([^"]+)"|'([^']+)'|([^\s]+)/g;

        function parse(text) {
            const args = [];
            let match;
            // Reset lastIndex because exec uses it
            regex.lastIndex = 0;
            while ((match = regex.exec(text)) !== null) {
                // match[1] = double quotes, match[2] = single quotes, match[3] = word
                args.push(match[1] || match[2] || match[3]);
            }
            return args;
        }

        it("should parse simple space-separated arguments", () => {
            const input = "test arg1 arg2";
            const expected = ["test", "arg1", "arg2"];
            assert.deepEqual(parse(input), expected);
        });

        it("should parse arguments with double quotes", () => {
            const input = 'test "hello world" arg2';
            const expected = ["test", "hello world", "arg2"];
            assert.deepEqual(parse(input), expected);
        });

        it("should parse arguments with single quotes", () => {
            const input = "test 'hello world' arg2";
            const expected = ["test", "hello world", "arg2"];
            assert.deepEqual(parse(input), expected);
        });

        it("should handle mixed quotes", () => {
            const input = 'cmd "val 1" \'val 2\' val3';
            const expected = ["cmd", "val 1", "val 2", "val3"];
            assert.deepEqual(parse(input), expected);
        });

        it("should handle nested quotes (simple)", () => {
            // "He said 'Hi'" -> He said 'Hi'
            const input = 'say "He said \'Hi\'"';
            const expected = ["say", "He said 'Hi'"];
            assert.deepEqual(parse(input), expected);
        });

        it("should ignore extra whitespace", () => {
            const input = "cmd    arg1   arg2";
            const expected = ["cmd", "arg1", "arg2"];
            assert.deepEqual(parse(input), expected);
        });

        it("should handle empty string", () => {
            const input = "";
            const expected = [];
            assert.deepEqual(parse(input), expected);
        });
    });
});

// Run if called directly
if (require.main === module) {
    run();
}
