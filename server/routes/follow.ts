import { Router } from 'express';
import { db } from '../db.js';
import { userFollows, users, userProfiles } from '../../shared/schema.js';
import { and, eq, sql } from 'drizzle-orm';
import { isAuthenticated } from '../middleware/auth.js';
import { isSecurityError } from '../utils/securityErrors.js';

const router = Router();

async function ensureUserExists(targetUserId: string) {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, targetUserId)).limit(1);
  return !!row;
}

async function ensureProfileRow(userId: string) {
  await db
    .insert(userProfiles)
    .values({ userId })
    .onConflictDoNothing();
}

async function recomputeFollowCounts(userIdA: string, userIdB: string) {
  // Keep counts consistent by recomputing from the relationship table.
  // This is safer than increment/decrement, especially across retries.
  await ensureProfileRow(userIdA);
  await ensureProfileRow(userIdB);

  await db.execute(sql`
    UPDATE ${userProfiles}
    SET ${userProfiles.followingCount} = (
      SELECT COUNT(*)::int FROM ${userFollows}
      WHERE ${userFollows.followerId} = ${userIdA}
    )
    WHERE ${userProfiles.userId} = ${userIdA}
  `);

  await db.execute(sql`
    UPDATE ${userProfiles}
    SET ${userProfiles.followerCount} = (
      SELECT COUNT(*)::int FROM ${userFollows}
      WHERE ${userFollows.followingId} = ${userIdB}
    )
    WHERE ${userProfiles.userId} = ${userIdB}
  `);
}

// GET /api/follow/:targetUserId/status
router.get('/:targetUserId/status', async (req, res) => {
  try {
    const currentUserId = (req.user as Express.User | undefined)?.id;
    if (!currentUserId) {
      return res.json({ isFollowing: false });
    }

    const { targetUserId } = req.params;
    const [row] = await db
      .select({ id: userFollows.id })
      .from(userFollows)
      .where(and(eq(userFollows.followerId, currentUserId), eq(userFollows.followingId, targetUserId)))
      .limit(1);

    res.json({ isFollowing: !!row });
  } catch (error) {
    if (isSecurityError(error)) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error('Error fetching follow status:', error);
    res.status(500).json({ message: 'Failed to fetch follow status' });
  }
});

// POST /api/follow/:targetUserId
router.post('/:targetUserId', isAuthenticated, async (req, res) => {
  try {
    const currentUserId = (req.user as Express.User).id;
    const { targetUserId } = req.params;

    if (currentUserId === targetUserId) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }

    const exists = await ensureUserExists(targetUserId);
    if (!exists) {
      return res.status(404).json({ message: 'User not found' });
    }

    await db
      .insert(userFollows)
      .values({ followerId: currentUserId, followingId: targetUserId })
      .onConflictDoNothing();

    await recomputeFollowCounts(currentUserId, targetUserId);

    res.status(201).json({ ok: true });
  } catch (error) {
    if (isSecurityError(error)) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error('Error following user:', error);
    res.status(500).json({ message: 'Failed to follow user' });
  }
});

// DELETE /api/follow/:targetUserId
router.delete('/:targetUserId', isAuthenticated, async (req, res) => {
  try {
    const currentUserId = (req.user as Express.User).id;
    const { targetUserId } = req.params;

    await db
      .delete(userFollows)
      .where(and(eq(userFollows.followerId, currentUserId), eq(userFollows.followingId, targetUserId)));

    await recomputeFollowCounts(currentUserId, targetUserId);

    res.json({ ok: true });
  } catch (error) {
    if (isSecurityError(error)) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error('Error unfollowing user:', error);
    res.status(500).json({ message: 'Failed to unfollow user' });
  }
});

export default router;

