const jobService = require('../services/jobService');
const r2Service = require('../services/r2Service');

/**
 * Scheduled Cleanup Service
 * Runs periodically to clean up:
 * - Completed jobs older than 24 hours
 * - Orphaned R2 files
 * - Failed jobs
 * - Jobs from disconnected users
 */

class ScheduledCleanupService {
    constructor() {
        this.isRunning = false;
        this.intervalId = null;
        this.cleanupInterval = parseInt(process.env.CLEANUP_INTERVAL_MS) || 600000; // 10 minutes
        this.completedRetentionTime = 1800000; // 30 minutes (for non-downloaded)
        this.downloadedRetentionTime = 600000; // 10 minutes (after download)
        this.queuedJobTimeout = 3600000; // 1 hour for stuck queued jobs
    }

    /**
     * Start the scheduled cleanup
     */
    start() {
        if (this.isRunning) {
            console.log('⚠️ Cleanup service already running');
            return;
        }

        console.log(`🧹 Starting scheduled cleanup (interval: ${this.cleanupInterval / 1000}s)`);
        this.isRunning = true;

        // Run immediately on start
        this.runCleanup();

        // Then run periodically
        this.intervalId = setInterval(() => {
            this.runCleanup();
        }, this.cleanupInterval);
    }

    /**
     * Stop the scheduled cleanup
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            this.isRunning = false;
            console.log('🛑 Scheduled cleanup stopped');
        }
    }

    /**
     * Run cleanup routine
     */
    async runCleanup() {
        if (!this.isRunning) return;

        console.log(`\n🧹 Running scheduled cleanup (${new Date().toISOString()})`);

        try {
            const stats = {
                jobsDeleted: 0,
                filesDeleted: 0,
                errors: 0
            };

            // Get ALL jobs from Firestore (not just in-memory)
            const jobRepository = require('../repositories/jobRepository');
            const allJobs = await jobRepository.getAllJobs();

            console.log(`📊 Found ${allJobs.length} total jobs in Firestore`);

            for (const job of allJobs) {
                try {
                    if (!job || !job.id) continue;

                    const shouldDelete = this.shouldDeleteJob(job);

                    if (shouldDelete) {
                        console.log(`🗑️  Deleting job: ${job.id} (status: ${job.status}, age: ${this.getJobAge(job)}h, downloaded: ${!!job.downloaded})`);

                        // Delete output file from R2
                        if (job.outputKey) {
                            try {
                                await r2Service.deleteObject(job.outputKey);
                                stats.filesDeleted++;
                                console.log(`   ✓ Deleted output: ${job.outputKey}`);
                            } catch (error) {
                                console.error(`   ✗ Failed to delete output: ${error.message}`);
                                stats.errors++;
                            }
                        }

                        // Delete input file from R2 (only if no other jobs are using it)
                        if (job.inputKey && !await this.isInputKeyInUse(job.inputKey, job.id, allJobs)) {
                            try {
                                await r2Service.deleteObject(job.inputKey);
                                stats.filesDeleted++;
                                console.log(`   ✓ Deleted input: ${job.inputKey}`);
                            } catch (error) {
                                console.error(`   ✗ Failed to delete input: ${error.message}`);
                                stats.errors++;
                            }
                        }

                        // Delete job from Firestore AND memory
                        await jobRepository.deleteJob(job.id);
                        jobService.deleteJob(job.id); // Also remove from memory if present
                        stats.jobsDeleted++;
                    }
                } catch (error) {
                    console.error(`Error cleaning job ${job.id}:`, error);
                    stats.errors++;
                }
            }

            console.log(`✅ Cleanup complete - Deleted: ${stats.jobsDeleted} jobs, ${stats.filesDeleted} files | Errors: ${stats.errors}`);
        } catch (error) {
            console.error('❌ Cleanup routine failed:', error);
        }
    }

    /**
     * Determine if job should be deleted
     */
    shouldDeleteJob(job) {
        const now = Date.now();
        const createdAt = job.createdAt instanceof Date ? job.createdAt.getTime() : job.createdAt;
        const downloadedAt = job.downloadedAt instanceof Date ? job.downloadedAt.getTime() : job.downloadedAt;
        const jobAge = now - createdAt;

        // NEVER delete currently processing jobs
        if (job.status === 'processing') {
            return false;
        }

        // Delete queued jobs stuck for more than 1 hour
        if (job.status === 'queued' && jobAge > this.queuedJobTimeout) {
            console.log(`   ⚠️  Deleting stuck queued job (${Math.floor(jobAge / 3600000)}h old)`);
            return true;
        }

        // Keep fresh queued jobs
        if (job.status === 'queued') {
            return false;
        }

        // Delete failed and pending jobs immediately
        if (job.status === 'failed' || job.status === 'pending') {
            return true;
        }

        // For completed jobs
        if (job.status === 'completed') {
            // If downloaded, delete after 10 minutes
            if (job.downloaded && downloadedAt) {
                const timeSinceDownload = now - downloadedAt;
                if (timeSinceDownload > this.downloadedRetentionTime) {
                    const minutesAgo = Math.floor(timeSinceDownload / 60000);
                    console.log(`   📥 Downloaded ${minutesAgo} minutes ago`);
                    return true;
                }
                return false;
            }

            // If NOT downloaded, delete after 30 minutes
            if (jobAge > this.completedRetentionTime) {
                console.log(`   ⏰ Not downloaded, ${Math.floor(jobAge / 60000)} minutes old`);
                return true;
            }
        }

        return false;
    }

    /**
     * Get job age in hours
     */
    getJobAge(job) {
        const ageMs = Date.now() - job.createdAt;
        return (ageMs / 3600000).toFixed(1);
    }

    /**
     * Check if input key is being used by other jobs
     */
    async isInputKeyInUse(inputKey, excludeJobId, allJobs) {
        for (const job of allJobs) {
            if (job.id !== excludeJobId && job.inputKey === inputKey) {
                // Don't delete if another job is still using this input
                if (job.status === 'pending' || job.status === 'processing' || job.status === 'queued') {
                    return true;
                }
            }
        }
        return false;
    }
}

// Create singleton instance
const cleanupService = new ScheduledCleanupService();

module.exports = cleanupService;
