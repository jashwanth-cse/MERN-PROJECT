const express = require('express');
// DEPRECATED: Multer removed - use new R2-based API (POST /api/upload-url)
const {
    uploadVideoFile,
    analyzeVideoForCompression,
    compressVideo,
    downloadCompressedVideo,
    getProgress,
    getVapidPublicKey,
    subscribePush,
    unsubscribePush
} = require('../controllers/videoCompressController');

const router = express.Router();

// DEPRECATED: This endpoint is disabled. Use new API:
// 1. POST /api/upload-url (get signed URL)
// 2. PUT to R2 directly
// 3. POST /api/start-job with operationType: 'video-compress'
router.post('/upload', (req, res) => {
    res.status(410).json({
        success: false,
        message: 'This endpoint is deprecated. Please use the new R2-based API.',
        migration: {
            step1: 'POST /api/upload-url',
            step2: 'Upload file to R2 using returned uploadUrl',
            step3: 'POST /api/start-job with operationType: video-compress'
        }
    });
});

// POST /api/video-compress/analyze
// STEP 2: Analyze video file metadata
router.post('/analyze', analyzeVideoForCompression);

// POST /api/video-compress/compress
// STEP 3: Compress video with selected options
router.post('/compress', compressVideo);

// GET /api/video-compress/progress/:jobId
// SSE endpoint for real-time progress updates
router.get('/progress/:jobId', getProgress);

// GET /api/video-compress/download/:filename
// Download compressed video file
router.get('/download/:filename', downloadCompressedVideo);

// Push Notification Routes
router.get('/vapid-public-key', getVapidPublicKey);
router.post('/subscribe-push', subscribePush);
router.post('/unsubscribe-push', unsubscribePush);

module.exports = router;
