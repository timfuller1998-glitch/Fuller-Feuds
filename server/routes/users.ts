import { Router } from 'express';
import { UserRepository } from '../repositories/userRepository';
import { AnalyticsService } from '../services/analyticsService';
import { InteractionRepository } from '../repositories/interactionRepository';
import { TopicService } from '../services/topicService';
import { isAuthenticated, requireAdmin } from '../middleware/auth';
import type { UpsertUser } from '@shared/schema';
import { getCache, setCache, cacheKey, CACHE_TTL } from '../services/cacheService';
import { invalidateUserCache, invalidateUserBadgesCache, invalidateUserDebateStatsCache } from '../services/cacheInvalidation';

const router = Router();
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

    const userId = user.id;
    const key = cacheKey('user', userId, 'profile');
    
    // Try cache first
    let userData = await getCache(key);
    if (!userData) {
      userData = await userRepository.findById(userId);
      
      // If user doesn't exist in database (shouldn't happen with local auth, but handle gracefully)
      if (!userData) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Cache for 2 minutes
      await setCache(key, userData, CACHE_TTL.MEDIUM);
    }

    // Hide isSynthetic from non-admins
    const isAdmin = req.userRole === 'admin';
    let responseUser: any = userData;
    if (!isAdmin) {
      const { isSynthetic, ...rest } = userData as any;
      responseUser = rest;
    }

    res.json(responseUser);
  } catch (error) {
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
      await userRepository.updateProfile(userId, { followedCategories });
    }

    // Invalidate user cache after update
    await invalidateUserCache(userId);

    const userData = await userRepository.findById(userId);
    res.json(userData);
  } catch (error) {
    console.error("Error updating current user:", error);
    res.status(500).json({ message: "Failed to update user" });
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

// GET /api/users/:id - Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const isAdmin = req.userRole === 'admin';
    const key = cacheKey('user', req.params.id, 'profile');
    
    // Try cache first
    let user = await getCache(key);
    if (!user) {
      user = await userRepository.findById(req.params.id);
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
    const key = cacheKey('user', req.params.userId, 'debate-stats');
    
    // Try cache first
    let stats = await getCache(key);
    if (!stats) {
      stats = await userRepository.getDebateStats(req.params.userId);
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
    console.error("Error fetching debate stats:", error);
    res.status(500).json({ message: "Failed to fetch debate stats" });
  }
});

// GET /api/users/me/debate-rooms - Get current user's debate rooms
router.get('/me/debate-rooms', isAuthenticated, async (req, res) => {
  try {
    // This will be handled by debate service, placeholder for now
    res.json({ active: [], ended: [], archived: [] });
  } catch (error) {
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

    const key = cacheKey('user', userId, 'badges');
    
    // Try cache first
    let badges = await getCache(key);
    if (!badges) {
      // Get user's badges from the database
      // For now, return empty array if no badges exist
      // TODO: Implement proper badges logic using BadgeRepository
      badges = [];
      
      // Cache for 5 minutes
      await setCache(key, badges, CACHE_TTL.LONG);
    }
    
    res.json(badges);
  } catch (error) {
    console.error("Error fetching user badges:", error);
    res.status(500).json({ message: "Failed to fetch user badges" });
  }
});

// POST /api/users/me/selected-badge - Set user's selected badge
router.post('/me/selected-badge', isAuthenticated, async (req, res) => {
  try {
    // TODO: Implement badge selection logic
    res.json({ success: true });
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
    const userId = user.id;
    await userRepository.updateProfile(userId, req.body);
    
    // Invalidate user cache after update
    await invalidateUserCache(userId);
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Failed to update profile" });
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

    await userRepository.updateProfile(userId, { followedCategories: categories });
    
    // Invalidate user cache and recommended topics cache
    await invalidateUserCache(userId);
    
    res.status(200).json({ success: true });
  } catch (error) {
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

    console.log(`[Onboarding Progress] Updating user ${userId}: step=${step}, complete=${complete}`);
    
    // Update onboarding progress in the database
    const updatedUser = await userRepository.updateOnboardingProgress(userId, step, complete);
    
    // Invalidate user cache after update
    await invalidateUserCache(userId);
    
    console.log(`[Onboarding Progress] Updated user:`, {
      id: updatedUser.id,
      onboardingStep: updatedUser.onboardingStep,
      onboardingComplete: updatedUser.onboardingComplete
    });
    
    res.status(200).json({ 
      success: true,
      onboardingStep: updatedUser.onboardingStep,
      onboardingComplete: updatedUser.onboardingComplete
    });
  } catch (error) {
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
