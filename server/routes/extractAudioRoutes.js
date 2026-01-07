const express = require('express');
// DEPRECATED: Multer removed - use new R2-based API (POST /api/upload-url)
const {
    uploadVideo,
    detectAudioTracks,
    extractAudioTrack,
    downloadExtractedAudio
} = require('../controllers/extractAudioController');

const router = express.Router();

// DEPRECATED: This endpoint is disabled. Use new API:
// 1. POST /api/upload-url (get signed URL)
// 2. PUT to R2 directly
// 3. POST /api/start-job with operationType: 'extract-audio'
router.post('/upload', (req, res) => {
    res.status(410).json({
        success: false,
        message: 'This endpoint is deprecated. Please use the new R2-based API.',
        migration: {
            step1: 'POST /api/upload-url',
            step2: 'Upload file to R2 using returned uploadUrl',
            step3: 'POST /api/start-job with operationType: extract-audio'
        }
    });
});

// POST /api/extract-audio/detect-tracks
// Detect audio tracks from uploaded video
router.post('/detect-tracks', detectAudioTracks);

// POST /api/extract-audio/extract
// Extract audio track from video (NO SSE - regular response)
router.post('/extract', extractAudioTrack);

// GET /api/extract-audio/download/:filename
// Download extracted audio file
router.get('/download/:filename', downloadExtractedAudio);

module.exports = router;
