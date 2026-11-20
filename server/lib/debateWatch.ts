import { sql } from 'drizzle-orm';
import { db } from '../db.js';
import type { DebateRoom } from '../../shared/schema.js';

/**
 * Live viewing (Nov 20 2026). Anyone, signed in or not, can watch a debate once the invite is accepted,
 * as long as neither debater made it private. Pending, declined and withdrawn invites stay between the two.
 */
export function isWatchable(room: Pick<DebateRoom, 'inviteStatus' | 'participant1Privacy' | 'participant2Privacy'> | null | undefined): boolean {
  if (!room) return false;
  return room.inviteStatus === 'accepted' && room.participant1Privacy !== 'private' && room.participant2Privacy !== 'private';
}

/** Room fields safe to show a spectator (no read receipts). */
export function spectatorRoom(room: DebateRoom) {
  const { participant1LastReadAt, participant2LastReadAt, ...rest } = room as any;
  return { ...rest, isSpectator: true };
}

const iso = (d: any): string | null => {
  if (d == null) return null;
  const dt = d instanceof Date ? d : new Date(String(d).replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00'));
  return isNaN(dt.getTime()) ? String(d) : dt.toISOString();
};

export type PublicDebate = {
  id: string; topicId: string; topicTitle: string; status: string; phase: string;
  participant1Id: string; participant1Name: string; participant1Avatar: string | null; participant1Stance: string | null;
  participant2Id: string; participant2Name: string; participant2Avatar: string | null; participant2Stance: string | null;
  messageCount: number; startedAt: string | null; lastActivityAt: string | null; endedAt: string | null;
  isShowcase: boolean;
};

/** Public debates: `live` = in progress (accepted, active), `finished` = ended or archived with at least one message. */
export async function listPublicDebates(kind: 'live' | 'finished', limit = 30): Promise<PublicDebate[]> {
  const where = kind === 'live'
    ? sql`d.status = 'active'`
    : sql`d.status IN ('ended', 'archived') AND EXISTS (SELECT 1 FROM debate_messages m WHERE m.room_id = d.id)`;
  // Showcase debates (featured by an admin, migration 0016) always list first.
  const order = kind === 'live' ? sql`coalesce(d.is_showcase, false) DESC, activity_at DESC NULLS LAST` : sql`coalesce(d.is_showcase, false) DESC, ended_at DESC NULLS LAST`;
  const r: any = await db.execute(sql`
    SELECT d.id, d.topic_id, d.status, d.phase, coalesce(d.is_showcase, false) AS is_showcase, d.participant1_id, d.participant2_id,
           d.participant1_stance, d.participant2_stance,
           (d.started_at AT TIME ZONE 'UTC') AS started_at,
           (coalesce(d.last_message_at, d.started_at) AT TIME ZONE 'UTC') AS activity_at,
           (d.ended_at AT TIME ZONE 'UTC') AS ended_at,
           t.title AS topic_title,
           coalesce(nullif(trim(p1p.display_first_name), ''), u1.first_name, u1.handle, 'Someone') AS p1_name,
           coalesce(nullif(trim(p2p.display_first_name), ''), u2.first_name, u2.handle, 'Someone') AS p2_name,
           u1.profile_image_url AS p1_avatar, u2.profile_image_url AS p2_avatar,
           (SELECT count(*)::int FROM debate_messages m WHERE m.room_id = d.id AND coalesce(m.status, 'approved') <> 'hidden') AS message_count
    FROM debate_rooms d
    JOIN topics t ON t.id = d.topic_id
    JOIN users u1 ON u1.id = d.participant1_id
    JOIN users u2 ON u2.id = d.participant2_id
    LEFT JOIN user_profiles p1p ON p1p.user_id = u1.id
    LEFT JOIN user_profiles p2p ON p2p.user_id = u2.id
    WHERE d.invite_status = 'accepted'
      AND coalesce(d.participant1_privacy, 'public') <> 'private'
      AND coalesce(d.participant2_privacy, 'public') <> 'private'
      AND ${where}
    ORDER BY ${order}
    LIMIT ${Math.max(1, Math.min(100, limit))}`);
  return ((r.rows ?? r) as any[]).map((d) => ({
    id: d.id, topicId: d.topic_id, topicTitle: d.topic_title, status: d.status, phase: d.phase,
    participant1Id: d.participant1_id, participant1Name: d.p1_name, participant1Avatar: d.p1_avatar, participant1Stance: d.participant1_stance,
    participant2Id: d.participant2_id, participant2Name: d.p2_name, participant2Avatar: d.p2_avatar, participant2Stance: d.participant2_stance,
    messageCount: Number(d.message_count) || 0,
    startedAt: iso(d.started_at), lastActivityAt: iso(d.activity_at), endedAt: iso(d.ended_at),
    isShowcase: d.is_showcase === true,
  }));
}
