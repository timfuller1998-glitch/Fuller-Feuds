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
  FileText,
  MessageSquare,
  Trash2,
  BookOpen,
  Sparkles
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { DashboardOverview } from "@/components/admin/DashboardOverview";
import { UserManagement } from "@/components/admin/UserManagement";
import { ContentFilters } from "@/components/admin/ContentFilters";
import { AuditLog } from "@/components/admin/AuditLog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function AdminDashboard() {
  const { toast } = useToast();
  const [selectedOpinion, setSelectedOpinion] = useState<string | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<string | null>(null);
  const [opinionModerationReason, setOpinionModerationReason] = useState("");
  const [challengeModerationReason, setChallengeModerationReason] = useState("");
  const [deleteTopicId, setDeleteTopicId] = useState<string | null>(null);
  const [deleteOpinionId, setDeleteOpinionId] = useState<string | null>(null);

  // Fetch all topics
  const { data: allTopics, isLoading: loadingTopics } = useQuery({
    queryKey: ['/api/admin/topics'],
  });

  // Fetch all opinions
  const { data: allOpinions, isLoading: loadingOpinions } = useQuery({
    queryKey: ['/api/admin/opinions'],
  });

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

  // Delete topic mutation
  const deleteTopicMutation = useMutation({
    mutationFn: async (topicId: string) => {
      return await apiRequest('DELETE', `/api/admin/topics/${topicId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/topics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/audit-log'] });
      setDeleteTopicId(null);
    },
  });

  // Delete opinion mutation
  const deleteOpinionMutation = useMutation({
    mutationFn: async (opinionId: string) => {
      return await apiRequest('DELETE', `/api/admin/opinions/${opinionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/opinions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/audit-log'] });
      setDeleteOpinionId(null);
    },
  });

  // Backfill embeddings mutation
  const backfillEmbeddingsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/admin/backfill-embeddings', {});
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/topics'] });
      toast({
        title: "Embeddings Generated!",
        description: `Successfully generated embeddings for ${data.updated} topics. ${data.failed} failed.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate embeddings",
        variant: "destructive",
      });
    },
  });

  // Backfill opinion political scores mutation
  const backfillOpinionScoresMutation = useMutation({
    mutationFn: async (model: 'gpt-4o-mini' | 'gpt-5') => {
      const response = await apiRequest('POST', '/api/admin/backfill-opinion-scores', { model });
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/opinions'] });
      toast({
        title: "Political Score Analysis Started!",
        description: `Processing ${data.totalOpinions} opinions using ${data.model}. This may take a few minutes.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start opinion political score backfill",
        variant: "destructive",
      });
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
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid lg:grid-cols-8" data-testid="tabs-admin-sections">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="h-4 w-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="topics" data-testid="tab-topics">
            <BookOpen className="h-4 w-4 mr-2" />
            Topics
          </TabsTrigger>
          <TabsTrigger value="opinions" data-testid="tab-opinions">
            <MessageSquare className="h-4 w-4 mr-2" />
            Opinions
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

        {/* Topics Tab */}
        <TabsContent value="topics" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    All Topics
                  </CardTitle>
                  <CardDescription>View and moderate all platform topics</CardDescription>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => backfillEmbeddingsMutation.mutate()}
                    disabled={backfillEmbeddingsMutation.isPending}
                    data-testid="button-generate-embeddings"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {backfillEmbeddingsMutation.isPending ? "Generating..." : "Generate Embeddings"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => backfillOpinionScoresMutation.mutate('gpt-4o-mini')}
                    disabled={backfillOpinionScoresMutation.isPending}
                    data-testid="button-backfill-scores-gpt4"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {backfillOpinionScoresMutation.isPending ? "Analyzing..." : "Analyze Opinions (GPT-4)"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => backfillOpinionScoresMutation.mutate('gpt-5')}
                    disabled={backfillOpinionScoresMutation.isPending}
                    data-testid="button-backfill-scores-gpt5"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {backfillOpinionScoresMutation.isPending ? "Analyzing..." : "Analyze Opinions (GPT-5)"}
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
          {loadingTopics ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading topics...
              </CardContent>
            </Card>
          ) : allTopics?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No topics found
              </CardContent>
            </Card>
          ) : (
            allTopics?.filter((topic: any) => topic.isActive).map((topic: any) => (
              <Card key={topic.id} className="hover-elevate" data-testid={`card-topic-${topic.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate" data-testid={`text-topic-title-${topic.id}`}>
                        {topic.title}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant="secondary" data-testid={`badge-topic-status-${topic.id}`}>
                          {topic.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {topic.opinionsCount || 0} opinions
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Created {formatDistanceToNow(new Date(topic.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteTopicId(topic.id)}
                      data-testid={`button-delete-topic-${topic.id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Opinions Tab */}
        <TabsContent value="opinions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                All Opinions
              </CardTitle>
              <CardDescription>View and moderate all platform opinions</CardDescription>
            </CardHeader>
          </Card>
          {loadingOpinions ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading opinions...
              </CardContent>
            </Card>
          ) : allOpinions?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No opinions found
              </CardContent>
            </Card>
          ) : (
            allOpinions?.map((opinion: any) => (
              <Card key={opinion.id} className="hover-elevate" data-testid={`card-opinion-${opinion.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={opinion.stance === 'for' ? 'default' : 'secondary'}>
                          {opinion.stance}
                        </Badge>
                        <Badge variant="outline" data-testid={`badge-opinion-status-${opinion.id}`}>
                          {opinion.status}
                        </Badge>
                      </div>
                      <p className="text-sm mb-2" data-testid={`text-opinion-content-${opinion.id}`}>
                        {opinion.content}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{opinion.likesCount || 0} likes</span>
                        <span>•</span>
                        <span>{opinion.dislikesCount || 0} dislikes</span>
                        <span>•</span>
                        <span>
                          {formatDistanceToNow(new Date(opinion.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteOpinionId(opinion.id)}
                      data-testid={`button-delete-opinion-${opinion.id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
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

      {/* Delete Topic Confirmation Dialog */}
      <AlertDialog open={!!deleteTopicId} onOpenChange={() => setDeleteTopicId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Topic</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this topic? This action cannot be undone and will also remove all associated opinions and debates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-topic">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTopicId) {
                  deleteTopicMutation.mutate(deleteTopicId);
                }
              }}
              disabled={deleteTopicMutation.isPending}
              data-testid="button-confirm-delete-topic"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTopicMutation.isPending ? "Deleting..." : "Delete Topic"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Opinion Confirmation Dialog */}
      <AlertDialog open={!!deleteOpinionId} onOpenChange={() => setDeleteOpinionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Opinion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this opinion? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-opinion">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteOpinionId) {
                  deleteOpinionMutation.mutate(deleteOpinionId);
                }
              }}
              disabled={deleteOpinionMutation.isPending}
              data-testid="button-confirm-delete-opinion"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteOpinionMutation.isPending ? "Deleting..." : "Delete Opinion"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
