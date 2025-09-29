import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import UserAvatar from "./UserAvatar";
import { Send, Clock, Users } from "lucide-react";

interface DebateMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  timestamp: string;
  stance: "for" | "against";
}

interface DebateRoomProps {
  topicTitle: string;
  participant1: {
    id: string;
    name: string;
    avatar?: string;
    stance: "for" | "against";
    isOnline: boolean;
  };
  participant2: {
    id: string;
    name: string;
    avatar?: string;
    stance: "for" | "against";
    isOnline: boolean;
  };
  currentUserId: string;
  duration: string;
  messages: DebateMessage[];
  onSendMessage?: (content: string) => void;
  onEndDebate?: () => void;
}

export default function DebateRoom({
  topicTitle,
  participant1,
  participant2,
  currentUserId,
  duration,
  messages,
  onSendMessage,
  onEndDebate
}: DebateRoomProps) {
  const [messageInput, setMessageInput] = useState("");
  const [localMessages, setLocalMessages] = useState(messages);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentUser = participant1.id === currentUserId ? participant1 : participant2;
  const otherUser = participant1.id === currentUserId ? participant2 : participant1;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [localMessages]);

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;

    const newMessage: DebateMessage = {
      id: `msg-${Date.now()}`,
      userId: currentUserId,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      content: messageInput,
      timestamp: "Just now",
      stance: currentUser.stance
    };

    setLocalMessages(prev => [...prev, newMessage]);
    onSendMessage?.(messageInput);
    setMessageInput("");
    console.log('Message sent:', messageInput);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Card className="h-[600px] flex flex-col" data-testid="card-debate-room">
      <CardHeader className="pb-3 border-b">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg" data-testid="text-debate-topic">
              {topicTitle}
            </h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{duration}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <UserAvatar 
                  name={participant1.name} 
                  imageUrl={participant1.avatar}
                  size="sm" 
                  showOnlineStatus 
                  isOnline={participant1.isOnline}
                />
                <div>
                  <p className="font-medium text-sm">{participant1.name}</p>
                  <Badge variant={participant1.stance === "for" ? "default" : "destructive"} className="text-xs">
                    {participant1.stance === "for" ? "Supporting" : "Opposing"}
                  </Badge>
                </div>
              </div>
              
              <div className="text-muted-foreground">vs</div>
              
              <div className="flex items-center gap-2">
                <UserAvatar 
                  name={participant2.name} 
                  imageUrl={participant2.avatar}
                  size="sm" 
                  showOnlineStatus 
                  isOnline={participant2.isOnline}
                />
                <div>
                  <p className="font-medium text-sm">{participant2.name}</p>
                  <Badge variant={participant2.stance === "for" ? "default" : "destructive"} className="text-xs">
                    {participant2.stance === "for" ? "Supporting" : "Opposing"}
                  </Badge>
                </div>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                onEndDebate?.();
                console.log('End debate clicked');
              }}
              data-testid="button-end-debate"
            >
              End Debate
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="debate-messages">
          {localMessages.map((message) => {
            const isCurrentUser = message.userId === currentUserId;
            return (
              <div
                key={message.id}
                className={`flex gap-3 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                data-testid={`message-${message.id}`}
              >
                {!isCurrentUser && (
                  <UserAvatar name={message.userName} imageUrl={message.userAvatar} size="sm" />
                )}
                
                <div className={`max-w-[70%] ${isCurrentUser ? 'order-first' : ''}`}>
                  <div className={`rounded-lg p-3 ${
                    isCurrentUser 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted'
                  }`}>
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{message.userName}</span>
                    <span>•</span>
                    <span>{message.timestamp}</span>
                  </div>
                </div>
                
                {isCurrentUser && (
                  <UserAvatar name={message.userName} imageUrl={message.userAvatar} size="sm" />
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              placeholder="Type your response..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
              data-testid="input-debate-message"
            />
            <Button 
              onClick={handleSendMessage}
              disabled={!messageInput.trim()}
              data-testid="button-send-message"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}