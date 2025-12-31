import { useState, useEffect, useRef } from "react";
import { animate } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Users, Sparkles, Activity, Flag, Plus, ArrowRight, Loader2, Heart, Skull, Flame, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getTopicCornerGlow } from "@/lib/politicalColors";
import { insertOpinionSchema, type Opinion } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import FallacyFlagDialog from "@/components/FallacyFlagDialog";
import { LoginPromptDialog } from "@/components/LoginPromptDialog";
import type { FallacyType } from "@shared/fallacies";

const opinionFormSchema = insertOpinionSchema.omit({
  topicId: true,
  userId: true,
}).extend({
  content: z.string().min(1, "Opinion is required").max(2000, "Opinion too long"),
  debateStatus: z.enum(["open", "closed", "private"], { required_error: "Please select debate availability" }),
  references: z.array(z.string().url("Must be a valid URL")).optional().default([]),
});

interface TopicCardProps {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  categories: string[];
  participantCount: number;
  opinionsCount: number;
  isActive: boolean;
  previewContent?: string;
  previewAuthor?: string;
  previewIsAI?: boolean;
  diversityScore?: number;
  avgTasteScore?: number;
  avgPassionScore?: number;
  politicalDistribution?: {
    authoritarianCapitalist: number;
    authoritarianSocialist: number;
    libertarianCapitalist: number;
    libertarianSocialist: number;
  };
  onFlipChange?: (isFlipped: boolean) => void;
  onBackTimeUpdate?: (timeMs: number) => void;
  showSwipeOverlay?: 'like' | 'dislike' | 'opinion' | null;
  overlayOpacity?: number;
  triggerOpinionForm?: number; // Timestamp to trigger opinion form opening
}

export default function TopicCard({
  id,
  title,
  description,
  imageUrl,
  categories = [],
  participantCount,
  opinionsCount,
  isActive,
  previewContent,
  previewAuthor,
  previewIsAI,
  diversityScore,
  avgTasteScore,
  avgPassionScore,
  politicalDistribution,
  onFlipChange,
  onBackTimeUpdate,
  showSwipeOverlay,
  overlayOpacity = 0,
  triggerOpinionForm,
}: TopicCardProps) {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [isFlipped, setIsFlipped] = useState(false);
  const [showOpinionForm, setShowOpinionForm] = useState(false);
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [loginAction, setLoginAction] = useState<"like" | "opinion" | "debate" | "interact">("interact");
  const [timeOnBack, setTimeOnBack] = useState(0);
  const [currentOpinionIndex, setCurrentOpinionIndex] = useState(0);
  const backSideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Get glow style based on political distribution
  const glowStyle = politicalDistribution && opinionsCount > 0
    ? getTopicCornerGlow(politicalDistribution)
    : {};

  // Fetch AI summary when card is flipped
  const { data: cumulativeData, isLoading: summaryLoading } = useQuery<{ summary: string }>({
    queryKey: ["/api/topics", id, "cumulative"],
    queryFn: async () => {
      const response = await fetch(`/api/topics/${id}/cumulative`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error("Failed to fetch cumulative opinion");
      }
      return response.json();
    },
    enabled: isFlipped && !!id,
  });

  // Fetch top-rated opinions for preview
  const { data: topOpinions } = useQuery<Opinion[]>({
    queryKey: ["/api/topics", id, "opinions", "preview"],
    queryFn: async () => {
      const response = await fetch(`/api/topics/${id}/opinions`);
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error("Failed to fetch opinions");
      }
      const opinions = await response.json();
      // Sort by likesCount and take top 3
      return opinions
        .sort((a: Opinion, b: Opinion) => (b.likesCount || 0) - (a.likesCount || 0))
        .slice(0, 3);
    },
    enabled: !!id && isActive,
  });

  // Opinion form
  const opinionForm = useForm<z.infer<typeof opinionFormSchema>>({
    resolver: zodResolver(opinionFormSchema),
    defaultValues: {
      content: "",
      debateStatus: "open",
      references: [],
    },
  });

  // Create opinion mutation
  const createOpinionMutation = useMutation({
    mutationFn: async (data: z.infer<typeof opinionFormSchema>) => {
      return apiRequest('POST', `/api/topics/${id}/opinions`, data);
    },
    onSuccess: () => {
      toast({
        title: "Opinion shared",
        description: "Your opinion has been successfully posted.",
      });
      opinionForm.reset();
      setShowOpinionForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/topics", id, "opinions"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to share opinion",
        variant: "destructive",
      });
    },
  });

  // Flag mutation
  const flagMutation = useMutation({
    mutationFn: async (fallacyType: FallacyType) => {
      return apiRequest('POST', `/api/topics/${id}/flag`, { fallacyType });
    },
    onSuccess: () => {
      toast({
        title: "Flag submitted",
        description: "Thank you for helping keep debates productive.",
      });
      setShowFlagDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit flag",
        variant: "destructive",
      });
    },
  });

  const handleFlip = (e: React.MouseEvent) => {
    // Only flip if clicking on the main content area, not on interactive buttons
    if ((e.target as HTMLElement).closest('button, [role="button"]')) {
      return;
    }
    const newFlipped = !isFlipped;
    setIsFlipped(newFlipped);
    onFlipChange?.(newFlipped);
  };

  // Timer to track time spent on back side
  useEffect(() => {
    if (isFlipped) {
      const startTime = Date.now();
      backSideTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        setTimeOnBack(elapsed);
        onBackTimeUpdate?.(elapsed);
        
        // Trigger "jump up" animation after 3 seconds
        if (elapsed > 3000 && cardRef.current) {
          animate(cardRef.current, { y: [0, -15, 0] }, { duration: 0.4, ease: "easeOut" });
        }
      }, 100);
    } else {
      if (backSideTimerRef.current) {
        clearInterval(backSideTimerRef.current);
        backSideTimerRef.current = null;
      }
      setTimeOnBack(0);
    }

    return () => {
      if (backSideTimerRef.current) {
        clearInterval(backSideTimerRef.current);
      }
    };
  }, [isFlipped, onBackTimeUpdate]);

  // Trigger opinion form when triggerOpinionForm prop changes
  useEffect(() => {
    if (triggerOpinionForm && triggerOpinionForm > 0) {
      if (!isAuthenticated) {
        setLoginAction("opinion");
        setShowLoginPrompt(true);
      } else {
        setShowOpinionForm(true);
      }
    }
  }, [triggerOpinionForm, isAuthenticated]);

  // Reset opinion index when topOpinions change
  useEffect(() => {
    if (topOpinions && topOpinions.length > 0) {
      setCurrentOpinionIndex(0);
    }
  }, [topOpinions]);

  const handleAddOpinion = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      setLoginAction("opinion");
      setShowLoginPrompt(true);
      return;
    }
    setShowOpinionForm(true);
  };

  const handleFlag = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      setLoginAction("interact");
      setShowLoginPrompt(true);
      return;
    }
    setShowFlagDialog(true);
  };

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocation(`/topic/${id}`);
  };

  const handlePrevOpinion = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (topOpinions && topOpinions.length > 0) {
      setCurrentOpinionIndex((prev) => 
        prev === 0 ? topOpinions.length - 1 : prev - 1
      );
    }
  };

  const handleNextOpinion = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (topOpinions && topOpinions.length > 0) {
      setCurrentOpinionIndex((prev) => 
        prev === topOpinions.length - 1 ? 0 : prev + 1
      );
    }
  };

  const onSubmitOpinion = (data: z.infer<typeof opinionFormSchema>) => {
    createOpinionMutation.mutate(data);
  };

  const handleFlagSubmit = (fallacyType: FallacyType) => {
    flagMutation.mutate(fallacyType);
  };

  // Interactive elements component (used on both sides)
  const InteractiveElements = () => (
    <div className="flex items-center justify-between gap-2 pt-3 border-t mt-auto">
      <div className="flex items-center gap-3 text-xs sm:text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4" />
          <span data-testid={`text-opinions-count-${id}`}>{opinionsCount}</span>
        </div>
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3 sm:w-4 sm:h-4" />
          <span data-testid={`text-participants-count-${id}`}>{participantCount}</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleAddOpinion}
          className="h-7 px-2"
          data-testid={`button-add-opinion-${id}`}
        >
          <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleFlag}
          className="h-7 px-2"
          data-testid={`button-flag-${id}`}
        >
          <Flag className="w-3 h-3 sm:w-4 sm:h-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleNavigate}
          className="h-7 px-2"
          data-testid={`button-navigate-${id}`}
        >
          <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <div
        ref={cardRef}
        className="relative w-full h-full"
        style={{ perspective: "1000px", ...glowStyle }}
        data-testid={`card-topic-${id}`}
      >
        {/* Swipe overlays */}
        {showSwipeOverlay === 'like' && (
          <div
            className="absolute inset-0 bg-green-500/30 rounded-lg z-50 pointer-events-none"
            style={{ opacity: overlayOpacity }}
          />
        )}
        {showSwipeOverlay === 'dislike' && (
          <div
            className="absolute inset-0 bg-red-500/30 rounded-lg z-50 pointer-events-none"
            style={{ opacity: overlayOpacity }}
          />
        )}
        {showSwipeOverlay === 'opinion' && (
          <div
            className="absolute inset-0 bg-purple-500/30 rounded-lg z-50 pointer-events-none"
            style={{ opacity: overlayOpacity }}
          />
        )}
        
        <Card
          className="hover-elevate active-elevate-2 overflow-hidden cursor-pointer relative w-full h-full"
          onClick={handleFlip}
        >
          <div
            className="relative w-full h-full"
            style={{
              transformStyle: "preserve-3d",
              transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
              transition: "transform 0.6s ease-in-out",
            }}
          >
            {/* Front Side */}
            <div 
              className="absolute inset-0 p-3 sm:p-4 md:p-6 flex flex-col h-full [backface-visibility:hidden] [-webkit-backface-visibility:hidden]"
            >
            {/* Categories and Diversity Badge */}
            <div className="absolute top-2 left-2 flex gap-1 flex-wrap z-20 pointer-events-auto">
              {categories?.slice(0, 2).map((category) => (
                <Badge
                  key={category}
                  variant="secondary"
                  className="bg-background/80 backdrop-blur-sm cursor-pointer hover-elevate"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLocation(`/category/${encodeURIComponent(category)}`);
                  }}
                  data-testid={`badge-category-${category.toLowerCase()}`}
                >
                  {category}
                </Badge>
              ))}
              {categories && categories.length > 2 && (
                <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                  +{categories.length - 2}
                </Badge>
              )}
            </div>

            <div className="absolute top-2 right-2 flex gap-1 z-20 pointer-events-auto">
              {diversityScore !== undefined && (
                <Badge className="bg-purple-500/90 text-white backdrop-blur-sm" data-testid={`badge-diversity-${id}`}>
                  <Activity className="w-3 h-3 mr-1" />
                  {diversityScore}%
                </Badge>
              )}
              {/* Taste indicator */}
              {avgTasteScore !== undefined && Math.abs(avgTasteScore) > 30 && (
                <Badge 
                  className={`backdrop-blur-sm ${
                    avgTasteScore > 0 
                      ? 'bg-pink-500/90 text-white' 
                      : 'bg-gray-700/90 text-white'
                  }`}
                  style={{ opacity: Math.min(1, Math.abs(avgTasteScore) / 100) }}
                >
                  {avgTasteScore > 0 ? (
                    <Heart className="w-3 h-3 mr-1" />
                  ) : (
                    <Skull className="w-3 h-3 mr-1" />
                  )}
                  {Math.abs(avgTasteScore) > 30 && (
                    <span>{avgTasteScore > 0 ? 'Delight' : 'Revulsion'}</span>
                  )}
                </Badge>
              )}
              {/* Passion indicator */}
              {avgPassionScore !== undefined && Math.abs(avgPassionScore) > 30 && (
                <Badge 
                  className={`backdrop-blur-sm ${
                    avgPassionScore > 0 
                      ? 'bg-orange-500/90 text-white' 
                      : 'bg-blue-500/90 text-white'
                  }`}
                  style={{ opacity: Math.min(1, Math.abs(avgPassionScore) / 100) }}
                >
                  {avgPassionScore > 0 ? (
                    <Flame className="w-3 h-3 mr-1" />
                  ) : (
                    <BookOpen className="w-3 h-3 mr-1" />
                  )}
                  {Math.abs(avgPassionScore) > 30 && (
                    <span>{avgPassionScore > 0 ? 'Aggressive' : 'Academic'}</span>
                  )}
                </Badge>
              )}
            </div>

            {/* Title - Positioned under category tags */}
            <div className="pt-8 px-4">
              <h3 className="font-semibold text-lg sm:text-xl leading-tight" data-testid={`text-topic-title-${id}`}>
                {title}
              </h3>
            </div>

            {/* Opinion Preview - Fills remaining space */}
            <div className="flex-1 flex flex-col min-h-0 px-4 pb-4">
              {topOpinions && topOpinions.length > 0 ? (
                <div className="flex-1 flex flex-col relative">
                  <div className="bg-muted/50 rounded-lg p-3 sm:p-4 text-left flex-1 flex flex-col min-h-0 relative">
                    {topOpinions.length > 1 && (
                      <button
                        onClick={handlePrevOpinion}
                        className="absolute left-1 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full bg-background/80 hover:bg-background border shadow-sm"
                        aria-label="Previous opinion"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    )}
                    
                    <div className="flex-1 flex flex-col px-6 min-h-0">
                      <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                        {topOpinions[currentOpinionIndex].author?.profileImageUrl && (
                          <img 
                            src={topOpinions[currentOpinionIndex].author.profileImageUrl} 
                            alt={topOpinions[currentOpinionIndex].author.firstName || "User"}
                            className="w-5 h-5 rounded-full"
                          />
                        )}
                        <span className="text-xs font-medium text-muted-foreground">
                          {topOpinions[currentOpinionIndex].author?.firstName || "Anonymous"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          • {(topOpinions[currentOpinionIndex].likesCount || 0)} likes
                        </span>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-sm sm:text-base leading-relaxed text-foreground/90 h-full overflow-y-auto">
                          {topOpinions[currentOpinionIndex].content}
                        </p>
                      </div>
                    </div>
                    
                    {topOpinions.length > 1 && (
                      <button
                        onClick={handleNextOpinion}
                        className="absolute right-1 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full bg-background/80 hover:bg-background border shadow-sm"
                        aria-label="Next opinion"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  {topOpinions.length > 1 && (
                    <div className="flex justify-center gap-1 mt-2 flex-shrink-0">
                      {topOpinions.map((_, index) => (
                        <button
                          key={index}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentOpinionIndex(index);
                          }}
                          className={`h-1.5 rounded-full transition-all ${
                            index === currentOpinionIndex 
                              ? 'w-6 bg-primary' 
                              : 'w-1.5 bg-muted-foreground/30'
                          }`}
                          aria-label={`Go to opinion ${index + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No opinions yet</p>
                </div>
              )}
            </div>

            <InteractiveElements />
          </div>

          {/* Back Side */}
          <div 
            className="absolute inset-0 p-3 sm:p-4 md:p-6 flex flex-col h-full [backface-visibility:hidden] [-webkit-backface-visibility:hidden]"
            style={{
              transform: "rotateY(180deg)",
            }}
          >
            {/* Categories and Diversity Badge */}
            <div className="absolute top-2 left-2 flex gap-1 flex-wrap z-20 pointer-events-auto">
              {categories?.slice(0, 2).map((category) => (
                <Badge
                  key={category}
                  variant="secondary"
                  className="bg-background/80 backdrop-blur-sm cursor-pointer hover-elevate"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLocation(`/category/${encodeURIComponent(category)}`);
                  }}
                  data-testid={`badge-category-back-${category.toLowerCase()}`}
                >
                  {category}
                </Badge>
              ))}
              {categories && categories.length > 2 && (
                <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                  +{categories.length - 2}
                </Badge>
              )}
            </div>

            <div className="absolute top-2 right-2 flex gap-1 z-20 pointer-events-auto">
              {diversityScore !== undefined && (
                <Badge className="bg-purple-500/90 text-white backdrop-blur-sm" data-testid={`badge-diversity-back-${id}`}>
                  <Activity className="w-3 h-3 mr-1" />
                  {diversityScore}%
                </Badge>
              )}
              {/* Taste indicator */}
              {avgTasteScore !== undefined && Math.abs(avgTasteScore) > 30 && (
                <Badge 
                  className={`backdrop-blur-sm ${
                    avgTasteScore > 0 
                      ? 'bg-pink-500/90 text-white' 
                      : 'bg-gray-700/90 text-white'
                  }`}
                  style={{ opacity: Math.min(1, Math.abs(avgTasteScore) / 100) }}
                >
                  {avgTasteScore > 0 ? (
                    <Heart className="w-3 h-3 mr-1" />
                  ) : (
                    <Skull className="w-3 h-3 mr-1" />
                  )}
                  {Math.abs(avgTasteScore) > 30 && (
                    <span>{avgTasteScore > 0 ? 'Delight' : 'Revulsion'}</span>
                  )}
                </Badge>
              )}
              {/* Passion indicator */}
              {avgPassionScore !== undefined && Math.abs(avgPassionScore) > 30 && (
                <Badge 
                  className={`backdrop-blur-sm ${
                    avgPassionScore > 0 
                      ? 'bg-orange-500/90 text-white' 
                      : 'bg-blue-500/90 text-white'
                  }`}
                  style={{ opacity: Math.min(1, Math.abs(avgPassionScore) / 100) }}
                >
                  {avgPassionScore > 0 ? (
                    <Flame className="w-3 h-3 mr-1" />
                  ) : (
                    <BookOpen className="w-3 h-3 mr-1" />
                  )}
                  {Math.abs(avgPassionScore) > 30 && (
                    <span>{avgPassionScore > 0 ? 'Aggressive' : 'Academic'}</span>
                  )}
                </Badge>
              )}
            </div>

            {/* Content Area - Centered in top 2/3rds */}
            <div className="flex-1 flex items-center justify-center overflow-hidden min-h-0" style={{ minHeight: "66%" }}>
              <div className="text-center px-4 w-full h-full flex flex-col justify-center min-h-0 max-h-full">
                {summaryLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : cumulativeData?.summary ? (
                  <div className="flex flex-col h-full justify-center min-h-0 max-h-full">
                    <div className="flex items-center justify-center gap-2 mb-2 flex-shrink-0 mt-8">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <h3 className="font-semibold text-sm">AI Summary</h3>
                    </div>
                    <div className="flex-1 min-h-0 overflow-hidden flex items-center">
                      <p className="text-sm leading-relaxed overflow-hidden w-full h-full" data-testid={`text-ai-summary-${id}`}>
                        {cumulativeData.summary}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col h-full justify-center min-h-0 max-h-full">
                    <div className="flex items-center justify-center gap-2 mb-2 flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-muted-foreground" />
                      <h3 className="font-semibold text-sm text-muted-foreground">Description</h3>
                    </div>
                    <div className="flex-1 min-h-0 overflow-hidden flex items-center">
                      <p className="text-sm leading-relaxed text-muted-foreground line-clamp-4 overflow-hidden w-full" data-testid={`text-description-${id}`}>
                        {description}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <InteractiveElements />
          </div>
          </div>
        </Card>
      </div>

      {/* Opinion Creation Dialog */}
      <Dialog open={showOpinionForm} onOpenChange={setShowOpinionForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Share Your Opinion</DialogTitle>
            <DialogDescription>
              Share your thoughts on this topic.
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
                        placeholder="Share your thoughts on this topic..."
                        className="min-h-[200px]"
                        {...field}
                        data-testid="textarea-opinion-content"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowOpinionForm(false)}
                  disabled={createOpinionMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createOpinionMutation.isPending}
                  data-testid="button-submit-opinion"
                >
                  {createOpinionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {createOpinionMutation.isPending ? 'Sharing...' : 'Share Opinion'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Flag Dialog */}
      <FallacyFlagDialog
        open={showFlagDialog}
        onOpenChange={setShowFlagDialog}
        onSubmit={handleFlagSubmit}
        isPending={flagMutation.isPending}
        entityType="topic"
      />

      {/* Login Prompt Dialog */}
      <LoginPromptDialog
        open={showLoginPrompt}
        onOpenChange={setShowLoginPrompt}
        action={loginAction}
      />
    </>
  );
}
