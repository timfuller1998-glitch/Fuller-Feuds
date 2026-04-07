import { Router } from 'express';
import { DebateService } from '../services/debateService.js';
import { isAuthenticated } from '../middleware/auth.js';

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

// POST /api/debate-messages/:messageId/flag - Flag a debate message
router.post('/messages/:messageId/flag', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { fallacyType } = req.body;

    if (!fallacyType || typeof fallacyType !== 'string') {
      return res.status(400).json({ error: 'Fallacy type is required' });
    }

    await debateService.flagMessage(req.params.messageId, userId, fallacyType);
    res.json({ message: "Message flagged successfully" });
  } catch (error) {
    console.error("Error flagging debate message:", error);
    res.status(500).json({ message: "Failed to flag message" });
  }
});

// Note: Other debate operations are handled through:
// - /api/opinions/:id/start-debate (in opinions.ts)
// - /api/users/me/debate-rooms (in users.ts)

export default router;
