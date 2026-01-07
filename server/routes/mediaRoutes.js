const express = require('express');
const {
    generateUploadUrl,
    startJob,
    getJobStatus,
    getDownloadUrl,
    cleanupJob,
    analyzeMedia,
    getVapidPublicKey,
    subscribePush,
    unsubscribePush,
} = require('../controllers/mediaController');

const router = express.Router();

/**
 * Media Processing Routes (New R2-based API)
 */

// POST /api/upload-url
// Generate presigned upload URL for client-side upload to R2
router.post('/upload-url', generateUploadUrl);

// POST /api/start-job
// Start a media processing job
router.post('/start-job', startJob);

// GET /api/job-status/:jobId
// Get job status with SSE for real-time progress updates
router.get('/job-status/:jobId', getJobStatus);

// GET /api/download-url/:jobId
// Generate presigned download URL for completed job
router.get('/download-url/:jobId', getDownloadUrl);

// POST /api/cleanup/:jobId
// Manually cleanup job files from R2 and remove job from memory
router.post('/cleanup/:jobId', cleanupJob);

// POST /api/analyze
// Analyze media file metadata (optional)
router.post('/analyze', analyzeMedia);

// Push Notification Routes
router.get('/vapid-public-key', getVapidPublicKey);
router.post('/subscribe-push', subscribePush);
router.post('/unsubscribe-push', unsubscribePush);

module.exports = router;
