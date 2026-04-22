import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AvatarWithBadge } from "./AvatarWithBadge";
import FallacyBadges from "./FallacyBadges";
import { ThumbsUp, ThumbsDown, Clock, Link as LinkIcon, Maximize2 } from "lucide-react";
import { useMemo } from "react";
import { Link, useLocation } from "wouter";
import { getOpinionGradientStyle } from "@/lib/politicalColors";
import { useAuth } from "@/hooks/useAuth";

interface OpinionCardProps {
  id: string;
  topicId: string;
  userId?: string;
  /** Accepted for call-site compatibility; not displayed on the compact card. */
  stance?: "for" | "against" | "neutral" | null;
  userName: string;
  userAvatar?: string;
  politicalLeaningScore?: number;
  economicScore?: number;
  authoritarianScore?: number;
  topicEconomicScore?: number;
  topicAuthoritarianScore?: number;
  content: string;
  debateStatus?: "open" | "closed" | "private";
  onLike?: (id: string) => void;
  onDislike?: (id: string) => void;
  onAdopt?: (id: string) => void;
  onFlag?: (id: string) => void;
  timestamp: string;
  likesCount: number;
  dislikesCount: number;
  references?: string[];
  fallacyCounts?: Record<string, number>;
  isLiked?: boolean;
  isDisliked?: boolean;
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
  timestamp,
  likesCount,
  dislikesCount,
  references = [],
  fallacyCounts = {},
}: OpinionCardProps) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const topicOpinionHref = useMemo(() => {
    const sp = new URLSearchParams();
    if (userId && user?.id && userId === user.id) {
      sp.set("tab", "yours");
    } else {
      sp.set("tab", "others");
    }
    sp.set("opinion", id);
    return `/topic/${topicId}?${sp.toString()}`;
  }, [id, topicId, userId, user?.id]);

  const gradientStyle = getOpinionGradientStyle(topicEconomicScore, topicAuthoritarianScore);

  const goToTopicOpinion = () => {
    setLocation(topicOpinionHref);
  };

  // Truncate content for card preview
  const truncateContent = (text: string, maxLength: number = 120) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  return (
    <>
      <Card
        className="hover-elevate active-elevate-2 cursor-pointer h-full flex flex-col"
        onClick={goToTopicOpinion}
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
          <p className="text-sm leading-relaxed line-clamp-3 mb-3" data-testid={`text-opinion-content-${id}`}>
            {truncateContent(content, 150)}
          </p>

          {Object.keys(fallacyCounts).some((key) => fallacyCounts[key] > 0) && (
            <div className="mb-2">
              <FallacyBadges fallacyCounts={fallacyCounts} />
            </div>
          )}

          <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <ThumbsUp className="w-3 h-3" />
                <span>{likesCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <ThumbsDown className="w-3 h-3" />
                <span>{dislikesCount}</span>
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
              asChild
              onClick={(e) => e.stopPropagation()}
            >
              <Link href={topicOpinionHref} data-testid={`button-expand-${id}`}>
                <Maximize2 className="w-3 h-3" />
                View Full
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
