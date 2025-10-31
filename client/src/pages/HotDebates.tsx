import { useQuery } from "@tanstack/react-query";
import TopicCard from "@/components/TopicCard";
import { Card, CardContent } from "@/components/ui/card";
import { Flame, Users, Activity } from "lucide-react";
import { type TopicWithCounts } from "@shared/schema";

export default function HotDebates() {
  // Fetch topics sorted by political diversity
  const { data: topics, isLoading } = useQuery<TopicWithCounts[]>({
    queryKey: ["/api/topics"],
  });

  // Sort by diversity score (copy array to avoid cache mutation)
  const sortedTopics = topics ? [...topics]
    .filter(t => t.diversityScore !== undefined && t.diversityScore > 0)
    .sort((a, b) => (b.diversityScore || 0) - (a.diversityScore || 0)) : [];

  // Calculate aggregate stats
  const totalOpinions = sortedTopics.reduce((sum, t) => sum + (t.opinionsCount || 0), 0);
  const totalParticipants = sortedTopics.reduce((sum, t) => sum + (t.participantCount || 0), 0);
  const avgDiversity = sortedTopics.length > 0
    ? Math.round(sortedTopics.reduce((sum, t) => sum + (t.diversityScore || 0), 0) / sortedTopics.length)
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
            const distribution = topic.politicalDistribution;
            const diversityScore = topic.diversityScore || 0;
            const hasDistribution = distribution && 
              (distribution.authoritarianCapitalist > 0 || 
               distribution.authoritarianSocialist > 0 || 
               distribution.libertarianCapitalist > 0 || 
               distribution.libertarianSocialist > 0);

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
                      diversityScore={topic.diversityScore}
                    />
                  </div>
                  {/* Political Diversity Indicator */}
                  <div className="border-t bg-muted/30 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-medium">Political Diversity</span>
                      </div>
                      <span className="text-sm font-bold text-purple-500">{diversityScore}%</span>
                    </div>
                    {hasDistribution && distribution && (
                      <div className="space-y-2">
                        <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-background">
                          {distribution.authoritarianCapitalist > 0 && (
                            <div
                              className="bg-red-500"
                              style={{ width: `${distribution.authoritarianCapitalist}%` }}
                              title={`Authoritarian Capitalist: ${distribution.authoritarianCapitalist}%`}
                            />
                          )}
                          {distribution.authoritarianSocialist > 0 && (
                            <div
                              className="bg-blue-500"
                              style={{ width: `${distribution.authoritarianSocialist}%` }}
                              title={`Authoritarian Socialist: ${distribution.authoritarianSocialist}%`}
                            />
                          )}
                          {distribution.libertarianCapitalist > 0 && (
                            <div
                              className="bg-yellow-500"
                              style={{ width: `${distribution.libertarianCapitalist}%` }}
                              title={`Libertarian Capitalist: ${distribution.libertarianCapitalist}%`}
                            />
                          )}
                          {distribution.libertarianSocialist > 0 && (
                            <div
                              className="bg-green-500"
                              style={{ width: `${distribution.libertarianSocialist}%` }}
                              title={`Libertarian Socialist: ${distribution.libertarianSocialist}%`}
                            />
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span>Auth. Cap.: {distribution.authoritarianCapitalist}%</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span>Auth. Soc.: {distribution.authoritarianSocialist}%</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-yellow-500" />
                            <span>Lib. Cap.: {distribution.libertarianCapitalist}%</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span>Lib. Soc.: {distribution.libertarianSocialist}%</span>
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
