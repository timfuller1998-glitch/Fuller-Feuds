import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { MessageSquare, Users, Clock, ArrowRight, AlertCircle, ExternalLink } from "lucide-react";
import { useLocation, Link } from "wouter";
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
  phase: string;
  currentTurn: string;
  participant1TurnCount: number;
  participant2TurnCount: number;
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

type GroupedDebates = {
  [topicId: string]: {
    topic: EnrichedDebateRoom['topic'];
    debates: EnrichedDebateRoom[];
  };
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

  const getPhaseLabel = (phase: string) => {
    if (phase === 'opening') return 'Opening';
    if (phase === 'structured') return 'Structured';
    if (phase === 'freeform') return 'Free Discussion';
    return 'Debate';
  };

  // Group debates by topic
  const groupedDebates: GroupedDebates = (debateRooms || []).reduce((acc, room) => {
    const topicId = room.topicId;
    if (!acc[topicId]) {
      acc[topicId] = {
        topic: room.topic,
        debates: [],
      };
    }
    acc[topicId].debates.push(room);
    return acc;
  }, {} as GroupedDebates);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-lg bg-primary/10">
          <MessageSquare className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-my-active-debates">
            My Active Debates
          </h1>
          <p className="text-base text-muted-foreground">
            Your ongoing one-on-one debate conversations, grouped by topic
          </p>
        </div>
      </div>

      {/* Stats Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-active-debates-count">
                  {debateRooms?.length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Active Debates</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-chart-2/10">
                <Users className="w-5 h-5 text-chart-2" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-topics-count">
                  {Object.keys(groupedDebates).length}
                </p>
                <p className="text-sm text-muted-foreground">Topics with Debates</p>
              </div>
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
        <div className="space-y-8" data-testid="list-grouped-debates">
          {Object.entries(groupedDebates).map(([topicId, { topic, debates }]) => (
            <div key={topicId} className="space-y-4">
              {/* Topic Header */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {topic.categories.map((cat) => (
                      <Badge 
                        key={cat} 
                        variant="secondary" 
                        className="text-xs cursor-pointer hover-elevate"
                        onClick={() => setLocation(`/?category=${encodeURIComponent(cat)}`)}
                        data-testid={`badge-category-${cat.toLowerCase()}`}
                      >
                        {cat}
                      </Badge>
                    ))}
                  </div>
                  <h2 className="text-xl font-bold" data-testid={`heading-topic-${topicId}`}>
                    {topic.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {debates.length} {debates.length === 1 ? 'debate' : 'debates'}
                  </p>
                </div>
                <Link href={`/topic/${topicId}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid={`button-view-topic-${topicId}`}
                  >
                    View Topic Page
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>

              {/* Horizontal Scrolling Debate Cards */}
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-4 pb-4">
                  {debates.slice(0, 5).map((room) => (
                    <Card
                      key={room.id}
                      className="min-w-[320px] max-w-[400px] cursor-pointer hover-elevate active-elevate-2"
                      onClick={() => setLocation(`/debate-room/${room.id}`)}
                      data-testid={`card-debate-${room.id}`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            {formatDistanceToNow(new Date(room.startedAt), { addSuffix: true })}
                          </Badge>
                          {(room.participant1Privacy === 'private' || room.participant2Privacy === 'private') && (
                            <Badge variant="secondary" className="text-xs">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Private
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {getPhaseLabel(room.phase)}
                          </Badge>
                        </div>
                        <CardTitle className="text-base line-clamp-2" data-testid={`text-debate-title-${room.id}`}>
                          Debate with {room.opponent?.firstName || 'Unknown'} {room.opponent?.lastName || 'User'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Opponent Info */}
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={room.opponent?.profileImageUrl || undefined} />
                            <AvatarFallback>
                              {room.opponent?.firstName?.[0] || 'U'}{room.opponent?.lastName?.[0] || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" data-testid={`text-opponent-name-${room.id}`}>
                              {room.opponent?.firstName || 'Unknown'} {room.opponent?.lastName || 'User'}
                            </p>
                            <Badge variant={getStanceBadgeVariant(room.opponentStance)} className="text-xs mt-1">
                              {getStanceLabel(room.opponentStance)}
                            </Badge>
                          </div>
                        </div>

                        {/* Debate Stats */}
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            <span data-testid={`text-message-count-${room.id}`}>
                              {room.messageCount} msg
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            <span data-testid={`text-turn-count-${room.id}`}>
                              Turn {Math.max(room.participant1TurnCount, room.participant2TurnCount)}/3
                            </span>
                          </div>
                        </div>

                        {/* Action Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/debate-room/${room.id}`);
                          }}
                          data-testid={`button-continue-debate-${room.id}`}
                        >
                          Continue Debate
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>

              {/* Show More Debates Link */}
              {debates.length > 5 && (
                <div className="text-center">
                  <Link href={`/topic/${topicId}`}>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid={`button-more-debates-${topicId}`}
                    >
                      View All {debates.length} Debates on This Topic
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
