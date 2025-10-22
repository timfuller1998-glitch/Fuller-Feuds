import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageSquare, Send, LogOut, Swords, Lock, Unlock, RefreshCw, UserPlus, Flag } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import FallacyFlagDialog from "@/components/FallacyFlagDialog";
import FallacyBadges from "@/components/FallacyBadges";
import type { FallacyType } from "@shared/fallacies";
import { useDebateRoom } from "@/hooks/useDebateRoom";

interface DebateRoom {
  id: string;
  topicId: string;
  participant1Id: string;
  participant2Id: string;
  participant1Stance: string;
  participant2Stance: string;
  participant1Privacy?: string;
  participant2Privacy?: string;
  status: string;
  startedAt: string;
  endedAt?: string;
}

interface Topic {
  id: string;
  title: string;
  description: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImageUrl?: string;
}

interface DebateMessage {
  id: string;
  roomId: string;
  userId: string;
  content: string;
  createdAt: string;
  fallacyCounts?: { [key: string]: number };
}

export default function DebateRoomPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;
  const [, navigate] = useLocation();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [messageInput, setMessageInput] = useState("");
  const [showChooseOpponentDialog, setShowChooseOpponentDialog] = useState(false);
  const [flaggingMessageId, setFlaggingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // WebSocket real-time messaging
  const { roomState, connectionState, joinRoom, leaveRoom, sendChatMessage } = useDebateRoom();

  // Fetch debate room
  const { data: room, isLoading: roomLoading } = useQuery<DebateRoom>({
    queryKey: ["/api/debate-rooms", roomId],
    enabled: !!roomId,
  });

  // Fetch topic
  const { data: topic } = useQuery<Topic>({
    queryKey: ["/api/topics", room?.topicId],
    enabled: !!room?.topicId,
  });

  // Fetch participants
  const { data: participant1 } = useQuery<User>({
    queryKey: ["/api/users", room?.participant1Id],
    enabled: !!room?.participant1Id,
  });

  const { data: participant2 } = useQuery<User>({
    queryKey: ["/api/users", room?.participant2Id],
    enabled: !!room?.participant2Id,
  });

  // Fetch messages
  const { data: messages = [] } = useQuery<DebateMessage[]>({
    queryKey: ["/api/debate-rooms", roomId, "messages"],
    refetchInterval: 3000, // Poll every 3 seconds
    enabled: !!roomId,
  });

  // Fetch available opponents
  const { data: availableOpponents = [] } = useQuery<User[]>({
    queryKey: ["/api/topics", room?.topicId, "opponents"],
    enabled: !!room?.topicId && showChooseOpponentDialog,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest('POST', `/api/debate-rooms/${roomId}/messages`, { content });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debate-rooms", roomId, "messages"] });
      setMessageInput("");
    },
    onError: (error) => {
      console.error("Failed to send message:", error);
    },
  });

  // End debate mutation
  const endDebateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/debate-rooms/${roomId}/end`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debate-rooms", roomId] });
      toast({
        title: "Debate ended",
        description: "The debate has been concluded.",
      });
      navigate("/debates");
    },
    onError: (error) => {
      console.error("Failed to end debate:", error);
      toast({
        title: "Error",
        description: "Failed to end debate",
        variant: "destructive",
      });
    },
  });

  // Privacy mutation
  const privacyMutation = useMutation({
    mutationFn: async (isPrivate: boolean) => {
      const response = await apiRequest('PATCH', `/api/debate-rooms/${roomId}/privacy`, {
        privacy: isPrivate ? 'private' : 'public'
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debate-rooms", roomId] });
      toast({
        title: "Privacy updated",
        description: "Your privacy setting has been changed.",
      });
    },
    onError: (error) => {
      console.error("Failed to update privacy:", error);
      toast({
        title: "Error",
        description: "Failed to update privacy setting",
        variant: "destructive",
      });
    },
  });

  // Switch opponent mutation
  const switchOpponentMutation = useMutation({
    mutationFn: async (newOpponentId?: string) => {
      const response = await apiRequest('POST', `/api/debate-rooms/${roomId}/switch-opponent`, {
        newOpponentId
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debate-rooms", roomId] });
      toast({
        title: "Opponent switched",
        description: "You've been matched with a new opponent.",
      });
      setShowChooseOpponentDialog(false);
    },
    onError: (error) => {
      console.error("Failed to switch opponent:", error);
      toast({
        title: "Error",
        description: "Failed to switch opponent",
        variant: "destructive",
      });
    },
  });

  // Flag message mutation
  const flagMessageMutation = useMutation({
    mutationFn: async (fallacyType: FallacyType) => {
      const response = await fetch(`/api/debate-messages/${flaggingMessageId}/flag`, {
        method: "POST",
        body: JSON.stringify({ fallacyType }),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Flag submitted",
        description: "Thank you for helping keep debates productive.",
      });
      setFlaggingMessageId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/debate-rooms", roomId, "messages"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit flag",
        variant: "destructive",
      });
    },
  });

  // Join WebSocket room when roomId is available
  useEffect(() => {
    if (roomId && currentUser?.id) {
      joinRoom(roomId);
    }
    
    return () => {
      if (roomState.isConnected) {
        leaveRoom();
      }
    };
  }, [roomId, currentUser?.id, joinRoom, leaveRoom]);

  // Combine DB messages with WebSocket real-time messages
  // DB messages are the source of truth, WebSocket adds real-time updates
  const allMessages = [...messages, ...roomState.messages.map((wsMsg) => ({
    id: `ws-${wsMsg.timestamp}`,
    roomId: wsMsg.roomId,
    userId: wsMsg.userId,
    content: wsMsg.content,
    createdAt: wsMsg.timestamp,
    fallacyCounts: {}
  }))];

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length]);

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;
    
    // Send to DB first (source of truth)
    sendMessageMutation.mutate(messageInput);
    
    // Also broadcast via WebSocket for real-time delivery
    // sendChatMessage(messageInput);
  };

  const handleEndDebate = () => {
    if (confirm("Are you sure you want to end this debate?")) {
      endDebateMutation.mutate();
    }
  };

  const handleTogglePrivacy = () => {
    const newPrivacyState = !isPrivate;
    privacyMutation.mutate(newPrivacyState);
  };

  if (roomLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading debate room...</p>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">Debate room not found</p>
          <p className="text-muted-foreground">
            This debate may have ended or doesn't exist
          </p>
        </CardContent>
      </Card>
    );
  }

  const isParticipant = currentUser?.id === room.participant1Id || currentUser?.id === room.participant2Id;
  const isEnded = room.status === "ended";
  const isParticipant1 = currentUser?.id === room.participant1Id;
  const currentUserPrivacy = isParticipant1 ? room.participant1Privacy : room.participant2Privacy;
  const isPrivate = currentUserPrivacy === 'private';

  return (
    <div className="max-w-5xl mx-auto space-y-4 p-4">
      {/* Topic Header - Centered and Clean */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Swords className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-debate-topic">
            {topic?.title || "Loading topic..."}
          </h1>
          <Badge variant={isEnded ? "secondary" : "default"} data-testid="badge-debate-status">
            {room.status}
          </Badge>
        </div>
        {topic?.description && (
          <p className="text-muted-foreground text-sm max-w-2xl mx-auto">{topic.description}</p>
        )}
      </div>

      {/* Participants Face-Off - Horizontal VS Layout */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-4">
            {/* Participant 1 */}
            <div className="flex-1 flex items-center gap-3 justify-start">
              <Avatar className="w-12 h-12 sm:w-16 sm:h-16">
                <AvatarImage src={participant1?.profileImageUrl} />
                <AvatarFallback>
                  {participant1?.firstName?.[0] || participant1?.email?.[0]?.toUpperCase() || "?"}
                  {participant1?.lastName?.[0] || participant1?.email?.[1]?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start">
                <p className="font-semibold text-sm sm:text-base" data-testid={`text-participant-${participant1?.id}`}>
                  {participant1?.firstName && participant1?.lastName
                    ? `${participant1.firstName} ${participant1.lastName}`
                    : participant1?.email || "Loading..."}
                </p>
                <Badge variant="outline" className="text-xs">
                  {room.participant1Stance}
                </Badge>
              </div>
            </div>

            {/* VS Badge */}
            <div className="flex-shrink-0">
              <Badge variant="default" className="px-3 py-1 text-sm font-bold">VS</Badge>
            </div>

            {/* Participant 2 */}
            <div className="flex-1 flex items-center gap-3 justify-end">
              <div className="flex flex-col items-end">
                <p className="font-semibold text-sm sm:text-base" data-testid={`text-participant-${participant2?.id}`}>
                  {participant2?.firstName && participant2?.lastName
                    ? `${participant2.firstName} ${participant2.lastName}`
                    : participant2?.email || "Loading..."}
                </p>
                <Badge variant="outline" className="text-xs">
                  {room.participant2Stance}
                </Badge>
              </div>
              <Avatar className="w-12 h-12 sm:w-16 sm:h-16">
                <AvatarImage src={participant2?.profileImageUrl} />
                <AvatarFallback>
                  {participant2?.firstName?.[0] || participant2?.email?.[0]?.toUpperCase() || "?"}
                  {participant2?.lastName?.[0] || participant2?.email?.[1]?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons - End Debate & Privacy Toggle */}
      {isParticipant && !isEnded && (
        <div className="flex flex-wrap gap-2 justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTogglePrivacy}
            disabled={privacyMutation.isPending}
            data-testid="button-toggle-privacy"
          >
            {isPrivate ? (
              <>
                <Unlock className="w-4 h-4 mr-2" />
                Make Public
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Make Private
              </>
            )}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleEndDebate}
            disabled={endDebateMutation.isPending}
            data-testid="button-end-debate"
          >
            <LogOut className="w-4 h-4 mr-2" />
            End Debate
          </Button>
        </div>
      )}

      {/* Chat Area - Full Width */}
      <Card className="flex flex-col min-h-[400px] max-h-[600px]">
        <CardHeader className="border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Debate Chat
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0">
          {/* Messages */}
          <ScrollArea className="flex-1 px-4">
            <div className="space-y-4 py-4">
              {allMessages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No messages yet. Start the debate!</p>
                </div>
              ) : (
                allMessages.map((message) => {
                  const isOwnMessage = message.userId === currentUser?.id;
                  const sender = message.userId === room.participant1Id ? participant1 : participant2;
                  const senderName = sender?.firstName && sender?.lastName
                    ? `${sender.firstName} ${sender.lastName}`
                    : sender?.email || 'Unknown';
                  
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}
                      data-testid={`message-${message.id}`}
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={sender?.profileImageUrl} />
                        <AvatarFallback>
                          {sender?.firstName?.[0] || sender?.email?.[0]?.toUpperCase() || "?"}
                          {sender?.lastName?.[0] || sender?.email?.[1]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`flex-1 max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}>
                        <div className="flex items-baseline gap-2 mb-1">
                          <p className="text-sm font-medium">
                            {senderName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(message.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                        <div
                          className={`rounded-lg p-3 ${
                            isOwnMessage
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                        </div>
                        
                        {/* Fallacy badges */}
                        {message.fallacyCounts && Object.keys(message.fallacyCounts).some(key => (message.fallacyCounts as {[key: string]: number})[key] > 0) && (
                          <div className="mt-2">
                            <FallacyBadges fallacyCounts={message.fallacyCounts} />
                          </div>
                        )}
                        
                        {/* Flag button */}
                        {!isOwnMessage && !isEnded && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setFlaggingMessageId(message.id)}
                            className="mt-1 h-6 px-2 text-xs"
                            data-testid={`button-flag-message-${message.id}`}
                          >
                            <Flag className="w-3 h-3 mr-1" />
                            Flag Fallacy
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Message Input */}
          {isParticipant && !isEnded && (
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Type your message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={sendMessageMutation.isPending}
                  data-testid="input-message"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || sendMessageMutation.isPending}
                  data-testid="button-send-message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
          
          {!isParticipant && (
            <div className="border-t p-4 text-center text-sm text-muted-foreground">
              You are viewing this debate as a spectator
            </div>
          )}
          
          {isEnded && (
            <div className="border-t p-4 text-center text-sm text-muted-foreground">
              This debate has ended
            </div>
          )}
        </CardContent>
      </Card>

      {/* Choose Opponent Dialog */}
      <Dialog open={showChooseOpponentDialog} onOpenChange={setShowChooseOpponentDialog}>
        <DialogContent data-testid="dialog-choose-opponent">
          <DialogHeader>
            <DialogTitle>Choose an Opponent</DialogTitle>
            <DialogDescription>
              Select someone with an opposing view on {topic?.title} to debate with
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {availableOpponents.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No opponents available at the moment
              </p>
            ) : (
              <div className="space-y-2">
                {availableOpponents.map((opponent) => (
                  <div
                    key={opponent.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover-elevate active-elevate-2"
                    data-testid={`opponent-option-${opponent.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={opponent.profileImageUrl} />
                        <AvatarFallback>
                          {opponent.firstName?.[0] || opponent.email?.[0]?.toUpperCase() || "?"}
                          {opponent.lastName?.[0] || opponent.email?.[1]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">
                          {opponent.firstName && opponent.lastName
                            ? `${opponent.firstName} ${opponent.lastName}`
                            : opponent.email}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        switchOpponentMutation.mutate(opponent.id);
                        setShowChooseOpponentDialog(false);
                      }}
                      disabled={switchOpponentMutation.isPending}
                      data-testid={`button-select-opponent-${opponent.id}`}
                    >
                      Select
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Fallacy Flag Dialog */}
      <FallacyFlagDialog
        open={!!flaggingMessageId}
        onOpenChange={(open) => !open && setFlaggingMessageId(null)}
        onSubmit={(fallacyType) => flagMessageMutation.mutate(fallacyType)}
        isPending={flagMessageMutation.isPending}
        entityType="message"
      />
    </div>
  );
}
