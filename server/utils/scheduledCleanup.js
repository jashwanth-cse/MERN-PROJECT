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
        this.cleanupInterval = parseInt(process.env.CLEANUP_INTERVAL_MS) || 300000; // 5 minutes
        this.jobRetentionTime = parseInt(process.env.JOB_RETENTION_MS) || 86400000; // 24 hours
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

            // Get all job IDs
            const jobIds = jobService.getAllJobIds();

            for (const jobId of jobIds) {
                try {
                    const job = jobService.getJob(jobId);
                    if (!job) continue;

                    const shouldDelete = this.shouldDeleteJob(job);

                    if (shouldDelete) {
                        console.log(`🗑️  Deleting old job: ${jobId} (age: ${this.getJobAge(job)}h)`);

                        // Delete output file from R2
                        if (job.outputKey) {
                            try {
                                await r2Service.deleteFile(job.outputKey);
                                stats.filesDeleted++;
                                console.log(`   ✓ Deleted output: ${job.outputKey}`);
                            } catch (error) {
                                console.error(`   ✗ Failed to delete output: ${error.message}`);
                                stats.errors++;
                            }
                        }

                        // Delete input file from R2 (only if no other jobs are using it)
                        if (job.inputKey && !this.isInputKeyInUse(job.inputKey, jobId, jobIds)) {
                            try {
                                await r2Service.deleteFile(job.inputKey);
                                stats.filesDeleted++;
                                console.log(`   ✓ Deleted input: ${job.inputKey}`);
                            } catch (error) {
                                console.error(`   ✗ Failed to delete input: ${error.message}`);
                                stats.errors++;
                            }
                        }

                        // Delete job from memory
                        jobService.deleteJob(jobId);
                        stats.jobsDeleted++;
                    }
                } catch (error) {
                    console.error(`Error cleaning job ${jobId}:`, error);
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
        const jobAge = now - job.createdAt;

        // Delete completed jobs older than retention time
        if (job.status === 'completed' && jobAge > this.jobRetentionTime) {
            return true;
        }

        // Delete failed jobs older than 1 hour
        if (job.status === 'failed' && jobAge > 3600000) {
            return true;
        }

        // Delete stale pending jobs older than 1 hour (likely orphaned)
        if (job.status === 'pending' && jobAge > 3600000) {
            return true;
        }

        // Delete processing jobs older than 2 hours (likely stuck)
        if (job.status === 'processing' && jobAge > 7200000) {
            return true;
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
    isInputKeyInUse(inputKey, excludeJobId, allJobIds) {
        for (const jobId of allJobIds) {
            if (jobId !== excludeJobId) {
                const job = jobService.getJob(jobId);
                if (job && job.inputKey === inputKey) {
                    // Don't delete if another job is still using this input
                    if (job.status === 'pending' || job.status === 'processing' || job.status === 'queued') {
                        return true;
                    }
                }
            }
        }
        return false;
    }
}

// Create singleton instance
const cleanupService = new ScheduledCleanupService();

module.exports = cleanupService;
