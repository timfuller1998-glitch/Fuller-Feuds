import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { parseServerDate } from "@/lib/dates";
import { X, MessageSquare, ChevronDown, ChevronRight, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useDebateContext } from '@/contexts/DebateContext';
import { useAuth } from '@/hooks/useAuth';
import { get2DPoliticalCompassColor } from '@/lib/politicalColors';
import { debateTurn } from '@/lib/debateTurn';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { type OpponentGroup, type UserDebate, type DebateState, STATE_LABEL, needsYou } from './DebateStatus';

const initials = (s?: string | null) => (s || '?').trim().slice(0, 2).toUpperCase();
const ago = (d: string | null) => (d ? formatDistanceToNow(parseServerDate(d), { addSuffix: true }) : 'No messages yet');

/** Turn state from the shared turn source (PR #82) when the room is in play; invite/vote states come from the server. */
function liveState(d: UserDebate, me?: string): DebateState {
  if ((d.state === 'your_turn' || d.state === 'waiting') && d.room && me) {
    const t = debateTurn(d.room, me);
    if (t.isMyTurn) return 'your_turn';
    if (t.waiting) return 'waiting';
  }
  return d.state;
}

function StanceChip({ who, stance }: { who: string; stance?: string | null }) {
  if (!stance) return null;
  const s = stance.toLowerCase();
  return (
    <span
      className={cn(
        'inline-flex max-w-[9rem] items-center gap-1 rounded-full border px-2 py-0.5 font-ui text-[0.6rem] font-semibold uppercase tracking-[0.06em]',
        s === 'for' ? 'border-emerald-600/40 text-emerald-700 dark:text-emerald-400' : s === 'against' ? 'border-primary/40 text-primary' : 'border-border text-muted-foreground',
      )}
    >
      <span className="truncate normal-case tracking-normal font-medium text-muted-foreground">{who}</span>
      {s}
    </span>
  );
}

export function OpponentDebateList() {
  const { activePanel, closePanel, opponentPanelData, openDebateWindow } = useDebateContext();
  const { user } = useAuth() as { user: any };
  const isOpen = activePanel === 'opponent-list';
  const [showFinished, setShowFinished] = useState(false);

  const { data: groupedDebates = [] } = useQuery<OpponentGroup[]>({
    queryKey: ['/api/debates/grouped'],
    enabled: isOpen,
    refetchOnWindowFocus: true,
    refetchInterval: isOpen ? 15000 : false,
  });

  if (!isOpen || !opponentPanelData) return null;
  const group = groupedDebates.find((g) => g.opponentId === opponentPanelData.opponentId);
  if (!group) return null;

  const me = user?.id as string | undefined;
  const oppColor = get2DPoliticalCompassColor(group.opponentEconomicScore || 0, group.opponentAuthoritarianScore || 0);
  const oppFirst = group.opponentName.split(' ')[0];
  const active = group.activeDebates
    .map((d) => ({ d, state: liveState(d, me) }))
    .sort((a, b) => {
      const na = needsYou({ ...a.d, state: a.state }) ? 0 : 1;
      const nb = needsYou({ ...b.d, state: b.state }) ? 0 : 1;
      return na - nb || (b.d.activityAt ?? '').localeCompare(a.d.activityAt ?? '');
    });
  const finished = group.finishedDebates ?? [];
  const yourMoves = active.filter((a) => needsYou({ ...a.d, state: a.state })).length;

  const open = (d: UserDebate) => {
    openDebateWindow({ debateRoomId: d.id, topicTitle: d.topicTitle, opponentName: group.opponentName, opponentId: group.opponentId });
    closePanel();
  };

  return (
    <>
      <div className="fixed inset-0 bg-background/70 backdrop-blur-sm z-50 animate-fade-in" onClick={closePanel} data-testid="overlay-opponent-list" />
      <div
        role="dialog"
        aria-label={`Debates with ${group.opponentName}`}
        className="fixed z-50 inset-x-0 bottom-0 max-h-[85dvh] w-full overflow-hidden rounded-t-2xl border-t bg-card shadow-2xl flex flex-col animate-fade-in sm:inset-x-auto sm:right-4 sm:bottom-20 sm:w-[420px] sm:rounded-2xl sm:border"
        data-testid="panel-opponent-list"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/30 sm:hidden" aria-hidden="true" />

        {/* Face-off header */}
        <div className="relative px-4 pt-3 pb-4 border-b bg-gradient-to-b from-primary/10 to-transparent">
          <div className="absolute right-2 top-2">
            <Button variant="ghost" size="icon" onClick={closePanel} data-testid="button-close-panel" aria-label="Close">
              <X className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex items-center justify-center gap-3 pr-8 pl-8">
            <div className="flex min-w-0 flex-col items-center gap-1">
              <Avatar className="h-12 w-12 border-2 border-primary/60">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback>{initials(user?.firstName)}</AvatarFallback>
              </Avatar>
              <span className="font-ui text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">You</span>
            </div>
            <span className="rounded-md bg-primary px-2 py-1 font-ui text-xs font-bold tracking-[0.12em] text-primary-foreground">VS</span>
            <div className="flex min-w-0 flex-col items-center gap-1">
              <Avatar className="h-12 w-12 border-2" style={{ borderColor: oppColor }}>
                <AvatarImage src={group.opponentAvatar || undefined} />
                <AvatarFallback style={{ background: oppColor, color: 'hsl(30 18% 11%)' }}>{initials(group.opponentName)}</AvatarFallback>
              </Avatar>
              <span className="max-w-[7rem] truncate font-ui text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{oppFirst}</span>
            </div>
          </div>
          <h2 className="mt-2 text-center font-serif text-lg font-semibold leading-tight break-words" data-testid="text-opponent-name">
            You vs {group.opponentName}
          </h2>
          <p className="mt-0.5 text-center text-xs text-muted-foreground" data-testid="text-debate-summary">
            {active.length} active · {finished.length} finished
            {yourMoves > 0 && <span className="text-primary font-semibold"> · {yourMoves === 1 ? 'your move' : `${yourMoves} need you`}</span>}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {active.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No active debates with {oppFirst} right now.</p>
          )}
          {active.map(({ d, state }) => {
            const mine = state === 'your_turn' || state === 'rate' || state === 'invited';
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => open(d)}
                className={cn(
                  'relative block w-full min-w-0 overflow-hidden rounded-xl border bg-background/40 p-3 text-left transition-all hover-elevate active-elevate-2',
                  mine ? 'border-primary/60 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]' : 'border-border',
                )}
                data-testid={`debate-topic-${d.id}`}
                data-state={state}
              >
                {mine && <span className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden="true" />}
                <div className="flex items-center gap-2">
                  {mine ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2 py-0.5 font-ui text-[0.62rem] font-bold uppercase tracking-[0.08em] text-primary-foreground" data-testid={`status-${d.id}`}>
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-foreground opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                      </span>
                      {d.isNew ? 'New · ' : ''}{STATE_LABEL[state]}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 font-ui text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground" data-testid={`status-${d.id}`}>
                      {d.isNew ? 'New · ' : ''}{STATE_LABEL[state]}
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-[0.7rem] text-muted-foreground">{ago(d.activityAt)}</span>
                  {d.unread > 0 && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label={`${d.unread} unread`} data-testid={`unread-${d.id}`} />}
                </div>
                <p className="mt-2 font-serif text-[0.95rem] font-semibold leading-snug line-clamp-2 break-words" data-testid={`title-${d.id}`}>
                  {d.topicTitle}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <StanceChip who="You" stance={d.myStance} />
                  <StanceChip who={oppFirst} stance={d.opponentStance} />
                  <span className="ml-auto inline-flex items-center gap-1 text-[0.7rem] text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    {d.messageCount ?? 0}
                    {typeof d.messageCount === 'number' && d.messageCount > 0 && ` · round ${Math.floor((d.messageCount - 1) / 2) + 1}`}
                  </span>
                </div>
              </button>
            );
          })}

          {finished.length > 0 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowFinished((v) => !v)}
                className="flex w-full items-center gap-1.5 px-1 py-1.5 font-ui text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
                data-testid="button-toggle-finished"
              >
                {showFinished ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                Finished ({finished.length})
              </button>
              {showFinished && (
                <div className="space-y-1.5">
                  {finished.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => open(d)}
                      className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-left hover-elevate"
                      data-testid={`finished-${d.id}`}
                    >
                      <span className="min-w-0 flex-1 text-sm line-clamp-1 break-words">{d.topicTitle}</span>
                      <span className="shrink-0 text-[0.65rem] text-muted-foreground">{STATE_LABEL[d.state]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <Link href={`/profile/${group.opponentId}`} onClick={closePanel}>
            <span className="mt-1 flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground" data-testid="link-opponent-profile">
              <UserIcon className="h-3.5 w-3.5" /> View {oppFirst}'s profile
            </span>
          </Link>
        </div>
      </div>
    </>
  );
}
