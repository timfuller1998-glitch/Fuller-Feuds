import { useQuery } from '@tanstack/react-query';
import { parseServerDate } from "@/lib/dates";
import { X, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDebateContext } from '@/contexts/DebateContext';
import { get2DPoliticalCompassColor } from '@/lib/politicalColors';
import { formatDistanceToNow } from 'date-fns';
import { type OpponentGroup, STATE_LABEL, StatusDot, needsYou } from './DebateStatus';

export function OpponentDebateList() {
  const { activePanel, closePanel, opponentPanelData, openDebateWindow } = useDebateContext();
  const isOpen = activePanel === 'opponent-list';

  const { data: groupedDebates = [] } = useQuery<OpponentGroup[]>({
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
                  color: 'hsl(30 18% 11%)'
                }}
              >
                {opponentGroup.opponentName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-lg font-semibold">{opponentGroup.opponentName}</h2>
              <p className="text-sm text-muted-foreground">
                {opponentGroup.activeDebates.length} active {opponentGroup.activeDebates.length === 1 ? 'debate' : 'debates'}
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
            {opponentGroup.activeDebates.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No active debates. Finished ones are in Archive.</p>
            )}
            {opponentGroup.activeDebates.map((debate) => {
              const lastActivity = debate.activityAt
                ? formatDistanceToNow(parseServerDate(debate.activityAt), { addSuffix: true })
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
                    <p className="font-medium truncate">{debate.topicTitle}</p>
                    <p className="text-xs text-muted-foreground">{debate.isNew ? 'New debate' : STATE_LABEL[debate.state]} · {lastActivity}</p>
                  </div>
                  {debate.isNew ? <StatusDot kind="new" data-testid={`list-dot-new-${debate.id}`} />
                    : needsYou(debate) ? <StatusDot kind="needs_you" data-testid={`list-dot-needs-${debate.id}`} /> : null}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
