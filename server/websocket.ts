import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { parse } from 'url';
import { log } from './vite.js';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAuthenticated?: boolean;
}

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

// Store connected clients by userId
const clientsByUserId = new Map<string, Set<AuthenticatedWebSocket>>();
// Store clients by WebSocket instance for quick lookup
const userIdBySocket = new Map<WebSocket, string>();

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
          const userId = message.authToken;
          
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

          log(`[WebSocket] User ${userId} authenticated`);

          // Send authentication confirmation
          ws.send(JSON.stringify({
            type: 'authenticated',
            userId: userId
          }));

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

        // Handle different message types
        switch (message.type) {
          case 'typing': {
            // Broadcast typing indicator to opponent in the debate room
            const { debateRoomId, isTyping } = message;
            if (debateRoomId && ws.userId) {
              // Get opponent ID from debate room
              try {
                const { DebateRepository } = await import('./repositories/debateRepository.js');
                const debateRepo = new DebateRepository();
                const room = await debateRepo.getDebateRoom(debateRoomId);
                
                if (room) {
                  const opponentId = room.participant1Id === ws.userId 
                    ? room.participant2Id 
                    : room.participant1Id;
                  
                  if (opponentId) {
                    sendToUser(opponentId, {
                      type: 'opponent_typing',
                      debateRoomId,
                      isTyping,
                      userId: ws.userId
                    });
                  }
                }
              } catch (error: any) {
                log(`[WebSocket] Error handling typing indicator: ${error.message}`, 'error');
              }
            }
            break;
          }

          case 'join_room': {
            // Handle room joining (for live streams)
            // This can be extended based on your needs
            log(`[WebSocket] User ${ws.userId} joined room ${message.roomId}`);
            break;
          }

          case 'leave_room': {
            // Handle room leaving
            log(`[WebSocket] User ${ws.userId} left room`);
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
    });
  });

  log('[WebSocket] Server initialized on /ws');

  return wss;
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

