import { Router } from 'express';
import { DebateService } from '../services/debateService.js';
import { isAuthenticated } from '../middleware/auth.js';
import { notifyNewDebateMessage, notifyDebateEnded } from '../websocket.js';
import { postDebateMessage, endDebate, submitRating, getVoteSummary, displayNameOf, FlowError, STRUCTURED_TURNS, respondToInvite } from '../lib/debateFlow.js';
import { UnauthorizedError, ForbiddenError, AuthorizationError, DataAccessError } from '../utils/securityErrors.js';

const router = Router();
const debateService = new DebateService();

// GET /api/debate-rooms/:id - Get debate room details
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const requestingUserId = (req.user as Express.User)?.id;
    if (!requestingUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const requestingUserRole = req.userRole;
    const room = await debateService.getDebateRoom(
      req.params.id,
      requestingUserId,
      requestingUserRole,
      req
    );
    if (!room) {
      return res.status(404).json({ message: 'Debate room not found' });
    }
    res.json(room);
  } catch (error: any) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError || error instanceof AuthorizationError || error instanceof DataAccessError) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error('Error fetching debate room:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch debate room' });
  }
});

// GET /api/debate-rooms/:id/messages - Get messages for a debate room
router.get('/:id/messages', isAuthenticated, async (req, res) => {
  try {
    const requestingUserId = (req.user as Express.User)?.id;
    if (!requestingUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const requestingUserRole = req.userRole;
    const messages = await debateService.getMessages(
      req.params.id,
      requestingUserId,
      requestingUserId,
      requestingUserRole,
      req
    );
    res.json(messages);
  } catch (error: any) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError || error instanceof AuthorizationError || error instanceof DataAccessError) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error('Error fetching debate messages:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch messages' });
  }
});

// POST /api/debate-rooms/:id/messages - Send a message in a debate room
router.post('/:id/messages', isAuthenticated, async (req, res) => {
  try {
    const requestingUserId = (req.user as Express.User)?.id;
    if (!requestingUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const requestingUserRole = req.userRole;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    const { message, opponentId } = await postDebateMessage(req.params.id, requestingUserId, content.trim(), requestingUserRole, req);
    if (opponentId) {
      notifyNewDebateMessage(req.params.id, {
        id: message.id,
        roomId: message.roomId,
        userId: message.userId,
        content: message.content,
        createdAt: message.createdAt,
        senderName: await displayNameOf(requestingUserId),
      }, opponentId);
    }

    res.json(message);
  } catch (error: any) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError || error instanceof AuthorizationError || error instanceof DataAccessError) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    if (error instanceof FlowError) return res.status(error.status).json({ message: error.message });
    console.error('Error sending message:', error);
    res.status(500).json({ message: error.message || 'Failed to send message' });
  }
});

// POST /api/debate-rooms/:id/end - End a debate room
router.post('/:id/end', isAuthenticated, async (req, res) => {
  try {
    const requestingUserId = (req.user as Express.User)?.id;
    if (!requestingUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const requestingUserRole = req.userRole;
    
    const room = await endDebate(req.params.id, requestingUserId);
    const opponentId = room.participant1Id === requestingUserId ? room.participant2Id : room.participant1Id;
    if (opponentId) notifyDebateEnded(req.params.id, opponentId);

    res.json({ message: 'Debate ended successfully' });
  } catch (error: any) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError || error instanceof AuthorizationError || error instanceof DataAccessError) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    if (error instanceof FlowError) return res.status(error.status).json({ message: error.message });
    console.error('Error ending debate:', error);
    res.status(500).json({ message: error.message || 'Failed to end debate' });
  }
});

// POST /api/debate-rooms/:id/invite/(accept|decline|withdraw) - answer a pending debate invite
router.post('/:id/invite/:action', isAuthenticated, async (req, res) => {
  const action = req.params.action;
  if (action !== 'accept' && action !== 'decline' && action !== 'withdraw') return res.status(404).json({ message: 'Unknown action' });
  try {
    const room = await respondToInvite(req.params.id, req.user!.id, action);
    res.json(room);
  } catch (error: any) {
    if (error instanceof FlowError) return res.status(error.status).json({ message: error.message });
    console.error('Error answering invite:', error);
    res.status(500).json({ message: 'Failed to answer invite' });
  }
});

// PATCH /api/debate-rooms/:id/mark-read - Mark debate room as read
router.patch('/:id/mark-read', isAuthenticated, async (req, res) => {
  try {
    const requestingUserId = (req.user as Express.User)?.id;
    if (!requestingUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    // Note: markRoomAsRead doesn't have security context parameters yet, but we still handle errors
    await debateService.markRoomAsRead(req.params.id, requestingUserId);
    res.json({ message: 'Marked as read' });
  } catch (error: any) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError || error instanceof AuthorizationError || error instanceof DataAccessError) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error('Error marking room as read:', error);
    res.status(500).json({ message: error.message || 'Failed to mark as read' });
  }
});

// GET /api/debate-rooms/:id/votes - ratings for this debate (hidden from a debater until both have rated)
router.get('/:id/votes', isAuthenticated, async (req, res) => {
  try {
    res.json({ ...(await getVoteSummary(req.params.id, req.user!.id)), structuredTurns: STRUCTURED_TURNS });
  } catch (error: any) {
    if (error instanceof FlowError) return res.status(error.status).json({ message: error.message });
    console.error('Error fetching votes:', error);
    res.status(500).json({ message: 'Failed to fetch votes' });
  }
});

// POST /api/debate-rooms/:id/vote - rate your opponent at the end of the debate
router.post('/:id/vote', isAuthenticated, async (req, res) => {
  try {
    const voteResults = await submitRating(req.params.id, req.user!.id, req.body);
    res.json({ voteResults });
  } catch (error: any) {
    if (error instanceof FlowError) return res.status(error.status).json({ message: error.message });
    console.error('Error submitting vote:', error);
    res.status(500).json({ message: 'Failed to submit rating' });
  }
});

export default router;

