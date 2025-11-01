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
  | { type: 'new_debate_created'; debateRoomId: string; opponentName: string };

export function useDebateWebSocket(userId?: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
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
    console.log('[WebSocket] Received new_debate_created event:', data);
    const { toast } = handlersRef.current;
    
    // Invalidate debates query to fetch the new debate and update the footer
    console.log('[WebSocket] Invalidating debates query');
    queryClient.invalidateQueries({ queryKey: ['/api/debates/grouped'] });
    
    // Show toast notification
    console.log('[WebSocket] Showing toast notification');
    toast({
      title: 'New Debate Started!',
      description: `Your debate with ${data.opponentName} is ready. Check the footer to start chatting!`,
      duration: 4000,
    });
  }, []);

  const connect = useCallback(() => {
    if (!userId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WebSocket] Connected');
      
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
          case 'new_debate_message':
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
          case 'opponent_typing':
            // Handle typing indicator in chat components
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
    };

    ws.onclose = () => {
      console.log('[WebSocket] Disconnected');
      wsRef.current = null;
      
      // Attempt to reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('[WebSocket] Attempting to reconnect...');
        connect();
      }, 3000);
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
    connect();

    // Proper cleanup on unmount or userId change
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return {
    sendMessage,
    sendTypingIndicator,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN
  };
}
