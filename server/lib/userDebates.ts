import { sql } from 'drizzle-orm';
import { db } from '../db.js';

/**
 * Every debate a user is in, with a status computed for them. One source of truth for the
 * footer avatars (/api/debates/grouped) and the footer Debates list (/api/notifications/debates).
 *
 * state:
 *   your_turn  - structured phase, it's your turn                 (needs you → red dot)
 *   rate       - turns done or ended early, you haven't rated yet (needs you → red dot)
 *   waiting    - structured phase, their turn                     (no dot)
 *   rated      - you rated, waiting for their rating              (finished for you → archive)
 *   completed  - both rated, or archived                          (finished → archive)
 * isNew: an unread "new_debate" notification exists for this room (green dot until opened).
 */
export type DebateState = 'your_turn' | 'waiting' | 'rate' | 'rated' | 'completed';
export type UserDebate = {
  id: string; topicTitle: string; opponentId: string; opponentName: string; opponentHandle: string | null;
  opponentAvatar: string | null; state: DebateState; isNew: boolean; unread: number; finished: boolean;
  myTurns: number; activityAt: string | null; endedAt: string | null;
};

const iso = (d: any): string | null => (d == null ? null : d instanceof Date ? d.toISOString() : String(d));

export async function listUserDebates(me: string): Promise<UserDebate[]> {
  const r: any = await db.execute(sql`
    SELECT d.id, d.status, d.phase, d.current_turn, d.turn_count1, d.turn_count2,
           d.participant1_id,
           (coalesce(d.last_message_at, d.started_at) AT TIME ZONE 'UTC') AS activity_at,
           (d.ended_at AT TIME ZONE 'UTC') AS ended_at,
           t.title AS topic_title,
           o.id AS opponent_id, o.handle AS opponent_handle, o.profile_image_url AS opponent_avatar,
           coalesce(nullif(trim(op.display_first_name), ''), o.first_name, o.handle, 'Someone') AS opponent_name,
           (SELECT count(*)::int FROM notifications n WHERE n.user_id = ${me} AND n.debate_room_id = d.id AND n.is_read = false) AS unread,
           (SELECT count(*)::int FROM notifications n WHERE n.user_id = ${me} AND n.debate_room_id = d.id AND n.is_read = false AND n.type = 'new_debate') AS unread_invite,
           EXISTS (SELECT 1 FROM debate_votes v WHERE v.room_id = d.id AND v.voter_id = ${me}) AS i_voted,
           (SELECT count(*)::int FROM debate_votes v WHERE v.room_id = d.id) AS vote_count
    FROM debate_rooms d
    JOIN topics t ON t.id = d.topic_id
    JOIN users o ON o.id = CASE WHEN d.participant1_id = ${me} THEN d.participant2_id ELSE d.participant1_id END
    LEFT JOIN user_profiles op ON op.user_id = o.id
    WHERE d.participant1_id = ${me} OR d.participant2_id = ${me}
    ORDER BY activity_at DESC NULLS LAST
    LIMIT 200`);
  return ((r.rows ?? r) as any[]).map((d) => {
    const voting = d.phase === 'voting' || d.status === 'ended' || d.status === 'archived';
    const state: DebateState = d.status === 'archived' || d.vote_count >= 2
      ? 'completed'
      : voting
        ? (d.i_voted ? 'rated' : 'rate')
        : d.current_turn === me ? 'your_turn' : 'waiting';
    const isP1 = d.participant1_id === me;
    return {
      id: d.id, topicTitle: d.topic_title, opponentId: d.opponent_id, opponentName: d.opponent_name,
      opponentHandle: d.opponent_handle, opponentAvatar: d.opponent_avatar, state,
      isNew: d.unread_invite > 0, unread: d.unread,
      finished: state === 'completed' || state === 'rated',
      myTurns: (isP1 ? d.turn_count1 : d.turn_count2) ?? 0,
      activityAt: iso(d.activity_at), endedAt: iso(d.ended_at),
    };
  });
}

export type OpponentGroup = {
  opponentId: string; opponentName: string; opponentHandle: string | null; opponentAvatar: string | null;
  /** green = unopened invite, red = needs you, none = nothing pending */
  status: 'new' | 'needs_you' | 'none';
  activeDebates: UserDebate[]; finishedDebates: UserDebate[]; mostRecentActivity: string | null;
};

export async function groupUserDebates(me: string): Promise<OpponentGroup[]> {
  const map = new Map<string, OpponentGroup>();
  for (const d of await listUserDebates(me)) {
    let g = map.get(d.opponentId);
    if (!g) {
      g = { opponentId: d.opponentId, opponentName: d.opponentName, opponentHandle: d.opponentHandle,
        opponentAvatar: d.opponentAvatar, status: 'none', activeDebates: [], finishedDebates: [], mostRecentActivity: null };
      map.set(d.opponentId, g);
    }
    (d.finished ? g.finishedDebates : g.activeDebates).push(d);
    if (d.activityAt && (!g.mostRecentActivity || d.activityAt > g.mostRecentActivity)) g.mostRecentActivity = d.activityAt;
  }
  for (const g of map.values()) {
    if (g.activeDebates.some((d) => d.isNew)) g.status = 'new';
    else if (g.activeDebates.some((d) => d.state === 'your_turn' || d.state === 'rate')) g.status = 'needs_you';
  }
  return [...map.values()].sort((a, b) => (b.mostRecentActivity ?? '').localeCompare(a.mostRecentActivity ?? ''));
}
