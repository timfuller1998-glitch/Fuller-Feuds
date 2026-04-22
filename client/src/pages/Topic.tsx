import { useMemo, useState, useEffect, useRef } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ArrowLeft, Brain, Flag, MessageCircle, Plus, UserPlus, Users, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { insertOpinionSchema, type Topic as TopicType, type Opinion, type CumulativeOpinion as CumulativeOpinionType, type SummarySentence } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import OpinionCard from "@/components/OpinionCard";
import { AdoptOpinionDialog } from "@/components/AdoptOpinionDialog";
import { LoginPromptDialog } from "@/components/LoginPromptDialog";
import FallacyBadges from "@/components/FallacyBadges";
import FallacyFlagDialog from "@/components/FallacyFlagDialog";
import type { FallacyType } from "@shared/fallacies";
import { getOpinionGradientStyle } from "@/lib/politicalColors";
import { InteractiveSentenceText } from "@/components/InteractiveSentenceText";

const opinionFormSchema = insertOpinionSchema.omit({
  topicId: true,
  userId: true,
}).extend({
  content: z.string().min(1, "Opinion is required").max(2000, "Opinion too long"),
  debateStatus: z.enum(["open", "closed", "private"], { required_error: "Please select debate availability" }),
  references: z.array(z.string().url("Must be a valid URL")).optional().default([]),
});

export default function Topic() {
  const { id } = useParams();
  const search = useSearch();
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [showOpinionForm, setShowOpinionForm] = useState(false);
  const [showTopicFlagDialog, setShowTopicFlagDialog] = useState(false);
  const [showAdoptDialog, setShowAdoptDialog] = useState(false);
  const [opinionToAdopt, setOpinionToAdopt] = useState<any>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [loginAction, setLoginAction] = useState<"like" | "opinion" | "debate" | "interact">("interact");
  const [activeTab, setActiveTab] = useState<"ai" | "yours" | "others">("ai");
  const urlApplyRef = useRef<string | null>(null);
  const [otherOpinionFlagOpen, setOtherOpinionFlagOpen] = useState(false);
  const [otherOpinionFlagTargetId, setOtherOpinionFlagTargetId] = useState<string | null>(null);

  const [selectedSentenceIndex, setSelectedSentenceIndex] = useState<number | null>(null);
  const [selectedOtherSentenceIndex, setSelectedOtherSentenceIndex] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rankMode, setRankMode] = useState<"rank" | "active">("rank");
  const [selectedCounterpointId, setSelectedCounterpointId] = useState<string | null>(null);

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

  // Record topic view when user visits
  useEffect(() => {
    if (id && user?.id) {
      apiRequest('POST', `/api/topics/${id}/view`).catch(err => {
        console.error("Failed to record topic view:", err);
      });
    }
  }, [id, user?.id]);

  // Fetch opinions for the topic
  const { data: opinions, isSuccess: opinionsLoaded } = useQuery<Opinion[]>({
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

  // Get user's opinion on this topic to determine stance
  const userOpinion = opinions?.find(o => o.userId === user?.id);

  const otherOpinions = useMemo(() => (opinions || []).filter(o => o.userId !== user?.id), [opinions, user?.id]);
  const [otherOpinionIndex, setOtherOpinionIndex] = useState(0);
  const currentOtherOpinion = otherOpinions[otherOpinionIndex] || null;

  useEffect(() => {
    urlApplyRef.current = null;
    setOtherOpinionIndex(0);
    setSelectedSentenceIndex(null);
    setSelectedOtherSentenceIndex(null);
    setSelectedCounterpointId(null);
    setSheetOpen(false);
    setActiveTab("ai");
  }, [id]);

  useEffect(() => {
    if (!id || !opinionsLoaded) return;
    const params = new URLSearchParams(search);
    const tabParam = params.get("tab");
    const opinionParam = params.get("opinion");
    const hasTab = tabParam === "ai" || tabParam === "yours" || tabParam === "others";
    if (!opinionParam && !hasTab) return;

    const list = opinions ?? [];
    const key = `${id}|${search}`;
    if (urlApplyRef.current === key) return;

    if (opinionParam) {
      const op = list.find((o) => o.id === opinionParam);
      if (!op) {
        if (list.length > 0) {
          toast({
            title: "Opinion not found",
            description: "It may have been removed or is no longer visible.",
            variant: "destructive",
          });
          urlApplyRef.current = key;
        }
        return;
      }
      if (user?.id && op.userId === user.id) {
        setActiveTab("yours");
        setOtherOpinionIndex(0);
      } else {
        setActiveTab("others");
        const others = list.filter((o) => o.userId !== user?.id);
        const idx = others.findIndex((o) => o.id === opinionParam);
        if (idx >= 0) setOtherOpinionIndex(idx);
      }
    } else if (hasTab) {
      setActiveTab(tabParam);
    }

    setSelectedSentenceIndex(null);
    setSelectedOtherSentenceIndex(null);
    setSelectedCounterpointId(null);
    setSheetOpen(false);
    urlApplyRef.current = key;
  }, [id, search, opinions, opinionsLoaded, user?.id, toast]);

  const topOpinionsByLikes = useMemo(() => {
    const list = [...(opinions || [])].sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
    return list.slice(0, 10);
  }, [opinions]);

  const summarySentences: SummarySentence[] = useMemo(() => {
    const raw = (cumulativeData as any)?.summarySentences;
    if (Array.isArray(raw)) {
      return raw
        .map((item: unknown) => {
          if (item == null) return null;
          if (typeof item === "string") {
            const t = item.trim();
            return t ? { text: t, referencedOpinionIds: [] as string[] } : null;
          }
          if (typeof item === "object" && item !== null && "text" in item) {
            const text = String((item as { text?: unknown }).text ?? "").trim();
            const ids = (item as { referencedOpinionIds?: unknown }).referencedOpinionIds;
            const referencedOpinionIds = Array.isArray(ids)
              ? ids.filter((id): id is string => typeof id === "string")
              : [];
            return text ? { text, referencedOpinionIds } : null;
          }
          return null;
        })
        .filter(Boolean) as SummarySentence[];
    }
    const summary = (cumulativeData as any)?.summary as string | undefined;
    if (!summary || typeof summary !== "string") return [];
    // fallback: single sentence block with top opinions
    return summary
      .split(/(?<=[.!?])\s+/g)
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter(Boolean)
      .map((text) => ({
        text,
        referencedOpinionIds: topOpinionsByLikes.slice(0, 3).map((o) => o.id),
      }));
  }, [cumulativeData, topOpinionsByLikes]);

  const referencedOpinionsForSelectedSummarySentence = useMemo(() => {
    if (selectedSentenceIndex == null) return [];
    const ids = summarySentences[selectedSentenceIndex]?.referencedOpinionIds || [];
    const map = new Map((opinions || []).map(o => [o.id, o]));
    return ids.map(id => map.get(id)).filter(Boolean) as Opinion[];
  }, [opinions, selectedSentenceIndex, summarySentences]);

  const counterpointsQueryKey = useMemo(() => {
    if (!userOpinion?.id || selectedSentenceIndex == null) return null;
    return ["/api/opinions", userOpinion.id, "counterpoints", selectedSentenceIndex] as const;
  }, [selectedSentenceIndex, userOpinion?.id]);

  const { data: counterpoints } = useQuery<any[]>({
    queryKey: counterpointsQueryKey as any,
    queryFn: async () => {
      if (!userOpinion?.id || selectedSentenceIndex == null) return [];
      const response = await fetch(`/api/opinions/${userOpinion.id}/counterpoints?sentenceIndex=${selectedSentenceIndex}`);
      if (!response.ok) throw new Error("Failed to fetch counterpoints");
      return response.json();
    },
    enabled: !!userOpinion?.id && selectedSentenceIndex != null && sheetOpen && activeTab === "yours",
  });

  const otherCounterpointsQueryKey = useMemo(() => {
    if (!currentOtherOpinion?.id || selectedOtherSentenceIndex == null) return null;
    return ["/api/opinions", currentOtherOpinion.id, "counterpoints", selectedOtherSentenceIndex] as const;
  }, [currentOtherOpinion?.id, selectedOtherSentenceIndex]);

  const { data: otherCounterpoints } = useQuery<any[]>({
    queryKey: otherCounterpointsQueryKey as any,
    queryFn: async () => {
      if (!currentOtherOpinion?.id || selectedOtherSentenceIndex == null) return [];
      const response = await fetch(`/api/opinions/${currentOtherOpinion.id}/counterpoints?sentenceIndex=${selectedOtherSentenceIndex}`);
      if (!response.ok) throw new Error("Failed to fetch counterpoints");
      return response.json();
    },
    enabled: !!currentOtherOpinion?.id && selectedOtherSentenceIndex != null && sheetOpen && activeTab === "others",
  });

  const { data: likers } = useQuery<{ likerIds: string[] } | null>({
    queryKey: ["/api/counterpoints", selectedCounterpointId, "likers"],
    queryFn: async () => {
      if (!selectedCounterpointId) return null;
      const res = await fetch(`/api/counterpoints/${selectedCounterpointId}/likers`);
      if (!res.ok) throw new Error("Failed to fetch likers");
      return res.json();
    },
    enabled: !!selectedCounterpointId && sheetOpen && activeTab === "yours",
  });

  const likerIds = likers?.likerIds || [];

  const { data: presence } = useQuery<any[]>({
    queryKey: ["/api/presence/online-users", likerIds.join(",")],
    queryFn: async () => {
      if (likerIds.length === 0) return [];
      const res = await fetch(`/api/presence/online-users?userIds=${encodeURIComponent(likerIds.join(","))}`);
      if (!res.ok) throw new Error("Failed to fetch presence");
      return res.json();
    },
    enabled: likerIds.length > 0 && sheetOpen && activeTab === "yours",
  });

  const rankedPresence = useMemo(() => {
    const list = [...(presence || [])];
    if (rankMode === "rank") {
      list.sort((a, b) => (b.debaterRank || 0) - (a.debaterRank || 0));
    } else {
      list.sort((a, b) => {
        const onlineDiff = (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0);
        if (onlineDiff !== 0) return onlineDiff;
        return (b.lastActiveAt || 0) - (a.lastActiveAt || 0);
      });
    }
    return list;
  }, [presence, rankMode]);
  
  // Add SEO metadata
  useEffect(() => {
    if (topic) {
      // Set page title
      document.title = `${topic.title} - Fuller Feuds`;
      
      // Create or update meta description
      const description = `Join the debate on "${topic.title}". ${opinions?.length || 0} opinions shared. Explore different perspectives and share your thoughts on Fuller Feuds.`;
      let metaDescription = document.querySelector('meta[name="description"]');
      if (!metaDescription) {
        metaDescription = document.createElement('meta');
        metaDescription.setAttribute('name', 'description');
        document.head.appendChild(metaDescription);
      }
      metaDescription.setAttribute('content', description);
      
      // Open Graph tags for social sharing
      const ogTags = [
        { property: 'og:title', content: topic.title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'article' },
        { property: 'og:url', content: window.location.href },
      ];
      
      ogTags.forEach(({ property, content }) => {
        let tag = document.querySelector(`meta[property="${property}"]`);
        if (!tag) {
          tag = document.createElement('meta');
          tag.setAttribute('property', property);
          document.head.appendChild(tag);
        }
        tag.setAttribute('content', content);
      });
      
      // Twitter Card tags
      const twitterTags = [
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:title', content: topic.title },
        { name: 'twitter:description', content: description },
      ];
      
      twitterTags.forEach(({ name, content }) => {
        let tag = document.querySelector(`meta[name="${name}"]`);
        if (!tag) {
          tag = document.createElement('meta');
          tag.setAttribute('name', name);
          document.head.appendChild(tag);
        }
        tag.setAttribute('content', content);
      });
    }
    
    // Cleanup function to reset to default title when component unmounts
    return () => {
      document.title = 'Fuller Feuds';
    };
  }, [topic, opinions?.length]);

  // Create opinion mutation
  const createOpinionMutation = useMutation({
    mutationFn: async (data: z.infer<typeof opinionFormSchema>) => {
      if (userOpinion) {
        return apiRequest('PATCH', `/api/opinions/${userOpinion.id}`, data);
      }
      return apiRequest('POST', `/api/topics/${id}/opinions`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id, "opinions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] }); // Invalidate topics list for updated counts
      queryClient.invalidateQueries({ queryKey: ["/api/stats/platform"] });
      opinionForm.reset();
      setShowOpinionForm(false);
      
      // Poll for summary updates after opinion creation
      // Start polling after a short delay to give AI time to start processing
      let pollAttempts = 0;
      const maxAttempts = 15; // 15 attempts = 45 seconds max
      const pollInterval = 3000; // 3 seconds
      
      const pollForSummary = setInterval(() => {
        pollAttempts++;
        queryClient.invalidateQueries({ queryKey: ["/api/topics", id, "cumulative"] });
        
        if (pollAttempts >= maxAttempts) {
          clearInterval(pollForSummary);
        }
      }, pollInterval);
      
      // Clear interval when component unmounts or after max time
      setTimeout(() => clearInterval(pollForSummary), pollInterval * maxAttempts);
    },
    onError: (error: any) => {
      console.error("Failed to save opinion:", error);
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
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id, "opinions"] });
    },
    onError: (error: any) => {
      console.error("Failed to vote:", error);
    },
  });

  // Adopt opinion mutation
  const adoptMutation = useMutation({
    mutationFn: async ({ opinionId, content, stance }: { opinionId: string, content: string, stance: "for" | "against" | "neutral" }) => {
      return apiRequest('POST', `/api/opinions/${opinionId}/adopt`, { content, stance });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id, "opinions"] });
      setShowAdoptDialog(false);
      setOpinionToAdopt(null);
      toast({
        title: "Opinion adopted",
        description: "Your opinion has been successfully updated.",
      });
    },
    onError: (error: any) => {
      console.error("Failed to adopt opinion:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to adopt opinion",
        variant: "destructive",
      });
    },
  });

  const likeCounterpointMutation = useMutation({
    mutationFn: async ({ counterpointId, like }: { counterpointId: string; like: boolean }) => {
      return apiRequest("POST", `/api/counterpoints/${counterpointId}/like`, { like });
    },
    onSuccess: () => {
      if (userOpinion?.id && selectedSentenceIndex != null) {
        queryClient.invalidateQueries({ queryKey: ["/api/opinions", userOpinion.id, "counterpoints", selectedSentenceIndex] as any });
      }
      if (currentOtherOpinion?.id && selectedOtherSentenceIndex != null) {
        queryClient.invalidateQueries({ queryKey: ["/api/opinions", currentOtherOpinion.id, "counterpoints", selectedOtherSentenceIndex] as any });
      }
      if (selectedCounterpointId) {
        queryClient.invalidateQueries({ queryKey: ["/api/counterpoints", selectedCounterpointId, "likers"] });
      }
    },
  });

  const createCounterpointMutation = useMutation({
    mutationFn: async ({ opinionId, sentenceIndex, content }: { opinionId: string; sentenceIndex: number; content: string }) => {
      return apiRequest("POST", `/api/opinions/${opinionId}/counterpoints`, { sentenceIndex, content });
    },
    onSuccess: () => {
      if (userOpinion?.id && selectedSentenceIndex != null) {
        queryClient.invalidateQueries({ queryKey: ["/api/opinions", userOpinion.id, "counterpoints", selectedSentenceIndex] as any });
      }
      if (currentOtherOpinion?.id && selectedOtherSentenceIndex != null) {
        queryClient.invalidateQueries({ queryKey: ["/api/opinions", currentOtherOpinion.id, "counterpoints", selectedOtherSentenceIndex] as any });
      }
      toast({ title: "Counterpoint added" });
    },
  });

  const startDebateFromCounterpointMutation = useMutation({
    mutationFn: async ({ counterpointId, opponentUserId }: { counterpointId: string; opponentUserId: string }) => {
      const res = await apiRequest("POST", `/api/counterpoints/${counterpointId}/start-debate`, { opponentUserId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debates/grouped"] });
      toast({ title: "Debate started", description: "Your debate should appear in the footer." });
    },
    onError: (error: any) => {
      toast({ title: "Cannot start debate", description: error.message || "Failed to start debate", variant: "destructive" });
    },
  });

  // Flag topic mutation
  const flagTopicMutation = useMutation({
    mutationFn: async (fallacyType: FallacyType) => {
      const response = await fetch(`/api/topics/${id}/flag`, {
        method: "POST",
        body: JSON.stringify({ fallacyType }),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Flag submitted",
        description: "Thank you for helping keep debates productive.",
      });
      setShowTopicFlagDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit flag",
        variant: "destructive",
      });
    },
  });

  const flagOtherOpinionMutation = useMutation({
    mutationFn: async ({ opinionId, fallacyType }: { opinionId: string; fallacyType: FallacyType }) => {
      const response = await fetch(`/api/opinions/${opinionId}/flag`, {
        method: "POST",
        body: JSON.stringify({ fallacyType }),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Flag submitted",
        description: "Thank you for helping keep debates productive.",
      });
      setOtherOpinionFlagOpen(false);
      setOtherOpinionFlagTargetId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id, "opinions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/opinions/recent"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit flag",
        variant: "destructive",
      });
    },
  });

  const opinionForm = useForm<z.infer<typeof opinionFormSchema>>({
    resolver: zodResolver(opinionFormSchema),
    defaultValues: {
      content: "",
      debateStatus: "open",
      references: [],
    },
  });

  const onSubmitOpinion = (data: z.infer<typeof opinionFormSchema>) => {
    if (!isAuthenticated) {
      setLoginAction("opinion");
      setShowLoginPrompt(true);
      return;
    }
    createOpinionMutation.mutate(data);
  };
  
  const handleShareOpinionClick = () => {
    if (!isAuthenticated) {
      setLoginAction("opinion");
      setShowLoginPrompt(true);
      return;
    }
    setShowOpinionForm(true);
  };
  
  const handleFlagTopicClick = () => {
    if (!isAuthenticated) {
      setLoginAction("interact");
      setShowLoginPrompt(true);
      return;
    }
    setShowTopicFlagDialog(true);
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

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Back Button */}
      <Link href="/">
        <Button variant="ghost" size="sm" data-testid="button-back-home">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Topics
        </Button>
      </Link>

      {/* Header Section */}
      <div className="space-y-4">
        {/* Categories and Active Badge */}
        <div className="flex items-center gap-2 flex-wrap">
          {(Array.isArray(topic.categories) ? topic.categories : []).map((cat) => (
            <Badge 
              key={String(cat)} 
              variant="secondary"
              className="cursor-pointer hover-elevate"
              onClick={() => navigate(`/category/${encodeURIComponent(String(cat))}`)}
              data-testid={`badge-category-${String(cat).toLowerCase()}`}
            >
              {cat}
            </Badge>
          ))}
          {topic.isActive && (
            <Badge className="bg-chart-1 text-white">
              <TrendingUp className="w-3 h-3 mr-1" />
              Active
            </Badge>
          )}
        </div>

        {/* Title - Full Width */}
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight" data-testid="text-topic-title">
          {topic.title}
        </h1>
        
        {/* Display fallacy badges if any */}
        {topic.fallacyCounts && Object.keys(topic.fallacyCounts).some(key => (topic.fallacyCounts?.[key] || 0) > 0) && (
          <div>
            <FallacyBadges fallacyCounts={topic.fallacyCounts} />
          </div>
        )}

        {/* Stats and Flag Button */}
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            <span data-testid="text-opinions-count">{opinions?.length || 0} opinions</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span data-testid="text-participants-count">
              {opinions ? new Set(opinions.map(o => o.userId)).size : 0} participants
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleFlagTopicClick}
            data-testid="button-flag-topic"
            className="flex-shrink-0 ml-auto"
          >
            <Flag className="w-4 h-4 mr-2" />
            Flag
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="ai" className="text-sm md:text-base">AI Summary</TabsTrigger>
          <TabsTrigger value="yours" className="text-sm md:text-base">Your Opinion</TabsTrigger>
          <TabsTrigger value="others" className="text-sm md:text-base">Other Opinions</TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                AI Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cumulativeData ? (
                <InteractiveSentenceText
                  text={summarySentences.map((s) => s?.text ?? "").join(" ").trim()}
                  selectedSentenceIndex={selectedSentenceIndex}
                  onSelectSentence={(idx) => {
                    setSelectedSentenceIndex(idx);
                    setSheetOpen(true);
                  }}
                />
              ) : (
                <p className="text-muted-foreground">No AI summary yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="yours" className="mt-4">
          {userOpinion ? (
            <Card style={getOpinionGradientStyle(userOpinion.topicEconomicScore, userOpinion.topicAuthoritarianScore)}>
              <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
                <CardTitle>Your Opinion</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    opinionForm.setValue("content", userOpinion.content);
                    opinionForm.setValue("debateStatus", (userOpinion.debateStatus || "open") as any);
                    opinionForm.setValue("references", userOpinion.references || []);
                    setShowOpinionForm(true);
                  }}
                >
                  Update
                </Button>
              </CardHeader>
              <CardContent>
                <InteractiveSentenceText
                  text={userOpinion.content}
                  selectedSentenceIndex={selectedSentenceIndex}
                  onSelectSentence={(idx) => {
                    setSelectedSentenceIndex(idx);
                    setSelectedCounterpointId(null);
                    setSheetOpen(true);
                  }}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-10 text-center">
                <Button variant="default" onClick={handleShareOpinionClick}>
                  <Plus className="w-4 h-4 mr-2" />
                  Share Your Opinion
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="others" className="mt-4">
          {currentOtherOpinion ? (
            <Card style={getOpinionGradientStyle(currentOtherOpinion.topicEconomicScore, currentOtherOpinion.topicAuthoritarianScore)}>
              <CardHeader className="pb-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>Other Opinions</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={otherOpinionIndex <= 0}
                      onClick={() => {
                        setOtherOpinionIndex(i => Math.max(0, i - 1));
                        setSelectedOtherSentenceIndex(null);
                      }}
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={otherOpinionIndex >= otherOpinions.length - 1}
                      onClick={() => {
                        setOtherOpinionIndex(i => Math.min(otherOpinions.length - 1, i + 1));
                        setSelectedOtherSentenceIndex(null);
                      }}
                    >
                      Next
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant={(currentOtherOpinion.userVote?.voteType === "like") ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (!isAuthenticated) {
                        setLoginAction("like");
                        setShowLoginPrompt(true);
                        return;
                      }
                      voteMutation.mutate({
                        opinionId: currentOtherOpinion.id,
                        voteType: "like",
                        currentVote: currentOtherOpinion.userVote?.voteType || null
                      });
                    }}
                  >
                    Like ({currentOtherOpinion.likesCount || 0})
                  </Button>
                  <Button
                    variant={(currentOtherOpinion.userVote?.voteType === "dislike") ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (!isAuthenticated) {
                        setLoginAction("like");
                        setShowLoginPrompt(true);
                        return;
                      }
                      voteMutation.mutate({
                        opinionId: currentOtherOpinion.id,
                        voteType: "dislike",
                        currentVote: currentOtherOpinion.userVote?.voteType || null
                      });
                    }}
                  >
                    Dislike ({currentOtherOpinion.dislikesCount || 0})
                  </Button>
                  <div className="text-sm text-muted-foreground ml-auto">
                    {otherOpinionIndex + 1} / {otherOpinions.length}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!isAuthenticated) {
                        setLoginAction("opinion");
                        setShowLoginPrompt(true);
                        return;
                      }
                      setOpinionToAdopt(currentOtherOpinion);
                      setShowAdoptDialog(true);
                    }}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Adopt this opinion
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!isAuthenticated) {
                        setLoginAction("interact");
                        setShowLoginPrompt(true);
                        return;
                      }
                      setOtherOpinionFlagTargetId(currentOtherOpinion.id);
                      setOtherOpinionFlagOpen(true);
                    }}
                  >
                    <Flag className="w-4 h-4 mr-2" />
                    Flag for fallacy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <InteractiveSentenceText
                  text={currentOtherOpinion.content}
                  selectedSentenceIndex={selectedOtherSentenceIndex}
                  onSelectSentence={(idx) => {
                    setSelectedOtherSentenceIndex(idx);
                    setSheetOpen(true);
                  }}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No other opinions yet.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Right-side sheet for sentence interactions */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {activeTab === "ai" && "Referenced Opinions"}
              {activeTab === "yours" && "Counterpoints"}
              {activeTab === "others" && "Counterpoints"}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {activeTab === "ai" && (
              <>
                {referencedOpinionsForSelectedSummarySentence.length > 0 ? (
                  <ScrollArea className="h-[calc(100vh-140px)] pr-4">
                    <div className="space-y-3">
                      {referencedOpinionsForSelectedSummarySentence.map((op) => (
                        <OpinionCard
                          key={op.id}
                          id={op.id}
                          topicId={id!}
                          userId={op.userId}
                          userName={op.author ? `${op.author.firstName || ""} ${op.author.lastName || ""}`.trim() || "Anonymous" : "Anonymous"}
                          userAvatar={op.author?.profileImageUrl || undefined}
                          economicScore={op.author?.economicScore}
                          authoritarianScore={op.author?.authoritarianScore}
                          topicEconomicScore={op.topicEconomicScore}
                          topicAuthoritarianScore={op.topicAuthoritarianScore}
                          content={op.content}
                          debateStatus={op.debateStatus}
                          timestamp={"—"}
                          likesCount={op.likesCount || 0}
                          dislikesCount={op.dislikesCount || 0}
                          references={op.references || []}
                          fallacyCounts={op.fallacyCounts}
                          isLiked={op.userVote?.voteType === "like"}
                          isDisliked={op.userVote?.voteType === "dislike"}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-muted-foreground">Select a sentence to see referenced opinions.</p>
                )}
              </>
            )}

            {activeTab === "yours" && (
              <>
                {selectedSentenceIndex == null ? (
                  <p className="text-muted-foreground">Select a sentence to see counterpoints.</p>
                ) : (
                  <>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Add a counterpoint</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Textarea
                          placeholder="Write a counterpoint…"
                          className="min-h-[90px]"
                          onBlur={(e) => {
                            const content = e.currentTarget.value;
                            if (!content.trim()) return;
                            if (!isAuthenticated) {
                              setLoginAction("interact");
                              setShowLoginPrompt(true);
                              return;
                            }
                            createCounterpointMutation.mutate({ opinionId: userOpinion!.id, sentenceIndex: selectedSentenceIndex, content });
                            e.currentTarget.value = "";
                          }}
                        />
                        <p className="text-xs text-muted-foreground">Tip: click away to submit.</p>
                      </CardContent>
                    </Card>

                    <div className="space-y-2">
                      {(counterpoints || []).length === 0 ? (
                        <p className="text-muted-foreground">No counterpoints yet.</p>
                      ) : (
                        (counterpoints || []).map((cp: any) => (
                          <Card key={cp.id}>
                            <CardContent className="pt-4 space-y-3">
                              <div className="text-sm whitespace-pre-wrap">{cp.content}</div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant={cp.likedByMe ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => {
                                    if (!isAuthenticated) {
                                      setLoginAction("like");
                                      setShowLoginPrompt(true);
                                      return;
                                    }
                                    likeCounterpointMutation.mutate({ counterpointId: cp.id, like: !cp.likedByMe });
                                  }}
                                >
                                  Like ({cp.likeCount || 0})
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedCounterpointId(cp.id)}
                                >
                                  Choose debater
                                </Button>
                              </div>

                              {selectedCounterpointId === cp.id && (
                                <div className="pt-2 border-t space-y-2">
                                  <ToggleGroup
                                    type="single"
                                    value={rankMode}
                                    onValueChange={(v) => v && setRankMode(v as any)}
                                    className="justify-start"
                                  >
                                    <ToggleGroupItem value="rank">Highest ranked</ToggleGroupItem>
                                    <ToggleGroupItem value="active">Most active</ToggleGroupItem>
                                  </ToggleGroup>

                                  {rankedPresence.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No likers yet.</p>
                                  ) : (
                                    <div className="space-y-2">
                                      {rankedPresence.map((p: any) => (
                                        <Button
                                          key={p.userId}
                                          variant={p.isOnline ? "default" : "outline"}
                                          size="sm"
                                          className="w-full justify-between"
                                          onClick={() => {
                                            startDebateFromCounterpointMutation.mutate({ counterpointId: cp.id, opponentUserId: p.userId });
                                          }}
                                        >
                                          <span className="truncate">{p.userId}</span>
                                          <span className="text-xs opacity-80">
                                            {p.isOnline ? "Online" : "Offline"} · Rank {p.debaterRank || 0}
                                          </span>
                                        </Button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            {activeTab === "others" && (
              <>
                {selectedOtherSentenceIndex == null || !currentOtherOpinion ? (
                  <p className="text-muted-foreground">Select a sentence to see counterpoints.</p>
                ) : (
                  <>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Add a counterpoint</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Textarea
                          placeholder="Write a counterpoint…"
                          className="min-h-[90px]"
                          onBlur={(e) => {
                            const content = e.currentTarget.value;
                            if (!content.trim()) return;
                            if (!isAuthenticated) {
                              setLoginAction("interact");
                              setShowLoginPrompt(true);
                              return;
                            }
                            createCounterpointMutation.mutate({ opinionId: currentOtherOpinion.id, sentenceIndex: selectedOtherSentenceIndex, content });
                            e.currentTarget.value = "";
                          }}
                        />
                        <p className="text-xs text-muted-foreground">Tip: click away to submit.</p>
                      </CardContent>
                    </Card>

                    <div className="space-y-2">
                      {(otherCounterpoints || []).length === 0 ? (
                        <p className="text-muted-foreground">No counterpoints yet.</p>
                      ) : (
                        (otherCounterpoints || []).map((cp: any) => (
                          <Card key={cp.id}>
                            <CardContent className="pt-4 space-y-3">
                              <div className="text-sm whitespace-pre-wrap">{cp.content}</div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant={cp.likedByMe ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => {
                                    if (!isAuthenticated) {
                                      setLoginAction("like");
                                      setShowLoginPrompt(true);
                                      return;
                                    }
                                    likeCounterpointMutation.mutate({ counterpointId: cp.id, like: !cp.likedByMe });
                                  }}
                                >
                                  Like ({cp.likeCount || 0})
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Opinion Form Dialog */}
      <Dialog open={showOpinionForm} onOpenChange={setShowOpinionForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{userOpinion ? 'Update Your Opinion' : 'Share Your Opinion'}</DialogTitle>
            <DialogDescription>
              {userOpinion ? 'Modify your existing opinion on this topic.' : 'Share your thoughts on this topic.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...opinionForm}>
            <form onSubmit={opinionForm.handleSubmit(onSubmitOpinion)} className="space-y-4">
              <FormField
                control={opinionForm.control}
                name="debateStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Debate Availability</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-debate-status">
                          <SelectValue placeholder="Select debate availability" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="open" data-testid="option-debate-open">
                          Open for Debate - Others can challenge this opinion
                        </SelectItem>
                        <SelectItem value="closed" data-testid="option-debate-closed">
                          Not Debatable - Opinion is public but read-only
                        </SelectItem>
                        <SelectItem value="private" data-testid="option-debate-private">
                          Private - Only visible to you
                        </SelectItem>
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

              <div className="flex gap-2 justify-end pt-4">
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
                  {createOpinionMutation.isPending ? 'Saving...' : userOpinion ? 'Update Opinion' : 'Share Opinion'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Topic Flag Dialog */}
      <FallacyFlagDialog
        open={showTopicFlagDialog}
        onOpenChange={setShowTopicFlagDialog}
        onSubmit={(fallacyType) => flagTopicMutation.mutate(fallacyType)}
        isPending={flagTopicMutation.isPending}
        entityType="topic"
      />

      <FallacyFlagDialog
        open={otherOpinionFlagOpen}
        onOpenChange={(open) => {
          setOtherOpinionFlagOpen(open);
          if (!open) setOtherOpinionFlagTargetId(null);
        }}
        onSubmit={(fallacyType) => {
          if (otherOpinionFlagTargetId) {
            flagOtherOpinionMutation.mutate({ opinionId: otherOpinionFlagTargetId, fallacyType });
          }
        }}
        isPending={flagOtherOpinionMutation.isPending}
        entityType="opinion"
      />

      {/* Adopt Opinion Dialog */}
      <AdoptOpinionDialog
        open={showAdoptDialog}
        onOpenChange={setShowAdoptDialog}
        currentOpinion={userOpinion ? {
          content: userOpinion.content,
          stance: userOpinion.stance as "for" | "against" | "neutral"
        } : null}
        opinionToAdopt={opinionToAdopt ? {
          content: opinionToAdopt.content,
          stance: opinionToAdopt.stance,
          authorName: opinionToAdopt.author ? `${opinionToAdopt.author.firstName || ''} ${opinionToAdopt.author.lastName || ''}`.trim() || 'Anonymous' : 'Anonymous'
        } : null}
        onAdopt={(content, stance) => {
          if (opinionToAdopt) {
            adoptMutation.mutate({ 
              opinionId: opinionToAdopt.id, 
              content, 
              stance 
            });
          }
        }}
        isPending={adoptMutation.isPending}
      />
      
      {/* Login Prompt Dialog */}
      <LoginPromptDialog
        open={showLoginPrompt}
        onOpenChange={setShowLoginPrompt}
        action={loginAction}
      />
    </div>
  );
}
