const mongoose = require('mongoose');

/**
 * Job Schema for MongoDB
 * Stores processing job information persistently across instances
 */
const jobSchema = new mongoose.Schema({
    _id: {
        type: String, // Use jobId as _id
        required: true
    },
    operationType: {
        type: String,
        required: true,
        enum: ['extract-audio', 'audio-convert', 'audio-compress', 'video-compress']
    },
    inputKey: {
        type: String,
        required: true
    },
    outputKey: {
        type: String
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'queued', 'processing', 'completed', 'failed'],
        default: 'pending'
    },
    progress: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    timemark: {
        type: String,
        default: '00:00:00'
    },
    result: {
        type: mongoose.Schema.Types.Mixed // Flexible object for result data
    },
    error: {
        type: String
    },
    options: {
        type: mongoose.Schema.Types.Mixed // Processing options
    },
    subscriptionId: {
        type: String // Push notification subscription ID
    },
    sessionId: {
        type: String // User session ID for cleanup
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    startedAt: {
        type: Date
    },
    completedAt: {
        type: Date
    },
    // TTL index for automatic cleanup
    expiresAt: {
        type: Date,
        index: true
    }
}, {
    timestamps: true
});

// Index for querying jobs by status
jobSchema.index({ status: 1, createdAt: 1 });

// Index for session-based queries
jobSchema.index({ sessionId: 1, status: 1 });

// TTL index - automatically delete after expiresAt
jobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Job = mongoose.model('Job', jobSchema);

module.exports = Job;
