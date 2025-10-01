import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, MessageCircle, Users, TrendingUp, RefreshCw, Video, Calendar, Clock, Eye } from "lucide-react";
import { Link } from "wouter";
import { insertOpinionSchema, type Topic as TopicType, type Opinion, type CumulativeOpinion as CumulativeOpinionType } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

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
  const { toast } = useToast();

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

  // Fetch live streams for this topic
  const { data: liveStreams } = useQuery<any[]>({
    queryKey: ["/api/live-streams", { topicId: id }],
    enabled: !!id,
  });

  // Get user's opinion on this topic to determine stance
  const userOpinion = opinions?.find(o => o.userId === user?.id);

  // Create opinion mutation
  const createOpinionMutation = useMutation({
    mutationFn: async (data: z.infer<typeof opinionFormSchema>) => {
      return apiRequest('POST', `/api/topics/${id}/opinions`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id, "opinions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id, "cumulative"] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id] });
      opinionForm.reset();
      setShowOpinionForm(false);
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

  // Generate cumulative opinion mutation
  const generateCumulativeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/topics/${id}/cumulative`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id, "cumulative"] });
      toast({ title: "AI summary generated successfully!" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to generate summary", 
        description: error.message,
        variant: "destructive" 
      });
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
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/">
        <Button variant="ghost" size="sm" data-testid="button-back-home">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Topics
        </Button>
      </Link>

      {/* Topic Title Above Image */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="secondary">{topic.category}</Badge>
          {topic.isActive && (
            <Badge className="bg-chart-1 text-white">
              <TrendingUp className="w-3 h-3 mr-1" />
              Active
            </Badge>
          )}
        </div>
        <h1 className="text-4xl font-bold mb-2" data-testid="text-topic-title">
          {topic.title}
        </h1>
        <p className="text-muted-foreground text-lg mb-2">
          {topic.description}
        </p>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <MessageCircle className="w-4 h-4" />
            <span data-testid="text-opinions-count">{opinions?.length || 0} opinions</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span data-testid="text-participants-count">
              {opinions ? new Set(opinions.map(o => o.userId)).size : 0} participants
            </span>
          </div>
        </div>
      </div>

      {/* Header Image */}
      <div className="aspect-[21/9] relative overflow-hidden rounded-lg">
        <img 
          src={topic.imageUrl || '/placeholder-topic.jpg'} 
          alt={topic.title}
          className="w-full h-full object-cover"
        />
      </div>

      {/* AI Summary Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>AI-Generated Summary</CardTitle>
            {cumulativeData && (
              <Button 
                variant="outline"
                size="sm"
                onClick={() => generateCumulativeMutation.mutate()}
                disabled={generateCumulativeMutation.isPending}
                data-testid="button-refresh-summary"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {generateCumulativeMutation.isPending ? "Updating..." : "Refresh"}
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

      {/* Add Your Opinion Section */}
      <Card>
        <CardHeader>
          <CardTitle>Share Your Opinion</CardTitle>
        </CardHeader>
        <CardContent>
          {userOpinion ? (
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
                onClick={() => setShowOpinionForm(!showOpinionForm)}
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
    </div>
  );
}
