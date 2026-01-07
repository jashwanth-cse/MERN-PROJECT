const { v4: uuidv4 } = require('uuid');

/**
 * Enhanced Job Service for R2-based media processing
 * Extends jobManager with R2 object tracking, concurrent limiting, and queueing
 */
class JobService {
    constructor() {
        this.jobs = new Map(); // jobId -> job data
        this.queue = []; // Pending jobs waiting for processing slot
        this.maxConcurrentJobs = parseInt(process.env.MAX_CONCURRENT_JOBS) || 2;
        this.jobTimeoutMinutes = parseInt(process.env.JOB_TIMEOUT_MINUTES) || 30;

        console.log(`✅ Job Service initialized (max concurrent: ${this.maxConcurrentJobs})`);
    }

    /**
     * Create a new job
     * @param {Object} params - Job parameters
     * @param {string} params.operationType - Type of operation (extract-audio, audio-convert, etc.)
     * @param {string} params.inputKey - R2 input object key
     * @param {Object} params.options - Processing options
     * @param {string} params.subscriptionId - Optional push notification subscription ID
     * @returns {string} jobId
     */
    createJob({ operationType, inputKey, options, subscriptionId }) {
        const jobId = uuidv4();
        const now = Date.now();

        const job = {
            id: jobId,
            operationType,
            inputKey,
            outputKey: null,
            status: 'pending', // pending, queued, processing, completed, failed
            progress: 0,
            timemark: '00:00:00',
            result: null,
            error: null,
            sseClients: [],
            options,
            subscriptionId,
            createdAt: now,
            startedAt: null,
            completedAt: null,
            expiresAt: now + (this.jobTimeoutMinutes * 60 * 1000),
        };

        this.jobs.set(jobId, job);

        // Check if we can start immediately or need to queue
        const activeJobs = this.getActiveJobCount();
        if (activeJobs >= this.maxConcurrentJobs) {
            job.status = 'queued';
            this.queue.push(jobId);
            console.log(`📋 Job queued: ${jobId} (position: ${this.queue.length})`);
        } else {
            console.log(`📋 Job created: ${jobId} (${operationType})`);
        }

        return jobId;
    }

    /**
     * Get job by ID
     * @param {string} jobId
     * @returns {Object|null}
     */
    getJob(jobId) {
        return this.jobs.get(jobId) || null;
    }

    /**
     * Start processing a job
     * @param {string} jobId
     */
    startJob(jobId) {
        const job = this.jobs.get(jobId);
        if (!job) return;

        job.status = 'processing';
        job.startedAt = Date.now();
        console.log(`▶️  Job started: ${jobId}`);

        this.broadcastProgress(jobId);
    }

    /**
     * Update job progress
     * @param {string} jobId
     * @param {number} percent - Progress percentage (0-100)
     * @param {string} timemark - Current processing time
     */
    updateProgress(jobId, percent, timemark = '00:00:00') {
        const job = this.jobs.get(jobId);
        if (!job) return;

        job.progress = Math.min(100, Math.max(0, percent));
        job.timemark = timemark;

        this.broadcastProgress(jobId);
    }

    /**
     * Mark job as complete
     * @param {string} jobId
     * @param {Object} result - Result data
     * @param {string} result.outputKey - R2 output object key
     * @param {string} result.fileName - Output filename
     * @param {number} result.fileSize - Output file size in bytes
     */
    completeJob(jobId, result) {
        const job = this.jobs.get(jobId);
        if (!job) return;

        job.status = 'completed';
        job.progress = 100;
        job.completedAt = Date.now();
        job.outputKey = result.outputKey;
        job.result = result;

        console.log(`✅ Job completed: ${jobId}`);

        this.broadcastComplete(jobId);

        // Send push notification if user subscribed
        if (job.subscriptionId) {
            const pushService = require('../utils/pushService');

            pushService.sendNotification(job.subscriptionId, {
                title: 'Processing Complete! 🎉',
                body: `Your ${job.operationType.replace('-', ' ')} is ready to download!`,
                icon: '/logo192.png',
                badge: '/logo192.png',
                data: {
                    jobId: jobId,
                    url: '/dashboard'
                }
            }).catch(error => {
                console.error(`Failed to send push notification for job ${jobId}:`, error);
            });
        }

        // Process next job in queue
        this.processNextInQueue();
    }

    /**
     * Mark job as failed
     * @param {string} jobId
     * @param {string} error - Error message
     */
    failJob(jobId, error) {
        const job = this.jobs.get(jobId);
        if (!job) return;

        job.status = 'failed';
        job.error = error;
        job.completedAt = Date.now();

        console.log(`❌ Job failed: ${jobId} - ${error}`);

        this.broadcastError(jobId);

        // Process next job in queue
        this.processNextInQueue();
    }

    /**
     * Process next job in queue
     */
    processNextInQueue() {
        if (this.queue.length === 0) return;

        const activeJobs = this.getActiveJobCount();
        if (activeJobs >= this.maxConcurrentJobs) return;

        const nextJobId = this.queue.shift();
        const job = this.jobs.get(nextJobId);

        if (job) {
            job.status = 'pending';
            console.log(`📤 Job dequeued: ${nextJobId}`);

            // Notify that job is ready to start
            this.broadcastProgress(nextJobId);
        }
    }

    /**
     * Get count of active processing jobs
     * @returns {number}
     */
    getActiveJobCount() {
        let count = 0;
        for (const job of this.jobs.values()) {
            if (job.status === 'processing') {
                count++;
            }
        }
        return count;
    }

    /**
     * Get queue position for a job
     * @param {string} jobId
     * @returns {number|null} Position in queue (1-based) or null if not queued
     */
    getQueuePosition(jobId) {
        const index = this.queue.indexOf(jobId);
        return index >= 0 ? index + 1 : null;
    }

    /**
     * Add SSE client to job
     * @param {string} jobId
     * @param {Object} res - Express response object
     */
    addSSEClient(jobId, res) {
        const job = this.jobs.get(jobId);
        if (!job) return false;

        job.sseClients.push(res);
        console.log(`📡 SSE client connected to job ${jobId} (${job.sseClients.length} clients)`);

        // Send current state immediately
        const queuePosition = this.getQueuePosition(jobId);
        this.sendSSEMessage(res, {
            type: job.status === 'completed' ? 'complete' : job.status === 'failed' ? 'error' : 'progress',
            progress: job.progress,
            timemark: job.timemark,
            status: job.status,
            ...(queuePosition && { queuePosition }),
            ...(job.result && { result: job.result }),
            ...(job.error && { message: job.error }),
        });

        return true;
    }

    /**
     * Remove SSE client from job
     * @param {string} jobId
     * @param {Object} res - Express response object
     */
    removeSSEClient(jobId, res) {
        const job = this.jobs.get(jobId);
        if (!job) return;

        job.sseClients = job.sseClients.filter(client => client !== res);
        console.log(`📡 SSE client disconnected from job ${jobId} (${job.sseClients.length} remaining)`);
    }

    /**
     * Broadcast progress update to all SSE clients
     * @param {string} jobId
     */
    broadcastProgress(jobId) {
        const job = this.jobs.get(jobId);
        if (!job) return;

        const queuePosition = this.getQueuePosition(jobId);
        const message = {
            type: 'progress',
            progress: Math.round(job.progress),
            timemark: job.timemark,
            status: job.status,
            ...(queuePosition && { queuePosition }),
        };

        job.sseClients.forEach(client => {
            this.sendSSEMessage(client, message);
        });
    }

    /**
     * Broadcast completion to all SSE clients
     * @param {string} jobId
     */
    broadcastComplete(jobId) {
        const job = this.jobs.get(jobId);
        if (!job) return;

        const message = {
            type: 'complete',
            progress: 100,
            status: 'completed',
            result: job.result,
        };

        job.sseClients.forEach(client => {
            this.sendSSEMessage(client, message);
        });

        // Close all SSE connections
        setTimeout(() => {
            job.sseClients.forEach(client => client.end());
            job.sseClients = [];
        }, 100);
    }

    /**
     * Broadcast error to all SSE clients
     * @param {string} jobId
     */
    broadcastError(jobId) {
        const job = this.jobs.get(jobId);
        if (!job) return;

        const message = {
            type: 'error',
            status: 'failed',
            message: job.error,
        };

        job.sseClients.forEach(client => {
            this.sendSSEMessage(client, message);
        });

        // Close all SSE connections
        setTimeout(() => {
            job.sseClients.forEach(client => client.end());
            job.sseClients = [];
        }, 100);
    }

    /**
     * Send SSE message to client
     * @param {Object} res - Express response object
     * @param {Object} data - Data to send
     */
    sendSSEMessage(res, data) {
        try {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (err) {
            console.error('Error sending SSE message:', err.message);
        }
    }

    /**
     * Delete job from memory
     * @param {string} jobId
     */
    deleteJob(jobId) {
        const job = this.jobs.get(jobId);
        if (!job) return;

        // Close any remaining SSE connections
        job.sseClients.forEach(client => {
            try {
                client.end();
            } catch (err) {
                // Ignore errors
            }
        });

        // Remove from queue if present
        const queueIndex = this.queue.indexOf(jobId);
        if (queueIndex >= 0) {
            this.queue.splice(queueIndex, 1);
        }

        this.jobs.delete(jobId);
        console.log(`🗑️  Job deleted: ${jobId}`);
    }

    /**
     * Clean up expired jobs (past timeout)
     * @returns {number} Number of jobs cleaned up
     */
    cleanupExpiredJobs() {
        const now = Date.now();
        let cleaned = 0;

        for (const [jobId, job] of this.jobs.entries()) {
            // Clean up if expired or completed/failed and older than 1 hour
            const shouldCleanup =
                (now > job.expiresAt) ||
                ((job.status === 'completed' || job.status === 'failed') &&
                    (now - job.completedAt > 60 * 60 * 1000));

            if (shouldCleanup) {
                this.deleteJob(jobId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 Cleaned up ${cleaned} expired job(s)`);
        }

        return cleaned;
    }

    /**
     * Get all job IDs
     * @returns {Array<string>}
     */
    getAllJobIds() {
        return Array.from(this.jobs.keys());
    }

    /**
     * Get job statistics
     * @returns {Object}
     */
    getStats() {
        const stats = {
            total: this.jobs.size,
            pending: 0,
            queued: this.queue.length,
            processing: 0,
            completed: 0,
            failed: 0,
        };

        for (const job of this.jobs.values()) {
            if (job.status === 'pending') stats.pending++;
            else if (job.status === 'processing') stats.processing++;
            else if (job.status === 'completed') stats.completed++;
            else if (job.status === 'failed') stats.failed++;
        }

        return stats;
    }
}

// Singleton instance
const jobService = new JobService();

// Cleanup expired jobs every 5 minutes
setInterval(() => {
    jobService.cleanupExpiredJobs();
}, 5 * 60 * 1000);

module.exports = jobService;
