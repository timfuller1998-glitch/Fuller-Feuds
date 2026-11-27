import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../db.js';
import { pushSubscriptions } from '../../shared/schema.js';
import { isAuthenticated } from '../middleware/auth.js';
import { pushConfigured, sendPush } from '../lib/webPush.js';

const router = Router();

// GET /api/push/config - public VAPID key for subscribing (null when push isn't set up)
router.get('/config', (_req, res) => {
  res.json({ publicKey: pushConfigured() ? process.env.VAPID_PUBLIC_KEY : null });
});

function parseSub(body: any) {
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';
  const p256dh = typeof body?.keys?.p256dh === 'string' ? body.keys.p256dh : '';
  const auth = typeof body?.keys?.auth === 'string' ? body.keys.auth : '';
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !p256dh || p256dh.length > 200 || !auth || auth.length > 100) return null;
  return { endpoint, p256dh, auth };
}

// POST /api/push/subscribe { endpoint, keys: { p256dh, auth } } - this device now gets phone notifications
router.post('/subscribe', isAuthenticated, async (req, res) => {
  const sub = parseSub(req.body);
  if (!sub) return res.status(400).json({ message: 'Invalid subscription' });
  try {
    // A device belongs to whoever is signed in on it now.
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint));
    await db.insert(pushSubscriptions).values({ userId: req.user!.id, ...sub });
    res.json({ ok: true });
  } catch (e) {
    console.error('[push] subscribe failed:', (e as Error).message);
    res.status(500).json({ message: 'Could not turn on notifications' });
  }
});

// POST /api/push/unsubscribe { endpoint }
router.post('/unsubscribe', isAuthenticated, async (req, res) => {
  const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : '';
  if (endpoint) {
    await db.delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, req.user!.id), eq(pushSubscriptions.endpoint, endpoint))).catch(() => {});
  }
  res.json({ ok: true });
});

// POST /api/push/test - a test notification to all of my devices (rate-limited per user)
const lastTest = new Map<string, number>();
router.post('/test', isAuthenticated, async (req, res) => {
  const uid = req.user!.id;
  const now = Date.now();
  if (now - (lastTest.get(uid) ?? 0) < 10_000) return res.status(429).json({ message: 'Wait a few seconds and try again' });
  lastTest.set(uid, now);
  const sent = await sendPush(uid, { title: 'Fuller Feuds', body: 'Phone notifications are on. You\'ll hear when people answer you.', url: '/', tag: 'test' });
  res.json({ sent });
});

export default router;
