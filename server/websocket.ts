import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { parse } from 'url';
import { log } from './vite.js';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAuthenticated?: boolean;
  isAlive?: boolean;
}

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

// Store connected clients by userId
const clientsByUserId = new Map<string, Set<AuthenticatedWebSocket>>();
// Store clients by WebSocket instance for quick lookup
const userIdBySocket = new Map<WebSocket, string>();
// Presence tracking (in-memory)
const typingLastSent = new Map<string, number>();
const lastActiveAtByUserId = new Map<string, number>();
// Live viewing (Nov 20 2026): sockets watching a debate room, signed in or not. Read-only.
// The boolean says whether the socket counts as a spectator (debaters keep the page open too but aren't counted).
const watchersByRoom = new Map<string, Map<WebSocket, boolean>>();
const roomsBySocket = new Map<WebSocket, Set<string>>();

function stopWatching(ws: WebSocket, roomId?: string) {
  const rooms = roomsBySocket.get(ws);
  if (!rooms) return;
  for (const id of roomId ? [roomId] : Array.from(rooms)) {
    rooms.delete(id);
    const set = watchersByRoom.get(id);
    if (set) {
      set.delete(ws);
      if (set.size === 0) watchersByRoom.delete(id);
      sendWatcherCount(id);
    }
  }
  if (rooms.size === 0) roomsBySocket.delete(ws);
}

function sendWatcherCount(roomId: string) {
  const set = watchersByRoom.get(roomId);
  if (!set) return;
  let count = 0;
  set.forEach((counts) => { if (counts) count++; });
  const msg = JSON.stringify({ type: 'debate_viewers', debateRoomId: roomId, count });
  set.forEach((_c, sock) => { if (sock.readyState === WebSocket.OPEN) sock.send(msg); });
}

let sessionMw: any = null;
async function resolveSessionUserId(req: IncomingMessage): Promise<string | null> {
  try {
    if (!sessionMw) {
      const { getSession } = await import('./auth.js');
      sessionMw = getSession();
    }
    await new Promise<void>((resolve) => sessionMw(req as any, {} as any, () => resolve()));
    const uid = (req as any).session?.passport?.user;
    return typeof uid === 'string' && uid ? uid : null;
  } catch (e) {
    log(`[WebSocket] session lookup failed: ${(e as Error).message}`);
    return null;
  }
}

export function setupWebSocketServer(server: any) {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws',
    verifyClient: (info: { origin: string; secure: boolean; req: IncomingMessage }) => {
      // Allow connections from same origin
      // In production, you might want to add origin validation
      return true;
    }
  });

  wss.on('connection', (ws: AuthenticatedWebSocket, req: IncomingMessage) => {
    const url = parse(req.url || '', true);
    log(`[WebSocket] New connection from ${req.socket.remoteAddress}`);

    ws.isAuthenticated = false;

    ws.on('message', async (data: Buffer) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());

        // Handle authentication
        if (message.type === 'authenticate') {
          // Trust only the signed session cookie sent with the upgrade request, never a client-supplied id
          // (previously any client could claim any userId and receive that user's notifications).
          const userId = await resolveSessionUserId(req);
          
          if (!userId || typeof userId !== 'string') {
            ws.send(JSON.stringify({
              type: 'auth_error',
              message: 'Invalid authentication token'
            }));
            ws.close(1008, 'Invalid authentication');
            return;
          }

          // Authenticate the socket
          ws.userId = userId;
          ws.isAuthenticated = true;

          // Add to clients map
          if (!clientsByUserId.has(userId)) {
            clientsByUserId.set(userId, new Set());
          }
          clientsByUserId.get(userId)!.add(ws);
          userIdBySocket.set(ws, userId);
          lastActiveAtByUserId.set(userId, Date.now());

          log(`[WebSocket] User ${userId} authenticated`);

          // Send authentication confirmation
          ws.send(JSON.stringify({
            type: 'authenticated',
            userId: userId
          }));

          return;
        }

        // Watch a debate live (allowed before sign-in). Only public, accepted debates — or your own.
        if (message.type === 'watch_debate' || message.type === 'unwatch_debate') {
          const roomId = message.debateRoomId;
          if (typeof roomId !== 'string' || roomId.length > 64) return;
          if (message.type === 'unwatch_debate') { stopWatching(ws, roomId); return; }
          const { getRoomRaw } = await import('./lib/debateFlow.js');
          const { isWatchable } = await import('./lib/debateWatch.js');
          const room = await getRoomRaw(roomId).catch(() => undefined);
          // A debater's own page can always follow their room (verified from the session cookie, not trusted from the client).
          let debater = false;
          if (room && message.asDebater === true) {
            const uid = ws.userId || await resolveSessionUserId(req);
            debater = !!uid && (room.participant1Id === uid || room.participant2Id === uid);
          }
          if (!room || (!debater && !isWatchable(room))) {
            ws.send(JSON.stringify({ type: 'watch_error', debateRoomId: roomId, message: 'This debate is not open to watch' }));
            return;
          }
          if (!watchersByRoom.has(roomId)) watchersByRoom.set(roomId, new Map());
          watchersByRoom.get(roomId)!.set(ws, !debater);
          if (!roomsBySocket.has(ws)) roomsBySocket.set(ws, new Set());
          roomsBySocket.get(ws)!.add(roomId);
          ws.send(JSON.stringify({ type: 'watching', debateRoomId: roomId }));
          sendWatcherCount(roomId);
          return;
        }

        // Require authentication for all other messages
        if (!ws.isAuthenticated || !ws.userId) {
          ws.send(JSON.stringify({
            type: 'auth_error',
            message: 'Not authenticated'
          }));
          return;
        }

        // Mark user as active on any authenticated message
        lastActiveAtByUserId.set(ws.userId, Date.now());

        // Handle different message types
        switch (message.type) {
          case 'typing': {
            // Relay a typing start/stop to the opponent. Only a participant of an active
            // (structured-phase) room may send it; server-side throttle of 1 start per second per room.
            const { debateRoomId } = message;
            const isTyping = message.isTyping === true;
            if (typeof debateRoomId !== 'string' || !ws.userId) break;
            const key = `${ws.userId}:${debateRoomId}`;
            const now = Date.now();
            if (isTyping && now - (typingLastSent.get(key) ?? 0) < 1000) break;
            try {
              const { DebateRepository } = await import('./repositories/debateRepository.js');
              const room = await new DebateRepository().getDebateRoom(debateRoomId);
              if (!room) break;
              const isParticipant = room.participant1Id === ws.userId || room.participant2Id === ws.userId;
              if (!isParticipant || room.status !== 'active' || room.phase === 'voting') break;
              const opponentId = room.participant1Id === ws.userId ? room.participant2Id : room.participant1Id;
              if (!opponentId) break;
              if (isTyping) typingLastSent.set(key, now); else typingLastSent.delete(key);
              sendToUser(opponentId, { type: 'opponent_typing', debateRoomId, isTyping, userId: ws.userId });
              sendToWatchers(debateRoomId, { type: 'debate_typing', debateRoomId, isTyping, userId: ws.userId }, [opponentId, ws.userId]);
            } catch (error: any) {
              log(`[WebSocket] Error handling typing indicator: ${error.message}`, 'error');
            }
            break;
          }

          default:
            log(`[WebSocket] Unknown message type: ${message.type}`);
        }
      } catch (error: any) {
        log(`[WebSocket] Error processing message: ${error.message}`, 'error');
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Failed to process message'
        }));
      }
    });

    ws.on('close', () => {
      stopWatching(ws);
      const userId = userIdBySocket.get(ws);
      if (userId) {
        const userClients = clientsByUserId.get(userId);
        if (userClients) {
          userClients.delete(ws);
          if (userClients.size === 0) {
            clientsByUserId.delete(userId);
          }
        }
        userIdBySocket.delete(ws);
        lastActiveAtByUserId.set(userId, Date.now());
        log(`[WebSocket] User ${userId} disconnected`);
      }
    });

    ws.on('error', (error: Error) => {
      log(`[WebSocket] Error: ${error.message}`, 'error');
    });

    // Send ping to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.isAlive === false) {
        clearInterval(pingInterval);
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    }, 30000);

    ws.on('pong', () => {
      ws.isAlive = true;
      if (ws.userId) {
        lastActiveAtByUserId.set(ws.userId, Date.now());
      }
    });
  });

  log('[WebSocket] Server initialized on /ws');

  return wss;
}

export function getPresenceForUserIds(userIds: string[]) {
  return userIds.map((userId) => {
    const isOnline = (clientsByUserId.get(userId)?.size || 0) > 0;
    const lastActiveAt = lastActiveAtByUserId.get(userId) || null;
    return { userId, isOnline, lastActiveAt };
  });
}

// Helper function to broadcast to opponent in a debate room
// This will be called with the room data to find the opponent
export async function broadcastToDebateRoomOpponent(
  debateRoomId: string, 
  senderId: string, 
  message: any,
  getOpponentId: (roomId: string, senderId: string) => Promise<string | null>
) {
  try {
    const opponentId = await getOpponentId(debateRoomId, senderId);
    if (opponentId) {
      sendToUser(opponentId, message);
    }
  } catch (error: any) {
    log(`[WebSocket] Error broadcasting to debate room ${debateRoomId}: ${error.message}`, 'error');
  }
}

// Send message to a specific user
export function sendToUser(userId: string, message: any) {
  const clients = clientsByUserId.get(userId);
  if (clients) {
    const messageStr = JSON.stringify(message);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }
}

// Broadcast message to multiple users
export function broadcastToUsers(userIds: string[], message: any) {
  userIds.forEach(userId => sendToUser(userId, message));
}

/** Send to everyone watching a room, skipping sockets that belong to `skipUserIds` (they get their own event). */
export function sendToWatchers(roomId: string, message: any, skipUserIds: string[] = []) {
  const set = watchersByRoom.get(roomId);
  if (!set) return;
  const str = JSON.stringify(message);
  set.forEach((_counts, c) => {
    const uid = userIdBySocket.get(c);
    if (uid && skipUserIds.includes(uid)) return;
    if (c.readyState === WebSocket.OPEN) c.send(str);
  });
}

/**
 * Something changed in a debate (new message, turn, accepted, ended, rated). Tells the two debaters and
 * everyone watching so their open room refreshes live. `kind` is informational.
 */
export function broadcastDebateUpdate(roomId: string, participantIds: (string | null | undefined)[], kind: string) {
  const msg = { type: 'debate_update', debateRoomId: roomId, kind };
  const ids = participantIds.filter(Boolean) as string[];
  ids.forEach((u) => sendToUser(u, msg));
  sendToWatchers(roomId, msg, ids);
}

// Send notification when a new debate message is created
export function notifyNewDebateMessage(debateRoomId: string, message: any, recipientUserId: string) {
  sendToUser(recipientUserId, {
    type: 'new_debate_message',
    debateRoomId,
    message
  });
}

// Send notification when a debate is created
export function notifyNewDebateCreated(debateRoomId: string, opponentName: string, recipientUserId: string) {
  sendToUser(recipientUserId, {
    type: 'new_debate_created',
    debateRoomId,
    opponentName
  });
}

// Send notification when a debate ends
export function notifyDebateEnded(debateRoomId: string, recipientUserId: string) {
  sendToUser(recipientUserId, {
    type: 'debate_ended',
    debateRoomId
  });
}

// Send user notification
export function sendUserNotification(userId: string, notification: { title: string; body: string }) {
  sendToUser(userId, {
    type: 'user_notification',
    notification
  });
}


// Persisted, real-time notification (bell). Stored in `notifications` and pushed as `notification`.
export function pushNotification(userId: string, notification: any) {
  sendToUser(userId, { type: 'notification', notification });
}
