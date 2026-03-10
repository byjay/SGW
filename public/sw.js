const CACHE_NAME = 'sgw-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/index.css',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => response || fetch(event.request))
    );
});

self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : { title: 'SGW 알림', body: '새로운 알림이 있습니다.' };
    const options = {
        body: data.body,
        icon: '/sgws_logo_custom.png',
        badge: '/sgws_logo_custom.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
