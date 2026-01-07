const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;

// Configure FFmpeg and FFprobe paths
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

console.log('✅ FFmpeg configured at:', ffmpegPath);
console.log('✅ FFprobe configured at:', ffprobePath);

module.exports = ffmpeg;
