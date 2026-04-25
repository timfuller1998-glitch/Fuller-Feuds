import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db.js';
import { users, userFollows } from '../../shared/schema.js';
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
          .select({ u: users })
          .from(userFollows)
          .innerJoin(users, eq(userFollows.followerId, users.id))
          .where(eq(userFollows.followingId, targetUserId))
      : await db
          .select({ u: users })
          .from(userFollows)
          .innerJoin(users, eq(userFollows.followingId, users.id))
          .where(eq(userFollows.followerId, targetUserId));

  return rows.map((row) => {
    const sanitized = sanitizeUserData(row.u, requestingUserId, requestingUserRole) as Record<string, unknown>;
    return {
      id: sanitized.id,
      firstName: sanitized.firstName,
      lastName: sanitized.lastName,
      email: sanitized.email,
      profileImageUrl: sanitized.profileImageUrl,
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

    let responseUser: any = user;
    if (!isAdmin) {
      const { isSynthetic, ...rest } = user as any;
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

export default router;
