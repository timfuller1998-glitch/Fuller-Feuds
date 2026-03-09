import { useState, useEffect, useRef } from "react";
import { useDebateRoom } from "@/hooks/useDebateRoom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Users, 
  MessageCircle, 
  ThumbsUp, 
  ThumbsDown, 
  Minus,
  Send,
  Wifi,
  WifiOff,
  MoreVertical,
  Shield,
  Volume2,
  VolumeX,
  UserX,
  Ban,
  Play,
  Pause,
  Square,
  Heart,
  Smile,
  Settings,
  ArrowLeft
} from "lucide-react";

interface LiveDebateRoomProps {
  topicId: string;
  topicTitle: string;
  onClose?: () => void;
}

export default function LiveDebateRoom({ topicId, topicTitle, onClose }: LiveDebateRoomProps) {
  const { user } = useAuth();
  const [chatInput, setChatInput] = useState("");
  const [selectedVote, setSelectedVote] = useState<'for' | 'against' | 'neutral' | null>(null);
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<'live' | 'paused' | 'ended'>('live');
  const [isModerator, setIsModerator] = useState(false);
  const [activeTab, setActiveTab] = useState('discussion');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const {
    roomState,
    connectionState,
    joinRoom,
    leaveRoom,
    sendChatMessage,
    castLiveVote,
    sendModeratorAction
  } = useDebateRoom();

  useEffect(() => {
    joinRoom(`topic-${topicId}`);
    return () => leaveRoom();
  }, [topicId, joinRoom, leaveRoom]);

  // Check moderator status - for testing, make user moderator if they're alone or for demo purposes
  useEffect(() => {
    // For demo purposes, user is moderator if they are the first participant or specific user
    // TODO: Replace with proper role checking from backend
    const shouldBeModerator = roomState.participantCount <= 1 || 
                             user?.email?.includes('moderator') || 
                             user?.id === '48100778'; // Demo user
    setIsModerator(shouldBeModerator);
  }, [roomState.participantCount, user]);

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

  const handleReaction = (reaction: string) => {
    setSelectedReaction(reaction);
    
    // Broadcast reaction to other participants via WebSocket
    if (sendModeratorAction) {
      sendModeratorAction({
        action: 'reaction',
        target: user?.id,
        roomId: `topic-${topicId}`,
        data: { 
          reaction,
          userId: user?.id,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    setTimeout(() => setSelectedReaction(null), 2000);
  };

  const handleModeratorAction = (action: string, targetUserId?: string, messageData?: any) => {
    if (!isModerator && !['reaction'].includes(action)) return;
    
    if (sendModeratorAction) {
      const actionPayload: any = {
        action,
        target: targetUserId,
        roomId: `topic-${topicId}`
      };
      
      // Include message data for message-specific actions
      if (messageData && action === 'delete_message') {
        actionPayload.messageData = messageData;
      }
      
      sendModeratorAction(actionPayload);
    }
    
    // Update local state for stream controls
    if (action === 'pause_stream') {
      setStreamStatus('paused');
    } else if (action === 'resume_stream') {
      setStreamStatus('live');
    } else if (action === 'end_stream') {
      setStreamStatus('ended');
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Main Debate Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {onClose && (
                <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-back">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              )}
              <h1 className="text-2xl font-bold">{topicTitle}</h1>
              <Badge 
                variant={streamStatus === 'live' ? 'default' : streamStatus === 'paused' ? 'secondary' : 'destructive'} 
                className="flex items-center gap-1"
              >
                {connectionState === 'connected' ? (
                  <>
                    <Wifi className="w-3 h-3" />
                    {streamStatus.charAt(0).toUpperCase() + streamStatus.slice(1)}
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
              
              {/* Moderator Controls */}
              {isModerator && (
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="button-moderator-controls">
                        <Shield className="w-4 h-4 mr-1" />
                        Moderate
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {streamStatus === 'live' ? (
                        <DropdownMenuItem onClick={() => handleModeratorAction('pause_stream')}>
                          <Pause className="w-4 h-4 mr-2" />
                          Pause Stream
                        </DropdownMenuItem>
                      ) : streamStatus === 'paused' ? (
                        <DropdownMenuItem onClick={() => handleModeratorAction('resume_stream')}>
                          <Play className="w-4 h-4 mr-2" />
                          Resume Stream
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem 
                        onClick={() => handleModeratorAction('end_stream')}
                        className="text-destructive"
                      >
                        <Square className="w-4 h-4 mr-2" />
                        End Stream
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  <Button variant="outline" size="sm" data-testid="button-settings">
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
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

        {/* Reaction Bar */}
        <div className="border-b p-4 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Quick Reactions:</span>
              <div className="flex gap-1">
                {[
                  { emoji: '👍', label: 'Like', key: 'like' },
                  { emoji: '❤️', label: 'Love', key: 'love' },
                  { emoji: '👏', label: 'Clap', key: 'clap' },
                  { emoji: '🤔', label: 'Think', key: 'thinking' },
                  { emoji: '💡', label: 'Idea', key: 'idea' }
                ].map((reaction) => (
                  <Button
                    key={reaction.key}
                    variant={selectedReaction === reaction.key ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleReaction(reaction.key)}
                    className="h-8 px-2 text-lg"
                    data-testid={`reaction-${reaction.key}`}
                  >
                    {reaction.emoji}
                  </Button>
                ))}
              </div>
            </div>
            {selectedReaction && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>You reacted with {selectedReaction}</span>
              </div>
            )}
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
                roomState.messages.map((message, index) => {
                  const messageId = `${message.timestamp}-${message.userId}-${index}`;
                  return (
                    <div key={messageId} className="flex items-start gap-3 group hover:bg-muted/30 p-2 rounded-lg -mx-2">
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
                      
                      {/* Message Actions - visible on hover or for moderators */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <MoreVertical className="w-3 h-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {isModerator && (
                              <>
                                <DropdownMenuItem 
                                  onClick={() => handleModeratorAction('delete_message', message.userId, { messageId, timestamp: message.timestamp, content: message.content })}
                                  className="text-destructive"
                                >
                                  <UserX className="w-4 h-4 mr-2" />
                                  Delete Message
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleModeratorAction('mute_user', message.userId)}>
                                  <VolumeX className="w-4 h-4 mr-2" />
                                  Mute User
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleModeratorAction('kick_user', message.userId)}
                                  className="text-destructive"
                                >
                                  <UserX className="w-4 h-4 mr-2" />
                                  Kick User
                                </DropdownMenuItem>
                                <Separator />
                              </>
                            )}
                            <DropdownMenuItem onClick={() => handleReaction('heart')}>
                              <Heart className="w-4 h-4 mr-2" />
                              React
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })
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

      {/* Enhanced Sidebar with Tabs */}
      <div className="w-80 border-l bg-muted/20">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="border-b px-4 pt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="discussion" className="text-xs" data-testid="tab-discussion">
                Votes
              </TabsTrigger>
              <TabsTrigger value="participants" className="text-xs" data-testid="tab-participants">
                People
              </TabsTrigger>
              <TabsTrigger value="polls" className="text-xs" data-testid="tab-polls">
                Polls
              </TabsTrigger>
              <TabsTrigger value="qa" className="text-xs" data-testid="tab-qa">
                Q&A
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden">
            {/* Live Votes Tab */}
            <TabsContent value="discussion" className="h-full p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Live Sentiment</h3>
                  <Badge variant="outline" className="text-xs">
                    {roomState.liveVotes.length} votes
                  </Badge>
                </div>
                
                <ScrollArea className="h-96">
                  <div className="space-y-2">
                    {roomState.liveVotes.slice(-10).reverse().map((vote, index) => (
                      <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-background">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {vote.userId.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm truncate">{vote.userId}</span>
                        </div>
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
                      <div className="text-center text-muted-foreground py-8">
                        <ThumbsUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No votes yet</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            {/* Participants Tab */}
            <TabsContent value="participants" className="h-full p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Participants</h3>
                  <Badge variant="outline" className="text-xs">
                    {roomState.participantCount} online
                  </Badge>
                </div>
                
                <ScrollArea className="h-96">
                  <div className="space-y-2">
                    {roomState.participants.map((participant, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 rounded-lg hover:bg-background group">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {participant.userId.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-medium truncate">{participant.userId}</span>
                            {participant.userId === user?.id && (
                              <Badge variant="secondary" className="text-xs">You</Badge>
                            )}
                          </div>
                        </div>
                        
                        {/* Moderator actions for participants */}
                        {isModerator && participant.userId !== user?.id && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                              >
                                <MoreVertical className="w-3 h-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleModeratorAction('mute_user', participant.userId)}>
                                <VolumeX className="w-4 h-4 mr-2" />
                                Mute
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleModeratorAction('kick_user', participant.userId)}
                                className="text-destructive"
                              >
                                <UserX className="w-4 h-4 mr-2" />
                                Kick
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleModeratorAction('ban_user', participant.userId)}
                                className="text-destructive"
                              >
                                <Ban className="w-4 h-4 mr-2" />
                                Ban
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    ))}
                    {roomState.participants.length === 0 && (
                      <div className="text-center text-muted-foreground py-8">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No participants yet</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            {/* Polls Tab */}
            <TabsContent value="polls" className="h-full p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Live Polls</h3>
                  {isModerator && (
                    <Button size="sm" variant="outline" data-testid="button-create-poll">
                      Create Poll
                    </Button>
                  )}
                </div>
                
                <div className="text-center text-muted-foreground py-8">
                  <ThumbsUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No active polls</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isModerator ? "Create a poll to engage participants" : "Polls will appear here"}
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Q&A Tab */}
            <TabsContent value="qa" className="h-full p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Questions & Answers</h3>
                  <Badge variant="outline" className="text-xs">0 questions</Badge>
                </div>
                
                <div className="text-center text-muted-foreground py-8">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No questions yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Questions from the audience will appear here
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Input 
                    placeholder="Ask a question..." 
                    className="text-sm"
                    data-testid="input-question"
                  />
                  <Button size="sm" className="w-full" data-testid="button-submit-question">
                    Submit Question
                  </Button>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}