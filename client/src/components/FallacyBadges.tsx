import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getFallacy, type FallacyType } from "@shared/fallacies";

interface FallacyCounts {
  [key: string]: number;
}

interface FallacyBadgesProps {
  fallacyCounts: FallacyCounts;
  className?: string;
}

export default function FallacyBadges({ fallacyCounts, className = "" }: FallacyBadgesProps) {
  // Filter out fallacies with 0 counts and sort by count descending
  const sortedFallacies = Object.entries(fallacyCounts)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  if (sortedFallacies.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className={`flex flex-wrap gap-1.5 ${className}`}>
        {sortedFallacies.map(([fallacyType, count]) => {
          const fallacy = getFallacy(fallacyType as FallacyType);
          
          return (
            <Tooltip key={fallacyType}>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline" 
                  className="gap-1 text-xs hover-elevate"
                  data-testid={`badge-fallacy-${fallacyType}`}
                >
                  <span>{fallacy.icon}</span>
                  <span>{count}</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <div className="font-semibold">{fallacy.name}</div>
                  <div className="text-xs">{fallacy.description}</div>
                  <div className="text-xs text-muted-foreground">
                    {count} user{count !== 1 ? 's' : ''} flagged this
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
