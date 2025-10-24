import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import OpinionCard from "@/components/OpinionCard";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { 
  MessageCircle,
  Clock,
  TrendingUp
} from "lucide-react";
import type { Opinion, Topic, TopicWithCounts } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

interface OpinionWithTopic extends Opinion {
  topic?: Topic;
  userVote?: { voteType: 'like' | 'dislike' } | null;
}

interface TopicGroup {
  topic: TopicWithCounts;
  opinions: OpinionWithTopic[];
  mostRecentDate: Date;
}

export default function RecentOpinionsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [flaggingOpinionId, setFlaggingOpinionId] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState("");

  // Fetch user profile for sort preferences
  const { data: userProfile } = useQuery<any>({
    queryKey: ['/api/profile', user?.id],
    queryFn: () => fetch(`/api/profile/${user?.id}`, { credentials: 'include' }).then(res => res.json()),
    enabled: !!user?.id,
  });

  const categorySortPref = (userProfile?.profile?.categorySortPreference || 'popular') as 'popular' | 'alphabetical' | 'newest' | 'oldest';
  const opinionSortPref = (userProfile?.profile?.opinionSortPreference || 'newest') as 'newest' | 'oldest' | 'most_liked' | 'most_controversial';

  // Fetch recent opinions
  const { data: recentOpinions, isLoading: opinionsLoading } = useQuery<OpinionWithTopic[]>({
    queryKey: ["/api/opinions/recent"],
    queryFn: () => fetch('/api/opinions/recent?limit=100', { credentials: 'include' }).then(res => res.json()),
  });

  // Fetch all topics to get topic details
  const { data: topics } = useQuery<TopicWithCounts[]>({
    queryKey: ["/api/topics"],
  });

  // Group opinions by topic
  const topicGroups: TopicGroup[] = recentOpinions && topics
    ? (() => {
        const topicMap = new Map<string, TopicGroup>();
        
        recentOpinions.forEach(opinion => {
          const topic = topics.find(t => t.id === opinion.topicId);
          if (!topic) return;
          
          if (!topicMap.has(opinion.topicId)) {
            topicMap.set(opinion.topicId, {
              topic,
              opinions: [],
              mostRecentDate: new Date(0)
            });
          }
          
          const group = topicMap.get(opinion.topicId)!;
          group.opinions.push({ ...opinion, topic });
          
          const opinionDate = new Date(opinion.createdAt || 0);
          if (opinionDate > group.mostRecentDate) {
            group.mostRecentDate = opinionDate;
          }
        });

        // Convert to array
        let groupsArray = Array.from(topicMap.values());

        // Sort topics based on user's category sort preference
        switch (categorySortPref) {
          case 'popular':
            groupsArray.sort((a, b) => b.topic.opinionsCount - a.topic.opinionsCount);
            break;
          case 'alphabetical':
            groupsArray.sort((a, b) => a.topic.title.localeCompare(b.topic.title));
            break;
          case 'newest':
            groupsArray.sort((a, b) => b.mostRecentDate.getTime() - a.mostRecentDate.getTime());
            break;
          case 'oldest':
            groupsArray.sort((a, b) => a.mostRecentDate.getTime() - b.mostRecentDate.getTime());
            break;
        }

        // Sort opinions within each topic based on user's opinion sort preference
        groupsArray.forEach(group => {
          switch (opinionSortPref) {
            case 'newest':
              group.opinions.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
              break;
            case 'oldest':
              group.opinions.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
              break;
            case 'most_liked':
              group.opinions.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
              break;
            case 'most_controversial':
              group.opinions.sort((a, b) => {
                const aControversy = (a.likesCount || 0) + (a.dislikesCount || 0);
                const bControversy = (b.likesCount || 0) + (b.dislikesCount || 0);
                return bControversy - aControversy;
              });
              break;
          }
        });

        return groupsArray;
      })()
    : [];

  // Vote mutation
  const voteMutation = {
    mutate: async ({ opinionId, voteType }: { opinionId: string; voteType: 'like' | 'dislike' | null }) => {
      return apiRequest('POST', `/api/opinions/${opinionId}/vote`, { voteType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opinions/recent"] });
    },
  };

  // Flag mutation
  const flagMutation = {
    mutate: async ({ opinionId, reason }: { opinionId: string; reason: string }) => {
      return apiRequest('POST', `/api/opinions/${opinionId}/flag`, { reason });
    },
    onSuccess: () => {
      setFlaggingOpinionId(null);
      setFlagReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/opinions/recent"] });
    },
  };

  // Adopt mutation
  const adoptMutation = {
    mutate: async (opinionId: string) => {
      return apiRequest('POST', `/api/opinions/${opinionId}/adopt`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opinions/recent"] });
    },
  };

  // Start debate mutation
  const startDebateWithOpinionMutation = {
    mutate: async (opinionId: string) => {
      const response = await apiRequest('POST', `/api/opinions/${opinionId}/start-debate`, {});
      const room = await response.json();
      window.location.href = `/debate-room/${room.id}`;
    },
    onError: (error: any) => {
      alert(error.message || "Failed to start debate");
    },
  };

  const handleVote = (opinionId: string, currentVote: 'like' | 'dislike' | null, newVote: 'like' | 'dislike') => {
    const voteType = currentVote === newVote ? null : newVote;
    voteMutation.mutate({ opinionId, voteType });
  };

  if (opinionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Loading recent opinions...</p>
        </div>
      </div>
    );
  }

  if (!recentOpinions || recentOpinions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Recent Opinions</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No recent opinions yet. Be the first to share your thoughts!</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Recent Opinions</h1>
            <p className="text-muted-foreground">Latest thoughts from the community</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="w-4 h-4" />
          <span>
            Sorted by: {categorySortPref === 'popular' ? 'Most Popular' : 
                       categorySortPref === 'alphabetical' ? 'A-Z' :
                       categorySortPref === 'newest' ? 'Newest' : 'Oldest'}
          </span>
        </div>
      </div>

      {/* Topics with Opinions */}
      <div className="space-y-8">
        {topicGroups.map((group) => (
          <div key={group.topic.id} className="space-y-4">
            {/* Topic Header */}
            <div>
              <Link href={`/topic/${group.topic.id}`}>
                <h2 className="text-2xl font-bold hover-elevate active-elevate-2 inline-block rounded px-2 py-1 -mx-2" data-testid={`link-topic-${group.topic.id}`}>
                  {group.topic.title}
                </h2>
              </Link>
              <p className="text-muted-foreground mt-1">{group.topic.description}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {group.topic.categories.map((cat) => (
                  <Badge 
                    key={cat} 
                    variant="secondary" 
                    className="cursor-pointer hover-elevate"
                    onClick={() => setLocation(`/?category=${encodeURIComponent(cat)}`)}
                    data-testid={`badge-category-${cat.toLowerCase()}`}
                  >
                    {cat}
                  </Badge>
                ))}
                <Badge variant="outline" className="ml-2">
                  <MessageCircle className="w-3 h-3 mr-1" />
                  {group.topic.opinionsCount} opinions
                </Badge>
              </div>
            </div>

            {/* Opinions Horizontal Scroll */}
            <div 
              className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
              style={{ scrollSnapType: 'x mandatory' }}
            >
              {group.opinions.slice(0, 5).map((opinion) => (
                <div 
                  key={opinion.id} 
                  className="flex-none w-[320px] sm:w-[380px]"
                  style={{ scrollSnapAlign: 'start' }}
                >
                  <OpinionCard
                    id={opinion.id}
                    topicId={opinion.topicId}
                    userId={opinion.userId}
                    userName={opinion.author ? `${opinion.author.firstName || ''} ${opinion.author.lastName || ''}`.trim() || 'Anonymous' : 'Anonymous'}
                    userAvatar={opinion.author?.profileImageUrl}
                    politicalLeaningScore={opinion.author?.politicalLeaningScore}
                    economicScore={(opinion.author as any)?.economicScore}
                    authoritarianScore={(opinion.author as any)?.authoritarianScore}
                    content={opinion.content}
                    stance={opinion.stance as "for" | "against" | "neutral"}
                    debateStatus={opinion.debateStatus}
                    timestamp={formatDistanceToNow(new Date(opinion.createdAt!), { addSuffix: true })}
                    likesCount={opinion.likesCount || 0}
                    dislikesCount={opinion.dislikesCount || 0}
                    references={opinion.references || []}
                    fallacyCounts={opinion.fallacyCounts || {}}
                    isLiked={opinion.userVote?.voteType === 'like'}
                    isDisliked={opinion.userVote?.voteType === 'dislike'}
                    onLike={() => handleVote(opinion.id, opinion.userVote?.voteType || null, 'like')}
                    onDislike={() => handleVote(opinion.id, opinion.userVote?.voteType || null, 'dislike')}
                    onAdopt={() => adoptMutation.mutate(opinion.id)}
                    onDebate={() => startDebateWithOpinionMutation.mutate(opinion.id)}
                  />
                </div>
              ))}
              {group.opinions.length > 5 && (
                <div 
                  className="flex-none w-[280px] sm:w-[300px]"
                  style={{ scrollSnapAlign: 'start' }}
                >
                  <Card className="h-full flex items-center justify-center hover-elevate active-elevate-2 cursor-pointer" onClick={() => setLocation(`/topic/${group.topic.id}`)}>
                    <CardContent className="text-center py-12">
                      <MessageCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                      <p className="font-medium">View {group.opinions.length - 5} More</p>
                      <p className="text-sm text-muted-foreground">Explore all opinions</p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Flag Dialog */}
      <Dialog open={!!flaggingOpinionId} onOpenChange={(open) => !open && setFlaggingOpinionId(null)}>
        <DialogContent onClick={(e) => e.stopPropagation()} data-testid="dialog-flag-opinion">
          <DialogHeader>
            <DialogTitle>Flag Opinion</DialogTitle>
            <DialogDescription>
              Report this opinion if it violates community guidelines. Please provide a reason for flagging.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              placeholder="Why are you flagging this opinion? (e.g., spam, harassment, misinformation)"
              rows={4}
              data-testid="textarea-flag-reason"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setFlaggingOpinionId(null);
                  setFlagReason("");
                }}
                data-testid="button-cancel-flag"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (flaggingOpinionId && flagReason.trim()) {
                    flagMutation.mutate({ opinionId: flaggingOpinionId, reason: flagReason.trim() });
                  }
                }}
                disabled={!flagReason.trim()}
                data-testid="button-submit-flag"
              >
                Submit Flag
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
