import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';

// Firebase configuration from environment variables
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Validate configuration
const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missingKeys = requiredKeys.filter(key => !firebaseConfig[key]);

if (missingKeys.length > 0) {
    console.error('Missing Firebase configuration:', missingKeys.join(', '));
    console.error('Please add the required environment variables to your .env file');
}

// Initialize Firebase
let app;
try {
    app = initializeApp(firebaseConfig);
    console.log('✅ Firebase initialized successfully');
} catch (error) {
    if (error.code === 'app/duplicate-app') {
        console.log('⚠️ Firebase already initialized');
    } else {
        console.error('❌ Firebase initialization error:', error);
    }
}

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
    prompt: 'select_account', // Always show account selection
});

// Initialize Firebase Analytics (browser-only, with safety checks)
let analytics = null;
if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
    // Check if analytics is supported (respects ad-blockers, privacy extensions)
    isSupported().then(supported => {
        if (supported) {
            try {
                analytics = getAnalytics(app);
                console.log('✅ Firebase Analytics initialized');
            } catch (error) {
                console.warn('Analytics initialization skipped:', error.message);
            }
        } else {
            console.log('ℹ️ Analytics not supported in this environment');
        }
    }).catch(err => {
        console.warn('Analytics support check failed:', err);
    });
}

export { analytics };

export default app;
