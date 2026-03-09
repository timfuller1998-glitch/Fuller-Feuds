import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AvatarWithBadge } from "./AvatarWithBadge";
import FallacyBadges from "./FallacyBadges";
import FallacyFlagDialog from "./FallacyFlagDialog";
import { LoginPromptDialog } from "./LoginPromptDialog";
import { ThumbsUp, ThumbsDown, UserPlus, Clock, Flag, Link as LinkIcon, ExternalLink, MessageCircle, Maximize2 } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { getOpinionGradientStyle } from "@/lib/politicalColors";
import type { FallacyType } from "@shared/fallacies";

interface OpinionCardProps {
  id: string;
  topicId: string;
  userId?: string;
  userName: string;
  userAvatar?: string;
  politicalLeaningScore?: number;
  economicScore?: number;
  authoritarianScore?: number;
  topicEconomicScore?: number;
  topicAuthoritarianScore?: number;
  content: string;
  debateStatus?: "open" | "closed" | "private";
  timestamp: string;
  likesCount: number;
  dislikesCount: number;
  references?: string[];
  fallacyCounts?: Record<string, number>;
  isLiked?: boolean;
  isDisliked?: boolean;
  onLike?: (id: string) => void;
  onDislike?: (id: string) => void;
  onAdopt?: (id: string) => void;
  onFlag?: (id: string) => void;
  onDebate?: (id: string) => void;
  onRandomMatch?: () => void;
  isRandomMatchPending?: boolean;
}

export default function OpinionCard({
  id,
  topicId,
  userId,
  userName,
  userAvatar,
  politicalLeaningScore,
  economicScore,
  authoritarianScore,
  topicEconomicScore,
  topicAuthoritarianScore,
  content,
  debateStatus = "open",
  timestamp,
  likesCount,
  dislikesCount,
  references = [],
  fallacyCounts = {},
  isLiked = false,
  isDisliked = false,
  onLike,
  onDislike,
  onAdopt,
  onFlag,
  onDebate,
  onRandomMatch,
  isRandomMatchPending = false
}: OpinionCardProps) {
  const [, setLocation] = useLocation();
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [loginAction, setLoginAction] = useState<"like" | "opinion" | "debate" | "interact">("interact");
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  // Get political gradient style for this opinion
  const gradientStyle = getOpinionGradientStyle(topicEconomicScore, topicAuthoritarianScore);

  // Flag mutation
  const flagMutation = useMutation({
    mutationFn: async (fallacyType: FallacyType) => {
      const response = await fetch(`/api/opinions/${id}/flag`, {
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
      setShowFlagDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/topics", topicId, "opinions"] });
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

  const liked = isLiked;
  const disliked = isDisliked;
  const currentLikes = likesCount;
  const currentDislikes = dislikesCount;

  const handleLike = () => {
    if (!isAuthenticated) {
      setLoginAction("like");
      setShowLoginPrompt(true);
      return;
    }
    onLike?.(id);
  };

  const handleDislike = () => {
    if (!isAuthenticated) {
      setLoginAction("like");
      setShowLoginPrompt(true);
      return;
    }
    onDislike?.(id);
  };

  const handleFlag = () => {
    if (!isAuthenticated) {
      setLoginAction("interact");
      setShowLoginPrompt(true);
      return;
    }
    setShowFlagDialog(true);
  };
  
  const handleDebate = () => {
    if (!isAuthenticated) {
      setLoginAction("debate");
      setShowLoginPrompt(true);
      return;
    }
    onDebate?.(id);
    setShowDetailsDialog(false);
  };
  
  const handleRandomMatch = () => {
    if (!isAuthenticated) {
      setLoginAction("debate");
      setShowLoginPrompt(true);
      return;
    }
    onRandomMatch?.();
    setShowDetailsDialog(false);
  };
  
  const handleAdopt = () => {
    if (!isAuthenticated) {
      setLoginAction("opinion");
      setShowLoginPrompt(true);
      return;
    }
    onAdopt?.(id);
    setShowDetailsDialog(false);
  };

  // Truncate content for card preview
  const truncateContent = (text: string, maxLength: number = 120) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  return (
    <>
      {/* Compact Card with Preview */}
      <Card 
        className="hover-elevate active-elevate-2 cursor-pointer h-full flex flex-col" 
        onClick={() => setShowDetailsDialog(true)}
        data-testid={`card-opinion-${id}`}
        style={gradientStyle}
      >
        <CardHeader className="pb-3 flex-shrink-0">
          <div className="flex items-start justify-between gap-2">
            {userId ? (
              <Link 
                href={`/profile/${userId}`} 
                className="flex items-center gap-2 hover-elevate active-elevate-2 rounded-lg p-1 -m-1 min-w-0 flex-1" 
                onClick={(e) => e.stopPropagation()}
                data-testid={`link-profile-${userId}`}
              >
                <AvatarWithBadge 
                  userId={userId}
                  name={userName} 
                  profileImageUrl={userAvatar} 
                  size="sm"
                  politicalLeaningScore={politicalLeaningScore}
                  economicScore={economicScore}
                  authoritarianScore={authoritarianScore}
                  showPoliticalLeaning={true}
                />
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-sm truncate" data-testid={`text-opinion-author-${id}`}>
                    {userName}
                  </h4>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{timestamp}</span>
                  </div>
                </div>
              </Link>
            ) : (
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <AvatarWithBadge 
                  userId={userId || "unknown"}
                  name={userName} 
                  profileImageUrl={userAvatar} 
                  size="sm"
                  politicalLeaningScore={politicalLeaningScore}
                  economicScore={economicScore}
                  authoritarianScore={authoritarianScore}
                  showPoliticalLeaning={true}
                />
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-sm truncate" data-testid={`text-opinion-author-${id}`}>
                    {userName}
                  </h4>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{timestamp}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="pt-0 flex-1 flex flex-col min-h-0">
          {/* Truncated Content Preview */}
          <p className="text-sm leading-relaxed line-clamp-3 mb-3" data-testid={`text-opinion-content-${id}`}>
            {truncateContent(content, 150)}
          </p>

          {/* Display fallacy badges if any */}
          {Object.keys(fallacyCounts).some(key => fallacyCounts[key] > 0) && (
            <div className="mb-2">
              <FallacyBadges fallacyCounts={fallacyCounts} />
            </div>
          )}
          
          {/* Quick Stats */}
          <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <ThumbsUp className="w-3 h-3" />
                <span>{currentLikes}</span>
              </div>
              <div className="flex items-center gap-1">
                <ThumbsDown className="w-3 h-3" />
                <span>{currentDislikes}</span>
              </div>
              {references && references.length > 0 && (
                <div className="flex items-center gap-1">
                  <LinkIcon className="w-3 h-3" />
                  <span>{references.length}</span>
                </div>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2 text-xs gap-1"
              onClick={(e) => {
                e.stopPropagation();
                setShowDetailsDialog(true);
              }}
              data-testid={`button-expand-${id}`}
            >
              <Maximize2 className="w-3 h-3" />
              View Full
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Full Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0" onClick={(e) => e.stopPropagation()}>
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="sr-only">Opinion Details</DialogTitle>
            <div className="flex items-start justify-between gap-4">
              {userId ? (
                <Link 
                  href={`/profile/${userId}`} 
                  className="flex items-center gap-3 hover-elevate active-elevate-2 rounded-lg p-1 -m-1" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDetailsDialog(false);
                  }}
                  data-testid={`link-profile-dialog-${userId}`}
                >
                  <AvatarWithBadge 
                    userId={userId}
                    name={userName} 
                    profileImageUrl={userAvatar} 
                    size="md"
                    politicalLeaningScore={politicalLeaningScore}
                    economicScore={economicScore}
                    authoritarianScore={authoritarianScore}
                    showPoliticalLeaning={true}
                  />
                  <div>
                    <h4 className="font-medium" data-testid={`text-opinion-author-dialog-${id}`}>
                      {userName}
                    </h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{timestamp}</span>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="flex items-center gap-3">
                  <AvatarWithBadge 
                    userId={userId || "unknown"}
                    name={userName} 
                    profileImageUrl={userAvatar} 
                    size="md"
                    politicalLeaningScore={politicalLeaningScore}
                    economicScore={economicScore}
                    authoritarianScore={authoritarianScore}
                    showPoliticalLeaning={true}
                  />
                  <div>
                    <h4 className="font-medium" data-testid={`text-opinion-author-dialog-${id}`}>
                      {userName}
                    </h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{timestamp}</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-1 items-end flex-shrink-0">
                {debateStatus === "closed" && (
                  <Badge variant="secondary" className="text-xs">
                    Not Debatable
                  </Badge>
                )}
                {debateStatus === "private" && (
                  <Badge variant="outline" className="text-xs">
                    Private
                  </Badge>
                )}
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-200px)] px-6">
            <div className="space-y-4 pb-6">
              {/* Full Content */}
              <div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid={`text-opinion-content-dialog-${id}`}>
                  {content}
                </p>
              </div>

              {/* Display fallacy badges if any */}
              {Object.keys(fallacyCounts).some(key => fallacyCounts[key] > 0) && (
                <div>
                  <FallacyBadges fallacyCounts={fallacyCounts} />
                </div>
              )}

              {/* References Section */}
              {references && references.length > 0 && (
                <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                  <div className="flex items-center gap-2 mb-2">
                    <LinkIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Reference Links</span>
                  </div>
                  <div className="space-y-2">
                    {references.filter(ref => ref.trim()).map((ref, index) => (
                      <a
                        key={index}
                        href={ref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-primary hover:underline break-all"
                        data-testid={`link-reference-dialog-${index}`}
                      >
                        <ExternalLink className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span>{ref}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3 pt-2 border-t">
                {/* Vote Buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    variant={liked ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLike();
                    }}
                    data-testid={`button-like-dialog-${id}`}
                  >
                    <ThumbsUp className="w-4 h-4 mr-2" />
                    Like ({currentLikes})
                  </Button>
                  
                  <Button
                    variant={disliked ? "destructive" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDislike();
                    }}
                    data-testid={`button-dislike-dialog-${id}`}
                  >
                    <ThumbsDown className="w-4 h-4 mr-2" />
                    Dislike ({currentDislikes})
                  </Button>
                </div>

                {/* Action Buttons Row 2 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAdopt();
                    }}
                    data-testid={`button-adopt-dialog-${id}`}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Adopt This Opinion
                  </Button>

                  {onDebate && debateStatus === "open" && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDebate();
                      }}
                      data-testid={`button-debate-dialog-${id}`}
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Change My Mind
                    </Button>
                  )}

                  {onRandomMatch && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRandomMatch();
                      }}
                      disabled={isRandomMatchPending}
                      data-testid={`button-random-match-dialog-${id}`}
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      {isRandomMatchPending ? "Matching..." : "Find Random Debate"}
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFlag();
                    }}
                    data-testid={`button-flag-dialog-${id}`}
                  >
                    <Flag className="w-4 h-4 mr-2" />
                    Flag for Fallacy
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Fallacy Flag Dialog */}
      <FallacyFlagDialog
        open={showFlagDialog}
        onOpenChange={setShowFlagDialog}
        onSubmit={(fallacyType) => flagMutation.mutate(fallacyType)}
        isPending={flagMutation.isPending}
        entityType="opinion"
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
