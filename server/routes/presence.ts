import { Router } from 'express';
import { db } from '../db.js';
import { userDebateStats } from '../../shared/schema.js';
import { inArray } from 'drizzle-orm';
import { getPresenceForUserIds } from '../websocket.js';

const router = Router();

// GET /api/presence/online-users?userIds=a,b,c
router.get('/online-users', async (req, res) => {
  try {
    const userIdsParam = req.query.userIds;
    const userIds =
      typeof userIdsParam === 'string'
        ? userIdsParam.split(',').map(s => s.trim()).filter(Boolean)
        : [];

    if (userIds.length === 0) {
      return res.json([]);
    }

    const presence = getPresenceForUserIds(userIds);

    const statsRows = await db
      .select({
        userId: userDebateStats.userId,
        avgLogicalReasoning: userDebateStats.avgLogicalReasoning,
        avgPoliteness: userDebateStats.avgPoliteness,
        avgOpennessToChange: userDebateStats.avgOpennessToChange,
        totalVotesReceived: userDebateStats.totalVotesReceived,
        totalDebates: userDebateStats.totalDebates,
      })
      .from(userDebateStats)
      .where(inArray(userDebateStats.userId, userIds));

    const rankByUserId = new Map<string, number>();
    for (const r of statsRows) {
      const avg =
        ((r.avgLogicalReasoning || 0) + (r.avgPoliteness || 0) + (r.avgOpennessToChange || 0)) / 3; // *100
      const experience = Math.min(200, (r.totalVotesReceived || 0) + (r.totalDebates || 0) * 2);
      rankByUserId.set(r.userId, Math.round(avg + experience));
    }

    res.json(
      presence.map(p => ({
        ...p,
        debaterRank: rankByUserId.get(p.userId) || 0,
      }))
    );
  } catch (error: any) {
    console.error('Error getting presence:', error);
    res.status(500).json({ message: 'Failed to get presence' });
  }
});

export default router;

