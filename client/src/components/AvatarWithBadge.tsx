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
  politicalLeaningScore?: number; // DEPRECATED: Legacy single-axis score
  economicScore?: number; // -100 (socialist) to +100 (capitalist)
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

// Helper function to determine color from political leaning score (DEPRECATED)
const getPoliticalLeaningColorFromScore = (score: number) => {
  if (score < -50) return '#3b82f6'; // Very Progressive - blue
  if (score < -20) return '#3b82f6'; // Progressive - blue
  if (score <= 20) return '#a855f7'; // Moderate - purple
  if (score <= 50) return '#ef4444'; // Conservative - red
  return '#ef4444'; // Very Conservative - red
};

// Helper function to convert HSL to hex color
const hslToHex = (h: number, s: number, l: number): string => {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

// 2D political compass color blending function
const get2DPoliticalCompassColor = (economicScore: number, authoritarianScore: number): string => {
  // Normalize scores to -1 to 1 range for easier calculation
  const x = economicScore / 100;  // -1 (capitalist) to +1 (socialist)
  const y = authoritarianScore / 100;  // -1 (libertarian) to +1 (authoritarian)
  
  // Calculate distance from center (0,0) - used for intensity
  const distanceFromCenter = Math.sqrt(x * x + y * y);
  const intensity = Math.min(distanceFromCenter, 1); // 0 to 1
  
  // Base colors for each quadrant (Hue, Saturation, Lightness)
  // FLIPPED COLORS:
  // Red (authoritarian capitalist): H=0, x < 0, y > 0
  // Blue (authoritarian socialist): H=220, x > 0, y > 0
  // Green (libertarian capitalist): H=140, x < 0, y < 0
  // Yellow (libertarian socialist): H=50, x > 0, y < 0
  
  let hue: number;
  let saturation: number;
  let lightness: number;
  
  // Determine quadrant and base color
  if (x < 0 && y >= 0) {
    // Authoritarian Capitalist (Red) - top left
    hue = 0;
    saturation = 70 + (intensity * 25); // 70-95%
    lightness = 55;
  } else if (x >= 0 && y >= 0) {
    // Authoritarian Socialist (Blue) - top right
    hue = 220;
    saturation = 70 + (intensity * 25); // 70-95%
    lightness = 55;
  } else if (x < 0 && y < 0) {
    // Libertarian Capitalist (Green) - bottom left
    hue = 140;
    saturation = 65 + (intensity * 30); // 65-95%
    lightness = 50;
  } else {
    // Libertarian Socialist (Yellow) - bottom right
    hue = 50;
    saturation = 70 + (intensity * 25); // 70-95%
    lightness = 55;
  }
  
  // Blend colors more - only a little white in the center
  if (distanceFromCenter < 0.15) {
    // Very center - slight desaturation
    saturation = saturation * 0.6;
    lightness = 65;
  } else if (distanceFromCenter < 0.3) {
    // Near center - moderate blending
    saturation = saturation * 0.8;
    lightness = 60;
  } else {
    // Further from center - stronger colors
    lightness = 55 - (intensity * 10);
  }
  
  // Fade to black at extremes (±85 on both axes)
  const absX = Math.abs(x);
  const absY = Math.abs(y);
  if (absX >= 0.85 || absY >= 0.85) {
    // Calculate how far into the extreme zone (0.85 to 1.0)
    const maxAbsolute = Math.max(absX, absY);
    const extremeFactor = (maxAbsolute - 0.85) / 0.15; // 0 at 0.85, 1 at 1.0
    
    // Fade to black by reducing lightness dramatically
    lightness = lightness * (1 - extremeFactor * 0.7); // Reduce lightness up to 70%
    saturation = saturation * (1 - extremeFactor * 0.3); // Also reduce saturation a bit
  }
  
  return hslToHex(hue, saturation, lightness);
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
      {showPoliticalLeaning && (economicScore !== undefined && authoritarianScore !== undefined) && (
        <div 
          className={`absolute inset-0 rounded-full pointer-events-none ${ringWidthClasses[size]}`}
          style={{ 
            borderColor: get2DPoliticalCompassColor(economicScore, authoritarianScore),
          }}
          data-testid="political-leaning-ring"
        />
      )}
      {/* Legacy Political Leaning Ring (fallback) */}
      {showPoliticalLeaning && politicalLeaningScore !== undefined && economicScore === undefined && (
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
