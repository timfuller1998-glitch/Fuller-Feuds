import { useState, useCallback, useEffect } from "react";
import { useWebSocket, type WebSocketMessage } from "./useWebSocket";
import { useAuth } from "./useAuth";

export interface StreamUpdate {
  type: 'stream_update';
  roomId: string;
  status: 'live' | 'paused' | 'ended';
  timestamp: string;
}

export interface ModeratorAction {
  type: 'moderator_action';
  roomId: string;
  action: 'mute' | 'unmute' | 'kick' | 'pause_stream' | 'resume_stream' | 'end_stream';
  target?: string;
  moderatorId: string;
  timestamp: string;
}

export interface LiveStreamState {
  streamId: string | null;
  status: 'live' | 'paused' | 'ended' | 'connecting';
  isConnected: boolean;
  viewerCount: number;
  isModerator: boolean;
  chatMessages: any[];
  streamActions: ModeratorAction[];
}

export function useLiveStream() {
  const { user } = useAuth();
  const [pendingStreamJoin, setPendingStreamJoin] = useState<{ streamId: string; isModerator: boolean } | null>(null);
  const [streamState, setStreamState] = useState<LiveStreamState>({
    streamId: null,
    status: 'connecting',
    isConnected: false,
    viewerCount: 0,
    isModerator: false,
    chatMessages: [],
    streamActions: []
  });

  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'room_joined':
        setStreamState(prev => ({
          ...prev,
          streamId: message.roomId,
          isConnected: true,
          viewerCount: message.participantCount,
          status: 'live'
        }));
        break;

      case 'user_joined':
      case 'user_left':
        setStreamState(prev => ({
          ...prev,
          viewerCount: message.participantCount
        }));
        break;

      case 'chat_message':
        setStreamState(prev => ({
          ...prev,
          chatMessages: [...prev.chatMessages, message]
        }));
        break;

      case 'stream_update':
        setStreamState(prev => ({
          ...prev,
          status: message.status
        }));
        break;

      case 'moderator_action':
        setStreamState(prev => ({
          ...prev,
          streamActions: [...prev.streamActions, message as ModeratorAction]
        }));
        
        // Apply moderator action effects
        if (message.action === 'pause_stream') {
          setStreamState(prev => ({ ...prev, status: 'paused' }));
        } else if (message.action === 'resume_stream') {
          setStreamState(prev => ({ ...prev, status: 'live' }));
        } else if (message.action === 'end_stream') {
          setStreamState(prev => ({ ...prev, status: 'ended' }));
        }
        break;
    }
  }, []);

  const { isConnected, connectionState, connect, disconnect, sendMessage } = useWebSocket({
    onMessage: handleMessage,
    onConnect: () => {
      console.log('Connected to live stream WebSocket');
      // Process pending stream join if there is one
      if (pendingStreamJoin) {
        sendMessage({
          type: 'join_room',
          roomId: pendingStreamJoin.streamId,
          userId: user?.id,
          isModerator: pendingStreamJoin.isModerator
        });
        setPendingStreamJoin(null);
      }
    },
    onDisconnect: () => {
      setStreamState(prev => ({
        ...prev,
        isConnected: false,
        streamId: null,
        status: 'ended'
      }));
    }
  });

  const joinStream = useCallback((streamId: string, isModerator: boolean = false) => {
    setStreamState(prev => ({
      ...prev,
      chatMessages: [],
      streamActions: [],
      isModerator
    }));

    if (isConnected) {
      // Socket is already connected, join immediately
      sendMessage({
        type: 'join_room',
        roomId: streamId,
        userId: user?.id,
        isModerator
      });
      setPendingStreamJoin(null);
    } else {
      // Socket not connected yet, queue the join request
      setPendingStreamJoin({ streamId, isModerator });
      connect();
    }
  }, [isConnected, connect, sendMessage, user?.id]);

  const leaveStream = useCallback(() => {
    sendMessage({ type: 'leave_room' });
    setStreamState(prev => ({
      ...prev,
      isConnected: false,
      streamId: null,
      status: 'ended',
      viewerCount: 0,
      chatMessages: [],
      streamActions: []
    }));
  }, [sendMessage]);

  const sendStreamChat = useCallback((content: string) => {
    if (!streamState.streamId) return false;
    
    return sendMessage({
      type: 'chat_message',
      content
    });
  }, [streamState.streamId, sendMessage]);

  const performModeratorAction = useCallback((action: ModeratorAction['action'], target?: string) => {
    if (!streamState.isModerator || !streamState.streamId) return false;
    
    return sendMessage({
      type: 'moderator_action',
      action,
      target
    });
  }, [streamState.isModerator, streamState.streamId, sendMessage]);

  const updateStreamStatus = useCallback((status: 'live' | 'paused' | 'ended') => {
    if (!streamState.isModerator || !streamState.streamId) return false;
    
    return sendMessage({
      type: 'stream_update',
      status
    });
  }, [streamState.isModerator, streamState.streamId, sendMessage]);

  useEffect(() => {
    return () => {
      if (streamState.isConnected) {
        leaveStream();
      }
    };
  }, [streamState.isConnected, leaveStream]);

  return {
    streamState,
    connectionState,
    joinStream,
    leaveStream,
    sendStreamChat,
    performModeratorAction,
    updateStreamStatus
  };
}