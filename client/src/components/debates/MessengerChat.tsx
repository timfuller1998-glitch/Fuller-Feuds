import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Minimize2, Maximize2, X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
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

interface MessengerChatProps {
  debateRoomId: string;
  topicTitle: string;
  opponentName: string;
  opponentId: string;
  onExpand: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

export function MessengerChat({ 
  debateRoomId, 
  topicTitle, 
  opponentName,
  opponentId,
  onExpand,
  onMinimize, 
  onClose 
}: MessengerChatProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { sendTypingIndicator } = useDebateWebSocket(user?.id);
  const { clearUnread } = useDebateContext();

  // Fetch debate room details
  const { data: room } = useQuery<DebateRoom>({
    queryKey: ['/api/debate-rooms', debateRoomId],
  });

  // Fetch messages
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ['/api/debate-rooms', debateRoomId, 'messages'],
    refetchInterval: 3000, // Poll every 3 seconds
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

  // Mark as read when messages change
  useEffect(() => {
    if (messages.length > 0) {
      clearUnread(debateRoomId);
      apiRequest('PATCH', `/api/debate-rooms/${debateRoomId}/mark-read`, {})
        .catch(err => console.error('Failed to mark as read:', err));
    }
  }, [messages.length, debateRoomId, clearUnread]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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

  // Get opponent political color
  const avatarColor = get2DPoliticalCompassColor(0, 0); // You can pass actual scores if available

  const isMyTurn = room?.currentTurn === user?.id;
  const canSend = !room || room.status === 'active';

  return (
    <div 
      className="fixed bottom-0 right-4 w-80 bg-card border rounded-t-lg shadow-xl flex flex-col z-40"
      style={{ height: '400px' }}
      data-testid={`chat-${debateRoomId}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2 flex-1 min-w-0">
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
            onClick={onExpand}
            data-testid="button-expand-chat"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7"
            onClick={onMinimize}
            data-testid="button-minimize-chat"
          >
            <Minimize2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7"
            onClick={onClose}
            data-testid="button-close-chat"
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
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
