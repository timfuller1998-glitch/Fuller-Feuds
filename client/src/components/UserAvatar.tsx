import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

interface UserAvatarProps {
  name: string;
  imageUrl?: string;
  userId?: string;
  size?: "sm" | "md" | "lg";
  showOnlineStatus?: boolean;
  isOnline?: boolean;
  showBadge?: boolean;
  badgeText?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  clickable?: boolean;
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
  userId,
  size = "md",
  showOnlineStatus = false,
  isOnline = false,
  showBadge = false,
  badgeText,
  badgeVariant = "secondary",
  clickable = true,
  className = ""
}: UserAvatarProps) {
  const [, setLocation] = useLocation();
  
  const initials = name
    .split(" ")
    .map(word => word[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const handleClick = () => {
    if (clickable && userId) {
      setLocation(`/profile/${userId}`);
    }
  };

  return (
    <div className={`relative inline-flex flex-col items-center gap-2 ${className}`}>
      <div className="relative">
        <Avatar 
          className={`${sizeClasses[size]} border-2 border-background ${clickable && userId ? 'cursor-pointer hover:ring-2 hover:ring-primary/50 active:ring-primary transition-all' : ''}`}
          onClick={handleClick}
        >
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