// Service Worker для EcoGrow PWA
const CACHE_NAME = 'ecogrow-v4.6';
const APP_VERSION = '4.6';
const OFFLINE_URL = './';
const isGitHubPages = self.location.hostname === 'zhesny.github.io';

// Файлы для кэширования при установке
const PRECACHE_URLS = [
    './',
    './index.html',
    './manifest.json',
    './api-client.js',
    './app.js',
    './charts.js',
    './config.js',
    './notifications.js',
    './theme.js',
    './icon-192.png',
    './icon-512.png'
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

// Стратегия кэширования: Network First, Cache Fallback
self.addEventListener('fetch', event => {
    const request = event.request;
    
    // Блокируем запросы к локальным IP на GitHub Pages
    if (isGitHubPages && 
        (request.url.includes('192.168.') || 
         request.url.includes('.local') ||
         request.url.match(/https?:\/\/(\d{1,3}\.){3}\d{1,3}/))) {
        
        console.log('[ServiceWorker] GitHub Pages: блокировка локального запроса:', request.url);
        
        // Возвращаем информационный ответ для API запросов
        if (request.url.includes('/api/')) {
            event.respondWith(
                new Response(JSON.stringify({
                    error: 'GitHub Pages Restriction',
                    message: 'GitHub Pages (HTTPS) не может подключиться к локальному устройству (HTTP).',
                    solution: 'Скачайте файлы и запустите интерфейс локально.',
                    downloadLink: 'https://github.com/zhesny/ecogrow-webapp/archive/refs/heads/main.zip',
                    demoMode: 'Используйте демо-режим для тестирования интерфейса.'
                }), {
                    headers: { 
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    status: 403,
                    statusText: 'GitHub Pages Restriction'
                })
            );
            return;
        }
    }
    
    // Пропускаем запросы к ESP8266 API для локального запуска
    if (request.url.includes('/api/') || 
        request.url.includes('192.168.') || 
        request.url.includes('ecogrow.local')) {
        return;
    }
    
    // Для HTML-страниц: Network First
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => cache.put(request, responseClone));
                    return response;
                })
                .catch(() => {
                    return caches.match(OFFLINE_URL);
                })
        );
        return;
    }
    
    // Для статических ресурсов: Cache First, Network Fallback
    event.respondWith(
        caches.match(request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                return fetch(request)
                    .then(response => {
                        if (!response || response.status !== 200) {
                            return response;
                        }
                        
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(request, responseToCache);
                            });
                        
                        return response;
                    })
                    .catch(() => {
                        if (request.destination === 'image') {
                            return new Response(
                                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🌱</text></svg>',
                                { headers: { 'Content-Type': 'image/svg+xml' } }
                            );
                        }
                        
                        return new Response('Офлайн', {
                            status: 503,
                            statusText: 'Нет подключения к сети'
                        });
                    });
            })
    );
});

// Обработка push-уведомлений
self.addEventListener('push', event => {
    if (!event.data) return;
    
    const data = event.data.json();
    
    const options = {
        body: data.body || 'Новое уведомление от EcoGrow',
        icon: './icon-192.png',
        badge: './icon-192.png',
        vibrate: [200, 100, 200],
        data: {
            url: data.url || './'
        },
        actions: [
            {
                action: 'open',
                title: 'Открыть'
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
            clients.openWindow(event.notification.data.url)
        );
    }
});

// Сообщения от клиента
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    // Обработка сообщений о GitHub Pages
    if (event.data && event.data.type === 'GITHUB_PAGES_WARNING') {
        console.log('[ServiceWorker] Получено предупреждение о GitHub Pages');
    }
});
