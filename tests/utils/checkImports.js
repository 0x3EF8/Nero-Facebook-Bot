/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                        UNUSED IMPORT CHECKER                                  ║
 * ║          Utility script to find unused imports in JavaScript files            ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 * 
 * Run this script periodically to find unused imports in your handlers and utils.
 * 
 * Usage:
 *   node tests/utils/checkImports.js                    # Check all default paths
 *   node tests/utils/checkImports.js ./path/to/file.js  # Check specific file
 *   node tests/utils/checkImports.js ./handlers         # Check specific directory
 * 
 * @module tests/utils/checkImports
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
    bold: '\x1b[1m'
};

/**
 * Default directories to check (relative to src/)
 */
const DEFAULT_PATHS = [
    'src/handlers',
    'src/utils',
    'src/features/commands',
    'src/features/events',
    'src/features/background',
    'src/config'
];

/**
 * Extract require statements from file content
 * @param {string} content - File content
 * @returns {Array<{name: string, line: number, fullMatch: string}>}
 */
function extractRequires(content) {
    const requires = [];
    const lines = content.split('\n');
    
    // Match: const/let/var name = require('...')
    // Match: const { a, b } = require('...')
    const requireRegex = /(?:const|let|var)\s+(?:(\w+)|{([^}]+)})\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    
    lines.forEach((line, index) => {
        // Skip comment lines
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*') || trimmedLine.startsWith('/*')) {
            return;
        }
        
        let match;
        const lineRegex = new RegExp(requireRegex.source, 'g');
        
        while ((match = lineRegex.exec(line)) !== null) {
            const singleVar = match[1];
            const destructured = match[2];
            const modulePath = match[3];
            
            if (singleVar) {
                requires.push({
                    name: singleVar,
                    line: index + 1,
                    module: modulePath,
                    fullMatch: match[0]
                });
            } else if (destructured) {
                // Handle destructured imports: { a, b, c: alias }
                const vars = destructured.split(',').map(v => {
                    const parts = v.trim().split(':');
                    // If aliased (original: alias), use the alias
                    return parts.length > 1 ? parts[1].trim() : parts[0].trim();
                }).filter(v => v);
                
                vars.forEach(v => {
                    requires.push({
                        name: v,
                        line: index + 1,
                        module: modulePath,
                        fullMatch: match[0]
                    });
                });
            }
        }
    });
    
    return requires;
}

/**
 * Check if a variable name is used in the code (excluding its declaration)
 * @param {string} content - File content
 * @param {string} varName - Variable name to search for
 * @param {number} declarationLine - Line where variable is declared
 * @returns {boolean}
 */
function isVariableUsed(content, varName, declarationLine) {
    const lines = content.split('\n');
    
    // Create regex that matches the variable name as a whole word
    // Avoid matching partial names (e.g., 'log' in 'logger')
    const usageRegex = new RegExp(`\\b${escapeRegex(varName)}\\b`, 'g');
    
    for (let i = 0; i < lines.length; i++) {
        // Skip the declaration line
        if (i + 1 === declarationLine) continue;
        
        const line = lines[i];
        
        // Skip comments
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
        
        if (usageRegex.test(line)) {
            return true;
        }
    }
    
    return false;
}

/**
 * Escape special regex characters
 * @param {string} string - String to escape
 * @returns {string}
 */
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check a single file for unused imports
 * @param {string} filePath - Path to file
 * @returns {Object} - Results object
 */
function checkFile(filePath) {
    const results = {
        file: filePath,
        imports: [],
        unused: [],
        used: []
    };
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const requires = extractRequires(content);
        
        results.imports = requires;
        
        requires.forEach(req => {
            if (isVariableUsed(content, req.name, req.line)) {
                results.used.push(req);
            } else {
                results.unused.push(req);
            }
        });
        
    } catch (error) {
        results.error = error.message;
    }
    
    return results;
}

/**
 * Recursively get all JS files in a directory
 * @param {string} dir - Directory path
 * @param {string[]} [files=[]] - Accumulated files
 * @returns {string[]}
 */
function getJsFiles(dir, files = []) {
    try {
        const items = fs.readdirSync(dir);
        
        items.forEach(item => {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                // Skip node_modules and hidden directories
                if (!item.startsWith('.') && item !== 'node_modules') {
                    getJsFiles(fullPath, files);
                }
            } else if (item.endsWith('.js') && !item.endsWith('.test.js')) {
                files.push(fullPath);
            }
        });
    } catch {
        // Directory doesn't exist or can't be read
    }
    
    return files;
}

/**
 * Format and print results
 * @param {Object[]} results - Array of file results
 */
function printResults(results) {
    console.log('\n' + colors.bold + colors.cyan + '╔═══════════════════════════════════════════════════════════════════════════════╗' + colors.reset);
    console.log(colors.bold + colors.cyan + '║                        UNUSED IMPORT CHECKER RESULTS                         ║' + colors.reset);
    console.log(colors.bold + colors.cyan + '╚═══════════════════════════════════════════════════════════════════════════════╝' + colors.reset);
    
    let totalUnused = 0;
    let totalChecked = 0;
    let filesWithUnused = 0;
    
    results.forEach(result => {
        if (result.error) {
            console.log(`\n${colors.red}✗ ${result.file}${colors.reset}`);
            console.log(`  ${colors.gray}Error: ${result.error}${colors.reset}`);
            return;
        }
        
        totalChecked += result.imports.length;
        
        if (result.unused.length > 0) {
            filesWithUnused++;
            totalUnused += result.unused.length;
            
            console.log(`\n${colors.yellow}⚠ ${result.file}${colors.reset}`);
            result.unused.forEach(u => {
                console.log(`  ${colors.red}Line ${u.line}:${colors.reset} ${colors.bold}${u.name}${colors.reset} ${colors.gray}from '${u.module}'${colors.reset}`);
            });
        }
    });
    
    // Summary
    console.log('\n' + colors.cyan + '─'.repeat(79) + colors.reset);
    console.log(colors.bold + '\n📊 Summary:' + colors.reset);
    console.log(`   Files checked: ${colors.blue}${results.length}${colors.reset}`);
    console.log(`   Total imports: ${colors.blue}${totalChecked}${colors.reset}`);
    
    if (totalUnused === 0) {
        console.log(`   Unused imports: ${colors.green}0 ✓${colors.reset}`);
        console.log(`\n${colors.green}${colors.bold}✓ All imports are being used!${colors.reset}\n`);
    } else {
        console.log(`   Unused imports: ${colors.red}${totalUnused}${colors.reset}`);
        console.log(`   Files affected: ${colors.yellow}${filesWithUnused}${colors.reset}`);
        console.log(`\n${colors.yellow}${colors.bold}⚠ Found ${totalUnused} unused import(s) in ${filesWithUnused} file(s).${colors.reset}`);
        console.log(`${colors.gray}Consider removing them to keep the codebase clean.${colors.reset}\n`);
    }
}

/**
 * Main execution
 */
function main() {
    const args = process.argv.slice(2);
    let targetPaths = [];
    
    if (args.length > 0) {
        // Use provided paths
        targetPaths = args.map(p => path.resolve(p));
    } else {
        // Use default paths relative to project root (tests/utils -> root)
        const projectRoot = path.join(__dirname, '..', '..');
        targetPaths = DEFAULT_PATHS.map(p => path.join(projectRoot, p));
    }
    
    const allFiles = [];
    
    targetPaths.forEach(targetPath => {
        try {
            const stat = fs.statSync(targetPath);
            
            if (stat.isDirectory()) {
                allFiles.push(...getJsFiles(targetPath));
            } else if (stat.isFile() && targetPath.endsWith('.js')) {
                allFiles.push(targetPath);
            }
        } catch {
            // Path doesn't exist
            console.log(`${colors.yellow}⚠ Path not found: ${targetPath}${colors.reset}`);
        }
    });
    
    if (allFiles.length === 0) {
        console.log(`${colors.yellow}No JavaScript files found to check.${colors.reset}`);
        process.exit(0);
    }
    
    console.log(`${colors.gray}Checking ${allFiles.length} file(s)...${colors.reset}`);
    
    const results = allFiles.map(file => checkFile(file));
    
    printResults(results);
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = {
    checkFile,
    extractRequires,
    isVariableUsed,
    getJsFiles
};
