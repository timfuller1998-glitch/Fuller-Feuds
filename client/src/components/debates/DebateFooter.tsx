import { useQuery } from '@tanstack/react-query';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MessageSquare, Archive } from 'lucide-react';
import { useDebateContext } from '@/contexts/DebateContext';
import { get2DPoliticalCompassColor } from '@/lib/politicalColors';
import { DebateTray } from './DebateTray';
import { TypingBubble } from './TypingBubble';
import { type OpponentGroup, StatusDot } from './DebateStatus';
import { useTypingRooms } from '@/lib/typingStore';
import { openDebatesTray } from '@/lib/debatesTray';
import { useEffect, useState } from 'react';

/** How many 48px avatars (12px gap) fit in the row; when there are more people, one slot becomes the "+N" chip. */
function useAvatarSlots() {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [slots, setSlots] = useState(3);
  useEffect(() => {
    if (!el) return;
    const measure = () => setSlots(Math.max(1, Math.floor((el.clientWidth + 12) / 60)));
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return { ref: setEl, slots };
}

/**
 * Footer avatar row: one avatar per person you have an ACTIVE debate with.
 * Indicator priority: typing "…" (live, overrides dots) > green (unopened new invite) > red (your turn / rate now) > none.
 * The ellipsis wins because it's momentary and the most actionable signal ("they're about to reply");
 * the dot comes back as soon as typing stops or expires (5s).
 * Finished debates (both rated, or you rated and are waiting on theirs) live in Archive instead.
 */
export function DebateFooter() {
  const { openOpponentPanel } = useDebateContext();
  const { ref: rowRef, slots } = useAvatarSlots();
  const typingRooms = useTypingRooms();

  const { data: groupedDebates = [] } = useQuery<OpponentGroup[]>({
    queryKey: ['/api/debates/grouped'],
  });

  // Server sorts by priority: new (green) → needs you (red) → the rest, newest first.
  const recentDebates = groupedDebates.filter((g) => g.activeDebates?.length > 0);
  const maxAvatars = recentDebates.length > slots ? Math.max(1, slots - 1) : slots;
  const visible = recentDebates.slice(0, maxAvatars);
  const overflow = recentDebates.length - visible.length;
  const overflowDot = recentDebates.slice(maxAvatars).some((g) => g.status === 'new') ? 'new'
    : recentDebates.slice(maxAvatars).some((g) => g.status === 'needs_you') ? 'needs_you' : null;
  const archivedDebates = groupedDebates.filter((g) => g.finishedDebates?.length > 0);

  // Determine what to show in the footer
  const hasRecentDebates = recentDebates.length > 0;
  const hasArchivedDebates = archivedDebates.length > 0;
  const hasNoDebates = groupedDebates.length === 0;

  return (
    <div 
      className="relative shrink-0 bg-background border-t-[3px] border-double border-foreground z-40 pb-[env(safe-area-inset-bottom)]"
      data-testid="debate-footer"
    >
      <div className="flex items-center gap-2 px-4 py-2 max-w-screen-2xl mx-auto">
        {/* Show different content based on debate state */}
        {hasRecentDebates ? (
          <>
            {/* NEW: debates tray (all debates + unread badge) replaces the old More button */}
            <DebateTray />

            {/* Avatar Row - Scrollable */}
            <div 
              ref={rowRef}
              className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden scrollbar-thin"
              style={{ scrollbarWidth: 'thin' }}
            >
              <div className="flex gap-3 py-1">
                {visible.map((group) => {
                  const typing = group.activeDebates.some((d) => typingRooms.has(d.id));
                  const indicator = typing ? 'typing' : group.status;
                  const avatarColor = get2DPoliticalCompassColor(
                    group.opponentEconomicScore || 0,
                    group.opponentAuthoritarianScore || 0
                  );

                  return (
                    <button
                      key={group.opponentId}
                      onClick={() => openOpponentPanel(group.opponentId, group.opponentName)}
                      className="relative shrink-0 group animate-slide-in-up"
                      data-testid={`avatar-opponent-${group.opponentId}`}
                      data-indicator={indicator}
                      aria-label={`${group.opponentName}${indicator === 'typing' ? ', typing' : indicator === 'new' ? ', new debate' : indicator === 'needs_you' ? ', needs you' : ''}`}
                    >
                      <div className="relative">
                        <Avatar
                          className="w-12 h-12 border-2 transition-all"
                          style={{ borderColor: indicator === 'none' ? 'transparent' : avatarColor }}
                        >
                          <AvatarImage src={group.opponentAvatar || undefined} />
                          <AvatarFallback
                            className="text-xs"
                            style={{ background: avatarColor, color: 'hsl(30 18% 11%)' }}
                          >
                            {group.opponentName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {indicator === 'typing' ? (
                          <TypingBubble size="sm" className="absolute -top-1.5 -right-2.5" label={`${group.opponentName} is typing`} data-testid={`typing-${group.opponentId}`} />
                        ) : indicator === 'new' ? (
                          <StatusDot kind="new" className="absolute -top-0.5 -right-0.5" data-testid={`dot-new-${group.opponentId}`} />
                        ) : indicator === 'needs_you' ? (
                          <StatusDot kind="needs_you" className="absolute -top-0.5 -right-0.5" data-testid={`dot-needs-${group.opponentId}`} />
                        ) : null}
                      </div>

                      {/* Name tooltip on hover */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        {group.opponentName}
                      </div>
                    </button>
                  );
                })}
                {overflow > 0 && (
                  <button
                    onClick={() => openDebatesTray('active')}
                    className="relative shrink-0 w-12 h-12 rounded-full border-2 border-foreground bg-background font-ui text-sm font-bold"
                    aria-label={`${overflow} more people`}
                    data-testid="chip-footer-more"
                  >
                    +{overflow}
                    {overflowDot && <StatusDot kind={overflowDot} className="absolute -top-0.5 -right-0.5" data-testid="dot-footer-more" />}
                  </button>
                )}
              </div>
            </div>

            {/* Archived Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openDebatesTray('archive')}
              className="shrink-0"
              data-testid="button-archived-debates"
            >
              <Archive className="w-4 h-4 mr-1" />
              Archive
            </Button>
          </>
        ) : hasArchivedDebates ? (
          <>
            {/* Only archived debates - show welcoming message with archived button */}
            <DebateTray />
            <div className="flex-1 flex items-center justify-center gap-3 text-sm text-muted-foreground">
              <span>No active debates right now</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openDebatesTray('archive')}
              className="shrink-0"
              data-testid="button-archived-debates"
            >
              <Archive className="w-4 h-4 mr-1" />
              View Archive
            </Button>
          </>
        ) : (
          <>
            {/* No debates at all - show welcome message */}
            <DebateTray />
            <div className="flex-1 flex items-center justify-center gap-2 text-sm text-muted-foreground py-1">
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
