const webpush = require('web-push');

/**
 * Push Notification Service
 * Manages push subscriptions and sends notifications
 */
class PushService {
    constructor() {
        // Store subscriptions in memory
        // Key: subscriptionId, Value: subscription object
        this.subscriptions = new Map();

        // Setup VAPID details from environment
        if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
            webpush.setVapidDetails(
                process.env.VAPID_SUBJECT || 'mailto:noreply@avutility.com',
                process.env.VAPID_PUBLIC_KEY,
                process.env.VAPID_PRIVATE_KEY
            );
            console.log('✅ Web Push VAPID configured');
        } else {
            console.warn('⚠️  VAPID keys not found in environment. Push notifications disabled.');
        }
    }

    /**
     * Get VAPID public key for client subscription
     * @returns {string} Public key
     */
    getPublicKey() {
        return process.env.VAPID_PUBLIC_KEY;
    }

    /**
     * Add push subscription
     * @param {string} subscriptionId - Unique ID for this subscription
     * @param {Object} subscription - Push subscription object from browser
     */
    addSubscription(subscriptionId, subscription) {
        this.subscriptions.set(subscriptionId, subscription);
        console.log(`📬 Push subscription added: ${subscriptionId}`);
        console.log(`   Total subscriptions: ${this.subscriptions.size}`);
    }

    /**
     * Remove push subscription
     * @param {string} subscriptionId
     */
    removeSubscription(subscriptionId) {
        const removed = this.subscriptions.delete(subscriptionId);
        if (removed) {
            console.log(`📭 Push subscription removed: ${subscriptionId}`);
        }
    }

    /**
     * Send push notification
     * @param {string} subscriptionId - ID of subscription to send to
     * @param {Object} payload - Notification payload
     * @returns {Promise<boolean>} Success
     */
    async sendNotification(subscriptionId, payload) {
        const subscription = this.subscriptions.get(subscriptionId);

        if (!subscription) {
            console.log(`⚠️  No subscription found for ID: ${subscriptionId}`);
            return false;
        }

        try {
            const payloadString = JSON.stringify(payload);

            await webpush.sendNotification(subscription, payloadString);

            console.log(`📨 Push notification sent to: ${subscriptionId}`);
            console.log(`   Title: ${payload.title}`);

            return true;
        } catch (error) {
            console.error(`❌ Failed to send push notification to ${subscriptionId}:`, error.message);

            // If subscription is no longer valid, remove it
            if (error.statusCode === 410 || error.statusCode === 404) {
                console.log(`   Subscription expired, removing: ${subscriptionId}`);
                this.removeSubscription(subscriptionId);
            }

            return false;
        }
    }

    /**
     * Get subscription count
     * @returns {number}
     */
    getSubscriptionCount() {
        return this.subscriptions.size;
    }

    /**
     * Check if push is enabled
     * @returns {boolean}
     */
    isEnabled() {
        return !!process.env.VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;
    }
}

// Singleton instance
const pushService = new PushService();

module.exports = pushService;
