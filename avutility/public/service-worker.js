/* eslint-disable no-restricted-globals */
// Service Worker for Web Push Notifications

// Install event
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    self.skipWaiting(); // Activate immediately
});

// Activate event
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(self.clients.claim()); // Take control of all pages
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push received');

    let data = {
        title: 'Notification',
        body: 'You have a new notification',
        icon: '/logo192.png',
        badge: '/logo192.png',
        data: {}
    };

    // Parse push data if available
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            console.error('[Service Worker] Error parsing push data:', e);
        }
    }

    console.log('[Service Worker] Notification data:', data);

    // Show notification
    const notificationOptions = {
        body: data.body,
        icon: data.icon || '/logo192.png',
        badge: data.badge || '/logo192.png',
        vibrate: [200, 100, 200],
        tag: 'video-compression',
        requireInteraction: false,
        data: data.data || {},
        actions: [
            { action: 'open', title: 'Open App', icon: '/logo192.png' },
            { action: 'close', title: 'Close', icon: '/logo192.png' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, notificationOptions)
            .then(() => {
                console.log('[Service Worker] Notification shown');

                // Play notification sound (if supported)
                playNotificationSound();
            })
    );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification clicked:', event.action);

    event.notification.close();

    if (event.action === 'close') {
        return;
    }

    // Open or focus app window
    const urlToOpen = event.notification.data.url || '/compress-video';
    const promiseChain = clients.matchAll({
        type: 'window',
        includeUncontrolled: true
    }).then((windowClients) => {
        // Check if there's already a window open
        for (let i = 0; i < windowClients.length; i++) {
            const client = windowClients[i];
            if (client.url.includes(urlToOpen) && 'focus' in client) {
                return client.focus();
            }
        }

        // No matching window found, open new one
        if (clients.openWindow) {
            return clients.openWindow(urlToOpen);
        }
    });

    event.waitUntil(promiseChain);
});

// Helper function to play notification sound
function playNotificationSound() {
    try {
        // Note: Sound playback from service worker is limited
        // This is a best-effort attempt
        self.clients.matchAll({ type: 'window' }).then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'PLAY_NOTIFICATION_SOUND'
                });
            });
        });
    } catch (error) {
        console.error('[Service Worker] Error playing sound:', error);
    }
}

// Message event - handle messages from clients
self.addEventListener('message', (event) => {
    console.log('[Service Worker] Message received:', event.data);

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
