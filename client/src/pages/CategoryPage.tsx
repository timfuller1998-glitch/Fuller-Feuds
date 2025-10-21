import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import TopicCard from "@/components/TopicCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Folder, Radio, Eye, Clock, Users } from "lucide-react";
import { type TopicWithCounts, type LiveStream } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

// Map category names to their icons
import { Gavel, Cpu, Globe, Briefcase, GraduationCap, Heart } from "lucide-react";

const categoryIcons: Record<string, any> = {
  Politics: Gavel,
  Technology: Cpu,
  Environment: Globe,
  Business: Briefcase,
  Education: GraduationCap,
  Health: Heart,
};

export default function CategoryPage() {
  const params = useParams<{ category: string }>();
  const category = params.category;
  const [, setLocation] = useLocation();

  // Fetch topics for this category using default fetcher
  const queryParams = new URLSearchParams();
  if (category) queryParams.append("category", category);
  const { data: apiTopics, isLoading: topicsLoading, error: topicsError } = useQuery<TopicWithCounts[]>({
    queryKey: [`/api/topics?${queryParams.toString()}`],
    enabled: !!category,
  });

  // Fetch live streams for this category
  const streamQueryParams = new URLSearchParams();
  if (category) streamQueryParams.append("category", category);
  const { data: liveStreams, isLoading: streamsLoading } = useQuery<LiveStream[]>({
    queryKey: [`/api/live-streams?${streamQueryParams.toString()}`],
    enabled: !!category,
  });

  // Transform API topics to include required TopicCard props
  const topics = apiTopics?.map(topic => ({
    id: topic.id,
    title: topic.title,
    description: topic.description,
    imageUrl: topic.imageUrl || "",
    categories: topic.categories,
    participantCount: topic.participantCount,
    opinionsCount: topic.opinionsCount,
    isActive: topic.isActive ?? true,
    previewContent: topic.previewContent,
    previewAuthor: topic.previewAuthor,
    previewIsAI: topic.previewIsAI
  }));

  const isLoading = topicsLoading || streamsLoading;
  const error = topicsError;

  const CategoryIcon = categoryIcons[category || ""] || Folder;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading debates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CategoryIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">Failed to load debates</p>
          <p className="text-muted-foreground">
            There was an error loading debates for {category}. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getTimeSince = (dateString: string | null) => {
    if (!dateString) return "Unknown";
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return "Unknown";
    }
  };

  return (
    <div className="space-y-6">
      {/* Category Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-lg bg-primary/10">
          <CategoryIcon className="w-8 h-8 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold" data-testid="text-category-title">
            {category}
          </h1>
          <p className="text-muted-foreground mt-1">
            Explore debates and discussions about {category?.toLowerCase()}
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {topics?.length || 0} debates
        </Badge>
      </div>

      {/* Live Streams Section */}
      {liveStreams && liveStreams.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-red-500" />
            <h2 className="text-xl font-semibold">Live Streams</h2>
            <Badge variant="destructive" className="ml-2 animate-pulse">
              {liveStreams.length} LIVE
            </Badge>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {liveStreams.map((stream) => (
              <Card
                key={stream.id}
                className="cursor-pointer hover-elevate active-elevate-2"
                onClick={() => setLocation(`/live-stream/${stream.id}`)}
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
                      </div>
                      <h3 className="text-lg font-semibold">{stream.title}</h3>
                      {stream.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {stream.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          <span>{stream.viewerCount || 0} viewers</span>
                        </div>
                        {stream.startedAt && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{getTimeSince(stream.startedAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Topics Grid */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Topics</h2>
        {topics && topics.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {topics.map((topic) => (
              <TopicCard key={topic.id} {...topic} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <CategoryIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">No debates yet</p>
              <p className="text-muted-foreground">
                Be the first to start a debate in {category}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
