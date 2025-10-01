import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useToast } from "@/hooks/use-toast";
import {
  Users,
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
  Plus
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
    politicalLeaning?: string;
    leaningScore: number;
    leaningConfidence: string;
    totalOpinions: number;
    totalLikes: number;
    totalDislikes: number;
    followerCount: number;
    followingCount: number;
    lastAnalyzedAt?: string;
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

const profileFormSchema = insertUserProfileSchema.extend({
  bio: z.string().max(500).optional(),
});

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
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [opinionSortBy, setOpinionSortBy] = useState<'recent' | 'popular' | 'controversial'>('recent');
  const [showCreateDebateDialog, setShowCreateDebateDialog] = useState(false);
  const [showScheduleStreamDialog, setShowScheduleStreamDialog] = useState(false);

  const isOwnProfile = currentUser?.id === userId;

  // Fetch profile data
  const { data: profileData, isLoading: profileLoading } = useQuery<ProfileData>({
    queryKey: ['/api/profile', userId],
    queryFn: () => fetch(`/api/profile/${userId}`, { credentials: 'include' }).then(res => res.json()),
    enabled: !!userId,
  });

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

  // Fetch topics for stream creation
  const { data: topics = [] } = useQuery<any[]>({
    queryKey: ['/api/topics'],
    enabled: isOwnProfile && showScheduleStreamDialog,
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
      toast({ 
        title: followStatus?.isFollowing ? "Unfollowed successfully" : "Following user",
        description: followStatus?.isFollowing ? "You are no longer following this user." : "You are now following this user."
      });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to update follow status.",
        variant: "destructive"
      });
    }
  });

  // Political analysis mutation
  const analyzeMutation = useMutation({
    mutationFn: () => fetch(`/api/profile/${userId}/analyze`, { method: 'POST', credentials: 'include' }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile', userId] });
      toast({ 
        title: "Analysis Complete", 
        description: "Your political leaning has been analyzed!"
      });
    },
    onError: () => {
      toast({ 
        title: "Analysis Failed", 
        description: "Unable to analyze political leaning. Try again later.",
        variant: "destructive"
      });
    }
  });

  // Profile update form
  const form = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      bio: profileData?.profile?.bio || "",
    },
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

  // Update form when profile data loads
  useEffect(() => {
    if (profileData?.profile?.bio) {
      form.reset({
        bio: profileData.profile.bio,
      });
    }
  }, [profileData, form]);

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: (data: z.infer<typeof profileFormSchema>) => 
      fetch(`/api/profile/${userId}`, { 
        method: 'PATCH', 
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile', userId] });
      setIsEditing(false);
      toast({ title: "Profile updated successfully!" });
    },
    onError: () => {
      toast({ 
        title: "Update failed", 
        description: "Unable to update profile.",
        variant: "destructive" 
      });
    }
  });

  const onSubmit = (data: z.infer<typeof profileFormSchema>) => {
    console.log('Profile form submission:', data);
    updateProfileMutation.mutate(data);
  };

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
      toast({ 
        title: "Debate room created!",
        description: "Your debate has been set up successfully."
      });
      navigate(`/debate-room/${data.id}`);
    },
    onError: () => {
      toast({ 
        title: "Failed to create debate", 
        description: "Unable to create debate room.",
        variant: "destructive" 
      });
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
      toast({ 
        title: "Stream scheduled successfully!",
        description: "Your live debate stream has been created."
      });
      navigate(`/live-stream/${data.id}`);
    },
    onError: () => {
      toast({ 
        title: "Failed to schedule stream", 
        description: "Unable to create live stream.",
        variant: "destructive" 
      });
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
        return 'bg-blue-500';
      case 'conservative':
      case 'moderate-conservative':
        return 'bg-red-500';
      case 'moderate':
        return 'bg-purple-500';
      case 'libertarian':
        return 'bg-yellow-500';
      case 'populist':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
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

  const { user, profile } = profileData;

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={user.profileImageUrl} />
                <AvatarFallback className="text-2xl">
                  {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              
              <div className="space-y-2">
                <div>
                  <h1 className="text-3xl font-bold" data-testid="profile-name">
                    {user.firstName} {user.lastName}
                  </h1>
                  <p className="text-muted-foreground" data-testid="profile-email">
                    {user.email}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Joined {formatJoinDate(user.createdAt)}
                  </p>
                </div>
                
                {profile?.bio && (
                  <p className="text-sm max-w-md" data-testid="profile-bio">
                    {profile.bio}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
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
              
              {isOwnProfile && (
                <Button
                  onClick={() => setIsEditing(!isEditing)}
                  variant="outline"
                  data-testid="button-edit-profile"
                >
                  {isEditing ? (
                    <>
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </>
                  ) : (
                    <>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Profile
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
          
          {/* Stats */}
          <div className="flex items-center gap-6 mt-6 pt-6 border-t">
            <div className="text-center" data-testid="stat-opinions">
              <div className="text-2xl font-bold">{profile?.totalOpinions || 0}</div>
              <div className="text-sm text-muted-foreground">Opinions</div>
            </div>
            <div className="text-center" data-testid="stat-followers">
              <div className="text-2xl font-bold">{profile?.followerCount || 0}</div>
              <div className="text-sm text-muted-foreground">Followers</div>
            </div>
            <div className="text-center" data-testid="stat-following">
              <div className="text-2xl font-bold">{profile?.followingCount || 0}</div>
              <div className="text-sm text-muted-foreground">Following</div>
            </div>
            <div className="text-center" data-testid="stat-likes">
              <div className="text-2xl font-bold text-green-600">{profile?.totalLikes || 0}</div>
              <div className="text-sm text-muted-foreground">Likes</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Profile Form */}
      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Profile</CardTitle>
            <CardDescription>Update your profile information</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bio</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Tell us about yourself..."
                          className="resize-none"
                          maxLength={500}
                          {...field}
                          data-testid="input-bio"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2">
                  <Button type="submit" disabled={updateProfileMutation.isPending} data-testid="button-save-profile">
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="opinions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="opinions" data-testid="tab-opinions">
            <MessageSquare className="w-4 h-4 mr-2" />
            Opinions
          </TabsTrigger>
          <TabsTrigger value="debates" data-testid="tab-debates">
            <Swords className="w-4 h-4 mr-2" />
            Debates
          </TabsTrigger>
          <TabsTrigger value="leaning" data-testid="tab-leaning">
            <Brain className="w-4 h-4 mr-2" />
            Political Leaning
          </TabsTrigger>
          <TabsTrigger value="followers" data-testid="tab-followers">
            <Users className="w-4 h-4 mr-2" />
            Followers
          </TabsTrigger>
          <TabsTrigger value="following" data-testid="tab-following">
            <UserPlus className="w-4 h-4 mr-2" />
            Following
          </TabsTrigger>
        </TabsList>

        {/* Opinions Tab */}
        <TabsContent value="opinions">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Opinions</CardTitle>
                  <CardDescription>
                    All opinions shared by {isOwnProfile ? 'you' : `${user.firstName}`}
                  </CardDescription>
                </div>
                <Select value={opinionSortBy} onValueChange={(value: any) => setOpinionSortBy(value)}>
                  <SelectTrigger className="w-48" data-testid="select-sort-opinions">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Most Recent</SelectItem>
                    <SelectItem value="popular">Most Popular</SelectItem>
                    <SelectItem value="controversial">Most Controversial</SelectItem>
                  </SelectContent>
                </Select>
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
                    <div key={opinion.id} className="border rounded-lg p-4 hover:bg-muted/30 transition-colors" data-testid={`opinion-${opinion.id}`}>
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
        </TabsContent>

        {/* Debates Tab */}
        <TabsContent value="debates">
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
        </TabsContent>

        {/* Political Leaning Tab */}
        <TabsContent value="leaning">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Political Leaning Analysis</CardTitle>
                  <CardDescription>
                    AI-powered analysis based on expressed opinions
                  </CardDescription>
                </div>
                {isOwnProfile && (
                  <Button
                    onClick={() => analyzeMutation.mutate()}
                    disabled={analyzeMutation.isPending}
                    data-testid="button-analyze-leaning"
                  >
                    <Brain className="w-4 h-4 mr-2" />
                    {analyzeMutation.isPending ? 'Analyzing...' : 'Analyze Leaning'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {profile?.politicalLeaning ? (
                <div className="space-y-6">
                  {/* Leaning Overview */}
                  <div className="text-center space-y-4">
                    <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${getPoliticalLeaningColor(profile.politicalLeaning)} text-white text-2xl font-bold`}>
                      {profile.politicalLeaning.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold capitalize" data-testid="political-leaning">
                        {profile.politicalLeaning.replace('-', ' ')}
                      </h3>
                      <p className="text-muted-foreground">{getLeaningDescription(profile.leaningScore)}</p>
                    </div>
                  </div>

                  {/* Score Visualization */}
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-600">Progressive</span>
                      <span className="text-red-600">Conservative</span>
                    </div>
                    <div className="relative">
                      <Progress 
                        value={((profile.leaningScore + 100) / 200) * 100} 
                        className="h-3"
                      />
                      <div 
                        className="absolute top-0 w-1 h-3 bg-black rounded"
                        style={{ left: '50%', transform: 'translateX(-50%)' }}
                      />
                    </div>
                    <div className="text-center">
                      <span className="text-lg font-semibold" data-testid="leaning-score">
                        {profile.leaningScore > 0 ? '+' : ''}{profile.leaningScore}
                      </span>
                      <span className="text-sm text-muted-foreground ml-2">
                        ({profile.leaningConfidence} confidence)
                      </span>
                    </div>
                  </div>

                  {/* Analysis Details */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{profile.totalOpinions}</div>
                      <div className="text-sm text-muted-foreground">Opinions Analyzed</div>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold capitalize">{profile.leaningConfidence}</div>
                      <div className="text-sm text-muted-foreground">Confidence Level</div>
                    </div>
                  </div>

                  {profile.lastAnalyzedAt && (
                    <p className="text-xs text-muted-foreground text-center">
                      Last analyzed: {new Date(profile.lastAnalyzedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 space-y-4">
                  <Brain className="w-12 h-12 mx-auto opacity-50" />
                  <div>
                    <h3 className="text-lg font-medium">No Analysis Available</h3>
                    <p className="text-muted-foreground">
                      {isOwnProfile 
                        ? "Share some opinions first, then analyze your political leaning!"
                        : "This user hasn't analyzed their political leaning yet."}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Followers Tab */}
        <TabsContent value="followers">
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
        </TabsContent>

        {/* Following Tab */}
        <TabsContent value="following">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}