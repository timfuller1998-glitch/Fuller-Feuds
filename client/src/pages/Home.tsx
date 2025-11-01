import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TopicCard from "@/components/TopicCard";
import OpinionCard from "@/components/OpinionCard";
import { CardContainer } from "@/components/CardContainer";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { 
  TrendingUp,
  Radio,
  Flame,
  MessageCircle,
  Clock,
  ChevronRight,
  Grid
} from "lucide-react";
import type { TopicWithCounts } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import climateImage from '@assets/generated_images/Climate_change_debate_thumbnail_3b0bbda7.png';

interface SectionData {
  title: string;
  icon: any;
  topics: TopicWithCounts[];
  totalCount: number;
  linkPath?: string;
  type?: 'topics'; // default type
}

interface OpinionSectionData {
  title: string;
  icon: any;
  opinions: any[];
  totalCount: number;
  linkPath?: string;
  type: 'opinions';
}

type AnySectionData = SectionData | OpinionSectionData;

export default function Home() {
  const { user } = useAuth();

  // Fetch all topics
  const { data: apiTopics, isLoading: topicsLoading } = useQuery<TopicWithCounts[]>({
    queryKey: ["/api/topics"],
  });

  // Fetch user's active debate rooms
  const { data: activeDebateRooms } = useQuery<any[]>({
    queryKey: ["/api/users/me/debate-rooms"],
    enabled: !!user,
  });

  // Fetch recent opinions
  const { data: recentOpinions, isLoading: opinionsLoading } = useQuery<any[]>({
    queryKey: ["/api/opinions/recent"],
  });

  // Use real API topics with default image fallback
  const topics = apiTopics?.map(topic => ({
    ...topic,
    imageUrl: topic.imageUrl || climateImage,
    isActive: topic.isActive || false
  })) || [];

  // Create sections data
  const sections: AnySectionData[] = [];

  // 1. Trending - Most popular by participant count
  if (topics.length > 0) {
    const trendingTopics = [...topics]
      .sort((a, b) => b.participantCount - a.participantCount)
      .slice(0, 5);
    sections.push({
      title: "Trending",
      icon: TrendingUp,
      topics: trendingTopics,
      totalCount: topics.length,
      linkPath: "/trending"
    });
  }

  // 2. Hot Debates - Topics with most recent activity
  if (recentOpinions && recentOpinions.length > 0 && topics.length > 0) {
    // Group opinions by topic to find topics with recent activity
    const topicActivity = new Map<string, Date>();
    recentOpinions.forEach(opinion => {
      const currentDate = topicActivity.get(opinion.topicId);
      const opinionDate = new Date(opinion.createdAt || 0);
      if (!currentDate || opinionDate > currentDate) {
        topicActivity.set(opinion.topicId, opinionDate);
      }
    });

    const hotTopics = topics
      .filter(topic => topicActivity.has(topic.id))
      .sort((a, b) => {
        const dateA = topicActivity.get(a.id)?.getTime() || 0;
        const dateB = topicActivity.get(b.id)?.getTime() || 0;
        return dateB - dateA;
      })
      .slice(0, 5);

    if (hotTopics.length > 0) {
      sections.push({
        title: "Hot Debates",
        icon: Flame,
        topics: hotTopics,
        totalCount: topicActivity.size,
        linkPath: "/hot-debates"
      });
    }
  }

  // 3. My Topics - Topics where user has participated
  if (user && recentOpinions && topics.length > 0) {
    const myTopicIds = new Set(
      recentOpinions
        .filter(opinion => opinion.userId === user.id)
        .map(opinion => opinion.topicId)
    );
    const myTopics = topics
      .filter(topic => myTopicIds.has(topic.id))
      .slice(0, 5);

    if (myTopics.length > 0) {
      sections.push({
        title: "My Topics",
        icon: MessageCircle,
        topics: myTopics,
        totalCount: myTopicIds.size
      });
    }
  }

  // 4. My Current Debates - Active debate rooms as topic previews
  if (user && activeDebateRooms && activeDebateRooms.length > 0 && topics.length > 0) {
    const debateTopicIds = new Set(activeDebateRooms.map(room => room.topicId).filter(Boolean));
    const debateTopics = topics
      .filter(topic => debateTopicIds.has(topic.id))
      .slice(0, 5);

    if (debateTopics.length > 0) {
      sections.push({
        title: "My Current Debates",
        icon: MessageCircle,
        topics: debateTopics,
        totalCount: debateTopicIds.size
      });
    }
  }

  // 5. Recent Opinions - Display recent opinions directly
  if (recentOpinions && recentOpinions.length > 0) {
    sections.push({
      title: "Recent Opinions",
      icon: Clock,
      opinions: recentOpinions.slice(0, 5),
      totalCount: recentOpinions.length,
      linkPath: "/recent-opinions",
      type: 'opinions'
    });
  }

  // Show loading only while initial data is loading
  const isLoading = topicsLoading || opinionsLoading;
  
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

  return (
    <div className="space-y-6 sm:space-y-8 w-full overflow-x-hidden">
      {/* Hero Section */}
      <div className="text-center space-y-3 sm:space-y-4 py-4 sm:py-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight px-4">
          Where Ideas Collide
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
          Join meaningful debates on topics that matter. Share your opinions, discover different perspectives, and engage in thoughtful discussions.
        </p>
      </div>

      {/* Sections */}
      {sections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Grid className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-lg font-medium mb-2">No debates yet</p>
            <p className="text-muted-foreground">
              Be the first to create a topic and start a debate
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6 sm:space-y-8">
          {sections.map((section) => {
            const SectionIcon = section.icon;

            return (
              <div key={section.title} className="space-y-3 sm:space-y-4 overflow-hidden" data-testid={`section-${section.title.toLowerCase().replace(/\s+/g, '-')}`}>
                {/* Section Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10 flex-shrink-0">
                      <SectionIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg sm:text-xl font-semibold truncate" data-testid={`text-section-${section.title.toLowerCase().replace(/\s+/g, '-')}`}>
                        {section.title}
                      </h2>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {section.type === 'opinions' 
                          ? `${section.opinions.length} of ${section.totalCount} ${section.totalCount === 1 ? 'opinion' : 'opinions'}`
                          : `${section.topics.length} of ${section.totalCount} ${section.totalCount === 1 ? 'debate' : 'debates'}`
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* Horizontal Scrolling Items */}
                <div className="w-full overflow-hidden">
                  <div 
                    className="flex gap-3 sm:gap-4 overflow-x-auto overflow-y-hidden pb-2 sm:pb-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
                    style={{ 
                      scrollbarWidth: 'thin',
                      scrollSnapType: 'x mandatory'
                    }}
                    data-testid={`scroll-${section.type === 'opinions' ? 'opinions' : 'topics'}-${section.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {section.type === 'opinions' ? (
                      // Render Opinion Cards
                      <>
                        {section.opinions.map((opinion) => (
                          <CardContainer 
                            key={opinion.id}
                            style={{ scrollSnapAlign: 'start' }}
                          >
                            <OpinionCard
                              id={opinion.id}
                              topicId={opinion.topicId}
                              userId={opinion.userId}
                              userName={opinion.author?.firstName || 'Anonymous'}
                              userAvatar={opinion.author?.profileImageUrl}
                              politicalLeaningScore={opinion.author?.politicalLeaningScore}
                              economicScore={(opinion.author as any)?.economicScore}
                              authoritarianScore={(opinion.author as any)?.authoritarianScore}
                              content={opinion.content}
                              stance={opinion.stance}
                              debateStatus={opinion.debateStatus}
                              timestamp={formatDistanceToNow(new Date(opinion.createdAt), { addSuffix: true })}
                              likesCount={opinion.likesCount || 0}
                              dislikesCount={opinion.dislikesCount || 0}
                              references={opinion.references || []}
                              fallacyCounts={opinion.fallacyCounts || {}}
                              isLiked={opinion.userVote?.voteType === 'like'}
                              isDisliked={opinion.userVote?.voteType === 'dislike'}
                            />
                          </CardContainer>
                        ))}
                        {section.totalCount > 5 && section.linkPath && (
                          <CardContainer style={{ scrollSnapAlign: 'start' }}>
                            <Card className="h-full hover-elevate active-elevate-2 transition-all">
                              <CardContent className="flex flex-col items-center justify-center h-full min-h-[160px] sm:min-h-[200px] p-4 sm:p-6">
                                <SectionIcon className="w-8 h-8 sm:w-12 sm:h-12 text-muted-foreground mb-2 sm:mb-4" />
                                <p className="text-center text-sm sm:text-base font-medium mb-2">
                                  {section.totalCount - 5} more {section.totalCount - 5 === 1 ? 'opinion' : 'opinions'}
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  asChild
                                  data-testid={`button-viewall-${section.title.toLowerCase().replace(/\s+/g, '-')}`}
                                >
                                  <Link href={section.linkPath}>
                                    View All
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                  </Link>
                                </Button>
                              </CardContent>
                            </Card>
                          </CardContainer>
                        )}
                      </>
                    ) : (
                      // Render Topic Cards
                      <>
                        {section.topics.map((topic) => (
                          <CardContainer 
                            key={topic.id}
                            style={{ scrollSnapAlign: 'start' }}
                          >
                            <TopicCard
                              id={topic.id}
                              title={topic.title}
                              description={topic.description}
                              categories={topic.categories}
                              opinionsCount={topic.opinionsCount}
                              participantCount={topic.participantCount}
                              isActive={topic.isActive ?? true}
                              imageUrl={topic.imageUrl ?? climateImage}
                              previewContent={topic.previewContent}
                              previewAuthor={topic.previewAuthor}
                              previewIsAI={topic.previewIsAI}
                              diversityScore={topic.diversityScore}
                              politicalDistribution={topic.politicalDistribution}
                            />
                          </CardContainer>
                        ))}
                        {section.totalCount > 5 && section.linkPath && (
                          <CardContainer style={{ scrollSnapAlign: 'start' }}>
                            <Card className="h-full hover-elevate active-elevate-2 transition-all">
                              <CardContent className="flex flex-col items-center justify-center h-full min-h-[160px] sm:min-h-[200px] p-4 sm:p-6">
                                <SectionIcon className="w-8 h-8 sm:w-12 sm:h-12 text-muted-foreground mb-2 sm:mb-4" />
                                <p className="text-center text-sm sm:text-base font-medium mb-2">
                                  {section.totalCount - 5} more {section.totalCount - 5 === 1 ? 'debate' : 'debates'}
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  asChild
                                  data-testid={`button-viewall-${section.title.toLowerCase().replace(/\s+/g, '-')}`}
                                >
                                  <Link href={section.linkPath}>
                                    View All
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                  </Link>
                                </Button>
                              </CardContent>
                            </Card>
                          </CardContainer>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
