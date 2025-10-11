import { useState } from "react";
import { useParams } from "wouter";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ThumbsUp, ThumbsDown, Brain } from "lucide-react";
import { ArrowLeft, MessageCircle, Users, TrendingUp, RefreshCw, Video, Calendar, Clock, Eye } from "lucide-react";
import { Link } from "wouter";
import { insertOpinionSchema, type Topic as TopicType, type Opinion, type CumulativeOpinion as CumulativeOpinionType } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import OpinionCard from "@/components/OpinionCard";
import ChallengeDialog from "@/components/ChallengeDialog";
import { formatDistanceToNow } from "date-fns";

const opinionFormSchema = insertOpinionSchema.omit({
  topicId: true,
  userId: true,
}).extend({
  content: z.string().min(1, "Opinion is required").max(2000, "Opinion too long"),
  stance: z.enum(["for", "against", "neutral"], { required_error: "Please select a stance" }),
});

export default function Topic() {
  const { id } = useParams();
  const { user } = useAuth();
  const [showOpinionForm, setShowOpinionForm] = useState(false);
  const [challengingOpinionId, setChallengingOpinionId] = useState<string | null>(null);
  const [flaggingOpinionId, setFlaggingOpinionId] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState("");

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

  // Fetch live streams for this topic
  const { data: liveStreams } = useQuery<any[]>({
    queryKey: ["/api/live-streams", { topicId: id }],
    enabled: !!id,
  });

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
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id, "cumulative"] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] }); // Invalidate topics list for updated counts
      queryClient.invalidateQueries({ queryKey: ["/api/stats/platform"] });
      opinionForm.reset();
      setShowOpinionForm(false);
    },
    onError: (error: any) => {
      console.error("Failed to save opinion:", error);
    },
  });

  // Generate cumulative opinion mutation
  const generateCumulativeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/topics/${id}/cumulative/generate`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id, "cumulative"] });
    },
    onError: (error: any) => {
      console.error("Failed to generate summary:", error);
    },
  });

  // Refresh cumulative opinion mutation
  const refreshCumulativeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('PATCH', `/api/topics/${id}/cumulative/refresh`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id, "cumulative"] });
    },
    onError: (error: any) => {
      console.error("Failed to refresh summary:", error);
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

  // Flag mutation
  const flagMutation = useMutation({
    mutationFn: async ({ opinionId, reason }: { opinionId: string; reason: string }) => {
      return apiRequest('POST', `/api/opinions/${opinionId}/flag`, { reason });
    },
    onSuccess: () => {
      setFlaggingOpinionId(null);
      setFlagReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id, "opinions"] });
    },
    onError: (error: any) => {
      console.error("Failed to flag opinion:", error);
    },
  });

  // Challenge mutation
  const challengeMutation = useMutation({
    mutationFn: async ({ opinionId, context }: { opinionId: string; context: string }) => {
      return apiRequest('POST', `/api/opinions/${opinionId}/challenge`, { context });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id, "opinions"] });
      setChallengingOpinionId(null);
    },
    onError: (error: any) => {
      console.error("Failed to challenge opinion:", error);
    },
  });

  // Adopt opinion mutation
  const adoptMutation = useMutation({
    mutationFn: async (opinionId: string) => {
      return apiRequest('POST', `/api/opinions/${opinionId}/adopt`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id, "opinions"] });
    },
    onError: (error: any) => {
      console.error("Failed to adopt opinion:", error);
    },
  });

  const opinionForm = useForm<z.infer<typeof opinionFormSchema>>({
    resolver: zodResolver(opinionFormSchema),
    defaultValues: {
      content: "",
      stance: "neutral",
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

  // Group live streams by status
  const pastStreams = liveStreams?.filter(s => s.status === 'ended') || [];
  const currentStreams = liveStreams?.filter(s => s.status === 'live') || [];
  const upcomingStreams = liveStreams?.filter(s => s.status === 'scheduled') || [];

  // Get opposite opinion users for chat
  const oppositeOpinions = userOpinion 
    ? opinions?.filter(o => 
        o.userId !== user?.id && 
        ((userOpinion.stance === 'for' && o.stance === 'against') || 
         (userOpinion.stance === 'against' && o.stance === 'for'))
      ) || []
    : [];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Back Button */}
      <Link href="/">
        <Button variant="ghost" size="sm" data-testid="button-back-home" className="transition-smooth">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Topics
        </Button>
      </Link>

      {/* Topic Title Above Image */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          {topic.categories.map((cat) => (
            <Badge key={cat} variant="secondary" className="shadow-sm">{cat}</Badge>
          ))}
          {topic.isActive && (
            <Badge className="bg-chart-1 text-white shadow-sm">
              <TrendingUp className="w-3 h-3 mr-1" />
              Active
            </Badge>
          )}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight" data-testid="text-topic-title">
          {topic.title}
        </h1>
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

      {/* Header Image */}
      <div className="aspect-[21/9] relative overflow-hidden rounded-lg border border-border/50" style={{ boxShadow: 'var(--shadow-lg)' }}>
        <img 
          src={topic.imageUrl || '/placeholder-topic.jpg'} 
          alt={topic.title}
          className="w-full h-full object-cover transition-smooth hover:scale-105"
        />
      </div>

      {/* AI Summary Section */}
      <Card className="border border-border/50" style={{ boxShadow: 'var(--shadow-md)' }}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-chart-3/10 border border-chart-3/20">
                <Brain className="w-5 h-5 text-chart-3" />
              </div>
              AI-Generated Summary
            </CardTitle>
            {cumulativeData && (
              <Button 
                variant="outline"
                size="sm"
                onClick={() => refreshCumulativeMutation.mutate()}
                disabled={refreshCumulativeMutation.isPending}
                data-testid="button-refresh-summary"
                className="transition-smooth"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {refreshCumulativeMutation.isPending ? "Updating..." : "Refresh"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {cumulativeData ? (
            <div className="space-y-4">
              <p className="text-base leading-relaxed">{cumulativeData.summary}</p>
              {cumulativeData.keyPoints && cumulativeData.keyPoints.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Key Points:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {cumulativeData.keyPoints.map((point, idx) => (
                      <li key={idx}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-chart-2">For {cumulativeData.supportingPercentage}%</Badge>
                  <Badge variant="destructive">Against {cumulativeData.opposingPercentage}%</Badge>
                  <Badge variant="secondary">Neutral {cumulativeData.neutralPercentage}%</Badge>
                </div>
                <span className="text-muted-foreground">
                  Based on {cumulativeData.totalOpinions} opinions
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">
                No AI summary available yet. Generate one to see the community perspective!
              </p>
              <Button 
                onClick={() => generateCumulativeMutation.mutate()}
                disabled={generateCumulativeMutation.isPending || !opinions || opinions.length === 0}
                data-testid="button-generate-summary"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {generateCumulativeMutation.isPending ? "Generating..." : "Generate AI Summary"}
              </Button>
              {(!opinions || opinions.length === 0) && (
                <p className="text-sm text-muted-foreground mt-2">
                  At least one opinion is needed to generate a summary
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Opinions Section with Tabs */}
      <Card className="border border-border/50" style={{ boxShadow: 'var(--shadow-md)' }}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            Opinions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="your-opinion" className="w-full">
            <TabsList className="w-full h-auto p-0 bg-transparent border-b rounded-none mb-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 w-full gap-0">
                <TabsTrigger 
                  value="your-opinion" 
                  data-testid="tab-your-opinion"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 sm:px-4 py-3 text-xs sm:text-sm"
                >
                  <span className="hidden sm:inline">Your Opinion</span>
                  <span className="sm:hidden">Yours</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="supporting" 
                  data-testid="tab-supporting"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 sm:px-4 py-3 text-xs sm:text-sm"
                >
                  <span className="hidden sm:inline">Supporting ({supportingOpinions.length})</span>
                  <span className="sm:hidden">For ({supportingOpinions.length})</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="neutral" 
                  data-testid="tab-neutral"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 sm:px-4 py-3 text-xs sm:text-sm"
                >
                  Neutral ({neutralOpinions.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="opposing" 
                  data-testid="tab-opposing"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 sm:px-4 py-3 text-xs sm:text-sm"
                >
                  <span className="hidden sm:inline">Opposing ({opposingOpinions.length})</span>
                  <span className="sm:hidden">Against ({opposingOpinions.length})</span>
                </TabsTrigger>
              </div>
            </TabsList>

            <TabsContent value="your-opinion" className="space-y-4">
              {userOpinion && !showOpinionForm ? (
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={userOpinion.stance === 'for' ? 'default' : userOpinion.stance === 'against' ? 'destructive' : 'secondary'}>
                        {userOpinion.stance}
                      </Badge>
                      <span className="text-sm text-muted-foreground">Your current opinion</span>
                    </div>
                    <p className="text-sm">{userOpinion.content}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      opinionForm.setValue('stance', userOpinion.stance as "for" | "against" | "neutral");
                      opinionForm.setValue('content', userOpinion.content);
                      setShowOpinionForm(true);
                    }}
                    data-testid="button-change-opinion"
                  >
                    Update Opinion
                  </Button>
                </div>
              ) : showOpinionForm ? (
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
                              <SelectItem value="for">For</SelectItem>
                              <SelectItem value="against">Against</SelectItem>
                              <SelectItem value="neutral">Neutral</SelectItem>
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
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          opinionForm.reset();
                          setShowOpinionForm(false);
                        }}
                        data-testid="button-cancel-opinion"
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createOpinionMutation.isPending}
                        data-testid="button-submit-opinion"
                      >
                        {createOpinionMutation.isPending ? "Sharing..." : "Share Opinion"}
                      </Button>
                    </div>
                  </form>
                </Form>
              ) : (
                <Button 
                  onClick={() => setShowOpinionForm(true)}
                  data-testid="button-add-opinion"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Add Your Opinion
                </Button>
              )}
            </TabsContent>

            <TabsContent value="supporting" className="space-y-3">
              {supportingOpinions.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {supportingOpinions.map((opinion: any) => (
                    <OpinionCard
                      key={opinion.id}
                      id={opinion.id}
                      topicId={opinion.topicId}
                      userId={opinion.userId}
                      userName="User"
                      content={opinion.content}
                      stance={opinion.stance}
                      timestamp={opinion.createdAt ? formatDistanceToNow(new Date(opinion.createdAt), { addSuffix: true }) : 'Unknown'}
                      likesCount={opinion.likesCount || 0}
                      dislikesCount={opinion.dislikesCount || 0}
                      challengesCount={opinion.challengesCount || 0}
                      isLiked={opinion.userVote?.voteType === 'like'}
                      isDisliked={opinion.userVote?.voteType === 'dislike'}
                      onLike={(id) => voteMutation.mutate({ 
                        opinionId: id, 
                        voteType: 'like',
                        currentVote: opinion.userVote?.voteType 
                      })}
                      onDislike={(id) => voteMutation.mutate({ 
                        opinionId: id, 
                        voteType: 'dislike',
                        currentVote: opinion.userVote?.voteType 
                      })}
                      onAdopt={(id) => adoptMutation.mutate(id)}
                      onChallenge={(id) => setChallengingOpinionId(id)}
                      onFlag={(id) => setFlaggingOpinionId(id)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No supporting opinions yet</p>
              )}
            </TabsContent>

            <TabsContent value="neutral" className="space-y-3">
              {neutralOpinions.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {neutralOpinions.map((opinion: any) => (
                    <OpinionCard
                      key={opinion.id}
                      id={opinion.id}
                      topicId={opinion.topicId}
                      userId={opinion.userId}
                      userName="User"
                      content={opinion.content}
                      stance={opinion.stance}
                      timestamp={opinion.createdAt ? formatDistanceToNow(new Date(opinion.createdAt), { addSuffix: true }) : 'Unknown'}
                      likesCount={opinion.likesCount || 0}
                      dislikesCount={opinion.dislikesCount || 0}
                      challengesCount={opinion.challengesCount || 0}
                      isLiked={opinion.userVote?.voteType === 'like'}
                      isDisliked={opinion.userVote?.voteType === 'dislike'}
                      onLike={(id) => voteMutation.mutate({ 
                        opinionId: id, 
                        voteType: 'like',
                        currentVote: opinion.userVote?.voteType 
                      })}
                      onDislike={(id) => voteMutation.mutate({ 
                        opinionId: id, 
                        voteType: 'dislike',
                        currentVote: opinion.userVote?.voteType 
                      })}
                      onAdopt={(id) => adoptMutation.mutate(id)}
                      onChallenge={(id) => setChallengingOpinionId(id)}
                      onFlag={(id) => setFlaggingOpinionId(id)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No neutral opinions yet</p>
              )}
            </TabsContent>

            <TabsContent value="opposing" className="space-y-3">
              {opposingOpinions.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {opposingOpinions.map((opinion: any) => (
                    <OpinionCard
                      key={opinion.id}
                      id={opinion.id}
                      topicId={opinion.topicId}
                      userId={opinion.userId}
                      userName="User"
                      content={opinion.content}
                      stance={opinion.stance}
                      timestamp={opinion.createdAt ? formatDistanceToNow(new Date(opinion.createdAt), { addSuffix: true }) : 'Unknown'}
                      likesCount={opinion.likesCount || 0}
                      dislikesCount={opinion.dislikesCount || 0}
                      challengesCount={opinion.challengesCount || 0}
                      isLiked={opinion.userVote?.voteType === 'like'}
                      isDisliked={opinion.userVote?.voteType === 'dislike'}
                      onLike={(id) => voteMutation.mutate({ 
                        opinionId: id, 
                        voteType: 'like',
                        currentVote: opinion.userVote?.voteType 
                      })}
                      onDislike={(id) => voteMutation.mutate({ 
                        opinionId: id, 
                        voteType: 'dislike',
                        currentVote: opinion.userVote?.voteType 
                      })}
                      onAdopt={(id) => adoptMutation.mutate(id)}
                      onChallenge={(id) => setChallengingOpinionId(id)}
                      onFlag={(id) => setFlaggingOpinionId(id)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No opposing opinions yet</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Live Streams Section */}
      {(currentStreams.length > 0 || upcomingStreams.length > 0 || pastStreams.length > 0) && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Live Debates</h2>
          
          {/* Current Streams */}
          {currentStreams.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Badge className="bg-red-500 text-white animate-pulse">Live Now</Badge>
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {currentStreams.map((stream) => (
                  <Link key={stream.id} href={`/live-stream/${stream.id}`}>
                    <Card className="hover-elevate active-elevate-2 cursor-pointer" data-testid={`card-stream-${stream.id}`}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-lg">{stream.title}</CardTitle>
                          <Badge className="bg-red-500 text-white shrink-0">
                            <Video className="w-3 h-3 mr-1" />
                            LIVE
                          </Badge>
                        </div>
                        {stream.description && (
                          <p className="text-sm text-muted-foreground mt-2">{stream.description}</p>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            <span>{stream.viewerCount || 0} viewers</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Streams */}
          {upcomingStreams.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Upcoming
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {upcomingStreams.map((stream) => (
                  <Link key={stream.id} href={`/live-stream/${stream.id}`}>
                    <Card className="hover-elevate active-elevate-2 cursor-pointer" data-testid={`card-stream-${stream.id}`}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-lg">{stream.title}</CardTitle>
                          <Badge variant="secondary" className="shrink-0">
                            <Calendar className="w-3 h-3 mr-1" />
                            Scheduled
                          </Badge>
                        </div>
                        {stream.description && (
                          <p className="text-sm text-muted-foreground mt-2">{stream.description}</p>
                        )}
                      </CardHeader>
                      <CardContent>
                        {stream.scheduledAt && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            <span>{new Date(stream.scheduledAt).toLocaleString()}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Past Streams */}
          {pastStreams.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Past Debates
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {pastStreams.slice(0, 4).map((stream) => (
                  <Link key={stream.id} href={`/live-stream/${stream.id}`}>
                    <Card className="hover-elevate active-elevate-2 cursor-pointer" data-testid={`card-stream-${stream.id}`}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-lg">{stream.title}</CardTitle>
                          <Badge variant="secondary" className="shrink-0">
                            Ended
                          </Badge>
                        </div>
                        {stream.description && (
                          <p className="text-sm text-muted-foreground mt-2">{stream.description}</p>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            <span>{stream.viewerCount || 0} viewers</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chat with Opposite Opinion Users */}
      {userOpinion && oppositeOpinions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Debate with Others</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Connect with {oppositeOpinions.length} {oppositeOpinions.length === 1 ? 'person' : 'people'} who {userOpinion.stance === 'for' ? 'disagree' : 'agree'} with you on this topic.
            </p>
            <Button data-testid="button-start-chat">
              <MessageCircle className="w-4 h-4 mr-2" />
              Start a Debate
            </Button>
          </CardContent>
        </Card>
      )}

      {userOpinion && oppositeOpinions.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <MessageCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              No one with an opposite opinion has shared their thoughts yet. Check back later!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Challenge Dialog */}
      <ChallengeDialog
        open={!!challengingOpinionId}
        onOpenChange={(open) => !open && setChallengingOpinionId(null)}
        onSubmit={(context) => {
          if (challengingOpinionId) {
            challengeMutation.mutate({ opinionId: challengingOpinionId, context });
          }
        }}
        isPending={challengeMutation.isPending}
      />

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
                disabled={!flagReason.trim() || flagMutation.isPending}
                data-testid="button-submit-flag"
              >
                {flagMutation.isPending ? "Flagging..." : "Flag Opinion"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
