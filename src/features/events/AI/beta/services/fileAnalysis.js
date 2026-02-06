/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                         FILE ANALYSIS SERVICE                                 ║
 * ║        Download, extract and analyze file contents for AI context            ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * Supports: PDF, DOCX, DOC, XLSX, XLS, PPTX, PPT, ODT, ODP, ODS, RTF, TXT, JSON, CSV, and more
 * Uses officeparser for robust document parsing
 *
 * @module services/fileAnalysis
 * @author 0x3EF8
 * @version 2.0.0
 */

"use strict";

const https = require("https");
const http = require("http");
const { URL } = require("url");
const path = require("path");
const fs = require("fs");
const { getTempDirSync, deleteTempFile } = require("../../../../../utils/paths");

// Import officeparser for robust Office document parsing
let officeParser = null;
try {
    officeParser = require("officeparser");
} catch {
    console.warn("[FileAnalysis] officeparser not installed. Run: npm install officeparser");
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
    maxFileSize: 10 * 1024 * 1024, // 10MB max
    maxTextLength: 50000, // Max characters to extract
    supportedTypes: {
        // Text files
        txt: "text",
        md: "text",
        json: "json",
        csv: "csv",
        xml: "text",
        html: "text",
        htm: "text",
        js: "code",
        ts: "code",
        py: "code",
        java: "code",
        cpp: "code",
        c: "code",
        css: "code",
        sql: "code",
        sh: "code",
        bat: "code",
        yaml: "text",
        yml: "text",
        ini: "text",
        log: "text",
        
        // Office Documents (parsed by officeparser)
        pdf: "office",
        docx: "office",
        doc: "office",  // Old Word format - supported by officeparser
        xlsx: "office",
        xls: "office",
        pptx: "office",
        ppt: "office",  // Old PowerPoint format - supported by officeparser
        
        // OpenDocument formats (parsed by officeparser)
        odt: "office",  // OpenDocument Text
        ods: "office",  // OpenDocument Spreadsheet
        odp: "office",  // OpenDocument Presentation
        
        // Rich text (parsed by officeparser)
        rtf: "office",
    },
    timeout: 30000,
};

// ═══════════════════════════════════════════════════════════════════════════════
// FILE CONTENT STORAGE (per thread)
// ═══════════════════════════════════════════════════════════════════════════════

/** @type {Map<string, Object[]>} Thread ID -> Array of file contexts */
const fileContexts = new Map();

/** @type {number} Max files to remember per thread */
const MAX_FILES_PER_THREAD = 5;

// ═══════════════════════════════════════════════════════════════════════════════
// DOWNLOAD HELPER
// ═══════════════════════════════════════════════════════════════════════════════

/** @type {Object|null} Stored API instance for authenticated downloads */
let storedApi = null;

/**
 * Set the API instance for authenticated downloads
 * @param {Object} api - API instance with ctx.jar property containing cookies
 */
function setApi(api) {
    storedApi = api;
    // Debug: Log what we received
    const hasCtx = !!api?.ctx;
    const hasJar = !!api?.ctx?.jar;
    const hasCookies = !!api?.ctx?.jar?.getCookiesSync;
    console.debug(`[FileAnalysis] setApi called - hasCtx: ${hasCtx}, hasJar: ${hasJar}, hasCookies: ${hasCookies}`);
}

/**
 * Get cookies from API jar for Facebook CDN authentication
 * @param {string} domain - Domain to get cookies for
 * @returns {string} Cookie header string
 */
function getCookieHeader(domain = "https://www.facebook.com") {
    if (!storedApi) {
        console.debug("[FileAnalysis] getCookieHeader: No API stored");
        return "";
    }
    
    try {
        // The API jar is stored in api.ctx.jar (from the context)
        const jar = storedApi.ctx?.jar;
        if (!jar) {
            console.debug("[FileAnalysis] getCookieHeader: No jar found in api.ctx");
            return "";
        }
        
        // getCookiesSync returns array of cookie objects, join with "; "
        const cookies = jar.getCookiesSync(domain);
        if (!cookies || !Array.isArray(cookies)) {
            console.debug(`[FileAnalysis] getCookieHeader: No cookies for ${domain}`);
            return "";
        }
        
        const cookieString = cookies.join("; ");
        console.debug(`[FileAnalysis] getCookieHeader (${domain}): Got ${cookies.length} cookies`);
        return cookieString || "";
    } catch (err) {
        console.debug("[FileAnalysis] Failed to get cookies:", err.message);
        return "";
    }
}

/**
 * Unwrap Facebook redirect URLs (l.facebook.com/l.php?u=...)
 * These are tracking wrappers that redirect to the actual CDN URL
 * @param {string} url - Potentially wrapped URL
 * @returns {string} Unwrapped direct URL
 */
function unwrapFacebookRedirect(url) {
    try {
        const parsedUrl = new URL(url);
        
        // Check if this is a Facebook redirect link
        if (parsedUrl.hostname === "l.facebook.com" && parsedUrl.pathname === "/l.php") {
            const actualUrl = parsedUrl.searchParams.get("u");
            if (actualUrl) {
                console.debug(`[FileAnalysis] Unwrapped redirect URL`);
                console.debug(`[FileAnalysis]   From: ${url.substring(0, 60)}...`);
                console.debug(`[FileAnalysis]   To: ${actualUrl.substring(0, 60)}...`);
                return actualUrl;
            }
        }
        
        return url;
    } catch {
        return url;
    }
}

/**
 * Download file from URL to buffer
 * @param {string} url - File URL
 * @returns {Promise<{buffer: Buffer, contentType: string}>}
 */
async function downloadFile(url) {
    // First, unwrap any Facebook redirect URLs
    const actualUrl = unwrapFacebookRedirect(url);
    
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error("Download timeout"));
        }, CONFIG.timeout);

        try {
            const parsedUrl = new URL(actualUrl);
            const protocol = parsedUrl.protocol === "https:" ? https : http;
            
            // Build headers with cookies for Facebook CDN
            const headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "*/*",
                "Accept-Language": "en-US,en;q=0.9",
            };
            
            // Add cookies for Facebook CDN URLs
            if (parsedUrl.hostname.includes("facebook.com") || 
                parsedUrl.hostname.includes("fbcdn.net") || 
                parsedUrl.hostname.includes("cdn.fbsbx.com") ||
                parsedUrl.hostname.includes("fbsbx.com")) {
                // Get cookies from multiple domains to ensure we have all needed auth
                const fbCookies = getCookieHeader("https://www.facebook.com");
                const cdnCookies = getCookieHeader("https://cdn.fbsbx.com");
                const allCookies = [fbCookies, cdnCookies].filter(Boolean).join("; ");
                if (allCookies) {
                    headers["Cookie"] = allCookies;
                    console.debug(`[FileAnalysis] Using combined cookies`);
                }
                // Also add referer which some CDN links require
                headers["Referer"] = "https://www.facebook.com/";
                headers["Origin"] = "https://www.facebook.com";
            }
            
            // Debug log the URL (truncated)
            const truncatedUrl = actualUrl.length > 80 ? actualUrl.substring(0, 80) + "..." : actualUrl;
            console.debug(`[FileAnalysis] Downloading from: ${truncatedUrl}`);
            console.debug(`[FileAnalysis] Hostname: ${parsedUrl.hostname}`);

            protocol.get(actualUrl, { headers }, (response) => {
                // Debug log response
                console.debug(`[FileAnalysis] Response status: ${response.statusCode}`);
                
                // Handle redirects
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    clearTimeout(timeout);
                    console.debug(`[FileAnalysis] Redirecting to: ${response.headers.location.substring(0, 80)}...`);
                    return downloadFile(response.headers.location).then(resolve).catch(reject);
                }

                if (response.statusCode !== 200) {
                    clearTimeout(timeout);
                    return reject(new Error(`HTTP ${response.statusCode}`));
                }

                const chunks = [];
                let totalSize = 0;

                response.on("data", (chunk) => {
                    totalSize += chunk.length;
                    if (totalSize > CONFIG.maxFileSize) {
                        response.destroy();
                        clearTimeout(timeout);
                        reject(new Error("File too large"));
                        return;
                    }
                    chunks.push(chunk);
                });

                response.on("end", () => {
                    clearTimeout(timeout);
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

// ═══════════════════════════════════════════════════════════════════════════════
// FILE PARSERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse plain text file
 * @param {Buffer} buffer - File buffer
 * @returns {string} Extracted text
 */
function parseText(buffer) {
    return buffer.toString("utf-8").substring(0, CONFIG.maxTextLength);
}

/**
 * Parse JSON file
 * @param {Buffer} buffer - File buffer
 * @returns {string} Formatted JSON string
 */
function parseJSON(buffer) {
    try {
        const data = JSON.parse(buffer.toString("utf-8"));
        return JSON.stringify(data, null, 2).substring(0, CONFIG.maxTextLength);
    } catch {
        return buffer.toString("utf-8").substring(0, CONFIG.maxTextLength);
    }
}

/**
 * Parse CSV file
 * @param {Buffer} buffer - File buffer
 * @returns {string} CSV as readable text
 */
function parseCSV(buffer) {
    const text = buffer.toString("utf-8");
    const lines = text.split("\n").slice(0, 100); // First 100 rows
    
    // Try to detect delimiter
    const firstLine = lines[0] || "";
    const delimiter = firstLine.includes("\t") ? "\t" : 
                     firstLine.includes(";") ? ";" : ",";
    
    // Format as table
    const rows = lines.map(line => line.split(delimiter));
    const headers = rows[0] || [];
    
    let result = `CSV Data (${rows.length} rows, ${headers.length} columns)\n`;
    result += `Headers: ${headers.join(" | ")}\n\n`;
    
    // Show first 20 data rows
    for (let i = 1; i < Math.min(21, rows.length); i++) {
        result += `Row ${i}: ${rows[i].join(" | ")}\n`;
    }
    
    if (rows.length > 21) {
        result += `\n... and ${rows.length - 21} more rows`;
    }
    
    return result.substring(0, CONFIG.maxTextLength);
}

/**
 * Parse code file with syntax info
 * @param {Buffer} buffer - File buffer
 * @param {string} ext - File extension
 * @returns {string} Code content with header
 */
function parseCode(buffer, ext) {
    const content = buffer.toString("utf-8");
    const lines = content.split("\n");
    
    let result = `Code File (.${ext}) - ${lines.length} lines\n`;
    result += "─".repeat(40) + "\n";
    result += content.substring(0, CONFIG.maxTextLength);
    
    return result;
}

/**
 * Parse Office documents using multiple methods (PDF, DOCX, DOC, XLSX, XLS, PPTX, PPT, ODT, ODS, ODP, RTF)
 * Primary: pdf-parse for PDF, adm-zip for OOXML formats, officeparser as fallback
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename
 * @param {string} ext - File extension
 * @returns {Promise<string>} Extracted text
 */
async function parseOfficeDocument(buffer, filename, ext) {
    // Debug: Log first bytes to see what we downloaded
    const firstBytes = buffer.slice(0, 100).toString("utf-8");
    console.debug(`[FileAnalysis] parseOfficeDocument: First 50 bytes: "${firstBytes.substring(0, 50).replace(/\n/g, "\\n")}"`);
    console.debug(`[FileAnalysis] Buffer size: ${buffer.length} bytes`);
    
    // Check if the downloaded content is actually HTML (error page from CDN)
    const firstBytesLower = firstBytes.toLowerCase();
    if (firstBytesLower.includes("<!doctype") || firstBytesLower.includes("<html") || firstBytesLower.includes("<!DOCTYPE")) {
        console.debug("[FileAnalysis] Detected HTML content instead of document");
        return `[${getDocTypeEmoji(ext)} ${getDocTypeName(ext)} - "${filename}"]\n\n⚠️ Unable to download file. The file link may have expired or requires authentication. Please try re-uploading the file.`;
    }
    
    // PDF files - use pdf-parse (most reliable for PDFs)
    if (ext === "pdf") {
        // Verify it's actually a PDF (should start with %PDF-)
        const pdfSignature = buffer.slice(0, 5).toString("utf-8");
        if (!pdfSignature.startsWith("%PDF-")) {
            return `[📕 PDF Document - "${filename}"]\n\n⚠️ Invalid PDF file. The file appears to be corrupted or not a real PDF document.`;
        }
        
        try {
            const { PDFParse } = require("pdf-parse");
            // Convert Buffer to Uint8Array as required by pdf-parse
            const uint8Array = new Uint8Array(buffer);
            const parser = new PDFParse(uint8Array);
            await parser.load();
            const result = await parser.getText();
            
            const text = result.text?.trim() || "";
            const wordCount = text.split(/\s+/).filter(Boolean).length;
            const pageCount = result.total || result.pages?.length || 0;
            
            if (wordCount < 10) {
                return `[📕 PDF Document - "${filename}"]\n\n⚠️ This PDF appears to be scanned/image-based. Only ${wordCount} words could be extracted. Pages: ${pageCount}`;
            }
            
            let output = `📕 PDF Document (${filename}) - ${pageCount} pages\n`;
            output += "═".repeat(40) + "\n\n";
            output += text;
            return output.substring(0, CONFIG.maxTextLength);
        } catch (pdfError) {
            // Try officeparser as fallback
            if (officeParser) {
                try {
                    const ast = await officeParser.parseOffice(buffer, {
                        outputErrorToConsole: false,
                        newlineDelimiter: "\n",
                    });
                    const text = ast.toText ? ast.toText() : String(ast);
                    if (text && text.trim().length > 0) {
                        let output = `📕 PDF Document (${filename})\n`;
                        output += "═".repeat(40) + "\n\n";
                        output += text;
                        return output.substring(0, CONFIG.maxTextLength);
                    }
                } catch {
                    // officeparser failed too
                }
            }
            return `[📕 PDF Document - "${filename}"]\n\n⚠️ Error reading PDF: ${pdfError.message}`;
        }
    }
    
    // ZIP-based formats (DOCX, XLSX, PPTX) - use adm-zip
    if (["docx", "xlsx", "pptx"].includes(ext)) {
        try {
            const AdmZip = require("adm-zip");
            const zip = new AdmZip(buffer);
            
            if (ext === "docx") {
                const docXml = zip.readAsText("word/document.xml");
                if (docXml) {
                    let text = docXml
                        .replace(/<w:p[^>]*>/g, "\n")
                        .replace(/<w:tab[^>]*\/>/g, "\t")
                        .replace(/<w:br[^>]*\/>/g, "\n")
                        .replace(/<[^>]+>/g, "")
                        .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
                        .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
                        .replace(/&apos;/g, "'")
                        .replace(/\n{3,}/g, "\n\n").trim();
                    
                    if (text) {
                        const wordCount = text.split(/\s+/).filter(Boolean).length;
                        let result = `📄 Word Document (${filename}) - ${wordCount} words\n`;
                        result += "═".repeat(40) + "\n\n";
                        result += text;
                        return result.substring(0, CONFIG.maxTextLength);
                    }
                }
            }
            
            if (ext === "pptx") {
                const entries = zip.getEntries();
                const slideEntries = entries
                    .filter(e => e.entryName.match(/^ppt\/slides\/slide\d+\.xml$/))
                    .sort((a, b) => {
                        const numA = parseInt(a.entryName.match(/slide(\d+)/)[1]);
                        const numB = parseInt(b.entryName.match(/slide(\d+)/)[1]);
                        return numA - numB;
                    });
                
                const slides = [];
                for (const entry of slideEntries) {
                    const slideXml = zip.readAsText(entry.entryName);
                    const texts = [];
                    const matches = slideXml.matchAll(/<a:t>([^<]*)<\/a:t>/g);
                    for (const m of matches) {
                        if (m[1]?.trim()) texts.push(m[1].trim());
                    }
                    if (texts.length > 0) {
                        const slideNum = entry.entryName.match(/slide(\d+)/)[1];
                        slides.push({ num: slideNum, text: texts.join(" ") });
                    }
                }
                
                if (slides.length > 0) {
                    let result = `📽️ PowerPoint Presentation (${filename}) - ${slides.length} slides\n`;
                    result += "═".repeat(40) + "\n\n";
                    for (const s of slides) {
                        result += `📌 Slide ${s.num}:\n${s.text}\n\n`;
                    }
                    return result.substring(0, CONFIG.maxTextLength);
                }
            }
            
            if (ext === "xlsx") {
                const sharedStrings = zip.readAsText("xl/sharedStrings.xml") || "";
                const strings = [];
                const strMatches = sharedStrings.matchAll(/<t[^>]*>([^<]*)<\/t>/g);
                for (const m of strMatches) if (m[1]) strings.push(m[1]);
                
                if (strings.length > 0) {
                    let result = `📊 Excel Spreadsheet (${filename}) - ${strings.length} cells\n`;
                    result += "═".repeat(40) + "\n\n";
                    result += strings.slice(0, 500).join("\n");
                    return result.substring(0, CONFIG.maxTextLength);
                }
            }
        } catch (zipError) {
            // Try officeparser as fallback
            if (officeParser) {
                try {
                    const ast = await officeParser.parseOffice(buffer, {
                        outputErrorToConsole: false,
                        newlineDelimiter: "\n",
                    });
                    const text = ast.toText ? ast.toText() : String(ast);
                    if (text && text.trim().length > 0) {
                        let output = `${getDocTypeEmoji(ext)} ${getDocTypeName(ext)} (${filename})\n`;
                        output += "═".repeat(40) + "\n\n";
                        output += text;
                        return output.substring(0, CONFIG.maxTextLength);
                    }
                } catch {
                    // officeparser failed too
                }
            }
            return `[${getDocTypeEmoji(ext)} ${getDocTypeName(ext)} - "${filename}"]\n\n⚠️ Error reading file: ${zipError.message}`;
        }
    }
    
    // Legacy formats (DOC, XLS, PPT) and other Office formats - use officeparser only
    if (officeParser) {
        try {
            const ast = await officeParser.parseOffice(buffer, {
                outputErrorToConsole: false,
                newlineDelimiter: "\n",
            });
            
            const text = ast.toText ? ast.toText() : (typeof ast === "string" ? ast : String(ast));
            
            if (!text || text.trim().length === 0) {
                return `[${getDocTypeEmoji(ext)} ${getDocTypeName(ext)} - "${filename}"]\n\n⚠️ No text content could be extracted. The document may be empty or contain only images/media.`;
            }
            
            let result = `${getDocTypeEmoji(ext)} ${getDocTypeName(ext)} (${filename})\n`;
            result += "═".repeat(40) + "\n\n";
            result += text;
            
            return result.substring(0, CONFIG.maxTextLength);
        } catch (error) {
            const errorMessage = error.message || String(error);
            
            if (errorMessage.includes("signature")) {
                return `[${getDocTypeEmoji(ext)} ${getDocTypeName(ext)} - "${filename}"]\n\n⚠️ Invalid or corrupted file.`;
            }
            
            if (errorMessage.includes("password")) {
                return `[${getDocTypeEmoji(ext)} ${getDocTypeName(ext)} - "${filename}"]\n\n🔒 This document is password protected.`;
            }
            
            return `[${getDocTypeEmoji(ext)} ${getDocTypeName(ext)} - "${filename}"]\n\n⚠️ Error reading file: ${errorMessage}\n\nLegacy Office formats (.doc, .xls, .ppt) may have limited support. Try converting to a newer format.`;
        }
    }
    
    return `[${getDocTypeEmoji(ext)} ${getDocTypeName(ext)} - "${filename}"]\n\n⚠️ Office document parsing requires 'officeparser' or 'pdf-parse' package.`;
}

/**
 * Get document type emoji
 * @param {string} ext - File extension
 * @returns {string} Emoji
 */
function getDocTypeEmoji(ext) {
    const emojis = {
        pdf: "📕",
        docx: "📄",
        doc: "📄",
        xlsx: "📊",
        xls: "📊",
        pptx: "📽️",
        ppt: "📽️",
        odt: "📝",
        ods: "📈",
        odp: "📺",
        rtf: "📃",
    };
    return emojis[ext.toLowerCase()] || "📄";
}

/**
 * Get document type name
 * @param {string} ext - File extension
 * @returns {string} Readable type name
 */
function getDocTypeName(ext) {
    const names = {
        pdf: "PDF Document",
        docx: "Word Document",
        doc: "Word Document (97-2003)",
        xlsx: "Excel Spreadsheet",
        xls: "Excel Spreadsheet (97-2003)",
        pptx: "PowerPoint Presentation",
        ppt: "PowerPoint Presentation (97-2003)",
        odt: "OpenDocument Text",
        ods: "OpenDocument Spreadsheet",
        odp: "OpenDocument Presentation",
        rtf: "Rich Text Document",
    };
    return names[ext.toLowerCase()] || `${ext.toUpperCase()} Document`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Analyze a file attachment and extract its content
 * @param {Object} attachment - File attachment object
 * @returns {Promise<Object|null>} File analysis result
 */
async function analyzeFile(attachment) {
    if (!attachment) {
        return null;
    }
    
    // Debug: Log all attachment properties
    console.debug(`[FileAnalysis] Attachment keys: ${Object.keys(attachment).join(", ")}`);
    console.debug(`[FileAnalysis] Attachment url: ${attachment.url?.substring(0, 100)}...`);
    if (attachment.fileUrl) console.debug(`[FileAnalysis] Attachment fileUrl: ${attachment.fileUrl?.substring(0, 100)}...`);
    if (attachment.rawUrl) console.debug(`[FileAnalysis] Attachment rawUrl: ${attachment.rawUrl?.substring(0, 100)}...`);
    
    // Accept both "file" type and attachments with file-like properties
    const isFile = attachment.type === "file" || 
                   (attachment.filename && attachment.url) ||
                   (attachment.name && attachment.url);
    
    if (!isFile) {
        return null;
    }
    
    // Try multiple URL sources - prefer rawUrl or fileUrl over url if available
    const url = attachment.rawUrl || attachment.fileUrl || attachment.url || attachment.previewUrl || attachment.largePreviewUrl;
    const filename = attachment.filename || attachment.name || attachment.fullFileName || "unknown";
    const ext = path.extname(filename).toLowerCase().slice(1) || "txt";
    
    if (!url) {
        return null;
    }
    
    // Check if file type is supported
    const fileType = CONFIG.supportedTypes[ext];
    if (!fileType) {
        return {
            filename,
            extension: ext,
            supported: false,
            content: `[Unsupported file type: .${ext}]`,
            summary: `File "${filename}" has unsupported format (.${ext})`,
        };
    }
    
    try {
        // Download the file
        const { buffer } = await downloadFile(url);
        
        // Parse based on type
        let content;
        switch (fileType) {
            case "text":
                content = parseText(buffer);
                break;
            case "json":
                content = parseJSON(buffer);
                break;
            case "csv":
                content = parseCSV(buffer);
                break;
            case "code":
                content = parseCode(buffer, ext);
                break;
            case "office":
                // Use officeparser for all Office formats: PDF, DOCX, DOC, XLSX, XLS, PPTX, PPT, ODT, ODS, ODP, RTF
                content = await parseOfficeDocument(buffer, filename, ext);
                break;
            default:
                content = parseText(buffer);
        }
        
        // Generate summary
        const wordCount = content.split(/\s+/).filter(Boolean).length;
        const lineCount = content.split("\n").length;
        
        return {
            filename,
            extension: ext,
            fileType,
            supported: true,
            content,
            wordCount,
            lineCount,
            summary: `📄 **${filename}**\nType: ${ext.toUpperCase()}\nWords: ~${wordCount}\nLines: ${lineCount}`,
            timestamp: Date.now(),
        };
    } catch (error) {
        return {
            filename,
            extension: ext,
            supported: true,
            error: error.message,
            content: `[Error reading file: ${error.message}]`,
            summary: `Failed to read "${filename}": ${error.message}`,
        };
    }
}

/**
 * Store file context for a thread
 * @param {string} threadID - Thread ID
 * @param {Object} fileData - Analyzed file data
 */
function storeFileContext(threadID, fileData) {
    if (!fileData || !fileData.content) return;
    
    if (!fileContexts.has(threadID)) {
        fileContexts.set(threadID, []);
    }
    
    const contexts = fileContexts.get(threadID);
    
    // Add new file context
    contexts.unshift({
        ...fileData,
        addedAt: Date.now(),
    });
    
    // Keep only recent files
    while (contexts.length > MAX_FILES_PER_THREAD) {
        contexts.pop();
    }
}

/**
 * Get file contexts for a thread
 * @param {string} threadID - Thread ID
 * @returns {Object[]} Array of file contexts
 */
function getFileContexts(threadID) {
    return fileContexts.get(threadID) || [];
}

/**
 * Clear file contexts for a thread
 * @param {string} threadID - Thread ID
 */
function clearFileContexts(threadID) {
    fileContexts.delete(threadID);
}

/**
 * Get formatted file context for AI prompt
 * @param {string} threadID - Thread ID
 * @returns {string} Formatted context string
 */
function getFormattedFileContext(threadID) {
    const contexts = getFileContexts(threadID);
    
    if (contexts.length === 0) {
        return "";
    }
    
    let result = "\n\n📁 **UPLOADED FILES IN THIS CHAT:**\n";
    result += "═".repeat(40) + "\n";
    
    for (const file of contexts) {
        result += `\n📄 *${file.filename}* (${file.extension.toUpperCase()})\n`;
        
        // Truncate content for prompt
        const maxContent = 10000; // 10k chars per file in prompt
        let content = file.content || "[No content]";
        if (content.length > maxContent) {
            content = content.substring(0, maxContent) + "\n... [content truncated]";
        }
        
        // Wrap content in code block format for AI to understand structure
        result += "Content:\n```\n" + content + "\n```\n";
    }
    
    result += "\n" + "═".repeat(40) + "\n";
    result += "💡 When displaying file content to users, ALWAYS use code blocks (\\`\\`\\`) for better readability!\n";
    
    return result;
}

/**
 * Process attachments from a message and extract file contents
 * @param {Object} event - Message event
 * @param {Object} [logger] - Optional logger for debugging
 * @returns {Promise<Object[]>} Array of analyzed files
 */
async function processMessageFiles(event, logger = null) {
    const allAttachments = [
        ...(event.attachments || []),
        ...(event.messageReply?.attachments || []),
    ];
    
    // Debug: Log all attachments to see what types we're getting
    if (logger && allAttachments.length > 0) {
        logger.debug("FileAnalysis", `Found ${allAttachments.length} attachments: ${allAttachments.map(a => `${a.type}:${a.filename || a.name || "unknown"}`).join(", ")}`);
    }
    
    // Filter for file attachments (type="file" OR has filename + url that isn't media)
    const fileAttachments = allAttachments.filter(att => 
        att.type === "file" || 
        (att.filename && att.url && !["photo", "video", "audio", "sticker", "animated_image"].includes(att.type))
    );
    
    if (logger && fileAttachments.length > 0) {
        logger.debug("FileAnalysis", `Processing ${fileAttachments.length} file attachments`);
    }
    
    const results = [];
    
    for (const attachment of fileAttachments) {
        try {
            const analysis = await analyzeFile(attachment);
            if (analysis) {
                results.push(analysis);
                if (logger) {
                    logger.debug("FileAnalysis", `✅ Analyzed: ${analysis.filename} (${analysis.supported ? "supported" : "unsupported"})`);
                }
            }
        } catch (error) {
            if (logger) {
                logger.error("FileAnalysis", `Failed to analyze ${attachment.filename || "file"}: ${error.message}`);
            }
        }
    }
    
    return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    // Main functions
    analyzeFile,
    processMessageFiles,
    setApi,
    
    // Context management
    storeFileContext,
    getFileContexts,
    clearFileContexts,
    getFormattedFileContext,
    
    // Config
    CONFIG,
};
