import { useParams, useLocation } from "wouter";
import { parseServerDate } from "@/lib/dates";
import { answerInvite } from "@/lib/debatesTray";
import { UserHandle } from "@/components/UserHandle";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { debateTurn, useDebateRoom } from "@/lib/debateTurn";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MessageSquare, Send, LogOut, Swords, Lock, Unlock, Flag, Eye, Radio, MoreHorizontal } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import FallacyFlagDialog from "@/components/FallacyFlagDialog";
import FallacyBadges from "@/components/FallacyBadges";
import { VotingModal } from "@/components/VotingModal";
import { useDebateContext } from "@/contexts/DebateContext";
import type { FallacyType } from "@shared/fallacies";
import { useWatchDebate } from "@/hooks/useWatchDebate";
import { stanceLabel, type Stance } from "@/lib/stance";
import { useTypingRooms, useTypingSender } from "@/lib/typingStore";
import { TypingBubble } from "@/components/debates/TypingBubble";

interface DebateRoom {
  id: string;
  topicId: string;
  participant1Id: string;
  participant2Id: string;
  participant1Stance?: string | null;
  participant2Stance?: string | null;
  participant1Privacy?: string;
  participant2Privacy?: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  phase?: 'structured' | 'voting' | 'free-form';
  currentTurn?: string | null;
  turnCount1?: number | null;
  turnCount2?: number | null;
  votesToContinue1?: boolean | null;
  votesToContinue2?: boolean | null;
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
  email?: string;
  handle?: string | null;
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
  const [flaggingMessageId, setFlaggingMessageId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<Array<{id: string, content: string, timestamp: string}>>([]);
  const chatCardRef = useRef<HTMLDivElement>(null);
  const [showVotingModal, setShowVotingModal] = useState(false);
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingRooms = useTypingRooms();
  const typingSender = useTypingSender(roomId);

  // Fetch debate room (debaters get the full room; anyone can watch a public, accepted debate)
  // Shared, self-refreshing room (turn state) — same source as the footer popup. `msgCount` is fed back from the
  // messages query below so a new message refetches the turn.
  const [msgCount, setMsgCount] = useState<number | undefined>(undefined);
  const { data: room, isLoading: roomLoading, error: roomError } = useDebateRoom<DebateRoom>(roomId, msgCount);
  const amDebater = !!currentUser && !!room && (currentUser.id === room.participant1Id || currentUser.id === room.participant2Id);

  // Live updates over /ws for everyone on this page (debaters and spectators). Read-only.
  const live = useWatchDebate(roomId, { enabled: !!room, asDebater: amDebater });
  const connectionState = live.state;

  // Ratings for this debate (NEW: end-of-debate rating step)
  const { data: votes } = useQuery<{
    participant1Votes?: { logicalReasoning: number; politeness: number; opennessToChange: number };
    participant2Votes?: { logicalReasoning: number; politeness: number; opennessToChange: number };
    myVoteSubmitted: boolean;
    bothSubmitted: boolean;
  }>({
    queryKey: ["/api/debate-rooms", roomId, "votes"],
    enabled: !!roomId && !!room && (room?.phase === 'voting' || room?.status === 'ended' || room?.status === 'archived'),
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

  // Fetch messages (no polling needed - WebSocket provides real-time updates)
  const { data: messages = [] } = useQuery<DebateMessage[]>({
    queryKey: ["/api/debate-rooms", roomId, "messages"],
    enabled: !!roomId && !!room,
  });
  useEffect(() => { setMsgCount(messages.length); }, [messages.length]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest('POST', `/api/debate-rooms/${roomId}/messages`, { content });
      return response.json();
    },
    onSuccess: () => {
      // Prefix match: refreshes the room (turn, phase) as well as its messages.
      queryClient.invalidateQueries({ queryKey: ["/api/debate-rooms", roomId] });
      setMessageInput("");
    },
    onError: (error: any) => {
      setOptimisticMessages([]);
      toast({ title: "Message not sent", description: String(error?.message || "").replace(/^\d+:\s*/, "").replace(/^\{"message":"(.*)"\}$/, "$1"), variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/debate-rooms", roomId] });
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
        description: "Now rate your opponent.",
      });
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
        title: "Saved",
        description: isPrivate ? "Anyone can watch this debate again." : "Spectators can no longer watch this debate.",
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

  // Flag message mutation
  const flagMessageMutation = useMutation({
    mutationFn: async (fallacyType: FallacyType) => {
      const response = await apiRequest("POST", `/api/debates/messages/${flaggingMessageId}/flag`, { fallacyType });
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
        description: String(error?.message || "Failed to submit flag").replace(/^\d+:\s*/, "").replace(/^\{"message":"(.*)"\}$/, "$1"),
        variant: "destructive",
      });
    },
  });

  // Add optimistic messages (pending local messages)
  const optimisticMsgs = optimisticMessages.map(opt => ({
    id: opt.id,
    roomId: roomId || '',
    userId: currentUser?.id || '',
    content: opt.content,
    createdAt: opt.timestamp,
    fallacyCounts: {}
  }));
  
  const allMessages = [...messages, ...optimisticMsgs].sort((a, b) => 
    parseServerDate(a.createdAt).getTime() - parseServerDate(b.createdAt).getTime()
  );
  
  // Clean up optimistic messages when they appear in DB or WebSocket (use effect to avoid render mutation)
  useEffect(() => {
    if (optimisticMessages.length === 0) return;
    
    const allRealMessages = messages;
    const duplicateIds = optimisticMessages
      .filter(optMsg => {
        return allRealMessages.some(msg => 
          msg.content === optMsg.content &&
          msg.userId === (currentUser?.id || '') &&
          Math.abs(parseServerDate(msg.createdAt).getTime() - parseServerDate(optMsg.timestamp).getTime()) < 5000
        );
      })
      .map(opt => opt.id);
    
    if (duplicateIds.length > 0) {
      setOptimisticMessages(prev => prev.filter(p => !duplicateIds.includes(p.id)));
    }
  }, [messages, optimisticMessages, currentUser?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length]);

  // Viewing the room: close its mini popup (avoid two inputs) and clear its bell notifications.
  const { closeDebateWindow } = useDebateContext();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (roomId) closeDebateWindow(roomId); }, [roomId]);
  useEffect(() => {
    if (!roomId || !currentUser || !amDebater) return;
    apiRequest('POST', `/api/notifications/read-room/${roomId}`, {})
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        queryClient.invalidateQueries({ queryKey: ["/api/debates/grouped"] });
      })
      .catch(() => {});
  }, [roomId, currentUser?.id, amDebater, messages.length, room?.phase, room?.status]);

  // Once both sides have rated, the dialog steps aside; the scores card on the page shows the result.
  useEffect(() => {
    if (votes?.bothSubmitted && showVotingModal) {
      const t = setTimeout(() => setShowVotingModal(false), 1500);
      return () => clearTimeout(t);
    }
  }, [votes?.bothSubmitted, showVotingModal]);

  // Auto-open the rating dialog once turns are over (or the debate ended) until this debater has rated.
  const ratingDismissedRef = useRef(false);
  useEffect(() => {
    const amParticipant = !!currentUser && (currentUser.id === room?.participant1Id || currentUser.id === room?.participant2Id);
    const inviteClosed = (room as any)?.inviteStatus === 'declined' || (room as any)?.inviteStatus === 'withdrawn';
    const ratingOpen = !inviteClosed && (room?.phase === 'voting' || room?.status === 'ended');
    if (amParticipant && ratingOpen && votes && !votes.myVoteSubmitted && !showVotingModal && !ratingDismissedRef.current) {
      setShowVotingModal(true);
    }
  }, [room?.phase, room?.status, room?.participant1Id, room?.participant2Id, currentUser, votes, showVotingModal]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !currentUser) return;
    
    const content = messageInput;
    const optimisticId = `optimistic-${Date.now()}`;
    const timestamp = new Date().toISOString();
    
    // Clear input and add optimistic message immediately
    setMessageInput("");
    setOptimisticMessages(prev => [...prev, { id: optimisticId, content, timestamp }]);
    
    // Send to DB (backend will broadcast via WebSocket)
    sendMessageMutation.mutate(content, {
      onError: () => {
        // Remove optimistic message and restore input on error
        setOptimisticMessages(prev => prev.filter(m => m.id !== optimisticId));
        setMessageInput(content);
        toast({
          title: "Failed to send message",
          description: "Please try again",
          variant: "destructive"
        });
      }
    });
  };

  // Styled confirm (replaces the browser's plain confirm() pop-up)
  const handleEndDebate = () => setConfirmEndOpen(true);

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
    const msg = String((roomError as any)?.message || "");
    const isPrivate403 = msg.startsWith("403");
    const needsLogin = msg.startsWith("401");
    return (
      <Card data-testid="card-debate-unavailable">
        <CardContent className="py-12 text-center">
          <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">{isPrivate403 || needsLogin ? "This debate isn't open to watch" : "Debate not found"}</p>
          <p className="text-muted-foreground">
            {needsLogin
              ? "It's private or still waiting on an invite. Sign in if you're one of the debaters."
              : isPrivate403
                ? "The debaters kept it private, or the invite hasn't been accepted yet."
                : "This debate may have been removed or doesn't exist."}
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/live")} data-testid="button-back-live">See live debates</Button>
        </CardContent>
      </Card>
    );
  }

  const isParticipant = currentUser?.id === room.participant1Id || currentUser?.id === room.participant2Id;
  const isEnded = room.status === "ended" || room.status === "archived";
  const isSpectator = !isParticipant;
  const nameOf = (u?: User) => u?.firstName || (u?.handle ? "@" + u.handle : "Someone");
  const turnName = room.currentTurn === room.participant1Id ? nameOf(participant1) : room.currentTurn === room.participant2Id ? nameOf(participant2) : null;
  const spectatorTyping = isSpectator && live.typingUserId ? (live.typingUserId === room.participant1Id ? nameOf(participant1) : nameOf(participant2)) : null;
  const statusLabel = (room as any).inviteStatus === "pending" && !isEnded ? "Invite pending"
    : (room as any).inviteStatus === "declined" ? "Declined"
    : (room as any).inviteStatus === "withdrawn" ? "Cancelled"
    : isEnded ? "Finished" : room.phase === "voting" ? "Rating" : "In progress";
  const inviteStatus = (room as any).inviteStatus as string | undefined;
  const inviteClosed = inviteStatus === "declined" || inviteStatus === "withdrawn";
  const invitePendingForMe = inviteStatus === "pending" && (room as any).inviteeId === currentUser?.id;
  const invitePendingFromMe = inviteStatus === "pending" && !!(room as any).inviteeId && (room as any).inviteeId !== currentUser?.id;
  const answerInviteHere = async (action: "accept" | "decline" | "withdraw") => {
    try {
      await answerInvite(room.id, action);
      queryClient.invalidateQueries({ queryKey: ["/api/debate-rooms", roomId] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/debates/grouped"] });
    } catch (e: any) {
      toast({ title: "Couldn't answer the invite", description: e?.message, variant: "destructive" });
    }
  };
  const isParticipant1 = currentUser?.id === room.participant1Id;
  const currentUserPrivacy = isParticipant1 ? room.participant1Privacy : room.participant2Privacy;
  const isPrivate = currentUserPrivacy === 'private';
  const opp = isParticipant1 ? participant2 : participant1;
  const opponentFirstName = opp?.firstName || (opp?.handle ? '@' + opp.handle : 'Opponent');
  const opponentTypingHere = !!roomId && typingRooms.has(roomId) && room.status === 'active' && room.phase !== 'voting';
  const turn = debateTurn(room, currentUser?.id);

  return (
    <div className="max-w-5xl mx-auto space-y-2 sm:space-y-4 p-0 sm:p-4">
      {/* Topic Header - compact on phones */}
      <div className="text-center space-y-1 sm:space-y-2">
        <div className="flex items-center justify-center gap-2">
          <div className="hidden sm:block p-2 rounded-lg bg-primary/10">
            <Swords className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-lg leading-snug sm:text-3xl font-bold line-clamp-2" data-testid="text-debate-topic">
            {topic?.title || "Loading topic..."}
          </h1>
        </div>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Badge variant={isEnded ? "secondary" : "default"} data-testid="badge-debate-status">
            {statusLabel}
          </Badge>
          {/* Live connection: only meaningful while the debate is running */}
          {!isEnded && connectionState === 'live' && (
            <Badge variant="outline" className="border-primary/40 text-primary" data-testid="badge-live">
              <div className="w-2 h-2 rounded-full bg-primary mr-1.5 animate-pulse" />
              Live
            </Badge>
          )}
          {!isEnded && (connectionState === 'connecting' || connectionState === 'offline') && (
            <Badge variant="outline" className="text-muted-foreground" data-testid="badge-reconnecting">
              {connectionState === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
            </Badge>
          )}
          {!isEnded && live.viewers > 0 && (
            <Badge variant="outline" className="gap-1" data-testid="badge-viewers">
              <Eye className="w-3 h-3" /> {live.viewers} watching
            </Badge>
          )}
          {isParticipant && !isEnded && (room as any).inviteStatus === 'accepted' && isPrivate && (
            <Badge variant="outline" className="gap-1 text-muted-foreground" data-testid="badge-private">
              <Lock className="w-3 h-3" /> Private
            </Badge>
          )}
        </div>
        {topic?.description && (
          <p className="hidden sm:block text-muted-foreground text-sm max-w-2xl mx-auto">{topic.description}</p>
        )}
      </div>

      {/* Participants Face-Off - Horizontal VS Layout */}
      <Card className="overflow-hidden">
        <CardContent className="p-2.5 sm:p-6">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Participant 1 */}
            <div className="flex-1 min-w-0 flex items-center gap-2 sm:gap-3 justify-start">
              <Avatar className="w-9 h-9 sm:w-16 sm:h-16 shrink-0">
                <AvatarImage src={participant1?.profileImageUrl} />
                <AvatarFallback>
                  {participant1?.firstName?.[0] || participant1?.handle?.[0]?.toUpperCase() || "?"}
                  {participant1?.lastName?.[0] || participant1?.handle?.[1]?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start min-w-0">
                <p className="font-semibold text-sm sm:text-base truncate max-w-full" data-testid={`text-participant-${participant1?.id}`}>
                  {participant1?.firstName && participant1?.lastName
                    ? `${participant1.firstName} ${participant1.lastName}`
                    : (participant1?.handle ? '@' + participant1?.handle : undefined) || "Loading..."}
                </p>
                <UserHandle handle={(participant1 as any)?.handle} />
                {room.participant1Stance && stanceLabel[room.participant1Stance as Stance] && (
                  <Badge variant="outline" className="text-xs" data-testid="badge-stance-p1">
                    {stanceLabel[room.participant1Stance as Stance]}
                  </Badge>
                )}
              </div>
            </div>

            {/* VS Badge */}
            <div className="flex-shrink-0">
              <Badge variant="default" className="px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm font-bold">VS</Badge>
            </div>

            {/* Participant 2 */}
            <div className="flex-1 min-w-0 flex items-center gap-2 sm:gap-3 justify-end">
              <div className="flex flex-col items-end min-w-0">
                <p className="font-semibold text-sm sm:text-base truncate max-w-full" data-testid={`text-participant-${participant2?.id}`}>
                  {participant2?.firstName && participant2?.lastName
                    ? `${participant2.firstName} ${participant2.lastName}`
                    : (participant2?.handle ? '@' + participant2?.handle : undefined) || "Loading..."}
                </p>
                <UserHandle handle={(participant2 as any)?.handle} className="text-right" />
                {room.participant2Stance && stanceLabel[room.participant2Stance as Stance] && (
                  <Badge variant="outline" className="text-xs" data-testid="badge-stance-p2">
                    {stanceLabel[room.participant2Stance as Stance]}
                  </Badge>
                )}
              </div>
              <Avatar className="w-9 h-9 sm:w-16 sm:h-16 shrink-0" data-testid="avatar-participant2">
                <AvatarImage src={participant2?.profileImageUrl} />
                <AvatarFallback>
                  {participant2?.firstName?.[0] || participant2?.handle?.[0]?.toUpperCase() || "?"}
                  {participant2?.lastName?.[0] || participant2?.handle?.[1]?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Debate invites: accept / decline (invitee), waiting + withdraw (inviter), closed notice */}
      {isParticipant && invitePendingForMe && (
        <Card className="border-2 border-primary" data-testid="card-invite-pending">
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm"><span className="font-semibold">{opponentFirstName}</span> invited you to debate. Accept, decline, or just reply to accept.</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => answerInviteHere("accept")} data-testid="button-accept-invite">Accept</Button>
              <Button size="sm" variant="outline" onClick={() => answerInviteHere("decline")} data-testid="button-decline-invite">Decline</Button>
            </div>
          </CardContent>
        </Card>
      )}
      {isParticipant && invitePendingFromMe && (
        <Card data-testid="card-invite-sent">
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">Waiting for {opponentFirstName} to accept. Invites never expire, so it stays open until they answer or you cancel it.</p>
            <Button size="sm" variant="outline" onClick={() => answerInviteHere("withdraw")} data-testid="button-withdraw-invite">Cancel invite</Button>
          </CardContent>
        </Card>
      )}
      {isParticipant && inviteClosed && (
        <Card data-testid="card-invite-closed">
          <CardContent className="p-4 text-sm text-muted-foreground">
            {inviteStatus === "declined" ? "This invite was declined." : "This invite was cancelled."} It's in your Archive.
          </CardContent>
        </Card>
      )}

      {/* Spectators: read-only, live */}
      {isSpectator && (
        <Card className="border-primary/40" data-testid="card-spectator">
          <CardContent className="p-4 flex items-center gap-3 flex-wrap text-sm">
            {isEnded ? (
              <span className="flex items-center gap-2"><MessageSquare className="w-4 h-4" /> This debate is over. You're reading the full exchange.</span>
            ) : (
              <>
                <span className="flex items-center gap-2 font-semibold text-primary"><Radio className="w-4 h-4" /> Watching live</span>
                <span className="text-muted-foreground" data-testid="text-spectator-turn">
                  {room.phase === 'voting' ? 'Turns are done. The debaters are rating each other.' : turnName ? `${turnName}'s turn.` : 'Waiting for the next move.'}
                </span>
                <span className="text-muted-foreground">New messages appear here as they're sent.</span>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Spectators see the final ratings once both debaters rated */}
      {isSpectator && votes?.bothSubmitted && (
        <Card className="border-2 border-foreground/80" data-testid="card-spectator-scores">
          <CardHeader className="pb-2"><CardTitle className="font-serif text-xl font-bold">Final ratings</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {[{ id: room.participant1Id, p: participant1, got: votes.participant2Votes }, { id: room.participant2Id, p: participant2, got: votes.participant1Votes }].map(({ id, p, got }) => (
                <div key={id} className="rounded-md border p-3">
                  <div className="font-semibold mb-2">{nameOf(p)}</div>
                  {got ? (
                    <ul className="text-sm space-y-1">
                      <li className="flex justify-between"><span>Logic</span><span className="font-mono">{got.logicalReasoning}/5</span></li>
                      <li className="flex justify-between"><span>Civility</span><span className="font-mono">{got.politeness}/5</span></li>
                      <li className="flex justify-between"><span>Openness</span><span className="font-mono">{got.opennessToChange}/5</span></li>
                    </ul>
                  ) : <p className="text-sm text-muted-foreground">No rating.</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* NEW: end-of-debate scores */}
      {isParticipant && !inviteClosed && (room.phase === 'voting' || isEnded) && votes && (
        <Card className="border-2 border-foreground/80" data-testid="card-debate-scores">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-xl font-bold">
              {votes.bothSubmitted ? 'Final ratings' : votes.myVoteSubmitted ? 'Rating sent' : 'Rate your opponent'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {votes.bothSubmitted ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[{ id: room.participant1Id, p: participant1, got: votes.participant2Votes }, { id: room.participant2Id, p: participant2, got: votes.participant1Votes }].map(({ id, p, got }) => (
                  <div key={id} className="rounded-md border p-3" data-testid={`scores-${id === currentUser?.id ? 'me' : 'opponent'}`}>
                    <div className="font-semibold mb-2">{id === currentUser?.id ? 'You' : (p?.firstName || (p?.handle ? '@' + p.handle : 'Opponent'))}</div>
                    {got ? (
                      <ul className="text-sm space-y-1">
                        <li className="flex justify-between"><span>Logic</span><span className="font-mono">{got.logicalReasoning}/5</span></li>
                        <li className="flex justify-between"><span>Civility</span><span className="font-mono">{got.politeness}/5</span></li>
                        <li className="flex justify-between"><span>Openness</span><span className="font-mono">{got.opennessToChange}/5</span></li>
                        <li className="flex justify-between border-t pt-1 font-semibold"><span>Average</span><span className="font-mono">{((got.logicalReasoning + got.politeness + got.opennessToChange) / 3).toFixed(1)}</span></li>
                      </ul>
                    ) : <p className="text-sm text-muted-foreground">No rating.</p>}
                  </div>
                ))}
              </div>
            ) : votes.myVoteSubmitted ? (
              <p className="text-sm text-muted-foreground">Thanks. Both sets of scores appear here once your opponent rates you too.</p>
            ) : (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm text-muted-foreground">Turns are over. Score your opponent on logic, civility and openness.</p>
                <Button size="sm" onClick={() => { ratingDismissedRef.current = false; setShowVotingModal(true); }} data-testid="button-open-rating">Rate now</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Chat Area - Full Width */}
      {/* Phones: the chat fills the screen under the compact header, input pinned above the footer. */}
      <Card ref={chatCardRef} className="flex flex-col h-[calc(100dvh-9.5rem)] min-h-[340px] sm:h-[70vh] sm:min-h-[400px] sm:max-h-[600px]" data-testid="card-debate-chat">
        <CardHeader className="border-b p-3 sm:p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="hidden sm:flex text-lg items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Debate Chat
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Phase Badge */}
              {room.phase && !isEnded && (
                <Badge 
                  variant={room.phase === 'structured' ? 'default' : room.phase === 'voting' ? 'secondary' : 'outline'}
                  data-testid="badge-debate-phase"
                >
                  {room.phase === 'structured' ? 'Structured' : room.phase === 'voting' ? 'Voting' : 'Free-form'}
                </Badge>
              )}
              
              {isSpectator && room.phase === 'structured' && !isEnded && turnName && (
                <Badge variant="secondary" data-testid="badge-spectator-turn">{turnName}'s turn</Badge>
              )}
              {/* Turn Indicator */}
              {room.phase === 'structured' && currentUser && isParticipant && !isEnded && (
                <Badge 
                  variant={turn.isMyTurn ? 'default' : 'secondary'}
                  data-testid="badge-turn-indicator"
                  className="gap-1"
                >
                  {turn.isMyTurn ? 'Your Turn' : "Opponent's Turn"}
                  {turn.isMyTurn && (
                    <span className="text-xs">
                      ({(currentUser.id === room.participant1Id ? (room.turnCount1 || 0) : (room.turnCount2 || 0)) + 1}/3)
                    </span>
                  )}
                </Badge>
              )}
              {isParticipant && !isEnded && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Debate options" data-testid="button-debate-menu">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleTogglePrivacy} disabled={privacyMutation.isPending} data-testid="button-toggle-privacy">
                      {isPrivate ? <><Unlock className="w-4 h-4 mr-2" />Let people watch</> : <><Lock className="w-4 h-4 mr-2" />Hide from spectators</>}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleEndDebate} disabled={endDebateMutation.isPending} className="text-destructive focus:text-destructive" data-testid="button-end-debate">
                      <LogOut className="w-4 h-4 mr-2" />End debate
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden">
          {/* Messages */}
          <ScrollArea className="flex-1 min-h-0 px-3 sm:px-4">
            <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
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
                    : (sender?.handle ? '@' + sender?.handle : undefined) || 'Unknown';
                  
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}
                      data-testid={`message-${message.id}`}
                    >
                      <Avatar className="w-7 h-7 sm:w-8 sm:h-8 shrink-0">
                        <AvatarImage src={sender?.profileImageUrl} />
                        <AvatarFallback>
                          {sender?.firstName?.[0] || sender?.handle?.[0]?.toUpperCase() || "?"}
                          {sender?.lastName?.[0] || sender?.handle?.[1]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`flex-1 max-w-[80%] sm:max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium">
                            {senderName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {parseServerDate(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </p>
                          {!!currentUser && !isOwnMessage && !isEnded && !String(message.id).startsWith('optimistic-') && (
                            <button
                              onClick={() => setFlaggingMessageId(message.id)}
                              className="p-1 -m-1 text-muted-foreground hover:text-destructive"
                              aria-label="Flag a fallacy in this message"
                              title="Flag fallacy"
                              data-testid={`button-flag-message-${message.id}`}
                            >
                              <Flag className="w-3.5 h-3.5" />
                            </button>
                          )}
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
            <div className="border-t p-2.5 sm:p-4">
              {/* Typing Indicator */}
              {opponentTypingHere && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 px-1" data-testid="room-typing">
                  <TypingBubble label={`${opponentFirstName} is typing`} />
                  <span>{opponentFirstName} is typing…</span>
                </div>
              )}
              {/* Turn restriction notice */}
              {turn.waiting && (
                <div className="text-xs sm:text-sm text-muted-foreground mb-2 px-1 text-center bg-muted/50 rounded py-1.5 sm:py-2" data-testid="text-room-waiting">
                  <span className="italic">Wait for your turn to respond</span>
                </div>
              )}
              
              <div className="flex gap-2">
                <Input
                  placeholder={
                    turn.waiting
                      ? "Waiting for opponent's turn..."
                      : room.phase === 'voting'
                      ? "Please vote on your opponent's performance..."
                      : "Type your message..."
                  }
                  value={messageInput}
                  onChange={(e) => {
                    setMessageInput(e.target.value);
                    if (e.target.value.length > 0) typingSender.onKey(); else typingSender.stop();
                  }}
                  onBlur={typingSender.stop}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                      typingSender.stop();
                    }
                  }}
                  disabled={
                    sendMessageMutation.isPending || !turn.canSend
                  }
                  data-testid="input-message"
                />
                <Button
                  onClick={() => { handleSendMessage(); typingSender.stop(); }}
                  disabled={
                    !messageInput.trim() || 
                    sendMessageMutation.isPending || !turn.canSend
                  }
                  data-testid="button-send-message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
          
          {isSpectator && !isEnded && (
            <div className="border-t p-4 text-center text-sm text-muted-foreground" data-testid="text-spectator-footer">
              {spectatorTyping ? (
                <span className="inline-flex items-center gap-2" data-testid="spectator-typing">
                  <TypingBubble label={`${spectatorTyping} is typing`} /> {spectatorTyping} is typing…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2"><Eye className="w-4 h-4" /> You're watching. Only the two debaters can post.</span>
              )}
            </div>
          )}
          
          {isEnded && (
            <div className="border-t p-4 text-center text-sm text-muted-foreground">
              This debate has ended
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fallacy Flag Dialog */}
      <FallacyFlagDialog
        open={!!flaggingMessageId}
        onOpenChange={(open) => !open && setFlaggingMessageId(null)}
        onSubmit={(fallacyType) => flagMessageMutation.mutate(fallacyType)}
        isPending={flagMessageMutation.isPending}
        entityType="message"
      />

      {/* Voting Modal */}
      {room && currentUser && isParticipant && (
        <VotingModal
          isOpen={showVotingModal}
          roomId={room.id}
          opponentName={
            currentUser.id === room.participant1Id
              ? participant2?.firstName && participant2?.lastName
                ? `${participant2.firstName} ${participant2.lastName}`
                : (participant2?.handle ? '@' + participant2?.handle : undefined) || 'Unknown'
              : participant1?.firstName && participant1?.lastName
              ? `${participant1.firstName} ${participant1.lastName}`
              : (participant1?.handle ? '@' + participant1?.handle : undefined) || 'Unknown'
          }
          opponentId={currentUser.id === room.participant1Id ? room.participant2Id : room.participant1Id}
          currentUserId={currentUser.id}
          allowContinue={!isEnded}
          isParticipant1={currentUser.id === room.participant1Id}
          onClose={() => { ratingDismissedRef.current = true; setShowVotingModal(false); }}
        />
      )}
      <AlertDialog open={confirmEndOpen} onOpenChange={setConfirmEndOpen}>
        <AlertDialogContent data-testid="dialog-confirm-end-debate">
          <AlertDialogHeader>
            <AlertDialogTitle>End this debate early?</AlertDialogTitle>
            <AlertDialogDescription>
              No more messages can be sent. You and your opponent will both be asked to rate the debate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-end-debate">Keep debating</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => endDebateMutation.mutate()}
              data-testid="button-confirm-end-debate"
            >
              End debate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
