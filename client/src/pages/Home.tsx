import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import SearchBar from "@/components/SearchBar";
import TopicCard from "@/components/TopicCard";
import LiveDebateRoom from "@/components/LiveDebateRoom";
import OpinionCard from "@/components/OpinionCard";
import CumulativeOpinion from "@/components/CumulativeOpinion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, MessageCircle, Users, Plus, Radio, Eye, RefreshCw, Zap, Mic, ChevronRight, Clock, Link as LinkIcon, X } from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { insertTopicSchema, insertOpinionSchema, type Topic, type TopicWithCounts, type Opinion, type CumulativeOpinion as CumulativeOpinionType } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import climateImage from '@assets/generated_images/Climate_change_debate_thumbnail_3b0bbda7.png';

const topicFormSchema = insertTopicSchema.omit({
  createdById: true,  // Server will set this from authenticated user
}).extend({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().min(1, "Description is required").max(1000, "Description too long"),
  categories: z.array(z.string()).min(1, "At least one category is required"),
});

const opinionFormSchema = insertOpinionSchema.omit({
  topicId: true,  // Server will set this from URL params
  userId: true,   // Server will set this from authenticated user
}).extend({
  content: z.string().min(1, "Opinion is required").max(2000, "Opinion too long"),
  stance: z.enum(["for", "against", "neutral"], { required_error: "Please select a stance" }),
  references: z.array(z.string().url().or(z.literal(''))).optional().default([]),
});

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [viewingLiveStream, setViewingLiveStream] = useState<string | null>(null);
  const [viewingLiveDebate, setViewingLiveDebate] = useState<string | null>(null);
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [showCreateOpinion, setShowCreateOpinion] = useState(false);
  const [flaggingOpinionId, setFlaggingOpinionId] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState("");

  // Fetch platform statistics
  const { data: stats } = useQuery<{
    totalTopics: number;
    liveStreams: number;
    totalParticipants: number;
    totalCategories: number;
  }>({
    queryKey: ['/api/stats/platform'],
  });

  // Fetch real topics from API  
  const { data: apiTopics, isLoading: topicsLoading } = useQuery<TopicWithCounts[]>({
    queryKey: ["/api/topics", { search: searchQuery }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      const response = await fetch(`/api/topics?${params}`);
      if (!response.ok) throw new Error("Failed to fetch topics");
      return response.json();
    }
  });

  // Fetch opinions for selected topic
  const { data: apiOpinions } = useQuery<Opinion[]>({
    queryKey: ["/api/topics", selectedTopic, "opinions"],
    queryFn: async () => {
      if (!selectedTopic) return [];
      const response = await fetch(`/api/topics/${selectedTopic}/opinions`);
      if (!response.ok) throw new Error("Failed to fetch opinions");
      return response.json();
    },
    enabled: !!selectedTopic,
  });

  // Fetch cumulative opinion for selected topic
  const { data: cumulativeData } = useQuery<CumulativeOpinionType>({
    queryKey: ["/api/topics", selectedTopic, "cumulative"],
    queryFn: async () => {
      if (!selectedTopic) return null;
      const response = await fetch(`/api/topics/${selectedTopic}/cumulative`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error("Failed to fetch cumulative opinion");
      }
      return response.json();
    },
    enabled: !!selectedTopic,
  });

  // Fetch recent opinions for preview
  const { data: recentOpinions } = useQuery<Opinion[]>({
    queryKey: ["/api/opinions/recent"],
    queryFn: () => fetch('/api/opinions/recent?limit=50', { credentials: 'include' }).then(res => res.json()),
  });

  // Fetch user profile for sort preferences
  const { data: userProfile } = useQuery<any>({
    queryKey: ['/api/profile'],
    queryFn: async () => {
      const response = await fetch('/api/user', { credentials: 'include' });
      if (!response.ok) return null;
      const userData = await response.json();
      if (!userData?.id) return null;
      const profileResponse = await fetch(`/api/profile/${userData.id}`, { credentials: 'include' });
      if (!profileResponse.ok) return null;
      return profileResponse.json();
    },
  });

  // Create topic mutation
  const createTopicMutation = useMutation({
    mutationFn: async (data: z.infer<typeof topicFormSchema>) => {
      return apiRequest('POST', '/api/topics', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/platform"] });
      setShowCreateTopic(false);
    },
    onError: (error: any) => {
      console.error("Failed to create topic:", error);
    },
  });

  // Create opinion mutation
  const createOpinionMutation = useMutation({
    mutationFn: async (data: z.infer<typeof opinionFormSchema>) => {
      return apiRequest('POST', `/api/topics/${selectedTopic}/opinions`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", selectedTopic, "opinions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics", selectedTopic, "cumulative"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/platform"] });
      setShowCreateOpinion(false);
    },
    onError: (error: any) => {
      console.error("Failed to share opinion:", error);
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
      queryClient.invalidateQueries({ queryKey: ["/api/topics", selectedTopic, "opinions"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/topics", selectedTopic, "opinions"] });
    },
    onError: (error: any) => {
      console.error("Failed to flag opinion:", error);
    },
  });

  const adoptMutation = useMutation({
    mutationFn: async (opinionId: string) => {
      return apiRequest('POST', `/api/opinions/${opinionId}/adopt`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", selectedTopic, "opinions"] });
    },
    onError: (error: any) => {
      console.error("Failed to adopt opinion:", error);
    },
  });

  // AI synthesis mutations
  const generateCumulativeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/topics/${selectedTopic}/cumulative/generate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", selectedTopic, "cumulative"] });
    },
    onError: (error: any) => {
      console.error("Failed to generate analysis:", error);
    },
  });

  const refreshCumulativeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('PATCH', `/api/topics/${selectedTopic}/cumulative/refresh`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", selectedTopic, "cumulative"] });
    },
    onError: (error: any) => {
      console.error("Failed to refresh analysis:", error);
    },
  });

  // Forms
  const topicForm = useForm<z.infer<typeof topicFormSchema>>({
    resolver: zodResolver(topicFormSchema),
    defaultValues: {
      title: "",
      description: "",
      categories: [],
    },
  });

  // State for category input
  const [categoryInput, setCategoryInput] = useState("");

  const opinionForm = useForm<z.infer<typeof opinionFormSchema>>({
    resolver: zodResolver(opinionFormSchema),
    defaultValues: {
      content: "",
      stance: "neutral",
      references: [],
    },
  });

  const categories = [
    "Politics", "Technology", "Science", "Economics", "Social Issues", 
    "Environment", "Education", "Healthcare", "Ethics", "Culture"
  ];

  // Use only real API topics - no mock data
  const combinedTopics = apiTopics?.map(topic => ({
    ...topic, // Spread all fields to preserve preview data
    imageUrl: topic.imageUrl || climateImage, // Use default image if none provided
    isActive: topic.isActive || false
  })) || [];

  const filteredTopics = combinedTopics.filter(topic =>
    topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    topic.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    topic.categories.some(cat => cat.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Transform API opinions for display
  const transformedOpinions = apiOpinions?.map((opinion: any) => ({
    id: opinion.id,
    topicId: opinion.topicId,
    userId: opinion.userId,
    userName: "User", // We'll need to join with users table later
    content: opinion.content,
    stance: opinion.stance as "for" | "against" | "neutral",
    timestamp: new Date(opinion.createdAt!).toLocaleDateString(),
    likesCount: opinion.likesCount || 0,
    dislikesCount: opinion.dislikesCount || 0,
    repliesCount: opinion.repliesCount || 0,
    challengesCount: opinion.challengesCount || 0,
    userVote: opinion.userVote || null
  })) || [];

  // Prepare recent opinions preview - top 1 opinion from top 5 topics
  const categorySortPref = (userProfile?.profile?.categorySortPreference || 'popular') as 'popular' | 'alphabetical' | 'newest' | 'oldest';
  const opinionSortPref = (userProfile?.profile?.opinionSortPreference || 'newest') as 'newest' | 'oldest' | 'most_liked' | 'most_controversial';
  
  const recentOpinionsPreview = recentOpinions && apiTopics 
    ? (() => {
        // Group opinions by topic
        const topicOpinionMap = new Map<string, any[]>();
        recentOpinions.forEach(opinion => {
          if (!topicOpinionMap.has(opinion.topicId)) {
            topicOpinionMap.set(opinion.topicId, []);
          }
          topicOpinionMap.get(opinion.topicId)!.push(opinion);
        });

        // Create topic groups with their opinions
        const topicGroups = Array.from(topicOpinionMap.entries()).map(([topicId, opinions]) => {
          const topic = apiTopics.find(t => t.id === topicId);
          if (!topic) return null;
          
          // Sort opinions within topic
          const sortedOpinions = [...opinions].sort((a, b) => {
            switch (opinionSortPref) {
              case 'oldest':
                return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
              case 'most_liked':
                return (b.likesCount || 0) - (a.likesCount || 0);
              case 'most_controversial':
                const aControversy = (a.likesCount || 0) + (a.dislikesCount || 0);
                const bControversy = (b.likesCount || 0) + (b.dislikesCount || 0);
                return bControversy - aControversy;
              default: // newest
                return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
            }
          });

          return {
            topic,
            opinion: sortedOpinions[0], // Top opinion
            mostRecentDate: new Date(Math.max(...opinions.map(o => new Date(o.createdAt || 0).getTime())))
          };
        }).filter(Boolean);

        // Sort topic groups by category preference
        const sortedGroups = topicGroups.sort((a, b) => {
          if (!a || !b) return 0;
          switch (categorySortPref) {
            case 'alphabetical':
              return a.topic.title.localeCompare(b.topic.title);
            case 'oldest':
              return a.mostRecentDate.getTime() - b.mostRecentDate.getTime();
            case 'newest':
              return b.mostRecentDate.getTime() - a.mostRecentDate.getTime();
            default: // popular
              return b.topic.opinionsCount - a.topic.opinionsCount;
          }
        });

        // Return top 5 groups
        return sortedGroups.slice(0, 5);
      })()
    : [];

  // If viewing a live debate room, show the full debate interface
  if (viewingLiveDebate) {
    const selectedTopicData = filteredTopics.find(topic => topic.id === viewingLiveDebate);
    if (selectedTopicData) {
      return (
        <LiveDebateRoom
          topicId={viewingLiveDebate}
          topicTitle={selectedTopicData.title}
          onClose={() => setViewingLiveDebate(null)}
        />
      );
    }
  }

  // Live stream viewing removed - no mock data

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-3 sm:space-y-4 py-4 sm:py-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight px-4">
          Where Ideas Collide
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
          Join meaningful debates on topics that matter. Share your opinions, discover different perspectives, and engage in thoughtful discussions.
        </p>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
        <div className="text-center p-3 sm:p-4 md:p-6 rounded-lg bg-card border">
          <div className="text-xl sm:text-2xl md:text-3xl font-bold text-primary mb-1 sm:mb-2">{stats?.totalTopics || 0}</div>
          <div className="text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-1">
            <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Active Debates</span>
            <span className="sm:hidden">Debates</span>
          </div>
        </div>
        <div className="text-center p-3 sm:p-4 md:p-6 rounded-lg bg-card border">
          <div className="text-xl sm:text-2xl md:text-3xl font-bold text-red-500 mb-1 sm:mb-2">{stats?.liveStreams || 0}</div>
          <div className="text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-1">
            <Radio className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Live Streams</span>
            <span className="sm:hidden">Live</span>
          </div>
        </div>
        <div className="text-center p-3 sm:p-4 md:p-6 rounded-lg bg-card border">
          <div className="text-xl sm:text-2xl md:text-3xl font-bold text-primary mb-1 sm:mb-2">{stats?.totalParticipants || 0}</div>
          <div className="text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-1">
            <Users className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Total Participants</span>
            <span className="sm:hidden">Users</span>
          </div>
        </div>
        <div className="text-center p-3 sm:p-4 md:p-6 rounded-lg bg-card border">
          <div className="text-xl sm:text-2xl md:text-3xl font-bold text-primary mb-1 sm:mb-2">{stats?.totalCategories || 0}</div>
          <div className="text-xs sm:text-sm text-muted-foreground">
            Categories
          </div>
        </div>
      </div>

      {/* Live Streaming Debates - only show when there are actual live streams */}
      {stats && stats.liveStreams > 0 && (
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-xl sm:text-2xl font-bold">Live Streaming Debates</h2>
            <div className="flex items-center gap-2">
              <Badge className="bg-red-500 text-white animate-pulse">
                <Radio className="w-3 h-3 mr-1" />
                Live Now
              </Badge>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Live streams will be fetched from API when available */}
          </div>
        </div>
      )}

      {/* Trending Topics */}
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-bold">Trending Topics</h2>
          <Badge variant="secondary" className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Live Updates
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTopics.map((topic) => (
            <TopicCard
              key={topic.id}
              {...topic}
            />
          ))}
        </div>
        
        {filteredTopics.length === 0 && searchQuery && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No topics found matching "{searchQuery}". Try a different search term.
            </p>
          </div>
        )}
      </div>

      {/* AI Synthesis Section */}
      {selectedTopic && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">AI Synthesis</h2>
            <div className="flex gap-2">
              {!cumulativeData && (
                <Button 
                  onClick={() => generateCumulativeMutation.mutate()}
                  disabled={generateCumulativeMutation.isPending}
                  data-testid="button-generate-synthesis"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  {generateCumulativeMutation.isPending ? "Generating..." : "Generate Analysis"}
                </Button>
              )}
              {cumulativeData && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => refreshCumulativeMutation.mutate()}
                  disabled={refreshCumulativeMutation.isPending}
                  data-testid="button-refresh-synthesis"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {refreshCumulativeMutation.isPending ? "Refreshing..." : "Refresh Analysis"}
                </Button>
              )}
            </div>
          </div>
          
          {cumulativeData ? (
            <Card>
              <CardContent className="p-6">
                <div className="grid gap-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Summary</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {cumulativeData.summary}
                    </p>
                  </div>
                  
                  {cumulativeData.keyPoints && cumulativeData.keyPoints.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Key Points</h3>
                      <ul className="space-y-2">
                        {cumulativeData.keyPoints.map((point, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                            <span className="text-muted-foreground">{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {cumulativeData.supportingPercentage}%
                      </div>
                      <div className="text-sm text-muted-foreground">Supporting</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {cumulativeData.opposingPercentage}%
                      </div>
                      <div className="text-sm text-muted-foreground">Opposing</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
                      <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                        {cumulativeData.neutralPercentage}%
                      </div>
                      <div className="text-sm text-muted-foreground">Neutral</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Based on {cumulativeData.totalOpinions} opinion{cumulativeData.totalOpinions !== 1 ? 's' : ''}</span>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        cumulativeData.confidence === 'high' ? 'bg-green-500' :
                        cumulativeData.confidence === 'medium' ? 'bg-yellow-500' : 'bg-gray-500'
                      }`} />
                      <span className="capitalize">{cumulativeData.confidence} confidence</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : transformedOpinions.length > 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Zap className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">AI Analysis Available</h3>
                <p className="text-muted-foreground mb-4">
                  Generate an AI-powered synthesis of all opinions on this topic.
                </p>
                <Button 
                  onClick={() => generateCumulativeMutation.mutate()}
                  disabled={generateCumulativeMutation.isPending}
                  data-testid="button-generate-synthesis-prompt"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Generate Analysis
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <MessageCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Opinions Yet</h3>
                <p className="text-muted-foreground">
                  AI synthesis will be available once opinions are shared on this topic.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Recent Opinions Preview */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Clock className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">Recent Opinions</h2>
        </div>
        
        {recentOpinionsPreview.length > 0 ? (
          <div 
            className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {recentOpinionsPreview.map((group) => (
              <div 
                key={group!.topic.id} 
                className="flex-none w-[320px] sm:w-[380px]"
                style={{ scrollSnapAlign: 'start' }}
              >
                <OpinionCard
                  id={group!.opinion.id}
                  topicId={group!.opinion.topicId}
                  userId={group!.opinion.userId}
                  userName={group!.opinion.user ? `${group!.opinion.user.firstName || ''} ${group!.opinion.user.lastName || ''}`.trim() || 'Anonymous' : 'Anonymous'}
                  userAvatar={group!.opinion.user?.profileImageUrl}
                  content={group!.opinion.content}
                  stance={group!.opinion.stance as "for" | "against" | "neutral"}
                  timestamp={formatDistanceToNow(new Date(group!.opinion.createdAt!), { addSuffix: true })}
                  likesCount={group!.opinion.likesCount || 0}
                  dislikesCount={group!.opinion.dislikesCount || 0}
                  references={group!.opinion.references || []}
                  fallacyCounts={group!.opinion.fallacyCounts || {}}
                  isLiked={group!.opinion.userVote?.voteType === 'like'}
                  isDisliked={group!.opinion.userVote?.voteType === 'dislike'}
                  onLike={() => voteMutation.mutate({ 
                    opinionId: group!.opinion.id, 
                    voteType: 'like',
                    currentVote: group!.opinion.userVote?.voteType 
                  })}
                  onDislike={() => voteMutation.mutate({ 
                    opinionId: group!.opinion.id, 
                    voteType: 'dislike',
                    currentVote: group!.opinion.userVote?.voteType 
                  })}
                  onAdopt={() => adoptMutation.mutate(group!.opinion.id)}
                  onFlag={() => setFlaggingOpinionId(group!.opinion.id)}
                />
              </div>
            ))}
            <div 
              className="flex-none w-[280px] sm:w-[300px]"
              style={{ scrollSnapAlign: 'start' }}
            >
              <Link href="/recent-opinions">
                <Card className="h-full flex items-center justify-center hover-elevate active-elevate-2 cursor-pointer" data-testid="card-show-more-opinions">
                  <CardContent className="text-center py-12">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="font-medium">Show More Opinions</p>
                    <p className="text-sm text-muted-foreground">Explore all recent opinions</p>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No recent opinions yet. Share your thoughts!</p>
            </CardContent>
          </Card>
        )}
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