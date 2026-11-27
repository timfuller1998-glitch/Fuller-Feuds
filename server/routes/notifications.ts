import { Router } from 'express';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db.js';
import { notifications, users } from '../../shared/schema.js';
import { NOTIFICATION_PREFS } from '../../shared/notificationRules.js';
import { isAuthenticated } from '../middleware/auth.js';
import { listUserDebates } from '../lib/userDebates.js';

const router = Router();

// GET /api/notifications - newest 30 plus unread count
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const items = await db.select().from(notifications).where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt)).limit(30);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    res.json({ items, unreadCount: Number(count) });
  } catch (e) {
    console.error('Error fetching notifications:', e);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/debates - NEW: every debate the user is in, for the footer Debates list.
router.get('/debates', isAuthenticated, async (req, res) => {
  try {
    const all = await listUserDebates(req.user!.id);
    // Needs-you and new first, then by activity
    const rank = (d: any) => (d.isNew ? 0 : d.state === 'invited' || d.state === 'your_turn' || d.state === 'rate' ? 1 : 2);
    const items = [...all].sort((x, y) => rank(x) - rank(y));
    // needsYou/hasNew drive the footer's single dot (no counts in the UI).
    res.json({ items, unreadCount: items.reduce((n, i) => n + i.unread, 0),
      hasNew: items.some((i) => i.isNew), needsYou: items.some((i) => !i.finished && (i.state === 'invited' || i.state === 'your_turn' || i.state === 'rate')) });
  } catch (e) {
    console.error('Error fetching footer debates:', e);
    res.status(500).json({ message: 'Failed to fetch debates' });
  }
});

// GET /api/notifications/prefs - per-type switches (missing = on)
router.get('/prefs', isAuthenticated, async (req, res) => {
  try {
    const [u] = await db.select({ prefs: users.notificationPrefs }).from(users).where(eq(users.id, req.user!.id)).limit(1);
    const prefs: Record<string, boolean> = {};
    for (const p of NOTIFICATION_PREFS) prefs[p.key] = (u?.prefs as any)?.[p.key] !== false;
    res.json(prefs);
  } catch (e) {
    console.error('Error reading notification prefs:', e);
    res.status(500).json({ message: 'Failed to load notification settings' });
  }
});

// PUT /api/notifications/prefs { topicOpinions?: boolean, ... } - only known keys, booleans only
router.put('/prefs', isAuthenticated, async (req, res) => {
  try {
    const [u] = await db.select({ prefs: users.notificationPrefs }).from(users).where(eq(users.id, req.user!.id)).limit(1);
    const next: Record<string, boolean> = { ...((u?.prefs as any) || {}) };
    for (const p of NOTIFICATION_PREFS) if (typeof req.body?.[p.key] === 'boolean') next[p.key] = req.body[p.key];
    await db.update(users).set({ notificationPrefs: next }).where(eq(users.id, req.user!.id));
    res.json(next);
  } catch (e) {
    console.error('Error saving notification prefs:', e);
    res.status(500).json({ message: 'Failed to save notification settings' });
  }
});

// POST /api/notifications/read-all
router.post('/read-all', isAuthenticated, async (req, res) => {
  await db.update(notifications).set({ isRead: true })
    .where(and(eq(notifications.userId, req.user!.id), eq(notifications.isRead, false)));
  res.json({ ok: true });
});

// POST /api/notifications/read-room/:roomId - viewing a debate clears its notifications
router.post('/read-room/:roomId', isAuthenticated, async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.roomId)) return res.status(400).json({ message: 'Bad id' });
  await db.update(notifications).set({ isRead: true })
    .where(and(eq(notifications.userId, req.user!.id), eq(notifications.debateRoomId, req.params.roomId), eq(notifications.isRead, false)));
  res.json({ ok: true });
});

// PATCH /api/notifications/:id/read - only the owner's own rows
router.patch('/:id/read', isAuthenticated, async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ message: 'Bad id' });
  await db.update(notifications).set({ isRead: true })
    .where(and(eq(notifications.id, req.params.id), eq(notifications.userId, req.user!.id)));
  res.json({ ok: true });
});

export default router;
