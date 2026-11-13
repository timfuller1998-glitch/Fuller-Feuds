import { useQuery, useMutation } from "@tanstack/react-query";
import { UserHandle } from "@/components/UserHandle";
import { useParams, useLocation, Link } from "wouter";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarWithBadge } from "@/components/AvatarWithBadge";
import { PoliticalCompassChart } from "@/components/PoliticalCompassChart";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { queryClient, apiRequest } from "@/lib/queryClient";
import CardDeck from "@/components/CardDeck";
import TopicCard from "@/components/TopicCard";
import LeaderboardsDialog, { useLeaderboards, bestRank } from "@/components/LeaderboardsDialog";
import { OpinionDeckFront, OpinionDeckBack } from "@/components/OpinionDeckCard";
import { useAuth } from "@/hooks/useAuth";
import * as LucideIcons from "lucide-react";
import {
  Users,
  User,
  UserPlus,
  UserMinus,
  Trophy,
  Lock,
  Check,
  ChevronRight,
  BarChart3,
  Star,
  MessageSquare,
  Lightbulb,
  Settings,
  Search,
  Swords,
} from "lucide-react";

function asList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.topics)) return data.topics;
  return [];
}

interface ProfileData {
  user: {
    id: string;
    email?: string;
    firstName: string;
    bio?: string;
    lastName: string;
    handle?: string | null;
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
    lastAnalyzedAt?: string;
  };
  followerCount: number;
  followingCount: number;
}

interface Person {
  id: string;
  firstName?: string;
  lastName?: string;
  handle?: string | null;
  profileImageUrl?: string;
  isFollowedByMe?: boolean;
}

type ProfileTab = "profile" | "opinions" | "topics" | "followers" | "following" | "badges";

function displayName(user?: ProfileData["user"], profile?: ProfileData["profile"]) {
  if (!user) return "Member";
  if (profile?.displayFirstName != null && profile.displayFirstName !== "") {
    return `${profile.displayFirstName}${profile.displayLastName ? ` ${profile.displayLastName}` : ""}`.trim();
  }
  return `${user.firstName ?? ""}${user.lastName ? ` ${user.lastName}` : ""}`.trim() || "Member";
}

function personName(person: Person) {
  return `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim() || "Member";
}

function EditorialCover() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#efe9dc]" aria-hidden="true">
      <svg viewBox="0 0 800 200" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        <rect width="800" height="200" fill="#efe9dc" />
        <path d="M-40,170 C80,40 220,220 360,90 C500,-20 620,160 840,70 L840,200 L-40,200 Z" fill="#f7f2e9" />
        <path d="M-20,30 C140,110 260,-20 420,80 C560,160 700,20 820,90" fill="none" stroke="#211c17" strokeOpacity="0.12" strokeWidth="1.25" />
        <path d="M-30,120 C160,20 300,150 470,60 C620,-10 740,130 860,40" fill="none" stroke="#e3b85a" strokeOpacity="0.7" strokeWidth="1.4" />
        <circle cx="640" cy="46" r="54" fill="#8c2121" fillOpacity="0.08" />
        <circle cx="120" cy="160" r="70" fill="#211c17" fillOpacity="0.05" />
        <path d="M480,0 C520,70 600,50 640,120" fill="none" stroke="#8c2121" strokeOpacity="0.35" strokeWidth="1.2" />
      </svg>
    </div>
  );
}

function PersonCard({
  person,
  currentUserId,
  pending,
  onOpen,
  onFollow,
}: {
  person: Person;
  currentUserId?: string;
  pending?: boolean;
  onOpen: () => void;
  onFollow: (action: "follow" | "unfollow") => void;
}) {
  const isSelf = !!currentUserId && person.id === currentUserId;
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
      data-testid={`person-card-${person.id}`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
        data-testid={`button-open-person-${person.id}`}
      >
        <Avatar className="h-11 w-11 flex-shrink-0">
          <AvatarImage src={person.profileImageUrl} />
          <AvatarFallback className="text-xs">
            {person.firstName?.charAt(0)}
            {person.lastName?.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0">
          <span className="block font-medium truncate text-sm">{personName(person)}</span>
          <UserHandle handle={person.handle} />
        </span>
      </button>
      {!isSelf && currentUserId && (
        <Button
          type="button"
          size="sm"
          variant={person.isFollowedByMe ? "default" : "outline"}
          disabled={pending}
          onClick={() => onFollow(person.isFollowedByMe ? "unfollow" : "follow")}
          data-testid={`button-follow-person-${person.id}`}
        >
          {person.isFollowedByMe ? "Followed" : "Follow"}
        </Button>
      )}
    </div>
  );
}

export default function Profile() {
  const { userId } = useParams();
  const [, navigate] = useLocation();
  const { user: currentUser } = useAuth();
  const [opinionIndex, setOpinionIndex] = useState(0);
  const [showLeaderboardsModal, setShowLeaderboardsModal] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");
  const [peopleSearch, setPeopleSearch] = useState("");

  const isOwnProfile = currentUser?.id === userId;

  const { data: profileData, isLoading: profileLoading } = useQuery<ProfileData>({
    queryKey: ["/api/profile", userId],
    queryFn: () => fetch(`/api/profile/${userId}`, { credentials: "include" }).then((res) => res.json()),
    enabled: !!userId,
  });

  const { data: opinions = [], isLoading: opinionsLoading } = useQuery<any[]>({
    queryKey: ["/api/profile", userId, "opinions-enriched"],
    queryFn: () =>
      fetch(`/api/profile/${userId}/opinions?limit=20`, { credentials: "include" })
        .then((res) => res.json())
        .then(asList)
        .then((rows) => rows.map((op: any) => ({ ...op, author: op.author ?? op.user }))),
    enabled: !!userId,
  });

  const { data: userTopics = [], isLoading: topicsLoading } = useQuery<any[]>({
    queryKey: ["/api/users", userId, "topics"],
    queryFn: () =>
      fetch(`/api/topics?createdBy=${userId}&limit=20`, { credentials: "include" })
        .then((res) => res.json())
        .then(asList),
    enabled: !!userId,
  });

  const { data: recommendedTopics = [] } = useQuery<any[]>({
    queryKey: ["/api/users", userId, "recommended-topics"],
    queryFn: () =>
      fetch(`/api/users/${userId}/recommended-topics?limit=5`, { credentials: "include" })
        .then((res) => res.json())
        .then(asList),
    enabled: !!userId && isOwnProfile,
  });

  const { data: followingTopics = [] } = useQuery<any[]>({
    queryKey: ["/api/users", userId, "following-topics"],
    queryFn: () =>
      fetch(`/api/users/${userId}/following-topics?limit=5`, { credentials: "include" })
        .then((res) => res.json())
        .then(asList),
    enabled: !!userId && isOwnProfile,
  });

  const { data: followStatus } = useQuery<{ isFollowing: boolean }>({
    queryKey: ["/api/follow", userId, "status"],
    queryFn: () => fetch(`/api/follow/${userId}/status`, { credentials: "include" }).then((res) => res.json()),
    enabled: !!userId && !isOwnProfile && !!currentUser,
  });

  const { data: followers = [] } = useQuery<Person[]>({
    queryKey: ["/api/profile", userId, "followers"],
    queryFn: () =>
      fetch(`/api/profile/${userId}/followers`, { credentials: "include" })
        .then((res) => res.json())
        .then(asList),
    enabled: !!userId,
  });

  const { data: following = [] } = useQuery<Person[]>({
    queryKey: ["/api/profile", userId, "following"],
    queryFn: () =>
      fetch(`/api/profile/${userId}/following`, { credentials: "include" })
        .then((res) => res.json())
        .then(asList),
    enabled: !!userId,
  });

  const { data: userBadges = [] } = useQuery<any[]>({
    queryKey: ["/api/users", userId, "badges"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/badges`, { credentials: "include" });
      const data = await res.json();
      if (Array.isArray(data)) return data;
      if (data && typeof data === "object" && "badges" in data && Array.isArray(data.badges)) return data.badges;
      return [];
    },
    enabled: !!userId,
  });

  const { data: debateStats } = useQuery<{ totalDebates?: number }>({
    queryKey: ["/api/users", userId, "debate-stats"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/debate-stats`, { credentials: "include" });
      if (!res.ok) return {};
      return res.json();
    },
    enabled: !!userId,
  });

  const earnedBadges = userBadges.filter((b: any) => b.unlockedAt);
  const lockedBadges = userBadges.filter((b: any) => !b.unlockedAt);
  const { data: leaderboards } = useLeaderboards(userId);
  const topRank = bestRank(leaderboards);

  const followMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "follow" | "unfollow" }) =>
      fetch(`/api/follow/${id}`, {
        method: action === "follow" ? "POST" : "DELETE",
        credentials: "include",
      }).then((res) => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/follow", userId, "status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile", userId, "followers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile", userId, "following"] });
    },
  });

  const voteMutation = useMutation({
    mutationFn: ({
      opinionId,
      voteType,
      currentVote,
    }: {
      opinionId: string;
      voteType: "like" | "dislike";
      currentVote?: string | null;
    }) =>
      apiRequest("POST", `/api/opinions/${opinionId}/vote`, {
        voteType: currentVote === voteType ? null : voteType,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile", userId, "opinions-enriched"] });
    },
  });

  const selectBadgeMutation = useMutation({
    mutationFn: (badgeId: string | null) =>
      fetch("/api/users/me/selected-badge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ badgeId }),
      }).then((res) => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "badges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile", userId] });
    },
  });

  const formatJoinDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "long" });

  const get2DPoliticalDescription = (economicScore: number, authoritarianScore: number) => {
    let economicLabel = "";
    const absEconomic = Math.abs(economicScore);
    if (absEconomic >= 85) economicLabel = economicScore < 0 ? "extreme capitalist" : "extreme socialist";
    else if (absEconomic >= 60) economicLabel = economicScore < 0 ? "very capitalist" : "very socialist";
    else if (absEconomic >= 30) economicLabel = economicScore < 0 ? "capitalist" : "socialist";
    else if (absEconomic >= 15) economicLabel = economicScore < 0 ? "moderate capitalist" : "moderate socialist";
    else economicLabel = "economically centrist";

    let authoritarianLabel = "";
    const absAuthoritarian = Math.abs(authoritarianScore);
    if (absAuthoritarian >= 85) authoritarianLabel = authoritarianScore > 0 ? "extreme authoritarian" : "extreme libertarian";
    else if (absAuthoritarian >= 60) authoritarianLabel = authoritarianScore > 0 ? "very authoritarian" : "very libertarian";
    else if (absAuthoritarian >= 30) authoritarianLabel = authoritarianScore > 0 ? "authoritarian" : "libertarian";
    else if (absAuthoritarian >= 15) authoritarianLabel = authoritarianScore > 0 ? "moderate authoritarian" : "moderate libertarian";
    else authoritarianLabel = "socially centrist";

    if (economicLabel.includes("centrist") && authoritarianLabel.includes("centrist")) return "moderate";
    if (economicLabel.includes("centrist")) return authoritarianLabel;
    if (authoritarianLabel.includes("centrist")) return economicLabel;
    return `${economicLabel}, ${authoritarianLabel}`;
  };

  const peopleList = activeTab === "following" ? following : followers;
  const filteredPeople = useMemo(() => {
    const q = peopleSearch.trim().toLowerCase();
    if (!q) return peopleList;
    return peopleList.filter((p) => {
      const name = personName(p).toLowerCase();
      const handle = (p.handle || "").toLowerCase();
      return name.includes(q) || handle.includes(q);
    });
  }, [peopleList, peopleSearch]);

  if (profileLoading || !profileData) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <div className="animate-pulse space-y-4">
          <div className="h-16 bg-muted rounded-lg" />
          <div className="h-72 bg-muted rounded-lg" />
          <div className="h-40 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  if (!profileData.user) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <User className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h2 className="text-2xl font-bold mb-2">User Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The profile you're looking for doesn't exist or has been removed.
            </p>
            <Button onClick={() => navigate("/")} data-testid="button-back-home">
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { user, profile } = profileData;
  const name = displayName(user, profile);
  const opinionCount = profile?.totalOpinions ?? opinions.length;
  const followerCount = profileData.followerCount ?? profile?.followerCount ?? 0;
  const followingCount = profileData.followingCount ?? profile?.followingCount ?? 0;
  const totalDebates = typeof debateStats?.totalDebates === "number" ? debateStats.totalDebates : null;
  const hasLeaning =
    !!profile && profile.economicScore != null && profile.authoritarianScore != null && (profile.totalOpinions ?? 0) > 0;
  const leaningLabel = hasLeaning
    ? get2DPoliticalDescription(profile!.economicScore ?? 0, profile!.authoritarianScore ?? 0)
    : null;

  const stats: { key: ProfileTab; label: string; value: number | string; icon: typeof MessageSquare; testId: string }[] = [
    { key: "opinions", label: "Opinions", value: opinionCount, icon: MessageSquare, testId: "button-stat-opinions" },
    { key: "followers", label: "Followers", value: followerCount, icon: Users, testId: "button-followers" },
    { key: "following", label: "Following", value: followingCount, icon: UserPlus, testId: "button-following" },
  ];

  const tabs: { id: ProfileTab; label: string; icon: typeof User; testId: string }[] = [
    { id: "profile", label: "Profile", icon: User, testId: "tab-profile" },
    { id: "opinions", label: "Opinions", icon: MessageSquare, testId: "tab-opinions" },
    { id: "topics", label: "Topics", icon: Lightbulb, testId: "tab-topics" },
    { id: "followers", label: "Followers", icon: Users, testId: "tab-followers" },
    { id: "following", label: "Following", icon: UserPlus, testId: "tab-following" },
    { id: "badges", label: "Badges", icon: Trophy, testId: "tab-badges" },
  ];

  const sectionMeta: Record<ProfileTab, { title: string; count?: number }> = {
    profile: { title: "Profile" },
    opinions: { title: isOwnProfile ? "My Opinions" : `${user.firstName}'s Opinions`, count: opinionCount },
    topics: { title: isOwnProfile ? "My Topics" : `${user.firstName}'s Topics`, count: userTopics.length },
    followers: { title: "Followers", count: followerCount },
    following: { title: "Following", count: followingCount },
    badges: { title: "Badges", count: earnedBadges.length },
  };

  const renderTopicCard = (topic: any) => (
    <div key={topic.id} className="w-full max-w-[420px]">
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
    </div>
  );

  const renderPeopleGrid = () => {
    const kind = activeTab === "following" ? "following" : "followers";
    return (
      <div className="space-y-4" data-testid={`section-${kind}`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={peopleSearch}
            onChange={(e) => setPeopleSearch(e.target.value)}
            placeholder={kind === "following" ? "Search following" : "Search followers"}
            className="pl-9"
            data-testid="input-search-people"
          />
        </div>
        {filteredPeople.length === 0 ? (
          <Card className="p-8 text-center">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">
              {peopleSearch
                ? "No one matches that search"
                : kind === "following"
                  ? isOwnProfile
                    ? "Not following anyone yet"
                    : "Not following anyone yet"
                  : "No followers yet"}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredPeople.map((person) => (
              <PersonCard
                key={person.id}
                person={person}
                currentUserId={currentUser?.id}
                pending={followMutation.isPending}
                onOpen={() => navigate(`/profile/${person.id}`)}
                onFollow={(action) => followMutation.mutate({ id: person.id, action })}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderBadges = () => (
    <div className="space-y-6" data-testid="section-badges">
      {[{ title: "Earned", list: earnedBadges }, { title: "Locked", list: lockedBadges }].map(({ title, list }) =>
        list.length === 0 ? null : (
          <div key={title} className="space-y-2" data-testid={`badges-${title.toLowerCase()}`}>
            <h3 className="font-ui text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {title} ({list.length})
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {list.map((userBadge: any) => {
                const isUnlocked = !!userBadge.unlockedAt;
                const isSelected = userBadge.isSelected;
                const IconComponent = (LucideIcons as any)[userBadge.icon] || Trophy;
                const cur = Math.min(userBadge.progress?.current ?? 0, userBadge.progress?.required ?? 1);
                const req = userBadge.progress?.required ?? 1;
                return (
                  <div
                    key={userBadge.badgeId}
                    className={`relative p-3 border rounded-lg bg-card ${isUnlocked ? "" : "opacity-75"} ${isSelected ? "ring-2 ring-primary" : ""}`}
                    data-testid={`badge-${userBadge.badgeId}`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isUnlocked ? "bg-primary/10" : "bg-muted"}`}
                      >
                        {isUnlocked ? (
                          <IconComponent className="w-5 h-5 text-primary" />
                        ) : (
                          <Lock className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-sm">{userBadge.name}</h4>
                          {isSelected && (
                            <Badge variant="default" className="text-xs">
                              <Check className="w-3 h-3 mr-1" />
                              Shown
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{userBadge.description}</p>
                        {isUnlocked ? (
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <p className="text-xs text-muted-foreground">
                              Earned{" "}
                              {new Date(userBadge.unlockedAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </p>
                            {isOwnProfile && (
                              <Button
                                size="sm"
                                variant={isSelected ? "outline" : "secondary"}
                                className="h-7 text-xs"
                                onClick={() => selectBadgeMutation.mutate(isSelected ? null : userBadge.badgeId)}
                                disabled={selectBadgeMutation.isPending}
                                data-testid={`button-select-badge-${userBadge.badgeId}`}
                              >
                                {isSelected ? "Hide" : "Show on avatar"}
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="mt-2 space-y-1">
                            <Progress value={(cur / req) * 100} className="h-1.5" />
                            <p className="text-xs text-muted-foreground">
                              {cur} / {req}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}
      {earnedBadges.length === 0 && lockedBadges.length === 0 && (
        <Card className="p-8 text-center">
          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground">No badges yet</p>
        </Card>
      )}
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-4 sm:py-6 space-y-4 max-w-5xl">
      <Card className="overflow-hidden">
        <CardContent className="p-4 sm:px-5 sm:py-4">
          <p className="font-ui text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Home / Profile
          </p>
          <h1 className="ff-wordmark font-display uppercase leading-none tracking-[0.02em] text-[1.85rem] sm:text-[2.15rem] mt-1" data-testid="text-profile-title">
            Profile
          </h1>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="relative h-32 sm:h-40 lg:h-44">
          <EditorialCover />
        </div>

        <div className="relative px-4 sm:px-6 pb-5">
          <div className="flex flex-col items-center text-center -mt-12 sm:-mt-14">
            <div className="relative flex-shrink-0 rounded-full ring-4 ring-card">
              <AvatarWithBadge
                userId={userId!}
                profileImageUrl={user.profileImageUrl}
                firstName={user.firstName}
                lastName={user.lastName}
                className="h-24 w-24 sm:h-28 sm:w-28 text-2xl"
                showBadge={true}
                economicScore={profile?.economicScore}
                authoritarianScore={profile?.authoritarianScore}
                showPoliticalLeaning={true}
              />
            </div>
            <h2 className="mt-3 text-xl sm:text-2xl font-semibold break-words" data-testid="profile-name">
              {name}
            </h2>
            <UserHandle handle={(user as any).handle} className="text-sm" testId="profile-handle" />
            {leaningLabel && (
              <p className="mt-1 text-sm text-muted-foreground" data-testid="political-leaning-label">
                {leaningLabel}
                {profile?.leaningConfidence && (
                  <span className="text-xs" data-testid="confidence-metric">
                    {" "}
                    · {profile.leaningConfidence} confidence
                  </span>
                )}
              </p>
            )}
            {(user.bio || profile?.bio) && (
              <p className="mt-2 text-sm text-muted-foreground max-w-md break-words" data-testid="profile-bio">
                {user.bio || profile?.bio}
              </p>
            )}
          </div>

          <div className="mt-5 flex justify-center gap-1 sm:gap-4 lg:absolute lg:left-6 lg:top-8 lg:mt-0 lg:justify-start">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <button
                  type="button"
                  key={stat.key}
                  className="text-center hover-elevate active-elevate-2 rounded-md px-3 py-2 transition-colors min-w-[5.5rem]"
                  onClick={() => {
                    setActiveTab(stat.key);
                    setPeopleSearch("");
                  }}
                  data-testid={stat.testId}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <Icon className="w-4 h-4 text-primary" />
                    <div className="text-base sm:text-lg font-semibold tabular-nums leading-none">{stat.value}</div>
                    <div className="font-ui text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {stat.label}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 lg:absolute lg:right-6 lg:top-10 lg:mt-0 lg:justify-end">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowLeaderboardsModal(true)}
              data-testid="button-leaderboards"
              aria-label="Rankings"
              title={topRank ? `Rank #${topRank.me!.rank}` : "Rankings"}
            >
              <BarChart3 className="w-4 h-4" />
            </Button>
            {isOwnProfile && (
              <Link href="/settings">
                <Button type="button" data-testid="button-edit-profile">
                  <Settings className="w-4 h-4 mr-2" />
                  Edit profile
                </Button>
              </Link>
            )}
            {!isOwnProfile && currentUser && (
              <Button
                type="button"
                onClick={() =>
                  followMutation.mutate({
                    id: userId!,
                    action: followStatus?.isFollowing ? "unfollow" : "follow",
                  })
                }
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

        <div className="border-t border-border bg-sidebar/80">
          <div
            className="flex items-stretch overflow-x-auto hide-scrollbar"
            role="tablist"
            aria-label="Profile sections"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  type="button"
                  key={tab.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id === "followers" || tab.id === "following") setPeopleSearch("");
                  }}
                  className={`relative flex-1 min-w-[4.4rem] px-2 pt-3 pb-2.5 flex flex-col items-center gap-1 text-muted-foreground hover-elevate ${
                    active ? "text-foreground" : ""
                  }`}
                  data-testid={tab.testId}
                >
                  <Icon className={`w-4 h-4 ${active ? "text-primary" : ""}`} />
                  <span className="font-ui text-[0.6rem] font-semibold uppercase tracking-[0.08em] leading-none">
                    {tab.label}
                  </span>
                  {active && <span className="absolute left-2 right-2 bottom-0 h-0.5 bg-primary rounded-full" />}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="space-y-4 pt-1">
        {activeTab !== "profile" && (
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold font-serif">{sectionMeta[activeTab].title}</h2>
            {typeof sectionMeta[activeTab].count === "number" && (
              <span
                className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full bg-primary text-primary-foreground font-ui text-[0.65rem] font-semibold tabular-nums"
                data-testid="text-section-count"
              >
                {sectionMeta[activeTab].count}
              </span>
            )}
          </div>
        )}

        {activeTab === "profile" && (
          <div className="space-y-6" data-testid="section-profile-about">
            <div className="grid gap-3 sm:grid-cols-2">
              {user.createdAt && (
                <Card>
                  <CardContent className="p-4">
                    <p className="font-ui text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Joined
                    </p>
                    <p className="mt-1 text-sm">{formatJoinDate(user.createdAt)}</p>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardContent className="p-4">
                  <p className="font-ui text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Rankings
                  </p>
                  <button
                    type="button"
                    className="mt-1 text-sm hover:underline"
                    onClick={() => setShowLeaderboardsModal(true)}
                    data-testid="button-rankings-about"
                  >
                    {topRank ? `#${topRank.me!.rank} · ${topRank.title.replace(/^(Most|Top) /, "")}` : "View rankings"}
                  </button>
                </CardContent>
              </Card>
              {totalDebates != null && (
                <Card>
                  <CardContent className="p-4">
                    <p className="font-ui text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-1.5">
                      <Swords className="w-3.5 h-3.5" />
                      Debates
                    </p>
                    <p className="mt-1 text-sm tabular-nums" data-testid="text-total-debates">
                      {totalDebates}
                    </p>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardContent className="p-4">
                  <p className="font-ui text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Badges
                  </p>
                  <button
                    type="button"
                    className="mt-1 text-sm hover:underline"
                    onClick={() => setActiveTab("badges")}
                    data-testid="button-badges"
                  >
                    {earnedBadges.length}/{userBadges.length || earnedBadges.length} earned
                  </button>
                </CardContent>
              </Card>
            </div>

            {hasLeaning && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-ui text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Political compass
                  </h3>
                  <PoliticalCompassChart
                    economicScore={profile!.economicScore}
                    authoritarianScore={profile!.authoritarianScore}
                    size="sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Based on analysis of {profile!.totalOpinions} opinions
                    {profile?.leaningConfidence ? ` · ${profile.leaningConfidence} confidence` : ""}
                  </p>
                </CardContent>
              </Card>
            )}

            {isOwnProfile && (
              <div className="space-y-4" data-testid="section-recommended">
                <h3 className="text-lg font-semibold flex items-center gap-2 font-serif">
                  <Lightbulb className="w-5 h-5" />
                  Recommended for You
                </h3>
                {recommendedTopics.length > 0 ? (
                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4">
                    {recommendedTopics.map((topic) => renderTopicCard(topic))}
                  </div>
                ) : (
                  <Card className="p-8 text-center">
                    <Star className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-muted-foreground">Share opinions to get personalized recommendations</p>
                    <Link href="/">
                      <Button variant="default" className="mt-4" data-testid="button-browse-topics-recommended">
                        Browse Topics
                      </Button>
                    </Link>
                  </Card>
                )}
              </div>
            )}

            {isOwnProfile && (
              <div className="space-y-4" data-testid="section-following-feed">
                <h3 className="text-lg font-semibold flex items-center gap-2 font-serif">
                  <Users className="w-5 h-5" />
                  From People You Follow
                </h3>
                {followingTopics.length > 0 ? (
                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4">
                    {followingTopics.map((item: any) =>
                      item.type === "topic" || item.title ? (
                        renderTopicCard(item)
                      ) : (
                        <Card key={`${item.type}-${item.id}`} className="p-4 text-sm text-muted-foreground">
                          {item.content || "Update from someone you follow"}
                        </Card>
                      )
                    )}
                  </div>
                ) : (
                  <Card className="p-8 text-center">
                    <UserPlus className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-muted-foreground">Follow users to see their topics and opinions here</p>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "opinions" && (
          <div className="space-y-3" data-testid="section-my-opinions">
            {opinionsLoading ? (
              <div className="h-48 bg-muted animate-pulse rounded-lg" />
            ) : opinions.length > 0 ? (
              <>
                <CardDeck<any>
                  items={opinions}
                  getKey={(op) => op.id}
                  initialIndex={Math.min(opinionIndex, opinions.length - 1)}
                  onIndexChange={setOpinionIndex}
                  maxWidth={420}
                  testId="deck-profile-opinions"
                  ariaLabel={`${user.firstName}'s opinions`}
                  emptyLabel="No opinions yet."
                  renderFront={(op) => (
                    <OpinionDeckFront op={op} onSelectParagraph={() => navigate(`/topic/${op.topicId}`)} />
                  )}
                  renderBack={(op) => (
                    <OpinionDeckBack
                      op={op}
                      onVote={(voteType) => {
                        if (!currentUser) return;
                        voteMutation.mutate({
                          opinionId: op.id,
                          voteType,
                          currentVote: op.userVote?.voteType ?? null,
                        });
                      }}
                      onAdopt={() => navigate(`/topic/${op.topicId}`)}
                      onFlag={() => navigate(`/topic/${op.topicId}`)}
                      onSeeCounterpoints={(idx) => navigate(`/opinion/${op.id}/counterpoints?p=${idx}`)}
                    />
                  )}
                />
                {opinions[opinionIndex] && (
                  <div className="flex justify-center">
                    <Link href={`/topic/${opinions[opinionIndex].topicId}`}>
                      <Button variant="outline" size="sm" data-testid="button-open-opinion-topic">
                        Open debate
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                )}
              </>
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
        )}

        {activeTab === "topics" && (
          <div className="space-y-4" data-testid="section-my-topics">
            {topicsLoading ? (
              <div className="h-48 bg-muted animate-pulse rounded-lg" />
            ) : userTopics.length > 0 ? (
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4">
                {userTopics.map((topic) => renderTopicCard(topic))}
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
        )}

        {(activeTab === "followers" || activeTab === "following") && renderPeopleGrid()}
        {activeTab === "badges" && renderBadges()}
      </div>

      <LeaderboardsDialog
        open={showLeaderboardsModal}
        onOpenChange={setShowLeaderboardsModal}
        userId={userId!}
        displayName={(user as any).handle ? `@${(user as any).handle}` : user.firstName}
        isOwnProfile={isOwnProfile}
      />
    </div>
  );
}
