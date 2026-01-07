const { getFirestore } = require('../config/firebase');

/**
 * Firestore Job Repository
 * Handles all Firestore operations for job persistence
 * Works for both OAuth and email/password users
 */
class JobRepository {
    constructor() {
        this.db = getFirestore();
        this.collection = this.db.collection('jobs');
        console.log('✅ Job Repository initialized (Firestore)');
    }

    /**
     * Create or update a job in Firestore
     * @param {string} jobId - Job ID
     * @param {Object} jobData - Job data
     */
    async saveJob(jobId, jobData) {
        try {
            // Remove SSE clients before saving (they can't be serialized)
            const { sseClients, ...dataToSave } = jobData;

            // Convert dates to Firestore Timestamps
            const firestoreData = {
                ...dataToSave,
                id: jobId,
                createdAt: this.toTimestamp(dataToSave.createdAt),
                startedAt: this.toTimestamp(dataToSave.startedAt),
                completedAt: this.toTimestamp(dataToSave.completedAt),
                expiresAt: this.toTimestamp(dataToSave.expiresAt),
                updatedAt: new Date(),
            };

            await this.collection.doc(jobId).set(firestoreData, { merge: true });
            return true;
        } catch (error) {
            console.error(`Error saving job ${jobId} to Firestore:`, error);
            return false;
        }
    }

    /**
     * Get a job from Firestore
     * @param {string} jobId - Job ID
     * @returns {Object|null} Job data or null if not found
     */
    async getJob(jobId) {
        try {
            const doc = await this.collection.doc(jobId).get();

            if (!doc.exists) {
                return null;
            }

            const data = doc.data();

            // Convert Firestore Timestamps back to milliseconds
            return {
                ...data,
                createdAt: this.fromTimestamp(data.createdAt),
                startedAt: this.fromTimestamp(data.startedAt),
                completedAt: this.fromTimestamp(data.completedAt),
                expiresAt: this.fromTimestamp(data.expiresAt),
                sseClients: [], // Initialize empty SSE clients array
            };
        } catch (error) {
            console.error(`Error getting job ${jobId} from Firestore:`, error);
            return null;
        }
    }

    /**
     * Delete a job from Firestore
     * @param {string} jobId - Job ID
     */
    async deleteJob(jobId) {
        try {
            await this.collection.doc(jobId).delete();
            return true;
        } catch (error) {
            console.error(`Error deleting job ${jobId} from Firestore:`, error);
            return false;
        }
    }

    /**
     * Get all jobs (for queue management and cleanup)
     * @returns {Array} Array of jobs
     */
    async getAllJobs() {
        try {
            const snapshot = await this.collection.get();
            const jobs = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                jobs.push({
                    ...data,
                    createdAt: this.fromTimestamp(data.createdAt),
                    startedAt: this.fromTimestamp(data.startedAt),
                    completedAt: this.fromTimestamp(data.completedAt),
                    expiresAt: this.fromTimestamp(data.expiresAt),
                    sseClients: [],
                });
            });

            return jobs;
        } catch (error) {
            console.error('Error getting all jobs from Firestore:', error);
            return [];
        }
    }

    /**
     * Get jobs by status
     * @param {string} status - Job status
     * @returns {Array} Array of jobs
     */
    async getJobsByStatus(status) {
        try {
            const snapshot = await this.collection.where('status', '==', status).get();
            const jobs = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                jobs.push({
                    ...data,
                    createdAt: this.fromTimestamp(data.createdAt),
                    startedAt: this.fromTimestamp(data.startedAt),
                    completedAt: this.fromTimestamp(data.completedAt),
                    expiresAt: this.fromTimestamp(data.expiresAt),
                    sseClients: [],
                });
            });

            return jobs;
        } catch (error) {
            console.error(`Error getting jobs with status ${status}:`, error);
            return [];
        }
    }

    /**
     * Delete expired jobs (automated cleanup)
     * @returns {number} Number of jobs deleted
     */
    async deleteExpiredJobs() {
        try {
            const now = new Date();
            const snapshot = await this.collection
                .where('expiresAt', '<=', now)
                .get();

            const batch = this.db.batch();
            let count = 0;

            snapshot.forEach(doc => {
                batch.delete(doc.ref);
                count++;
            });

            if (count > 0) {
                await batch.commit();
                console.log(`🧹 Deleted ${count} expired jobs from Firestore`);
            }

            return count;
        } catch (error) {
            console.error('Error deleting expired jobs:', error);
            return 0;
        }
    }

    /**
     * Convert milliseconds to Firestore Timestamp
     * @param {number} ms - Milliseconds
     * @returns {Timestamp|null}
     */
    toTimestamp(ms) {
        if (!ms) return null;
        return new Date(ms);
    }

    /**
     * Convert Firestore Timestamp to milliseconds
     * @param {Timestamp} timestamp - Firestore timestamp
     * @returns {number|null}
     */
    fromTimestamp(timestamp) {
        if (!timestamp) return null;
        if (timestamp.toDate) {
            return timestamp.toDate().getTime();
        }
        if (timestamp instanceof Date) {
            return timestamp.getTime();
        }
        return null;
    }
}

// Singleton instance
const jobRepository = new JobRepository();

module.exports = jobRepository;
