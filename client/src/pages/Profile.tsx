import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarWithBadge } from "@/components/AvatarWithBadge";
import { PoliticalCompassChart } from "@/components/PoliticalCompassChart";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import OpinionCard from "@/components/OpinionCard";
import TopicCard from "@/components/TopicCard";
import { CardContainer } from "@/components/CardContainer";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import * as LucideIcons from "lucide-react";
import {
  Users,
  User,
  UserPlus,
  UserMinus,
  BarChart3,
  Calendar,
  Trophy,
  Lock,
  Check,
  ChevronRight,
  Star,
  MessageSquare,
  Swords,
  Lightbulb
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
    economicScore?: number;
    authoritarianScore?: number;
    totalOpinions: number;
    totalLikes: number;
    totalDislikes: number;
    followerCount: number;
    followingCount: number;
    totalTopics: number;
    lastAnalyzedAt?: string;
  };
  followerCount: number;
  followingCount: number;
}

export default function Profile() {
  const { userId } = useParams();
  const [, navigate] = useLocation();
  const { user: currentUser } = useAuth();
  const [showBadgesModal, setShowBadgesModal] = useState(false);
  const [showLeaderboardsModal, setShowLeaderboardsModal] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);

  const isOwnProfile = currentUser?.id === userId;

  // Fetch profile data
  const { data: profileData, isLoading: profileLoading } = useQuery<ProfileData>({
    queryKey: ['/api/profile', userId],
    queryFn: () => fetch(`/api/profile/${userId}`, { credentials: 'include' }).then(res => res.json()),
    enabled: !!userId,
  });

  // Fetch user opinions (enriched with full data for OpinionCard)
  const { data: opinions = [], isLoading: opinionsLoading } = useQuery<any[]>({
    queryKey: ['/api/profile', userId, 'opinions-enriched'],
    queryFn: () => fetch(`/api/profile/${userId}/opinions?limit=5`, { credentials: 'include' }).then(res => res.json()),
    enabled: !!userId,
  });

  // Fetch user's created topics
  const { data: userTopics = [], isLoading: topicsLoading } = useQuery<any[]>({
    queryKey: ['/api/users', userId, 'topics'],
    queryFn: () => fetch(`/api/topics?createdBy=${userId}&limit=5`, { credentials: 'include' }).then(res => res.json()),
    enabled: !!userId,
  });


  // Fetch recommended topics (new endpoint)
  const { data: recommendedTopics = [] } = useQuery<any[]>({
    queryKey: ['/api/users', userId, 'recommended-topics'],
    queryFn: () => fetch(`/api/users/${userId}/recommended-topics?limit=5`, { credentials: 'include' }).then(res => res.json()),
    enabled: !!userId && isOwnProfile,
  });

  // Fetch topics from following (new endpoint)
  const { data: followingTopics = [] } = useQuery<any[]>({
    queryKey: ['/api/users', userId, 'following-topics'],
    queryFn: () => fetch(`/api/users/${userId}/following-topics?limit=5`, { credentials: 'include' }).then(res => res.json()),
    enabled: !!userId && isOwnProfile,
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

  // Fetch user badges
  const { data: userBadges = [] } = useQuery<any[]>({
    queryKey: ['/api/users', userId, 'badges'],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/badges`, { credentials: 'include' });
      const data = await res.json();
      // Handle both array response and object with badges property (backward compatibility)
      if (Array.isArray(data)) {
        return data;
      }
      if (data && typeof data === 'object' && 'badges' in data && Array.isArray(data.badges)) {
        return data.badges;
      }
      return [];
    },
    enabled: !!userId,
  });

  // Fetch leaderboards
  const { data: leaderboards } = useQuery<any>({
    queryKey: ['/api/leaderboards'],
    queryFn: () => fetch('/api/leaderboards', { credentials: 'include' }).then(res => res.json()),
    enabled: showLeaderboardsModal,
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
  });

  // Badge selection mutation
  const selectBadgeMutation = useMutation({
    mutationFn: (badgeId: string | null) => 
      fetch('/api/users/me/selected-badge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ badgeId }),
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users', userId, 'badges'] });
      queryClient.invalidateQueries({ queryKey: ['/api/profile', userId] });
    },
  });

  // Helper functions
  const formatJoinDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    });
  };

  // 2D Political Compass Description
  const get2DPoliticalDescription = (economicScore: number, authoritarianScore: number) => {
    // Economic axis descriptors
    let economicLabel = "";
    const absEconomic = Math.abs(economicScore);
    if (absEconomic >= 85) {
      economicLabel = economicScore < 0 ? "extreme capitalist" : "extreme socialist";
    } else if (absEconomic >= 60) {
      economicLabel = economicScore < 0 ? "very capitalist" : "very socialist";
    } else if (absEconomic >= 30) {
      economicLabel = economicScore < 0 ? "capitalist" : "socialist";
    } else if (absEconomic >= 15) {
      economicLabel = economicScore < 0 ? "moderate capitalist" : "moderate socialist";
    } else {
      economicLabel = "economically centrist";
    }

    // Authoritarian axis descriptors
    let authoritarianLabel = "";
    const absAuthoritarian = Math.abs(authoritarianScore);
    if (absAuthoritarian >= 85) {
      authoritarianLabel = authoritarianScore > 0 ? "extreme authoritarian" : "extreme libertarian";
    } else if (absAuthoritarian >= 60) {
      authoritarianLabel = authoritarianScore > 0 ? "very authoritarian" : "very libertarian";
    } else if (absAuthoritarian >= 30) {
      authoritarianLabel = authoritarianScore > 0 ? "authoritarian" : "libertarian";
    } else if (absAuthoritarian >= 15) {
      authoritarianLabel = authoritarianScore > 0 ? "moderate authoritarian" : "moderate libertarian";
    } else {
      authoritarianLabel = "socially centrist";
    }

    // Combine labels
    if (economicLabel.includes("centrist") && authoritarianLabel.includes("centrist")) {
      return "moderate";
    }
    if (economicLabel.includes("centrist")) {
      return authoritarianLabel;
    }
    if (authoritarianLabel.includes("centrist")) {
      return economicLabel;
    }
    return `${economicLabel}, ${authoritarianLabel}`;
  };

  if (profileLoading || !profileData) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse">
          <div className="h-32 bg-muted rounded-lg mb-6"></div>
          <div className="space-y-6">
            <div className="h-96 bg-muted rounded-lg"></div>
            <div className="h-96 bg-muted rounded-lg"></div>
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
      {/* Profile Header - Cleaner Design */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 w-full">
              <div className="relative flex-shrink-0">
                <AvatarWithBadge
                  userId={userId!}
                  profileImageUrl={user.profileImageUrl}
                  firstName={user.firstName}
                  lastName={user.lastName}
                  className="h-20 w-20 sm:h-24 sm:w-24 text-2xl"
                  showBadge={true}
                  economicScore={profile?.economicScore}
                  authoritarianScore={profile?.authoritarianScore}
                  showPoliticalLeaning={true}
                />
              </div>
              
              <div className="space-y-3 flex-1 min-w-0">
                <div className="space-y-1">
                  <h1 className="text-2xl sm:text-3xl font-bold break-words" data-testid="profile-name">
                    {profile?.displayFirstName != null ? profile.displayFirstName : user.firstName}{profile?.displayFirstName != null ? (profile?.displayLastName ? ` ${profile.displayLastName}` : '') : (user.lastName ? ` ${user.lastName}` : '')}
                  </h1>
                  {profile && (profile.economicScore !== undefined || profile.economicScore !== null) && (profile.authoritarianScore !== undefined || profile.authoritarianScore !== null) && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left" data-testid="political-leaning-label">
                          {get2DPoliticalDescription(profile.economicScore ?? 0, profile.authoritarianScore ?? 0)}
                          {profile.leaningConfidence && (
                            <span className="text-xs" data-testid="confidence-metric"> • {profile.leaningConfidence} confidence</span>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto" data-testid="popover-political-compass">
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Political Compass Position</h4>
                          <PoliticalCompassChart 
                            economicScore={profile.economicScore}
                            authoritarianScore={profile.authoritarianScore}
                            size="sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            Based on analysis of {profile.totalOpinions} opinions
                          </p>
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
                
                {profile?.bio && (
                  <p className="text-sm break-words" data-testid="profile-bio">
                    {profile.bio}
                  </p>
                )}

                {/* Inline Stats - Only 4 Clickable Stats */}
                <div className="flex flex-wrap gap-2 sm:gap-3 pt-2">
                  <button 
                    className="text-center hover-elevate active-elevate-2 rounded-md px-3 py-2 transition-colors border"
                    onClick={() => setShowBadgesModal(true)}
                    data-testid="button-badges"
                  >
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4" />
                      <div>
                        <div className="text-sm font-bold">{userBadges.filter((b: any) => b.unlockedAt).length}/{userBadges.length}</div>
                        <div className="text-xs text-muted-foreground">Badges</div>
                      </div>
                    </div>
                  </button>
                  <button 
                    className="text-center hover-elevate active-elevate-2 rounded-md px-3 py-2 transition-colors border"
                    onClick={() => setShowLeaderboardsModal(true)}
                    data-testid="button-leaderboards"
                  >
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      <div className="text-xs text-muted-foreground">Rankings</div>
                    </div>
                  </button>
                  <button 
                    className="text-center hover-elevate active-elevate-2 rounded-md px-3 py-2 transition-colors border"
                    onClick={() => setShowFollowersModal(true)}
                    data-testid="button-followers"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <div>
                        <div className="text-sm font-bold">{profile?.followerCount || 0}</div>
                        <div className="text-xs text-muted-foreground">Followers</div>
                      </div>
                    </div>
                  </button>
                  <button 
                    className="text-center hover-elevate active-elevate-2 rounded-md px-3 py-2 transition-colors border"
                    onClick={() => setShowFollowingModal(true)}
                    data-testid="button-following"
                  >
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4" />
                      <div>
                        <div className="text-sm font-bold">{profile?.followingCount || 0}</div>
                        <div className="text-xs text-muted-foreground">Following</div>
                      </div>
                    </div>
                  </button>
                </div>
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
        </CardContent>
      </Card>

      {/* Recommended for You Section - Horizontal Scrolling */}
      {isOwnProfile && (
        <div className="space-y-4" data-testid="section-recommended">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              Recommended for You
            </h2>
          </div>
          {recommendedTopics.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
              {recommendedTopics.map((topic) => (
                <CardContainer key={topic.id}>
                  <TopicCard
                    id={topic.id}
                    title={topic.title}
                    description={topic.description}
                    imageUrl={topic.imageUrl}
                    categories={topic.categories}
                    participantCount={topic.participantCount || 0}
                    opinionsCount={topic.opinionCount || 0}
                    isActive={topic.isActive || false}
                    previewContent={topic.previewContent}
                    previewAuthor={topic.previewAuthor}
                    previewIsAI={topic.previewIsAI}
                    diversityScore={topic.diversityScore}
                    politicalDistribution={topic.politicalDistribution}
                  />
                </CardContainer>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <Star className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">
                Share opinions to get personalized recommendations
              </p>
              <Link href="/">
                <Button variant="default" className="mt-4" data-testid="button-browse-topics-recommended">
                  Browse Topics
                </Button>
              </Link>
            </Card>
          )}
        </div>
      )}

      {/* My Topics Section - Horizontal Scrolling */}
      <div className="space-y-4" data-testid="section-my-topics">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">My Topics</h2>
          {userTopics.length > 0 && (
            <Link href={`/profile/${userId}`}>
              <Button variant="ghost" size="sm" data-testid="link-view-all-topics">
                View All
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          )}
        </div>
        {userTopics.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
            {userTopics.map((topic) => (
              <CardContainer key={topic.id}>
                <TopicCard
                  id={topic.id}
                  title={topic.title}
                  description={topic.description}
                  imageUrl={topic.imageUrl}
                  categories={topic.categories}
                  participantCount={topic.participantCount || 0}
                  opinionsCount={topic.opinionCount || 0}
                  isActive={topic.isActive || false}
                  previewContent={topic.previewContent}
                  previewAuthor={topic.previewAuthor}
                  previewIsAI={topic.previewIsAI}
                  diversityScore={topic.diversityScore}
                  politicalDistribution={topic.politicalDistribution}
                />
              </CardContainer>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">
              {isOwnProfile ? "You haven't created any topics yet" : "No topics created yet"}
            </p>
            {isOwnProfile && (
              <Link href="/">
                <Button variant="default" className="mt-4" data-testid="button-create-topic">
                  Create a Topic
                </Button>
              </Link>
            )}
          </Card>
        )}
      </div>

      {/* From People You Follow Section - Horizontal Scrolling (Mixed Topics & Opinions) */}
      {isOwnProfile && (
        <div className="space-y-4" data-testid="section-following">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Users className="w-5 h-5" />
              From People You Follow
            </h2>
          </div>
          {followingTopics.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
              {followingTopics.map((item: any) => (
                <CardContainer key={`${item.type}-${item.id}`}>
                  {item.type === 'topic' ? (
                    <TopicCard
                      id={item.id}
                      title={item.title}
                      description={item.description}
                      imageUrl={item.imageUrl}
                      categories={item.categories}
                      participantCount={item.participantCount || 0}
                      opinionsCount={item.opinionCount || 0}
                      isActive={item.isActive || false}
                      previewContent={item.previewContent}
                      previewAuthor={item.previewAuthor}
                      previewIsAI={item.previewIsAI}
                      diversityScore={item.diversityScore}
                      politicalDistribution={item.politicalDistribution}
                    />
                  ) : (
                    <OpinionCard
                      id={item.id}
                      topicId={item.topicId}
                      userId={item.userId}
                      userName={`${item.user?.firstName || ''} ${item.user?.lastName || ''}`}
                      userAvatar={item.user?.profileImageUrl}
                      economicScore={item.user?.economicScore}
                      authoritarianScore={item.user?.authoritarianScore}
                      topicEconomicScore={item.topic?.economicScore}
                      topicAuthoritarianScore={item.topic?.authoritarianScore}
                      content={item.content}
                      stance={item.stance}
                      debateStatus={item.debateStatus}
                      timestamp={item.createdAt}
                      likesCount={item.likesCount || 0}
                      dislikesCount={item.dislikesCount || 0}
                      references={item.references}
                      fallacyCounts={item.fallacyCounts}
                    />
                  )}
                </CardContainer>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <UserPlus className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">
                Follow users to see their topics and opinions here
              </p>
            </Card>
          )}
        </div>
      )}

      {/* My Opinions Section - Horizontal Scrolling */}
      <div className="space-y-4" data-testid="section-my-opinions">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">My Opinions</h2>
          {opinions.length > 0 && (
            <Link href={`/profile/${userId}`}>
              <Button variant="ghost" size="sm" data-testid="link-view-all-opinions">
                View All
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          )}
        </div>
        {opinions.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
            {opinions.map((opinion) => (
              <CardContainer key={opinion.id}>
                <OpinionCard
                  id={opinion.id}
                  topicId={opinion.topicId}
                  userId={opinion.userId}
                  userName={`${opinion.user?.firstName || ''} ${opinion.user?.lastName || ''}`}
                  userAvatar={opinion.user?.profileImageUrl}
                  economicScore={opinion.user?.economicScore}
                  authoritarianScore={opinion.user?.authoritarianScore}
                  topicEconomicScore={opinion.topic?.economicScore}
                  topicAuthoritarianScore={opinion.topic?.authoritarianScore}
                  content={opinion.content}
                  stance={opinion.stance}
                  debateStatus={opinion.debateStatus}
                  timestamp={opinion.createdAt}
                  likesCount={opinion.likesCount || 0}
                  dislikesCount={opinion.dislikesCount || 0}
                  references={opinion.references}
                  fallacyCounts={opinion.fallacyCounts}
                />
              </CardContainer>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">
              {isOwnProfile ? "You haven't shared any opinions yet" : "No opinions shared yet"}
            </p>
            {isOwnProfile && (
              <Link href="/">
                <Button variant="default" className="mt-4" data-testid="button-browse-topics">
                  Browse Topics
                </Button>
              </Link>
            )}
          </Card>
        )}
      </div>

      {/* Badges Modal */}
      <Dialog open={showBadgesModal} onOpenChange={setShowBadgesModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Badges
            </DialogTitle>
            <DialogDescription>
              {isOwnProfile 
                ? `You've unlocked ${userBadges.filter((b: any) => b.unlockedAt).length} of ${userBadges.length} badges`
                : `${user.firstName} has unlocked ${userBadges.filter((b: any) => b.unlockedAt).length} of ${userBadges.length} badges`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
            {userBadges.map((userBadge: any) => {
              const isUnlocked = !!userBadge.unlockedAt;
              const isSelected = userBadge.isSelected;
              const IconComponent = (LucideIcons as any)[userBadge.icon] || Trophy;
              
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
        </DialogContent>
      </Dialog>

      {/* Leaderboards Modal */}
      <Dialog open={showLeaderboardsModal} onOpenChange={setShowLeaderboardsModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Leaderboards
            </DialogTitle>
            <DialogDescription>
              See how you rank among other users
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            {leaderboards ? (
              <>
                {/* Most Opinionated Users */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Most Opinionated Users
                  </h3>
                  <div className="space-y-2">
                    {(leaderboards.mostOpinionated || []).map((entry: any, index: number) => (
                      <div
                        key={entry.userId}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          entry.userId === userId ? 'bg-primary/10 ring-2 ring-primary' : 'bg-card'
                        }`}
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
                </div>

                {/* Most Active Debaters */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Swords className="w-4 h-4" />
                    Most Active Debaters
                  </h3>
                  <div className="space-y-2">
                    {(leaderboards.mostDebates || []).map((entry: any, index: number) => (
                      <div
                        key={entry.userId}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          entry.userId === userId ? 'bg-primary/10 ring-2 ring-primary' : 'bg-card'
                        }`}
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
                </div>

                {/* Top Topic Creators */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4" />
                    Top Topic Creators
                  </h3>
                  <div className="space-y-2">
                    {(leaderboards.mostTopics || []).map((entry: any, index: number) => (
                      <div
                        key={entry.userId}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          entry.userId === userId ? 'bg-primary/10 ring-2 ring-primary' : 'bg-card'
                        }`}
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
                </div>

                {/* Logical Reasoning Champions */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Star className="w-4 h-4" />
                    Logical Reasoning Champions
                  </h3>
                  <div className="space-y-2">
                    {(leaderboards.logicalReasoning || []).map((entry: any, index: number) => (
                      <div
                        key={entry.userId}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          entry.userId === userId ? 'bg-primary/10 ring-2 ring-primary' : 'bg-card'
                        }`}
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
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Loading leaderboards...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Followers Modal */}
      <Dialog open={showFollowersModal} onOpenChange={setShowFollowersModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Followers ({followers.length})
            </DialogTitle>
            <DialogDescription>
              People following {isOwnProfile ? 'you' : `${user.firstName}`}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {followers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No followers yet</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {followers.map((follower) => (
                  <div key={follower.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors">
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
                      onClick={() => {
                        setShowFollowersModal(false);
                        navigate(`/profile/${follower.id}`);
                      }}
                    >
                      View Profile
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Following Modal */}
      <Dialog open={showFollowingModal} onOpenChange={setShowFollowingModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Following ({following.length})
            </DialogTitle>
            <DialogDescription>
              People {isOwnProfile ? 'you follow' : `${user.firstName} follows`}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {following.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UserPlus className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Not following anyone yet</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {following.map((followedUser) => (
                  <div key={followedUser.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors">
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
                      onClick={() => {
                        setShowFollowingModal(false);
                        navigate(`/profile/${followedUser.id}`);
                      }}
                    >
                      View Profile
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
