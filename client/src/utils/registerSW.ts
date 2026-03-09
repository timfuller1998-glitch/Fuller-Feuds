// Service Worker registration and update management for Fuller Feuds PWA

export interface SWRegistrationCallbacks {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
}

export function registerServiceWorker(callbacks: SWRegistrationCallbacks = {}) {
  if ('serviceWorker' in navigator) {
    // Register immediately, don't wait for load event
    (async () => {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/'
        });

        console.log('[SW] Service Worker registered:', registration);

        // Check for updates immediately on registration
        registration.update();

        // Check for updates every 15 minutes (reduced from 1 hour)
        const updateInterval = setInterval(() => {
          registration.update();
        }, 15 * 60 * 1000);

        // Check for updates when app becomes visible (user returns to app)
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden && registration) {
            console.log('[SW] App became visible, checking for updates');
            registration.update();
          }
        });

        // Handle updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available
              console.log('[SW] New version available');
              callbacks.onUpdate?.(registration);
            }
          });
        });

        // Store interval ID for potential cleanup (though we keep it running)
        (registration as any)._updateInterval = updateInterval;

        callbacks.onSuccess?.(registration);
      } catch (error) {
        console.error('[SW] Registration failed:', error);
        callbacks.onError?.(error as Error);
      }
    })();
  }
}

export function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then(registration => {
        registration.unregister();
      })
      .catch(error => {
        console.error('Error unregistering service worker:', error);
      });
  }
}

// Detect if app is running as PWA
export function isPWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true ||
         document.referrer.includes('android-app://');
}

// Install prompt handling
let deferredPrompt: any = null;

export function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Dispatch custom event for React to listen to
    window.dispatchEvent(new Event('pwa-installable'));
  });
}

export function showInstallPrompt(): Promise<boolean> {
  if (!deferredPrompt) {
    return Promise.resolve(false);
  }

  deferredPrompt.prompt();
  return deferredPrompt.userChoice.then((choiceResult: any) => {
    const accepted = choiceResult.outcome === 'accepted';
    deferredPrompt = null;
    return accepted;
  });
}

export function isInstallable(): boolean {
  return deferredPrompt !== null;
}
