import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';

export type PushState =
  | 'checking'
  | 'unsupported'      // this browser can't do Web Push
  | 'ios-install'      // iPhone/iPad Safari tab: push only works from the Home Screen app
  | 'off'              // supported, not subscribed (permission not asked yet, or granted but no subscription)
  | 'on'               // this device is subscribed
  | 'blocked'          // the user denied permission; only browser settings can undo it
  | 'unavailable';     // server has no VAPID key

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const raw = atob((base64String + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Phone notifications for this device. `enable` must be called from a tap (browsers require it). */
export function usePushNotifications() {
  const [state, setState] = useState<PushState>('checking');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      if (!supported) return setState(isIOS() && !isStandalone() ? 'ios-install' : 'unsupported');
      if (Notification.permission === 'denied') return setState('blocked');
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub && Notification.permission === 'granted' ? 'on' : 'off');
    } catch {
      setState('off');
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const enable = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      // Ask first, straight from the tap, before any awaits that could lose the user gesture on Safari.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setState(permission === 'denied' ? 'blocked' : 'off'); return; }
      const cfg = await (await fetch('/api/push/config', { credentials: 'include' })).json();
      if (!cfg?.publicKey) { setState('unavailable'); return; }
      const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register('/service-worker.js'));
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(cfg.publicKey) });
      await apiRequest('POST', '/api/push/subscribe', sub.toJSON());
      setState('on');
    } catch (e: any) {
      setError(e?.message || 'Could not turn on notifications');
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const disable = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await apiRequest('POST', '/api/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
      setState('off');
    } finally {
      setBusy(false);
    }
  }, []);

  const sendTest = useCallback(async () => {
    setError(null);
    try {
      const r = await apiRequest('POST', '/api/push/test', {});
      const { sent } = await r.json();
      if (!sent) setError('No device accepted it. Try turning notifications off and on again.');
    } catch (e: any) {
      setError(String(e?.message || 'Test failed').replace(/^\d+:\s*/, ''));
    }
  }, []);

  return { state, busy, error, enable, disable, sendTest };
}
