import { notifyNewDebateCreated } from '../websocket.js';
import { notifyDebateInvite, displayNameOf, FlowError, postDebateMessage } from '../lib/debateFlow.js';
import { checkDebateStart, markInvitePending } from '../lib/debateLimits.js';
import { db } from '../db.js';
import { opinions as opinionsTable } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { OpinionService } from '../services/opinionService.js';
import { DebateService } from '../services/debateService.js';
import { ModerationService } from '../services/moderationService.js';
import { CounterpointService } from '../services/counterpointService.js';
import { isAuthenticated, requireModerator, requireAdmin } from '../middleware/auth.js';
import { insertOpinionSchema } from '../../shared/schema.js';
import { z } from 'zod';
import { invalidateVoteCache } from '../services/cacheInvalidation.js';
import { notifyActivityLater } from '../lib/activityNotify.js';
import { isLikeMilestone } from '../../shared/notificationRules.js';
import { UnauthorizedError, ForbiddenError, AuthorizationError, DataAccessError } from '../utils/securityErrors.js';
import { AiFlagService } from '../services/aiFlagService.js';

const router = Router();
const opinionService = new OpinionService();
const debateService = new DebateService();
const moderationService = new ModerationService();
const counterpointService = new CounterpointService();
const aiFlagService = new AiFlagService();

// GET /api/opinions/recent - Get recent opinions
router.get('/recent', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const requestingUserId = (req.user as Express.User)?.id;
    const requestingUserRole = req.userRole;

    const opinions = await opinionService.getRecentOpinions(
      limit,
      requestingUserRole,
      requestingUserId,
      requestingUserId,
      requestingUserRole,
      req
    );

    res.json(opinions);
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof AuthorizationError || error instanceof DataAccessError) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error("Error fetching recent opinions:", error);
    res.status(500).json({ message: "Failed to fetch recent opinions" });
  }
});

// GET /api/topics/:topicId/opinions - Get opinions for a topic
router.get('/topics/:topicId', async (req, res) => {
  try {
    const requestingUserId = (req.user as Express.User)?.id;
    const requestingUserRole = req.userRole;
    const opinions = await opinionService.getOpinionsByTopic(
      req.params.topicId,
      {
        userRole: requestingUserRole,
        currentUserId: requestingUserId,
      },
      requestingUserId,
      requestingUserRole,
      req
    );

    res.json(opinions);
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof AuthorizationError || error instanceof DataAccessError) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
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

    const requestingUserId = user.id;
    const requestingUserRole = req.userRole;

    const validatedData = insertOpinionSchema.parse({
      ...req.body,
      topicId: req.params.topicId,
      userId: requestingUserId,
    });

    const opinion = await opinionService.createOpinion(
      validatedData,
      requestingUserId,
      requestingUserRole,
      req
    );
    res.status(201).json(opinion);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError || error instanceof AuthorizationError || error instanceof DataAccessError) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error("Error creating opinion:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: "Failed to create opinion",
      message: errorMessage
    });
  }
});

// GET /api/opinions/ai-flags/mine - Opinion IDs the current user has flagged as likely AI-written
router.get('/ai-flags/mine', isAuthenticated, async (req, res) => {
  try {
    const ids = await aiFlagService.flagsForUser(req.user!.id);
    res.json({ opinionIds: ids });
  } catch (error) {
    console.error('Error listing AI flags:', error);
    res.status(500).json({ message: 'Failed to list AI flags' });
  }
});

// GET /api/opinions/:opinionId - Get single opinion
router.get('/:opinionId', async (req, res) => {
  try {
    const requestingUserId = (req.user as Express.User)?.id;
    const requestingUserRole = req.userRole;
    const opinion = await opinionService.getOpinion(
      req.params.opinionId,
      requestingUserId,
      requestingUserRole,
      req
    );
    if (!opinion) {
      return res.status(404).json({ message: "Opinion not found" });
    }
    res.json(opinion);
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof AuthorizationError || error instanceof DataAccessError) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error("Error fetching opinion:", error);
    res.status(500).json({ message: "Failed to fetch opinion" });
  }
});

// PATCH /api/opinions/:opinionId - Update opinion
router.patch('/:opinionId', isAuthenticated, async (req, res) => {
  try {
    const requestingUserId = (req.user as Express.User)?.id;
    if (!requestingUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const requestingUserRole = req.userRole;
    // Only user-editable fields; prevents clients from patching likesCount etc.
    const patch = insertOpinionSchema
      .pick({ content: true, debateStatus: true, references: true, stance: true })
      .partial()
      .parse(req.body ?? {});
    const opinion = await opinionService.updateOpinion(
      req.params.opinionId,
      patch,
      requestingUserId,
      requestingUserRole,
      req
    );
    res.json(opinion);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError || error instanceof AuthorizationError || error instanceof DataAccessError) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
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

    const counts = await opinionService.voteOnOpinion(req.params.opinionId, userId, voteType);
    
    // Invalidate vote cache
    await invalidateVoteCache(req.params.opinionId, userId);

    if (voteType === 'like' && isLikeMilestone(counts.likesCount)) {
      const [op] = await db.select({ userId: opinionsTable.userId, topicId: opinionsTable.topicId }).from(opinionsTable).where(eq(opinionsTable.id, req.params.opinionId)).limit(1);
      if (op) notifyActivityLater({ type: 'like_milestone', recipientId: op.userId, actorId: userId, likes: counts.likesCount,
        targetId: req.params.opinionId, topicId: op.topicId, linkUrl: `/opinion/${req.params.opinionId}/counterpoints` });
    }
    
    res.json({ message: voteType === null ? "Vote removed" : "Vote recorded", likesCount: counts.likesCount, dislikesCount: counts.dislikesCount, userVote: voteType ? { voteType } : null });
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

// POST /api/opinions/:opinionId/ai-flag - Flag an opinion as likely AI-written (one per user)
router.post('/:opinionId/ai-flag', isAuthenticated, async (req, res) => {
  try {
    const result = await aiFlagService.flag(req.params.opinionId, req.user!.id);
    res.json({ flagged: true, already: result.already });
  } catch (error: any) {
    const status = error?.status;
    if (status === 400 || status === 404) return res.status(status).json({ message: error.message });
    console.error('Error adding AI flag:', error);
    res.status(500).json({ message: 'Failed to flag opinion as AI-written' });
  }
});

router.delete('/:opinionId/ai-flag', isAuthenticated, async (req, res) => {
  try {
    await aiFlagService.unflag(req.params.opinionId, req.user!.id);
    res.json({ flagged: false });
  } catch (error) {
    console.error('Error removing AI flag:', error);
    res.status(500).json({ message: 'Failed to remove AI flag' });
  }
});

router.get('/:opinionId/ai-flag', isAuthenticated, async (req, res) => {
  try {
    const flagged = await aiFlagService.hasFlag(req.params.opinionId, req.user!.id);
    res.json({ flagged });
  } catch (error) {
    console.error('Error checking AI flag:', error);
    res.status(500).json({ message: 'Failed to check AI flag' });
  }
});

// POST /api/opinions/:opinionId/start-debate - Start debate from opinion
router.post('/:opinionId/start-debate', isAuthenticated, async (req, res) => {
  try {
    const requestingUserId = (req.user as Express.User)?.id;
    if (!requestingUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    // Overload guards: caps, hourly limit, and reuse of an already-open debate between the same two people.
    const [op] = await db.select({ userId: opinionsTable.userId, topicId: opinionsTable.topicId }).from(opinionsTable).where(eq(opinionsTable.id, req.params.opinionId)).limit(1);
    if (op && op.userId !== requestingUserId) {
      const existing = await checkDebateStart(requestingUserId, op.userId, op.topicId);
      if (existing) return res.json({ ...existing, reused: true });
    }
    // Challenge button (Nov 20 2026): no opinion needed. Optional stance (if you have no opinion here) and an
    // optional opening argument; with an opening, the challenger goes first and the author replies.
    const stance = ['for', 'against', 'neutral'].includes(req.body?.stance) ? req.body.stance : null;
    const opening = typeof req.body?.opening === 'string' ? req.body.opening.trim().slice(0, 4000) : '';
    const debateRoom = await debateService.createDebateRoom(req.params.opinionId, requestingUserId, { stance, challengerFirst: !!opening });
    if (opening) {
      try {
        await postDebateMessage(debateRoom.id, requestingUserId, opening, req.userRole, req, { silent: true }); // the invite notification covers it
      } catch (e) {
        console.error('Could not post opening argument:', e);
      }
    }
    // Opinion author (participant1) is invited; the room is a pending invite until they accept or reply. Never expires.
    await markInvitePending(debateRoom.id, requestingUserId, debateRoom.participant1Id);
    notifyNewDebateCreated(debateRoom.id, await displayNameOf(requestingUserId), debateRoom.participant1Id);
    await notifyDebateInvite(debateRoom.id, requestingUserId, debateRoom.participant1Id, debateRoom.topicId);
    res.json({ ...debateRoom, inviteStatus: 'pending', inviteeId: debateRoom.participant1Id });
  } catch (error) {
    if (error instanceof FlowError) return res.status(error.status).json({ message: error.message });
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError || error instanceof AuthorizationError || error instanceof DataAccessError) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    const msg = (error as Error)?.message || '';
    if (/cannot debate your own|must have an opinion|not found/i.test(msg)) return res.status(400).json({ message: msg });
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

// DELETE /api/opinions/:opinionId - the author (or an admin) deletes an opinion.
// Votes, flags, AI flags and counterpoints go with it (ON DELETE CASCADE).
router.delete('/:opinionId', isAuthenticated, async (req, res) => {
  try {
    const requestingUserId = (req.user as Express.User)?.id;
    if (!requestingUserId) return res.status(401).json({ error: 'User not authenticated' });
    await opinionService.deleteOpinion(req.params.opinionId, requestingUserId, req.userRole, req);
    res.json({ message: 'Opinion deleted' });
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError || error instanceof AuthorizationError || error instanceof DataAccessError) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    if (error instanceof Error && /not found/i.test(error.message)) {
      return res.status(404).json({ error: 'Opinion not found' });
    }
    console.error('Error deleting opinion:', error);
    res.status(500).json({ message: 'Failed to delete opinion' });
  }
});

// GET /api/opinions/:opinionId/counterpoints/counts - Counterpoint counts per paragraph index
router.get('/:opinionId/counterpoints/counts', async (req, res) => {
  try {
    const rows = await counterpointService.countCounterpointsBySentenceIndex(req.params.opinionId);
    res.json(rows);
  } catch (error: any) {
    console.error('Error listing counterpoint counts:', error);
    res.status(500).json({ message: 'Failed to list counterpoint counts' });
  }
});

// GET /api/opinions/:opinionId/counterpoints?sentenceIndex=n - List counterpoints for a sentence
router.get('/:opinionId/counterpoints', async (req, res) => {
  try {
    const sentenceIndexRaw = req.query.sentenceIndex;
    // No sentenceIndex (or "all") = every paragraph's counterpoints (used by the full counterpoints page)
    const all = sentenceIndexRaw === undefined || sentenceIndexRaw === 'all';
    const sentenceIndex = typeof sentenceIndexRaw === 'string' ? parseInt(sentenceIndexRaw, 10) : NaN;
    if (!all && (!Number.isInteger(sentenceIndex) || sentenceIndex < 0)) {
      return res.status(400).json({ error: 'sentenceIndex is required and must be a non-negative integer' });
    }
    const currentUserId = (req.user as Express.User | undefined)?.id;
    const counterpoints = await counterpointService.listCounterpoints({
      opinionId: req.params.opinionId,
      sentenceIndex: all ? undefined : sentenceIndex,
      currentUserId,
    });
    res.json(counterpoints);
  } catch (error: any) {
    console.error('Error listing counterpoints:', error);
    res.status(500).json({ message: 'Failed to list counterpoints' });
  }
});

// POST /api/opinions/:opinionId/counterpoints - Create a counterpoint for a sentence
router.post('/:opinionId/counterpoints', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { sentenceIndex, content, paragraphText } = req.body || {};
    const created = await counterpointService.createCounterpoint({
      opinionId: req.params.opinionId,
      sentenceIndex: Number(sentenceIndex),
      authorUserId: userId,
      content: String(content ?? ''),
      paragraphText: paragraphText != null ? String(paragraphText) : undefined,
    });
    const [op] = await db.select({ userId: opinionsTable.userId, topicId: opinionsTable.topicId }).from(opinionsTable).where(eq(opinionsTable.id, req.params.opinionId)).limit(1);
    if (op) notifyActivityLater({ type: 'opinion_counterpoint', recipientId: op.userId, actorId: userId,
      targetId: req.params.opinionId, topicId: op.topicId, linkUrl: `/opinion/${req.params.opinionId}/counterpoints` });
    res.status(201).json(created);
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Failed to create counterpoint' });
  }
});

export default router;
