const ytdl = require("@distube/ytdl-core");
const fs = require("fs");

(async () => {
    try {
        const videoId = "dQw4w9WgXcQ"; // Rick Roll
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        console.log(`Attempting download for: ${url}`);

        const stream = ytdl(url, {
            quality: "highestaudio",
            filter: "audioonly"
        });

        stream.pipe(fs.createWriteStream("test_distube.mp3"));

        stream.on("end", () => {
            console.log("Download finished successfully.");
        });

        stream.on("error", (err) => {
            console.error("Download failed:", err);
        });

    } catch (error) {
        console.error("Error:", error);
    }
})();
