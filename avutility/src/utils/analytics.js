import { analytics } from '../config/firebase';
import { logEvent, setUserId } from 'firebase/analytics';

/**
 * Analytics Helper Utility
 * Provides safe, reusable functions for tracking events and page views
 */

/**
 * Track a custom event
 * @param {string} eventName - Name of the event (use snake_case)
 * @param {object} params - Event parameters (optional)
 */
export const trackEvent = (eventName, params = {}) => {
    if (!analytics) {
        // Analytics not initialized or blocked - fail silently
        return;
    }

    try {
        logEvent(analytics, eventName, params);
        if (import.meta.env.DEV) {
            console.log(`📊 Analytics Event: ${eventName}`, params);
        }
    } catch (error) {
        // Fail silently - analytics errors should never break the app
        console.warn('Analytics event failed:', error);
    }
};

/**
 * Track a page view (for SPA routing)
 * @param {string} pagePath - The page path (e.g., '/dashboard')
 * @param {string} pageTitle - The page title (optional)
 */
export const trackPageView = (pagePath, pageTitle = '') => {
    trackEvent('page_view', {
        page_path: pagePath,
        page_title: pageTitle || document.title,
    });
};

/**
 * Set the current user ID for analytics
 * @param {string} userId - User ID (use Firebase UID or database ID, NOT email)
 */
export const setAnalyticsUserId = (userId) => {
    if (!analytics) return;

    try {
        setUserId(analytics, userId);
        if (import.meta.env.DEV) {
            console.log(`📊 Analytics User ID set: ${userId}`);
        }
    } catch (error) {
        console.warn('Failed to set analytics user ID:', error);
    }
};

/**
 * Clear the user ID (call on logout)
 */
export const clearAnalyticsUser = () => {
    if (!analytics) return;

    try {
        setUserId(analytics, null);
        if (import.meta.env.DEV) {
            console.log('📊 Analytics User ID cleared');
        }
    } catch (error) {
        console.warn('Failed to clear analytics user ID:', error);
    }
};

// Pre-defined event tracking functions for common actions

export const trackLogin = (method = 'email') => {
    trackEvent('login', { method });
};

export const trackLogout = () => {
    trackEvent('logout');
    clearAnalyticsUser();
};

export const trackUploadStarted = (fileType, fileSize) => {
    trackEvent('upload_started', {
        file_type: fileType,
        file_size_mb: (fileSize / (1024 * 1024)).toFixed(2),
    });
};

export const trackUploadCompleted = (fileType) => {
    trackEvent('upload_completed', { file_type: fileType });
};

export const trackJobStarted = (operationType) => {
    trackEvent('job_started', { operation: operationType });
};

export const trackJobCompleted = (operationType, duration) => {
    trackEvent('job_completed', {
        operation: operationType,
        duration_seconds: duration,
    });
};

export const trackDownloadClicked = (fileType) => {
    trackEvent('download_clicked', { file_type: fileType });
};

export const trackError = (errorType, errorMessage) => {
    trackEvent('error_occurred', {
        error_type: errorType,
        error_message: errorMessage,
    });
};
