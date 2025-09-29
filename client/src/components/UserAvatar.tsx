import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface UserAvatarProps {
  name: string;
  imageUrl?: string;
  size?: "sm" | "md" | "lg";
  showOnlineStatus?: boolean;
  isOnline?: boolean;
  showBadge?: boolean;
  badgeText?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
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

export default function UserAvatar({
  name,
  imageUrl,
  size = "md",
  showOnlineStatus = false,
  isOnline = false,
  showBadge = false,
  badgeText,
  badgeVariant = "secondary",
  className = ""
}: UserAvatarProps) {
  const initials = name
    .split(" ")
    .map(word => word[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className={`relative inline-flex flex-col items-center gap-2 ${className}`}>
      <div className="relative">
        <Avatar className={`${sizeClasses[size]} border-2 border-background`}>
          <AvatarImage src={imageUrl} alt={name} />
          <AvatarFallback className={textSizeClasses[size]}>
            {initials}
          </AvatarFallback>
        </Avatar>
        
        {showOnlineStatus && (
          <div className="absolute -bottom-0.5 -right-0.5">
            <div className={`w-3 h-3 rounded-full border-2 border-background ${
              isOnline ? 'bg-chart-1' : 'bg-muted'
            }`} />
          </div>
        )}
      </div>
      
      {showBadge && badgeText && (
        <Badge variant={badgeVariant} className="text-xs px-2 py-0.5">
          {badgeText}
        </Badge>
      )}
    </div>
  );
}