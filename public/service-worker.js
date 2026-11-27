// Service Worker for Fuller Feuds PWA
// Push notifications, hashed-asset caching, and prompt app updates.
// HTML and the app shell are always fetched from the network so a new
// deploy is not hidden behind a stale Cache Storage entry.

const CACHE_NAME = '{{CACHE_VERSION}}';
const RUNTIME_CACHE = '{{RUNTIME_CACHE_VERSION}}';

self.addEventListener('install', (event) => {
  // Activate this worker immediately so a new deploy is not stuck waiting.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        })
      );
    }).then(() => clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The browser already manages updates of this file; do not intercept it.
  if (url.pathname === '/service-worker.js') return;

  const accept = request.headers.get('accept') || '';
  const isNavigate = request.mode === 'navigate' || accept.includes('text/html');
  const isShell =
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/version.json' ||
    url.pathname.endsWith('.html');

  // App shell: network first, never prefer a cached index.html.
  if (isNavigate || isShell) {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => caches.match(request).then((cached) => cached || new Response('Offline', { status: 503 })))
    );
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) => {
        return fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => {
            return cache.match(request).then((cached) => {
              if (cached) return cached;
              return new Response(
                JSON.stringify({ error: 'Offline', offline: true }),
                { status: 503, headers: { 'Content-Type': 'application/json' } }
              );
            });
          });
      })
    );
    return;
  }

  // Fingerprinted build assets are safe to cache long-term.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          });
        });
      })
    );
    return;
  }

  // Icons and other unhashed public files: network first, cache a copy for offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Web Push (Nov 27 2026). Always show something: iOS revokes push for a site that receives one silently.
// Payload: { title, body, url, tag }. Same tag = a merged burst replacing its earlier notification quietly.
self.addEventListener('push', (event) => {
  let p = {};
  try { p = event.data ? event.data.json() : {}; } catch (e) { p = { body: event.data ? event.data.text() : '' }; }
  const url = typeof p.url === 'string' && p.url.startsWith('/') ? p.url : '/';
  event.waitUntil(self.registration.showNotification(p.title || 'Fuller Feuds', {
    body: p.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: p.tag || url,
    renotify: false,
    data: { url },
  }));
});

// Open the notification's page: reuse an open Fuller Feuds window (navigate + focus), otherwise open one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      if (new URL(c.url).origin !== self.location.origin) continue;
      try {
        if (c.url !== target && 'navigate' in c) await c.navigate(target);
        return c.focus();
      } catch (e) { /* fall through to openWindow */ }
    }
    if (clients.openWindow) return clients.openWindow(target);
  })());
});
