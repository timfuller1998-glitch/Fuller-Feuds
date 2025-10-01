import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import SearchBar from "@/components/SearchBar";
import TopicCard from "@/components/TopicCard";
import StreamingTopicCard from "@/components/StreamingTopicCard";
import LiveStreamDebate from "@/components/LiveStreamDebate";
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
import { TrendingUp, MessageCircle, Users, Plus, Radio, Eye, RefreshCw, Zap, Mic } from "lucide-react";
import { insertTopicSchema, insertOpinionSchema, type Topic, type Opinion, type CumulativeOpinion as CumulativeOpinionType } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import climateImage from '@assets/generated_images/Climate_change_debate_thumbnail_3b0bbda7.png';
import aiImage from '@assets/generated_images/AI_ethics_debate_thumbnail_98fa03cc.png';
import educationImage from '@assets/generated_images/Education_reform_debate_thumbnail_a88506ee.png';
import healthcareImage from '@assets/generated_images/Healthcare_policy_debate_thumbnail_269685b7.png';

const topicFormSchema = insertTopicSchema.omit({
  createdById: true,  // Server will set this from authenticated user
}).extend({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().min(1, "Description is required").max(1000, "Description too long"),
  category: z.string().min(1, "Category is required"),
});

const opinionFormSchema = insertOpinionSchema.omit({
  topicId: true,  // Server will set this from URL params
  userId: true,   // Server will set this from authenticated user
}).extend({
  content: z.string().min(1, "Opinion is required").max(2000, "Opinion too long"),
  stance: z.enum(["for", "against", "neutral"], { required_error: "Please select a stance" }),
});

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [viewingLiveStream, setViewingLiveStream] = useState<string | null>(null);
  const [viewingLiveDebate, setViewingLiveDebate] = useState<string | null>(null);
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [showCreateOpinion, setShowCreateOpinion] = useState(false);
  const { toast } = useToast();

  // Fetch real topics from API
  const { data: apiTopics, isLoading: topicsLoading } = useQuery<Topic[]>({
    queryKey: ["/api/topics", { search: searchQuery }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      const response = await fetch(`/api/topics?${params}`);
      if (!response.ok) throw new Error("Failed to fetch topics");
      return response.json();
    },
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


  // Create topic mutation
  const createTopicMutation = useMutation({
    mutationFn: async (data: z.infer<typeof topicFormSchema>) => {
      return apiRequest('POST', '/api/topics', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
      setShowCreateTopic(false);
      toast({ title: "Topic created successfully!" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create topic", 
        description: error.message,
        variant: "destructive" 
      });
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
      setShowCreateOpinion(false);
      toast({ title: "Opinion shared successfully!" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to share opinion", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: async ({ opinionId, voteType }: { opinionId: string; voteType: 'like' | 'dislike' }) => {
      return apiRequest('POST', `/api/opinions/${opinionId}/vote`, { voteType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", selectedTopic, "opinions"] });
      toast({ title: "Vote recorded!" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to vote", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // AI synthesis mutations
  const generateCumulativeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/topics/${selectedTopic}/cumulative/generate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", selectedTopic, "cumulative"] });
      toast({ title: "AI analysis generated successfully!" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to generate analysis", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const refreshCumulativeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('PATCH', `/api/topics/${selectedTopic}/cumulative/refresh`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", selectedTopic, "cumulative"] });
      toast({ title: "AI analysis refreshed successfully!" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to refresh analysis", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Forms
  const topicForm = useForm<z.infer<typeof topicFormSchema>>({
    resolver: zodResolver(topicFormSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      imageUrl: "",
    },
  });

  const opinionForm = useForm<z.infer<typeof opinionFormSchema>>({
    resolver: zodResolver(opinionFormSchema),
    defaultValues: {
      content: "",
      stance: "neutral",
    },
  });

  const categories = [
    "Politics", "Technology", "Science", "Economics", "Social Issues", 
    "Environment", "Education", "Healthcare", "Ethics", "Culture"
  ];

  // todo: remove mock functionality
  const trendingTopics = [
    {
      id: "climate-change",
      title: "Climate Change: Individual vs. Systemic Action",
      description: "Should we focus on individual lifestyle changes or systemic policy reforms to address climate change effectively?",
      imageUrl: climateImage,
      category: "Environment",
      participantCount: 247,
      opinionsCount: 1832,
      isActive: true
    },
    {
      id: "ai-ethics",
      title: "AI in Decision Making: Progress or Problem?",
      description: "Are AI systems making our lives better or creating new forms of bias and discrimination in important decisions?",
      imageUrl: aiImage,
      category: "Technology",
      participantCount: 156,
      opinionsCount: 923,
      isActive: true
    },
    {
      id: "education-reform",
      title: "Traditional vs. Progressive Education Methods",
      description: "Which approach better prepares students for the modern world: structured traditional education or flexible progressive methods?",
      imageUrl: educationImage,
      category: "Education",
      participantCount: 189,
      opinionsCount: 1247,
      isActive: false
    },
    {
      id: "healthcare-policy",
      title: "Universal Healthcare: Right or Privilege?",
      description: "Should healthcare be guaranteed as a universal right or remain a service based on individual responsibility and choice?",
      imageUrl: healthcareImage,
      category: "Politics",
      participantCount: 298,
      opinionsCount: 2156,
      isActive: true
    }
  ];

  // todo: remove mock functionality
  const liveStreamingTopics = [
    {
      id: "live-climate",
      title: "Climate Change: Individual vs. Systemic Action",
      description: "Live debate featuring climate experts discussing the most effective approaches to environmental action.",
      imageUrl: climateImage,
      category: "Environment",
      participants: [
        { id: "p1", name: "Dr. Sarah Chen", stance: "for" as const },
        { id: "p2", name: "Prof. Marcus Rodriguez", stance: "against" as const }
      ],
      moderator: { name: "Alex Thompson" },
      viewerCount: 1247,
      status: "live" as const
    },
    {
      id: "scheduled-ai",
      title: "AI Ethics in Healthcare Decisions",
      description: "Scheduled debate on the role of AI in making critical healthcare decisions.",
      imageUrl: aiImage,
      category: "Technology",
      scheduledTime: "Today 3:00 PM",
      participants: [
        { id: "p3", name: "Dr. Emily Watson", stance: "for" as const },
        { id: "p4", name: "Prof. David Kim", stance: "against" as const }
      ],
      moderator: { name: "Jordan Martinez" },
      status: "scheduled" as const
    },
    {
      id: "ended-education",
      title: "Traditional vs. Progressive Education",
      description: "Recent debate on educational methodologies and their effectiveness.",
      imageUrl: educationImage,
      category: "Education",
      participants: [
        { id: "p5", name: "Prof. Lisa Anderson", stance: "for" as const },
        { id: "p6", name: "Dr. Michael Brown", stance: "against" as const }
      ],
      moderator: { name: "Sam Taylor" },
      status: "ended" as const,
      duration: "1h 23m"
    }
  ];

  const recentOpinions = [
    {
      id: "opinion-1",
      userId: "mock-user-1",
      userName: "Sarah Chen",
      content: "I believe that individual actions, while important, are not sufficient to address the scale of the climate crisis. We need systemic changes in policy and corporate behavior.",
      stance: "for" as const,
      timestamp: "2 hours ago",
      likesCount: 24,
      dislikesCount: 3,
      repliesCount: 8
    },
    {
      id: "opinion-2",
      userId: "mock-user-2",
      userName: "Marcus Rodriguez",
      content: "The focus on individual responsibility is actually counterproductive. It shifts blame away from the major corporations that have the real power to make a difference.",
      stance: "against" as const,
      timestamp: "4 hours ago",
      likesCount: 18,
      dislikesCount: 12,
      repliesCount: 15
    }
  ];

  // Combine API topics with mock topics for display
  const combinedTopics = [
    ...(apiTopics?.map(topic => ({
      id: topic.id,
      title: topic.title,
      description: topic.description,
      imageUrl: topic.imageUrl || climateImage, // Use default image if none provided
      category: topic.category,
      participantCount: 0, // We'll calculate this later
      opinionsCount: 0, // We'll calculate this later
      isActive: topic.isActive || false
    })) || []),
    ...trendingTopics
  ];

  const filteredTopics = combinedTopics.filter(topic =>
    topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    topic.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    topic.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Transform API opinions for display
  const transformedOpinions = apiOpinions?.map(opinion => ({
    id: opinion.id,
    userId: opinion.userId,
    userName: "User", // We'll need to join with users table later
    content: opinion.content,
    stance: opinion.stance as "for" | "against" | "neutral",
    timestamp: new Date(opinion.createdAt!).toLocaleDateString(),
    likesCount: opinion.likesCount || 0,
    dislikesCount: opinion.dislikesCount || 0,
    repliesCount: opinion.repliesCount || 0
  })) || [];

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

  // If viewing a live stream, show the full streaming interface
  if (viewingLiveStream) {
    const streamTopic = liveStreamingTopics.find(topic => topic.id === viewingLiveStream);
    if (streamTopic) {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Button 
              variant="outline" 
              onClick={() => setViewingLiveStream(null)}
              data-testid="button-back-to-topics"
            >
              ← Back to Topics
            </Button>
            <Badge className="bg-red-500 text-white">
              🔴 LIVE
            </Badge>
          </div>
          
          <LiveStreamDebate
            topicId={streamTopic.id}
            title={streamTopic.title}
            viewerCount={streamTopic.viewerCount || 0}
            duration="24:15"
            participants={streamTopic.participants.map(p => ({
              ...p,
              isSpeaking: p.id === "p1",
              isMuted: false,
              isCameraOn: true
            }))}
            moderator={{ id: "mod-1", name: streamTopic.moderator.name }}
            currentUserId="current-user"
            isLive={streamTopic.status === "live"}
            onJoinAsViewer={() => console.log('Join as viewer')}
            onRequestToSpeak={() => console.log('Request to speak')}
            onModerateChat={(msgId, action) => console.log('Moderate:', msgId, action)}
          />
        </div>
      );
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4 sm:space-y-6 py-4 sm:py-8">
        <div className="space-y-3 sm:space-y-4">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight px-4">
            Where Ideas Collide
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
            Join meaningful debates on topics that matter. Share your opinions, discover different perspectives, and engage in thoughtful discussions.
          </p>
        </div>
        
        <div className="max-w-2xl mx-auto px-4">
          <SearchBar 
            onSearch={setSearchQuery}
            placeholder="Search for debate topics..."
          />
        </div>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4">
          <Button data-testid="button-browse-topics" className="w-full sm:w-auto">
            <TrendingUp className="w-4 h-4 mr-2" />
            Browse Trending
          </Button>
          
          <Dialog open={showCreateTopic} onOpenChange={setShowCreateTopic}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-create-topic" className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Start New Topic
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create New Topic</DialogTitle>
                <DialogDescription>
                  Start a new debate topic for the community to discuss.
                </DialogDescription>
              </DialogHeader>
              <Form {...topicForm}>
                <form onSubmit={topicForm.handleSubmit((data) => createTopicMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={topicForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter debate topic..." {...field} data-testid="input-topic-title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={topicForm.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-topic-category">
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={topicForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Provide more details about this topic..." 
                            {...field} 
                            data-testid="textarea-topic-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={topicForm.control}
                    name="imageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Image URL (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="https://example.com/image.jpg" {...field} value={field.value || ""} data-testid="input-topic-image" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setShowCreateTopic(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createTopicMutation.isPending} data-testid="button-submit-topic">
                      {createTopicMutation.isPending ? "Creating..." : "Create Topic"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
        <div className="text-center p-3 sm:p-4 md:p-6 rounded-lg bg-card border">
          <div className="text-xl sm:text-2xl md:text-3xl font-bold text-primary mb-1 sm:mb-2">1,247</div>
          <div className="text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-1">
            <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Active Debates</span>
            <span className="sm:hidden">Debates</span>
          </div>
        </div>
        <div className="text-center p-3 sm:p-4 md:p-6 rounded-lg bg-card border">
          <div className="text-xl sm:text-2xl md:text-3xl font-bold text-red-500 mb-1 sm:mb-2">3</div>
          <div className="text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-1">
            <Radio className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Live Streams</span>
            <span className="sm:hidden">Live</span>
          </div>
        </div>
        <div className="text-center p-3 sm:p-4 md:p-6 rounded-lg bg-card border">
          <div className="text-xl sm:text-2xl md:text-3xl font-bold text-primary mb-1 sm:mb-2">8,923</div>
          <div className="text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-1">
            <Users className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Total Participants</span>
            <span className="sm:hidden">Users</span>
          </div>
        </div>
        <div className="text-center p-3 sm:p-4 md:p-6 rounded-lg bg-card border">
          <div className="text-xl sm:text-2xl md:text-3xl font-bold text-primary mb-1 sm:mb-2">24</div>
          <div className="text-xs sm:text-sm text-muted-foreground">
            Categories
          </div>
        </div>
      </div>

      {/* Live Streaming Debates */}
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-xl sm:text-2xl font-bold">Live Streaming Debates</h2>
          <div className="flex items-center gap-2">
            <Badge className="bg-red-500 text-white animate-pulse">
              <Radio className="w-3 h-3 mr-1" />
              Live Now
            </Badge>
            <Badge variant="secondary">
              <Eye className="w-3 h-3 mr-1" />
              1,247 watching
            </Badge>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {liveStreamingTopics.map((topic) => (
            <StreamingTopicCard
              key={topic.id}
              {...topic}
              onWatchLive={(id) => {
                setViewingLiveStream(id);
                console.log('Watch live:', id);
              }}
              onSetReminder={(id) => {
                console.log('Set reminder:', id);
              }}
              onViewRecording={(id) => {
                console.log('View recording:', id);
              }}
            />
          ))}
        </div>
      </div>

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

      {/* Recent Opinions */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Recent Opinions</h2>
          {selectedTopic && (
            <Dialog open={showCreateOpinion} onOpenChange={setShowCreateOpinion}>
              <DialogTrigger asChild>
                <Button data-testid="button-share-opinion">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Share Opinion
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Share Your Opinion</DialogTitle>
                  <DialogDescription>
                    Share your thoughts on the selected topic.
                  </DialogDescription>
                </DialogHeader>
                <Form {...opinionForm}>
                  <form onSubmit={opinionForm.handleSubmit((data) => createOpinionMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={opinionForm.control}
                      name="stance"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Your Stance</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-opinion-stance">
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
                              className="min-h-32"
                              {...field} 
                              data-testid="textarea-opinion-content"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setShowCreateOpinion(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createOpinionMutation.isPending} data-testid="button-submit-opinion">
                        {createOpinionMutation.isPending ? "Sharing..." : "Share Opinion"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </div>
        
        <div className="space-y-4">
          {/* Display real opinions when viewing a specific topic */}
          {selectedTopic && transformedOpinions.length > 0 ? (
            transformedOpinions.map((opinion) => (
              <OpinionCard
                key={opinion.id}
                {...opinion}
                onLike={(id) => voteMutation.mutate({ opinionId: id, voteType: 'like' })}
                onDislike={(id) => voteMutation.mutate({ opinionId: id, voteType: 'dislike' })}
                onReply={(id) => console.log('Reply to:', id)}
              />
            ))
          ) : selectedTopic ? (
            <div className="text-center py-8">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">No opinions yet for this topic.</p>
              <Button onClick={() => setShowCreateOpinion(true)}>
                Share First Opinion
              </Button>
            </div>
          ) : (
            /* Show mock opinions when no specific topic is selected */
            recentOpinions.map((opinion) => (
              <OpinionCard
                key={opinion.id}
                {...opinion}
                onLike={(id) => console.log('Liked:', id)}
                onDislike={(id) => console.log('Disliked:', id)}
                onReply={(id) => console.log('Reply to:', id)}
              />
            ))
          )}
        </div>
        
        {!selectedTopic && (
          <div className="text-center">
            <Button variant="outline" data-testid="button-view-more-opinions">
              View More Opinions
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}