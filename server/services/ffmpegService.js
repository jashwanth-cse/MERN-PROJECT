const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('@ffprobe-installer/ffprobe');
const { v4: uuidv4 } = require('uuid');
const { getR2Service } = require('./r2Service');
const jobService = require('./jobService');

// Configure FFmpeg paths
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

/**
 * FFmpeg Service for R2-based media processing
 * Handles downloading from R2, processing with FFmpeg, and uploading back to R2
 */
class FFmpegService {
    constructor() {
        this.r2Service = getR2Service();
        this.tempDir = path.join(__dirname, '../temp');

        // Create temp directory if it doesn't exist
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }

        console.log('✅ FFmpeg Service initialized');
    }

    /**
     * Process a job
     * @param {string} jobId - Job ID
     * @param {string} inputKey - R2 input object key
     * @param {string} operationType - Operation type
     * @param {Object} options - Processing options
     */
    async processJob(jobId, inputKey, operationType, options) {
        const jobTempDir = path.join(this.tempDir, jobId);

        try {
            // Create isolated temp directory for this job
            if (!fs.existsSync(jobTempDir)) {
                fs.mkdirSync(jobTempDir, { recursive: true });
            }

            console.log(`🎬 Starting FFmpeg job ${jobId} (${operationType})`);

            // Start the job
            jobService.startJob(jobId);

            // Download input from R2
            const inputFileName = path.basename(inputKey);
            const localInputPath = path.join(jobTempDir, inputFileName);

            console.log(`⬇️  Downloading input from R2: ${inputKey}`);
            await this.r2Service.downloadFile(inputKey, localInputPath);

            // Process based on operation type
            let result;
            switch (operationType) {
                case 'extract-audio':
                    result = await this.extractAudio(jobId, localInputPath, jobTempDir, options);
                    break;
                case 'audio-convert':
                    result = await this.convertAudio(jobId, localInputPath, jobTempDir, options);
                    break;
                case 'audio-compress':
                    result = await this.compressAudio(jobId, localInputPath, jobTempDir, options);
                    break;
                case 'video-compress':
                    result = await this.compressVideo(jobId, localInputPath, jobTempDir, options);
                    break;
                default:
                    throw new Error(`Unknown operation type: ${operationType}`);
            }

            // Upload output to R2
            const outputKey = `output/${jobId}/${result.fileName}`;
            console.log(`⬆️  Uploading output to R2: ${outputKey}`);

            const uploadResult = await this.r2Service.uploadFile(
                result.localPath,
                outputKey,
                result.contentType
            );

            // Complete the job
            jobService.completeJob(jobId, {
                outputKey,
                fileName: result.fileName,
                fileSize: uploadResult.size,
                ...result.metadata,
            });

            // Cleanup temp files
            await this.cleanupTempDir(jobTempDir);

            // Note: Input file NOT deleted here to support batch extraction
            // Multiple jobs may use the same input file (e.g., extracting multiple audio tracks)
            // Input will be deleted when:
            // 1. User explicitly calls cleanup endpoint after downloading all files
            // 2. R2 lifecycle policy auto-deletes after configured retention period
            console.log(`✅ Job ${jobId} completed. Input file kept in R2 for reuse.`);

        } catch (error) {
            console.error(`❌ FFmpeg job ${jobId} failed:`, error);
            jobService.failJob(jobId, error.message);

            // Cleanup temp files on error
            await this.cleanupTempDir(jobTempDir);
        }
    }

    /**
     * Extract audio from video
     */
    async extractAudio(jobId, inputPath, tempDir, options) {
        const { trackIndex = 0, format = 'mp3' } = options;

        return new Promise((resolve, reject) => {
            const outputFileName = `audio-${uuidv4()}.${format}`;
            const outputPath = path.join(tempDir, outputFileName);

            console.log(`🎵 Extracting audio track ${trackIndex} as ${format}`);

            ffmpeg(inputPath)
                .outputOptions([
                    `-map 0:a:${trackIndex}`,
                    '-vn',
                    '-ar 44100',
                    '-ac 2',
                    '-b:a 192k',
                ])
                .output(outputPath)
                .on('progress', (progress) => {
                    if (progress.percent) {
                        jobService.updateProgress(jobId, progress.percent, progress.timemark);
                    }
                })
                .on('end', () => {
                    const stats = fs.statSync(outputPath);
                    resolve({
                        fileName: outputFileName,
                        localPath: outputPath,
                        contentType: `audio/${format}`,
                        metadata: {
                            format,
                            trackIndex,
                        },
                    });
                })
                .on('error', (err) => {
                    reject(new Error(`Audio extraction failed: ${err.message}`));
                })
                .run();
        });
    }

    /**
     * Convert audio format
     */
    async convertAudio(jobId, inputPath, tempDir, options) {
        const { format = 'mp3', bitrate = '192k', sampleRate = 44100 } = options;

        return new Promise((resolve, reject) => {
            const outputFileName = `converted-${uuidv4()}.${format}`;
            const outputPath = path.join(tempDir, outputFileName);

            console.log(`🔄 Converting audio to ${format}`);

            let command = ffmpeg(inputPath)
                .audioCodec(this.getAudioCodec(format))
                .audioBitrate(bitrate)
                .audioFrequency(sampleRate)
                .output(outputPath);

            command
                .on('progress', (progress) => {
                    if (progress.percent) {
                        jobService.updateProgress(jobId, progress.percent, progress.timemark);
                    }
                })
                .on('end', () => {
                    resolve({
                        fileName: outputFileName,
                        localPath: outputPath,
                        contentType: `audio/${format}`,
                        metadata: {
                            format,
                            bitrate,
                            sampleRate,
                        },
                    });
                })
                .on('error', (err) => {
                    reject(new Error(`Audio conversion failed: ${err.message}`));
                })
                .run();
        });
    }

    /**
     * Compress audio
     */
    async compressAudio(jobId, inputPath, tempDir, options) {
        const { bitrate = '128k', sampleRate = 44100, channels = 2 } = options;

        return new Promise((resolve, reject) => {
            const outputFileName = `compressed-${uuidv4()}.mp3`;
            const outputPath = path.join(tempDir, outputFileName);

            console.log(`🗜️  Compressing audio (${bitrate})`);

            ffmpeg(inputPath)
                .audioCodec('libmp3lame')
                .audioBitrate(bitrate)
                .audioFrequency(sampleRate)
                .audioChannels(channels)
                .output(outputPath)
                .on('progress', (progress) => {
                    if (progress.percent) {
                        jobService.updateProgress(jobId, progress.percent, progress.timemark);
                    }
                })
                .on('end', () => {
                    resolve({
                        fileName: outputFileName,
                        localPath: outputPath,
                        contentType: 'audio/mp3',
                        metadata: {
                            bitrate,
                            sampleRate,
                            channels,
                        },
                    });
                })
                .on('error', (err) => {
                    reject(new Error(`Audio compression failed: ${err.message}`));
                })
                .run();
        });
    }

    /**
     * Compress video
     */
    async compressVideo(jobId, inputPath, tempDir, options) {
        const {
            codec = 'h264',
            resolution = 'original',
            videoBitrate = 'auto',
            preset = 'medium',
            audioOption = 'compress',
        } = options;

        return new Promise((resolve, reject) => {
            const outputFileName = `compressed-${uuidv4()}.mp4`;
            const outputPath = path.join(tempDir, outputFileName);

            console.log(`🎬 Compressing video (${codec}, ${resolution})`);

            let command = ffmpeg(inputPath);

            // Video codec
            if (codec === 'h265') {
                command = command
                    .videoCodec('libx265')
                    .outputOptions(['-tag:v hvc1']);
            } else {
                command = command
                    .videoCodec('libx264')
                    .outputOptions(['-profile:v high', '-pix_fmt yuv420p']);
            }

            // Resolution scaling
            if (resolution !== 'original') {
                const scaleMap = {
                    '1080p': 'scale=1920:1080',
                    '720p': 'scale=1280:720',
                    '480p': 'scale=854:480',
                };
                if (scaleMap[resolution]) {
                    command = command.videoFilters(scaleMap[resolution]);
                }
            }

            // Video bitrate
            if (videoBitrate !== 'auto') {
                command = command.videoBitrate(videoBitrate);
            }

            // Preset
            command = command.outputOptions([`-preset ${preset}`]);

            // Audio handling
            if (audioOption === 'remove') {
                command = command.noAudio();
            } else if (audioOption === 'compress') {
                command = command.audioCodec('aac').audioBitrate('128k');
            } else {
                command = command.audioCodec('copy');
            }

            // Faststart for web playback
            command = command.outputOptions(['-movflags +faststart']);
            command = command.format('mp4');

            command
                .output(outputPath)
                .on('progress', (progress) => {
                    if (progress.percent) {
                        jobService.updateProgress(jobId, progress.percent, progress.timemark);
                    }
                })
                .on('end', () => {
                    resolve({
                        fileName: outputFileName,
                        localPath: outputPath,
                        contentType: 'video/mp4',
                        metadata: {
                            codec,
                            resolution,
                            videoBitrate,
                            preset,
                            audioOption,
                        },
                    });
                })
                .on('error', (err) => {
                    reject(new Error(`Video compression failed: ${err.message}`));
                })
                .run();
        });
    }

    /**
     * Get appropriate audio codec for format
     */
    getAudioCodec(format) {
        const codecMap = {
            mp3: 'libmp3lame',
            wav: 'pcm_s16le',
            m4a: 'aac',
            aac: 'aac',
            ogg: 'libvorbis',
            flac: 'flac',
        };
        return codecMap[format] || 'libmp3lame';
    }

    /**
     * Cleanup temp directory
     */
    async cleanupTempDir(dirPath) {
        try {
            if (fs.existsSync(dirPath)) {
                // Delete all files in directory
                const files = fs.readdirSync(dirPath);
                for (const file of files) {
                    const filePath = path.join(dirPath, file);
                    fs.unlinkSync(filePath);
                }
                // Delete directory
                fs.rmdirSync(dirPath);
                console.log(`🧹 Cleaned up temp directory: ${dirPath}`);
            }
        } catch (error) {
            console.error(`⚠️  Failed to cleanup temp directory:`, error.message);
        }
    }

    /**
     * Analyze media file (get metadata)
     */
    async analyzeMedia(inputKey) {
        const jobTempDir = path.join(this.tempDir, `analyze-${uuidv4()}`);

        try {
            // Create temp directory
            if (!fs.existsSync(jobTempDir)) {
                fs.mkdirSync(jobTempDir, { recursive: true });
            }

            // Download file from R2
            const inputFileName = path.basename(inputKey);
            const localInputPath = path.join(jobTempDir, inputFileName);
            await this.r2Service.downloadFile(inputKey, localInputPath);

            // Use FFprobe to get metadata
            return new Promise((resolve, reject) => {
                ffmpeg.ffprobe(localInputPath, async (err, metadata) => {
                    // Cleanup temp files
                    await this.cleanupTempDir(jobTempDir);

                    if (err) {
                        reject(new Error(`Media analysis failed: ${err.message}`));
                        return;
                    }

                    resolve(metadata);
                });
            });
        } catch (error) {
            await this.cleanupTempDir(jobTempDir);
            throw error;
        }
    }
}

// Singleton instance
let ffmpegServiceInstance = null;

/**
 * Get FFmpeg service instance
 * @returns {FFmpegService}
 */
function getFFmpegService() {
    if (!ffmpegServiceInstance) {
        ffmpegServiceInstance = new FFmpegService();
    }
    return ffmpegServiceInstance;
}

module.exports = {
    FFmpegService,
    getFFmpegService,
};
