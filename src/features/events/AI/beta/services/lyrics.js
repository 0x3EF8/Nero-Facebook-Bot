/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                         LYRICS SERVICE MODULE                                 ║
 * ║              Handles fetching lyrics from Genius API                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module services/lyrics
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const axios = require("axios");
const cheerio = require("cheerio");
const config = require("../../../../../config/config");

// Genius access token cache
let GENIUS_ACCESS_TOKEN = null;

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
        return GENIUS_ACCESS_TOKEN;
    } catch (error) {
        console.error("Error getting Genius access token:", error.message);
        GENIUS_ACCESS_TOKEN = config.geniusClientId;
        return GENIUS_ACCESS_TOKEN;
    }
}

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

/**
 * Fetch lyrics from Genius
 * @param {string} songTitle - Song title
 * @param {string} artist - Artist name
 * @returns {Promise<string|null>} Lyrics or null
 */
async function fetchLyrics(songTitle, artist) {
    try {
        const accessToken = await getGeniusAccessToken();
        const cleanTitle = cleanSongTitle(songTitle);
        const searchQuery = `${cleanTitle} ${artist}`;

        const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(searchQuery)}`;
        const searchResponse = await axios.get(searchUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 10000,
        });

        if (!searchResponse.data.response.hits.length) {
            return null;
        }

        // Find best match
        let bestMatch = null;
        for (const hit of searchResponse.data.response.hits) {
            const result = hit.result;
            if (
                result.url.includes("-script-") ||
                result.url.includes("-annotated") ||
                result.title.toLowerCase().includes("script") ||
                result.title.toLowerCase().includes("tracklist")
            ) {
                continue;
            }

            const artistMatch =
                result.primary_artist.name.toLowerCase().includes(artist.toLowerCase()) ||
                artist.toLowerCase().includes(result.primary_artist.name.toLowerCase());

            if (artistMatch) {
                bestMatch = result;
                break;
            }
        }

        if (!bestMatch) {
            bestMatch = searchResponse.data.response.hits[0].result;
        }

        // Fetch lyrics page
        const pageResponse = await axios.get(bestMatch.url, {
            timeout: 10000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
        });

        const $ = cheerio.load(pageResponse.data);
        let lyrics = "";

        const selectors = [
            '[class*="Lyrics__Container"]',
            '[data-lyrics-container="true"]',
            ".lyrics",
            '[class*="lyrics"]',
        ];

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

        if (!lyrics) {
            return null;
        }

        return cleanLyrics(lyrics);
    } catch (error) {
        console.error("Error fetching lyrics:", error.message);
        return null;
    }
}

module.exports = {
    fetchLyrics,
    getGeniusAccessToken,
    cleanSongTitle,
    cleanLyrics,
};
