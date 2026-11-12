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

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const { title, body, icon, badge, tag, data } = payload;
    const options = {
      body: body || '',
      icon: icon || '/icon-192.png',
      badge: badge || '/badge-72.png',
      tag: tag || 'default',
      data: data || {},
      vibrate: [200, 100, 200],
      requireInteraction: false,
      actions: [
        { action: 'view', title: 'View' },
        { action: 'close', title: 'Close' },
      ],
    };
    event.waitUntil(self.registration.showNotification(title || 'Fuller Feuds', options));
  } catch (error) {
    console.error('[Service Worker] Error parsing push data:', error);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  if (event.action === 'close') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
