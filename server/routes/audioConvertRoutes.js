const express = require('express');
// DEPRECATED: Multer removed - use new R2-based API (POST /api/upload-url)
const {
    uploadAudioFile,
    analyzeAudioMetadata,
    downloadConvertedAudio
} = require('../controllers/audioConvertController');
const { convertAudioWithProgress } = require('../controllers/audioConvertProgressController');

const router = express.Router();

// DEPRECATED: This endpoint is disabled. Use new API:
// 1. POST /api/upload-url (get signed URL)
// 2. PUT to R2 directly
// 3. POST /api/start-job with operationType: 'audio-convert'
router.post('/upload', (req, res) => {
    res.status(410).json({
        success: false,
        message: 'This endpoint is deprecated. Please use the new R2-based API.',
        migration: {
            step1: 'POST /api/upload-url',
            step2: 'Upload file to R2 using returned uploadUrl',
            step3: 'POST /api/start-job with operationType: audio-convert'
        }
    });
});

// POST /api/audio-convert/analyze
// Analyze audio file metadata  
router.post('/analyze', analyzeAudioMetadata);

// POST /api/audio-convert/convert
// Convert audio file with real-time progress via SSE
router.post('/convert', convertAudioWithProgress);

// GET /api/audio-convert/download/:filename
// Download converted audio file
router.get('/download/:filename', downloadConvertedAudio);

module.exports = router;
