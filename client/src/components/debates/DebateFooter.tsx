import { useQuery } from '@tanstack/react-query';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Archive } from 'lucide-react';
import { useDebateContext } from '@/contexts/DebateContext';
import { get2DPoliticalCompassColor } from '@/lib/politicalColors';

interface GroupedDebate {
  opponentId: string;
  opponentName: string;
  opponentAvatar?: string | null;
  opponentEconomicScore?: number;
  opponentAuthoritarianScore?: number;
  debates: Array<{
    id: string;
    topicTitle: string;
    lastMessageAt?: string | null;
    unreadCount?: number;
  }>;
  totalUnread: number;
  mostRecentActivity?: string | null;
}

export function DebateFooter() {
  const { openPanel, openOpponentPanel, unreadCounts, totalUnread } = useDebateContext();

  const { data: groupedDebates = [] } = useQuery<GroupedDebate[]>({
    queryKey: ['/api/debates/grouped'],
  });

  // Filter to only show debates with activity in last 30 days
  const recentDebates = groupedDebates.filter(group => {
    if (!group.mostRecentActivity) return false;
    const activityDate = new Date(group.mostRecentActivity).getTime();
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    return activityDate >= thirtyDaysAgo;
  });

  // Get archived debates (older than 30 days)
  const archivedDebates = groupedDebates.filter(group => {
    if (!group.mostRecentActivity) return false;
    const activityDate = new Date(group.mostRecentActivity).getTime();
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    return activityDate < thirtyDaysAgo;
  });

  // Calculate total unread from grouped debates
  const footerUnread = recentDebates.reduce((sum, group) => sum + group.totalUnread, 0);

  // Determine what to show in the footer
  const hasRecentDebates = recentDebates.length > 0;
  const hasArchivedDebates = archivedDebates.length > 0;
  const hasNoDebates = groupedDebates.length === 0;

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-40"
      data-testid="debate-footer"
    >
      <div className="flex items-center gap-2 px-4 py-2 max-w-screen-2xl mx-auto">
        {/* Show different content based on debate state */}
        {hasRecentDebates ? (
          <>
            {/* More Debates Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openPanel('all-debates')}
              className="shrink-0"
              data-testid="button-more-debates"
            >
              <MessageSquare className="w-4 h-4 mr-1" />
              More
            </Button>

            {/* Avatar Row - Scrollable */}
            <div 
              className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin"
              style={{ scrollbarWidth: 'thin' }}
            >
              <div className="flex gap-3 py-1">
                {recentDebates.map((group) => {
                  const hasUnread = group.totalUnread > 0;
                  const avatarColor = get2DPoliticalCompassColor(
                    group.opponentEconomicScore || 0,
                    group.opponentAuthoritarianScore || 0
                  );

                  return (
                    <button
                      key={group.opponentId}
                      onClick={() => openOpponentPanel(group.opponentId, group.opponentName)}
                      className="relative shrink-0 group"
                      data-testid={`avatar-opponent-${group.opponentId}`}
                    >
                      {/* Avatar with pulse animation on unread */}
                      <div className={`relative ${hasUnread ? 'animate-pulse-subtle' : ''}`}>
                        <Avatar 
                          className="w-12 h-12 border-2 transition-all"
                          style={{ 
                            borderColor: hasUnread ? avatarColor : 'transparent',
                            boxShadow: hasUnread ? `0 0 8px ${avatarColor}50` : 'none'
                          }}
                        >
                          <AvatarImage src={group.opponentAvatar || undefined} />
                          <AvatarFallback 
                            className="text-xs"
                            style={{ 
                              background: avatarColor,
                              color: 'white'
                            }}
                          >
                            {group.opponentName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        {/* Unread Badge */}
                        {hasUnread && (
                          <Badge 
                            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-destructive text-destructive-foreground border-2 border-card"
                            data-testid={`badge-unread-${group.opponentId}`}
                          >
                            {group.totalUnread > 9 ? '9+' : group.totalUnread}
                          </Badge>
                        )}
                      </div>
                      
                      {/* Name tooltip on hover */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        {group.opponentName}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Archived Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openPanel('archived')}
              className="shrink-0"
              data-testid="button-archived-debates"
            >
              <Archive className="w-4 h-4 mr-1" />
              Archived
            </Button>
          </>
        ) : hasArchivedDebates ? (
          <>
            {/* Only archived debates - show welcoming message with archived button */}
            <div className="flex-1 flex items-center justify-center gap-3 text-sm text-muted-foreground">
              <MessageSquare className="w-4 h-4" />
              <span>No active debates right now</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openPanel('archived')}
              className="shrink-0"
              data-testid="button-archived-debates"
            >
              <Archive className="w-4 h-4 mr-1" />
              View Archived ({archivedDebates.length})
            </Button>
          </>
        ) : (
          <>
            {/* No debates at all - show welcome message */}
            <div className="flex-1 flex items-center justify-center gap-2 text-sm text-muted-foreground py-1">
              <MessageSquare className="w-4 h-4 flex-shrink-0" />
              <span className="text-center">
                Start your first debate! Our community values respectful, thoughtful discussions.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
