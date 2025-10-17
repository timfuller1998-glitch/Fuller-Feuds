import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, Users, Clock, ArrowRight, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";

type EnrichedDebateRoom = {
  id: string;
  topicId: string;
  participant1Id: string;
  participant2Id: string;
  participant1Stance: string;
  participant2Stance: string;
  participant1Privacy: string;
  participant2Privacy: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  topic: {
    id: string;
    title: string;
    description: string;
    categories: string[];
  };
  opponent: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    profileImageUrl: string | null;
  };
  messageCount: number;
  userStance: string;
  opponentStance: string;
};

export default function MyActiveDebates() {
  const [, setLocation] = useLocation();

  // Fetch user's active debate rooms with enriched data
  const { data: debateRooms, isLoading } = useQuery<EnrichedDebateRoom[]>({
    queryKey: ["/api/users/me/debate-rooms"],
    refetchInterval: 5000, // Refetch every 5 seconds to catch new matches
  });

  const getStanceBadgeVariant = (stance: string) => {
    if (stance === 'for') return 'default';
    if (stance === 'against') return 'destructive';
    return 'secondary';
  };

  const getStanceLabel = (stance: string) => {
    if (stance === 'for') return 'Supporting';
    if (stance === 'against') return 'Opposing';
    return 'Neutral';
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 sm:p-3 rounded-lg bg-primary/10">
          <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" data-testid="heading-my-active-debates">
            My Active Debates
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Your ongoing one-on-one debate conversations
          </p>
        </div>
      </div>

      {/* Stats Card */}
      <Card>
        <CardContent className="pt-4 sm:pt-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 rounded-lg bg-primary/10">
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold" data-testid="stat-active-debates-count">
                {debateRooms?.length || 0}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">Active Debates</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your debates...</p>
          </div>
        </div>
      ) : !debateRooms || debateRooms.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2" data-testid="text-no-debates">No active debates</p>
            <p className="text-muted-foreground mb-4">
              You don't have any ongoing debates. Start a debate on a topic you care about!
            </p>
            <Button
              onClick={() => setLocation('/trending')}
              data-testid="button-browse-topics"
            >
              Browse Topics
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4" data-testid="list-active-debates">
          {debateRooms.map((room) => (
            <Card
              key={room.id}
              className="cursor-pointer hover-elevate active-elevate-2"
              onClick={() => setLocation(`/debate-room/${room.id}`)}
              data-testid={`card-debate-${room.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" data-testid={`badge-topic-category-${room.id}`}>
                        {room.topic?.categories?.[0] || 'General'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        Started {formatDistanceToNow(new Date(room.startedAt), { addSuffix: true })}
                      </Badge>
                      {room.participant1Privacy === 'private' || room.participant2Privacy === 'private' ? (
                        <Badge variant="secondary" className="text-xs">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Private
                        </Badge>
                      ) : null}
                    </div>
                    <CardTitle className="text-lg sm:text-xl" data-testid={`text-topic-title-${room.id}`}>
                      {room.topic?.title || 'Unknown Topic'}
                    </CardTitle>
                    {room.topic?.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {room.topic.description}
                      </p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Debate Participants */}
                <div className="flex items-center justify-between gap-4 p-3 sm:p-4 rounded-lg bg-muted/30">
                  {/* Current User */}
                  <div className="flex items-center gap-3 flex-1">
                    <Badge variant={getStanceBadgeVariant(room.userStance)}>
                      {getStanceLabel(room.userStance)}
                    </Badge>
                    <span className="text-sm font-medium">You</span>
                  </div>

                  {/* VS Indicator */}
                  <div className="px-2">
                    <span className="text-sm font-bold text-muted-foreground">VS</span>
                  </div>

                  {/* Opponent */}
                  <div className="flex items-center gap-3 flex-1 justify-end">
                    <span className="text-sm font-medium" data-testid={`text-opponent-name-${room.id}`}>
                      {room.opponent?.firstName || 'Unknown'} {room.opponent?.lastName || 'User'}
                    </span>
                    <Badge variant={getStanceBadgeVariant(room.opponentStance)}>
                      {getStanceLabel(room.opponentStance)}
                    </Badge>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={room.opponent?.profileImageUrl || undefined} />
                      <AvatarFallback>
                        {room.opponent?.firstName?.[0] || 'U'}{room.opponent?.lastName?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>

                {/* Stats and Action */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" />
                      <span data-testid={`text-message-count-${room.id}`}>
                        {room.messageCount} {room.messageCount === 1 ? 'message' : 'messages'}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocation(`/debate-room/${room.id}`);
                    }}
                    data-testid={`button-continue-debate-${room.id}`}
                  >
                    Continue Debate
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
