import { useQuery } from "@tanstack/react-query";
import TopicCard from "@/components/TopicCard";
import { Card, CardContent } from "@/components/ui/card";
import { Flame, Users, TrendingUp, Activity } from "lucide-react";
import { type Topic } from "@shared/schema";

// Extended topic type with diversity metrics
type TopicWithDiversity = Topic & {
  opinionsCount?: number;
  participantCount?: number;
  forCount?: number;
  againstCount?: number;
  neutralCount?: number;
  diversityScore?: number;
  recentActivity?: number;
  previewContent?: string;
  previewAuthor?: string;
  previewIsAI?: boolean;
};

export default function HotDebates() {
  // Fetch topics with diversity metrics
  const { data: topics, isLoading } = useQuery<TopicWithDiversity[]>({
    queryKey: ["/api/topics", { sort: "hot" }],
    queryFn: async () => {
      const response = await fetch("/api/topics?sort=hot");
      if (!response.ok) throw new Error("Failed to fetch topics");
      return response.json();
    },
  });

  // Calculate diversity metrics for display
  const calculateDiversityScore = (topic: TopicWithDiversity) => {
    const total = (topic.forCount || 0) + (topic.againstCount || 0) + (topic.neutralCount || 0);
    if (total === 0) return 0;

    // Calculate how evenly distributed opinions are
    const forPct = (topic.forCount || 0) / total;
    const againstPct = (topic.againstCount || 0) / total;
    const neutralPct = (topic.neutralCount || 0) / total;

    // Shannon entropy for diversity (higher = more diverse)
    const entropy = -[forPct, againstPct, neutralPct]
      .filter(p => p > 0)
      .reduce((sum, p) => sum + p * Math.log2(p), 0);

    // Normalize by max entropy (log2(3) ≈ 1.585) and convert to percentage
    return Math.round((entropy / Math.log2(3)) * 100);
  };

  // Sort by diversity score and recent activity (copy array to avoid cache mutation)
  const sortedTopics = topics ? [...topics].sort((a, b) => {
    const aScore = (a.diversityScore || calculateDiversityScore(a)) + (a.recentActivity || 0) * 0.1;
    const bScore = (b.diversityScore || calculateDiversityScore(b)) + (b.recentActivity || 0) * 0.1;
    return bScore - aScore;
  }) : [];

  // Calculate aggregate stats
  const totalOpinions = sortedTopics.reduce((sum, t) => sum + (t.opinionsCount || 0), 0);
  const totalParticipants = sortedTopics.reduce((sum, t) => sum + (t.participantCount || 0), 0);
  const avgDiversity = sortedTopics.length > 0
    ? Math.round(sortedTopics.reduce((sum, t) => sum + (t.diversityScore || calculateDiversityScore(t)), 0) / sortedTopics.length)
    : 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 sm:p-3 rounded-lg bg-orange-500/10">
          <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" data-testid="heading-hot-debates">
            Hot Debates
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Topics with the most diverse and active discussions
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-lg bg-orange-500/10">
                <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold" data-testid="stat-hot-debates">
                  {sortedTopics.length}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">Hot Debates</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-lg bg-blue-500/10">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold" data-testid="stat-total-participants">
                  {totalParticipants}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">Participants</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-lg bg-purple-500/10">
                <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold" data-testid="stat-avg-diversity">
                  {avgDiversity}%
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">Avg Diversity</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hot Topics List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading hot debates...</p>
          </div>
        </div>
      ) : sortedTopics.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Flame className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">No hot debates found</p>
            <p className="text-muted-foreground">
              Hot debates appear when topics have diverse and active discussions
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4" data-testid="list-hot-debates">
          {sortedTopics.map((topic, index) => {
            const diversityScore = topic.diversityScore || calculateDiversityScore(topic);
            const total = (topic.forCount || 0) + (topic.againstCount || 0) + (topic.neutralCount || 0);

            return (
              <div key={topic.id} className="relative">
                {index < 3 && (
                  <div className="absolute -left-2 -top-2 z-10">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                      {index + 1}
                    </div>
                  </div>
                )}
                <Card className="overflow-hidden">
                  <div className="relative">
                    <TopicCard
                      id={topic.id}
                      title={topic.title}
                      description={topic.description}
                      categories={topic.categories || []}
                      opinionsCount={topic.opinionsCount || 0}
                      participantCount={topic.participantCount || 0}
                      isActive={topic.isActive ?? true}
                      imageUrl={topic.imageUrl || ""}
                      previewContent={topic.previewContent}
                      previewAuthor={topic.previewAuthor}
                      previewIsAI={topic.previewIsAI}
                    />
                  </div>
                  {/* Diversity Indicator */}
                  <div className="border-t bg-muted/30 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-medium">Opinion Diversity</span>
                      </div>
                      <span className="text-sm font-bold text-purple-500">{diversityScore}%</span>
                    </div>
                    {total > 0 && (
                      <div className="space-y-2">
                        <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-background">
                          {topic.forCount! > 0 && (
                            <div
                              className="bg-green-500"
                              style={{ width: `${(topic.forCount! / total) * 100}%` }}
                            />
                          )}
                          {topic.againstCount! > 0 && (
                            <div
                              className="bg-red-500"
                              style={{ width: `${(topic.againstCount! / total) * 100}%` }}
                            />
                          )}
                          {topic.neutralCount! > 0 && (
                            <div
                              className="bg-gray-500"
                              style={{ width: `${(topic.neutralCount! / total) * 100}%` }}
                            />
                          )}
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span>For: {topic.forCount}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span>Against: {topic.againstCount}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-gray-500" />
                            <span>Neutral: {topic.neutralCount}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
