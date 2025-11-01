import { useQuery } from '@tanstack/react-query';
import { X, MessageSquare } from 'lucide-react';
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

export function OpponentDebateList() {
  const { activePanel, closePanel, opponentPanelData, openDebateWindow, unreadCounts } = useDebateContext();
  const isOpen = activePanel === 'opponent-list';

  const { data: groupedDebates = [] } = useQuery<GroupedDebate[]>({
    queryKey: ['/api/debates/grouped'],
    enabled: isOpen,
  });

  if (!isOpen || !opponentPanelData) return null;

  const opponentGroup = groupedDebates.find(g => g.opponentId === opponentPanelData.opponentId);

  if (!opponentGroup) {
    return null;
  }

  const avatarColor = get2DPoliticalCompassColor(
    opponentGroup.opponentEconomicScore || 0,
    opponentGroup.opponentAuthoritarianScore || 0
  );

  const handleOpenChat = (debateId: string, topicTitle: string) => {
    openDebateWindow({
      debateRoomId: debateId,
      topicTitle,
      opponentName: opponentGroup.opponentName,
      opponentId: opponentGroup.opponentId,
    });
    closePanel();
  };

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
        onClick={closePanel}
        data-testid="overlay-opponent-list"
      />
      
      {/* Panel */}
      <div 
        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card border-l shadow-xl z-50 flex flex-col animate-fade-in"
        data-testid="panel-opponent-list"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 border-2" style={{ borderColor: avatarColor }}>
              <AvatarImage src={opponentGroup.opponentAvatar || undefined} />
              <AvatarFallback 
                style={{ 
                  background: avatarColor,
                  color: 'white'
                }}
              >
                {opponentGroup.opponentName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-lg font-semibold">{opponentGroup.opponentName}</h2>
              <p className="text-sm text-muted-foreground">
                {opponentGroup.debates.length} {opponentGroup.debates.length === 1 ? 'debate' : 'debates'}
              </p>
            </div>
          </div>
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
          <div className="p-4 space-y-2">
            {opponentGroup.debates.map((debate) => {
              const unreadCount = unreadCounts[debate.id] || 0;
              const lastActivity = debate.lastMessageAt 
                ? formatDistanceToNow(new Date(debate.lastMessageAt), { addSuffix: true })
                : 'No messages yet';

              return (
                <button
                  key={debate.id}
                  onClick={() => handleOpenChat(debate.id, debate.topicTitle)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover-elevate active-elevate-2 bg-card border text-left transition-all"
                  data-testid={`debate-topic-${debate.id}`}
                >
                  <MessageSquare className="w-5 h-5 shrink-0 text-muted-foreground" />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium truncate">{debate.topicTitle}</p>
                      {unreadCount > 0 && (
                        <Badge 
                          variant="destructive" 
                          className="shrink-0"
                          data-testid={`badge-unread-${debate.id}`}
                        >
                          {unreadCount}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{lastActivity}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
