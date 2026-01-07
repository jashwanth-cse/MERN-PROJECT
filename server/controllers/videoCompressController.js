const path = require('path');
const fs = require('fs');
const jobManager = require('../utils/jobManager');

// STEP 1: Upload video file for compression
const uploadVideoFile = async (req, res) => {
    try {
        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No video file uploaded'
            });
        }

        // Get file details
        const file = req.file;
        const filePath = file.path;
        const originalFormat = path.extname(file.originalname).toLowerCase().replace('.', '');
        const fileName = file.filename;
        const fileSizeBytes = file.size;
        const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);

        console.log('📹 Video file uploaded:');
        console.log('   - Filename:', fileName);
        console.log('   - Format:', originalFormat.toUpperCase());
        console.log('   - Size:', fileSizeMB, 'MB');
        console.log('   - Path:', filePath);

        // Return success response
        res.status(200).json({
            success: true,
            message: 'Video file uploaded successfully',
            inputFilePath: filePath,
            originalFormat: originalFormat,
            data: {
                fileName: fileName,
                fileSizeBytes: fileSizeBytes,
                fileSizeMB: fileSizeMB
            }
        });

    } catch (error) {
        console.error('❌ Upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Video upload failed',
            error: error.message
        });
    }
};

// STEP 2: Analyze video file metadata
const analyzeVideoForCompression = async (req, res) => {
    try {
        const { inputFilePath } = req.body;

        // Validate input
        if (!inputFilePath) {
            return res.status(400).json({
                success: false,
                message: 'Input file path is required'
            });
        }

        // Check if file exists
        if (!fs.existsSync(inputFilePath)) {
            return res.status(404).json({
                success: false,
                message: 'Video file not found'
            });
        }

        // Get file size
        const stats = fs.statSync(inputFilePath);
        const fileSizeBytes = stats.size;
        const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);

        console.log('🔍 Analyzing video file:', inputFilePath);

        // Use FFprobe to get metadata
        const ffmpeg = require('fluent-ffmpeg');
        const ffprobeStatic = require('@ffprobe-installer/ffprobe');
        ffmpeg.setFfprobePath(ffprobeStatic.path);

        ffmpeg.ffprobe(inputFilePath, (err, metadata) => {
            if (err) {
                console.error('❌ FFprobe error:', err.message);
                return res.status(500).json({
                    success: false,
                    message: 'Unable to analyze video file',
                    error: err.message
                });
            }

            // Find video stream
            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            if (!videoStream) {
                return res.status(400).json({
                    success: false,
                    message: 'No video stream found in file'
                });
            }

            // Find audio stream (optional)
            const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

            // Parse frame rate (format: "30/1" or "30000/1001")
            let frameRate = '0';
            if (videoStream.avg_frame_rate) {
                const parts = videoStream.avg_frame_rate.split('/');
                if (parts.length === 2) {
                    const fps = parseFloat(parts[0]) / parseFloat(parts[1]);
                    frameRate = fps.toFixed(2);
                }
            }

            // Extract video metadata
            const videoMetadata = {
                codec: videoStream.codec_name || 'unknown',
                resolution: `${videoStream.width}x${videoStream.height}`,
                frameRate: frameRate,
                bitrate: parseInt(videoStream.bit_rate) || parseInt(metadata.format.bit_rate) || 0,
                duration: parseFloat(videoStream.duration) || parseFloat(metadata.format.duration) || 0
            };

            // Extract audio metadata (if available)
            let audioMetadata = null;
            if (audioStream) {
                audioMetadata = {
                    codec: audioStream.codec_name || 'unknown',
                    sampleRate: parseInt(audioStream.sample_rate) || 0,
                    bitrate: parseInt(audioStream.bit_rate) || 0,
                    channels: parseInt(audioStream.channels) || 0
                };
            }

            console.log('✅ Video metadata analyzed:');
            console.log('   - Resolution:', videoMetadata.resolution);
            console.log('   - Codec:', videoMetadata.codec);
            console.log('   - Frame Rate:', frameRate, 'fps');
            console.log('   - Duration:', videoMetadata.duration.toFixed(2), 'seconds');
            console.log('   - File Size:', fileSizeMB, 'MB');

            // Return metadata
            res.status(200).json({
                success: true,
                message: 'Video metadata analyzed',
                metadata: {
                    video: videoMetadata,
                    audio: audioMetadata,
                    fileSizeBytes: fileSizeBytes,
                    fileSizeMB: parseFloat(fileSizeMB)
                }
            });
        });

    } catch (error) {
        console.error('❌ Analysis error:', error);
        res.status(500).json({
            success: false,
            message: 'Video analysis failed',
            error: error.message
        });
    }
};

// STEP 3: Compress video file (non-blocking with SSE progress)
const compressVideo = async (req, res) => {
    try {
        const {
            inputFilePath,
            codec = 'h264',
            resolution = 'original',
            videoBitrate = 'auto',
            preset = 'medium',
            quality = 'balanced',
            audioOption = 'compress',
            subscriptionId // Optional: for push notifications
        } = req.body;

        // Validate input
        if (!inputFilePath) {
            return res.status(400).json({
                success: false,
                message: 'Input file path is required'
            });
        }

        // Check if file exists
        if (!fs.existsSync(inputFilePath)) {
            return res.status(404).json({
                success: false,
                message: 'Video file not found'
            });
        }

        // Validate codec
        const validCodecs = ['h264', 'h265'];
        if (!validCodecs.includes(codec)) {
            return res.status(400).json({
                success: false,
                message: `Invalid codec. Supported: ${validCodecs.join(', ')}`
            });
        }

        // Validate resolution
        const validResolutions = ['original', '1080p', '720p', '480p'];
        if (!validResolutions.includes(resolution)) {
            return res.status(400).json({
                success: false,
                message: `Invalid resolution. Supported: ${validResolutions.join(', ')}`
            });
        }

        // Validate video bitrate
        const validBitrates = ['auto', '800k', '1200k', '2000k', '4000k'];
        if (!validBitrates.includes(videoBitrate)) {
            return res.status(400).json({
                success: false,
                message: `Invalid bitrate. Supported: ${validBitrates.join(', ')}`
            });
        }

        // Validate preset
        const validPresets = ['ultrafast', 'fast', 'medium', 'slow'];
        if (!validPresets.includes(preset)) {
            return res.status(400).json({
                success: false,
                message: `Invalid preset. Supported: ${validPresets.join(', ')}`
            });
        }

        // Validate audio option
        const validAudioOptions = ['keep', 'compress', 'remove'];
        if (!validAudioOptions.includes(audioOption)) {
            return res.status(400).json({
                success: false,
                message: `Invalid audio option. Supported: ${validAudioOptions.join(', ')}`
            });
        }

        // Create job
        const jobId = jobManager.createJob({
            inputFilePath,
            codec,
            resolution,
            videoBitrate,
            preset,
            quality,
            audioOption,
            subscriptionId // For push notifications
        });

        // Respond immediately with jobId
        res.status(202).json({
            success: true,
            message: 'Compression started',
            jobId: jobId
        });

        // Start background compression
        processCompressionJob(jobId, {
            inputFilePath,
            codec,
            resolution,
            videoBitrate,
            preset,
            quality,
            audioOption,
            subscriptionId
        });

    } catch (error) {
        console.error('❌ Compression error:', error);
        res.status(500).json({
            success: false,
            message: 'Video compression failed',
            error: error.message
        });
    }
};

// Background compression processor
const processCompressionJob = async (jobId, options) => {
    const {
        inputFilePath,
        codec,
        resolution,
        videoBitrate,
        preset,
        quality,
        audioOption,
        subscriptionId // For push notifications
    } = options;

    try {
        // Create output directory
        const outputDir = path.join(__dirname, '../uploads/video-compress/output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Generate unique output filename
        const timestamp = Date.now();
        const randomStr = Math.round(Math.random() * 1E9);
        const outputFileName = `compressed-${timestamp}-${randomStr}.mp4`;
        const outputFilePath = path.join(outputDir, outputFileName);

        console.log(`🎬 Starting compression for job ${jobId}:`);
        console.log('   - Codec:', codec);
        console.log('   - Resolution:', resolution);
        console.log('   - Bitrate:', videoBitrate);

        // Setup FFmpeg
        const ffmpeg = require('fluent-ffmpeg');
        const ffmpegStatic = require('ffmpeg-static');
        const ffprobeStatic = require('@ffprobe-installer/ffprobe');
        ffmpeg.setFfmpegPath(ffmpegStatic);
        ffmpeg.setFfprobePath(ffprobeStatic.path);

        // Build FFmpeg command
        let command = ffmpeg(inputFilePath);

        // Video codec configuration
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
                '480p': 'scale=854:480'
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

        // Add faststart
        command = command.outputOptions(['-movflags +faststart']);
        command = command.format('mp4');

        // Execute compression
        command
            .on('start', (commandLine) => {
                console.log(`▶️  FFmpeg started for job ${jobId}`);
            })
            .on('progress', (progress) => {
                if (progress.percent) {
                    const percent = Math.round(progress.percent);
                    const timemark = progress.timemark || '00:00:00';
                    jobManager.updateProgress(jobId, percent, timemark);
                }
            })
            .on('end', () => {
                console.log(`✅ Compression complete for job ${jobId}`);

                // Delete input file
                fs.unlink(inputFilePath, (err) => {
                    if (err) console.error('⚠️  Failed to delete input file:', err.message);
                });

                // Mark job as complete
                jobManager.completeJob(jobId, {
                    fileName: outputFileName,
                    downloadUrl: `/api/video-compress/download/${outputFileName}`,
                    settingsApplied: {
                        codec,
                        resolution,
                        videoBitrate,
                        preset,
                        quality,
                        audio: audioOption
                    }
                });

                // Send push notification if subscriptionId is present
                if (subscriptionId && pushService.isEnabled()) {
                    pushService.sendNotification(subscriptionId, {
                        title: 'Video Compression Complete! 🎬',
                        body: 'Your video is ready for download.',
                        icon: '/logo192.png',
                        badge: '/logo192.png',
                        data: {
                            jobId,
                            downloadUrl: `/api/video-compress/download/${outputFileName}`,
                            url: '/compress-video'
                        }
                    }).catch(err => {
                        console.error('Push notification failed:', err);
                    });
                }
            })
            .on('error', (err) => {
                console.error(`❌ Compression failed for job ${jobId}:`, err.message);
                jobManager.failJob(jobId, err.message);
            })
            .save(outputFilePath);

    } catch (error) {
        console.error(`❌ Background compression error for job ${jobId}:`, error);
        jobManager.failJob(jobId, error.message);
    }
};

// Download compressed video file
const downloadCompressedVideo = async (req, res) => {
    try {
        const { filename } = req.params;

        // Validate filename
        if (!filename) {
            return res.status(400).json({
                success: false,
                message: 'Filename is required'
            });
        }

        // Construct file path
        const outputDir = path.join(__dirname, '../uploads/video-compress/output');
        const filePath = path.join(outputDir, filename);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'Compressed video file not found'
            });
        }

        console.log('⬇️  Downloading compressed video:', filename);

        // Set headers for download
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Stream file to client
        const fileStream = fs.createReadStream(filePath);

        fileStream.on('end', () => {
            console.log('✅ Download completed');

            // Delete file after successful download
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error('⚠️  Failed to delete compressed file:', err.message);
                } else {
                    console.log('🗑️  Deleted compressed file:', filename);
                }
            });
        });

        fileStream.on('error', (err) => {
            console.error('❌ File stream error:', err.message);
            res.status(500).json({
                success: false,
                message: 'Download failed',
                error: err.message
            });
        });

        fileStream.pipe(res);

    } catch (error) {
        console.error('❌ Download error:', error);
        res.status(500).json({
            success: false,
            message: 'Download failed',
            error: error.message
        });
    }
};

// SSE Progress Endpoint
const getProgress = async (req, res) => {
    const { jobId } = req.params;

    // Check if job exists
    const job = jobManager.getJob(jobId);
    if (!job) {
        return res.status(404).json({
            success: false,
            message: 'Job not found'
        });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Add client to job
    const added = jobManager.addSSEClient(jobId, res);
    if (!added) {
        return res.status(404).json({
            success: false,
            message: 'Job not found'
        });
    }

    // Handle client disconnect
    req.on('close', () => {
        jobManager.removeSSEClient(jobId, res);
    });
};

// Push Notification Endpoints
const pushService = require('../utils/pushService');

// Get VAPID public key for client
const getVapidPublicKey = (req, res) => {
    if (!pushService.isEnabled()) {
        return res.status(503).json({
            success: false,
            message: 'Push notifications not configured'
        });
    }

    res.json({
        success: true,
        publicKey: pushService.getPublicKey()
    });
};

// Subscribe to push notifications
const subscribePush = (req, res) => {
    try {
        const { subscription } = req.body;

        if (!subscription) {
            return res.status(400).json({
                success: false,
                message: 'Subscription object is required'
            });
        }

        if (!pushService.isEnabled()) {
            return res.status(503).json({
                success: false,
                message: 'Push notifications not configured'
            });
        }

        // Generate subscription ID
        const { v4: uuidv4 } = require('uuid');
        const subscriptionId = uuidv4();

        // Add subscription
        pushService.addSubscription(subscriptionId, subscription);

        res.json({
            success: true,
            subscriptionId
        });
    } catch (error) {
        console.error('❌ Subscribe push error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to subscribe to push notifications',
            error: error.message
        });
    }
};

// Unsubscribe from push notifications
const unsubscribePush = (req, res) => {
    try {
        const { subscriptionId } = req.body;

        if (!subscriptionId) {
            return res.status(400).json({
                success: false,
                message: 'Subscription ID is required'
            });
        }

        pushService.removeSubscription(subscriptionId);

        res.json({
            success: true,
            message: 'Unsubscribed successfully'
        });
    } catch (error) {
        console.error('❌ Unsubscribe push error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to unsubscribe from push notifications',
            error: error.message
        });
    }
};

module.exports = {
    uploadVideoFile,
    analyzeVideoForCompression,
    compressVideo,
    downloadCompressedVideo,
    getProgress,
    getVapidPublicKey,
    subscribePush,
    unsubscribePush
};
