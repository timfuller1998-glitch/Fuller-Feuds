import { useState, useEffect, useRef } from "react";
import { useDebateRoom } from "@/hooks/useDebateRoom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Users, 
  MessageCircle, 
  ThumbsUp, 
  ThumbsDown, 
  Minus,
  Send,
  Wifi,
  WifiOff
} from "lucide-react";

interface LiveDebateRoomProps {
  topicId: string;
  topicTitle: string;
  onClose?: () => void;
}

export default function LiveDebateRoom({ topicId, topicTitle, onClose }: LiveDebateRoomProps) {
  const [chatInput, setChatInput] = useState("");
  const [selectedVote, setSelectedVote] = useState<'for' | 'against' | 'neutral' | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const {
    roomState,
    connectionState,
    joinRoom,
    leaveRoom,
    sendChatMessage,
    castLiveVote
  } = useDebateRoom();

  useEffect(() => {
    joinRoom(`topic-${topicId}`);
    return () => leaveRoom();
  }, [topicId, joinRoom, leaveRoom]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [roomState.messages]);

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    
    if (sendChatMessage(chatInput)) {
      setChatInput("");
    }
  };

  const handleVote = (vote: 'for' | 'against' | 'neutral') => {
    if (castLiveVote(vote)) {
      setSelectedVote(vote);
    }
  };

  const getVoteCount = (voteType: 'for' | 'against' | 'neutral') => {
    return roomState.liveVotes.filter(vote => vote.vote === voteType).length;
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Main Debate Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{topicTitle}</h1>
              <Badge variant="secondary" className="flex items-center gap-1">
                {connectionState === 'connected' ? (
                  <>
                    <Wifi className="w-3 h-3" />
                    Live
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3" />
                    {connectionState === 'connecting' ? 'Connecting...' : 'Disconnected'}
                  </>
                )}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {roomState.participantCount} participants
              </Badge>
              {onClose && (
                <Button variant="outline" onClick={onClose}>
                  Leave Room
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Live Voting Panel */}
        <div className="border-b p-4">
          <h3 className="font-semibold mb-3">Live Sentiment</h3>
          <div className="grid grid-cols-3 gap-4">
            <Button
              variant={selectedVote === 'for' ? 'default' : 'outline'}
              onClick={() => handleVote('for')}
              className="flex items-center gap-2"
              data-testid="vote-for"
            >
              <ThumbsUp className="w-4 h-4" />
              Support ({getVoteCount('for')})
            </Button>
            <Button
              variant={selectedVote === 'against' ? 'default' : 'outline'}
              onClick={() => handleVote('against')}
              className="flex items-center gap-2"
              data-testid="vote-against"
            >
              <ThumbsDown className="w-4 h-4" />
              Oppose ({getVoteCount('against')})
            </Button>
            <Button
              variant={selectedVote === 'neutral' ? 'default' : 'outline'}
              onClick={() => handleVote('neutral')}
              className="flex items-center gap-2"
              data-testid="vote-neutral"
            >
              <Minus className="w-4 h-4" />
              Neutral ({getVoteCount('neutral')})
            </Button>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Live Discussion
            </h3>
            <Badge variant="secondary">
              {roomState.messages.length} messages
            </Badge>
          </div>
          
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {roomState.messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                roomState.messages.map((message, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {message.userId.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {message.userId}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm">{message.content}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Message Input */}
          <div className="border-t p-4">
            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Share your thoughts..."
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                disabled={!roomState.isConnected}
                data-testid="input-chat-message"
              />
              <Button 
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || !roomState.isConnected}
                data-testid="button-send-message"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar - Participants & Live Votes */}
      <div className="w-80 border-l bg-muted/20">
        <div className="p-4">
          <h3 className="font-semibold mb-4">Live Activity</h3>
          
          {/* Recent Votes */}
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Recent Votes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {roomState.liveVotes.slice(-5).reverse().map((vote, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="truncate">{vote.userId}</span>
                  <Badge 
                    variant={
                      vote.vote === 'for' ? 'default' : 
                      vote.vote === 'against' ? 'destructive' : 'secondary'
                    }
                    className="text-xs"
                  >
                    {vote.vote}
                  </Badge>
                </div>
              ))}
              {roomState.liveVotes.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  No votes yet
                </p>
              )}
            </CardContent>
          </Card>

          {/* Participants */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                Participants ({roomState.participantCount})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {roomState.participants.map((participant, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {participant.userId.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{participant.userId}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}