// Seastar Groupware Service Worker — network-first (항상 최신 배포 반영)
const CACHE_NAME = 'sgw-cache-v2';

self.addEventListener('install', (event) => {
  // 새 SW 즉시 대기 해제 → 다음 로드부터 최신 적용
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 구버전 캐시 전부 삭제 (cache-first 구버전 잔존물 제거)
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // ★ network-first: 항상 네트워크 우선 → 새 배포 즉시 반영. 오프라인이면 캐시 폴백.
  event.respondWith((async () => {
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok && req.url.startsWith(self.location.origin)) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone()).catch(() => {});
      }
      return fresh;
    } catch (err) {
      const cached = await caches.match(req);
      if (cached) return cached;
      throw err;
    }
  })());
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'SGW 알림', body: '새로운 알림이 있습니다.' };
  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
