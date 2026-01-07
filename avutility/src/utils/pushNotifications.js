/**
 * Push Notifications Utility
 * Handles service worker registration and push subscription management
 */

const API_URL = 'http://localhost:3000/api/video-compress';

/**
 * Register service worker
 * @returns {Promise<ServiceWorkerRegistration>}
 */
export async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        console.warn('Service Worker not supported');
        return null;
    }

    try {
        const registration = await navigator.serviceWorker.register('/service-worker.js', {
            scope: '/'
        });

        console.log('✅ Service Worker registered:', registration.scope);

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

        return registration;
    } catch (error) {
        console.error('❌ Service Worker registration failed:', error);
        return null;
    }
}

/**
 * Handle messages from service worker
 * @param {MessageEvent} event
 */
function handleServiceWorkerMessage(event) {
    if (event.data && event.data.type === 'PLAY_NOTIFICATION_SOUND') {
        playNotificationSound();
    }
}

/**
 * Request notification permission from user
 * @returns {Promise<boolean>} True if granted
 */
export async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.warn('Notifications not supported');
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    if (Notification.permission === 'denied') {
        console.warn('Notification permission denied');
        return false;
    }

    try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    } catch (error) {
        console.error('Error requesting notification permission:', error);
        return false;
    }
}

/**
 * Convert VAPID public key from base64 to Uint8Array
 * @param {string} base64String
 * @returns {Uint8Array}
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Get VAPID public key from server
 * @returns {Promise<string>}
 */
async function getVapidPublicKey() {
    try {
        const response = await fetch(`${API_URL}/vapid-public-key`);
        const data = await response.json();

        if (data.success) {
            return data.publicKey;
        } else {
            throw new Error(data.message || 'Failed to get VAPID key');
        }
    } catch (error) {
        console.error('Error getting VAPID public key:', error);
        throw error;
    }
}

/**
 * Subscribe to push notifications
 * @returns {Promise<{subscription: PushSubscription, subscriptionId: string}>}
 */
export async function subscribeToPush() {
    try {
        // Ensure we have permission
        const hasPermission = await requestNotificationPermission();
        if (!hasPermission) {
            throw new Error('Notification permission denied');
        }

        // Get service worker registration
        const registration = await navigator.serviceWorker.ready;

        // Get existing subscription or create new one
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            // Get VAPID public key from server
            const vapidPublicKey = await getVapidPublicKey();

            // Subscribe to push
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
            });

            console.log('✅ Push subscription created');
        } else {
            console.log('✅ Using existing push subscription');
        }

        // Send subscription to server
        const response = await fetch(`${API_URL}/subscribe-push`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ subscription })
        });

        const data = await response.json();

        if (data.success) {
            console.log('✅ Push subscription sent to server');
            return {
                subscription,
                subscriptionId: data.subscriptionId
            };
        } else {
            throw new Error(data.message || 'Failed to send subscription to server');
        }
    } catch (error) {
        console.error('❌ Push subscription failed:', error);
        throw error;
    }
}

/**
 * Unsubscribe from push notifications
 * @param {string} subscriptionId
 */
export async function unsubscribeFromPush(subscriptionId) {
    try {
        // Remove from server
        if (subscriptionId) {
            await fetch(`${API_URL}/unsubscribe-push`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ subscriptionId })
            });
        }

        // Unsubscribe from browser
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            await subscription.unsubscribe();
            console.log('✅ Push subscription removed');
        }
    } catch (error) {
        console.error('❌ Unsubscribe failed:', error);
    }
}

/**
 * Check if push notifications are supported
 * @returns {boolean}
 */
export function isPushSupported() {
    return 'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;
}

/**
 * Get current notification permission status
 * @returns {NotificationPermission}
 */
export function getNotificationPermission() {
    if (!('Notification' in window)) {
        return 'denied';
    }
    return Notification.permission;
}

/**
 * Play notification sound
 */
export function playNotificationSound() {
    try {
        const audio = new Audio('/sounds/notification.mp3');
        audio.volume = 0.5;
        audio.play().catch(err => {
            console.log('Audio play failed (may require user interaction):', err.message);
        });
    } catch (error) {
        console.error('Error playing notification sound:', error);
    }
}
