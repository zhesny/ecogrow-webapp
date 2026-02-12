const CACHE_NAME = 'ecogrow-v4.5.1';
const APP_VERSION = '4.5.1';
const OFFLINE_URL = './offline.html';
const PRECACHE_URLS = [
    './',
    './index.html',
    './offline.html',
    './manifest.json',
    './api-client.js',
    './app.js',
    './charts.js',
    './config.js',
    './notifications.js',
    './theme.js',
    './styles.css',
    './icon-192.png',
    './icon-512.png',
    './favicon.ico'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.url.includes('ecogrow.local') ||
        request.url.includes('/api/') ||
        request.url.includes('192.168.')) {
        return;
    }
    if (request.url.startsWith(self.location.origin)) {
        event.respondWith(
            caches.match(request)
                .then(response => {
                    if (response) return response;
                    return fetch(request).then(networkResponse => {
                        if (networkResponse && networkResponse.status === 200) {
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME).then(cache => {
                                cache.put(request, responseToCache);
                            });
                        }
                        return networkResponse;
                    }).catch(() => {
                        if (request.headers.get('Accept').includes('text/html')) {
                            return caches.match(OFFLINE_URL);
                        }
                        return new Response(JSON.stringify({
                            error: 'offline',
                            message: 'Нет подключения к интернету'
                        }), {
                            headers: { 'Content-Type': 'application/json' }
                        });
                    });
                })
        );
    }
});

self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : {};
    const options = {
        body: data.body || 'Новое уведомление от EcoGrow',
        icon: './icon-192.png',
        badge: './icon-192.png',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 'ecogrow-notification'
        },
        actions: [
            { action: 'open', title: 'Открыть приложение' },
            { action: 'close', title: 'Закрыть' }
        ]
    };
    event.waitUntil(
        self.registration.showNotification(data.title || 'EcoGrow', options)
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    if (event.action === 'open') {
        event.waitUntil(clients.openWindow('./'));
    } else {
        event.waitUntil(
            self.registration.getNotifications().then(notifications => {
                notifications.forEach(notification => notification.close());
            })
        );
    }
});

self.addEventListener('sync', event => {
    if (event.tag === 'sync-ecogrow-data') {
        event.waitUntil(syncData());
    }
});

async function syncData() {
    console.log('[Service Worker] Background sync');
}

if ('periodicSync' in self.registration) {
    self.addEventListener('periodicsync', event => {
        if (event.tag === 'ecogrow-periodic-sync') {
            event.waitUntil(periodicSync());
        }
    });
}

async function periodicSync() {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    for (const request of requests) {
        try {
            const networkResponse = await fetch(request);
            if (networkResponse.ok) {
                cache.put(request, networkResponse);
            }
        } catch (e) {}
    }
}

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});