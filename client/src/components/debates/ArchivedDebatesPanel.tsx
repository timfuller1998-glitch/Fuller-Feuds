import { useQuery } from '@tanstack/react-query';
import { X, Archive as ArchiveIcon, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDebateContext } from '@/contexts/DebateContext';
import { get2DPoliticalCompassColor } from '@/lib/politicalColors';
import { formatDistanceToNow } from 'date-fns';

interface ArchivedDebate {
  id: string;
  topicId: string;
  topicTitle: string;
  participant1Id: string;
  participant2Id: string;
  participant1Name: string;
  participant2Name: string;
  participant1Avatar?: string | null;
  participant2Avatar?: string | null;
  participant1EconomicScore?: number;
  participant1AuthoritarianScore?: number;
  participant2EconomicScore?: number;
  participant2AuthoritarianScore?: number;
  endedAt?: string | null;
}

export function ArchivedDebatesPanel() {
  const { activePanel, closePanel } = useDebateContext();
  const isOpen = activePanel === 'archived';

  const { data: archivedDebates = [], isLoading } = useQuery<ArchivedDebate[]>({
    queryKey: ['/api/debates/archived'],
    enabled: isOpen,
  });

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
        onClick={closePanel}
        data-testid="overlay-archived"
      />
      
      {/* Panel */}
      <div 
        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card border-l shadow-xl z-50 flex flex-col animate-fade-in"
        data-testid="panel-archived"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <ArchiveIcon className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Archived Debates</h2>
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
          <div className="p-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading archived debates...
              </div>
            ) : archivedDebates.length === 0 ? (
              <div className="text-center py-12">
                <Inbox className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">No archived debates</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Completed debates will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {archivedDebates.map((debate) => (
                  <ArchivedDebateCard key={debate.id} debate={debate} />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}

function ArchivedDebateCard({ debate }: { debate: ArchivedDebate }) {
  // Determine which participant is the opponent (not the current user)
  // For now, just show participant2 as the opponent
  const opponentName = debate.participant2Name;
  const opponentAvatar = debate.participant2Avatar;
  const avatarColor = get2DPoliticalCompassColor(
    debate.participant2EconomicScore || 0,
    debate.participant2AuthoritarianScore || 0
  );

  const endedTime = debate.endedAt 
    ? formatDistanceToNow(new Date(debate.endedAt), { addSuffix: true })
    : 'Recently';

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border"
      data-testid={`archived-debate-${debate.id}`}
    >
      <Avatar className="w-10 h-10 border-2" style={{ borderColor: avatarColor }}>
        <AvatarImage src={opponentAvatar || undefined} />
        <AvatarFallback 
          style={{ 
            background: avatarColor,
            color: 'white'
          }}
        >
          {opponentName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{debate.topicTitle}</p>
        <p className="text-sm text-muted-foreground">vs {opponentName}</p>
        <p className="text-xs text-muted-foreground mt-1">Ended {endedTime}</p>
      </div>
    </div>
  );
}
