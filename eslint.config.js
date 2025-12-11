/**
 * ESLint Flat Config (ESLint 9+)
 * @see https://eslint.org/docs/latest/use/configure/configuration-files
 */

const js = require("@eslint/js");
const globals = require("globals");
const nodePlugin = require("eslint-plugin-n");
const prettierConfig = require("eslint-config-prettier");

module.exports = [
    // Global ignores
    {
        ignores: ["node_modules/", "logs/", "accounts/", "**/*.min.js", "coverage/", "dist/"],
    },

    // Base JS recommended rules
    js.configs.recommended,

    // Node.js plugin recommended config
    nodePlugin.configs["flat/recommended"],

    // Prettier config (disables conflicting rules)
    prettierConfig,

    // Main configuration for all JS files
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "commonjs",
            globals: {
                ...globals.node,
                ...globals.es2022,
            },
        },
        rules: {
            // Error prevention
            "no-unused-vars": [
                "warn",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                },
            ],
            "no-console": "off",
            "prefer-const": "warn",
            "no-var": "error",
            eqeqeq: ["warn", "always"],
            curly: ["warn", "multi-line"],
            "no-control-regex": "off",
            "no-prototype-builtins": "warn",

            // Node.js specific
            "n/no-unsupported-features/es-syntax": "off",
            "n/no-unsupported-features/node-builtins": "off",
            "n/no-missing-require": "off",
            "n/no-unpublished-require": "off",
            "n/no-process-exit": "off",
            "n/no-extraneous-require": "off",
            "n/no-deprecated-api": "warn",

            // Code quality
            "no-duplicate-imports": "error",
            "no-template-curly-in-string": "warn",
            "default-case-last": "warn",
            "grouped-accessor-pairs": "warn",
            "no-constructor-return": "error",
            "no-promise-executor-return": "warn",
            "no-self-compare": "error",
            "no-unmodified-loop-condition": "warn",
        },
    },

    // Browser extension files (popup.js, etc.)
    {
        files: ["extension/**/*.js"],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.webextensions,
                chrome: "readonly",
            },
        },
        rules: {
            "n/no-unsupported-features/node-builtins": "off",
        },
    },

    // Nero framework library (more lenient - legacy code)
    {
        files: ["nero-core/**/*.js"],
        rules: {
            // Relax rules for framework code (has legacy patterns)
            "no-var": "off",
            eqeqeq: "off",
            "no-unused-vars": "off",
            "no-prototype-builtins": "off",
            "prefer-const": "off",
            "no-empty": "warn",
            "no-unreachable": "off",
            "no-undef": "off",
            curly: "off",
            "no-useless-catch": "off",
            "no-case-declarations": "off",
            "no-irregular-whitespace": "off",
            "no-constant-binary-expression": "off",
            "no-promise-executor-return": "off",
            "n/no-deprecated-api": "off",
        },
    },

    // Test files configuration
    {
        files: ["**/tests/**/*.js", "**/*.test.js", "**/*.spec.js"],
        rules: {
            "no-unused-vars": "off",
            "n/no-unpublished-require": "off",
        },
    },
];
