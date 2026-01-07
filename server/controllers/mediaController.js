const { getR2Service } = require('../services/r2Service');
const { getFFmpegService } = require('../services/ffmpegService');
const jobService = require('../services/jobService');
const { linkJobToSession } = require('../middleware/sessionTracking');
const pushService = require('../utils/pushService');

const r2Service = getR2Service();
const ffmpegService = getFFmpegService();

/**
 * Generate presigned upload URL for client-side upload to R2
 * POST /api/upload-url
 */
const generateUploadUrl = async (req, res) => {
    try {
        const { fileName, fileType, fileSize } = req.body;

        // Validate input
        if (!fileName || !fileType || !fileSize) {
            return res.status(400).json({
                success: false,
                message: 'fileName, fileType, and fileSize are required',
            });
        }

        // Validate file size (max 5GB)
        const maxFileSizeBytes = 5 * 1024 * 1024 * 1024; // 5GB
        if (fileSize > maxFileSizeBytes) {
            return res.status(400).json({
                success: false,
                message: 'File size exceeds maximum allowed size of 5GB',
            });
        }

        // Validate file type
        const allowedTypes = [
            'video/mp4', 'video/quicktime', 'video/x-matroska', 'video/x-msvideo', 'video/webm',
            'audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/flac',
        ];

        if (!allowedTypes.includes(fileType)) {
            return res.status(400).json({
                success: false,
                message: `Unsupported file type.Allowed: ${allowedTypes.join(', ')} `,
            });
        }

        console.log(`📤 Generating upload URL for: ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

        // Generate signed upload URL (5 minutes expiry)
        const result = await r2Service.generateUploadUrl(fileName, fileType, 300);

        res.status(200).json({
            success: true,
            message: 'Upload URL generated',
            data: {
                uploadUrl: result.uploadUrl,
                objectKey: result.objectKey,
                expiresAt: result.expiresAt,
            },
        });
    } catch (error) {
        console.error('❌ Generate upload URL error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate upload URL',
            error: error.message,
        });
    }
};

/**
 * Start a media processing job
 * POST /api/start-job
 */
const startJob = async (req, res) => {
    try {
        const { objectKey, operationType, options, subscriptionId } = req.body;

        // Validate input
        if (!objectKey || !operationType) {
            return res.status(400).json({
                success: false,
                message: 'objectKey and operationType are required',
            });
        }

        // Validate operation type
        const validOperations = ['extract-audio', 'audio-convert', 'audio-compress', 'video-compress'];
        if (!validOperations.includes(operationType)) {
            return res.status(400).json({
                success: false,
                message: `Invalid operation type.Supported: ${validOperations.join(', ')} `,
            });
        }

        // Validate options based on operation type
        const validationError = validateOperationOptions(operationType, options || {});
        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError,
            });
        }

        console.log(`🚀 Starting job: ${operationType} on ${objectKey} `);

        // Create job
        const jobId = jobService.createJob({
            operationType,
            inputKey: objectKey,
            options: options || {},
            subscriptionId,
        });

        const job = await jobService.getJob(jobId);

        // Link job to user session (for cleanup when user disconnects)
        if (req.sessionId) {
            linkJobToSession(req.sessionId, jobId);
        }

        // If job is pending (not queued), start processing immediately
        if (job.status === 'pending') {
            // Start FFmpeg processing in background
            setImmediate(() => {
                ffmpegService.processJob(jobId, objectKey, operationType, options || {})
                    .catch(error => {
                        console.error(`Background processing error for job ${jobId}: `, error);
                    });
            });

            res.status(202).json({
                success: true,
                message: 'Job started',
                data: {
                    jobId,
                    status: 'processing',
                },
            });
        } else {
            // Job is queued
            const queuePosition = jobService.getQueuePosition(jobId);
            res.status(202).json({
                success: true,
                message: 'Job queued',
                data: {
                    jobId,
                    status: 'queued',
                    queuePosition,
                },
            });
        }
    } catch (error) {
        console.error('❌ Start job error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start job',
            error: error.message,
        });
    }
};

/**
 * Get job status with SSE for real-time progress
 * GET /api/job-status/:jobId
 */
const getJobStatus = async (req, res) => {
    try {
        const { jobId } = req.params;

        // Check if job exists
        const job = await jobService.getJob(jobId);
        if (!job) {
            return res.status(404).json({
                success: false,
                message: 'Job not found',
            });
        }

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        // Add client to job
        const added = jobService.addSSEClient(jobId, res);
        if (!added) {
            return res.status(404).json({
                success: false,
                message: 'Job not found',
            });
        }

        // Handle client disconnect
        req.on('close', () => {
            jobService.removeSSEClient(jobId, res);
        });
    } catch (error) {
        console.error('❌ Get job status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get job status',
            error: error.message,
        });
    }
};

/**
 * Generate download URL for completed job
 * GET /api/download-url/:jobId
 */
const getDownloadUrl = async (req, res) => {
    try {
        const { jobId } = req.params;

        // Get job (now async - checks Firestore if not in memory)
        const job = await jobService.getJob(jobId);
        if (!job) {
            return res.status(404).json({
                success: false,
                message: 'Job not found',
            });
        }

        // Check if job is completed
        if (job.status !== 'completed') {
            return res.status(400).json({
                success: false,
                message: `Job is not completed yet(status: ${job.status})`,
            });
        }

        console.log(`📥 Generating download URL for job: ${jobId} `);

        // Generate signed download URL (5 minutes expiry)
        const result = await r2Service.generateDownloadUrl(job.outputKey, 300);

        res.status(200).json({
            success: true,
            message: 'Download URL generated',
            data: {
                downloadUrl: result.downloadUrl,
                fileName: job.result.fileName,
                fileSize: job.result.fileSize,
                expiresAt: result.expiresAt,
            },
        });

        // Note: User has R2 lifecycle policies configured
        // No automatic cleanup - files remain until:
        // 1. User explicitly calls cleanup endpoint
        // 2. R2 lifecycle policy deletes them

    } catch (error) {
        console.error('❌ Generate download URL error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate download URL',
            error: error.message,
        });
    }
};

/**
 * Cleanup job files from R2 and remove job from memory
 * POST /api/cleanup/:jobId
 */
const cleanupJob = async (req, res) => {
    try {
        const { jobId } = req.params;

        console.log(`🗑️  Manual cleanup requested for job: ${jobId} `);

        const result = await cleanupJobFiles(jobId);

        res.status(200).json({
            success: true,
            message: 'Job cleaned up successfully',
            data: result,
        });
    } catch (error) {
        console.error('❌ Cleanup job error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cleanup job',
            error: error.message,
        });
    }
};

/**
 * Helper: Cleanup job files from R2 and memory
 */
async function cleanupJobFiles(jobId) {
    const job = await jobService.getJob(jobId);
    if (!job) {
        throw new Error('Job not found');
    }

    const deletedKeys = [];

    // Delete OUTPUT from R2 when user explicitly calls cleanup
    if (job.outputKey) {
        try {
            await r2Service.deleteObject(job.outputKey);
            deletedKeys.push(job.outputKey);
            console.log(`🗑️  Deleted output from R2: ${job.outputKey} `);
        } catch (error) {
            console.error(`Failed to delete output: ${error.message} `);
        }
    }

    // Delete INPUT from R2 when user explicitly calls cleanup
    // This supports batch extraction - input is kept during processing
    // and only deleted when user is done with all extractions
    if (job.inputKey) {
        try {
            await r2Service.deleteObject(job.inputKey);
            deletedKeys.push(job.inputKey);
            console.log(`🗑️  Deleted input from R2: ${job.inputKey} `);
        } catch (error) {
            // Input might already be deleted by another cleanup call - this is fine
            console.log(`ℹ️  Input already deleted or doesn't exist: ${job.inputKey}`);
        }
    }

    // Remove job from memory
    jobService.deleteJob(jobId);

    return {
        jobId,
        deletedKeys,
    };
}

/**
 * Validate operation-specific options
 */
function validateOperationOptions(operationType, options) {
    switch (operationType) {
        case 'extract-audio':
            if (options.format && !['mp3', 'wav', 'm4a'].includes(options.format)) {
                return 'Invalid format for extract-audio. Supported: mp3, wav, m4a';
            }
            break;

        case 'audio-convert':
            if (options.format && !['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'].includes(options.format)) {
                return 'Invalid format for audio-convert. Supported: mp3, wav, m4a, aac, ogg, flac';
            }
            break;

        case 'audio-compress':
            if (options.bitrate && !['64k', '96k', '128k', '192k', '256k', '320k'].includes(options.bitrate)) {
                return 'Invalid bitrate for audio-compress. Supported: 64k, 96k, 128k, 192k, 256k, 320k';
            }
            break;

        case 'video-compress':
            if (options.codec && !['h264', 'h265'].includes(options.codec)) {
                return 'Invalid codec for video-compress. Supported: h264, h265';
            }
            if (options.resolution && !['original', '1080p', '720p', '480p'].includes(options.resolution)) {
                return 'Invalid resolution for video-compress. Supported: original, 1080p, 720p, 480p';
            }
            if (options.preset && !['ultrafast', 'fast', 'medium', 'slow'].includes(options.preset)) {
                return 'Invalid preset for video-compress. Supported: ultrafast, fast, medium, slow';
            }
            break;
    }

    return null; // No error
}

/**
 * Analyze media file metadata (optional endpoint)
 * POST /api/analyze
 */
const analyzeMedia = async (req, res) => {
    try {
        const { objectKey } = req.body;

        if (!objectKey) {
            return res.status(400).json({
                success: false,
                message: 'objectKey is required',
            });
        }

        console.log(`🔍 Analyzing media: ${objectKey}`);

        const metadata = await ffmpegService.analyzeMedia(objectKey);

        // Extract relevant metadata
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStreams = metadata.streams.filter(s => s.codec_type === 'audio');

        const result = {
            duration: parseFloat(metadata.format.duration) || 0,
            size: parseInt(metadata.format.size) || 0,
            bitrate: parseInt(metadata.format.bit_rate) || 0,
        };

        if (videoStream) {
            result.video = {
                codec: videoStream.codec_name,
                resolution: `${videoStream.width}x${videoStream.height}`,
                frameRate: videoStream.avg_frame_rate,
            };
        }

        if (audioStreams.length > 0) {
            result.audio = audioStreams.map((stream, idx) => ({
                index: idx,
                codec: stream.codec_name,
                channels: stream.channels,
                sampleRate: stream.sample_rate,
                bitrate: parseInt(stream.bit_rate) || 0,
            }));
        }

        res.status(200).json({
            success: true,
            message: 'Media analyzed',
            data: result,
        });
    } catch (error) {
        console.error('❌ Analyze media error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to analyze media',
            error: error.message,
        });
    }
};

/**
 * Get VAPID public key for push notifications
 * GET /api/vapid-public-key
 */
const getVapidPublicKey = (req, res) => {
    if (!pushService.isEnabled()) {
        return res.status(503).json({
            success: false,
            message: 'Push notifications not configured',
        });
    }

    res.json({
        success: true,
        publicKey: pushService.getPublicKey(),
    });
};

/**
 * Subscribe to push notifications
 * POST /api/subscribe-push
 */
const subscribePush = (req, res) => {
    try {
        const { subscription } = req.body;

        if (!subscription) {
            return res.status(400).json({
                success: false,
                message: 'Subscription object is required',
            });
        }

        if (!pushService.isEnabled()) {
            return res.status(503).json({
                success: false,
                message: 'Push notifications not configured',
            });
        }

        const { v4: uuidv4 } = require('uuid');
        const subscriptionId = uuidv4();

        pushService.addSubscription(subscriptionId, subscription);

        res.json({
            success: true,
            subscriptionId,
        });
    } catch (error) {
        console.error('❌ Subscribe push error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to subscribe to push notifications',
            error: error.message,
        });
    }
};

/**
 * Unsubscribe from push notifications
 * POST /api/unsubscribe-push
 */
const unsubscribePush = (req, res) => {
    try {
        const { subscriptionId } = req.body;

        if (!subscriptionId) {
            return res.status(400).json({
                success: false,
                message: 'Subscription ID is required',
            });
        }

        pushService.removeSubscription(subscriptionId);

        res.json({
            success: true,
            message: 'Unsubscribed successfully',
        });
    } catch (error) {
        console.error('❌ Unsubscribe push error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to unsubscribe from push notifications',
            error: error.message,
        });
    }
};

module.exports = {
    generateUploadUrl,
    startJob,
    getJobStatus,
    getDownloadUrl,
    cleanupJob,
    analyzeMedia,
    getVapidPublicKey,
    subscribePush,
    unsubscribePush,
};
