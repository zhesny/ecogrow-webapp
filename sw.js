const CACHE_NAME = 'ecogrow-v3.3';
const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/config.js',
    '/api-client.js',
    '/charts.js',
    '/theme.js',
    '/notifications.js',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-512.png'
];

// Install event
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

// Activate event
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
        })
    );
});

// Fetch event
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                
                return fetch(event.request).then(response => {
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    
                    return response;
                });
            })
    );
});

// Background sync for offline data
self.addEventListener('sync', event => {
    if (event.tag === 'sync-ecogrow-data') {
        event.waitUntil(syncData());
    }
});

async function syncData() {
    // Implement offline data sync
    const requests = await indexedDB.getAll('pending-requests');
    
    for (const request of requests) {
        try {
            await fetch(request.url, request.options);
            await indexedDB.delete('pending-requests', request.id);
        } catch (error) {
            console.error('Sync failed:', error);
        }
    }
}
