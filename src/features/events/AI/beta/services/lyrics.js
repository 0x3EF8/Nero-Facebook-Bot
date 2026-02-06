/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                         LYRICS SERVICE MODULE                                 ║
 * ║              Handles fetching lyrics from Genius API                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module services/lyrics
 * @author 0x3EF8
 * @version 2.0.0
 */

"use strict";

const axios = require("axios");
const cheerio = require("cheerio");
const config = require("../../../../../config/config");
const { DEBUG } = require("../core/constants");

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL LOGGER
// ═══════════════════════════════════════════════════════════════════════════════

const PREFIX = "[Lyrics]";

/**
 * Internal logger for lyrics service
 * @param {string} level - Log level
 * @param {string} message - Log message
 */
function log(level, message) {
    if (!DEBUG && level === "debug") return;
    const timestamp = new Date().toISOString();
    console[level === "error" ? "error" : "log"](`${timestamp} ${PREFIX} ${message}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const API_TIMEOUT = 10000;

/**
 * Genius access token cache
 * @type {string|null}
 */
let GENIUS_ACCESS_TOKEN = null;

// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get Genius API access token
 * @returns {Promise<string>} Access token
 */
async function getGeniusAccessToken() {
    if (GENIUS_ACCESS_TOKEN) {
        return GENIUS_ACCESS_TOKEN;
    }

    try {
        const tokenUrl = "https://api.genius.com/oauth/token";
        const response = await axios.post(tokenUrl, {
            client_id: config.geniusClientId,
            client_secret: config.geniusClientSecret,
            grant_type: "client_credentials",
        });

        GENIUS_ACCESS_TOKEN = response.data.access_token;
        log("debug", "Genius access token obtained");
        return GENIUS_ACCESS_TOKEN;
    } catch (error) {
        log("error", `Failed to get Genius access token: ${error.message}`);
        GENIUS_ACCESS_TOKEN = config.geniusClientId;
        return GENIUS_ACCESS_TOKEN;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLEANING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Clean song title for search
 * @param {string} title - Raw title
 * @returns {string} Cleaned title
 */
function cleanSongTitle(title) {
    return title
        .replace(/\(.*?official.*?\)/gi, "")
        .replace(/\[.*?official.*?\]/gi, "")
        .replace(/official music video/gi, "")
        .replace(/official video/gi, "")
        .replace(/lyrics video/gi, "")
        .replace(/lyric video/gi, "")
        .trim();
}

/**
 * Clean lyrics text from metadata
 * @param {string} lyrics - Raw lyrics
 * @returns {string} Cleaned lyrics
 */
function cleanLyrics(lyrics) {
    let cleaned = lyrics.trim();

    // Remove all metadata/junk from Genius
    cleaned = cleaned.replace(/^\d+\s+Contributors?.*?Lyrics/gis, "");
    cleaned = cleaned.replace(/^.*?Read More\s*/is, "");
    cleaned = cleaned.replace(/\d+\s*Contributors?/gi, "");
    cleaned = cleaned.replace(/Translations?/gi, "");
    cleaned = cleaned.replace(
        /Italiano|Afrikaans|Français|srpski|Türkçe|Español|Português|Polski|Magyar|Українська|Tiếng Việt|Česky|Deutsch|Slovenščina|한국어|日本語|中文|العربية|עברית|ไทย|Indonesia|Nederlands|Русский|Ελληνικά|Română|Svenska|Norsk|Dansk|Suomi|Čeština/gi,
        ""
    );
    cleaned = cleaned.replace(/^You might also like.*$/gim, "");
    cleaned = cleaned.replace(/See.*Live.*Get tickets as low as \$\d+/gi, "");
    cleaned = cleaned.replace(/Embed$/gim, "");
    cleaned = cleaned.replace(/\[.*?\]\s*$/gm, function (match) {
        if (/\[(Verse|Chorus|Intro|Bridge|Pre-Chorus|Outro|Refrain|Hook|Interlude)/i.test(match)) {
            return match;
        }
        return "";
    });

    const lines = cleaned.split("\n");
    let startIndex = 0;

    // Find where actual lyrics start
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (
            line.match(
                /^\[(?:Verse|Chorus|Intro|Bridge|Pre-Chorus|Outro|Refrain|Hook|Interlude)/i
            ) ||
            (line.length > 0 &&
                !line.includes("Read More") &&
                !line.includes("Lyrics") &&
                !line.includes("Contributors") &&
                !line.includes("Translations") &&
                !/^(Italiano|Afrikaans|Français|srpski|Türkçe|Español|Português)$/i.test(line) &&
                i < 15)
        ) {
            startIndex = i;
            break;
        }
    }

    // Clean up and filter empty lines
    cleaned = lines
        .slice(startIndex)
        .map((line) => line.trim())
        .filter((line) => {
            // Filter out language names
            if (
                /^(Italiano|Afrikaans|Français|srpski|Türkçe|Español|Português|Polski|Magyar|Українська|Tiếng Việt|Česky|Deutsch|Slovenščina|한국어|日本語|中文)$/i.test(
                    line
                )
            ) {
                return false;
            }
            // Filter out contributor counts
            if (/^\d+\s*Contributors?$/i.test(line)) {
                return false;
            }
            // Filter out translations label
            if (/^Translations?$/i.test(line)) {
                return false;
            }
            // Filter out embed text
            if (/^Embed$/i.test(line)) {
                return false;
            }
            // Filter out recommendations
            if (/^You might also like$/i.test(line)) {
                return false;
            }
            return true;
        })
        .join("\n")
        .trim();

    // Remove multiple consecutive empty lines
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

    return cleaned;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if result should be skipped (scripts, annotations, tracklists)
 * @param {Object} result - Search result
 * @returns {boolean} True if should skip
 */
function shouldSkipResult(result) {
    return (
        result.url.includes("-script-") ||
        result.url.includes("-annotated") ||
        result.title.toLowerCase().includes("script") ||
        result.title.toLowerCase().includes("tracklist")
    );
}

/**
 * Check if artist matches result
 * @param {Object} result - Search result
 * @param {string} artist - Artist name
 * @returns {boolean} True if matches
 */
function isArtistMatch(result, artist) {
    const resultArtist = result.primary_artist.name.toLowerCase();
    const searchArtist = artist.toLowerCase();
    return resultArtist.includes(searchArtist) || searchArtist.includes(resultArtist);
}

/**
 * Find best matching result from search hits
 * @param {Array} hits - Search hits
 * @param {string} artist - Artist name
 * @returns {Object|null} Best match or null
 */
function findBestMatch(hits, artist) {
    for (const hit of hits) {
        const result = hit.result;
        if (shouldSkipResult(result)) continue;
        if (isArtistMatch(result, artist)) return result;
    }
    return hits[0]?.result || null;
}

/**
 * Extract lyrics from page HTML
 * @param {Object} $ - Cheerio instance
 * @returns {string} Extracted lyrics
 */
function extractLyricsFromPage($) {
    const selectors = [
        '[class*="Lyrics__Container"]',
        '[data-lyrics-container="true"]',
        ".lyrics",
        '[class*="lyrics"]',
    ];

    let lyrics = "";

    for (const selector of selectors) {
        $(selector).each((_i, elem) => {
            const html = $(elem).html();
            if (html) {
                const textWithBreaks = html
                    .replace(/<br\s*\/?>/gi, "\n")
                    .replace(/<\/div>/gi, "\n")
                    .replace(/<div[^>]*>/gi, "");

                const decoded = $("<div>").html(textWithBreaks).text();
                lyrics += decoded.trim() + "\n\n";
            }
        });
        if (lyrics) break;
    }

    return lyrics;
}

/**
 * Fetch lyrics from Genius
 * @param {string} songTitle - Song title
 * @param {string} artist - Artist name
 * @returns {Promise<string|null>} Lyrics or null
 */
async function fetchLyrics(songTitle, artist) {
    try {
        log("debug", `Fetching lyrics for: ${songTitle} by ${artist}`);
        
        const accessToken = await getGeniusAccessToken();
        const cleanTitle = cleanSongTitle(songTitle);
        const searchQuery = `${cleanTitle} ${artist}`;

        const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(searchQuery)}`;
        const searchResponse = await axios.get(searchUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: API_TIMEOUT,
        });

        if (!searchResponse.data.response.hits.length) {
            log("debug", `No lyrics found for: ${searchQuery}`);
            return null;
        }

        const bestMatch = findBestMatch(searchResponse.data.response.hits, artist);
        if (!bestMatch) {
            log("debug", `No suitable match found for: ${searchQuery}`);
            return null;
        }

        // Fetch lyrics page
        const pageResponse = await axios.get(bestMatch.url, {
            timeout: API_TIMEOUT,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
        });

        const $ = cheerio.load(pageResponse.data);
        const lyrics = extractLyricsFromPage($);

        if (!lyrics) {
            log("debug", `Failed to extract lyrics from page: ${bestMatch.url}`);
            return null;
        }

        log("info", `Lyrics fetched for: ${songTitle}`);
        return cleanLyrics(lyrics);
    } catch (error) {
        log("error", `Error fetching lyrics: ${error.message}`);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    fetchLyrics,
    getGeniusAccessToken,
    cleanSongTitle,
    cleanLyrics,
};
