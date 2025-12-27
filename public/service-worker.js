// Service Worker for Fuller Feuds PWA
// Handles push notifications, offline caching, and app updates

const CACHE_NAME = '{{CACHE_VERSION}}';
const RUNTIME_CACHE = '{{RUNTIME_CACHE_VERSION}}';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Listen for SKIP_WAITING message from UpdateNotification
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[Service Worker] Received SKIP_WAITING message');
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete all caches that don't match current cache names
          // This ensures old versions are cleaned up
          if (!cacheName.startsWith('fuller-feuds-')) {
            return Promise.resolve();
          }
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        })
      );
    }).then(() => clients.claim())
  );
});

// Fetch handler - Network First for API, Cache First for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // API requests - Network First with fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(cache => {
        return fetch(request)
          .then(response => {
            // Cache successful responses
            if (response && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => {
            // Fallback to cache if network fails
            return cache.match(request).then(cached => {
              if (cached) {
                return cached;
              }
              // Return offline response for API calls
              return new Response(
                JSON.stringify({ error: 'Offline', offline: true }),
                { 
                  status: 503,
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            });
          });
      })
    );
    return;
  }

  // Static assets - Stale-While-Revalidate strategy
  // Serve cached version immediately, fetch fresh in background
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return caches.match(request).then(cached => {
        // Fetch fresh version in background
        const fetchPromise = fetch(request).then(response => {
          // Only cache successful responses
          if (response && response.status === 200) {
            cache.put(request, response.clone());
          }
          return response;
        }).catch(() => {
          // If fetch fails, we'll use cached version if available
          console.log('[Service Worker] Network fetch failed, using cache if available');
        });

        // Return cached version immediately if available, otherwise wait for fetch
        if (cached) {
          // Return cached version immediately, but still fetch in background
          fetchPromise.catch(() => {}); // Suppress errors from background fetch
          return cached;
        }
        // No cache available, wait for network fetch
        return fetchPromise;
      });
    })
  );
});

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received:', event);

  if (!event.data) {
    console.log('[Service Worker] Push event but no data');
    return;
  }

  try {
    const payload = event.data.json();
    console.log('[Service Worker] Push payload:', payload);

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
        {
          action: 'view',
          title: 'View',
        },
        {
          action: 'close',
          title: 'Close',
        },
      ],
    };

    event.waitUntil(
      self.registration.showNotification(title || 'Fuller Feuds', options)
    );
  } catch (error) {
    console.error('[Service Worker] Error parsing push data:', error);
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event);

  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  if (event.action === 'close') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }

      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[Service Worker] Notification closed:', event);
});
