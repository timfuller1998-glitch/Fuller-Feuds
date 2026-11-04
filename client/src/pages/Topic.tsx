import { useMemo, useState, useEffect, useRef } from "react";
import { UserHandle } from "@/components/UserHandle";
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
import { ToastAction } from "@/components/ui/toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useDebateContext } from "@/contexts/DebateContext";
import OpinionCard from "@/components/OpinionCard";
import { AdoptOpinionDialog } from "@/components/AdoptOpinionDialog";
import { LoginPromptDialog } from "@/components/LoginPromptDialog";
import FallacyBadges from "@/components/FallacyBadges";
import FallacyFlagDialog from "@/components/FallacyFlagDialog";
import type { FallacyType } from "@shared/fallacies";
import { getOpinionGradientStyle } from "@/lib/politicalColors";
import { InteractiveSentenceText } from "@/components/InteractiveSentenceText";
import { getParagraphTextAtIndex } from "@/lib/textSegments";
import CardDeck from "@/components/CardDeck";
import { OpinionDeckFront, OpinionDeckBack } from "@/components/OpinionDeckCard";
import { tallyStances } from "@/lib/stance";
import { useQueries } from "@tanstack/react-query";

type DebateCandidate = {
  userId: string;
  handle?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  relation: "author" | "liker";
  isOnline: boolean;
  activeRank: number | null;
  activeCount: number;
};
function CounterpointAuthor({ author }: { author?: { id?: string; firstName?: string | null; lastName?: string | null; handle?: string | null; profileImageUrl?: string | null } | null }) {
  if (!author) return null;
  const name = `${author.firstName || ""} ${author.lastName || ""}`.trim() || "Anonymous";
  return (
    <div className="flex items-center gap-2 min-w-0" data-testid="counterpoint-author">
      <Avatar className="h-7 w-7 flex-shrink-0">
        <AvatarImage src={author.profileImageUrl ?? undefined} />
        <AvatarFallback className="text-xs">{name.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium leading-tight">{name}</span>
        <UserHandle handle={author.handle} />
      </span>
    </div>
  );
}

const candidateName = (p: DebateCandidate) => `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Anonymous";

const opinionFormSchema = insertOpinionSchema.omit({
  topicId: true,
  userId: true,
}).extend({
  content: z.string().min(1, "Opinion is required").max(2000, "Opinion too long"),
  debateStatus: z.enum(["open", "closed", "private"], { required_error: "Please select debate availability" }),
  references: z.array(z.string().url("Must be a valid URL")).optional().default([]),
  stance: z.enum(["for", "against", "neutral"], { required_error: "Pick a stance", invalid_type_error: "Pick a stance" }),
});

type CounterpointCountRow = { sentenceIndex: number; count: number };

function parseCounterpointCountRows(data: unknown): CounterpointCountRow[] {
  if (!Array.isArray(data)) return [];
  const out: CounterpointCountRow[] = [];
  for (const r of data) {
    if (!r || typeof r !== "object") continue;
    const si = Number((r as { sentenceIndex?: unknown }).sentenceIndex);
    const c = Number((r as { count?: unknown }).count);
    if (!Number.isInteger(si) || si < 0 || !Number.isFinite(c) || c < 0) continue;
    out.push({ sentenceIndex: si, count: c });
  }
  return out;
}

export default function Topic() {
  const { id } = useParams();
  const search = useSearch();
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { openDebateWindow } = useDebateContext();
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
  const [selectedCounterpointId, setSelectedCounterpointId] = useState<string | null>(null);
  const [counterpointDraftYours, setCounterpointDraftYours] = useState("");
  const [counterpointDraftOthers, setCounterpointDraftOthers] = useState("");

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
    setCounterpointDraftYours("");
    setCounterpointDraftOthers("");
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

  const userCounterParagraphText = useMemo(() => {
    if (selectedSentenceIndex == null || !userOpinion?.content) return "";
    return getParagraphTextAtIndex(userOpinion.content, selectedSentenceIndex);
  }, [userOpinion?.content, selectedSentenceIndex]);

  const otherCounterParagraphText = useMemo(() => {
    if (selectedOtherSentenceIndex == null || !currentOtherOpinion?.content) return "";
    return getParagraphTextAtIndex(currentOtherOpinion.content, selectedOtherSentenceIndex);
  }, [currentOtherOpinion?.content, selectedOtherSentenceIndex]);

  useEffect(() => {
    setCounterpointDraftYours("");
  }, [selectedSentenceIndex, userOpinion?.id]);

  useEffect(() => {
    setCounterpointDraftOthers("");
  }, [selectedOtherSentenceIndex, currentOtherOpinion?.id]);

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

  const { data: userCounterpointCountData } = useQuery({
    queryKey: ["/api/opinions", userOpinion?.id, "counterpoint-counts"] as const,
    queryFn: async () => {
      const response = await fetch(`/api/opinions/${userOpinion!.id}/counterpoints/counts`);
      if (!response.ok) throw new Error("Failed to fetch counterpoint counts");
      return response.json();
    },
    enabled: !!userOpinion?.id,
  });

  const { data: otherCounterpointCountData } = useQuery({
    queryKey: ["/api/opinions", currentOtherOpinion?.id, "counterpoint-counts"] as const,
    queryFn: async () => {
      const response = await fetch(`/api/opinions/${currentOtherOpinion!.id}/counterpoints/counts`);
      if (!response.ok) throw new Error("Failed to fetch counterpoint counts");
      return response.json();
    },
    enabled: !!currentOtherOpinion?.id,
  });

  const userCpCountByIndex = useMemo(() => {
    const m = new Map<number, number>();
    for (const row of parseCounterpointCountRows(userCounterpointCountData)) {
      m.set(row.sentenceIndex, row.count);
    }
    return m;
  }, [userCounterpointCountData]);

  const otherCpCountByIndex = useMemo(() => {
    const m = new Map<number, number>();
    for (const row of parseCounterpointCountRows(otherCounterpointCountData)) {
      m.set(row.sentenceIndex, row.count);
    }
    return m;
  }, [otherCounterpointCountData]);

  const userParagraphInteractionCount = useMemo(
    () => (i: number) => userCpCountByIndex.get(i) ?? 0,
    [userCpCountByIndex]
  );

  const otherParagraphInteractionCount = useMemo(
    () => (i: number) => otherCpCountByIndex.get(i) ?? 0,
    [otherCpCountByIndex]
  );

  // Counterpoints attached to the opinions each summary paragraph references (drives the "N counterpoints" badge).
  const summaryRefIds = useMemo(
    () => Array.from(new Set(summarySentences.flatMap((s) => s.referencedOpinionIds || []))),
    [summarySentences]
  );
  const summaryRefCountQueries = useQueries({
    queries: summaryRefIds.map((opId) => ({
      queryKey: ["/api/opinions", opId, "counterpoint-counts"] as const,
      queryFn: async () => {
        const response = await fetch(`/api/opinions/${opId}/counterpoints/counts`);
        if (!response.ok) throw new Error("Failed to fetch counterpoint counts");
        return response.json();
      },
    })),
  });
  const summaryCounterpointCount = useMemo(() => {
    const totals = new Map<string, number>();
    summaryRefIds.forEach((opId, k) => {
      const rows = parseCounterpointCountRows(summaryRefCountQueries[k]?.data);
      totals.set(opId, rows.reduce((a, r) => a + r.count, 0));
    });
    const counts = summarySentences.map((s) => (s.referencedOpinionIds || []).reduce((a, opId) => a + (totals.get(opId) ?? 0), 0));
    return (i: number) => counts[i] ?? 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summarySentences, summaryRefIds, summaryRefCountQueries.map((q) => q.dataUpdatedAt).join(",")]);

  const stanceTally = useMemo(() => tallyStances(opinions || []), [opinions]);
  const headerDescription = useMemo(() => {
    const d = (topic?.description || "").trim();
    if (d) return d;
    const summary = String((cumulativeData as any)?.summary || summarySentences.map((x) => x.text).join(" ")).trim();
    if (!summary) return "";
    return summary.length > 220 ? summary.slice(0, 217).replace(/\s+\S*$/, "") + "…" : summary;
  }, [topic?.description, cumulativeData, summarySentences]);

  // Debate candidates for the selected counterpoint: its author first, then likers (server-ordered).
  const { data: debateCandidates = [], isLoading: candidatesLoading } = useQuery<DebateCandidate[]>({
    queryKey: ["/api/counterpoints", selectedCounterpointId, "debate-candidates"],
    queryFn: async () => {
      const res = await fetch(`/api/counterpoints/${selectedCounterpointId}/debate-candidates`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch debate candidates");
      return res.json();
    },
    enabled: !!selectedCounterpointId && sheetOpen && activeTab === "yours" && isAuthenticated,
  });
  
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
        queryClient.invalidateQueries({ queryKey: ["/api/counterpoints", selectedCounterpointId, "debate-candidates"] });
      }
    },
  });

  const createCounterpointMutation = useMutation({
    mutationFn: async ({
      opinionId,
      sentenceIndex,
      content,
      paragraphText,
    }: {
      opinionId: string;
      sentenceIndex: number;
      content: string;
      paragraphText: string;
    }) => {
      return apiRequest("POST", `/api/opinions/${opinionId}/counterpoints`, {
        sentenceIndex,
        content,
        paragraphText,
      });
    },
    onSuccess: (_data, variables) => {
      if (variables.opinionId === userOpinion?.id) {
        setCounterpointDraftYours("");
      }
      if (variables.opinionId === currentOtherOpinion?.id) {
        setCounterpointDraftOthers("");
      }
      if (userOpinion?.id && selectedSentenceIndex != null) {
        queryClient.invalidateQueries({ queryKey: ["/api/opinions", userOpinion.id, "counterpoints", selectedSentenceIndex] as any });
      }
      if (currentOtherOpinion?.id && selectedOtherSentenceIndex != null) {
        queryClient.invalidateQueries({ queryKey: ["/api/opinions", currentOtherOpinion.id, "counterpoints", selectedOtherSentenceIndex] as any });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/opinions", variables.opinionId, "counterpoint-counts"] as any });
      toast({ title: "Counterpoint added" });
    },
  });

  const startDebateFromCounterpointMutation = useMutation({
    mutationFn: async ({ counterpointId, opponent }: { counterpointId: string; opponent: DebateCandidate }) => {
      const res = await apiRequest("POST", `/api/counterpoints/${counterpointId}/start-debate`, { opponentUserId: opponent.userId });
      return { room: await res.json(), opponent };
    },
    onSuccess: ({ room, opponent }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/debates/grouped"] });
      const opponentName = candidateName(opponent);
      const open = () =>
        openDebateWindow({ debateRoomId: room.id, topicTitle: topic?.title || "Debate", opponentName, opponentId: opponent.userId });
      setSelectedCounterpointId(null);
      setSheetOpen(false);
      open();
      toast({
        title: "Debate started",
        description: `You're now debating ${opponentName}. It's also in your debates footer.`,
        action: (
          <ToastAction altText="Open debate" onClick={open} data-testid="toast-open-debate">Open</ToastAction>
        ),
      });
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
            <Badge className="bg-chart-1 text-primary-foreground">
              <TrendingUp className="w-3 h-3 mr-1" />
              Active
            </Badge>
          )}
        </div>

        {/* Title - Full Width */}
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight" data-testid="text-topic-title">
          {topic.title}
        </h1>
        {headerDescription && (
          <p className="text-base text-muted-foreground leading-relaxed max-w-3xl" data-testid="text-topic-description">
            {headerDescription}
          </p>
        )}

        {/* Stance tally */}
        <div className="flex items-center gap-2 flex-wrap" data-testid="stance-tally">
          <Badge className="bg-stance-for text-primary-foreground" data-testid="tally-for">For {stanceTally.for}</Badge>
          <Badge className="bg-stance-against text-primary-foreground" data-testid="tally-against">Against {stanceTally.against}</Badge>
          <Badge className="bg-stance-neutral text-primary-foreground" data-testid="tally-neutral">Neutral {stanceTally.neutral}</Badge>
          {stanceTally.unstated > 0 && (
            <span className="text-xs text-muted-foreground" data-testid="tally-unstated">
              {stanceTally.unstated} without a stance
            </span>
          )}
        </div>
        
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
          <TabsTrigger value="ai">AI Summary</TabsTrigger>
          <TabsTrigger value="yours">Your Opinion</TabsTrigger>
          <TabsTrigger value="others">Other Opinions</TabsTrigger>
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
                  chunks={summarySentences.map((s) => s?.text ?? "")}
                  interactionCount={summaryCounterpointCount}
                  badgeLabel={(n) => `${n} counterpoint${n === 1 ? "" : "s"}`}
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
                    opinionForm.setValue("stance", (userOpinion.stance ?? undefined) as any);
                    setShowOpinionForm(true);
                  }}
                >
                  Update
                </Button>
              </CardHeader>
              <CardContent>
                <InteractiveSentenceText
                  text={userOpinion.content}
                  segmentMode="paragraph"
                  interactionCount={userParagraphInteractionCount}
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
          {otherOpinions.length > 0 ? (
            <div className="flex justify-center py-2" data-testid="opinion-deck-wrapper">
              <CardDeck<Opinion>
                key={id}
                items={otherOpinions}
                getKey={(op) => op.id}
                initialIndex={otherOpinionIndex}
                onIndexChange={(i) => {
                  setOtherOpinionIndex(i);
                  setSelectedOtherSentenceIndex(null);
                }}
                maxWidth={420}
                testId="deck-opinions"
                ariaLabel="Opinion deck"
                emptyLabel="No other opinions yet."
                renderFront={(op) => (
                  <OpinionDeckFront
                    op={op as any}
                    onSelectParagraph={(idx) => {
                      setSelectedOtherSentenceIndex(idx);
                      setSheetOpen(true);
                    }}
                  />
                )}
                renderBack={(op) => (
                  <OpinionDeckBack
                    op={op as any}
                    onVote={(voteType) => {
                      if (!isAuthenticated) {
                        setLoginAction("like");
                        setShowLoginPrompt(true);
                        return;
                      }
                      voteMutation.mutate({ opinionId: op.id, voteType, currentVote: (op as any).userVote?.voteType || null });
                    }}
                    onAdopt={() => {
                      if (!isAuthenticated) {
                        setLoginAction("opinion");
                        setShowLoginPrompt(true);
                        return;
                      }
                      setOpinionToAdopt(op);
                      setShowAdoptDialog(true);
                    }}
                    onFlag={() => {
                      if (!isAuthenticated) {
                        setLoginAction("interact");
                        setShowLoginPrompt(true);
                        return;
                      }
                      setOtherOpinionFlagTargetId(op.id);
                      setOtherOpinionFlagOpen(true);
                    }}
                    onSeeCounterpoints={(idx) => {
                      setSelectedOtherSentenceIndex(idx);
                      setSheetOpen(true);
                    }}
                  />
                )}
              />
            </div>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No other opinions yet.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Right-side sheet for paragraph / summary-segment interactions */}
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
                  <p className="text-muted-foreground">Select a paragraph to see referenced opinions.</p>
                )}
              </>
            )}

            {activeTab === "yours" && (
              <>
                {selectedSentenceIndex == null ? (
                  <p className="text-muted-foreground">Select a paragraph to see counterpoints.</p>
                ) : (
                  <>
                    {userCounterParagraphText ? (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base text-muted-foreground">Selected paragraph</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <blockquote className="border-l-2 border-muted-foreground/30 pl-3 text-sm whitespace-pre-wrap text-muted-foreground">
                            {userCounterParagraphText}
                          </blockquote>
                        </CardContent>
                      </Card>
                    ) : null}

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Add a counterpoint</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Textarea
                          placeholder="Write a counterpoint…"
                          className="min-h-[90px]"
                          value={counterpointDraftYours}
                          onChange={(e) => setCounterpointDraftYours(e.target.value)}
                        />
                        <Button
                          type="button"
                          disabled={!counterpointDraftYours.trim() || createCounterpointMutation.isPending}
                          onClick={() => {
                            const content = counterpointDraftYours.trim();
                            if (!content) return;
                            if (!isAuthenticated) {
                              setLoginAction("interact");
                              setShowLoginPrompt(true);
                              return;
                            }
                            createCounterpointMutation.mutate({
                              opinionId: userOpinion!.id,
                              sentenceIndex: selectedSentenceIndex,
                              content,
                              paragraphText: userCounterParagraphText,
                            });
                          }}
                        >
                          {createCounterpointMutation.isPending ? "Submitting…" : "Submit"}
                        </Button>
                      </CardContent>
                    </Card>

                    <div className="space-y-2">
                      {(counterpoints || []).length === 0 ? (
                        <p className="text-muted-foreground">No counterpoints yet.</p>
                      ) : (
                        (counterpoints || []).map((cp: any) => (
                          <Card key={cp.id}>
                            <CardContent className="pt-4 space-y-3">
                              <CounterpointAuthor author={cp.author} />
                              {cp.paragraphText ? (
                                <div className="text-xs text-muted-foreground border-l-2 border-muted-foreground/20 pl-2 whitespace-pre-wrap">
                                  <span className="font-medium text-foreground/80">Paragraph: </span>
                                  {cp.paragraphText}
                                </div>
                              ) : null}
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
                                  <p className="text-xs text-muted-foreground">Pick who to debate about this counterpoint:</p>
                                  {candidatesLoading ? (
                                    <p className="text-sm text-muted-foreground">Loading…</p>
                                  ) : debateCandidates.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No one else to debate here yet.</p>
                                  ) : (
                                    <div className="space-y-2" data-testid={`debate-candidates-${cp.id}`}>
                                      {debateCandidates.map((p) => (
                                        <button
                                          key={p.userId}
                                          type="button"
                                          disabled={startDebateFromCounterpointMutation.isPending}
                                          className="w-full flex items-center gap-3 rounded-lg border bg-card p-2.5 text-left hover-elevate disabled:opacity-60"
                                          onClick={() => startDebateFromCounterpointMutation.mutate({ counterpointId: cp.id, opponent: p })}
                                          data-testid={`button-debate-candidate-${p.userId}`}
                                        >
                                          <span className="relative flex-shrink-0">
                                            <Avatar className="h-8 w-8">
                                              <AvatarImage src={p.profileImageUrl ?? undefined} />
                                              <AvatarFallback className="text-xs">{p.firstName?.charAt(0)}{p.lastName?.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            {p.isOnline && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-card" aria-label="Online" />}
                                          </span>
                                          <span className="flex-1 min-w-0">
                                            <span className="block truncate text-sm font-medium">{candidateName(p)}</span>
                                            <UserHandle handle={p.handle} />
                                            <span className="block text-xs text-muted-foreground">
                                              {p.relation === "author" ? "Wrote this counterpoint" : "Liked this counterpoint"}
                                            </span>
                                          </span>
                                          {p.activeRank != null && (
                                            <span className="text-xs text-muted-foreground whitespace-nowrap" title={`${p.activeCount} contributions`}>
                                              #{p.activeRank} active
                                            </span>
                                          )}
                                        </button>
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
                  <p className="text-muted-foreground">Select a paragraph to see counterpoints.</p>
                ) : (
                  <>
                    {otherCounterParagraphText ? (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base text-muted-foreground">Selected paragraph</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <blockquote className="border-l-2 border-muted-foreground/30 pl-3 text-sm whitespace-pre-wrap text-muted-foreground">
                            {otherCounterParagraphText}
                          </blockquote>
                        </CardContent>
                      </Card>
                    ) : null}

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Add a counterpoint</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Textarea
                          placeholder="Write a counterpoint…"
                          className="min-h-[90px]"
                          value={counterpointDraftOthers}
                          onChange={(e) => setCounterpointDraftOthers(e.target.value)}
                        />
                        <Button
                          type="button"
                          disabled={!counterpointDraftOthers.trim() || createCounterpointMutation.isPending}
                          onClick={() => {
                            const content = counterpointDraftOthers.trim();
                            if (!content) return;
                            if (!isAuthenticated) {
                              setLoginAction("interact");
                              setShowLoginPrompt(true);
                              return;
                            }
                            createCounterpointMutation.mutate({
                              opinionId: currentOtherOpinion.id,
                              sentenceIndex: selectedOtherSentenceIndex,
                              content,
                              paragraphText: otherCounterParagraphText,
                            });
                          }}
                        >
                          {createCounterpointMutation.isPending ? "Submitting…" : "Submit"}
                        </Button>
                      </CardContent>
                    </Card>

                    <div className="space-y-2">
                      {(otherCounterpoints || []).length === 0 ? (
                        <p className="text-muted-foreground">No counterpoints yet.</p>
                      ) : (
                        (otherCounterpoints || []).map((cp: any) => (
                          <Card key={cp.id}>
                            <CardContent className="pt-4 space-y-3">
                              <CounterpointAuthor author={cp.author} />
                              {cp.paragraphText ? (
                                <div className="text-xs text-muted-foreground border-l-2 border-muted-foreground/20 pl-2 whitespace-pre-wrap">
                                  <span className="font-medium text-foreground/80">Paragraph: </span>
                                  {cp.paragraphText}
                                </div>
                              ) : null}
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
                name="stance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Stance</FormLabel>
                    <FormControl>
                      <ToggleGroup
                        type="single"
                        value={field.value ?? ""}
                        onValueChange={(v) => { if (v) field.onChange(v); }}
                        className="grid grid-cols-3 gap-2"
                        data-testid="picker-stance"
                      >
                        <ToggleGroupItem value="for" variant="outline" className="data-[state=on]:bg-stance-for data-[state=on]:text-primary-foreground" data-testid="option-stance-for">For</ToggleGroupItem>
                        <ToggleGroupItem value="against" variant="outline" className="data-[state=on]:bg-stance-against data-[state=on]:text-primary-foreground" data-testid="option-stance-against">Against</ToggleGroupItem>
                        <ToggleGroupItem value="neutral" variant="outline" className="data-[state=on]:bg-stance-neutral data-[state=on]:text-primary-foreground" data-testid="option-stance-neutral">Neutral</ToggleGroupItem>
                      </ToggleGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
