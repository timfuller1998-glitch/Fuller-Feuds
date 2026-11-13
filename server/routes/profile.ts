import { Router } from 'express';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db.js';
import { users, userFollows, userProfiles } from '../../shared/schema.js';
import { isAuthenticated } from '../middleware/auth.js';
import { invalidatePattern } from '../services/cacheService.js';
import { UserRepository } from '../repositories/userRepository.js';
import { OpinionRepository } from '../repositories/opinionRepository.js';
import { sanitizeUserData } from '../utils/authorization.js';
import { isSecurityError } from '../utils/securityErrors.js';

const router = Router();
const userRepository = new UserRepository();
const opinionRepository = new OpinionRepository();

function mapOpinionForProfileRow(op: any) {
  const { author, ...rest } = op;
  return {
    ...rest,
    user: author,
    topic:
      rest.topicEconomicScore != null || rest.topicAuthoritarianScore != null
        ? {
            economicScore: rest.topicEconomicScore,
            authoritarianScore: rest.topicAuthoritarianScore,
          }
        : undefined,
  };
}

async function listFollowUsers(
  targetUserId: string,
  mode: 'followers' | 'following',
  requestingUserId?: string,
  requestingUserRole?: string
) {
  const rows =
    mode === 'followers'
      ? await db
          .select({ u: users, p: userProfiles })
          .from(userFollows)
          .innerJoin(users, eq(userFollows.followerId, users.id))
          .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
          .where(eq(userFollows.followingId, targetUserId))
      : await db
          .select({ u: users, p: userProfiles })
          .from(userFollows)
          .innerJoin(users, eq(userFollows.followingId, users.id))
          .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
          .where(eq(userFollows.followerId, targetUserId));

  const ids = rows.map((row) => row.u.id).filter(Boolean);
  const followingSet = new Set<string>();
  if (requestingUserId && ids.length > 0) {
    const rels = await db
      .select({ id: userFollows.followingId })
      .from(userFollows)
      .where(and(eq(userFollows.followerId, requestingUserId), inArray(userFollows.followingId, ids)));
    for (const rel of rels) followingSet.add(rel.id);
  }

  return rows.map((row) => {
    const sanitized = sanitizeUserData(row.u, requestingUserId, requestingUserRole) as Record<string, unknown>;
    const displayFirst = row.p?.displayFirstName?.trim();
    return {
      id: sanitized.id,
      firstName: displayFirst || sanitized.firstName,
      lastName: displayFirst ? (row.p?.displayLastName || '') : sanitized.lastName,
      handle: sanitized.handle ?? row.u.handle ?? null,
      profileImageUrl: sanitized.profileImageUrl,
      isFollowedByMe: requestingUserId ? followingSet.has(row.u.id) : false,
    };
  });
}

// GET /api/profile/:userId/opinions
router.get('/:userId/opinions', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 20;
    const requestingUserId = (req.user as Express.User | undefined)?.id;
    const requestingUserRole = req.userRole;

    const enriched = await opinionRepository.findEnrichedByUserId(userId, safeLimit, {
      userRole: requestingUserRole,
      currentUserId: requestingUserId,
    });

    res.json(enriched.map(mapOpinionForProfileRow));
  } catch (error) {
    if (isSecurityError(error)) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error('Error fetching profile opinions:', error);
    res.status(500).json({ message: 'Failed to fetch opinions' });
  }
});

// GET /api/profile/:userId/followers
router.get('/:userId/followers', async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = (req.user as Express.User | undefined)?.id;
    const requestingUserRole = req.userRole;

    const list = await listFollowUsers(userId, 'followers', requestingUserId, requestingUserRole);
    res.json(list);
  } catch (error) {
    if (isSecurityError(error)) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error('Error fetching followers:', error);
    res.status(500).json({ message: 'Failed to fetch followers' });
  }
});

// GET /api/profile/:userId/following
router.get('/:userId/following', async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = (req.user as Express.User | undefined)?.id;
    const requestingUserRole = req.userRole;

    const list = await listFollowUsers(userId, 'following', requestingUserId, requestingUserRole);
    res.json(list);
  } catch (error) {
    if (isSecurityError(error)) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error('Error fetching following:', error);
    res.status(500).json({ message: 'Failed to fetch following' });
  }
});

// GET /api/profile/:userId — aggregate payload for Profile.tsx
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = (req.user as Express.User | undefined)?.id;
    const requestingUserRole = req.userRole;
    const isAdmin = requestingUserRole === 'admin';

    const user = await userRepository.findById(
      userId,
      requestingUserId,
      requestingUserRole,
      req
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const profile = await userRepository.getProfile(
      userId,
      requestingUserId,
      requestingUserRole,
      req
    );

    // Never send credential fields to the client (the row includes passwordHash).
    const { passwordHash: _ph, ...safeUser } = user as any;
    let responseUser: any = safeUser;
    if (!isAdmin) {
      const { isSynthetic, ...rest } = safeUser;
      responseUser = rest;
    }

    const followerCount = profile?.followerCount ?? 0;
    const followingCount = profile?.followingCount ?? 0;

    res.json({
      user: responseUser,
      profile: profile ?? undefined,
      followerCount,
      followingCount,
    });
  } catch (error) {
    if (isSecurityError(error)) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error('Error fetching profile:', error);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

// PATCH /api/profile/:userId: save your own screen name, bio and sort preferences (Settings page).
// Before this route existed the Settings form fell through to the SPA, so screen names were never saved.
router.patch('/:userId', isAuthenticated, async (req, res) => {
  try {
    const me = req.user as Express.User;
    if (!me?.id || me.id !== req.params.userId) return res.status(403).json({ message: 'You can only edit your own profile' });
    const b = req.body ?? {};
    const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    const df = str(b.displayFirstName, 50);
    if (df !== undefined) {
      if (!df) return res.status(400).json({ message: 'First name is required' });
      patch.displayFirstName = df;
      patch.displayLastName = str(b.displayLastName, 50) ?? '';
    }
    const bio = str(b.bio, 500);
    if (bio !== undefined) patch.bio = bio;
    if (['newest', 'oldest', 'most_liked', 'most_controversial'].includes(b.opinionSortPreference)) patch.opinionSortPreference = b.opinionSortPreference;
    if (['popular', 'alphabetical', 'newest', 'oldest'].includes(b.categorySortPreference)) patch.categorySortPreference = b.categorySortPreference;
    const [row] = await db
      .insert(userProfiles)
      .values({ userId: me.id, ...patch } as any)
      .onConflictDoUpdate({ target: userProfiles.userId, set: patch as any })
      .returning();
    // Cached opinion/topic lists embed author names; drop them so the new screen name shows right away.
    await invalidatePattern('topic*');
    await invalidatePattern('opinion*');
    res.json({ profile: row });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

export default router;
