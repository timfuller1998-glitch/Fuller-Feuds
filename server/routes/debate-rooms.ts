import { Router } from 'express';
import { DebateService } from '../services/debateService.js';
import { isAuthenticated } from '../middleware/auth.js';
import { notifyNewDebateMessage, notifyDebateEnded, broadcastDebateUpdate } from '../websocket.js';
import { postDebateMessage, endDebate, submitRating, getVoteSummary, displayNameOf, FlowError, STRUCTURED_TURNS, respondToInvite, getRoomRaw } from '../lib/debateFlow.js';
import { isWatchable, spectatorRoom } from '../lib/debateWatch.js';
import { DebateRepository } from '../repositories/debateRepository.js';
import { UnauthorizedError, ForbiddenError, AuthorizationError, DataAccessError } from '../utils/securityErrors.js';

const router = Router();
const debateService = new DebateService();

/**
 * Who is asking about this room: a debater (or admin/moderator) gets the full room; anyone else may watch it
 * read-only when it's public and the invite was accepted. Returns null when they can't see it.
 */
async function viewerAccess(req: any, roomId: string): Promise<{ room: any; mode: 'participant' | 'spectator' } | null | 'missing'> {
  const room = await getRoomRaw(roomId);
  if (!room) return 'missing';
  const uid = (req.user as Express.User | undefined)?.id;
  const role = req.userRole || (req.user as any)?.role;
  if (uid && (room.participant1Id === uid || room.participant2Id === uid || role === 'admin' || role === 'moderator')) {
    return { room, mode: 'participant' };
  }
  if (isWatchable(room)) return { room, mode: 'spectator' };
  return null;
}

// GET /api/debate-rooms/:id - room details. Debaters get the full room; anyone may watch a public, accepted debate.
router.get('/:id', async (req, res) => {
  try {
    const access = await viewerAccess(req, req.params.id);
    if (access === 'missing') return res.status(404).json({ message: 'Debate room not found' });
    if (!access) {
      return req.user ? res.status(403).json({ message: 'This debate is private' }) : res.status(401).json({ error: 'Authentication required' });
    }
    if (access.mode === 'spectator') return res.json(spectatorRoom(access.room));
    const room = await debateService.getDebateRoom(req.params.id, req.user!.id, req.userRole, req);
    if (!room) return res.status(404).json({ message: 'Debate room not found' });
    res.json(room);
  } catch (error: any) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError || error instanceof AuthorizationError || error instanceof DataAccessError) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error('Error fetching debate room:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch debate room' });
  }
});

// GET /api/debate-rooms/:id/messages - messages (debaters, or spectators of a public accepted debate)
router.get('/:id/messages', async (req, res) => {
  try {
    const access = await viewerAccess(req, req.params.id);
    if (access === 'missing') return res.status(404).json({ message: 'Debate room not found' });
    if (!access) {
      return req.user ? res.status(403).json({ message: 'This debate is private' }) : res.status(401).json({ error: 'Authentication required' });
    }
    if (access.mode === 'spectator') {
      const all = await new DebateRepository().getDebateMessages(req.params.id);
      return res.json(all.filter((m: any) => (m.status || 'approved') !== 'hidden'));
    }
    const messages = await debateService.getMessages(req.params.id, req.user!.id, req.user!.id, req.userRole, req);
    res.json(messages);
  } catch (error: any) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError || error instanceof AuthorizationError || error instanceof DataAccessError) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error('Error fetching debate messages:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch messages' });
  }
});

// PATCH /api/debate-rooms/:id/privacy - a debater hides (private) or shows (public) the debate to spectators
router.patch('/:id/privacy', isAuthenticated, async (req, res) => {
  try {
    const privacy = req.body?.privacy;
    if (privacy !== 'public' && privacy !== 'private') return res.status(400).json({ message: "privacy must be 'public' or 'private'" });
    const room = await getRoomRaw(req.params.id);
    if (!room) return res.status(404).json({ message: 'Debate room not found' });
    if (room.participant1Id !== req.user!.id && room.participant2Id !== req.user!.id) return res.status(403).json({ message: 'Only the two debaters can change this' });
    await debateService.updateDebateRoomPrivacy(req.params.id, req.user!.id, privacy);
    broadcastDebateUpdate(req.params.id, [room.participant1Id, room.participant2Id], 'privacy');
    res.json(await getRoomRaw(req.params.id));
  } catch (error: any) {
    console.error('Error updating debate privacy:', error);
    res.status(500).json({ message: 'Failed to update privacy' });
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
router.get('/:id/votes', async (req, res) => {
  try {
    const access = await viewerAccess(req, req.params.id);
    if (access === 'missing') return res.status(404).json({ message: 'Debate room not found' });
    if (!access) return res.status(req.user ? 403 : 401).json({ message: 'This debate is private' });
    const summary = await getVoteSummary(req.params.id, req.user?.id);
    // Spectators only see scores once both debaters have rated.
    if (access.mode === 'spectator' && !summary.bothSubmitted) {
      return res.json({ bothSubmitted: false, myVoteSubmitted: false, structuredTurns: STRUCTURED_TURNS });
    }
    res.json({ ...summary, structuredTurns: STRUCTURED_TURNS });
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

