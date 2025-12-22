/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                         WEATHER SERVICE MODULE                                ║
 * ║              Handles weather information fetching                             ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * @module services/weather
 * @author 0x3EF8
 * @version 1.0.0
 */

"use strict";

const axios = require("axios");
const chalk = require("chalk");
const { withRetry } = require("../../../../../utils/retry");
const config = require("../../../../../config/config");

// Weather code descriptions with emojis
const WEATHER_CODES = {
    0: "☀️ Clear sky",
    1: "🌤️ Mainly clear",
    2: "⛅ Partly cloudy",
    3: "☁️ Overcast",
    45: "🌫️ Foggy",
    48: "🌫️ Depositing rime fog",
    51: "🌦️ Light drizzle",
    53: "🌦️ Moderate drizzle",
    55: "🌦️ Dense drizzle",
    61: "🌧️ Slight rain",
    63: "🌧️ Moderate rain",
    65: "🌧️ Heavy rain",
    71: "🌨️ Slight snow",
    73: "🌨️ Moderate snow",
    75: "🌨️ Heavy snow",
    80: "🌦️ Slight rain showers",
    81: "🌧️ Moderate rain showers",
    82: "🌧️ Violent rain showers",
    95: "⛈️ Thunderstorm",
    96: "⛈️ Thunderstorm with slight hail",
    99: "⛈️ Thunderstorm with heavy hail",
};

/**
 * Get wind direction from degrees
 * @param {number} degrees - Wind direction in degrees
 * @returns {string} Cardinal direction
 */
function getWindDirection(degrees) {
    const directions = [
        "N",
        "NNE",
        "NE",
        "ENE",
        "E",
        "ESE",
        "SE",
        "SSE",
        "S",
        "SSW",
        "SW",
        "WSW",
        "W",
        "WNW",
        "NW",
        "NNW",
    ];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
}

/**
 * Get weather information for a location
 * @param {Object} api - Facebook API instance
 * @param {string} threadID - Thread identifier
 * @param {string} messageID - Message ID for reactions
 * @param {string} location - Location name
 * @returns {Promise<void>}
 */
async function getWeather(api, threadID, messageID, location) {
    try {
        api.setMessageReaction("🔍", messageID, () => {}, true);

        const searchMsg = await api.sendMessage(
            `🔍 Searching weather for: "${location}"...`,
            threadID
        );

        // Get coordinates
        const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
        const geocodeResponse = await withRetry(() => axios.get(geocodeUrl, { timeout: 10000 }), {
            maxRetries: 3,
            initialDelay: 1000,
            shouldRetry: (error) =>
                error.code === "ECONNRESET" ||
                error.code === "ETIMEDOUT" ||
                error.response?.status >= 500,
        });

        if (!geocodeResponse.data.results || geocodeResponse.data.results.length === 0) {
            api.setMessageReaction("❌", messageID, () => {}, true);
            return api.sendMessage(`❌ Location "${location}" not found.`, threadID, messageID);
        }

        const place = geocodeResponse.data.results[0];
        const placeName = `${place.name}${place.admin1 ? ", " + place.admin1 : ""}${place.country ? ", " + place.country : ""}`;

        await api.editMessage(
            `✅ Found: ${placeName}\n\n⬇️ Getting weather data...`,
            searchMsg.messageID
        );
        api.setMessageReaction("🌤️", messageID, () => {}, true);

        // Get weather data
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relativehumidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weathercode,cloudcover,pressure_msl,surface_pressure,windspeed_10m,winddirection_10m,windgusts_10m&daily=weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_hours,precipitation_probability_max,windspeed_10m_max,windgusts_10m_max,winddirection_10m_dominant&hourly=temperature_2m,relativehumidity_2m,precipitation_probability,precipitation,rain,showers,snowfall,weathercode,cloudcover,visibility,windspeed_10m,winddirection_10m&timezone=${config.bot.timeZone}&forecast_days=3`;
        const weatherResponse = await withRetry(() => axios.get(weatherUrl, { timeout: 15000 }), {
            maxRetries: 3,
            initialDelay: 1000,
            shouldRetry: (error) =>
                error.code === "ECONNRESET" ||
                error.code === "ETIMEDOUT" ||
                error.response?.status >= 500,
        });

        const current = weatherResponse.data.current;
        const daily = weatherResponse.data.daily;
        const hourly = weatherResponse.data.hourly;

        // Format time
        const now = new Date();
        const manilaTime = now.toLocaleString("en-US", {
            timeZone: config.bot.timeZone,
            dateStyle: "full",
            timeStyle: "short",
        });

        const weatherDescription = WEATHER_CODES[current.weathercode] || "🌡️ Unknown";
        const dayNight = current.is_day ? "☀️ Day" : "🌙 Night";

        // Sun times
        const todaySunrise = new Date(daily.sunrise[0]).toLocaleTimeString("en-US", {
            timeZone: config.bot.timeZone,
            hour: "2-digit",
            minute: "2-digit",
        });
        const todaySunset = new Date(daily.sunset[0]).toLocaleTimeString("en-US", {
            timeZone: config.bot.timeZone,
            hour: "2-digit",
            minute: "2-digit",
        });

        // 24h forecast
        const currentHour = now.getHours();
        const forecast24h = [];
        for (let i = 0; i < 24; i += 3) {
            const hourIndex = currentHour + i;
            if (hourIndex < hourly.time.length) {
                const time = new Date(hourly.time[hourIndex]).toLocaleTimeString("en-US", {
                    timeZone: config.bot.timeZone,
                    hour: "2-digit",
                    minute: "2-digit",
                });
                forecast24h.push(
                    `${time}: ${hourly.temperature_2m[hourIndex]}°C ${WEATHER_CODES[hourly.weathercode[hourIndex]] || "🌡️"}`
                );
            }
        }

        // 3-day forecast
        const forecast3day = [];
        for (let i = 0; i < Math.min(3, daily.time.length); i++) {
            const date = new Date(daily.time[i]).toLocaleDateString("en-US", {
                timeZone: config.bot.timeZone,
                weekday: "short",
                month: "short",
                day: "numeric",
            });
            forecast3day.push(
                `${date}: ${daily.temperature_2m_max[i]}°C/${daily.temperature_2m_min[i]}°C ${WEATHER_CODES[daily.weathercode[i]] || "🌡️"}`
            );
        }

        const weatherMessage = `🌍 Weather Report for ${placeName}

📅 ${manilaTime}
${dayNight} • ${weatherDescription}

🌡️ TEMPERATURE
  • Current: ${current.temperature_2m}°C
  • Feels Like: ${current.apparent_temperature}°C
  • High: ${daily.temperature_2m_max[0]}°C | Low: ${daily.temperature_2m_min[0]}°C

💧 HUMIDITY & PRECIPITATION
  • Humidity: ${current.relativehumidity_2m}%
  • Precipitation: ${current.precipitation}mm
  • Rain: ${current.rain}mm | Showers: ${current.showers}mm
  • Chance Today: ${daily.precipitation_probability_max[0] || 0}%

💨 WIND
  • Speed: ${current.windspeed_10m} km/h
  • Direction: ${getWindDirection(current.winddirection_10m)} (${current.winddirection_10m}°)
  • Gusts: ${current.windgusts_10m} km/h

🌅 SUN & UV
  • Sunrise: ${todaySunrise} | Sunset: ${todaySunset}
  • Max UV Index: ${daily.uv_index_max[0]}

📊 24-HOUR FORECAST
${forecast24h.join("\n")}

📆 3-DAY FORECAST
${forecast3day.join("\n")}`;

        await api.sendMessage(weatherMessage, threadID);
        console.log(chalk.green(`✓ Weather sent for: ${placeName}`));
        api.setMessageReaction("✅", messageID, () => {}, true);
    } catch (error) {
        console.error(chalk.red(`✗ Weather error: ${error.message}`));
        api.setMessageReaction("❌", messageID, () => {}, true);

        let errorMessage = "❌ Error getting weather data. Please try again.";
        if (error.message?.includes("timeout")) {
            errorMessage = "❌ Weather service timeout. Please try again later.";
        }

        return api.sendMessage(errorMessage, threadID, messageID);
    }
}

module.exports = {
    getWeather,
    WEATHER_CODES,
    getWindDirection,
};
