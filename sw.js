// Service Worker для EcoGrow PWA
const CACHE_NAME = 'ecogrow-v4.5';
const OFFLINE_URL = './offline.html';

// Упрощенный Service Worker для GitHub Pages
self.addEventListener('install', event => {
    console.log('[Service Worker] Установка');
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
    console.log('[Service Worker] Активация');
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
    // Пропускаем запросы к внешним ресурсам
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }
    
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(OFFLINE_URL) || 
                   new Response('Оффлайн режим', { status: 503 });
        })
    );
});
