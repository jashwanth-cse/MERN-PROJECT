const express = require('express');
// DEPRECATED: Multer removed - use new R2-based API (POST /api/upload-url)
const {
    uploadAudioFile,
    analyzeAudioForCompression,
    compressAudioWithQuality,
    downloadCompressedAudio
} = require('../controllers/audioCompressController');

const router = express.Router();

// DEPRECATED: This endpoint is disabled. Use new API:
// 1. POST /api/upload-url (get signed URL)
// 2. PUT to R2 directly
// 3. POST /api/start-job with operationType: 'audio-compress'
router.post('/upload', (req, res) => {
    res.status(410).json({
        success: false,
        message: 'This endpoint is deprecated. Please use the new R2-based API.',
        migration: {
            step1: 'POST /api/upload-url',
            step2: 'Upload file to R2 using returned uploadUrl',
            step3: 'POST /api/start-job with operationType: audio-compress'
        }
    });
});

// POST /api/audio-compress/analyze
// STEP 2: Analyze audio file metadata
router.post('/analyze', analyzeAudioForCompression);

// POST /api/audio-compress/compress
// STEP 3: Compress audio with quality settings
router.post('/compress', compressAudioWithQuality);

// GET /api/audio-compress/download/:filename
// Download compressed audio file
router.get('/download/:filename', downloadCompressedAudio);

module.exports = router;
