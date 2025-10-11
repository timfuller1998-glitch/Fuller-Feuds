import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { 
  Shield, 
  Flag, 
  Eye, 
  EyeOff, 
  UserX, 
  UserCheck, 
  Archive, 
  ArchiveRestore, 
  CheckCircle, 
  XCircle,
  Ban,
  Unlock,
  LayoutDashboard,
  Users,
  Filter,
  FileText
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { DashboardOverview } from "@/components/admin/DashboardOverview";
import { UserManagement } from "@/components/admin/UserManagement";
import { ContentFilters } from "@/components/admin/ContentFilters";
import { AuditLog } from "@/components/admin/AuditLog";

export default function AdminDashboard() {
  const [selectedOpinion, setSelectedOpinion] = useState<string | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<string | null>(null);
  const [opinionModerationReason, setOpinionModerationReason] = useState("");
  const [challengeModerationReason, setChallengeModerationReason] = useState("");

  // Fetch flagged opinions
  const { data: flaggedOpinions, isLoading: loadingFlagged } = useQuery({
    queryKey: ['/api/admin/flagged-opinions'],
  });

  // Fetch pending challenges
  const { data: pendingChallenges, isLoading: loadingChallenges } = useQuery({
    queryKey: ['/api/admin/pending-challenges'],
  });

  // Opinion moderation mutations
  const approveOpinionMutation = useMutation({
    mutationFn: async (opinionId: string) => {
      return await apiRequest('POST', `/api/admin/opinions/${opinionId}/approve`, {
        reason: opinionModerationReason || undefined
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/flagged-opinions'] });
      setSelectedOpinion(null);
      setOpinionModerationReason("");
    },
  });

  const hideOpinionMutation = useMutation({
    mutationFn: async (opinionId: string) => {
      return await apiRequest('POST', `/api/admin/opinions/${opinionId}/hide`, {
        reason: opinionModerationReason || undefined
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/flagged-opinions'] });
      setSelectedOpinion(null);
      setOpinionModerationReason("");
    },
  });

  // Challenge moderation mutations
  const approveChallengeMutation = useMutation({
    mutationFn: async (challengeId: string) => {
      return await apiRequest('POST', `/api/admin/challenges/${challengeId}/approve`, {
        reason: challengeModerationReason || undefined
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/pending-challenges'] });
      setSelectedChallenge(null);
      setChallengeModerationReason("");
    },
  });

  const rejectChallengeMutation = useMutation({
    mutationFn: async (challengeId: string) => {
      return await apiRequest('POST', `/api/admin/challenges/${challengeId}/reject`, {
        reason: challengeModerationReason || undefined
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/pending-challenges'] });
      setSelectedChallenge(null);
      setChallengeModerationReason("");
    },
  });

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-admin-dashboard">Admin Dashboard</h1>
          <p className="text-muted-foreground">Moderate content and manage platform</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid lg:grid-cols-6" data-testid="tabs-admin-sections">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="h-4 w-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="flagged" data-testid="tab-flagged-opinions">
            <Flag className="h-4 w-4 mr-2" />
            Flagged
            {flaggedOpinions?.length > 0 && (
              <Badge variant="destructive" className="ml-2">{flaggedOpinions.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="challenges" data-testid="tab-pending-challenges">
            <CheckCircle className="h-4 w-4 mr-2" />
            Challenges
            {pendingChallenges?.length > 0 && (
              <Badge variant="default" className="ml-2">{pendingChallenges.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="filters" data-testid="tab-filters">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <FileText className="h-4 w-4 mr-2" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <DashboardOverview />
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <UserManagement />
        </TabsContent>

        {/* Flagged Opinions Tab */}
        <TabsContent value="flagged" className="space-y-4">
          {loadingFlagged ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading flagged opinions...
              </CardContent>
            </Card>
          ) : flaggedOpinions?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No flagged opinions to review
              </CardContent>
            </Card>
          ) : (
            flaggedOpinions?.map((item: any) => (
              <Card key={item.opinion.id} className="hover-elevate" data-testid={`card-flagged-opinion-${item.opinion.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={item.author.profileImageUrl} />
                        <AvatarFallback>{item.author.username?.[0] || item.author.email[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold truncate">{item.author.username || item.author.email}</p>
                          <Badge variant={item.opinion.stance === 'for' ? 'default' : 'secondary'}>
                            {item.opinion.stance}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Topic: {item.topic.title}
                        </p>
                      </div>
                    </div>
                    <Badge variant="destructive">
                      <Flag className="h-3 w-3 mr-1" />
                      Flagged
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm mb-2">{item.opinion.content}</p>
                  </div>

                  <Separator />

                  <div className="bg-muted/50 p-3 rounded-md">
                    <p className="text-sm font-medium mb-1">Flag Reason:</p>
                    <p className="text-sm text-muted-foreground">{item.flags.reason}</p>
                  </div>

                  {selectedOpinion === item.opinion.id ? (
                    <div className="space-y-3 pt-2">
                      <Textarea
                        placeholder="Moderation reason (optional)"
                        value={opinionModerationReason}
                        onChange={(e) => setOpinionModerationReason(e.target.value)}
                        data-testid={`textarea-moderation-reason-${item.opinion.id}`}
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => approveOpinionMutation.mutate(item.opinion.id)}
                          disabled={approveOpinionMutation.isPending}
                          variant="default"
                          data-testid={`button-approve-opinion-${item.opinion.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => hideOpinionMutation.mutate(item.opinion.id)}
                          disabled={hideOpinionMutation.isPending}
                          variant="destructive"
                          data-testid={`button-hide-opinion-${item.opinion.id}`}
                        >
                          <EyeOff className="h-4 w-4 mr-2" />
                          Hide
                        </Button>
                        <Button
                          onClick={() => {
                            setSelectedOpinion(null);
                            setOpinionModerationReason("");
                          }}
                          variant="ghost"
                          data-testid={`button-cancel-${item.opinion.id}`}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={() => setSelectedOpinion(item.opinion.id)}
                      variant="outline"
                      className="w-full"
                      data-testid={`button-moderate-opinion-${item.opinion.id}`}
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Moderate
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Pending Challenges Tab */}
        <TabsContent value="challenges" className="space-y-4">
          {loadingChallenges ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading pending challenges...
              </CardContent>
            </Card>
          ) : pendingChallenges?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No pending challenges to review
              </CardContent>
            </Card>
          ) : (
            pendingChallenges?.map((item: any) => (
              <Card key={item.challenge.id} className="hover-elevate" data-testid={`card-pending-challenge-${item.challenge.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={item.author.profileImageUrl} />
                        <AvatarFallback>{item.author.username?.[0] || item.author.email[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{item.author.username || item.author.email}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(item.challenge.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">Pending</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Challenge Context:</p>
                    <p className="text-sm bg-muted/50 p-3 rounded-md">{item.challenge.context}</p>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm font-medium mb-2">Original Opinion:</p>
                    <div className="bg-muted/30 p-3 rounded-md">
                      <p className="text-sm text-muted-foreground">{item.opinion.content}</p>
                    </div>
                  </div>

                  {selectedChallenge === item.challenge.id ? (
                    <div className="space-y-3 pt-2">
                      <Textarea
                        placeholder="Moderation reason (optional)"
                        value={challengeModerationReason}
                        onChange={(e) => setChallengeModerationReason(e.target.value)}
                        data-testid={`textarea-challenge-reason-${item.challenge.id}`}
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => approveChallengeMutation.mutate(item.challenge.id)}
                          disabled={approveChallengeMutation.isPending}
                          variant="default"
                          data-testid={`button-approve-challenge-${item.challenge.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => rejectChallengeMutation.mutate(item.challenge.id)}
                          disabled={rejectChallengeMutation.isPending}
                          variant="destructive"
                          data-testid={`button-reject-challenge-${item.challenge.id}`}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                        <Button
                          onClick={() => {
                            setSelectedChallenge(null);
                            setChallengeModerationReason("");
                          }}
                          variant="ghost"
                          data-testid={`button-cancel-challenge-${item.challenge.id}`}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={() => setSelectedChallenge(item.challenge.id)}
                      variant="outline"
                      className="w-full"
                      data-testid={`button-moderate-challenge-${item.challenge.id}`}
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Moderate
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Content Filters Tab */}
        <TabsContent value="filters">
          <ContentFilters />
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit">
          <AuditLog />
        </TabsContent>
      </Tabs>
    </div>
  );
}
