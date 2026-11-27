import webPush from 'web-push';
import { and, eq } from 'drizzle-orm';
import { db } from '../db.js';
import { pushSubscriptions } from '../../shared/schema.js';

// Web Push (Nov 27 2026): phone/desktop notifications while the app is closed. Keys live in Render env.
let configured: boolean | null = null;
export function pushConfigured() {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  try {
    webPush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:timothy@quickwebspro.com', pub, priv);
    configured = true;
  } catch (e) {
    console.error('[push] bad VAPID config:', (e as Error).message);
    configured = false;
  }
  return configured;
}

export interface PushPayload { title: string; body: string; url: string; tag?: string }

/** Where a notification row opens. */
export function urlFor(n: { linkUrl?: string | null; debateRoomId?: string | null }) {
  return n.linkUrl || (n.debateRoomId ? `/debate-room/${n.debateRoomId}` : '/');
}

/** Gone (404/410) or malformed subscriptions are deleted; anything else is just logged. */
export function shouldPrune(statusCode?: number) {
  return statusCode === 404 || statusCode === 410;
}

/** Send to every device the user subscribed. Never throws. Returns how many devices accepted it. */
export async function sendPush(userId: string, p: PushPayload): Promise<number> {
  if (!pushConfigured()) return 0;
  try {
    const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
    if (subs.length === 0) return 0;
    const body = JSON.stringify({ title: p.title, body: p.body, url: p.url, tag: p.tag || p.url });
    const results = await Promise.all(subs.map(async (s) => {
      try {
        await webPush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body,
          { TTL: 60 * 60 * 24, urgency: 'normal' });
        return 1;
      } catch (e: any) {
        if (shouldPrune(e?.statusCode)) {
          console.log(`[push] pruning a gone subscription (${e.statusCode})`);
          await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, s.endpoint))).catch(() => {});
        } else {
          console.error('[push] send failed:', e?.statusCode || '', (e?.body || e?.message || '').toString().slice(0, 200));
        }
        return 0;
      }
    }));
    return results.reduce<number>((a, b) => a + b, 0);
  } catch (e) {
    console.error('[push] failed:', (e as Error).message);
    return 0;
  }
}

/** Fire-and-forget push for a stored notification row (tag = its burst key, so a merged burst replaces itself). */
export function pushForNotification(userId: string, row: { title: string; message: string; groupKey?: string | null; linkUrl?: string | null; debateRoomId?: string | null; id?: string }) {
  void sendPush(userId, {
    title: row.title,
    body: row.message,
    url: urlFor(row),
    tag: row.groupKey || (row.debateRoomId ? `debate-${row.debateRoomId}` : row.id),
  });
}
