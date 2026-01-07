/**
 * Session Tracking Middleware
 * Tracks active user sessions for both Google OAuth and email/password
 * Used for cleanup when users disconnect
 */

// Store active sessions
const activeSessions = new Map();
// Store session -> job mapping
const sessionJobs = new Map();

/**
 * Track user session
 * Works for both Google OAuth and email/password
 */
function trackSession(req, res, next) {
    // Extract token from Authorization header
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        // No auth - allow request but don't track
        return next();
    }

    try {
        // For email/password: token is JWT
        // For Google: token is Firebase ID token
        // Both are stored in localStorage on frontend

        const sessionId = createSessionId(token);

        // Update last activity
        activeSessions.set(sessionId, {
            token,
            lastActivity: Date.now(),
            userId: null, // Will be set if we decode token
        });

        // Attach session ID to request
        req.sessionId = sessionId;

        next();
    } catch (error) {
        // Don't block request if session tracking fails
        console.warn('Session tracking error:', error);
        next();
    }
}

/**
 * Link job to session
 */
function linkJobToSession(sessionId, jobId) {
    if (!sessionId) return;

    if (!sessionJobs.has(sessionId)) {
        sessionJobs.set(sessionId, new Set());
    }

    sessionJobs.get(sessionId).add(jobId);
    console.log(`📎 Linked job ${jobId} to session ${sessionId.substring(0, 8)}...`);
}

/**
 * Get jobs for session
 */
function getSessionJobs(sessionId) {
    return sessionJobs.get(sessionId) || new Set();
}

/**
 * Clean up inactive sessions
 * Called periodically
 */
function cleanupInactiveSessions() {
    const now = Date.now();
    const inactivityThreshold = 3600000; // 1 hour

    let cleaned = 0;
    for (const [sessionId, session] of activeSessions.entries()) {
        const inactive = now - session.lastActivity;

        if (inactive > inactivityThreshold) {
            // Session inactive for 1+ hour
            console.log(`🧹 Cleaning inactive session: ${sessionId.substring(0, 8)}...`);

            // Get jobs for this session
            const jobs = getSessionJobs(sessionId);
            if (jobs.size > 0) {
                console.log(`   Found ${jobs.size} jobs for cleanup`);
                // Jobs will be cleaned by scheduled cleanup service
            }

            // Remove session
            activeSessions.delete(sessionId);
            sessionJobs.delete(sessionId);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        console.log(`✅ Cleaned ${cleaned} inactive sessions`);
    }

    return cleaned;
}

/**
 * Create session ID from token
 * Hash the token for privacy
 */
function createSessionId(token) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Get active session count
 */
function getActiveSessionCount() {
    return activeSessions.size;
}

/**
 * Get all active sessions
 */
function getActiveSessions() {
    return Array.from(activeSessions.entries()).map(([id, session]) => ({
        id: id.substring(0, 8) + '...',
        lastActivity: new Date(session.lastActivity).toISOString(),
        inactive: ((Date.now() - session.lastActivity) / 1000 / 60).toFixed(1) + ' min'
    }));
}

// Clean up inactive sessions every 10 minutes
setInterval(cleanupInactiveSessions, 600000);

module.exports = {
    trackSession,
    linkJobToSession,
    getSessionJobs,
    cleanupInactiveSessions,
    getActiveSessionCount,
    getActiveSessions,
};
