/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                       NERO UNICODE FONT CONVERTER                             ║
 * ║               �𝚘𝚗𝚘𝚜𝚙𝚊𝚌𝚎 - JetBrains Mono style                                ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * Font style: 𝙰𝙱𝙲𝙳𝙴𝙵 - Monospace (code-like, JetBrains Mono inspired)
 *
 * @module utils/fonts
 * @author 0x3EF8
 * @version 2.0.0
 */

"use strict";

// ═══════════════════════════════════════════════════════════════════════════════
// MONOSPACE FONT MAPPING (JetBrains Mono style)
// ═══════════════════════════════════════════════════════════════════════════════

// Monospace: code-like, clean, professional look (similar to JetBrains Mono)
const FONT_MAP = {
    // Uppercase A-Z
    A: "𝙰", B: "𝙱", C: "𝙲", D: "𝙳", E: "𝙴", F: "𝙵", G: "𝙶", H: "𝙷",
    I: "𝙸", J: "𝙹", K: "𝙺", L: "𝙻", M: "𝙼", N: "𝙽", O: "𝙾", P: "𝙿",
    Q: "𝚀", R: "𝚁", S: "𝚂", T: "𝚃", U: "𝚄", V: "𝚅", W: "𝚆", X: "𝚇",
    Y: "𝚈", Z: "𝚉",
    // Lowercase a-z
    a: "𝚊", b: "𝚋", c: "𝚌", d: "𝚍", e: "𝚎", f: "𝚏", g: "𝚐", h: "𝚑",
    i: "𝚒", j: "𝚓", k: "𝚔", l: "𝚕", m: "𝚖", n: "𝚗", o: "𝚘", p: "𝚙",
    q: "𝚚", r: "𝚛", s: "𝚜", t: "𝚝", u: "𝚞", v: "𝚟", w: "𝚠", x: "𝚡",
    y: "𝚢", z: "𝚣",
    // Digits 0-9
    "0": "𝟶", "1": "𝟷", "2": "𝟸", "3": "𝟹", "4": "𝟺",
    "5": "𝟻", "6": "𝟼", "7": "𝟽", "8": "𝟾", "9": "𝟿"
};

// Settings
let fontEnabled = true;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Apply Nero's Monospace font to a response
 * Preserves: emojis, code blocks, URLs, formatting markers (*_`)
 * @param {string} text - Response text
 * @returns {string} Styled text
 */
function applyNeroFont(text) {
    if (!text || typeof text !== "string") return "";
    if (!fontEnabled) return text;
    
    let result = "";
    const chars = [...text]; // Handle Unicode properly
    
    let inCodeBlock = false;
    let inInlineCode = false;
    let i = 0;
    
    while (i < chars.length) {
        const char = chars[i];
        const next = chars[i + 1] || "";
        const nextNext = chars[i + 2] || "";
        
        // Check for code block start/end ```
        if (char === "`" && next === "`" && nextNext === "`") {
            inCodeBlock = !inCodeBlock;
            result += "```";
            i += 3;
            continue;
        }
        
        // Check for inline code start/end `
        if (char === "`" && !inCodeBlock) {
            inInlineCode = !inInlineCode;
            result += char;
            i++;
            continue;
        }
        
        // Skip conversion inside code blocks/inline code
        if (inCodeBlock || inInlineCode) {
            result += char;
            i++;
            continue;
        }
        
        // Check for URLs - skip conversion (look ahead in chars array)
        if (char === "h") {
            const lookAhead = chars.slice(i, i + 8).join("");
            if (lookAhead === "https://" || lookAhead.startsWith("http://")) {
                // Find end of URL (whitespace or end)
                let urlEnd = i;
                while (urlEnd < chars.length && !/\s/.test(chars[urlEnd])) {
                    urlEnd++;
                }
                result += chars.slice(i, urlEnd).join("");
                i = urlEnd;
                continue;
            }
        }
        
        // Check if character is an emoji or special Unicode (high code point)
        const codePoint = char.codePointAt(0);
        if (codePoint > 0x2000) {
            // This is likely an emoji or special Unicode - keep as-is
            result += char;
            i++;
            continue;
        }
        
        // Convert using font map (A-Z, a-z, 0-9)
        if (FONT_MAP[char]) {
            result += FONT_MAP[char];
            i++;
            continue;
        }
        
        // Keep everything else unchanged (punctuation, formatting)
        result += char;
        i++;
    }
    
    return result;
}

/**
 * Convert text to Sans Bold (simple version)
 * @param {string} text - Text to convert
 * @returns {string} Converted text
 */
function toSansBold(text) {
    if (!text) return "";
    return [...text].map(char => FONT_MAP[char] || char).join("");
}

/**
 * Convert Sans Bold text back to normal
 * @param {string} text - Sans Bold text
 * @returns {string} Normal text
 */
function toNormal(text) {
    if (!text) return "";
    
    let result = text;
    for (const [normal, styled] of Object.entries(FONT_MAP)) {
        result = result.replaceAll(styled, normal);
    }
    return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Enable/disable font conversion
 * @param {boolean} enabled - Whether font is enabled
 */
function setEnabled(enabled) {
    fontEnabled = !!enabled;
}

/**
 * Check if font is enabled
 * @returns {boolean} Whether font is enabled
 */
function isEnabled() {
    return fontEnabled;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    applyNeroFont,
    toSansBold,
    toNormal,
    setEnabled,
    isEnabled,
    FONT_MAP
};
