import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ThumbsUp, ThumbsDown, Brain, Flag } from "lucide-react";
import { ArrowLeft, MessageCircle, Users, TrendingUp, RefreshCw, Video, Calendar, Clock, Eye, Link as LinkIcon, Plus, X } from "lucide-react";
import { Link } from "wouter";
import { insertOpinionSchema, type Topic as TopicType, type Opinion, type CumulativeOpinion as CumulativeOpinionType } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import OpinionCard from "@/components/OpinionCard";
import TopicCard from "@/components/TopicCard";
import { CardContainer } from "@/components/CardContainer";
import { AdoptOpinionDialog } from "@/components/AdoptOpinionDialog";
import { DebateOnboardingModal } from "@/components/DebateOnboardingModal";
import FallacyBadges from "@/components/FallacyBadges";
import FallacyFlagDialog from "@/components/FallacyFlagDialog";
import { formatDistanceToNow } from "date-fns";
import type { FallacyType } from "@shared/fallacies";

const opinionFormSchema = insertOpinionSchema.omit({
  topicId: true,
  userId: true,
}).extend({
  content: z.string().min(1, "Opinion is required").max(2000, "Opinion too long"),
  stance: z.enum(["for", "against", "neutral"], { required_error: "Please select a stance" }),
  debateStatus: z.enum(["open", "closed", "private"], { required_error: "Please select debate availability" }),
  references: z.array(z.string().url("Must be a valid URL")).optional().default([]),
});

export default function Topic() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showOpinionForm, setShowOpinionForm] = useState(false);
  const [showTopicFlagDialog, setShowTopicFlagDialog] = useState(false);
  const [showAdoptDialog, setShowAdoptDialog] = useState(false);
  const [opinionToAdopt, setOpinionToAdopt] = useState<any>(null);
  const [showDebateOnboarding, setShowDebateOnboarding] = useState(false);
  const [debateOpinionId, setDebateOpinionId] = useState<string | null>(null);
  const [debateOpponentName, setDebateOpponentName] = useState<string>("");

  // Fetch topic details
  const { data: topic, isLoading: topicLoading } = useQuery<TopicType>({
    queryKey: ["/api/topics", id],
    queryFn: async () => {
      const response = await fetch(`/api/topics/${id}`);
      if (!response.ok) throw new Error("Failed to fetch topic");
      return response.json();
    },
    enabled: !!id,
  });

  // Record topic view when user visits
  useEffect(() => {
    if (id && user?.id) {
      apiRequest('POST', `/api/topics/${id}/view`).catch(err => {
        console.error("Failed to record topic view:", err);
      });
    }
  }, [id, user?.id]);

  // Fetch opinions for the topic
  const { data: opinions } = useQuery<Opinion[]>({
    queryKey: ["/api/topics", id, "opinions"],
    queryFn: async () => {
      const response = await fetch(`/api/topics/${id}/opinions`);
      if (!response.ok) throw new Error("Failed to fetch opinions");
      return response.json();
    },
    enabled: !!id,
  });

  // Fetch cumulative opinion
  const { data: cumulativeData } = useQuery<CumulativeOpinionType>({
    queryKey: ["/api/topics", id, "cumulative"],
    queryFn: async () => {
      const response = await fetch(`/api/topics/${id}/cumulative`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error("Failed to fetch cumulative opinion");
      }
      return response.json();
    },
    enabled: !!id,
  });

  // Fetch user's profile for opinion sort preference
  const { data: userProfile } = useQuery<{ opinionSortPreference?: string }>({
    queryKey: ["/api/profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const response = await fetch(`/api/profile/${user.id}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.profile;
    },
    enabled: !!user?.id,
  });

  // Fetch user's debate rooms
  const { data: debateRooms } = useQuery<any[]>({
    queryKey: ["/api/users/me/debate-rooms"],
    enabled: !!user?.id,
  });

  // Fetch similar topics
  const { data: similarTopicsRaw } = useQuery<TopicType[]>({
    queryKey: ["/api/topics/search-similar", topic?.title],
    queryFn: async () => {
      if (!topic?.title) return [];
      const response = await fetch(`/api/topics/search-similar?query=${encodeURIComponent(topic.title)}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!topic?.title,
  });

  // Filter out the current topic from similar topics
  const similarTopics = similarTopicsRaw?.filter(t => t.id !== id) || [];

  // Get user's opinion on this topic to determine stance
  const userOpinion = opinions?.find(o => o.userId === user?.id);

  // Sort opinions based on user preference
  const sortOpinions = (opinionList: Opinion[]) => {
    const sortPref = userProfile?.opinionSortPreference || 'newest';
    const sorted = [...opinionList];
    
    switch (sortPref) {
      case 'oldest':
        return sorted.sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return aTime - bTime;
        });
      case 'most_liked':
        return sorted.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
      case 'most_controversial':
        return sorted.sort((a, b) => {
          const aTotalVotes = (a.likesCount || 0) + (a.dislikesCount || 0);
          const bTotalVotes = (b.likesCount || 0) + (b.dislikesCount || 0);
          return bTotalVotes - aTotalVotes;
        });
      case 'newest':
      default:
        return sorted.sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });
    }
  };

  // Filter opinions by stance
  const supportingOpinions = sortOpinions(opinions?.filter(o => o.stance === 'for' && o.userId !== user?.id) || []);
  const neutralOpinions = sortOpinions(opinions?.filter(o => o.stance === 'neutral' && o.userId !== user?.id) || []);
  const opposingOpinions = sortOpinions(opinions?.filter(o => o.stance === 'against' && o.userId !== user?.id) || []);

  // Filter debate rooms for this topic
  const topicDebateRooms = debateRooms?.filter(room => room.topicId === id) || [];

  // Create opinion mutation
  const createOpinionMutation = useMutation({
    mutationFn: async (data: z.infer<typeof opinionFormSchema>) => {
      if (userOpinion) {
        return apiRequest('PATCH', `/api/opinions/${userOpinion.id}`, data);
      }
      return apiRequest('POST', `/api/topics/${id}/opinions`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id, "opinions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] }); // Invalidate topics list for updated counts
      queryClient.invalidateQueries({ queryKey: ["/api/stats/platform"] });
      opinionForm.reset();
      setShowOpinionForm(false);
      
      // Poll for summary updates after opinion creation
      // Start polling after a short delay to give AI time to start processing
      let pollAttempts = 0;
      const maxAttempts = 15; // 15 attempts = 45 seconds max
      const pollInterval = 3000; // 3 seconds
      
      const pollForSummary = setInterval(() => {
        pollAttempts++;
        queryClient.invalidateQueries({ queryKey: ["/api/topics", id, "cumulative"] });
        
        if (pollAttempts >= maxAttempts) {
          clearInterval(pollForSummary);
        }
      }, pollInterval);
      
      // Clear interval when component unmounts or after max time
      setTimeout(() => clearInterval(pollForSummary), pollInterval * maxAttempts);
    },
    onError: (error: any) => {
      console.error("Failed to save opinion:", error);
    },
  });

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: async ({ opinionId, voteType, currentVote }: { opinionId: string; voteType: 'like' | 'dislike'; currentVote?: 'like' | 'dislike' | null }) => {
      // If clicking the same vote type, remove it. Otherwise, set new vote type
      const newVoteType = currentVote === voteType ? null : voteType;
      return apiRequest('POST', `/api/opinions/${opinionId}/vote`, { voteType: newVoteType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id, "opinions"] });
    },
    onError: (error: any) => {
      console.error("Failed to vote:", error);
    },
  });

  // Adopt opinion mutation
  const adoptMutation = useMutation({
    mutationFn: async ({ opinionId, content, stance }: { opinionId: string, content: string, stance: "for" | "against" | "neutral" }) => {
      return apiRequest('POST', `/api/opinions/${opinionId}/adopt`, { content, stance });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id, "opinions"] });
      setShowAdoptDialog(false);
      setOpinionToAdopt(null);
      toast({
        title: "Opinion adopted",
        description: "Your opinion has been successfully updated.",
      });
    },
    onError: (error: any) => {
      console.error("Failed to adopt opinion:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to adopt opinion",
        variant: "destructive",
      });
    },
  });

  // Start debate with opinion author
  const startDebateWithOpinionMutation = useMutation({
    mutationFn: async ({ opinionId, openingMessage }: { opinionId: string; openingMessage: string }) => {
      const response = await apiRequest('POST', `/api/opinions/${opinionId}/start-debate`, { openingMessage });
      return response.json();
    },
    onSuccess: (room) => {
      toast({
        title: "Debate started!",
        description: "Navigating to debate room...",
      });
      setShowDebateOnboarding(false);
      navigate(`/debate-room/${room.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Cannot start debate",
        description: error.message || "Failed to start debate",
        variant: "destructive",
      });
    },
  });

  // Handler to open debate onboarding modal
  const handleStartDebate = (opinionId: string, opponentName: string) => {
    setDebateOpinionId(opinionId);
    setDebateOpponentName(opponentName);
    setShowDebateOnboarding(true);
  };

  // Handler to submit debate with opening message
  const handleSubmitDebate = (openingMessage: string) => {
    if (debateOpinionId) {
      startDebateWithOpinionMutation.mutate({ opinionId: debateOpinionId, openingMessage });
    }
  };

  // Flag topic mutation
  const flagTopicMutation = useMutation({
    mutationFn: async (fallacyType: FallacyType) => {
      const response = await fetch(`/api/topics/${id}/flag`, {
        method: "POST",
        body: JSON.stringify({ fallacyType }),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Flag submitted",
        description: "Thank you for helping keep debates productive.",
      });
      setShowTopicFlagDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit flag",
        variant: "destructive",
      });
    },
  });

  // Start debate mutation
  const startDebateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/topics/${id}/match-debate`, {});
      return response.json();
    },
    onSuccess: (room) => {
      // Navigate to the newly created debate room
      navigate(`/debate-room/${room.id}`);
    },
    onError: (error: any) => {
      console.error("Failed to start debate:", error);
      alert(error.message || "Failed to start debate. Please try again.");
    },
  });

  const opinionForm = useForm<z.infer<typeof opinionFormSchema>>({
    resolver: zodResolver(opinionFormSchema),
    defaultValues: {
      content: "",
      stance: "neutral",
      debateStatus: "open",
    },
  });

  const onSubmitOpinion = (data: z.infer<typeof opinionFormSchema>) => {
    createOpinionMutation.mutate(data);
  };

  if (topicLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading topic...</p>
        </div>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">Topic not found</h2>
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>
      </div>
    );
  }

  // Get opposite opinion users for chat
  const oppositeOpinions = userOpinion 
    ? opinions?.filter(o => 
        o.userId !== user?.id && 
        ((userOpinion.stance === 'for' && o.stance === 'against') || 
         (userOpinion.stance === 'against' && o.stance === 'for'))
      ) || []
    : [];

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Back Button */}
      <Link href="/">
        <Button variant="ghost" size="sm" data-testid="button-back-home">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Topics
        </Button>
      </Link>

      {/* Header Section with Title and AI Summary Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Categories and Active Badge */}
          <div className="flex items-center gap-2 flex-wrap">
            {topic.categories.map((cat) => (
              <Badge 
                key={cat} 
                variant="secondary"
                className="cursor-pointer hover-elevate"
                onClick={() => navigate(`/category/${encodeURIComponent(cat)}`)}
                data-testid={`badge-category-${cat.toLowerCase()}`}
              >
                {cat}
              </Badge>
            ))}
            {topic.isActive && (
              <Badge className="bg-chart-1 text-white">
                <TrendingUp className="w-3 h-3 mr-1" />
                Active
              </Badge>
            )}
          </div>

          {/* Title and Flag Button */}
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight" data-testid="text-topic-title">
              {topic.title}
            </h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTopicFlagDialog(true)}
              data-testid="button-flag-topic"
              className="flex-shrink-0"
            >
              <Flag className="w-4 h-4 mr-2" />
              Flag
            </Button>
          </div>
          
          {/* Display fallacy badges if any */}
          {topic.fallacyCounts && Object.keys(topic.fallacyCounts).some(key => (topic.fallacyCounts?.[key] || 0) > 0) && (
            <div>
              <FallacyBadges fallacyCounts={topic.fallacyCounts} />
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              <span data-testid="text-opinions-count">{opinions?.length || 0} opinions</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span data-testid="text-participants-count">
                {opinions ? new Set(opinions.map(o => o.userId)).size : 0} participants
              </span>
            </div>
          </div>
        </div>

        {/* AI Summary Card */}
        {cumulativeData && (
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" />
                AI Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed">{cumulativeData.summary}</p>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                <div className="text-center">
                  <div className="text-lg font-bold text-primary">{cumulativeData.supportingPercentage || 0}%</div>
                  <div className="text-xs text-muted-foreground">For</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-muted-foreground">{cumulativeData.neutralPercentage || 0}%</div>
                  <div className="text-xs text-muted-foreground">Neutral</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-destructive">{cumulativeData.opposingPercentage || 0}%</div>
                  <div className="text-xs text-muted-foreground">Against</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* "You" Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">You</h2>
          <Badge variant="outline">{(userOpinion ? 1 : 0) + topicDebateRooms.length}</Badge>
        </div>
        
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-4 pb-4">
            {/* User's Opinion Card or Share Opinion Button */}
            <CardContainer>
              {userOpinion && !showOpinionForm ? (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Your Opinion</CardTitle>
                      <Badge variant={userOpinion.stance === 'for' ? 'default' : userOpinion.stance === 'against' ? 'destructive' : 'secondary'}>
                        {userOpinion.stance}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm leading-relaxed">{userOpinion.content}</p>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          opinionForm.setValue('stance', userOpinion.stance as "for" | "against" | "neutral");
                          opinionForm.setValue('content', userOpinion.content);
                          opinionForm.setValue('debateStatus', (userOpinion.debateStatus || "open") as "open" | "closed" | "private");
                          opinionForm.setValue('references', userOpinion.references || []);
                          setShowOpinionForm(true);
                        }}
                        data-testid="button-change-opinion"
                      >
                        Update
                      </Button>
                      {oppositeOpinions.length > 0 && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => startDebateMutation.mutate()}
                          disabled={startDebateMutation.isPending}
                          data-testid="button-find-random-debate"
                        >
                          <MessageCircle className="w-3 h-3 mr-1" />
                          {startDebateMutation.isPending ? "Matching..." : "Find Debate"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="h-full flex items-center justify-center min-h-[200px]">
                  <CardContent className="text-center">
                    <Button 
                      variant="default" 
                      onClick={() => setShowOpinionForm(true)}
                      data-testid="button-share-opinion"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Share Your Opinion
                    </Button>
                  </CardContent>
                </Card>
              )}
            </CardContainer>

            {/* User's Active Debate Cards */}
            {topicDebateRooms.map((room) => {
              const opponent = room.participants?.find((p: any) => p.userId !== user?.id);
              return (
                <CardContainer key={room.id}>
                  <Link href={`/debate-room/${room.id}`}>
                    <Card className="hover-elevate active-elevate-2 cursor-pointer h-full">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Debate</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={opponent?.user?.profileImageUrl} />
                          <AvatarFallback>
                            {opponent?.user?.firstName?.[0]}{opponent?.user?.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">
                            vs {opponent?.user?.firstName} {opponent?.user?.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {room.phase} • {room.turnCount || 0} turns
                          </p>
                        </div>
                      </div>
                    </CardContent>
                    </Card>
                  </Link>
                </CardContainer>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* "For" Section */}
      {supportingOpinions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">For</h2>
            <Badge variant="default">{supportingOpinions.length}</Badge>
          </div>
          
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-4 pb-4">
              {supportingOpinions.map((opinion: any) => (
                <CardContainer key={opinion.id}>
                  <OpinionCard
                    id={opinion.id}
                    topicId={id!}
                    userId={opinion.userId}
                    userName={opinion.author ? `${opinion.author.firstName || ''} ${opinion.author.lastName || ''}`.trim() || 'Anonymous' : 'Anonymous'}
                    userAvatar={opinion.author?.profileImageUrl}
                    economicScore={opinion.author?.economicScore}
                    authoritarianScore={opinion.author?.authoritarianScore}
                    topicEconomicScore={opinion.topicEconomicScore}
                    topicAuthoritarianScore={opinion.topicAuthoritarianScore}
                    content={opinion.content}
                    stance={opinion.stance}
                    debateStatus={opinion.debateStatus}
                    timestamp={opinion.createdAt ? formatDistanceToNow(new Date(opinion.createdAt), { addSuffix: true }) : 'unknown'}
                    likesCount={opinion.likesCount || 0}
                    dislikesCount={opinion.dislikesCount || 0}
                    references={opinion.references}
                    fallacyCounts={opinion.fallacyCounts}
                    isLiked={opinion.userVote === 'like'}
                    isDisliked={opinion.userVote === 'dislike'}
                    onLike={(opinionId) => voteMutation.mutate({ 
                      opinionId, 
                      voteType: 'like', 
                      currentVote: opinion.userVote 
                    })}
                    onDislike={(opinionId) => voteMutation.mutate({ 
                      opinionId, 
                      voteType: 'dislike', 
                      currentVote: opinion.userVote 
                    })}
                    onAdopt={(opinionId) => {
                      const opinionData = opinions?.find(o => o.id === opinionId);
                      setOpinionToAdopt(opinionData);
                      setShowAdoptDialog(true);
                    }}
                    onDebate={(opinionId) => {
                      const opinionData = opinions?.find(o => o.id === opinionId);
                      handleStartDebate(
                        opinionId, 
                        opinionData?.author ? `${opinionData.author.firstName || ''} ${opinionData.author.lastName || ''}`.trim() || 'Anonymous' : 'Anonymous'
                      );
                    }}
                  />
                </CardContainer>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

      {/* "Neutral" Section */}
      {neutralOpinions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Neutral</h2>
            <Badge variant="secondary">{neutralOpinions.length}</Badge>
          </div>
          
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-4 pb-4">
              {neutralOpinions.map((opinion: any) => (
                <CardContainer key={opinion.id}>
                  <OpinionCard
                    id={opinion.id}
                    topicId={id!}
                    userId={opinion.userId}
                    userName={opinion.author ? `${opinion.author.firstName || ''} ${opinion.author.lastName || ''}`.trim() || 'Anonymous' : 'Anonymous'}
                    userAvatar={opinion.author?.profileImageUrl}
                    economicScore={opinion.author?.economicScore}
                    authoritarianScore={opinion.author?.authoritarianScore}
                    topicEconomicScore={opinion.topicEconomicScore}
                    topicAuthoritarianScore={opinion.topicAuthoritarianScore}
                    content={opinion.content}
                    stance={opinion.stance}
                    debateStatus={opinion.debateStatus}
                    timestamp={opinion.createdAt ? formatDistanceToNow(new Date(opinion.createdAt), { addSuffix: true }) : 'unknown'}
                    likesCount={opinion.likesCount || 0}
                    dislikesCount={opinion.dislikesCount || 0}
                    references={opinion.references}
                    fallacyCounts={opinion.fallacyCounts}
                    isLiked={opinion.userVote === 'like'}
                    isDisliked={opinion.userVote === 'dislike'}
                    onLike={(opinionId) => voteMutation.mutate({ 
                      opinionId, 
                      voteType: 'like', 
                      currentVote: opinion.userVote 
                    })}
                    onDislike={(opinionId) => voteMutation.mutate({ 
                      opinionId, 
                      voteType: 'dislike', 
                      currentVote: opinion.userVote 
                    })}
                    onAdopt={(opinionId) => {
                      const opinionData = opinions?.find(o => o.id === opinionId);
                      setOpinionToAdopt(opinionData);
                      setShowAdoptDialog(true);
                    }}
                    onDebate={(opinionId) => {
                      const opinionData = opinions?.find(o => o.id === opinionId);
                      handleStartDebate(
                        opinionId, 
                        opinionData?.author ? `${opinionData.author.firstName || ''} ${opinionData.author.lastName || ''}`.trim() || 'Anonymous' : 'Anonymous'
                      );
                    }}
                  />
                </CardContainer>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

      {/* "Against" Section */}
      {opposingOpinions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Against</h2>
            <Badge variant="destructive">{opposingOpinions.length}</Badge>
          </div>
          
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-4 pb-4">
              {opposingOpinions.map((opinion: any) => (
                <CardContainer key={opinion.id}>
                  <OpinionCard
                    id={opinion.id}
                    topicId={id!}
                    userId={opinion.userId}
                    userName={opinion.author ? `${opinion.author.firstName || ''} ${opinion.author.lastName || ''}`.trim() || 'Anonymous' : 'Anonymous'}
                    userAvatar={opinion.author?.profileImageUrl}
                    economicScore={opinion.author?.economicScore}
                    authoritarianScore={opinion.author?.authoritarianScore}
                    topicEconomicScore={opinion.topicEconomicScore}
                    topicAuthoritarianScore={opinion.topicAuthoritarianScore}
                    content={opinion.content}
                    stance={opinion.stance}
                    debateStatus={opinion.debateStatus}
                    timestamp={opinion.createdAt ? formatDistanceToNow(new Date(opinion.createdAt), { addSuffix: true }) : 'unknown'}
                    likesCount={opinion.likesCount || 0}
                    dislikesCount={opinion.dislikesCount || 0}
                    references={opinion.references}
                    fallacyCounts={opinion.fallacyCounts}
                    isLiked={opinion.userVote === 'like'}
                    isDisliked={opinion.userVote === 'dislike'}
                    onLike={(opinionId) => voteMutation.mutate({ 
                      opinionId, 
                      voteType: 'like', 
                      currentVote: opinion.userVote 
                    })}
                    onDislike={(opinionId) => voteMutation.mutate({ 
                      opinionId, 
                      voteType: 'dislike', 
                      currentVote: opinion.userVote 
                    })}
                    onAdopt={(opinionId) => {
                      const opinionData = opinions?.find(o => o.id === opinionId);
                      setOpinionToAdopt(opinionData);
                      setShowAdoptDialog(true);
                    }}
                    onDebate={(opinionId) => {
                      const opinionData = opinions?.find(o => o.id === opinionId);
                      handleStartDebate(
                        opinionId, 
                        opinionData?.author ? `${opinionData.author.firstName || ''} ${opinionData.author.lastName || ''}`.trim() || 'Anonymous' : 'Anonymous'
                      );
                    }}
                  />
                </CardContainer>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

      {/* Similar Topics Section */}
      {similarTopics && similarTopics.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Similar Topics</h2>
            <Badge variant="outline">{similarTopics.length}</Badge>
          </div>
          
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-4 pb-4">
              {similarTopics.slice(0, 10).map((similarTopic: any) => (
                <CardContainer key={similarTopic.id}>
                  <TopicCard
                    id={similarTopic.id}
                    title={similarTopic.title}
                    description={similarTopic.description || ''}
                    imageUrl={similarTopic.imageUrl || ''}
                    categories={similarTopic.categories}
                    participantCount={similarTopic.participantCount || 0}
                    opinionsCount={similarTopic.opinionsCount || 0}
                    isActive={similarTopic.isActive || false}
                    previewContent={similarTopic.previewContent}
                    previewAuthor={similarTopic.previewAuthor}
                    previewIsAI={similarTopic.previewIsAI}
                    diversityScore={similarTopic.diversityScore}
                    politicalDistribution={similarTopic.politicalDistribution}
                  />
                </CardContainer>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

      {/* Opinion Form Dialog */}
      <Dialog open={showOpinionForm} onOpenChange={setShowOpinionForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{userOpinion ? 'Update Your Opinion' : 'Share Your Opinion'}</DialogTitle>
            <DialogDescription>
              {userOpinion ? 'Modify your existing opinion on this topic.' : 'Share your thoughts on this topic.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...opinionForm}>
            <form onSubmit={opinionForm.handleSubmit(onSubmitOpinion)} className="space-y-4">
              <FormField
                control={opinionForm.control}
                name="stance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Stance</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-stance">
                          <SelectValue placeholder="Select your stance" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="for" data-testid="option-stance-for">For</SelectItem>
                        <SelectItem value="against" data-testid="option-stance-against">Against</SelectItem>
                        <SelectItem value="neutral" data-testid="option-stance-neutral">Neutral</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={opinionForm.control}
                name="debateStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Debate Availability</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-debate-status">
                          <SelectValue placeholder="Select debate availability" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="open" data-testid="option-debate-open">
                          Open for Debate - Others can challenge this opinion
                        </SelectItem>
                        <SelectItem value="closed" data-testid="option-debate-closed">
                          Not Debatable - Opinion is public but read-only
                        </SelectItem>
                        <SelectItem value="private" data-testid="option-debate-private">
                          Private - Only visible to you
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={opinionForm.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Opinion</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Share your thoughts..."
                        className="min-h-[120px]"
                        data-testid="input-opinion-content"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2 justify-end pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowOpinionForm(false)}
                  data-testid="button-cancel-opinion"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createOpinionMutation.isPending}
                  data-testid="button-submit-opinion"
                >
                  {createOpinionMutation.isPending ? 'Saving...' : userOpinion ? 'Update Opinion' : 'Share Opinion'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Topic Flag Dialog */}
      <FallacyFlagDialog
        open={showTopicFlagDialog}
        onOpenChange={setShowTopicFlagDialog}
        onSubmit={(fallacyType) => flagTopicMutation.mutate(fallacyType)}
        isPending={flagTopicMutation.isPending}
        entityType="topic"
      />

      {/* Adopt Opinion Dialog */}
      <AdoptOpinionDialog
        open={showAdoptDialog}
        onOpenChange={setShowAdoptDialog}
        currentOpinion={userOpinion ? {
          content: userOpinion.content,
          stance: userOpinion.stance as "for" | "against" | "neutral"
        } : null}
        opinionToAdopt={opinionToAdopt ? {
          content: opinionToAdopt.content,
          stance: opinionToAdopt.stance,
          authorName: opinionToAdopt.author ? `${opinionToAdopt.author.firstName || ''} ${opinionToAdopt.author.lastName || ''}`.trim() || 'Anonymous' : 'Anonymous'
        } : null}
        onAdopt={(content, stance) => {
          if (opinionToAdopt) {
            adoptMutation.mutate({ 
              opinionId: opinionToAdopt.id, 
              content, 
              stance 
            });
          }
        }}
        isPending={adoptMutation.isPending}
      />

      {/* Debate Onboarding Modal */}
      <DebateOnboardingModal
        open={showDebateOnboarding}
        onOpenChange={setShowDebateOnboarding}
        onSubmit={handleSubmitDebate}
        isPending={startDebateWithOpinionMutation.isPending}
        opponentName={debateOpponentName}
      />
    </div>
  );
}
