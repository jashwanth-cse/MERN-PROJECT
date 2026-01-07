const admin = require('firebase-admin');

/**
 * Initialize Firebase Admin SDK
 * Uses Application Default Credentials in Firebase App Hosting environment
 */
let firebaseApp;

function initializeFirebaseAdmin() {
    if (firebaseApp) {
        return firebaseApp;
    }

    try {
        // In Firebase App Hosting, Application Default Credentials are automatically available
        // No need for service account key file
        firebaseApp = admin.initializeApp({
            projectId: process.env.GOOGLE_CLOUD_PROJECT || 'av-utility',
        });

        console.log('✅ Firebase Admin SDK initialized');
        return firebaseApp;
    } catch (error) {
        console.error('❌ Firebase Admin initialization error:', error);
        throw error;
    }
}

// Initialize on module load
initializeFirebaseAdmin();

module.exports = {
    admin,
    firebaseApp,
    getFirestore: () => admin.firestore(),
};
