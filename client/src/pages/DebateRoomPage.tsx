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
import { MessageSquare, Send, LogOut, Swords, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface DebateRoom {
  id: string;
  topicId: string;
  participant1Id: string;
  participant2Id: string;
  participant1Stance: string;
  participant2Stance: string;
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
}

export default function DebateRoomPage() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;
  const [, navigate] = useLocation();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    onError: () => {
      toast({
        title: "Failed to send message",
        variant: "destructive",
      });
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
    onError: () => {
      toast({
        title: "Failed to end debate",
        variant: "destructive",
      });
    },
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    sendMessageMutation.mutate(messageInput);
  };

  const handleEndDebate = () => {
    if (confirm("Are you sure you want to end this debate?")) {
      endDebateMutation.mutate();
    }
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

  return (
    <div className="container max-w-7xl mx-auto p-4">
      {/* Header */}
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Swords className="w-6 h-6 text-blue-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold" data-testid="text-debate-topic">
                    {topic?.title || "Loading topic..."}
                  </h1>
                  <Badge variant={isEnded ? "secondary" : "default"} data-testid="badge-debate-status">
                    {room.status}
                  </Badge>
                </div>
                {topic?.description && (
                  <p className="text-muted-foreground text-sm">{topic.description}</p>
                )}
              </div>
            </div>
            {isParticipant && !isEnded && (
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
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-[300px_1fr]">
        {/* Participants Sidebar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Participants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Participant 1 */}
            {participant1 && (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={participant1.profileImageUrl} />
                    <AvatarFallback>
                      {participant1.firstName?.[0] || participant1.email?.[0]?.toUpperCase() || "?"}
                      {participant1.lastName?.[0] || participant1.email?.[1]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-sm" data-testid={`text-participant-${participant1.id}`}>
                      {participant1.firstName && participant1.lastName
                        ? `${participant1.firstName} ${participant1.lastName}`
                        : participant1.email}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {room.participant1Stance}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* Participant 2 */}
            {participant2 && (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={participant2.profileImageUrl} />
                    <AvatarFallback>
                      {participant2.firstName?.[0] || participant2.email?.[0]?.toUpperCase() || "?"}
                      {participant2.lastName?.[0] || participant2.email?.[1]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-sm" data-testid={`text-participant-${participant2.id}`}>
                      {participant2.firstName && participant2.lastName
                        ? `${participant2.firstName} ${participant2.lastName}`
                        : participant2.email}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {room.participant2Stance}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="flex flex-col h-[calc(100vh-300px)]">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Debate Chat
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0">
            {/* Messages */}
            <ScrollArea className="flex-1 px-4">
              <div className="space-y-4 py-4">
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No messages yet. Start the debate!</p>
                  </div>
                ) : (
                  messages.map((message) => {
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
                        <div className={`flex-1 max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
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
      </div>
    </div>
  );
}
