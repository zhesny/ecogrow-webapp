// Service Worker для EcoGrow PWA
const CACHE_NAME = 'ecogrow-v4.5.1';
const OFFLINE_URL = './offline.html';

// Ресурсы для кэширования при установке
const STATIC_CACHE_URLS = [
    './',
    './index.html',
    './offline.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/chart.js',
    './api-client.js',
    './demo-api.js',
    './theme.js',
    './charts.js',
    './notifications.js',
    './config.js',
    './app.js'
];

// Установка Service Worker
self.addEventListener('install', event => {
    console.log('[Service Worker] Установка');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Кэширование ресурсов');
                return cache.addAll(STATIC_CACHE_URLS);
            })
            .then(() => {
                console.log('[Service Worker] Все ресурсы закэшированы');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('[Service Worker] Ошибка кэширования:', error);
            })
    );
});

// Активация Service Worker
self.addEventListener('activate', event => {
    console.log('[Service Worker] Активация');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Удаление старого кэша:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[Service Worker] Активен');
            return self.clients.claim();
        })
    );
});

// Перехват запросов
self.addEventListener('fetch', event => {
    // Пропускаем запросы к внешним ресурсам (API, изображения и т.д.)
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }
    
    // Для навигационных запросов (страницы)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Клонируем ответ для кэширования
                    const responseClone = response.clone();
                    
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    
                    return response;
                })
                .catch(() => {
                    // Если нет сети, показывае оффлайн страницу
                    return caches.match(OFFLINE_URL);
                })
        );
        return;
    }
    
    // Для других запросов (скрипты, стили и т.д.)
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                
                return fetch(event.request)
                    .then(response => {
                        // Не кэшируем ответы с ошибками
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Клонируем ответ для кэширования
                        const responseToCache = response.clone();
                        
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    })
                    .catch(() => {
                        // Если ресурс не найден в кэше и нет сети
                        if (event.request.url.includes('.html')) {
                            return caches.match(OFFLINE_URL);
                        }
                        
                        return new Response('Оффлайн', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({
                                'Content-Type': 'text/plain'
                            })
                        });
                    });
            })
    );
});

// Обработка сообщений от основного потока
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Обработка синхронизации в фоне
self.addEventListener('sync', event => {
    if (event.tag === 'sync-data') {
        console.log('[Service Worker] Синхронизаци данных');
        event.waitUntil(syncData());
    }
});

// Функция синхронизации данных
async function syncData() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const requests = await cache.keys();
        
        // Здесь можно добавить логику синхронизации с сервером
        console.log('[Service Worker] Данные синхронизированы');
        
        return Promise.resolve();
    } catch (error) {
        console.error('[Service Worker] Ошибка синхронизации:', error);
        return Promise.reject(error);
    }
}

// Обработка push-уведомлений
self.addEventListener('push', event => {
    console.log('[Service Worker] Push уведомление получено');
    
    if (!event.data) {
        console.log('[Service Worker] Нет данных в push уведомлении');
        return;
    }
    
    const data = event.data.json();
    const options = {
        body: data.body || 'Новое уведомление от EcoGrow',
        icon: './icon-192.png',
        badge: './icon-192.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || './'
        }
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'EcoGrow', options)
    );
});

// Обработка кликов по уведомлениям
self.addEventListener('notificationclick', event => {
    console.log('[Service Worker] Клик по уведомлению');
    
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                for (const client of clientList) {
                    if (client.url === event.notification.data.url && 'focus' in client) {
                        return client.focus();
                    }
                }
                
                if (clients.openWindow) {
                    return clients.openWindow(event.notification.data.url);
                }
            })
    );
});
