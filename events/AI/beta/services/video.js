/**
 * Video Download Service Module
 * Handles video downloading from YouTube
 * 
 * @module services/video
 */

const { Innertube, Utils } = require("youtubei.js");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const { gemini } = require("../core/gemini");

/**
 * Download video from YouTube
 * @param {Object} api - Facebook API instance
 * @param {string} threadID - Thread identifier
 * @param {string} messageID - Message ID for reactions
 * @param {string} query - Search query
 * @param {Object} _model - Unused (uses internal gemini)
 * @returns {Promise<void>}
 */
async function downloadVideo(api, threadID, messageID, query, _model) {
  const model = gemini.createModelProxy();
  const downloadDir = path.join(process.cwd(), "data", "temp");

  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  let videoPath = null;

  try {
    api.setMessageReaction("⏳", messageID, () => {}, true);

    const youtube = await Innertube.create({
      generate_session_locally: true,
    });

    // AI search optimization
    console.log(chalk.magenta(` ├─🧠 AI analyzing video request...`));
    let optimizedQuery = query;

    try {
      const analysisPrompt = `Optimize this video search: "${query}"
Return JSON: {"optimizedQuery": "...", "contentType": "music video/tutorial/entertainment/etc"}`;

      const analysisResult = await model.generateContent(analysisPrompt);
      const analysisText = analysisResult?.response?.text?.();

      if (analysisText) {
        const cleanJson = analysisText.replace(/```json\n?|```\n?/g, "").trim();
        const analysis = JSON.parse(cleanJson);
        optimizedQuery = analysis.optimizedQuery || query;
        console.log(chalk.green(` ├─✓ Optimized: "${optimizedQuery}"`));
      }
    } catch {
      console.warn(chalk.yellow("⚠ AI optimization failed"));
    }

    const search = await youtube.search(optimizedQuery);
    const allVideos = search.results.filter((item) => item.type === "Video").slice(0, 20);

    if (allVideos.length === 0) {
      api.setMessageReaction("❌", messageID, () => {}, true);
      return api.sendMessage("❌ No videos found for your search query.", threadID, messageID);
    }

    // Find video within duration limit (10 minutes)
    let selectedVideo = null;
    let videoTitle = "";
    let channelName = "";

    for (const video of allVideos) {
      try {
        const info = await youtube.getInfo(video.id);
        if (info.basic_info.duration <= 600 && info.basic_info.duration > 10) {
          selectedVideo = video;
          videoTitle = selectedVideo.title.text;
          channelName = selectedVideo.author?.name || "Unknown";
          console.log(chalk.green(` ├─✓ Found: ${videoTitle}`));
          break;
        }
      } catch {
        continue;
      }
    }

    if (!selectedVideo) {
      selectedVideo = allVideos[0];
      videoTitle = selectedVideo.title.text;
      channelName = selectedVideo.author?.name || "Unknown";
    }

    console.log(chalk.cyan(` ├─🎬 Downloading: ${videoTitle}`));
    api.setMessageReaction("⬇️", messageID, () => {}, true);

    const sanitizedTitle = videoTitle.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 100);
    videoPath = path.join(downloadDir, `${Date.now()}-${sanitizedTitle}.mp4`);

    // Download video
    let downloadSuccess = false;
    const qualityOptions = [
      { type: "video+audio", quality: "360p", format: "mp4" },
      { type: "video+audio", quality: "480p", format: "mp4" },
      { type: "video+audio", quality: "bestefficiency", format: "mp4" },
    ];

    for (const options of qualityOptions) {
      try {
        const stream = await youtube.download(selectedVideo.id, options);
        const fileStream = fs.createWriteStream(videoPath);

        for await (const chunk of Utils.streamToIterable(stream)) {
          fileStream.write(chunk);
        }

        fileStream.end();
        await new Promise((resolve) => {
          fileStream.on("finish", resolve);
        });
        downloadSuccess = true;
        break;
      } catch {
        if (fs.existsSync(videoPath)) {
          try { fs.unlinkSync(videoPath); } catch { /* ignore */ }
        }
        continue;
      }
    }

    if (!downloadSuccess) {
      throw new Error("Download failed with all quality options");
    }

    const stats = fs.statSync(videoPath);
    const fileSizeMB = stats.size / (1024 * 1024);

    if (fileSizeMB > 50) {
      fs.unlinkSync(videoPath);
      api.setMessageReaction("❌", messageID, () => {}, true);
      return api.sendMessage(`⚠️ Video file too large (${fileSizeMB.toFixed(2)} MB). Max: 50 MB`, threadID, messageID);
    }

    console.log(chalk.cyan(` ├─🔃 Uploading video...`));
    api.setMessageReaction("🔃", messageID, () => {}, true);

    // Send video
    await api.sendMessage(
      {
        body: `🎬 ${videoTitle}\n👤 ${channelName}`,
        attachment: fs.createReadStream(videoPath),
      },
      threadID
    );

    console.log(chalk.green(` ├─✓ Video sent: ${videoTitle.substring(0, 40)}... (${fileSizeMB.toFixed(2)} MB)`));
    api.setMessageReaction("✅", messageID, () => {}, true);

    // Cleanup
    setTimeout(() => {
      try {
        if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
      } catch { /* ignore */ }
    }, 5000);

  } catch (error) {
    console.error(chalk.red(` ├─✗ Video download error: ${error.message}`));
    api.setMessageReaction("❌", messageID, () => {}, true);

    if (videoPath && fs.existsSync(videoPath)) {
      try { fs.unlinkSync(videoPath); } catch { /* ignore */ }
    }

    return api.sendMessage("❌ Error downloading video. Try a different search query.", threadID, messageID);
  }
}

module.exports = {
  downloadVideo,
};
