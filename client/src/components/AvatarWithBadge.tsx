import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import * as LucideIcons from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface AvatarWithBadgeProps {
  userId: string;
  profileImageUrl?: string;
  firstName?: string;
  lastName?: string;
  className?: string;
  showBadge?: boolean;
}

export function AvatarWithBadge({
  userId,
  profileImageUrl,
  firstName,
  lastName,
  className = "h-10 w-10",
  showBadge = true,
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

  return (
    <div className="relative inline-block" data-testid={`avatar-with-badge-${userId}`}>
      <Avatar className={className}>
        <AvatarImage src={profileImageUrl} />
        <AvatarFallback>
          {firstName?.charAt(0)}{lastName?.charAt(0)}
        </AvatarFallback>
      </Avatar>
      
      {showBadge && selectedBadge && (
        <div 
          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center border-2 border-background"
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
