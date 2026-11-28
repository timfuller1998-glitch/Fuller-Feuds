import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getBadgeIcon } from "@/lib/badgeIcons";
import { get1DLeaningColor, get2DPoliticalCompassColor } from "@shared/politicalCompass";
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
  politicalLeaningScore?: number; // DEPRECATED: Legacy single-axis score
  economicScore?: number; // -100 (liberal) to +100 (conservative)
  authoritarianScore?: number; // -100 (libertarian) to +100 (authoritarian)
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
  economicScore,
  authoritarianScore,
  showPoliticalLeaning = true,
}: AvatarWithBadgeProps) {
  // Fetch user's selected badge
  const { data: userBadges = [] } = useQuery<any[]>({
    queryKey: ['/api/users', userId, 'badges'],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/badges`, { credentials: 'include' });
      const data = await res.json();
      // Handle both array response and object with badges property (backward compatibility)
      if (Array.isArray(data)) {
        return data;
      }
      if (data && typeof data === 'object' && 'badges' in data && Array.isArray(data.badges)) {
        return data.badges;
      }
      return [];
    },
    enabled: showBadge && !!userId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const selectedBadge = userBadges.find((b: any) => b.isSelected);

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
      {showPoliticalLeaning && (economicScore !== undefined && authoritarianScore !== undefined) && (
        <div 
          className={`absolute inset-0 rounded-full pointer-events-none ${ringWidthClasses[size]}`}
          style={{ 
            borderColor: get2DPoliticalCompassColor(economicScore, authoritarianScore, { vivid: true }),
          }}
          data-testid="political-leaning-ring"
        />
      )}
      {/* Legacy Political Leaning Ring (fallback) */}
      {showPoliticalLeaning && politicalLeaningScore !== undefined && economicScore === undefined && (
        <div 
          className={`absolute inset-0 rounded-full pointer-events-none ${ringWidthClasses[size]}`}
          style={{ 
            borderColor: get1DLeaningColor(politicalLeaningScore),
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
