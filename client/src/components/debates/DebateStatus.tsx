import { cn } from '@/lib/utils';

/** Mirrors server/lib/userDebates.ts */
export type DebateState = 'your_turn' | 'waiting' | 'rate' | 'rated' | 'completed' | 'invited' | 'invite_sent' | 'declined';
export interface UserDebate {
  id: string; topicTitle: string; opponentId: string; opponentName: string; opponentHandle: string | null;
  opponentAvatar: string | null; state: DebateState; isNew: boolean; unread: number; finished: boolean;
  myTurns: number; activityAt: string | null; endedAt: string | null;
}
export interface OpponentGroup {
  opponentId: string; opponentName: string; opponentHandle: string | null; opponentAvatar: string | null;
  opponentEconomicScore?: number; opponentAuthoritarianScore?: number;
  status: 'new' | 'needs_you' | 'none';
  activeDebates: UserDebate[]; finishedDebates: UserDebate[]; mostRecentActivity: string | null;
}

export const STATE_LABEL: Record<DebateState, string> = {
  your_turn: 'Your turn', waiting: 'Their turn', rate: 'Rate now', rated: 'Waiting for their rating', completed: 'Completed',
  invited: 'Invite: accept?', invite_sent: 'Invite sent', declined: 'Declined',
};

export const needsYou = (d: UserDebate) => d.state === 'your_turn' || d.state === 'rate' || d.state === 'invited';

/** Green = new invite you haven't opened; red = needs you (your turn / rate now). */
export function StatusDot({ kind, className, ...rest }: { kind: 'new' | 'needs_you'; className?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      role="status"
      aria-label={kind === 'new' ? 'New debate' : 'Needs you'}
      className={cn('block w-3.5 h-3.5 rounded-full ring-2 ring-background', kind === 'new' ? 'bg-emerald-500' : 'bg-red-600', className)}
      {...rest}
    />
  );
}
