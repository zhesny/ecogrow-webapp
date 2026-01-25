// Service Worker для EcoGrow PWA
const CACHE_NAME = 'ecogrow-v4.7';
const APP_VERSION = '4.7';
const OFFLINE_URL = './offline.html';

// Файлы для кэширования при установке
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

// Установка Service Worker
self.addEventListener('install', event => {
    console.log('[Service Worker] Установка версии', APP_VERSION);
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Кэширование файлов...');
                return cache.addAll(PRECACHE_URLS);
            })
            .then(() => {
                console.log('[Service Worker] Установка завершена');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('[Service Worker] Ошибка установки:', error);
            })
    );
});

// Активация Service Worker
self.addEventListener('activate', event => {
    console.log('[Service Worker] Активация версии', APP_VERSION);
    
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
        })
        .then(() => {
            console.log('[Service Worker] Активация завершена');
            return self.clients.claim();
        })
    );
});

// Стратегия кэширования: Cache First, Network Fallback
self.addEventListener('fetch', event => {
    const request = event.request;
    
    // Пропускаем запросы к API ESP8266
    if (request.url.includes('ecogrow.local') || 
        request.url.includes('/api/') ||
        request.url.includes('192.168.')) {
        return;
    }
    
    // Для запросов к нашему домену используем Cache First
    if (request.url.startsWith(self.location.origin)) {
        event.respondWith(
            caches.match(request)
                .then(response => {
                    if (response) {
                        console.log('[Service Worker] Запрос из кэша:', request.url);
                        return response;
                    }
                    
                    return fetch(request)
                        .then(networkResponse => {
                            if (!networkResponse || networkResponse.status !== 200) {
                                return networkResponse;
                            }
                            
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(request, responseToCache);
                                });
                            
                            return networkResponse;
                        })
                        .catch(error => {
                            console.log('[Service Worker] Оффлайн режим:', error);
                            
                            // Если запрашивается HTML страница, показываем offline.html
                            if (request.headers.get('Accept').includes('text/html')) {
                                return caches.match(OFFLINE_URL);
                            }
                            
                            // Для API запросов возвращаем ошибку
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

// Обработка push-уведомлений
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
            {
                action: 'open',
                title: 'Открыть приложение'
            },
            {
                action: 'close',
                title: 'Закрыть'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'EcoGrow', options)
    );
});

// Клик по уведомлению
self.addEventListener('notificationclick', event => {
    console.log('[Service Worker] Клик по уведомлению');
    
    event.notification.close();
    
    if (event.action === 'open') {
        event.waitUntil(
            clients.openWindow('./')
        );
    } else {
        event.waitUntil(
            self.registration.getNotifications()
                .then(notifications => {
                    notifications.forEach(notification => {
                        notification.close();
                    });
                })
        );
    }
});

// Фоновая синхронизация данных
self.addEventListener('sync', event => {
    if (event.tag === 'sync-ecogrow-data') {
        console.log('[Service Worker] Фоновая синхронизация данных...');
        event.waitUntil(syncData());
    }
});

// Фоновая синхронизация
async function syncData() {
    try {
        const cache = await caches.open(CACHE_NAME);
        // Здесь можно добавить логику синхронизации данных
        console.log('[Service Worker] Данные синхронизированы');
    } catch (error) {
        console.error('[Service Worker] Ошибка синхронизации:', error);
    }
}

// Периодическая синхронизация (если поддерживается)
if ('periodicSync' in self.registration) {
    self.addEventListener('periodicsync', event => {
        if (event.tag === 'ecogrow-periodic-sync') {
            console.log('[Service Worker] Периодическая синхронизация...');
            event.waitUntil(periodicSync());
        }
    });
}

async function periodicSync() {
    // Обновление кэша каждые 24 часа
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    
    for (const request of requests) {
        try {
            const networkResponse = await fetch(request);
            if (networkResponse.ok) {
                cache.put(request, networkResponse);
            }
        } catch (error) {
            console.log('[Service Worker] Не удалось обновить:', request.url);
        }
    }
}

// Сообщения от клиента
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
