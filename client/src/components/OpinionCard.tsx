import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import UserAvatar from "./UserAvatar";
import { ThumbsUp, ThumbsDown, MessageCircle, Clock } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

interface OpinionCardProps {
  id: string;
  userId?: string;
  userName: string;
  userAvatar?: string;
  content: string;
  stance: "for" | "against" | "neutral";
  timestamp: string;
  likesCount: number;
  dislikesCount: number;
  repliesCount: number;
  isLiked?: boolean;
  isDisliked?: boolean;
  onLike?: (id: string) => void;
  onDislike?: (id: string) => void;
  onReply?: (id: string) => void;
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
  userId,
  userName,
  userAvatar,
  content,
  stance,
  timestamp,
  likesCount,
  dislikesCount,
  repliesCount,
  isLiked = false,
  isDisliked = false,
  onLike,
  onDislike,
  onReply
}: OpinionCardProps) {
  const [liked, setLiked] = useState(isLiked);
  const [disliked, setDisliked] = useState(isDisliked);
  const [currentLikes, setCurrentLikes] = useState(likesCount);
  const [currentDislikes, setCurrentDislikes] = useState(dislikesCount);

  const handleLike = () => {
    if (liked) {
      setLiked(false);
      setCurrentLikes(prev => prev - 1);
    } else {
      setLiked(true);
      setCurrentLikes(prev => prev + 1);
      if (disliked) {
        setDisliked(false);
        setCurrentDislikes(prev => prev - 1);
      }
    }
    onLike?.(id);
    console.log('Like clicked for opinion:', id);
  };

  const handleDislike = () => {
    if (disliked) {
      setDisliked(false);
      setCurrentDislikes(prev => prev - 1);
    } else {
      setDisliked(true);
      setCurrentDislikes(prev => prev + 1);
      if (liked) {
        setLiked(false);
        setCurrentLikes(prev => prev - 1);
      }
    }
    onDislike?.(id);
    console.log('Dislike clicked for opinion:', id);
  };

  return (
    <Card className="hover-elevate" data-testid={`card-opinion-${id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          {userId ? (
            <Link href={`/profile/${userId}`} className="flex items-center gap-3 hover-elevate active-elevate-2 rounded-lg p-1 -m-1" data-testid={`link-profile-${userId}`}>
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
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant={liked ? "default" : "ghost"}
              size="sm"
              className="h-8 px-3"
              onClick={handleLike}
              data-testid={`button-like-${id}`}
            >
              <ThumbsUp className="w-3 h-3 mr-1" />
              {currentLikes}
            </Button>
            
            <Button
              variant={disliked ? "destructive" : "ghost"}
              size="sm"
              className="h-8 px-3"
              onClick={handleDislike}
              data-testid={`button-dislike-${id}`}
            >
              <ThumbsDown className="w-3 h-3 mr-1" />
              {currentDislikes}
            </Button>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3"
            onClick={() => {
              onReply?.(id);
              console.log('Reply clicked for opinion:', id);
            }}
            data-testid={`button-reply-${id}`}
          >
            <MessageCircle className="w-3 h-3 mr-1" />
            {repliesCount}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}