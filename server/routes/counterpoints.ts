import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import { CounterpointService } from '../services/counterpointService.js';
import { DebateService } from '../services/debateService.js';
import { notifyNewDebateCreated } from '../websocket.js';
import { CounterpointRepository } from '../repositories/counterpointRepository.js';

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
    const opening = `Counterpoint to sentence #${counterpoint.sentenceIndex + 1}:\n\n${counterpoint.content}`;
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

