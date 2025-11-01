import { useEffect, useRef, useCallback } from 'react';
import { useDebateContext } from '@/contexts/DebateContext';
import { useToast } from '@/hooks/use-toast';

interface WebSocketMessage {
  type: string;
  debateRoomId?: string;
  message?: any;
  notification?: any;
  [key: string]: any;
}

export function useDebateWebSocket(userId?: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const { incrementUnread, openWindows } = useDebateContext();
  const { toast } = useToast();

  const connect = useCallback(() => {
    if (!userId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WebSocket] Connected');
      
      // Authenticate
      ws.send(JSON.stringify({
        type: 'authenticate',
        userId
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data);
        
        switch (data.type) {
          case 'new_debate_message':
            handleNewMessage(data);
            break;
          case 'user_notification':
            handleNotification(data);
            break;
          case 'debate_ended':
            handleDebateEnded(data);
            break;
          case 'opponent_typing':
            // Handle typing indicator in chat components
            break;
          default:
            console.log('[WebSocket] Unknown message type:', data.type);
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
  }, [userId]);

  const handleNewMessage = (data: WebSocketMessage) => {
    if (!data.debateRoomId || !data.message) return;

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
  };

  const handleNotification = (data: WebSocketMessage) => {
    if (!data.notification) return;

    toast({
      title: data.notification.title || 'New Notification',
      description: data.notification.body || '',
      duration: 4000,
    });
  };

  const handleDebateEnded = (data: WebSocketMessage) => {
    toast({
      title: 'Debate Ended',
      description: 'Your opponent has ended the debate. Rate their performance!',
      duration: 5000,
    });
  };

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

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    sendMessage,
    sendTypingIndicator,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN
  };
}
