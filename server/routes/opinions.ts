import { Router } from 'express';
import { OpinionService } from '../services/opinionService';
import { DebateService } from '../services/debateService';
import { ModerationService } from '../services/moderationService';
import { isAuthenticated, requireModerator, requireAdmin } from '../middleware/auth';
import { insertOpinionSchema } from '@shared/schema';
import { z } from 'zod';
import { invalidateVoteCache } from '../services/cacheInvalidation';

const router = Router();
const opinionService = new OpinionService();
const debateService = new DebateService();
const moderationService = new ModerationService();

// GET /api/opinions/recent - Get recent opinions
router.get('/recent', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const currentUserId = (req.user as Express.User)?.id;

    // TODO: Implement recent opinions in OpinionService
    // const opinions = await opinionService.getRecentOpinions(limit, req.userRole, currentUserId);
    const opinions: any[] = []; // Placeholder

    // If user is authenticated, include their vote for each opinion
    if (currentUserId) {
      // TODO: Add vote information
    }

    res.json(opinions);
  } catch (error) {
    console.error("Error fetching recent opinions:", error);
    res.status(500).json({ message: "Failed to fetch recent opinions" });
  }
});

// GET /api/topics/:topicId/opinions - Get opinions for a topic
router.get('/topics/:topicId', async (req, res) => {
  try {
    // Get current user ID - support both local auth (req.user.id) and Replit auth (req.user.claims.sub)
    const user = req.user as Express.User;
    const currentUserId = user?.id;
    const opinions = await opinionService.getOpinionsByTopic(req.params.topicId, {
      userRole: req.userRole,
      currentUserId,
    });

    res.json(opinions);
  } catch (error) {
    console.error("Error fetching opinions:", error);
    res.status(500).json({ message: "Failed to fetch opinions" });
  }
});

// POST /api/topics/:topicId/opinions - Create new opinion
router.post('/topics/:topicId', isAuthenticated, async (req, res) => {
  try {
    // Ensure user is authenticated and has an id
    const user = req.user as Express.User;
    if (!user || !user.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const validatedData = insertOpinionSchema.parse({
      ...req.body,
      topicId: req.params.topicId,
      userId: user.id,
    });

    const opinion = await opinionService.createOpinion(validatedData);
    res.status(201).json(opinion);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }

    console.error("Error creating opinion:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: "Failed to create opinion",
      message: errorMessage
    });
  }
});

// GET /api/opinions/:opinionId - Get single opinion
router.get('/:opinionId', async (req, res) => {
  try {
    const opinion = await opinionService.getOpinion(req.params.opinionId);
    if (!opinion) {
      return res.status(404).json({ message: "Opinion not found" });
    }
    res.json(opinion);
  } catch (error) {
    console.error("Error fetching opinion:", error);
    res.status(500).json({ message: "Failed to fetch opinion" });
  }
});

// PATCH /api/opinions/:opinionId - Update opinion
router.patch('/:opinionId', isAuthenticated, async (req, res) => {
  try {
    const opinion = await opinionService.updateOpinion(req.params.opinionId, req.body);
    res.json(opinion);
  } catch (error) {
    console.error("Error updating opinion:", error);
    res.status(500).json({ message: "Failed to update opinion" });
  }
});

// POST /api/opinions/:opinionId/vote - Vote on opinion
router.post('/:opinionId/vote', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { voteType } = req.body;

    if (voteType !== null && !['like', 'dislike'].includes(voteType)) {
      return res.status(400).json({ message: "Invalid vote type" });
    }

    // TODO: Implement voting in OpinionService
    // await opinionService.voteOnOpinion(req.params.opinionId, userId, voteType);
    
    // Invalidate vote cache
    await invalidateVoteCache(req.params.opinionId, userId);
    
    res.json({ message: voteType === null ? "Vote removed" : "Vote recorded" });
  } catch (error) {
    console.error("Error voting on opinion:", error);
    res.status(500).json({ message: "Failed to vote on opinion" });
  }
});

// GET /api/opinions/:opinionId/my-vote - Get user's vote on opinion
router.get('/:opinionId/my-vote', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    // TODO: Implement getUserVote in OpinionService
    // const vote = await opinionService.getUserVote(req.params.opinionId, userId);
    res.json(null); // Placeholder
  } catch (error) {
    console.error("Error fetching user vote:", error);
    res.status(500).json({ message: "Failed to fetch user vote" });
  }
});

// POST /api/opinions/:opinionId/adopt - Adopt opinion
router.post('/:opinionId/adopt', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { content } = req.body;

    // TODO: Implement adoptOpinion in OpinionService
    // const adoptedOpinion = await opinionService.adoptOpinion(req.params.opinionId, userId, content);
    res.json({}); // Placeholder
  } catch (error) {
    console.error("Error adopting opinion:", error);
    res.status(500).json({ message: "Failed to adopt opinion" });
  }
});

// POST /api/opinions/:opinionId/flag - Flag opinion
router.post('/:opinionId/flag', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { fallacyType } = req.body;

    if (!fallacyType || typeof fallacyType !== 'string') {
      return res.status(400).json({ error: 'Fallacy type is required' });
    }

    await moderationService.flagOpinion(req.params.opinionId, userId, fallacyType);
    res.json({ message: "Opinion flagged successfully" });
  } catch (error) {
    console.error("Error flagging opinion:", error);
    res.status(500).json({ message: "Failed to flag opinion" });
  }
});

// POST /api/opinions/:opinionId/start-debate - Start debate from opinion
router.post('/:opinionId/start-debate', isAuthenticated, async (req, res) => {
  try {
    const debateRoom = await debateService.createDebateRoom(req.params.opinionId, req.user!.id);
    res.json(debateRoom);
  } catch (error) {
    console.error("Error starting debate:", error);
    res.status(500).json({ message: "Failed to start debate" });
  }
});

// Admin routes
router.get('/admin/flagged-opinions', requireModerator, async (req, res) => {
  try {
    const flaggedOpinions = await moderationService.getFlaggedOpinions();
    res.json(flaggedOpinions);
  } catch (error) {
    console.error("Error fetching flagged opinions:", error);
    res.status(500).json({ message: "Failed to fetch flagged opinions" });
  }
});

router.post('/admin/:opinionId/approve', requireModerator, async (req, res) => {
  try {
    const { reason } = req.body;
    await moderationService.approveOpinion(req.params.opinionId, req.user!.id, reason);
    res.json({ message: "Opinion approved" });
  } catch (error) {
    console.error("Error approving opinion:", error);
    res.status(500).json({ message: "Failed to approve opinion" });
  }
});

router.post('/admin/:opinionId/hide', requireModerator, async (req, res) => {
  try {
    const { reason } = req.body;
    await moderationService.hideOpinion(req.params.opinionId, req.user!.id, reason);
    res.json({ message: "Opinion hidden" });
  } catch (error) {
    console.error("Error hiding opinion:", error);
    res.status(500).json({ message: "Failed to hide opinion" });
  }
});

router.get('/admin/opinions', requireAdmin, async (req, res) => {
  try {
    const opinions = await moderationService.getOpinionsForAdmin();
    res.json(opinions);
  } catch (error) {
    console.error("Error fetching admin opinions:", error);
    res.status(500).json({ message: "Failed to fetch opinions" });
  }
});

router.delete('/admin/:opinionId', requireAdmin, async (req, res) => {
  try {
    await moderationService.deleteOpinionAdmin(req.params.opinionId, req.user!.id);
    res.json({ message: "Opinion deleted" });
  } catch (error) {
    console.error("Error deleting opinion:", error);
    res.status(500).json({ message: "Failed to delete opinion" });
  }
});

// GET /api/profile/:userId/opinions - Get user's opinions (profile page)
router.get('/profile/:userId', async (req, res) => {
  try {
    // TODO: Implement user opinions fetching
    res.json({ opinions: [] });
  } catch (error) {
    console.error("Error fetching user opinions:", error);
    res.status(500).json({ message: "Failed to fetch user opinions" });
  }
});

export default router;
