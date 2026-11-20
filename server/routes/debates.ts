import { Router } from 'express';
import { DebateService } from '../services/debateService.js';
import { isAuthenticated } from '../middleware/auth.js';
import { listPublicDebates } from '../lib/debateWatch.js';
import { isValidFallacyType } from '../../shared/fallacies.js';

const router = Router();
const debateService = new DebateService();

// GET /api/debates/grouped - Get grouped debate rooms for current user
router.get('/grouped', isAuthenticated, async (req, res) => {
  try {
    const requestingUserId = (req.user as Express.User)?.id;
    if (!requestingUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const requestingUserRole = req.userRole;
    const grouped = await debateService.getGroupedDebateRooms(
      requestingUserId,
      requestingUserId,
      requestingUserRole,
      req
    );
    res.json(grouped);
  } catch (error: any) {
    console.error('Error fetching grouped debates:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch debates' });
  }
});

// GET /api/debates/live - public debates happening now (anyone can watch). Powers the Live Debates page.
router.get('/live', async (_req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await listPublicDebates('live', 50));
  } catch (error: any) {
    console.error('Error listing live debates:', error);
    res.status(500).json({ message: 'Failed to load live debates' });
  }
});

// GET /api/debates/finished - recently finished public debates (read the full exchange).
router.get('/finished', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await listPublicDebates('finished', Number(req.query.limit) || 20));
  } catch (error: any) {
    console.error('Error listing finished debates:', error);
    res.status(500).json({ message: 'Failed to load finished debates' });
  }
});

// POST /api/debates/messages/:messageId/flag - Flag a debate message
router.post('/messages/:messageId/flag', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { fallacyType } = req.body;

    if (!fallacyType || typeof fallacyType !== 'string' || !isValidFallacyType(fallacyType)) {
      return res.status(400).json({ message: 'Pick a fallacy type from the list' });
    }

    await debateService.flagMessage(req.params.messageId, userId, fallacyType);
    res.json({ message: "Message flagged successfully" });
  } catch (error: any) {
    if (String(error?.code) === '23505' || /unique/i.test(String(error?.message))) {
      return res.status(409).json({ message: 'You already flagged this message' });
    }
    if (String(error?.code) === '23503' || String(error?.code) === '22P02') {
      return res.status(404).json({ message: 'Message not found' });
    }
    console.error("Error flagging debate message:", error);
    res.status(500).json({ message: "Failed to flag message" });
  }
});

// Note: Other debate operations are handled through:
// - /api/opinions/:id/start-debate (in opinions.ts)
// - /api/users/me/debate-rooms (in users.ts)

export default router;
