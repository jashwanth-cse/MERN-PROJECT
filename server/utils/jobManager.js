const { v4: uuidv4 } = require('uuid');

/**
 * Job Manager for tracking video compression jobs
 * Manages job state, progress, and SSE client connections
 */
class JobManager {
    constructor() {
        this.jobs = new Map(); // jobId -> { status, progress, result, sseClients, metadata }
    }

    /**
     * Create a new job
     * @param {Object} metadata - Job metadata (inputFile, options, etc.)
     * @returns {string} jobId
     */
    createJob(metadata) {
        const jobId = uuidv4();
        this.jobs.set(jobId, {
            id: jobId,
            status: 'pending',
            progress: 0,
            timemark: '00:00:00',
            result: null,
            error: null,
            sseClients: [],
            metadata: metadata,
            createdAt: Date.now()
        });
        console.log(`📋 Job created: ${jobId}`);
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
     * Update job progress
     * @param {string} jobId
     * @param {number} percent - Progress percentage (0-100)
     * @param {string} timemark - Current processing time
     */
    updateProgress(jobId, percent, timemark = '00:00:00') {
        const job = this.jobs.get(jobId);
        if (!job) return;

        job.status = 'processing';
        job.progress = Math.min(100, Math.max(0, percent));
        job.timemark = timemark;

        // Broadcast to all SSE clients
        this.broadcastProgress(jobId);
    }

    /**
     * Mark job as complete
     * @param {string} jobId
     * @param {Object} result - Compression result data
     */
    completeJob(jobId, result) {
        const job = this.jobs.get(jobId);
        if (!job) return;

        job.status = 'completed';
        job.progress = 100;
        job.result = result;

        console.log(`✅ Job completed: ${jobId}`);

        // Broadcast completion to all SSE clients
        this.broadcastComplete(jobId);
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

        console.log(`❌ Job failed: ${jobId} - ${error}`);

        // Broadcast error to all SSE clients
        this.broadcastError(jobId);
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
        this.sendSSEMessage(res, {
            type: job.status === 'completed' ? 'complete' : job.status === 'failed' ? 'error' : 'progress',
            progress: job.progress,
            timemark: job.timemark,
            status: job.status,
            ...(job.result && { result: job.result }),
            ...(job.error && { message: job.error })
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

        const message = {
            type: 'progress',
            progress: Math.round(job.progress),
            timemark: job.timemark,
            status: 'processing'
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
            result: job.result
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
            message: job.error
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

        this.jobs.delete(jobId);
        console.log(`🗑️  Job deleted: ${jobId}`);
    }

    /**
     * Clean up old jobs (older than 1 hour)
     */
    cleanupOldJobs() {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        let cleaned = 0;

        for (const [jobId, job] of this.jobs.entries()) {
            if (job.createdAt < oneHourAgo && (job.status === 'completed' || job.status === 'failed')) {
                this.deleteJob(jobId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 Cleaned up ${cleaned} old job(s)`);
        }
    }

    /**
     * Get all job IDs
     * @returns {Array<string>}
     */
    getAllJobIds() {
        return Array.from(this.jobs.keys());
    }

    /**
     * Get job count
     * @returns {number}
     */
    getJobCount() {
        return this.jobs.size;
    }
}

// Singleton instance
const jobManager = new JobManager();

// Cleanup old jobs every 15 minutes
setInterval(() => {
    jobManager.cleanupOldJobs();
}, 15 * 60 * 1000);

module.exports = jobManager;
