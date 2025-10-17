import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserProfileSchema, insertLiveStreamSchema } from "@shared/schema";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import {
  Users,
  User,
  UserPlus,
  UserMinus,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Brain,
  Settings,
  Edit,
  Save,
  X,
  Filter,
  ArrowUpDown,
  Swords,
  Video,
  Clock,
  Plus,
  Trophy,
  Award,
  Medal,
  Star,
  Lock,
  Check
} from "lucide-react";

interface ProfileData {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    profileImageUrl?: string;
    createdAt: string;
  };
  profile?: {
    id: string;
    userId: string;
    bio?: string;
    displayFirstName?: string;
    displayLastName?: string;
    politicalLeaning?: string;
    leaningScore: number;
    leaningConfidence: string;
    totalOpinions: number;
    totalLikes: number;
    totalDislikes: number;
    followerCount: number;
    followingCount: number;
    lastAnalyzedAt?: string;
    opinionSortPreference?: string;
    categorySortPreference?: string;
  };
  followerCount: number;
  followingCount: number;
}

interface Opinion {
  id: string;
  topicId: string;
  content: string;
  stance: string;
  likesCount: number;
  dislikesCount: number;
  createdAt: string;
}

const streamFormSchema = z.object({
  topicId: z.string().min(1, "Please select a topic"),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(500).optional().or(z.literal("")),
  participantSelectionMethod: z.enum(["open", "invite"]).default("open"),
  scheduledAt: z.string().optional().or(z.literal("")),
});

const debateFormSchema = z.object({
  topicId: z.string().min(1, "Please select a topic"),
  participant2Id: z.string().min(1, "Opponent ID is required"),
  participant1Stance: z.enum(["supporting", "opposing", "neutral"]),
  participant2Stance: z.enum(["supporting", "opposing", "neutral"]),
});

export default function Profile() {
  const { userId } = useParams();
  const [, navigate] = useLocation();
  const { user: currentUser } = useAuth();
  const [showCreateDebateDialog, setShowCreateDebateDialog] = useState(false);
  const [showScheduleStreamDialog, setShowScheduleStreamDialog] = useState(false);
  const [activeSection, setActiveSection] = useState<'opinions' | 'debates' | 'followers' | 'following' | 'badges' | 'leaderboards'>('opinions');

  const isOwnProfile = currentUser?.id === userId;

  // Fetch profile data
  const { data: profileData, isLoading: profileLoading } = useQuery<ProfileData>({
    queryKey: ['/api/profile', userId],
    queryFn: () => fetch(`/api/profile/${userId}`, { credentials: 'include' }).then(res => res.json()),
    enabled: !!userId,
  });

  // Map opinion sort preference from settings to API parameter
  const mapSortPreference = (pref?: string): 'recent' | 'oldest' | 'popular' | 'controversial' => {
    switch (pref) {
      case 'oldest':
        return 'oldest';
      case 'most_liked':
        return 'popular';
      case 'most_controversial':
        return 'controversial';
      case 'newest':
      default:
        return 'recent';
    }
  };

  const opinionSortBy = mapSortPreference(profileData?.profile?.opinionSortPreference);

  // Fetch user opinions
  const { data: opinions = [], isLoading: opinionsLoading } = useQuery<Opinion[]>({
    queryKey: ['/api/profile', userId, 'opinions', opinionSortBy],
    queryFn: () => fetch(`/api/profile/${userId}/opinions?sortBy=${opinionSortBy}&limit=50`, { credentials: 'include' }).then(res => res.json()),
    enabled: !!userId,
  });

  // Fetch follow status (only if viewing another user's profile)
  const { data: followStatus } = useQuery<{ isFollowing: boolean }>({
    queryKey: ['/api/follow', userId, 'status'],
    queryFn: () => fetch(`/api/follow/${userId}/status`, { credentials: 'include' }).then(res => res.json()),
    enabled: !!userId && !isOwnProfile && !!currentUser,
  });

  // Fetch followers
  const { data: followers = [] } = useQuery<any[]>({
    queryKey: ['/api/profile', userId, 'followers'],
    queryFn: () => fetch(`/api/profile/${userId}/followers`, { credentials: 'include' }).then(res => res.json()),
    enabled: !!userId,
  });

  // Fetch following
  const { data: following = [] } = useQuery<any[]>({
    queryKey: ['/api/profile', userId, 'following'],
    queryFn: () => fetch(`/api/profile/${userId}/following`, { credentials: 'include' }).then(res => res.json()),
    enabled: !!userId,
  });

  // Fetch debate rooms count
  const { data: debateRooms = [] } = useQuery<any[]>({
    queryKey: ['/api/profile', userId, 'debate-rooms'],
    queryFn: () => fetch(`/api/profile/${userId}/debate-rooms`, { credentials: 'include' }).then(res => res.json()),
    enabled: !!userId,
  });

  // Fetch topics for stream creation
  const { data: topics = [] } = useQuery<any[]>({
    queryKey: ['/api/topics'],
    enabled: isOwnProfile && showScheduleStreamDialog,
  });

  // Fetch user badges
  const { data: userBadges = [] } = useQuery<any[]>({
    queryKey: ['/api/users', userId, 'badges'],
    queryFn: () => fetch(`/api/users/${userId}/badges`, { credentials: 'include' }).then(res => res.json()),
    enabled: !!userId,
  });

  // Fetch leaderboards
  const { data: leaderboards } = useQuery<any>({
    queryKey: ['/api/leaderboards'],
    queryFn: () => fetch('/api/leaderboards', { credentials: 'include' }).then(res => res.json()),
    enabled: activeSection === 'leaderboards',
  });

  // Follow/unfollow mutation
  const followMutation = useMutation({
    mutationFn: (action: 'follow' | 'unfollow') => 
      action === 'follow' 
        ? fetch(`/api/follow/${userId}`, { method: 'POST', credentials: 'include' }).then(res => res.json())
        : fetch(`/api/follow/${userId}`, { method: 'DELETE', credentials: 'include' }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/follow', userId, 'status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/profile', userId] });
    },
    onError: (error) => {
      console.error("Failed to update follow status:", error);
    }
  });

  // Political analysis mutation
  const analyzeMutation = useMutation({
    mutationFn: () => fetch(`/api/profile/${userId}/analyze`, { method: 'POST', credentials: 'include' }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile', userId] });
    },
    onError: (error) => {
      console.error("Political analysis failed:", error);
    }
  });

  // Badge selection mutation
  const selectBadgeMutation = useMutation({
    mutationFn: (badgeId: string | null) => 
      apiRequest('POST', '/api/users/me/selected-badge', { badgeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users', userId, 'badges'] });
      queryClient.invalidateQueries({ queryKey: ['/api/profile', userId] });
    },
    onError: (error) => {
      console.error("Failed to select badge:", error);
    }
  });

  // Stream schedule form
  const streamForm = useForm<z.infer<typeof streamFormSchema>>({
    resolver: zodResolver(streamFormSchema),
    defaultValues: {
      topicId: "",
      title: "",
      description: "",
      participantSelectionMethod: "open",
      scheduledAt: "",
    },
  });

  // Debate room form
  const debateForm = useForm<z.infer<typeof debateFormSchema>>({
    resolver: zodResolver(debateFormSchema),
    defaultValues: {
      topicId: "",
      participant2Id: "",
      participant1Stance: "supporting",
      participant2Stance: "opposing",
    },
  });

  // Debate room creation mutation
  const createDebateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof debateFormSchema>) => {
      const response = await apiRequest('POST', '/api/debate-rooms', data);
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/debate-rooms'] });
      setShowCreateDebateDialog(false);
      debateForm.reset();
      navigate(`/debate-room/${data.id}`);
    },
    onError: (error) => {
      console.error("Failed to create debate room:", error);
    }
  });

  const onDebateSubmit = (data: z.infer<typeof debateFormSchema>) => {
    createDebateMutation.mutate(data);
  };

  // Stream creation mutation
  const createStreamMutation = useMutation({
    mutationFn: async (data: z.infer<typeof streamFormSchema>) => {
      const payload = {
        ...data,
        description: data.description || undefined,
        moderatorId: currentUser!.id,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt).toISOString() : undefined,
      };
      const response = await apiRequest('POST', '/api/streams', payload);
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/live-streams'] });
      setShowScheduleStreamDialog(false);
      streamForm.reset();
      navigate(`/live-stream/${data.id}`);
    },
    onError: (error) => {
      console.error("Failed to create stream:", error);
    }
  });

  const onStreamSubmit = (data: z.infer<typeof streamFormSchema>) => {
    console.log('Stream form submitted with data:', data);
    console.log('Form errors:', streamForm.formState.errors);
    createStreamMutation.mutate(data);
  };

  // Helper functions
  const formatJoinDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    });
  };

  const getPoliticalLeaningColor = (leaning?: string) => {
    switch (leaning?.toLowerCase()) {
      case 'progressive':
      case 'moderate-progressive':
        return '#3b82f6'; // blue-500
      case 'conservative':
      case 'moderate-conservative':
        return '#ef4444'; // red-500
      case 'moderate':
        return '#a855f7'; // purple-500
      case 'libertarian':
        return '#eab308'; // yellow-500
      case 'populist':
        return '#f97316'; // orange-500
      default:
        return '#6b7280'; // gray-500
    }
  };

  const getPoliticalLeaningColorFromScore = (score: number) => {
    if (score < -50) return '#3b82f6'; // Very Progressive - blue
    if (score < -20) return '#3b82f6'; // Progressive - blue
    if (score <= 20) return '#a855f7'; // Moderate - purple
    if (score <= 50) return '#ef4444'; // Conservative - red
    return '#ef4444'; // Very Conservative - red
  };

  const getLeaningDescription = (score: number) => {
    if (score < -50) return "Very Progressive";
    if (score < -20) return "Progressive";
    if (score <= 20) return "Moderate";
    if (score <= 50) return "Conservative";
    return "Very Conservative";
  };

  if (profileLoading || !profileData) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse">
          <div className="h-32 bg-muted rounded-lg mb-6"></div>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="h-96 bg-muted rounded-lg"></div>
            <div className="md:col-span-2 h-96 bg-muted rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  // Check if user was found
  if (!profileData.user) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <User className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h2 className="text-2xl font-bold mb-2">User Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The profile you're looking for doesn't exist or has been removed.
            </p>
            <Button onClick={() => navigate('/')} data-testid="button-back-home">
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { user, profile } = profileData;

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 w-full">
              <div className="relative flex-shrink-0">
                <Avatar className="h-20 w-20 sm:h-24 sm:w-24">
                  <AvatarImage src={user.profileImageUrl} />
                  <AvatarFallback className="text-2xl">
                    {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                {profile && profile.politicalLeaning && (
                  <div 
                    className="absolute inset-0 rounded-full border-4 pointer-events-none"
                    style={{ 
                      borderColor: getPoliticalLeaningColorFromScore(profile.leaningScore),
                    }}
                    data-testid="political-leaning-ring"
                  />
                )}
              </div>
              
              <div className="space-y-3 flex-1 min-w-0">
                <div className="space-y-1">
                  <h1 className="text-2xl sm:text-3xl font-bold break-words" data-testid="profile-name">
                    {profile?.displayFirstName != null ? profile.displayFirstName : user.firstName}{profile?.displayFirstName != null ? (profile?.displayLastName ? ` ${profile.displayLastName}` : '') : (user.lastName ? ` ${user.lastName}` : '')}
                  </h1>
                  {profile && profile.politicalLeaning && (
                    <p className="text-sm text-muted-foreground" data-testid="political-leaning-label">
                      {getLeaningDescription(profile.leaningScore)}
                      {profile.leaningConfidence && (
                        <span className="text-xs"> • {profile.leaningConfidence} confidence</span>
                      )}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground truncate" data-testid="profile-email">
                    {user.email}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                    Joined {formatJoinDate(user.createdAt)}
                  </p>
                </div>
                
                {profile?.bio && (
                  <p className="text-sm break-words" data-testid="profile-bio">
                    {profile.bio}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:flex-shrink-0">
              {!isOwnProfile && currentUser && (
                <Button
                  onClick={() => followMutation.mutate(followStatus?.isFollowing ? 'unfollow' : 'follow')}
                  disabled={followMutation.isPending}
                  variant={followStatus?.isFollowing ? "outline" : "default"}
                  data-testid="button-follow"
                >
                  {followStatus?.isFollowing ? (
                    <>
                      <UserMinus className="w-4 h-4 mr-2" />
                      Unfollow
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Follow
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
          
          {/* Stats - Now Clickable */}
          <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2 sm:gap-3 mt-6 pt-6 border-t">
            <button 
              className={`text-center hover-elevate active-elevate-2 rounded-md px-2 sm:px-3 py-2 transition-colors ${activeSection === 'opinions' ? 'bg-primary/10' : ''}`}
              onClick={() => setActiveSection('opinions')}
              data-testid="stat-opinions"
            >
              <div className="text-lg sm:text-2xl font-bold">{profile?.totalOpinions || 0}</div>
              <div className="text-xs text-muted-foreground">Opinions</div>
            </button>
            <button 
              className={`text-center hover-elevate active-elevate-2 rounded-md px-2 sm:px-3 py-2 transition-colors ${activeSection === 'debates' ? 'bg-primary/10' : ''}`}
              onClick={() => setActiveSection('debates')}
              data-testid="stat-debates"
            >
              <div className="text-lg sm:text-2xl font-bold">{debateRooms?.length || 0}</div>
              <div className="text-xs text-muted-foreground">Debates</div>
            </button>
            <button 
              className={`text-center hover-elevate active-elevate-2 rounded-md px-2 sm:px-3 py-2 transition-colors ${activeSection === 'badges' ? 'bg-primary/10' : ''}`}
              onClick={() => setActiveSection('badges')}
              data-testid="stat-badges"
            >
              <div className="text-lg sm:text-2xl font-bold">{userBadges.filter((b: any) => b.unlockedAt).length}/{userBadges.length}</div>
              <div className="text-xs text-muted-foreground">Badges</div>
            </button>
            <button 
              className={`text-center hover-elevate active-elevate-2 rounded-md px-2 sm:px-3 py-2 transition-colors ${activeSection === 'leaderboards' ? 'bg-primary/10' : ''}`}
              onClick={() => setActiveSection('leaderboards')}
              data-testid="stat-leaderboards"
            >
              <div className="text-lg sm:text-2xl font-bold">
                <BarChart3 className="w-5 h-5 mx-auto" />
              </div>
              <div className="text-xs text-muted-foreground">Rankings</div>
            </button>
            <button 
              className={`text-center hover-elevate active-elevate-2 rounded-md px-2 sm:px-3 py-2 transition-colors ${activeSection === 'followers' ? 'bg-primary/10' : ''}`}
              onClick={() => setActiveSection('followers')}
              data-testid="stat-followers"
            >
              <div className="text-lg sm:text-2xl font-bold">{profile?.followerCount || 0}</div>
              <div className="text-xs text-muted-foreground">Followers</div>
            </button>
            <button 
              className={`text-center hover-elevate active-elevate-2 rounded-md px-2 sm:px-3 py-2 transition-colors ${activeSection === 'following' ? 'bg-primary/10' : ''}`}
              onClick={() => setActiveSection('following')}
              data-testid="stat-following"
            >
              <div className="text-lg sm:text-2xl font-bold">{profile?.followingCount || 0}</div>
              <div className="text-xs text-muted-foreground">Following</div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content - No Tabs, controlled by stat clicks */}
      <div className="space-y-6">
        {/* Opinions Section */}
        {activeSection === 'opinions' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Opinions</CardTitle>
                  <CardDescription>
                    All opinions shared by {isOwnProfile ? 'you' : `${user.firstName}`}
                  </CardDescription>
                </div>
                <Link href="/settings">
                  <Button variant="outline" size="sm" data-testid="button-sort-settings">
                    <Filter className="w-4 h-4 mr-2" />
                    Sort: {profileData?.profile?.opinionSortPreference === 'most_liked' ? 'Most Liked' : profileData?.profile?.opinionSortPreference === 'most_controversial' ? 'Most Controversial' : profileData?.profile?.opinionSortPreference === 'oldest' ? 'Oldest First' : 'Newest First'}
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {opinionsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : opinions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No opinions shared yet</p>
                  {isOwnProfile && (
                    <p className="text-sm mt-2">
                      Share your first opinion on a debate topic!
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {opinions.map((opinion) => (
                    <div 
                      key={opinion.id} 
                      className="border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer active-elevate-2" 
                      onClick={() => navigate(`/topic/${opinion.topicId}`)}
                      data-testid={`opinion-${opinion.id}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant={
                          opinion.stance === 'for' ? 'default' : 
                          opinion.stance === 'against' ? 'destructive' : 
                          'secondary'
                        }>
                          {opinion.stance}
                        </Badge>
                        <div className="text-sm text-muted-foreground">
                          {new Date(opinion.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <p className="text-sm mb-3">{opinion.content}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <ThumbsUp className="w-3 h-3" />
                          {opinion.likesCount}
                        </div>
                        <div className="flex items-center gap-1">
                          <ThumbsDown className="w-3 h-3" />
                          {opinion.dislikesCount}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Debates Section */}
        {activeSection === 'debates' && (
          <div className="space-y-6">
            {isOwnProfile && (
              <div className="grid gap-6 md:grid-cols-2">
                {/* Create Debate Room Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Swords className="w-5 h-5" />
                      Start a Debate
                    </CardTitle>
                    <CardDescription>
                      Challenge someone to a one-on-one debate
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Dialog open={showCreateDebateDialog} onOpenChange={setShowCreateDebateDialog}>
                      <DialogTrigger asChild>
                        <Button className="w-full" data-testid="button-create-debate">
                          <Plus className="w-4 h-4 mr-2" />
                          Create Debate Room
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Create Debate Room</DialogTitle>
                          <DialogDescription>
                            Set up a one-on-one debate with another user
                          </DialogDescription>
                        </DialogHeader>
                        <Form {...debateForm}>
                          <form onSubmit={debateForm.handleSubmit(onDebateSubmit)} className="space-y-4">
                            <FormField
                              control={debateForm.control}
                              name="topicId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Topic</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid="select-debate-topic">
                                        <SelectValue placeholder="Select a debate topic" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {topics.map((topic: any) => (
                                        <SelectItem key={topic.id} value={topic.id}>
                                          {topic.title}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={debateForm.control}
                              name="participant2Id"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Opponent User ID</FormLabel>
                                  <FormControl>
                                    <Input 
                                      placeholder="Enter opponent's user ID" 
                                      {...field}
                                      data-testid="input-opponent-id"
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Enter the user ID of the person you want to debate with
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={debateForm.control}
                              name="participant1Stance"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Your Stance</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid="select-my-stance">
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="supporting">Supporting</SelectItem>
                                      <SelectItem value="opposing">Opposing</SelectItem>
                                      <SelectItem value="neutral">Neutral</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={debateForm.control}
                              name="participant2Stance"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Opponent's Stance</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid="select-opponent-stance">
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="supporting">Supporting</SelectItem>
                                      <SelectItem value="opposing">Opposing</SelectItem>
                                      <SelectItem value="neutral">Neutral</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <DialogFooter>
                              <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => setShowCreateDebateDialog(false)}
                                data-testid="button-cancel-debate"
                              >
                                Cancel
                              </Button>
                              <Button 
                                type="submit" 
                                disabled={createDebateMutation.isPending}
                                data-testid="button-submit-debate"
                              >
                                {createDebateMutation.isPending ? "Creating..." : "Create Debate"}
                              </Button>
                            </DialogFooter>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>

                {/* Schedule Live Stream Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Video className="w-5 h-5" />
                      Schedule Live Stream
                    </CardTitle>
                    <CardDescription>
                      Host a live debate with multiple participants
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Dialog open={showScheduleStreamDialog} onOpenChange={setShowScheduleStreamDialog}>
                      <DialogTrigger asChild>
                        <Button className="w-full" data-testid="button-schedule-stream">
                          <Clock className="w-4 h-4 mr-2" />
                          Schedule Stream
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Schedule Live Stream</DialogTitle>
                          <DialogDescription>
                            Set up a live debate stream with moderation controls
                          </DialogDescription>
                        </DialogHeader>
                        <Form {...streamForm}>
                          <form onSubmit={streamForm.handleSubmit(onStreamSubmit)} className="space-y-4">
                            <FormField
                              control={streamForm.control}
                              name="topicId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Topic</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid="select-stream-topic">
                                        <SelectValue placeholder="Select a debate topic" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {topics.map((topic: any) => (
                                        <SelectItem key={topic.id} value={topic.id}>
                                          {topic.title}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={streamForm.control}
                              name="title"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Stream Title</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="e.g., Live Debate: Climate Change Solutions"
                                      {...field}
                                      data-testid="input-stream-title"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={streamForm.control}
                              name="description"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Description (Optional)</FormLabel>
                                  <FormControl>
                                    <Textarea
                                      placeholder="Describe what this debate will cover..."
                                      className="resize-none"
                                      maxLength={500}
                                      {...field}
                                      value={field.value || ""}
                                      data-testid="input-stream-description"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={streamForm.control}
                              name="scheduledAt"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Scheduled Time (Optional)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="datetime-local"
                                      {...field}
                                      data-testid="input-stream-scheduled-time"
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Leave empty to start immediately
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={streamForm.control}
                              name="participantSelectionMethod"
                              render={({ field }) => (
                                <FormItem className="space-y-3">
                                  <FormLabel>Participant Selection</FormLabel>
                                  <FormControl>
                                    <RadioGroup
                                      onValueChange={field.onChange}
                                      value={field.value}
                                      className="flex flex-col space-y-1"
                                    >
                                      <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="open" id="open" data-testid="radio-open-voting" />
                                        <Label htmlFor="open" className="font-normal cursor-pointer">
                                          <div className="font-medium">Open Voting</div>
                                          <div className="text-sm text-muted-foreground">
                                            Viewers can vote on who should speak
                                          </div>
                                        </Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="invite" id="invite" data-testid="radio-invite-only" />
                                        <Label htmlFor="invite" className="font-normal cursor-pointer">
                                          <div className="font-medium">Invite Only</div>
                                          <div className="text-sm text-muted-foreground">
                                            Only invited users can participate
                                          </div>
                                        </Label>
                                      </div>
                                    </RadioGroup>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <DialogFooter>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowScheduleStreamDialog(false)}
                                disabled={createStreamMutation.isPending}
                              >
                                Cancel
                              </Button>
                              <Button 
                                type="submit" 
                                disabled={createStreamMutation.isPending}
                                data-testid="button-submit-stream"
                              >
                                {createStreamMutation.isPending ? (
                                  <>
                                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                                    Creating...
                                  </>
                                ) : (
                                  <>
                                    <Video className="w-4 h-4 mr-2" />
                                    Schedule Stream
                                  </>
                                )}
                              </Button>
                            </DialogFooter>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* My Debates and Streams */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {isOwnProfile ? 'My Debates & Streams' : `${user.firstName}'s Debates & Streams`}
                </CardTitle>
                <CardDescription>
                  Active debates and scheduled live streams
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Swords className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No debates or streams yet</p>
                  {isOwnProfile && (
                    <p className="text-sm mt-2">
                      Create your first debate or schedule a live stream!
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Followers Section */}
        {activeSection === 'followers' && (
          <Card>
            <CardHeader>
              <CardTitle>Followers ({followers.length})</CardTitle>
              <CardDescription>
                People following {isOwnProfile ? 'you' : `${user.firstName}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {followers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No followers yet</p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {followers.map((follower) => (
                    <div key={follower.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors" data-testid={`follower-${follower.id}`}>
                      <Avatar>
                        <AvatarImage src={follower.profileImageUrl} />
                        <AvatarFallback>
                          {follower.firstName?.charAt(0)}{follower.lastName?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{follower.firstName} {follower.lastName}</p>
                        <p className="text-sm text-muted-foreground">{follower.email}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/profile/${follower.id}`)}
                        data-testid={`button-view-follower-${follower.id}`}
                      >
                        View Profile
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Following Section */}
        {activeSection === 'following' && (
          <Card>
            <CardHeader>
              <CardTitle>Following ({following.length})</CardTitle>
              <CardDescription>
                People {isOwnProfile ? 'you follow' : `${user.firstName} follows`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {following.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UserPlus className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Not following anyone yet</p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {following.map((followedUser) => (
                    <div key={followedUser.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors" data-testid={`following-${followedUser.id}`}>
                      <Avatar>
                        <AvatarImage src={followedUser.profileImageUrl} />
                        <AvatarFallback>
                          {followedUser.firstName?.charAt(0)}{followedUser.lastName?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{followedUser.firstName} {followedUser.lastName}</p>
                        <p className="text-sm text-muted-foreground">{followedUser.email}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/profile/${followedUser.id}`)}
                        data-testid={`button-view-following-${followedUser.id}`}
                      >
                        View Profile
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Leaderboards Section */}
        {activeSection === 'leaderboards' && (
          <div className="space-y-6">
            {leaderboards ? (
              <>
                {/* Most Opinionated Users */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      Most Opinionated Users
                    </CardTitle>
                    <CardDescription>
                      Top users by total opinions posted
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {leaderboards.mostOpinionated?.map((entry: any, index: number) => (
                        <div
                          key={entry.userId}
                          className={`flex items-center gap-3 p-3 rounded-lg border ${
                            entry.userId === userId ? 'bg-primary/10 ring-2 ring-primary' : 'bg-card'
                          }`}
                          data-testid={`leaderboard-opinions-${index}`}
                        >
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                            index === 0 ? 'bg-yellow-500 text-yellow-50' :
                            index === 1 ? 'bg-gray-400 text-gray-50' :
                            index === 2 ? 'bg-orange-600 text-orange-50' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {index + 1}
                          </div>
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={entry.profileImageUrl} />
                            <AvatarFallback className="text-xs">
                              {entry.firstName?.charAt(0)}{entry.lastName?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {entry.firstName} {entry.lastName}
                              {entry.userId === userId && <span className="text-xs text-primary ml-2">(You)</span>}
                            </p>
                          </div>
                          <Badge variant="secondary">{entry.count} opinions</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Most Active Debaters */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Swords className="w-5 h-5" />
                      Most Active Debaters
                    </CardTitle>
                    <CardDescription>
                      Top users by debate participation
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {leaderboards.mostDebates?.map((entry: any, index: number) => (
                        <div
                          key={entry.userId}
                          className={`flex items-center gap-3 p-3 rounded-lg border ${
                            entry.userId === userId ? 'bg-primary/10 ring-2 ring-primary' : 'bg-card'
                          }`}
                          data-testid={`leaderboard-debates-${index}`}
                        >
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                            index === 0 ? 'bg-yellow-500 text-yellow-50' :
                            index === 1 ? 'bg-gray-400 text-gray-50' :
                            index === 2 ? 'bg-orange-600 text-orange-50' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {index + 1}
                          </div>
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={entry.profileImageUrl} />
                            <AvatarFallback className="text-xs">
                              {entry.firstName?.charAt(0)}{entry.lastName?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {entry.firstName} {entry.lastName}
                              {entry.userId === userId && <span className="text-xs text-primary ml-2">(You)</span>}
                            </p>
                          </div>
                          <Badge variant="secondary">{entry.count} debates</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Top Topic Creators */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="w-5 h-5" />
                      Top Topic Creators
                    </CardTitle>
                    <CardDescription>
                      Top users by topics created
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {leaderboards.mostTopics?.map((entry: any, index: number) => (
                        <div
                          key={entry.userId}
                          className={`flex items-center gap-3 p-3 rounded-lg border ${
                            entry.userId === userId ? 'bg-primary/10 ring-2 ring-primary' : 'bg-card'
                          }`}
                          data-testid={`leaderboard-topics-${index}`}
                        >
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                            index === 0 ? 'bg-yellow-500 text-yellow-50' :
                            index === 1 ? 'bg-gray-400 text-gray-50' :
                            index === 2 ? 'bg-orange-600 text-orange-50' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {index + 1}
                          </div>
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={entry.profileImageUrl} />
                            <AvatarFallback className="text-xs">
                              {entry.firstName?.charAt(0)}{entry.lastName?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {entry.firstName} {entry.lastName}
                              {entry.userId === userId && <span className="text-xs text-primary ml-2">(You)</span>}
                            </p>
                          </div>
                          <Badge variant="secondary">{entry.count} topics</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Logical Reasoning Champions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="w-5 h-5" />
                      Logical Reasoning Champions
                    </CardTitle>
                    <CardDescription>
                      Users with the best logical reasoning (lowest fallacy rate)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {leaderboards.logicalReasoning?.map((entry: any, index: number) => (
                        <div
                          key={entry.userId}
                          className={`flex items-center gap-3 p-3 rounded-lg border ${
                            entry.userId === userId ? 'bg-primary/10 ring-2 ring-primary' : 'bg-card'
                          }`}
                          data-testid={`leaderboard-reasoning-${index}`}
                        >
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                            index === 0 ? 'bg-yellow-500 text-yellow-50' :
                            index === 1 ? 'bg-gray-400 text-gray-50' :
                            index === 2 ? 'bg-orange-600 text-orange-50' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {index + 1}
                          </div>
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={entry.profileImageUrl} />
                            <AvatarFallback className="text-xs">
                              {entry.firstName?.charAt(0)}{entry.lastName?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {entry.firstName} {entry.lastName}
                              {entry.userId === userId && <span className="text-xs text-primary ml-2">(You)</span>}
                            </p>
                          </div>
                          <Badge variant="secondary">{entry.fallacyRate.toFixed(1)}% fallacy rate</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Loading leaderboards...</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Badges Section */}
        {activeSection === 'badges' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Badges
              </CardTitle>
              <CardDescription>
                {isOwnProfile 
                  ? `You've unlocked ${userBadges.filter((b: any) => b.unlockedAt).length} of ${userBadges.length} badges`
                  : `${user.firstName} has unlocked ${userBadges.filter((b: any) => b.unlockedAt).length} of ${userBadges.length} badges`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userBadges.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No badges available yet</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {userBadges.map((userBadge: any) => {
                    const isUnlocked = !!userBadge.unlockedAt;
                    const isSelected = userBadge.isSelected;
                    const IconComponent = userBadge.icon === 'Trophy' ? Trophy :
                                         userBadge.icon === 'Award' ? Award :
                                         userBadge.icon === 'Medal' ? Medal :
                                         userBadge.icon === 'Star' ? Star : Trophy;
                    
                    return (
                      <div
                        key={userBadge.badgeId}
                        className={`relative p-4 border rounded-lg transition-all ${
                          isUnlocked 
                            ? 'bg-card hover-elevate active-elevate-2' 
                            : 'bg-muted/30 opacity-60'
                        } ${isSelected ? 'ring-2 ring-primary' : ''}`}
                        data-testid={`badge-${userBadge.badgeId}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                            isUnlocked ? 'bg-primary/10' : 'bg-muted'
                          }`}>
                            {isUnlocked ? (
                              <IconComponent className="w-6 h-6 text-primary" />
                            ) : (
                              <Lock className="w-6 h-6 text-muted-foreground" />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-semibold text-sm">{userBadge.name}</h3>
                              {isSelected && (
                                <Badge variant="default" className="text-xs">
                                  <Check className="w-3 h-3 mr-1" />
                                  Selected
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {userBadge.description}
                            </p>
                            
                            {isUnlocked ? (
                              <div className="mt-2 flex items-center justify-between">
                                <p className="text-xs text-muted-foreground">
                                  Unlocked {new Date(userBadge.unlockedAt).toLocaleDateString()}
                                </p>
                                {isOwnProfile && (
                                  <Button
                                    size="sm"
                                    variant={isSelected ? "outline" : "default"}
                                    onClick={() => selectBadgeMutation.mutate(isSelected ? null : userBadge.badgeId)}
                                    disabled={selectBadgeMutation.isPending}
                                    data-testid={`button-select-badge-${userBadge.badgeId}`}
                                  >
                                    {isSelected ? 'Deselect' : 'Display'}
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground mt-2">
                                🔒 Locked
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}