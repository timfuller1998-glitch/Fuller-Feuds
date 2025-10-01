import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter/use-browser-location";
import TopicCard from "@/components/TopicCard";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Flame, Zap } from "lucide-react";
import { type Topic } from "@shared/schema";

// Extended topic type with counts (API may return these)
type TopicWithCounts = Topic & {
  opinionsCount?: number;
  participantCount?: number;
};

export default function Trending() {
  const searchParams = new URLSearchParams(useSearch());
  const searchQuery = searchParams.get("q") || "";

  // Fetch trending topics from API
  const { data: topics, isLoading } = useQuery<TopicWithCounts[]>({
    queryKey: ["/api/topics", { search: searchQuery, sort: "trending" }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      const response = await fetch(`/api/topics?${params}`);
      if (!response.ok) throw new Error("Failed to fetch topics");
      return response.json();
    },
  });

  // Sort by engagement metrics (opinionsCount) - default to createdAt for now
  const sortedTopics = topics?.sort((a, b) => {
    const aEngagement = (a.opinionsCount || 0);
    const bEngagement = (b.opinionsCount || 0);
    if (aEngagement !== bEngagement) {
      return bEngagement - aEngagement;
    }
    // Fallback to newest first
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  }) || [];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 sm:p-3 rounded-lg bg-primary/10">
          <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" data-testid="heading-trending">
            Trending Debates
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Explore the hottest topics right now
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-lg bg-orange-500/10">
                <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold" data-testid="stat-trending-count">
                  {sortedTopics.length}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">Trending Topics</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-lg bg-blue-500/10">
                <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold" data-testid="stat-total-opinions">
                  {sortedTopics.reduce((sum, t) => sum + (t.opinionsCount || 0), 0)}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">Total Opinions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-lg bg-green-500/10">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold" data-testid="stat-active-debates">
                  {sortedTopics.filter(t => t.isActive).length}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">Active Debates</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trending Topics List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading trending topics...</p>
          </div>
        </div>
      ) : sortedTopics.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">No trending topics found</p>
            <p className="text-muted-foreground">
              {searchQuery ? "Try a different search term" : "Check back later for trending debates"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4" data-testid="list-trending-topics">
          {sortedTopics.map((topic, index) => (
            <div key={topic.id} className="relative">
              {index < 3 && (
                <div className="absolute -left-2 -top-2 z-10">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                    {index + 1}
                  </div>
                </div>
              )}
              <TopicCard
                id={topic.id}
                title={topic.title}
                description={topic.description}
                category={topic.category}
                opinionsCount={topic.opinionsCount || 0}
                participantCount={topic.participantCount || 0}
                isActive={topic.isActive ?? true}
                imageUrl={topic.imageUrl || "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800"}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
