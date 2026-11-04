import { Router } from 'express';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db.js';
import { notifications } from '../../shared/schema.js';
import { isAuthenticated } from '../middleware/auth.js';

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
