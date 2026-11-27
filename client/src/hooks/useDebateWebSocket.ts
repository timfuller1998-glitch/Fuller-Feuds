import { setOpponentTyping, registerTypingSender } from '@/lib/typingStore';
import { useEffect, useRef, useCallback } from 'react';
import { useDebateContext } from '@/contexts/DebateContext';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

// Define discriminated union for type safety
type WebSocketMessage =
  | { type: 'authenticated'; userId: string }
  | { type: 'auth_error'; message: string }
  | { type: 'new_debate_message'; debateRoomId: string; message: any }
  | { type: 'user_notification'; notification: { title: string; body: string } }
  | { type: 'debate_ended'; debateRoomId: string }
  | { type: 'opponent_typing'; debateRoomId: string; isTyping: boolean; userId: string }
  | { type: 'new_debate_created'; debateRoomId: string; opponentName: string }
  | { type: 'debate_update'; debateRoomId: string; kind: string }
  | { type: 'notification'; notification: { id: string; type: string; title: string; message: string; debateRoomId?: string | null } };

export function useDebateWebSocket(userId?: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const authRejectedRef = useRef(false);
  const { incrementUnread, openWindows } = useDebateContext();
  const { toast } = useToast();
  
  // Store handlers in refs so they always have fresh context
  const handlersRef = useRef({
    incrementUnread,
    openWindows,
    toast
  });

  // Update refs when context changes
  useEffect(() => {
    handlersRef.current = {
      incrementUnread,
      openWindows,
      toast
    };
  }, [incrementUnread, openWindows, toast]);

  const handleNewMessage = useCallback((data: Extract<WebSocketMessage, { type: 'new_debate_message' }>) => {
    if (!data.debateRoomId || !data.message) return;

    // Use ref to get fresh state
    const { openWindows, incrementUnread, toast } = handlersRef.current;
    
    // Check if the debate window is open and not minimized
    const openWindow = openWindows.find(w => w.debateRoomId === data.debateRoomId);
    const isWindowOpen = openWindow && !openWindow.isMinimized;

    if (!isWindowOpen) {
      // Increment unread count
      incrementUnread(data.debateRoomId);
      
      // Show toast notification
      toast({
        title: data.message.senderName || 'New Message',
        description: data.message.content?.substring(0, 100) || 'You have a new debate message',
        duration: 3000,
      });
    }
  }, []);

  const handleNotification = useCallback((data: Extract<WebSocketMessage, { type: 'user_notification' }>) => {
    const { toast } = handlersRef.current;
    toast({
      title: data.notification.title || 'New Notification',
      description: data.notification.body || '',
      duration: 4000,
    });
  }, []);

  const handleDebateEnded = useCallback((data: Extract<WebSocketMessage, { type: 'debate_ended' }>) => {
    const { toast } = handlersRef.current;
    toast({
      title: 'Debate Ended',
      description: 'Your opponent has ended the debate. Rate their performance!',
      duration: 5000,
    });
  }, []);

  const handleNewDebateCreated = useCallback((data: Extract<WebSocketMessage, { type: 'new_debate_created' }>) => {
    const { toast } = handlersRef.current;
    
    // Invalidate debates query to fetch the new debate and update the footer
    queryClient.invalidateQueries({ queryKey: ['/api/debates/grouped'] });
    
    // Show toast notification
    toast({
      title: "New debate",
      description: `${data.opponentName} challenged you to a debate. Tap the green dot in your Debates bar to answer.`,
      duration: 4000,
    });
  }, []);

  const connect = useCallback(() => {
    if (!userId) return;
    // One socket per tab: don't open another while one is open or still connecting.
    const cur = wsRef.current;
    if (cur && (cur.readyState === WebSocket.OPEN || cur.readyState === WebSocket.CONNECTING)) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WebSocket] Connected');
      const wasReconnect = reconnectAttemptsRef.current > 0;
      reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection
      if (wasReconnect) {
        // Catch up on anything that happened while we were offline.
        queryClient.invalidateQueries({ queryKey: ['/api/debate-rooms'] });
        queryClient.invalidateQueries({ queryKey: ['/api/debates/grouped'] });
        queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      }
      
      // Authenticate - server expects authToken, which is the userId
      ws.send(JSON.stringify({
        type: 'authenticate',
        authToken: userId
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data);
        
        switch (data.type) {
          case 'authenticated':
            console.log('[WebSocket] Successfully authenticated');
            break;
          case 'debate_update': {
            // A debate I'm in changed (message, turn, accepted, ended, rated): refresh that room and my footer.
            const id = (data as any).debateRoomId;
            if (id) queryClient.invalidateQueries({ queryKey: ['/api/debate-rooms', id] });
            queryClient.invalidateQueries({ queryKey: ['/api/debates/grouped'] });
            queryClient.invalidateQueries({ queryKey: ['/api/debates/live'] });
            break;
          }
          case 'new_debate_message':
            if ((data as any).debateRoomId) setOpponentTyping((data as any).debateRoomId, '', false);
            handleNewMessage(data);
            break;
          case 'user_notification':
            handleNotification(data);
            break;
          case 'debate_ended':
            handleDebateEnded(data);
            break;
          case 'new_debate_created':
            handleNewDebateCreated(data);
            break;
          case 'notification': {
            // Persisted bell notification: refresh the bell and the affected room, and show a toast.
            const n = data.notification;
            // Their turn landed (or the debate ended) → they've stopped typing
            if (n?.debateRoomId) {
              const typer = (n as any).fromUserId ?? '';
              setOpponentTyping(n.debateRoomId, typer, false);
            }
            queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
            if (n?.debateRoomId) {
              queryClient.invalidateQueries({ queryKey: ['/api/debate-rooms', n.debateRoomId] });
            }
            queryClient.invalidateQueries({ queryKey: ['/api/debates/grouped'] });
            if (n && n.type !== 'new_debate') {
              handlersRef.current.toast({ title: n.title, description: n.message, duration: 4000 });
            }
            break;
          }
          case 'opponent_typing':
            // Feeds the footer avatar "…" bubble and the in-room typing bubble
            if ((data as any).debateRoomId && (data as any).userId) {
              setOpponentTyping((data as any).debateRoomId, (data as any).userId, (data as any).isTyping === true);
            }
            break;
          case 'auth_error': {
            console.error('[WebSocket] Authentication error:', data.message);
            const { toast } = handlersRef.current;
            toast({
              title: 'Connection Error',
              description: data.message || 'Failed to authenticate WebSocket connection',
              variant: 'destructive',
              duration: 5000,
            });
            // Don't reconnect on auth error - user needs to refresh/re-login
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
              reconnectTimeoutRef.current = undefined;
            }
            break;
          }
        }
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      console.error('[WebSocket] Connection details:', {
        url: wsUrl,
        readyState: ws.readyState,
        readyStateText: ws.readyState === WebSocket.CONNECTING ? 'CONNECTING' :
                        ws.readyState === WebSocket.OPEN ? 'OPEN' :
                        ws.readyState === WebSocket.CLOSING ? 'CLOSING' :
                        ws.readyState === WebSocket.CLOSED ? 'CLOSED' : 'UNKNOWN',
        reconnectAttempts: reconnectAttemptsRef.current
      });
      
      // Only show error toast after multiple failed attempts to avoid spam
      if (reconnectAttemptsRef.current === 2) {
        const { toast } = handlersRef.current;
        toast({
          title: 'Connection Error',
          description: 'Unable to connect to the server. Real-time features may be unavailable.',
          variant: 'destructive',
          duration: 5000,
        });
      }
    };

    ws.onclose = (event) => {
      if (wsRef.current !== ws) return; // a stale socket closing after we replaced it
      console.log('[WebSocket] Disconnected', {
        code: event.code,
        reason: event.reason || 'No reason provided',
        wasClean: event.wasClean,
        reconnectAttempts: reconnectAttemptsRef.current
      });
      
      wsRef.current = null;
      
      // Don't reconnect if it was a clean close or auth error
      if (event.code === 1008) authRejectedRef.current = true;
      if (event.code === 1000 || event.code === 1008) {
        console.log('[WebSocket] Clean close or policy violation, not reconnecting');
        reconnectAttemptsRef.current = 0;
        return;
      }
      
      // Keep reconnecting with backoff (3s, 6s, 12s … capped at 30s). Phones drop sockets when the tab sleeps
      // and every deploy restarts the server, so giving up after 5 tries left the chat silently dead.
      reconnectAttemptsRef.current++;
      const delay = Math.min(3000 * Math.pow(2, reconnectAttemptsRef.current - 1), 30000);
      if (reconnectAttemptsRef.current === maxReconnectAttempts) {
        console.error('[WebSocket] Still reconnecting after several attempts');
      }
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = undefined;
        connect();
      }, delay);
    };
  }, [userId, handleNewMessage, handleNotification, handleDebateEnded, handleNewDebateCreated]);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const sendTypingIndicator = useCallback((debateRoomId: string, isTyping: boolean) => {
    sendMessage({
      type: 'typing',
      debateRoomId,
      isTyping
    });
  }, [sendMessage]);

  useEffect(() => {
    return registerTypingSender(sendMessage);
  }, [sendMessage]);

  useEffect(() => {
    const wake = () => {
      if (document.visibilityState === 'hidden' || authRejectedRef.current) return;
      const cur = wsRef.current;
      if (cur && (cur.readyState === WebSocket.OPEN || cur.readyState === WebSocket.CONNECTING)) return;
      if (reconnectTimeoutRef.current) { clearTimeout(reconnectTimeoutRef.current); reconnectTimeoutRef.current = undefined; }
      connect();
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
    };
  }, [connect]);

  useEffect(() => {
    connect();

    // Proper cleanup on unmount or userId change
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
      }
      if (wsRef.current) {
        const old = wsRef.current;
        wsRef.current = null;
        old.close(1000);
      }
    };
  }, [connect]);

  return {
    sendMessage,
    sendTypingIndicator,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN
  };
}
