// Service Worker registration and update management for Fuller Feuds PWA

export interface SWRegistrationCallbacks {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
}

export function registerServiceWorker(callbacks: SWRegistrationCallbacks = {}) {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/'
        });

        console.log('[SW] Service Worker registered:', registration);

        // Check for updates every hour
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);

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

        callbacks.onSuccess?.(registration);
      } catch (error) {
        console.error('[SW] Registration failed:', error);
        callbacks.onError?.(error as Error);
      }
    });
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
