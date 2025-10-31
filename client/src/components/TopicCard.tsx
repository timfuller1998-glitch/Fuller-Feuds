import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Users, Sparkles, Activity } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getTopicCornerGradient } from "@/lib/politicalColors";

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
}: TopicCardProps) {
  const [, setLocation] = useLocation();

  // Fetch political distribution for this topic
  const { data: distribution } = useQuery<{
    authoritarianCapitalist: number;
    authoritarianSocialist: number;
    libertarianCapitalist: number;
    libertarianSocialist: number;
  }>({
    queryKey: ['/api/topics', id, 'political-distribution'],
    enabled: opinionsCount > 0, // Only fetch if there are opinions
  });

  // Get gradient style based on political distribution
  const gradientStyle = distribution && opinionsCount > 0
    ? getTopicCornerGradient(distribution)
    : { background: 'linear-gradient(135deg, hsl(var(--muted)) 0%, hsl(var(--muted) / 0.5) 100%)' };

  // Truncate preview content to fit card with ellipsis
  const truncateContent = (content: string, maxLength: number = 180) => {
    if (content.length <= maxLength) return content + '...';
    return content.substring(0, maxLength).trim() + '...';
  };

  return (
    <Card 
      className="hover-elevate active-elevate-2 overflow-hidden group cursor-pointer" 
      onClick={() => setLocation(`/topic/${id}`)}
      data-testid={`card-topic-${id}`}
    >
      {/* Political gradient section with preview content */}
      <div 
        className="relative p-4 sm:p-6 min-h-[180px] flex flex-col justify-between"
        style={gradientStyle}
      >
        <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
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

        {diversityScore !== undefined && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-purple-500/90 text-white backdrop-blur-sm" data-testid={`badge-diversity-${id}`}>
              <Activity className="w-3 h-3 mr-1" />
              {diversityScore}%
            </Badge>
          </div>
        )}

        {previewContent && (
          <div className="mt-8 space-y-2">
            <p className="text-sm leading-relaxed line-clamp-4" data-testid={`text-preview-content-${id}`}>
              {truncateContent(previewContent)}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {previewIsAI && <Sparkles className="w-3 h-3" />}
              <span data-testid={`text-preview-author-${id}`}>— {previewAuthor}</span>
            </div>
          </div>
        )}
      </div>
      
      <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
        <h3 className="font-semibold text-base sm:text-lg leading-tight" data-testid={`text-topic-title-${id}`}>
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
          {description}
        </p>
      </CardHeader>
      
      <CardContent className="pt-0 p-3 sm:p-6 sm:pt-0">
        <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4" />
            <span data-testid={`text-opinions-count-${id}`}>{opinionsCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3 sm:w-4 sm:h-4" />
            <span data-testid={`text-participants-count-${id}`}>{participantCount}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}