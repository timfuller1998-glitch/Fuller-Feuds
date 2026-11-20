import { Router } from 'express';
import { UserRepository } from '../repositories/userRepository.js';
import { BadgeRepository } from '../repositories/badgeRepository.js';
import { AnalyticsService } from '../services/analyticsService.js';
import { InteractionRepository } from '../repositories/interactionRepository.js';
import { TopicService } from '../services/topicService.js';
import { isAuthenticated, requireAdmin } from '../middleware/auth.js';
import type { UpsertUser } from '../../shared/schema.js';
import { getCache, setCache, cacheKey, CACHE_TTL } from '../services/cacheService.js';
import { invalidateUserCache, invalidateUserBadgesCache, invalidateUserDebateStatsCache } from '../services/cacheInvalidation.js';
import { isSecurityError } from '../utils/securityErrors.js';
import { sql } from 'drizzle-orm';
import { db } from '../db.js';
import { canUseAdFree } from '../../shared/supporter.js';
import { getSiteConfig } from '../lib/siteSettings.js';

const router = Router();
const badgeRepository = new BadgeRepository();
const userRepository = new UserRepository();
const analyticsService = new AnalyticsService();
const interactionRepository = new InteractionRepository();
const topicService = new TopicService();

// GET /api/users/me - Get current user profile
router.get('/me', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as Express.User;
    if (!user || !user.id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const requestingUserId = user.id;
    const requestingUserRole = req.userRole;
    const key = cacheKey('user', requestingUserId, 'profile');
    
    // Try cache first
    let userData = await getCache(key);
    if (!userData) {
      userData = await userRepository.findById(
        requestingUserId,
        requestingUserId,
        requestingUserRole,
        req
      );
      
      // If user doesn't exist in database (shouldn't happen with local auth, but handle gracefully)
      if (!userData) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Cache for 2 minutes
      await setCache(key, userData, CACHE_TTL.MEDIUM);
    }

    // Hide isSynthetic from non-admins
    const isAdmin = requestingUserRole === 'admin';
    let responseUser: any = userData;
    if (!isAdmin) {
      const { isSynthetic, ...rest } = userData as any;
      responseUser = rest;
    }

    res.json(responseUser);
  } catch (error) {
    if (isSecurityError(error)) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error("Error fetching current user:", error);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

// PATCH /api/users/me - Update current user
router.patch('/me', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as Express.User;
    if (!user || !user.id) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    const userId = user.id;
    const { followedCategories } = req.body;

    if (followedCategories !== undefined && !Array.isArray(followedCategories)) {
      return res.status(400).json({ message: "followedCategories must be an array" });
    }

    if (followedCategories) {
      await userRepository.updateProfile(
        userId,
        { followedCategories },
        userId,
        req.userRole,
        req
      );
    }

    // Invalidate user cache after update
    await invalidateUserCache(userId);

    const userData = await userRepository.findById(userId);
    res.json(userData);
  } catch (error) {
    if (isSecurityError(error)) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    console.error("Error updating current user:", error);
    res.status(500).json({ message: "Failed to update user" });
  }
});

// PUT /api/users/me/tutorial { completed: boolean } - mark the first-run tutorial done (true) or reset it to replay (false)
router.put('/me/tutorial', isAuthenticated, async (req, res) => {
  try {
    const me = req.user as Express.User;
    const completed = req.body?.completed !== false;
    await db.execute(sql`update users set tutorial_completed_at = ${completed ? sql`now()` : sql`null`} where id = ${me.id}`);
    await invalidateUserCache(String(me.id));
    res.json({ tutorialCompleted: completed });
  } catch (error) {
    console.error('Error saving tutorial state:', error);
    res.status(500).json({ message: 'Failed to save tutorial state' });
  }
});

// PUT /api/users/me/ad-free { adFree: boolean } - admins now, supporters once subscriptions exist
router.put('/me/ad-free', isAuthenticated, async (req, res) => {
  try {
    const me = req.user as Express.User;
    const adFree = req.body?.adFree;
    if (typeof adFree !== 'boolean') {
      return res.status(400).json({ message: 'adFree must be true or false' });
    }
    const rows: any = await db.execute(sql`
      select role, subscription_tier, subscription_expires_at, founder_lifetime_ad_free from users where id = ${me.id}
    `);
    const u = (rows.rows ?? rows)[0];
    if (!u) return res.status(404).json({ message: 'User not found' });
    const allowed = canUseAdFree({
      role: u.role,
      subscriptionTier: u.subscription_tier,
      subscriptionExpiresAt: u.subscription_expires_at,
      founderLifetimeAdFree: u.founder_lifetime_ad_free,
    }, (await getSiteConfig()).publicLaunch);
    if (!allowed) {
      return res.status(403).json({ message: 'Ad-free comes with the supporter subscription' });
    }
    await db.execute(sql`update users set ad_free = ${adFree}, updated_at = now() where id = ${me.id}`);
    await invalidateUserCache(String(me.id));
    res.json({ adFree });
  } catch (error) {
    console.error('Error saving ad-free setting:', error);
    res.status(500).json({ message: 'Failed to save ad-free setting' });
  }
});

// GET /api/users/active-distribution - Get active user political distribution
router.get('/active-distribution', async (req, res) => {
  try {
    const distribution = await analyticsService.getActiveUserPoliticalDistribution();

    // Ensure distribution has all required keys; fill with zeros if missing
    const filledDistribution = {
      authoritarianCapitalist: (distribution as any)?.authoritarianCapitalist ?? 0,
      authoritarianSocialist: (distribution as any)?.authoritarianSocialist ?? 0,
      libertarianCapitalist: (distribution as any)?.libertarianCapitalist ?? 0,
      libertarianSocialist: (distribution as any)?.libertarianSocialist ?? 0,
    };

    const processed = analyticsService.processPoliticalDistribution(filledDistribution);
    res.json(processed);
  } catch (error) {
    console.error("Error fetching active user political distribution:", error);
    res.status(500).json({ message: "Failed to fetch active user distribution" });
  }
});


// GET /api/users/search?q=&limit= - People search by public display name or @handle.
// Only public fields (no email, role, status or private names); active accounts only.
const userSearchHits = new Map<string, { count: number; resetAt: number }>();
const USER_SEARCH_PER_MIN = 120;
router.get('/search', async (req, res) => {
  try {
    // Per signed-in user, else per client IP (Cloudflare's header; req.ip is the proxy behind Cloudflare).
    const me = (req.user as Express.User | undefined)?.id;
    const key = me ? `u:${me}` : `ip:${String(req.headers['cf-connecting-ip'] || req.ip || 'anon')}`;
    const now = Date.now();
    const hit = userSearchHits.get(key);
    if (!hit || hit.resetAt < now) {
      userSearchHits.set(key, { count: 1, resetAt: now + 60_000 });
      if (userSearchHits.size > 5000) {
        userSearchHits.forEach((v, k) => { if (v.resetAt < now) userSearchHits.delete(k); });
      }
    } else if (++hit.count > USER_SEARCH_PER_MIN) {
      return res.status(429).json({ message: 'Too many searches, try again in a minute' });
    }

    const raw = String(req.query.q ?? '').trim().replace(/^@/, '').slice(0, 50);
    if (raw.length < 2) return res.json([]);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '8'), 10) || 8, 1), 20);
    const esc = raw.toLowerCase().replace(/[\\%_]/g, (c) => '\\' + c);
    const contains = `%${esc}%`;
    const prefix = `${esc}%`;

    const result: any = await db.execute(sql`
      with people as (
        select u.id, u.handle, u.profile_image_url, u.selected_badge_id,
          case when nullif(trim(p.display_first_name), '') is not null then trim(p.display_first_name) else u.first_name end as first_name,
          case when nullif(trim(p.display_first_name), '') is not null then nullif(trim(p.display_last_name), '') else u.last_name end as last_name
        from users u
        left join user_profiles p on p.user_id = u.id
        where coalesce(u.status, 'active') = 'active'
      ),
      matched as (
        select *, lower(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))) as full_name
        from people
        where lower(coalesce(handle, '')) like ${contains}
           or lower(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))) like ${contains}
        limit 200
      )
      select m.id, m.handle, m.first_name, m.last_name, m.profile_image_url,
        (select count(*)::int from user_follows f where f.following_id = m.id) as follower_count,
        tb.name as badge_name, tb.icon as badge_icon, tb.tier as badge_tier
      from matched m
      left join lateral (
        select b.name, b.icon, b.tier from user_badges ub join badges b on b.id = ub.badge_id
        where ub.user_id = m.id
        order by (b.id = m.selected_badge_id) desc, b.tier desc, b.requirement desc
        limit 1
      ) tb on true
      order by
        (lower(coalesce(m.handle, '')) = ${raw.toLowerCase()}) desc,
        (lower(coalesce(m.handle, '')) like ${prefix} or m.full_name like ${prefix}) desc,
        follower_count desc,
        m.first_name asc nulls last
      limit ${limit}
    `);
    const rows = (result.rows ?? result) as any[];
    res.json(rows.map((r) => ({
      id: r.id,
      handle: r.handle ?? null,
      firstName: r.first_name ?? null,
      lastName: r.last_name ?? null,
      profileImageUrl: r.profile_image_url ?? null,
      followerCount: Number(r.follower_count || 0),
      topBadge: r.badge_name ? { name: r.badge_name, icon: r.badge_icon, tier: Number(r.badge_tier || 1) } : null,
    })));
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Failed to search users' });
  }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const requestingUserId = (req.user as Express.User)?.id;
    const requestingUserRole = req.userRole;
    const isAdmin = requestingUserRole === 'admin';
    const key = cacheKey('user', req.params.id, 'profile');
    
    // Try cache first
    let user = await getCache(key);
    if (!user) {
      user = await userRepository.findById(
        req.params.id,
        requestingUserId,
        requestingUserRole,
        req
      );
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Cache for 3 minutes
      await setCache(key, user, CACHE_TTL.TOPIC_FULL);
    }
    
    // Hide isSynthetic from non-admins
    let responseUser: any = user;
    if (!isAdmin) {
      const { isSynthetic, ...rest } = user as any;
      responseUser = rest;
    }
    
    res.json(responseUser);
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof AuthorizationError || error instanceof DataAccessError) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

// GET /api/users/me/topic-queue - Get prioritized topic queue for a section
router.get('/me/topic-queue', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as Express.User;
    if (!user || !user.id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const { sectionTopicIds, limit } = req.query;
    
    let topicIds: string[] = [];
    if (typeof sectionTopicIds === 'string') {
      try {
        topicIds = JSON.parse(sectionTopicIds);
      } catch {
        return res.status(400).json({ error: "sectionTopicIds must be a valid JSON array" });
      }
    } else if (Array.isArray(sectionTopicIds)) {
      topicIds = sectionTopicIds as string[];
    } else {
      return res.status(400).json({ error: "sectionTopicIds is required" });
    }

    if (!Array.isArray(topicIds) || topicIds.length === 0) {
      return res.status(400).json({ error: "sectionTopicIds must be a non-empty array" });
    }

    const prioritizedIds = await interactionRepository.getPrioritizedQueue(
      user.id,
      topicIds,
      limit ? parseInt(limit as string, 10) : 20
    );

    // Fetch full topic data with counts for the prioritized IDs
    const topics = await Promise.all(
      prioritizedIds.map(id => topicService.getTopic(id))
    );

    const validTopics = topics.filter((t): t is NonNullable<typeof t> => t !== null);

    res.json(validTopics);
  } catch (error) {
    console.error("Error fetching topic queue:", error);
    res.status(500).json({ message: "Failed to fetch topic queue" });
  }
});

// GET /api/users/me/interactions - Get user's interaction history
router.get('/me/interactions', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as Express.User;
    if (!user || !user.id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const interactions = await interactionRepository.getUserInteractions(user.id);
    res.json(interactions);
  } catch (error) {
    console.error("Error fetching interactions:", error);
    res.status(500).json({ message: "Failed to fetch interactions" });
  }
});

// GET /api/users/me/recent-categories - Get user's recent topic categories
router.get('/me/recent-categories', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as Express.User;
    if (!user || !user.id) {
      return res.json([]);
    }

    // Get user's recently viewed topics (from topic_views table)
    // For now, return empty array if no views exist
    // TODO: Implement proper recent categories tracking based on topic views
    res.json([]);
  } catch (error) {
    console.error("Error fetching recent categories:", error);
    res.status(500).json({ message: "Failed to fetch recent categories" });
  }
});

// GET /api/users/:userId/debate-stats - Get user's debate statistics
router.get('/:userId/debate-stats', async (req, res) => {
  try {
    const requestingUserId = (req.user as Express.User)?.id;
    const requestingUserRole = req.userRole;
    const key = cacheKey('user', req.params.userId, 'debate-stats');
    
    // Try cache first
    let stats = await getCache(key);
    if (!stats) {
      stats = await userRepository.getDebateStats(
        req.params.userId,
        requestingUserId,
        requestingUserRole,
        req
      );
      const defaultStats = stats || {
        totalDebates: 0,
        avgLogicalReasoning: 0,
        avgPoliteness: 0,
        avgOpennessToChange: 0,
        totalVotesReceived: 0,
      };
      
      // Cache for 5 minutes
      await setCache(key, defaultStats, CACHE_TTL.LONG);
      stats = defaultStats;
    }
    
    res.json(stats);
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof AuthorizationError || error instanceof DataAccessError) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error("Error fetching debate stats:", error);
    res.status(500).json({ message: "Failed to fetch debate stats" });
  }
});

// GET /api/users/me/debate-rooms - Get current user's debate rooms
router.get('/me/debate-rooms', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as Express.User;
    if (!user || !user.id) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    const requestingUserId = user.id;
    const requestingUserRole = req.userRole;
    
    // Import DebateService dynamically to avoid circular dependencies
    const { DebateService } = await import('../services/debateService.js');
    const debateService = new DebateService();
    
    const rooms = await debateService.getUserDebateRooms(
      requestingUserId,
      requestingUserId,
      requestingUserRole,
      req
    );
    
    res.json({ active: rooms, ended: [], archived: [] });
  } catch (error) {
    if (isSecurityError(error)) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error("Error fetching debate rooms:", error);
    res.status(500).json({ message: "Failed to fetch debate rooms" });
  }
});

// GET /api/users/:userId/badges - Get user's badges
router.get('/:userId/badges', async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }
    // Not cached: awarding is lazy (checked on read) and stats are cheap COUNTs.
    const userBadgeList = await badgeRepository.getUserBadges(userId);
    res.json(userBadgeList);
  } catch (error) {
    console.error("Error fetching user badges:", error);
    res.status(500).json({ message: "Failed to fetch user badges" });
  }
});

// GET /api/users/:userId/skills - XP per skill with current and next tier (computed live)
router.get('/:userId/skills', async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ message: "User ID is required" });
    res.json(await badgeRepository.getUserSkills(userId));
  } catch (error) {
    console.error("Error fetching user skills:", error);
    res.status(500).json({ message: "Failed to fetch user skills" });
  }
});

// POST /api/users/me/selected-badge - Set (or clear with null) the badge shown on the user's avatar
router.post('/me/selected-badge', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as Express.User).id;
    const badgeId = req.body?.badgeId ?? null;
    if (badgeId !== null && typeof badgeId !== 'string') {
      return res.status(400).json({ message: "badgeId must be a string or null" });
    }
    try {
      await badgeRepository.setSelectedBadge(userId, badgeId);
    } catch (e: any) {
      return res.status(400).json({ message: e?.message || "Badge not unlocked" });
    }
    await invalidateUserBadgesCache(userId).catch(() => {});
    res.json({ success: true, selectedBadgeId: badgeId });
  } catch (error) {
    console.error("Error setting selected badge:", error);
    res.status(500).json({ message: "Failed to set selected badge" });
  }
});

// GET /api/users/:userId/recommended-topics - Get recommended topics for user
router.get('/:userId/recommended-topics', async (req, res) => {
  try {
    const key = cacheKey('user', req.params.userId, 'recommended-topics');
    
    // Try cache first
    let result = await getCache(key);
    if (!result) {
      // TODO: Implement topic recommendation logic
      result = { topics: [] };
      
      // Cache for 3 minutes
      await setCache(key, result, CACHE_TTL.TOPIC_FULL);
    }
    
    res.json(result);
  } catch (error) {
    console.error("Error fetching recommended topics:", error);
    res.status(500).json({ message: "Failed to fetch recommended topics" });
  }
});

// GET /api/users/:userId/following-topics - Get topics user is following
router.get('/:userId/following-topics', async (req, res) => {
  try {
    // TODO: Implement following topics logic
    res.json({ topics: [] });
  } catch (error) {
    console.error("Error fetching following topics:", error);
    res.status(500).json({ message: "Failed to fetch following topics" });
  }
});

// PUT /api/profile-picture - Update profile picture
router.put('/profile-picture', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as Express.User;
    if (!user || !user.id) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    const userId = user.id;
    // TODO: Implement profile picture upload logic
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating profile picture:", error);
    res.status(500).json({ error: "Failed to update profile picture" });
  }
});

// Onboarding routes
router.put('/onboarding/profile', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as Express.User;
    if (!user || !user.id) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    const userId = String(user.id);
    const body = req.body ?? {};
    const payload: {
      firstName?: string;
      lastName?: string;
      bio?: string;
      location?: string;
      profileImageUrl?: string;
    } = {};
    if (body.firstName !== undefined) payload.firstName = String(body.firstName);
    if (body.lastName !== undefined) payload.lastName = String(body.lastName);
    if (body.bio !== undefined) payload.bio = String(body.bio);
    if (body.location !== undefined) payload.location = String(body.location);
    if (body.profileImageUrl !== undefined) payload.profileImageUrl = String(body.profileImageUrl);

    await userRepository.updateProfile(userId, payload, userId, req.userRole, req);
    
    // Invalidate user cache after update
    await invalidateUserCache(userId);
    
    res.status(200).json({ success: true });
  } catch (error) {
    if (isSecurityError(error)) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error("Error updating profile:", error);
    const detail =
      process.env.EXPOSE_ERROR_DETAILS === 'true' && error instanceof Error ? error.message : undefined;
    res.status(500).json({ error: "Failed to update profile", ...(detail ? { detail } : {}) });
  }
});

router.put('/onboarding/categories', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as Express.User;
    if (!user || !user.id) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    const userId = user.id;
    const { categories } = req.body;

    if (!Array.isArray(categories)) {
      return res.status(400).json({ error: "categories must be an array" });
    }

    await userRepository.updateProfile(userId, { followedCategories: categories }, userId, req.userRole, req);
    
    // Invalidate user cache and recommended topics cache
    await invalidateUserCache(userId);
    
    res.status(200).json({ success: true });
  } catch (error) {
    if (isSecurityError(error)) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error("Error updating categories:", error);
    res.status(500).json({ error: "Failed to update categories" });
  }
});

router.put('/onboarding/progress', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as Express.User;
    if (!user || !user.id) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    const userId = user.id;
    const { step, complete } = req.body;

    if (typeof step !== 'number' || typeof complete !== 'boolean') {
      return res.status(400).json({ message: "step must be a number and complete must be a boolean" });
    }

    
    // Update onboarding progress in the database
    const updatedUser = await userRepository.updateOnboardingProgress(
      userId,
      step,
      complete,
      userId,
      req.userRole,
      req
    );
    
    // Invalidate user cache after update
    await invalidateUserCache(userId);
    
    
    res.status(200).json({ 
      success: true,
      onboardingStep: updatedUser.onboardingStep,
      onboardingComplete: updatedUser.onboardingComplete
    });
  } catch (error) {
    if (isSecurityError(error)) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error("Error updating onboarding progress:", error);
    res.status(500).json({ error: "Failed to update onboarding progress" });
  }
});

// Admin routes for user management
router.get('/admin/users', requireAdmin, async (req, res) => {
  try {
    // TODO: Implement admin user listing
    res.json({ users: [] });
  } catch (error) {
    console.error("Error fetching admin users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

router.put('/admin/:userId/role', requireAdmin, async (req, res) => {
  try {
    // TODO: Implement role updates
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({ message: "Failed to update user role" });
  }
});

router.put('/admin/:userId/status', requireAdmin, async (req, res) => {
  try {
    // TODO: Implement status updates
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating user status:", error);
    res.status(500).json({ message: "Failed to update user status" });
  }
});

router.delete('/admin/:userId', requireAdmin, async (req, res) => {
  try {
    // TODO: Implement user deletion
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

export default router;
