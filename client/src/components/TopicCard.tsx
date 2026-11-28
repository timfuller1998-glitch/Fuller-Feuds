import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Activity, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getTopicCornerGlow } from "@/lib/politicalColors";
import { type Opinion } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { LoginPromptDialog } from "@/components/LoginPromptDialog";
import { OpinionComposerDialog } from "@/components/OpinionComposerDialog";
import { CARD_GESTURE_LOCK_PX, cardGestureJustHappened, markCardGesture } from "@/lib/cardGesture";

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
  diversityScore?: number | null;
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
  /** When this value changes, the card flips back to the front if currently flipped. */
  forceUnflipSignal?: number;
  /** With forceUnflipSignal: snap to the front with no flip animation (card is off-screen or covered). */
  instantUnflip?: boolean;
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
  politicalDistribution,
  onFlipChange,
  onBackTimeUpdate,
  forceUnflipSignal,
  instantUnflip,
}: TopicCardProps) {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [isFlipped, setIsFlipped] = useState(false);
  const [skipFlipTransition, setSkipFlipTransition] = useState(false);
  const [showOpinionForm, setShowOpinionForm] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [loginAction, setLoginAction] = useState<"like" | "opinion" | "debate" | "interact">("interact");
  const [timeOnBack, setTimeOnBack] = useState(0);
  const [currentOpinionIndex, setCurrentOpinionIndex] = useState(0);
  const backSideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const lastForceUnflipRef = useRef(0);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

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

  // All opinions on this topic (one request per card, as before). Same query key as the
  // topic page, so the cache is shared and saving an opinion refreshes both.
  const { data: allOpinions } = useQuery<Opinion[]>({
    queryKey: ["/api/topics", id, "opinions"],
    queryFn: async () => {
      const response = await fetch(`/api/topics/${id}/opinions`);
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error("Failed to fetch opinions");
      }
      return response.json();
    },
    enabled: !!id && isActive,
  });
  // Top 3 by likes for the preview carousel.
  const topOpinions = useMemo(
    () => allOpinions
      ? [...allOpinions].sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0)).slice(0, 3)
      : undefined,
    [allOpinions],
  );
  // The signed-in user's own opinion here, if any (same rule as the topic page).
  const myOpinion = isAuthenticated && user?.id ? allOpinions?.find((o) => o.userId === user.id) ?? null : null;

  const handleFlip = (e: React.MouseEvent) => {
    // Only flip if clicking on the main content area, not on interactive buttons/links.
    // A scroll or deck swipe must not count as a tap.
    if (cardGestureJustHappened()) return;
    if ((e.target as HTMLElement).closest('button, a, [role="button"], input, textarea, select')) {
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

  // Parent can snap the card back to the front once it's off-screen or covered (no visible flip).
  useEffect(() => {
    if (!forceUnflipSignal || forceUnflipSignal <= lastForceUnflipRef.current) return;
    lastForceUnflipRef.current = forceUnflipSignal;
    if (!isFlipped) return;
    // Always snap: this signal now only fires once the card is off-screen or covered.
    setSkipFlipTransition(true);
    setIsFlipped(false);
    onFlipChange?.(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setSkipFlipTransition(false));
    });
  }, [forceUnflipSignal, isFlipped, onFlipChange]);

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

  // Same split red bar on the front and back: open the topic, or add an opinion.
  const CardActionBar = () => (
    <div className="flex w-full flex-shrink-0 overflow-hidden rounded-md">
      <Button
        size="sm"
        className="h-auto min-h-9 min-w-0 flex-1 flex-col rounded-none rounded-l-md gap-0 px-1.5 py-1.5 text-center text-[0.65rem] leading-tight tracking-[0.06em] whitespace-normal sm:text-xs"
        onClick={handleNavigate}
        data-testid={`button-open-full-page-${id}`}
      >
        Open full page
      </Button>
      <div className="w-px shrink-0 self-stretch bg-primary-foreground/25" aria-hidden="true" />
      <Button
        size="sm"
        className="h-auto min-h-9 min-w-0 flex-1 flex-col rounded-none rounded-r-md gap-0 px-1.5 py-1.5 text-center text-[0.65rem] leading-tight tracking-[0.06em] whitespace-normal sm:text-xs"
        onClick={handleAddOpinion}
        data-testid={`button-add-opinion-${id}`}
      >
        {myOpinion ? "Update opinion" : "Add your opinion"}
      </Button>
    </div>
  );

  return (
    <>
      <div
        ref={cardRef}
        className="relative w-full h-full min-h-[20rem]"
        data-card-glow={glowStyle && Object.keys(glowStyle).length ? "true" : undefined}
        style={{ perspective: "1000px", ...glowStyle }}
        data-testid={`card-topic-${id}`}
        data-card-flipped={isFlipped ? "true" : "false"}
      >
        {/* Transform wrapper - handles the flip animation */}
        <div
          style={{
            transformStyle: "preserve-3d",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
            transition: skipFlipTransition ? "none" : "transform 0.6s ease-in-out",
            width: "100%",
            height: "100%",
          }}
        >
          <Card
            className="no-default-hover-elevate overflow-visible cursor-pointer relative w-full h-full bg-card"
            onPointerDown={(e) => { pointerStartRef.current = { x: e.clientX, y: e.clientY }; }}
            onPointerMove={(e) => {
              const s = pointerStartRef.current;
              if (!s) return;
              if (Math.hypot(e.clientX - s.x, e.clientY - s.y) >= CARD_GESTURE_LOCK_PX) markCardGesture();
            }}
            onPointerUp={() => { pointerStartRef.current = null; }}
            onPointerCancel={() => { pointerStartRef.current = null; }}
            onClick={handleFlip}
            style={{
              transformStyle: "preserve-3d",
            }}
          >
            {/* Front Side */}
            <div 
              className="absolute inset-0 p-3 sm:p-4 md:p-6 flex flex-col h-full"
              style={{
                transform: "rotateY(0deg)",
                transformStyle: "preserve-3d",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                opacity: isFlipped ? 0 : 1,
                pointerEvents: isFlipped ? "none" : "auto",
                transition: skipFlipTransition ? "none" : "opacity 0.6s ease-in-out",
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
                    setLocation(`/categories?focus=${encodeURIComponent(category)}`);
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

            <div className="absolute top-2 right-2 z-20 pointer-events-none max-w-[55%]">
              {diversityScore == null ? (
                <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm text-muted-foreground font-normal" data-testid={`badge-diversity-${id}`} title="Not enough opinions yet to measure political diversity">
                  <Activity className="w-3 h-3 mr-1" />
                  Not enough yet
                </Badge>
              ) : (
                <Badge className="bg-ai/90 text-primary-foreground backdrop-blur-sm" data-testid={`badge-diversity-${id}`} title={`Political diversity: ${diversityScore}%`}>
                  <Activity className="w-3 h-3 mr-1" />
                  {diversityScore}%
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
                <div className="flex-1 flex flex-col relative min-h-0">
                  <div className={`bg-muted/50 rounded-lg p-3 sm:p-4 text-left flex flex-col relative h-full ${topOpinions.length > 1 ? 'pb-10' : ''}`}>
                    {topOpinions.length > 1 && (
                      <button
                        onClick={handlePrevOpinion}
                        className="absolute left-1 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full bg-background/80 hover:bg-background border shadow-sm"
                        aria-label="Previous opinion"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    )}
                    
                    <div className="flex flex-col h-full min-h-0 px-6">
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
                      <div className="flex-1 overflow-hidden min-h-0">
                        <p className="text-sm sm:text-base leading-relaxed text-foreground/90 line-clamp-[20]">
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
                    <div className="absolute bottom-0 left-4 right-4 flex justify-center gap-1 pb-4">
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

            <div className="mt-auto pt-3 flex-shrink-0">
              <CardActionBar />
            </div>
          </div>

          {/* Back Side */}
          <div 
            className="absolute inset-0 p-3 sm:p-4 md:p-6 flex flex-col h-full"
            style={{
              transform: "rotateY(180deg)",
              transformStyle: "preserve-3d",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              opacity: isFlipped ? 1 : 0,
              pointerEvents: isFlipped ? "auto" : "none",
              transition: skipFlipTransition ? "none" : "opacity 0.6s ease-in-out",
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
                    setLocation(`/categories?focus=${encodeURIComponent(category)}`);
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

            <div className="absolute top-2 right-2 z-20 pointer-events-none max-w-[55%]">
              {diversityScore == null ? (
                <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm text-muted-foreground font-normal" data-testid={`badge-diversity-back-${id}`} title="Not enough opinions yet to measure political diversity">
                  <Activity className="w-3 h-3 mr-1" />
                  Not enough yet
                </Badge>
              ) : (
                <Badge className="bg-ai/90 text-primary-foreground backdrop-blur-sm" data-testid={`badge-diversity-back-${id}`} title={`Political diversity: ${diversityScore}%`}>
                  <Activity className="w-3 h-3 mr-1" />
                  {diversityScore}%
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
                  <div className="flex flex-col h-full justify-center min-h-0 max-h-full" style={{ transform: "matrix(1, 0, 0, 1, 0, 0)" }}>
                    <div className="flex items-center justify-center gap-2 mb-2 flex-shrink-0 mt-8">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <h3 className="font-semibold text-sm">The Fuller Picture</h3>
                    </div>
                    <div className="flex-1 min-h-0 overflow-hidden flex items-center">
                      <p className="text-sm leading-relaxed overflow-hidden w-full h-full" data-testid={`text-ai-summary-${id}`}>
                        {cumulativeData.summary}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col h-full justify-center min-h-0 max-h-full" style={{ transform: "matrix(1, 0, 0, 1, 0, 0)" }}>
                    <div className="flex items-center justify-center gap-2 mb-2 flex-shrink-0 mt-8">
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

            <div className="mt-auto pt-3 flex flex-col gap-2 flex-shrink-0">
              <div className="flex justify-center gap-3 sm:gap-4 text-xs text-muted-foreground">
                <span data-testid={`text-opinions-count-${id}`}>{opinionsCount} {opinionsCount === 1 ? "opinion" : "opinions"}</span>
                <span data-testid={`text-participants-count-${id}`}>{participantCount} {participantCount === 1 ? "participant" : "participants"}</span>
                {topOpinions && topOpinions.length > 0 && (
                  <span>Top: {topOpinions[0].likesCount || 0} likes</span>
                )}
              </div>
              <CardActionBar />
            </div>
          </div>
        </Card>
        </div>
      </div>

      {/* Opinion Creation Dialog */}
      <OpinionComposerDialog
        open={showOpinionForm}
        onOpenChange={setShowOpinionForm}
        topicId={id}
        topicTitle={title}
        existingOpinion={myOpinion}
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
