/**
 * File Parsing Test Script
 * Tests different parsing methods for PDF, DOCX, PPTX, XLSX files
 * 
 * Usage: node tests/test-file-parsing.js <file-path-or-url>
 * Example: node tests/test-file-parsing.js "https://example.com/file.pdf"
 * Example: node tests/test-file-parsing.js "./files/test.pdf"
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

// Colors for console output
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
};

function log(type, message) {
    const timestamp = new Date().toISOString().slice(11, 23);
    const typeColors = {
        info: colors.blue,
        success: colors.green,
        error: colors.red,
        warn: colors.yellow,
        debug: colors.magenta,
    };
    console.log(`${colors.cyan}[${timestamp}]${colors.reset} ${typeColors[type] || colors.reset}[${type.toUpperCase()}]${colors.reset} ${message}`);
}

function logSection(title) {
    console.log("\n" + colors.bright + "═".repeat(60) + colors.reset);
    console.log(colors.bright + " " + title + colors.reset);
    console.log(colors.bright + "═".repeat(60) + colors.reset + "\n");
}

// Download file from URL
async function downloadFile(url) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Download timeout")), 30000);
        
        try {
            const parsedUrl = new URL(url);
            const protocol = parsedUrl.protocol === "https:" ? https : http;
            
            log("info", `Downloading from: ${url}`);
            
            const options = {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                },
            };
            
            protocol.get(url, options, (response) => {
                // Handle redirects
                if ([300, 301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
                    clearTimeout(timeout);
                    let redirectUrl = response.headers.location;
                    if (redirectUrl.startsWith("/")) {
                        redirectUrl = `${parsedUrl.protocol}//${parsedUrl.host}${redirectUrl}`;
                    }
                    log("debug", `Redirect ${response.statusCode} to: ${redirectUrl}`);
                    return downloadFile(redirectUrl).then(resolve).catch(reject);
                }
                
                if (response.statusCode !== 200) {
                    clearTimeout(timeout);
                    return reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                }
                
                const chunks = [];
                let totalSize = 0;
                
                response.on("data", (chunk) => {
                    totalSize += chunk.length;
                    chunks.push(chunk);
                    process.stdout.write(`\r  Downloaded: ${(totalSize / 1024).toFixed(1)} KB`);
                });
                
                response.on("end", () => {
                    clearTimeout(timeout);
                    console.log("");
                    log("success", `Download complete: ${totalSize} bytes`);
                    resolve({
                        buffer: Buffer.concat(chunks),
                        contentType: response.headers["content-type"] || "",
                    });
                });
                
                response.on("error", (err) => {
                    clearTimeout(timeout);
                    reject(err);
                });
            }).on("error", (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        } catch (err) {
            clearTimeout(timeout);
            reject(err);
        }
    });
}

// Test Method 1: officeparser
async function testOfficeParser(buffer, filename) {
    logSection("TEST 1: officeparser");
    
    try {
        const officeParser = require("officeparser");
        log("info", "officeparser loaded successfully");
        
        log("debug", `Buffer size: ${buffer.length} bytes`);
        log("debug", `First 20 bytes (hex): ${buffer.slice(0, 20).toString("hex")}`);
        log("debug", `First 50 chars: ${buffer.slice(0, 50).toString("utf-8").replace(/[^\x20-\x7E]/g, ".")}`);
        
        log("info", "Attempting to parse with officeparser...");
        const ast = await officeParser.parseOffice(buffer, {
            outputErrorToConsole: true,
            newlineDelimiter: "\n",
        });
        
        log("success", "officeparser parsed successfully!");
        log("debug", `AST type: ${typeof ast}`);
        log("debug", `AST has toText: ${typeof ast.toText === "function"}`);
        
        const text = ast.toText ? ast.toText() : String(ast);
        log("info", `Extracted ${text.length} characters`);
        log("info", `Word count: ${text.split(/\s+/).filter(Boolean).length}`);
        
        console.log("\n" + colors.green + "--- EXTRACTED TEXT (first 500 chars) ---" + colors.reset);
        console.log(text.substring(0, 500));
        console.log(colors.green + "--- END ---" + colors.reset + "\n");
        
        return { success: true, text };
    } catch (error) {
        log("error", `officeparser failed: ${error.message}`);
        log("debug", `Error stack: ${error.stack}`);
        return { success: false, error: error.message };
    }
}

// Test Method 2: pdf-parse (for PDF only)
async function testPdfParse(buffer, filename) {
    logSection("TEST 2: pdf-parse");
    
    const ext = path.extname(filename).toLowerCase();
    if (ext !== ".pdf") {
        log("warn", "Skipping pdf-parse test (not a PDF file)");
        return { success: false, error: "Not a PDF file" };
    }
    
    try {
        const { PDFParse } = require("pdf-parse");
        log("info", "pdf-parse loaded successfully");
        
        log("debug", `Buffer size: ${buffer.length} bytes`);
        log("debug", `PDF signature check: ${buffer.slice(0, 5).toString()}`);
        
        // Convert Buffer to Uint8Array (required by pdf-parse)
        const uint8Array = new Uint8Array(buffer);
        log("debug", `Converted to Uint8Array: ${uint8Array.length} bytes`);
        
        log("info", "Attempting to parse with pdf-parse...");
        const parser = new PDFParse(uint8Array);
        await parser.load();
        const result = await parser.getText();
        
        log("success", "pdf-parse parsed successfully!");
        log("info", `Pages: ${result.total || result.pages?.length || "unknown"}`);
        log("info", `Text length: ${result.text?.length || 0} characters`);
        log("info", `Word count: ${result.text?.split(/\s+/).filter(Boolean).length || 0}`);
        
        console.log("\n" + colors.green + "--- EXTRACTED TEXT (first 500 chars) ---" + colors.reset);
        console.log((result.text || "").substring(0, 500));
        console.log(colors.green + "--- END ---" + colors.reset + "\n");
        
        return { success: true, text: result.text, pages: result.total };
    } catch (error) {
        log("error", `pdf-parse failed: ${error.message}`);
        log("debug", `Error stack: ${error.stack}`);
        return { success: false, error: error.message };
    }
}

// Test Method 3: adm-zip (for DOCX, PPTX, XLSX)
async function testAdmZip(buffer, filename) {
    logSection("TEST 3: adm-zip (ZIP-based extraction)");
    
    const ext = path.extname(filename).toLowerCase();
    if (![".docx", ".pptx", ".xlsx"].includes(ext)) {
        log("warn", "Skipping adm-zip test (not a ZIP-based Office file)");
        return { success: false, error: "Not a ZIP-based file" };
    }
    
    try {
        const AdmZip = require("adm-zip");
        log("info", "adm-zip loaded successfully");
        
        log("debug", `Buffer size: ${buffer.length} bytes`);
        log("debug", `ZIP signature check: ${buffer.slice(0, 4).toString("hex")} (should be 504b0304)`);
        
        log("info", "Creating ZIP instance...");
        const zip = new AdmZip(buffer);
        
        const entries = zip.getEntries();
        log("info", `ZIP contains ${entries.length} entries`);
        
        // List first 10 entries
        console.log("\n  ZIP Contents (first 10 entries):");
        entries.slice(0, 10).forEach((e, i) => {
            console.log(`    ${i + 1}. ${e.entryName} (${e.header.size} bytes)`);
        });
        if (entries.length > 10) console.log(`    ... and ${entries.length - 10} more`);
        console.log("");
        
        let text = "";
        
        if (ext === ".docx") {
            log("info", "Extracting text from DOCX...");
            const docXml = zip.readAsText("word/document.xml");
            if (docXml) {
                text = docXml
                    .replace(/<w:p[^>]*>/g, "\n")
                    .replace(/<w:tab[^>]*\/>/g, "\t")
                    .replace(/<w:br[^>]*\/>/g, "\n")
                    .replace(/<[^>]+>/g, "")
                    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
                    .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
                    .replace(/\n{3,}/g, "\n\n").trim();
            }
        } else if (ext === ".pptx") {
            log("info", "Extracting text from PPTX slides...");
            const slideEntries = entries
                .filter(e => e.entryName.match(/^ppt\/slides\/slide\d+\.xml$/))
                .sort((a, b) => {
                    const numA = parseInt(a.entryName.match(/slide(\d+)/)[1]);
                    const numB = parseInt(b.entryName.match(/slide(\d+)/)[1]);
                    return numA - numB;
                });
            
            log("info", `Found ${slideEntries.length} slides`);
            
            for (const entry of slideEntries) {
                const slideXml = zip.readAsText(entry.entryName);
                const texts = [];
                const matches = slideXml.matchAll(/<a:t>([^<]*)<\/a:t>/g);
                for (const m of matches) {
                    if (m[1]?.trim()) texts.push(m[1].trim());
                }
                if (texts.length > 0) {
                    const slideNum = entry.entryName.match(/slide(\d+)/)[1];
                    text += `\n[Slide ${slideNum}]\n${texts.join(" ")}\n`;
                }
            }
        } else if (ext === ".xlsx") {
            log("info", "Extracting text from XLSX...");
            const sharedStrings = zip.readAsText("xl/sharedStrings.xml") || "";
            const strings = [];
            const strMatches = sharedStrings.matchAll(/<t[^>]*>([^<]*)<\/t>/g);
            for (const m of strMatches) if (m[1]) strings.push(m[1]);
            text = strings.join("\n");
            log("info", `Found ${strings.length} shared strings`);
        }
        
        text = text.trim();
        
        if (text) {
            log("success", "adm-zip extraction successful!");
            log("info", `Text length: ${text.length} characters`);
            log("info", `Word count: ${text.split(/\s+/).filter(Boolean).length}`);
            
            console.log("\n" + colors.green + "--- EXTRACTED TEXT (first 500 chars) ---" + colors.reset);
            console.log(text.substring(0, 500));
            console.log(colors.green + "--- END ---" + colors.reset + "\n");
            
            return { success: true, text };
        } else {
            log("warn", "No text content extracted");
            return { success: false, error: "No text content" };
        }
    } catch (error) {
        log("error", `adm-zip failed: ${error.message}`);
        log("debug", `Error stack: ${error.stack}`);
        return { success: false, error: error.message };
    }
}

// Test Method 4: Raw binary inspection
async function testBinaryInspection(buffer, filename) {
    logSection("TEST 4: Binary Inspection");
    
    log("info", `File: ${filename}`);
    log("info", `Size: ${buffer.length} bytes (${(buffer.length / 1024).toFixed(2)} KB)`);
    
    // Check file signatures
    const signatures = {
        pdf: { sig: "255044462d", name: "PDF (%PDF-)" },
        zip: { sig: "504b0304", name: "ZIP/OOXML (PK)" },
        ole: { sig: "d0cf11e0a1b11ae1", name: "OLE/CFB (MS Office 97-2003)" },
        png: { sig: "89504e47", name: "PNG" },
        jpg: { sig: "ffd8ff", name: "JPEG" },
        gif: { sig: "47494638", name: "GIF" },
        html: { sig: "3c68746d6c", name: "HTML (<html)" },
        htmlDoc: { sig: "3c21444f43", name: "HTML (<!DOC)" },
    };
    
    const hexStart = buffer.slice(0, 20).toString("hex");
    log("debug", `First 20 bytes (hex): ${hexStart}`);
    log("debug", `First 50 bytes (text): ${buffer.slice(0, 50).toString("utf-8").replace(/[^\x20-\x7E]/g, "·")}`);
    
    let detectedType = "Unknown";
    for (const [type, { sig, name }] of Object.entries(signatures)) {
        if (hexStart.startsWith(sig)) {
            detectedType = name;
            log("success", `Detected file type: ${name}`);
            break;
        }
    }
    
    if (detectedType === "Unknown") {
        log("warn", "Could not detect file type from signature");
        
        // Check if it's text-based
        const textSample = buffer.slice(0, 1000).toString("utf-8");
        if (textSample.includes("<!DOCTYPE") || textSample.includes("<html")) {
            log("warn", "⚠️ File appears to be HTML content, not a real document!");
            detectedType = "HTML (disguised as document)";
        } else if (textSample.includes("<?xml")) {
            log("info", "File starts with XML declaration");
            detectedType = "XML";
        }
    }
    
    // Check declared extension vs actual type
    const ext = path.extname(filename).toLowerCase();
    const expectedTypes = {
        ".pdf": "PDF",
        ".docx": "ZIP",
        ".xlsx": "ZIP",
        ".pptx": "ZIP",
        ".doc": "OLE",
        ".xls": "OLE",
        ".ppt": "OLE",
    };
    
    if (expectedTypes[ext] && !detectedType.includes(expectedTypes[ext])) {
        log("error", `⚠️ MISMATCH: File extension is ${ext} but content appears to be ${detectedType}`);
        log("error", "This file may be corrupted or incorrectly named!");
    }
    
    return { detectedType };
}

// Main test runner
async function main() {
    console.log("\n" + colors.bright + colors.cyan);
    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║             FILE PARSING TEST SCRIPT v1.0                  ║");
    console.log("║      Tests multiple parsing methods for Office files       ║");
    console.log("╚════════════════════════════════════════════════════════════╝");
    console.log(colors.reset + "\n");
    
    const input = process.argv[2];
    
    if (!input) {
        console.log("Usage: node test-file-parsing.js <file-path-or-url>");
        console.log("\nExamples:");
        console.log("  node test-file-parsing.js ./files/document.pdf");
        console.log("  node test-file-parsing.js https://example.com/file.docx");
        console.log("\nTo test with a sample PDF, you can use:");
        console.log("  node test-file-parsing.js https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.pdf");
        process.exit(1);
    }
    
    let buffer;
    let filename;
    
    // Check if input is URL or file path
    if (input.startsWith("http://") || input.startsWith("https://")) {
        log("info", "Input detected as URL");
        filename = path.basename(new URL(input).pathname) || "downloaded_file";
        const result = await downloadFile(input);
        buffer = result.buffer;
    } else {
        log("info", "Input detected as local file path");
        const filePath = path.resolve(input);
        if (!fs.existsSync(filePath)) {
            log("error", `File not found: ${filePath}`);
            process.exit(1);
        }
        filename = path.basename(filePath);
        buffer = fs.readFileSync(filePath);
        log("success", `Loaded file: ${filename} (${buffer.length} bytes)`);
    }
    
    // Run all tests
    const results = {};
    
    results.binary = await testBinaryInspection(buffer, filename);
    results.officeParser = await testOfficeParser(buffer, filename);
    results.pdfParse = await testPdfParse(buffer, filename);
    results.admZip = await testAdmZip(buffer, filename);
    
    // Summary
    logSection("SUMMARY");
    
    console.log("Test Results:");
    console.log(`  Binary Inspection: ${results.binary.detectedType}`);
    console.log(`  officeparser: ${results.officeParser.success ? colors.green + "✓ SUCCESS" : colors.red + "✗ FAILED"} ${colors.reset}${results.officeParser.error || ""}`);
    console.log(`  pdf-parse: ${results.pdfParse.success ? colors.green + "✓ SUCCESS" : colors.red + "✗ FAILED"} ${colors.reset}${results.pdfParse.error || ""}`);
    console.log(`  adm-zip: ${results.admZip.success ? colors.green + "✓ SUCCESS" : colors.red + "✗ FAILED"} ${colors.reset}${results.admZip.error || ""}`);
    
    // Recommendation
    console.log("\n" + colors.bright + "Recommendation:" + colors.reset);
    if (results.officeParser.success) {
        console.log(colors.green + "  ✓ Use officeparser - it worked!" + colors.reset);
    } else if (results.pdfParse.success) {
        console.log(colors.green + "  ✓ Use pdf-parse for this PDF file" + colors.reset);
    } else if (results.admZip.success) {
        console.log(colors.green + "  ✓ Use adm-zip for ZIP-based extraction" + colors.reset);
    } else {
        console.log(colors.red + "  ✗ No parsing method worked. The file may be:" + colors.reset);
        console.log("    - Corrupted or invalid");
        console.log("    - An HTML file disguised as a document");
        console.log("    - Password protected");
        console.log("    - An unsupported format");
    }
    
    console.log("\n");
}

main().catch(err => {
    log("error", `Fatal error: ${err.message}`);
    console.error(err);
    process.exit(1);
});
