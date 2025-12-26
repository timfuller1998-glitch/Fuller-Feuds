import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StackSection from "@/components/StackSection";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { TopicWithCounts } from "@shared/schema";
import { 
  TrendingUp,
  Radio,
  Flame,
  MessageCircle,
  Grid,
  Clock,
  Calendar,
  MessageSquare,
  Users
} from "lucide-react";
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
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

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
  if (topics.length > 0) {
    // Group opinions by topic to find topics with recent activity
    const topicActivity = new Map<string, Date>();
    if (recentOpinions && recentOpinions.length > 0) {
      recentOpinions.forEach(opinion => {
        const currentDate = topicActivity.get(opinion.topicId);
        const opinionDate = new Date(opinion.createdAt || 0);
        if (!currentDate || opinionDate > currentDate) {
          topicActivity.set(opinion.topicId, opinionDate);
        }
      });
    }

    const hotTopics = topics
      .filter(topic => topicActivity.has(topic.id) || topics.length <= 5)
      .sort((a, b) => {
        const dateA = topicActivity.get(a.id)?.getTime() || 0;
        const dateB = topicActivity.get(b.id)?.getTime() || 0;
        if (dateA !== dateB) {
          return dateB - dateA;
        }
        // Fallback to participant count if no activity
        return b.participantCount - a.participantCount;
      })
      .slice(0, 5);

    if (hotTopics.length > 0 || topics.length > 0) {
      sections.push({
        title: "Hot Debates",
        icon: Flame,
        topics: hotTopics.length > 0 ? hotTopics : topics.slice(0, 5),
        totalCount: topicActivity.size || topics.length,
        linkPath: "/hot-debates"
      });
    }
  }

  // 3. New This Week - Topics created in the last 7 days
  if (topics.length > 0) {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const newTopics = topics
      .filter(topic => {
        const createdAt = new Date(topic.createdAt || 0);
        return createdAt >= oneWeekAgo;
      })
      .sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, 5);

    // Show section even if no new topics this week, use newest topics instead
    const topicsToShow = newTopics.length > 0 
      ? newTopics 
      : [...topics].sort((a, b) => {
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateB - dateA;
        }).slice(0, 5);

    sections.push({
      title: "New This Week",
      icon: Calendar,
      topics: topicsToShow,
      totalCount: newTopics.length || topics.length
    });
  }

  // 4. Most Debated - Sort by opinionsCount
  if (topics.length > 0) {
    const mostDebated = [...topics]
      .sort((a, b) => (b.opinionsCount || 0) - (a.opinionsCount || 0))
      .slice(0, 5);
    sections.push({
      title: "Most Debated",
      icon: MessageSquare,
      topics: mostDebated,
      totalCount: topics.length
    });
  }

  // 5. Diverse Perspectives - Filter by diversityScore
  if (topics.length > 0) {
    const diverseTopics = topics
      .filter(topic => (topic.diversityScore || 0) > 0)
      .sort((a, b) => (b.diversityScore || 0) - (a.diversityScore || 0))
      .slice(0, 5);

    // Show section even if no diverse topics, use topics with most participants instead
    const topicsToShow = diverseTopics.length > 0
      ? diverseTopics
      : [...topics].sort((a, b) => b.participantCount - a.participantCount).slice(0, 5);

    sections.push({
      title: "Diverse Perspectives",
      icon: Users,
      topics: topicsToShow,
      totalCount: diverseTopics.length || topics.length
    });
  }

  // 6. My Topics - Topics where user has participated
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

  // 7. My Current Debates - Active debate rooms as topic previews
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

  // Swipe mutation
  const swipeMutation = useMutation({
    mutationFn: async ({ topicId, direction }: { topicId: string; direction: 'left' | 'right' }) => {
      return apiRequest('POST', `/api/topics/${topicId}/swipe`, { direction });
    },
  });

  // Handle swipe
  const handleSwipe = async (
    topic: TopicWithCounts,
    direction: 'left' | 'right' | 'up',
    cardState: { isFlipped: boolean; timeOnBackMs: number }
  ) => {
    // If swiped up, we need to trigger the opinion form
    // This will be handled by exposing a way to open it from the card
    // For now, we'll handle it by tracking that they want to add an opinion
    if (direction === 'up') {
      // The opinion dialog opening will be handled by modifying TopicCard
      // to accept a prop that triggers the form
      return;
    }

    // For left/right swipes, track the preference
    if (isAuthenticated && (direction === 'left' || direction === 'right')) {
      try {
        await swipeMutation.mutateAsync({
          topicId: topic.id,
          direction,
        });
      } catch (error) {
        console.error('Error recording swipe:', error);
      }
    }
  };

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

  // Filter to only topic sections (exclude opinion sections for now)
  const topicSections = sections.filter((s): s is SectionData => s.type !== 'opinions');

  return (
    <div className="h-[100dvh] overflow-y-auto snap-y snap-mandatory -webkit-overflow-scrolling-touch">
      {/* Stack Sections */}
      {topicSections.length === 0 ? (
        <section className="min-h-[100dvh] snap-start flex items-center justify-center">
          <Card>
            <CardContent className="py-12 text-center">
              <Grid className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-lg font-medium mb-2">No debates yet</p>
              <p className="text-muted-foreground">
                Be the first to create a topic and start a debate
              </p>
            </CardContent>
          </Card>
        </section>
      ) : (
        topicSections.map((section) => (
          <StackSection
            key={section.title}
            title={section.title}
            icon={section.icon}
            sectionKey={section.title.toLowerCase().replace(/\s+/g, '-')}
            topics={section.topics}
            onSwipe={handleSwipe}
          />
        ))
      )}

      {/* Hero Section - Footer */}
      <section className="min-h-[100dvh] snap-start flex flex-col items-center justify-center px-4 py-8">
        <div className="text-center space-y-3 sm:space-y-4">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
            Every opinion. One fair fight.
          </h1>
          <div className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed space-y-1">
            <p>Submit your opinion. Change the summary</p>
            <p>Debate 1v1. no comments, no crowd.</p>
            <p>See both sides or step in to change minds.</p>
            <p>Break echo chamber, one fair fight at a time.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
