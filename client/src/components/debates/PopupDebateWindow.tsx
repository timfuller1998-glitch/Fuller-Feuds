import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Minimize2, X, Send, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useDebateContext } from '@/contexts/DebateContext';
import { useDebateWebSocket } from '@/hooks/useDebateWebSocket';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { get2DPoliticalCompassColor } from '@/lib/politicalColors';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  createdAt: string;
}

interface DebateRoom {
  id: string;
  topicId: string;
  topicTitle: string;
  participant1Id: string;
  participant2Id: string;
  participant1Name: string;
  participant2Name: string;
  status: string;
  currentTurn?: string | null;
}

interface PopupDebateWindowProps {
  debateRoomId: string;
  topicTitle: string;
  opponentName: string;
  opponentId: string;
  position?: { x: number; y: number };
}

export function PopupDebateWindow({ 
  debateRoomId, 
  topicTitle, 
  opponentName,
  opponentId,
  position: initialPosition
}: PopupDebateWindowProps) {
  const { user } = useAuth();
  const { minimizeDebateWindow, closeDebateWindow, updateWindowPosition, clearUnread } = useDebateContext();
  const [message, setMessage] = useState('');
  const [position, setPosition] = useState(initialPosition || { x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);

  // Fetch debate room details
  const { data: room } = useQuery<DebateRoom>({
    queryKey: ['/api/debate-rooms', debateRoomId],
  });

  // Fetch messages
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ['/api/debate-rooms', debateRoomId, 'messages'],
    refetchInterval: 3000,
  });

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest('POST', `/api/debate-rooms/${debateRoomId}/messages`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/debate-rooms', debateRoomId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/debates/grouped'] });
      setMessage('');
    },
  });

  // Mark as read
  useEffect(() => {
    if (messages.length > 0) {
      clearUnread(debateRoomId);
      apiRequest('PATCH', `/api/debate-rooms/${debateRoomId}/mark-read`, {})
        .catch(err => console.error('Failed to mark as read:', err));
    }
  }, [messages.length, debateRoomId, clearUnread]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (windowRef.current) {
      const rect = windowRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;
        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        updateWindowPosition(debateRoomId, position);
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, position, debateRoomId, updateWindowPosition]);

  const handleSend = () => {
    if (!message.trim() || sendMutation.isPending) return;
    sendMutation.mutate(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const avatarColor = get2DPoliticalCompassColor(0, 0);
  const isMyTurn = room?.currentTurn === user?.id;
  const canSend = !room || room.status === 'active';

  return (
    <div 
      ref={windowRef}
      className="fixed bg-card border rounded-lg shadow-2xl flex flex-col z-50"
      style={{ 
        left: `${position.x}px`, 
        top: `${position.y}px`,
        width: '400px',
        height: '500px'
      }}
      data-testid={`popup-${debateRoomId}`}
    >
      {/* Header - Draggable */}
      <div 
        className="flex items-center justify-between p-3 border-b bg-muted/30 cursor-move"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
          <Avatar className="w-8 h-8 border" style={{ borderColor: avatarColor }}>
            <AvatarFallback 
              style={{ 
                background: avatarColor,
                color: 'white'
              }}
            >
              {opponentName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{opponentName}</p>
            <p className="text-xs text-muted-foreground truncate">{topicTitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7"
            onClick={() => minimizeDebateWindow(debateRoomId)}
            data-testid="button-minimize"
          >
            <Minimize2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7"
            onClick={() => closeDebateWindow(debateRoomId)}
            data-testid="button-close"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-2"
      >
        {messages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === user?.id;
            return (
              <div 
                key={msg.id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[70%] rounded-lg px-3 py-2 ${
                    isMe 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm break-words">{msg.content}</p>
                  <p className={`text-xs mt-1 ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Turn Indicator */}
      {room && isMyTurn && canSend && (
        <div className="px-3 py-1 text-xs text-center bg-primary/10 text-primary border-t">
          Your turn to respond
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={canSend ? "Type a message..." : "Debate ended"}
            disabled={!canSend || sendMutation.isPending}
            className="flex-1 px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            data-testid="input-message"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!message.trim() || !canSend || sendMutation.isPending}
            data-testid="button-send"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
