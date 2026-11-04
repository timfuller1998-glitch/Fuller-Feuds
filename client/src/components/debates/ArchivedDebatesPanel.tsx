import { useQuery } from '@tanstack/react-query';
import { X, Archive as ArchiveIcon, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDebateContext } from '@/contexts/DebateContext';
import { get2DPoliticalCompassColor } from '@/lib/politicalColors';
import { formatDistanceToNow } from 'date-fns';
import { useLocation } from 'wouter';
import { type OpponentGroup, type UserDebate, STATE_LABEL } from './DebateStatus';

/** Archive = finished debates (both rated, or you rated and are waiting on theirs), newest first, by person. */
export function ArchivedDebatesPanel() {
  const { activePanel, closePanel } = useDebateContext();
  const [, navigate] = useLocation();
  const isOpen = activePanel === 'archived';

  const { data: groups = [], isLoading } = useQuery<OpponentGroup[]>({
    queryKey: ['/api/debates/grouped'],
    enabled: isOpen,
  });
  const archivedDebates = groups.flatMap((g) => g.finishedDebates ?? [])
    .sort((a, b) => (b.endedAt ?? b.activityAt ?? '').localeCompare(a.endedAt ?? a.activityAt ?? ''));
  const open = (id: string) => { closePanel(); navigate(`/debate-room/${id}`); };

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
            <h2 className="text-lg font-semibold">Archive</h2>
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
                  Finished debates move here once rated
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {archivedDebates.map((debate) => (
                  <ArchivedDebateCard key={debate.id} debate={debate} onOpen={() => open(debate.id)} />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}

function ArchivedDebateCard({ debate, onOpen }: { debate: UserDebate; onOpen: () => void }) {
  const avatarColor = get2DPoliticalCompassColor(0, 0);
  const when = debate.endedAt ?? debate.activityAt;
  return (
    <button
      onClick={onOpen}
      className="w-full text-left flex items-start gap-3 p-3 rounded-lg bg-muted/30 border hover-elevate"
      data-testid={`archived-debate-${debate.id}`}
    >
      <Avatar className="w-10 h-10 border-2" style={{ borderColor: avatarColor }}>
        <AvatarImage src={debate.opponentAvatar || undefined} />
        <AvatarFallback style={{ background: avatarColor, color: 'hsl(30 18% 11%)' }}>
          {debate.opponentName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{debate.topicTitle}</p>
        <p className="text-sm text-muted-foreground">vs {debate.opponentName}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {STATE_LABEL[debate.state]}{when ? ` · ${formatDistanceToNow(new Date(when), { addSuffix: true })}` : ''}
        </p>
      </div>
    </button>
  );
}
