import { useState, useCallback, useEffect } from "react";
import { useWebSocket, type WebSocketMessage } from "./useWebSocket";
import { useAuth } from "./useAuth";

export interface ChatMessage {
  type: 'chat_message';
  roomId: string;
  userId: string;
  content: string;
  timestamp: string;
}

export interface LiveVote {
  type: 'live_vote';
  roomId: string;
  userId: string;
  vote: 'for' | 'against' | 'neutral';
  timestamp: string;
}

export interface RoomParticipant {
  userId: string;
  joinedAt: string;
}

export interface DebateRoomState {
  roomId: string | null;
  isConnected: boolean;
  participantCount: number;
  messages: ChatMessage[];
  liveVotes: LiveVote[];
  participants: RoomParticipant[];
}

export function useDebateRoom() {
  const { user } = useAuth();
  const [roomState, setRoomState] = useState<DebateRoomState>({
    roomId: null,
    isConnected: false,
    participantCount: 0,
    messages: [],
    liveVotes: [],
    participants: []
  });

  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'room_joined':
        setRoomState(prev => ({
          ...prev,
          roomId: message.roomId,
          participantCount: message.participantCount,
          isConnected: true
        }));
        break;

      case 'user_joined':
        setRoomState(prev => ({
          ...prev,
          participantCount: message.participantCount,
          participants: [
            ...prev.participants,
            { userId: message.userId, joinedAt: new Date().toISOString() }
          ]
        }));
        break;

      case 'user_left':
        setRoomState(prev => ({
          ...prev,
          participantCount: message.participantCount,
          participants: prev.participants.filter(p => p.userId !== message.userId)
        }));
        break;

      case 'chat_message':
        setRoomState(prev => ({
          ...prev,
          messages: [...prev.messages, message as ChatMessage]
        }));
        break;

      case 'live_vote':
        setRoomState(prev => ({
          ...prev,
          liveVotes: [...prev.liveVotes, message as LiveVote]
        }));
        break;
    }
  }, []);

  const { isConnected, connectionState, connect, disconnect, sendMessage } = useWebSocket({
    onMessage: handleMessage,
    onConnect: () => {
      console.log('Connected to debate room WebSocket');
      // Process pending room join if there is one
      if (pendingRoomJoin) {
        sendMessage({
          type: 'join_room',
          roomId: pendingRoomJoin,
          userId: user?.id
        });
        setPendingRoomJoin(null);
      }
    },
    onDisconnect: () => {
      setRoomState(prev => ({
        ...prev,
        isConnected: false,
        roomId: null,
        participantCount: 0
      }));
    }
  });

  const [pendingRoomJoin, setPendingRoomJoin] = useState<string | null>(null);

  const joinRoom = useCallback((roomId: string) => {
    // Clear previous room state
    setRoomState(prev => ({
      ...prev,
      messages: [],
      liveVotes: [],
      participants: []
    }));

    if (isConnected) {
      // Socket is already connected, join immediately
      sendMessage({
        type: 'join_room',
        roomId,
        userId: user?.id
      });
      setPendingRoomJoin(null);
    } else {
      // Socket not connected yet, queue the join request
      setPendingRoomJoin(roomId);
      connect();
    }
  }, [isConnected, connect, sendMessage, user?.id]);

  const leaveRoom = useCallback(() => {
    sendMessage({ type: 'leave_room' });
    setRoomState(prev => ({
      ...prev,
      isConnected: false,
      roomId: null,
      participantCount: 0,
      messages: [],
      liveVotes: [],
      participants: []
    }));
  }, [sendMessage]);

  const sendChatMessage = useCallback((content: string) => {
    if (!roomState.roomId) return false;
    
    return sendMessage({
      type: 'chat_message',
      content
    });
  }, [roomState.roomId, sendMessage]);

  const castLiveVote = useCallback((vote: 'for' | 'against' | 'neutral') => {
    if (!roomState.roomId) return false;
    
    return sendMessage({
      type: 'live_vote',
      vote
    });
  }, [roomState.roomId, sendMessage]);

  useEffect(() => {
    return () => {
      if (roomState.isConnected) {
        leaveRoom();
      }
    };
  }, [roomState.isConnected, leaveRoom]);

  return {
    roomState,
    connectionState,
    joinRoom,
    leaveRoom,
    sendChatMessage,
    castLiveVote
  };
}