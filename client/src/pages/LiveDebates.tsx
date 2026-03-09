import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Radio, Users, Clock, MessageSquare } from "lucide-react";
import { useLocation } from "wouter";

// Types for live debates
type DebateRoom = {
  id: string;
  topicId: string;
  topicTitle: string;
  topicDescription: string;
  topicCategory: string;
  participant1Id: string;
  participant1Name: string;
  participant1Stance: string;
  participant2Id: string;
  participant2Name: string;
  participant2Stance: string;
  status: string;
  startedAt: string;
  messageCount: number;
};

type LiveStream = {
  id: string;
  topicId: string;
  topicTitle: string;
  title: string;
  description: string;
  moderatorId: string;
  moderatorName: string;
  status: string;
  startedAt: string;
  viewerCount: number;
  participantCount: number;
};

export default function LiveDebates() {
  const [, setLocation] = useLocation();

  // Fetch active debate rooms
  const { data: debateRooms, isLoading: loadingRooms } = useQuery<DebateRoom[]>({
    queryKey: ["/api/debate-rooms", { status: "active" }],
    queryFn: async () => {
      const response = await fetch("/api/debate-rooms?status=active");
      if (!response.ok) throw new Error("Failed to fetch debate rooms");
      return response.json();
    },
  });

  // Fetch live streams
  const { data: liveStreams, isLoading: loadingStreams } = useQuery<LiveStream[]>({
    queryKey: ["/api/live-streams", { status: "live" }],
    queryFn: async () => {
      const response = await fetch("/api/live-streams?status=live");
      if (!response.ok) throw new Error("Failed to fetch live streams");
      return response.json();
    },
  });

  const isLoading = loadingRooms || loadingStreams;
  const totalLive = (debateRooms?.length || 0) + (liveStreams?.length || 0);

  // Format time since started
  const getTimeSince = (startedAt: string) => {
    const minutes = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 sm:p-3 rounded-lg bg-red-500/10">
          <Radio className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" data-testid="heading-live-debates">
            Live Debates
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Join debates happening right now
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-lg bg-red-500/10">
                <Radio className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold" data-testid="stat-live-count">
                  {totalLive}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">Live Now</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-lg bg-blue-500/10">
                <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold" data-testid="stat-debate-rooms">
                  {debateRooms?.length || 0}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">Debate Rooms</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-lg bg-purple-500/10">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold" data-testid="stat-live-streams">
                  {liveStreams?.length || 0}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">Live Streams</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading live debates...</p>
          </div>
        </div>
      ) : totalLive === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Radio className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">No live debates right now</p>
            <p className="text-muted-foreground">
              Check back later or start your own debate
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Live Streams Section */}
          {liveStreams && liveStreams.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-500" />
                <h2 className="text-xl font-semibold">Live Streams</h2>
                <Badge variant="destructive" className="ml-2">
                  <Radio className="w-3 h-3 mr-1" />
                  LIVE
                </Badge>
              </div>
              <div className="grid grid-cols-1 gap-4" data-testid="list-live-streams">
                {liveStreams.map((stream) => (
                  <Card
                    key={stream.id}
                    className="cursor-pointer hover-elevate active-elevate-2"
                    onClick={() => setLocation(`/topic/${stream.topicId}`)}
                    data-testid={`card-live-stream-${stream.id}`}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive" className="animate-pulse">
                              <Radio className="w-3 h-3 mr-1" />
                              LIVE
                            </Badge>
                            <Badge variant="secondary">{stream.topicTitle}</Badge>
                          </div>
                          <h3 className="text-lg font-semibold">{stream.title}</h3>
                          {stream.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {stream.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              <span>{stream.viewerCount} viewers</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MessageSquare className="w-4 h-4" />
                              <span>{stream.participantCount} participants</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>{getTimeSince(stream.startedAt)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Debate Rooms Section */}
          {debateRooms && debateRooms.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-500" />
                <h2 className="text-xl font-semibold">One-on-One Debates</h2>
              </div>
              <div className="grid grid-cols-1 gap-4" data-testid="list-debate-rooms">
                {debateRooms.map((room) => (
                  <Card
                    key={room.id}
                    className="cursor-pointer hover-elevate active-elevate-2"
                    onClick={() => setLocation(`/topic/${room.topicId}`)}
                    data-testid={`card-debate-room-${room.id}`}
                  >
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary">{room.topicCategory}</Badge>
                          <Badge variant="outline" className="text-green-500 border-green-500">
                            <Radio className="w-3 h-3 mr-1 animate-pulse" />
                            Active
                          </Badge>
                        </div>
                        <h3 className="text-lg font-semibold">{room.topicTitle}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {room.topicDescription}
                        </p>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                                <Users className="w-4 h-4 text-green-500" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{room.participant1Name}</p>
                                <Badge variant="outline" className="text-xs">
                                  {room.participant1Stance}
                                </Badge>
                              </div>
                            </div>
                            <span className="text-muted-foreground">vs</span>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
                                <Users className="w-4 h-4 text-red-500" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{room.participant2Name}</p>
                                <Badge variant="outline" className="text-xs">
                                  {room.participant2Stance}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <MessageSquare className="w-4 h-4" />
                              <span>{room.messageCount} messages</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>{getTimeSince(room.startedAt)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
