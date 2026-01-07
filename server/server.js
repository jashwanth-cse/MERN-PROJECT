require('dotenv').config();
const express = require('express');
const cors = require("cors");
const connectDB = require('./config/db');
const authRoutes = require("./routes/auth");
const mediaRoutes = require("./routes/mediaRoutes");
const extractAudioRoutes = require("./routes/extractAudioRoutes");
const audioConvertRoutes = require("./routes/audioConvertRoutes");
const audioCompressRoutes = require("./routes/audioCompressRoutes");
const videoCompressRoutes = require("./routes/videoCompressRoutes");
const { initializeCleanup } = require('./utils/cleanupUtil');
const scheduledCleanup = require('./utils/scheduledCleanup');
const { trackSession } = require('./middleware/sessionTracking');


const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Middleware
// Configure CORS to allow frontend requests
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session tracking middleware (works for both Google OAuth and email/password)
app.use(trackSession);

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Routes
app.get("/", (req, res) => {
    res.json({
        message: "A/V Utility Platform API",
        version: "2.0.0",
        endpoints: {
            // New R2-based API (recommended)
            generateUploadUrl: "POST /api/upload-url",
            startJob: "POST /api/start-job",
            jobStatus: "GET /api/job-status/:jobId (SSE)",
            downloadUrl: "GET /api/download-url/:jobId",
            cleanup: "POST /api/cleanup/:jobId",
            analyze: "POST /api/analyze",
            vapidPublicKey: "GET /api/vapid-public-key",
            subscribePush: "POST /api/subscribe-push",
            unsubscribePush: "POST /api/unsubscribe-push",
            // Auth
            register: "POST /api/auth/register",
            login: "POST /api/auth/login",
            // Legacy endpoints (deprecated, will be removed)
            extractAudioUpload: "POST /api/extract-audio/upload [DEPRECATED]",
            audioConvertUpload: "POST /api/audio-convert/upload [DEPRECATED]",
            audioCompressUpload: "POST /api/audio-compress/upload [DEPRECATED]",
            videoCompressUpload: "POST /api/video-compress/upload [DEPRECATED]"
        }
    });
});

// Authentication routes
app.use("/api/auth", authRoutes);

// New Media Processing routes (R2-based)
app.use("/api", mediaRoutes);

// Legacy routes (deprecated, kept for backward compatibility)
app.use("/api/extract-audio", extractAudioRoutes);
app.use("/api/audio-convert", audioConvertRoutes);
app.use("/api/audio-compress", audioCompressRoutes);
app.use("/api/video-compress", videoCompressRoutes);

// 404 handler
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        message: "Route not found"
    });
});

// Note: Multer error handling removed - using R2 signed URLs instead

// Error handling middleware  
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: "Internal server error",
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Server is running on port ${PORT}`);
    console.log(`📡 API available at http://localhost:${PORT}`);

    // Initialize automatic file cleanup
    initializeCleanup();

    // Start scheduled cleanup service
    scheduledCleanup.start();
    console.log('🧹 Scheduled cleanup service started');
});
