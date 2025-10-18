import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import UserAvatar from "./UserAvatar";
import FallacyBadges from "./FallacyBadges";
import FallacyFlagDialog from "./FallacyFlagDialog";
import { ThumbsUp, ThumbsDown, UserPlus, Clock, Flag, Link as LinkIcon, ExternalLink, ChevronDown, MessageCircle } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { FallacyType } from "@shared/fallacies";

interface OpinionCardProps {
  id: string;
  topicId: string;
  userId?: string;
  userName: string;
  userAvatar?: string;
  content: string;
  stance: "for" | "against" | "neutral";
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

const stanceBadgeVariant = {
  for: "default",
  against: "destructive", 
  neutral: "secondary"
} as const;

const stanceText = {
  for: "Supporting",
  against: "Opposing",
  neutral: "Neutral"
} as const;

export default function OpinionCard({
  id,
  topicId,
  userId,
  userName,
  userAvatar,
  content,
  stance,
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
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [showReferences, setShowReferences] = useState(false);
  const { toast } = useToast();

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
      // Invalidate queries to refetch with updated flag counts
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

  // Use props directly - no local state for vote counts
  const liked = isLiked;
  const disliked = isDisliked;
  const currentLikes = likesCount;
  const currentDislikes = dislikesCount;

  const handleLike = () => {
    onLike?.(id);
  };

  const handleDislike = () => {
    onDislike?.(id);
  };

  const handleFlag = () => {
    setShowFlagDialog(true);
  };

  return (
    <Card 
      className="hover-elevate active-elevate-2 cursor-pointer" 
      onClick={() => setLocation(`/topic/${topicId}`)}
      data-testid={`card-opinion-${id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          {userId ? (
            <Link 
              href={`/profile/${userId}`} 
              className="flex items-center gap-3 hover-elevate active-elevate-2 rounded-lg p-1 -m-1" 
              onClick={(e) => e.stopPropagation()}
              data-testid={`link-profile-${userId}`}
            >
              <UserAvatar name={userName} imageUrl={userAvatar} size="sm" />
              <div>
                <h4 className="font-medium" data-testid={`text-opinion-author-${id}`}>
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
              <UserAvatar name={userName} imageUrl={userAvatar} size="sm" />
              <div>
                <h4 className="font-medium" data-testid={`text-opinion-author-${id}`}>
                  {userName}
                </h4>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{timestamp}</span>
                </div>
              </div>
            </div>
          )}
          <Badge variant={stanceBadgeVariant[stance]}>
            {stanceText[stance]}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <p className="text-sm leading-relaxed mb-4" data-testid={`text-opinion-content-${id}`}>
          {content}
        </p>

        {/* Display fallacy badges if any */}
        {Object.keys(fallacyCounts).some(key => fallacyCounts[key] > 0) && (
          <div className="mb-3">
            <FallacyBadges fallacyCounts={fallacyCounts} />
          </div>
        )}
        
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant={liked ? "default" : "ghost"}
              size="sm"
              className="h-8 px-3"
              onClick={(e) => {
                e.stopPropagation();
                handleLike();
              }}
              data-testid={`button-like-${id}`}
            >
              <ThumbsUp className="w-3 h-3 mr-1" />
              {currentLikes}
            </Button>
            
            <Button
              variant={disliked ? "destructive" : "ghost"}
              size="sm"
              className="h-8 px-3"
              onClick={(e) => {
                e.stopPropagation();
                handleDislike();
              }}
              data-testid={`button-dislike-${id}`}
            >
              <ThumbsDown className="w-3 h-3 mr-1" />
              {currentDislikes}
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3"
              onClick={(e) => {
                e.stopPropagation();
                onAdopt?.(id);
              }}
              data-testid={`button-adopt-${id}`}
            >
              <UserPlus className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">Adopt</span>
            </Button>

            {onDebate && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3"
                onClick={(e) => {
                  e.stopPropagation();
                  onDebate(id);
                }}
                data-testid={`button-debate-${id}`}
              >
                <MessageCircle className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">Change My Mind</span>
              </Button>
            )}

            {onRandomMatch && (
              <Button
                variant="default"
                size="sm"
                className="h-8 px-3"
                onClick={(e) => {
                  e.stopPropagation();
                  onRandomMatch();
                }}
                disabled={isRandomMatchPending}
                data-testid={`button-random-match-${id}`}
              >
                <MessageCircle className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">
                  {isRandomMatchPending ? "Matching..." : "Find Random Debate"}
                </span>
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3"
              onClick={(e) => {
                e.stopPropagation();
                handleFlag();
              }}
              data-testid={`button-flag-${id}`}
            >
              <Flag className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">Flag</span>
            </Button>

            {/* Show references button if there are any */}
            {references && references.length > 0 && (
              <Button
                variant={showReferences ? "default" : "outline"}
                size="sm"
                className="h-8 px-3 gap-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReferences(!showReferences);
                }}
                data-testid={`button-show-references-${id}`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>References</span>
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {references.length}
                </Badge>
                <ChevronDown className={`w-3 h-3 ml-0.5 transition-transform ${showReferences ? 'rotate-180' : ''}`} />
              </Button>
            )}
          </div>
        </div>

        {/* References Section */}
        {showReferences && references && references.length > 0 && (
          <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border/50" onClick={(e) => e.stopPropagation()}>
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
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                  data-testid={`link-reference-${index}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{ref}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* Fallacy Flag Dialog */}
      <FallacyFlagDialog
        open={showFlagDialog}
        onOpenChange={setShowFlagDialog}
        onSubmit={(fallacyType) => flagMutation.mutate(fallacyType)}
        isPending={flagMutation.isPending}
        entityType="opinion"
      />
    </Card>
  );
}