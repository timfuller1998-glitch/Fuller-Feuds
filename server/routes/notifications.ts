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

// GET /api/notifications/debates - NEW: every debate the user is in, for the footer tray.
// state: your_turn | waiting | rate | rated | completed. unread = unread notifications for that room.
router.get('/debates', isAuthenticated, async (req, res) => {
  try {
    const me = req.user!.id;
    const r: any = await db.execute(sql`
      SELECT d.id, d.status, d.phase, d.current_turn, d.turn_count1, d.turn_count2,
             d.participant1_id, d.participant2_id,
             (coalesce(d.last_message_at, d.started_at) AT TIME ZONE 'UTC') AS activity_at,
             t.title AS topic_title,
             o.id AS opponent_id, o.handle AS opponent_handle,
             coalesce(nullif(trim(op.display_first_name), ''), o.first_name, o.handle, 'Someone') AS opponent_name,
             (SELECT count(*)::int FROM notifications n WHERE n.user_id = ${me} AND n.debate_room_id = d.id AND n.is_read = false) AS unread,
             (SELECT count(*)::int FROM notifications n WHERE n.user_id = ${me} AND n.debate_room_id = d.id AND n.is_read = false AND n.type = 'new_debate') AS unread_invite,
             EXISTS (SELECT 1 FROM debate_votes v WHERE v.room_id = d.id AND v.voter_id = ${me}) AS i_voted,
             (SELECT count(*)::int FROM debate_votes v WHERE v.room_id = d.id) AS vote_count
      FROM debate_rooms d
      JOIN topics t ON t.id = d.topic_id
      JOIN users o ON o.id = CASE WHEN d.participant1_id = ${me} THEN d.participant2_id ELSE d.participant1_id END
      LEFT JOIN user_profiles op ON op.user_id = o.id
      WHERE (d.participant1_id = ${me} OR d.participant2_id = ${me}) AND coalesce(d.status, 'active') <> 'archived'
      ORDER BY unread DESC, activity_at DESC NULLS LAST
      LIMIT 100`);
    const rows = (r.rows ?? r) as any[];
    const items = rows.map((d) => {
      const voting = d.phase === 'voting' || d.status === 'ended';
      const state = voting
        ? (d.vote_count >= 2 ? 'completed' : d.i_voted ? 'rated' : 'rate')
        : d.current_turn === me ? 'your_turn' : 'waiting';
      const isP1 = d.participant1_id === me;
      return {
        id: d.id, topicTitle: d.topic_title, opponentId: d.opponent_id, opponentName: d.opponent_name,
        opponentHandle: d.opponent_handle, state, isNew: d.unread_invite > 0, unread: d.unread,
        myTurns: isP1 ? d.turn_count1 : d.turn_count2, activityAt: d.activity_at,
      };
    });
    res.json({ items, unreadCount: items.reduce((n, i) => n + i.unread, 0) });
  } catch (e) {
    console.error('Error fetching footer debates:', e);
    res.status(500).json({ message: 'Failed to fetch debates' });
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
