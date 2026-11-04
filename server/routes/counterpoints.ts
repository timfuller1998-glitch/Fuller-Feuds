import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import { CounterpointService } from '../services/counterpointService.js';
import { DebateService } from '../services/debateService.js';
import { notifyNewDebateCreated } from '../websocket.js';
import { CounterpointRepository } from '../repositories/counterpointRepository.js';
import { getPresenceForUserIds } from '../websocket.js';
import { db } from '../db.js';
import { sql } from 'drizzle-orm';

const router = Router();
const counterpointService = new CounterpointService();
const debateService = new DebateService();
const counterpointRepo = new CounterpointRepository();

// POST /api/counterpoints/:id/like - Like/unlike a counterpoint
router.post('/:id/like', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const like = !!req.body?.like;
    await counterpointService.setCounterpointLike({ counterpointId: req.params.id, userId, like });
    res.json({ ok: true });
  } catch (error: any) {
    console.error('Error liking counterpoint:', error);
    res.status(500).json({ message: 'Failed to update counterpoint like' });
  }
});

// GET /api/counterpoints/:id/likers - List userIds who liked this counterpoint (for presence lookup)
router.get('/:id/likers', async (req, res) => {
  try {
    const likerIds = await counterpointService.listLikerIds(req.params.id);
    res.json({ likerIds });
  } catch (error: any) {
    console.error('Error listing counterpoint likers:', error);
    res.status(500).json({ message: 'Failed to list likers' });
  }
});

// GET /api/counterpoints/:id/debate-candidates
// Who the opinion author can debate over this counterpoint: the counterpoint's author first,
// then users who liked it. Includes names/avatars, online status, and "Most Active" leaderboard
// rank (same definition as /api/leaderboards). The requesting user is excluded.
router.get('/:id/debate-candidates', isAuthenticated, async (req, res) => {
  try {
    const me = req.user!.id;
    const counterpoint = await counterpointService.getCounterpoint(req.params.id);
    if (!counterpoint) return res.status(404).json({ message: 'Counterpoint not found' });
    const likerIds = await counterpointService.listLikerIds(req.params.id);
    const ordered = [counterpoint.authorUserId, ...likerIds].filter((id, i, a) => id && id !== me && a.indexOf(id) === i);
    if (ordered.length === 0) return res.json([]);

    const result: any = await db.execute(sql`
      WITH act AS (
        SELECT user_id, COUNT(*)::int AS value FROM (
          SELECT user_id FROM opinions
          UNION ALL SELECT author_user_id FROM opinion_sentence_counterpoints
          UNION ALL SELECT user_id FROM debate_messages
        ) a GROUP BY user_id
      ),
      ranked AS (
        SELECT act.user_id, act.value, RANK() OVER (ORDER BY act.value DESC) AS rank
        FROM act JOIN users u ON u.id = act.user_id
        WHERE act.value > 0 AND COALESCE(u.status, 'active') = 'active'
      )
      SELECT u.id, coalesce((select nullif(trim(sn.display_first_name), '') from user_profiles sn where sn.user_id = u.id limit 1), u.first_name) AS first_name, (case when exists (select 1 from user_profiles sn where sn.user_id = u.id and nullif(trim(sn.display_first_name), '') is not null) then (select sn.display_last_name from user_profiles sn where sn.user_id = u.id limit 1) else u.last_name end) AS last_name, u.profile_image_url, r.rank, r.value
      FROM users u LEFT JOIN ranked r ON r.user_id = u.id
      WHERE u.id IN (${sql.join(ordered.map((id) => sql`${id}`), sql`, `)})
        AND COALESCE(u.status, 'active') = 'active'`);
    const rows = new Map(((result.rows ?? result) as any[]).map((r) => [r.id, r]));
    const presence = new Map(getPresenceForUserIds(ordered).map((p: any) => [p.userId, p]));

    res.json(
      ordered
        .filter((id) => rows.has(id))
        .map((id) => {
          const r: any = rows.get(id);
          return {
            userId: id,
            firstName: r.first_name,
            lastName: r.last_name,
            profileImageUrl: r.profile_image_url,
            relation: id === counterpoint.authorUserId ? 'author' : 'liker',
            isOnline: !!presence.get(id)?.isOnline,
            activeRank: r.rank != null ? Number(r.rank) : null,
            activeCount: r.value != null ? Number(r.value) : 0,
          };
        })
    );
  } catch (error: any) {
    console.error('Error listing debate candidates:', error);
    res.status(500).json({ message: 'Failed to list debate candidates' });
  }
});

// POST /api/counterpoints/:id/start-debate - Start debate for an opinion sentence counterpoint
router.post('/:id/start-debate', isAuthenticated, async (req, res) => {
  try {
    const requestingUserId = req.user!.id;
    const { opponentUserId } = req.body || {};
    if (!opponentUserId || typeof opponentUserId !== 'string') {
      return res.status(400).json({ message: 'opponentUserId is required' });
    }

    const counterpoint = await counterpointService.getCounterpoint(req.params.id);
    if (!counterpoint) {
      return res.status(404).json({ message: 'Counterpoint not found' });
    }

    const opinion = await counterpointRepo.getOpinionById(counterpoint.opinionId);
    if (!opinion) {
      return res.status(404).json({ message: 'Opinion not found' });
    }

    // Only the opinion author can initiate debates from counterpoints on their opinion
    if (opinion.userId !== requestingUserId) {
      return res.status(403).json({ message: 'Only the opinion author can start this debate' });
    }

    const room = await debateService.createDebateRoomBetweenUsersForTopic({
      topicId: opinion.topicId,
      participant1Id: requestingUserId,
      participant2Id: opponentUserId,
    });

    // Seed an opening message so context is immediate
    const opening = `Counterpoint to paragraph ${counterpoint.sentenceIndex + 1}:\n\n${counterpoint.content}`;
    try {
      await debateService.sendMessage(room.id, requestingUserId, opening, requestingUserId, req.userRole, req);
    } catch (e) {
      // Non-fatal: debate room exists even if seeding fails
    }

    // Notify opponent in realtime (if connected)
    notifyNewDebateCreated(room.id, 'New debate', opponentUserId);

    res.json(room);
  } catch (error: any) {
    console.error('Error starting debate from counterpoint:', error);
    res.status(500).json({ message: error.message || 'Failed to start debate' });
  }
});

export default router;

