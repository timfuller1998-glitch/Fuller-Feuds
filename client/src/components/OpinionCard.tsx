import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import UserAvatar from "./UserAvatar";
import { ThumbsUp, ThumbsDown, UserPlus, Clock, AlertTriangle, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

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
  challengesCount: number;
  isLiked?: boolean;
  isDisliked?: boolean;
  onLike?: (id: string) => void;
  onDislike?: (id: string) => void;
  onAdopt?: (id: string) => void;
  onChallenge?: (id: string) => void;
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
  challengesCount,
  isLiked = false,
  isDisliked = false,
  onLike,
  onDislike,
  onAdopt,
  onChallenge
}: OpinionCardProps) {
  const [, setLocation] = useLocation();
  const [showChallenges, setShowChallenges] = useState(false);

  // Fetch challenges when expanded
  const { data: challenges } = useQuery<any[]>({
    queryKey: ["/api/opinions", id, "challenges"],
    enabled: showChallenges && challengesCount > 0,
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
                onChallenge?.(id);
              }}
              data-testid={`button-challenge-${id}`}
            >
              <AlertTriangle className="w-3 h-3 mr-1" />
              {challengesCount > 0 && challengesCount}
            </Button>
            
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
          </div>
        </div>

        {/* Challenges Section */}
        {challengesCount > 0 && (
          <Collapsible open={showChallenges} onOpenChange={setShowChallenges} className="mt-4">
            <CollapsibleTrigger 
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover-elevate active-elevate-2 rounded p-2 w-full"
              onClick={(e) => e.stopPropagation()}
              data-testid={`button-toggle-challenges-${id}`}
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${showChallenges ? 'rotate-180' : ''}`} />
              <AlertTriangle className="w-4 h-4" />
              <span>{challengesCount} Challenge{challengesCount !== 1 ? 's' : ''}</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
              {challenges?.map((challenge) => (
                <div 
                  key={challenge.id} 
                  className="border rounded-lg p-3 bg-muted/30"
                  data-testid={`challenge-${challenge.id}`}
                >
                  <div className="flex items-start gap-3">
                    {challenge.user && (
                      <UserAvatar 
                        name={`${challenge.user.firstName || ''} ${challenge.user.lastName || ''}`.trim() || 'Anonymous'} 
                        imageUrl={challenge.user.profileImageUrl} 
                        size="sm" 
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          {challenge.user ? `${challenge.user.firstName || ''} ${challenge.user.lastName || ''}`.trim() || 'Anonymous' : 'Anonymous'}
                        </span>
                        {challenge.createdAt && (
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(challenge.createdAt), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{challenge.context}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}