import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, MessageCircle, Users, TrendingUp, Plus, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import OpinionCard from "@/components/OpinionCard";
import CumulativeOpinion from "@/components/CumulativeOpinion";
import { insertOpinionSchema, type Topic as TopicType, type Opinion, type CumulativeOpinion as CumulativeOpinionType } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const opinionFormSchema = insertOpinionSchema.omit({
  topicId: true,
  userId: true,
}).extend({
  content: z.string().min(1, "Opinion is required").max(2000, "Opinion too long"),
  stance: z.enum(["for", "against", "neutral"], { required_error: "Please select a stance" }),
});

export default function Topic() {
  const { id } = useParams();
  const [showCreateOpinion, setShowCreateOpinion] = useState(false);
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

  // Create opinion mutation
  const createOpinionMutation = useMutation({
    mutationFn: async (data: z.infer<typeof opinionFormSchema>) => {
      return apiRequest('POST', `/api/topics/${id}/opinions`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id, "opinions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id, "cumulative"] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id] });
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

  const forOpinions = opinions?.filter(o => o.stance === 'for') || [];
  const againstOpinions = opinions?.filter(o => o.stance === 'against') || [];
  const neutralOpinions = opinions?.filter(o => o.stance === 'neutral') || [];

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/">
        <Button variant="ghost" size="sm" data-testid="button-back-home">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Topics
        </Button>
      </Link>

      {/* Topic Header */}
      <Card>
        <div className="aspect-[21/9] relative overflow-hidden">
          <img 
            src={topic.imageUrl || '/placeholder-topic.jpg'} 
            alt={topic.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">{topic.category}</Badge>
                  {topic.isActive && (
                    <Badge className="bg-chart-1 text-white">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                  )}
                </div>
                <h1 className="text-3xl font-bold mb-2" data-testid="text-topic-title">
                  {topic.title}
                </h1>
                <p className="text-muted-foreground text-lg">
                  {topic.description}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
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
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Discussion</h2>
        <Dialog open={showCreateOpinion} onOpenChange={setShowCreateOpinion}>
          <DialogTrigger asChild>
            <Button data-testid="button-share-opinion">
              <Plus className="w-4 h-4 mr-2" />
              Share Your Opinion
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share Your Opinion</DialogTitle>
              <DialogDescription>
                What's your stance on "{topic.title}"?
              </DialogDescription>
            </DialogHeader>
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
                <div className="flex gap-2 justify-end">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowCreateOpinion(false)}
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
          </DialogContent>
        </Dialog>
      </div>

      {/* Cumulative Opinion */}
      {cumulativeData ? (
        <CumulativeOpinion
          topicId={id || ''}
          summary={cumulativeData.summary}
          keyPoints={cumulativeData.keyPoints || []}
          supportingPercentage={cumulativeData.supportingPercentage || 0}
          opposingPercentage={cumulativeData.opposingPercentage || 0}
          neutralPercentage={cumulativeData.neutralPercentage || 0}
          totalOpinions={cumulativeData.totalOpinions || 0}
          confidence={(cumulativeData.confidence as "high" | "medium" | "low") || "low"}
          lastUpdated={cumulativeData.updatedAt ? new Date(cumulativeData.updatedAt).toLocaleDateString() : 'Unknown'}
        />
      ) : (
        <Card>
          <CardContent className="pt-6 text-center">
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
          </CardContent>
        </Card>
      )}

      {/* Opinions */}
      <div className="space-y-6">
        {forOpinions.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Badge variant="default" className="bg-chart-2">For</Badge>
              <span className="text-sm text-muted-foreground">{forOpinions.length} opinions</span>
            </h3>
            <div className="space-y-3">
              {forOpinions.map((opinion) => (
                <OpinionCard 
                  key={opinion.id}
                  id={opinion.id}
                  userId={opinion.userId}
                  userName="User"
                  content={opinion.content}
                  stance={opinion.stance as "for" | "against" | "neutral"}
                  timestamp={opinion.createdAt ? new Date(opinion.createdAt).toLocaleDateString() : 'Unknown'}
                  likesCount={opinion.likesCount || 0}
                  dislikesCount={opinion.dislikesCount || 0}
                  repliesCount={opinion.repliesCount || 0}
                />
              ))}
            </div>
          </div>
        )}

        {againstOpinions.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Badge variant="destructive">Against</Badge>
              <span className="text-sm text-muted-foreground">{againstOpinions.length} opinions</span>
            </h3>
            <div className="space-y-3">
              {againstOpinions.map((opinion) => (
                <OpinionCard 
                  key={opinion.id}
                  id={opinion.id}
                  userId={opinion.userId}
                  userName="User"
                  content={opinion.content}
                  stance={opinion.stance as "for" | "against" | "neutral"}
                  timestamp={opinion.createdAt ? new Date(opinion.createdAt).toLocaleDateString() : 'Unknown'}
                  likesCount={opinion.likesCount || 0}
                  dislikesCount={opinion.dislikesCount || 0}
                  repliesCount={opinion.repliesCount || 0}
                />
              ))}
            </div>
          </div>
        )}

        {neutralOpinions.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Badge variant="secondary">Neutral</Badge>
              <span className="text-sm text-muted-foreground">{neutralOpinions.length} opinions</span>
            </h3>
            <div className="space-y-3">
              {neutralOpinions.map((opinion) => (
                <OpinionCard 
                  key={opinion.id}
                  id={opinion.id}
                  userId={opinion.userId}
                  userName="User"
                  content={opinion.content}
                  stance={opinion.stance as "for" | "against" | "neutral"}
                  timestamp={opinion.createdAt ? new Date(opinion.createdAt).toLocaleDateString() : 'Unknown'}
                  likesCount={opinion.likesCount || 0}
                  dislikesCount={opinion.dislikesCount || 0}
                  repliesCount={opinion.repliesCount || 0}
                />
              ))}
            </div>
          </div>
        )}

        {(!opinions || opinions.length === 0) && (
          <Card>
            <CardContent className="pt-6 text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                No opinions shared yet. Be the first to share your thoughts!
              </p>
              <Button onClick={() => setShowCreateOpinion(true)} data-testid="button-first-opinion">
                <Plus className="w-4 h-4 mr-2" />
                Share First Opinion
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
