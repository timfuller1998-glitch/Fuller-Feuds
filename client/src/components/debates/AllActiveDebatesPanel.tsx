import { useQuery } from '@tanstack/react-query';
import { X, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDebateContext } from '@/contexts/DebateContext';
import { get2DPoliticalCompassColor } from '@/lib/politicalColors';
import { formatDistanceToNow } from 'date-fns';

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

export function AllActiveDebatesPanel() {
  const { activePanel, closePanel, openOpponentPanel } = useDebateContext();
  const isOpen = activePanel === 'all-debates';

  const { data: groupedDebates = [], isLoading } = useQuery<GroupedDebate[]>({
    queryKey: ['/api/debates/grouped'],
    enabled: isOpen,
  });

  // Split into Recent (activity in last 30 days) and Inactive (older)
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const recentDebates = groupedDebates.filter(group => {
    if (!group.mostRecentActivity) return false;
    return new Date(group.mostRecentActivity).getTime() >= thirtyDaysAgo;
  });

  const inactiveDebates = groupedDebates.filter(group => {
    if (!group.mostRecentActivity) return true;
    return new Date(group.mostRecentActivity).getTime() < thirtyDaysAgo;
  });

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
        onClick={closePanel}
        data-testid="overlay-all-debates"
      />
      
      {/* Panel */}
      <div 
        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card border-l shadow-xl z-50 flex flex-col animate-fade-in"
        data-testid="panel-all-debates"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">All Active Debates</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={closePanel}
            data-testid="button-close-panel"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading debates...
              </div>
            ) : (
              <>
                {/* Recent Section */}
                {recentDebates.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                      Recent ({recentDebates.length})
                    </h3>
                    <div className="space-y-2">
                      {recentDebates.map((group) => (
                        <OpponentDebateCard
                          key={group.opponentId}
                          group={group}
                          onClick={() => openOpponentPanel(group.opponentId, group.opponentName)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Inactive Section */}
                {inactiveDebates.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                      Inactive ({inactiveDebates.length})
                    </h3>
                    <div className="space-y-2">
                      {inactiveDebates.map((group) => (
                        <OpponentDebateCard
                          key={group.opponentId}
                          group={group}
                          onClick={() => openOpponentPanel(group.opponentId, group.opponentName)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {groupedDebates.length === 0 && (
                  <div className="text-center py-12">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-muted-foreground">No active debates</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Start a debate to see it here
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}

function OpponentDebateCard({ 
  group, 
  onClick 
}: { 
  group: GroupedDebate; 
  onClick: () => void;
}) {
  const avatarColor = get2DPoliticalCompassColor(
    group.opponentEconomicScore || 0,
    group.opponentAuthoritarianScore || 0
  );

  const mostRecent = group.mostRecentActivity 
    ? formatDistanceToNow(new Date(group.mostRecentActivity), { addSuffix: true })
    : 'No recent activity';

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-lg hover-elevate active-elevate-2 bg-card border text-left transition-all"
      data-testid={`debate-card-${group.opponentId}`}
    >
      <Avatar className="w-12 h-12 border-2" style={{ borderColor: avatarColor }}>
        <AvatarImage src={group.opponentAvatar || undefined} />
        <AvatarFallback 
          style={{ 
            background: avatarColor,
            color: 'white'
          }}
        >
          {group.opponentName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium truncate">{group.opponentName}</p>
          {group.totalUnread > 0 && (
            <Badge 
              variant="destructive" 
              className="shrink-0"
              data-testid={`badge-unread-${group.opponentId}`}
            >
              {group.totalUnread}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {group.debates.length} {group.debates.length === 1 ? 'topic' : 'topics'}
        </p>
        <p className="text-xs text-muted-foreground">{mostRecent}</p>
      </div>
    </button>
  );
}
