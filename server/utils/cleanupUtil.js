const jobService = require('../services/jobService');

/**
 * Cleanup Utility for R2-based Architecture
 * Manages cleanup of expired jobs and memory management
 */

/**
 * Clean up expired jobs from job service
 * Jobs are considered expired if:
 * - They exceed the configured timeout
 * - They are completed/failed and older than 1 hour
 */
const cleanExpiredJobs = () => {
    try {
        const cleaned = jobService.cleanupExpiredJobs();
        if (cleaned > 0) {
            console.log(`🧹 Cleaned up ${cleaned} expired job(s)`);
        }
    } catch (error) {
        console.error('❌ Error during job cleanup:', error.message);
    }
};

/**
 * Get cleanup statistics
 */
const getCleanupStats = () => {
    const stats = jobService.getStats();
    return {
        totalJobs: stats.total,
        activeJobs: stats.processing,
        queuedJobs: stats.queued,
        completedJobs: stats.completed,
        failedJobs: stats.failed,
    };
};

/**
 * Initialize scheduled cleanup task
 * Runs every 5 minutes to cleanup expired jobs
 */
const initializeCleanup = () => {
    console.log('🧹 Initialized automatic job cleanup (runs every 5 minutes)');

    // Run immediately on startup
    cleanExpiredJobs();

    // Schedule to run every 5 minutes
    setInterval(() => {
        cleanExpiredJobs();
    }, 5 * 60 * 1000); // 5 minutes

    // Log stats every 30 minutes
    setInterval(() => {
        const stats = getCleanupStats();
        console.log('📊 Job Statistics:', stats);
    }, 30 * 60 * 1000); // 30 minutes
};

module.exports = {
    cleanExpiredJobs,
    getCleanupStats,
    initializeCleanup,
};
