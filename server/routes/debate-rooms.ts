import { Router } from 'express';
import { DebateService } from '../services/debateService.js';
import { isAuthenticated } from '../middleware/auth.js';
import { notifyNewDebateMessage, notifyDebateEnded } from '../websocket.js';

const router = Router();
const debateService = new DebateService();

// GET /api/debate-rooms/:id - Get debate room details
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const room = await debateService.getDebateRoom(req.params.id);
    if (!room) {
      return res.status(404).json({ message: 'Debate room not found' });
    }
    res.json(room);
  } catch (error: any) {
    console.error('Error fetching debate room:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch debate room' });
  }
});

// GET /api/debate-rooms/:id/messages - Get messages for a debate room
router.get('/:id/messages', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const messages = await debateService.getMessages(req.params.id, userId);
    res.json(messages);
  } catch (error: any) {
    console.error('Error fetching debate messages:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch messages' });
  }
});

// POST /api/debate-rooms/:id/messages - Send a message in a debate room
router.post('/:id/messages', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    const message = await debateService.sendMessage(req.params.id, userId, content.trim());
    
    // Get the room to find the opponent
    const room = await debateService.getDebateRoom(req.params.id);
    if (room) {
      const opponentId = room.participant1Id === userId ? room.participant2Id : room.participant1Id;
      if (opponentId) {
        // Get user info for the message
        const { UserRepository } = await import('../repositories/userRepository.js');
        const userRepo = new UserRepository();
        const sender = await userRepo.findById(userId);
        
        notifyNewDebateMessage(req.params.id, {
          id: message.id,
          roomId: message.roomId,
          userId: message.userId,
          content: message.content,
          createdAt: message.createdAt,
          senderName: sender?.displayName || sender?.email || 'Unknown',
        }, opponentId);
      }
    }

    res.json(message);
  } catch (error: any) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: error.message || 'Failed to send message' });
  }
});

// POST /api/debate-rooms/:id/end - End a debate room
router.post('/:id/end', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    await debateService.endDebateRoom(req.params.id);
    
    // Notify opponent
    const room = await debateService.getDebateRoom(req.params.id);
    if (room) {
      const opponentId = room.participant1Id === userId ? room.participant2Id : room.participant1Id;
      if (opponentId) {
        notifyDebateEnded(req.params.id, opponentId);
      }
    }
    
    res.json({ message: 'Debate ended successfully' });
  } catch (error: any) {
    console.error('Error ending debate:', error);
    res.status(500).json({ message: error.message || 'Failed to end debate' });
  }
});

// PATCH /api/debate-rooms/:id/mark-read - Mark debate room as read
router.patch('/:id/mark-read', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user!.id;
    await debateService.markRoomAsRead(req.params.id, userId);
    res.json({ message: 'Marked as read' });
  } catch (error: any) {
    console.error('Error marking room as read:', error);
    res.status(500).json({ message: error.message || 'Failed to mark as read' });
  }
});

export default router;

