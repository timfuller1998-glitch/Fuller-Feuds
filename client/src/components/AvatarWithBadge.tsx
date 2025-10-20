import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import * as LucideIcons from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface AvatarWithBadgeProps {
  userId: string;
  profileImageUrl?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  showBadge?: boolean;
  showOnlineStatus?: boolean;
  isOnline?: boolean;
  politicalLeaningScore?: number;
  showPoliticalLeaning?: boolean;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-12 w-12",
  lg: "h-16 w-16"
};

const textSizeClasses = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base"
};

const ringWidthClasses = {
  sm: "border-2",
  md: "border-[3px]",
  lg: "border-4"
};

// Helper function to determine color from political leaning score
const getPoliticalLeaningColorFromScore = (score: number) => {
  if (score < -50) return '#3b82f6'; // Very Progressive - blue
  if (score < -20) return '#3b82f6'; // Progressive - blue
  if (score <= 20) return '#a855f7'; // Moderate - purple
  if (score <= 50) return '#ef4444'; // Conservative - red
  return '#ef4444'; // Very Conservative - red
};

export function AvatarWithBadge({
  userId,
  profileImageUrl,
  firstName,
  lastName,
  name,
  size = "md",
  className,
  showBadge = true,
  showOnlineStatus = false,
  isOnline = false,
  politicalLeaningScore,
  showPoliticalLeaning = true,
}: AvatarWithBadgeProps) {
  // Fetch user's selected badge
  const { data: userBadges = [] } = useQuery<any[]>({
    queryKey: ['/api/users', userId, 'badges'],
    queryFn: () => fetch(`/api/users/${userId}/badges`, { credentials: 'include' }).then(res => res.json()),
    enabled: showBadge && !!userId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const selectedBadge = userBadges.find((b: any) => b.isSelected);

  const getBadgeIcon = (iconName: string) => {
    // Dynamically resolve icon from lucide-react
    const IconComponent = (LucideIcons as any)[iconName];
    return IconComponent || LucideIcons.Trophy;
  };

  // Determine display name
  const displayName = name || `${firstName || ''} ${lastName || ''}`.trim();
  const initials = displayName
    .split(" ")
    .map(word => word[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  // Use size classes if no custom className provided
  const avatarClassName = className || sizeClasses[size];

  return (
    <div className="relative inline-block" data-testid={`avatar-with-badge-${userId}`}>
      <Avatar className={avatarClassName}>
        <AvatarImage src={profileImageUrl} alt={displayName} />
        <AvatarFallback className={textSizeClasses[size]}>
          {initials}
        </AvatarFallback>
      </Avatar>
      
      {/* Political Leaning Ring */}
      {showPoliticalLeaning && politicalLeaningScore !== undefined && (
        <div 
          className={`absolute inset-0 rounded-full pointer-events-none ${ringWidthClasses[size]}`}
          style={{ 
            borderColor: getPoliticalLeaningColorFromScore(politicalLeaningScore),
          }}
          data-testid="political-leaning-ring"
        />
      )}
      
      {showOnlineStatus && (
        <div className="absolute -bottom-0.5 -right-0.5 z-10">
          <div className={`w-3 h-3 rounded-full border-2 border-background ${
            isOnline ? 'bg-chart-1' : 'bg-muted'
          }`} />
        </div>
      )}
      
      {showBadge && selectedBadge && (
        <div 
          className={`absolute w-5 h-5 rounded-full bg-primary flex items-center justify-center border-2 border-background ${
            showOnlineStatus ? '-top-1 -right-1' : '-bottom-1 -right-1'
          }`}
          data-testid={`badge-overlay-${userId}`}
          title={selectedBadge.name}
        >
          {(() => {
            const IconComponent = getBadgeIcon(selectedBadge.icon);
            return <IconComponent className="w-3 h-3 text-primary-foreground" />;
          })()}
        </div>
      )}
    </div>
  );
}
