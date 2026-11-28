import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import SwipeableCardStack from "@/components/SwipeableCardStack";
import { Card, CardContent } from "@/components/ui/card";
import { Flame, Users, Activity } from "lucide-react";
import { type TopicWithCounts } from "@shared/schema";

export default function HotDebates() {
  const { data: topics, isLoading } = useQuery<TopicWithCounts[]>({
    queryKey: ["/api/topics"],
  });
  const [topId, setTopId] = useState<string | null>(null);

  const sortedTopics = topics
    ? [...topics]
        .filter((t) => t.diversityScore != null && t.diversityScore > 0)
        .sort((a, b) => (b.diversityScore || 0) - (a.diversityScore || 0))
    : [];

  const totalParticipants = sortedTopics.reduce((sum, t) => sum + (t.participantCount || 0), 0);
  const avgDiversity =
    sortedTopics.length > 0
      ? Math.round(sortedTopics.reduce((sum, t) => sum + (t.diversityScore || 0), 0) / sortedTopics.length)
      : 0;

  const top = sortedTopics.find((t) => t.id === topId) ?? sortedTopics[0];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 sm:p-3 rounded-lg bg-warning/10">
          <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-warning" />
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

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-lg bg-warning/10">
                <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-warning" />
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
              <div className="p-2 sm:p-3 rounded-lg bg-info/10">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-info" />
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
              <div className="p-2 sm:p-3 rounded-lg bg-ai/10">
                <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-ai" />
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
        <div className="space-y-2 py-4" data-testid="list-hot-debates">
          <SwipeableCardStack
            topics={sortedTopics.map((topic) => ({
              ...topic,
              categories: topic.categories || [],
              opinionsCount: topic.opinionsCount ?? 0,
              imageUrl: topic.imageUrl || "",
            }))}
            testId="deck-hot-debates"
            onTopChange={(t) => setTopId(t.id)}
          />
          {top && (
            <p
              className="text-center font-ui text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
              data-testid="text-diversity-note"
            >
              Political diversity {top.diversityScore}%
            </p>
          )}
        </div>
      )}
    </div>
  );
}
