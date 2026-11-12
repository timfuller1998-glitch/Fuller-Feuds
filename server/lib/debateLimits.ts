import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '../db.js';
import { debateRooms } from '../../shared/schema.js';
import { FlowError } from './debateFlow.js';

/**
 * Debate overload guards (Nov 2026). Applied whenever someone starts a debate with someone else.
 * - At most MAX_PENDING_SENT invites waiting for an answer per sender.
 * - Nobody can be pulled into more than MAX_ACTIVE open debates (pending invites + active debates).
 * - At most MAX_STARTS_PER_HOUR new debates started per user per hour.
 * - Starting the same debate again (same two people, same topic, still open) returns the existing room.
 */
export const MAX_PENDING_SENT = 5;
export const MAX_ACTIVE = 10;
export const MAX_STARTS_PER_HOUR = 10;

const starts = new Map<string, number[]>();
const HOUR = 60 * 60 * 1000;

async function openLoad(userId: string): Promise<number> {
  const r: any = await db.execute(sql`
    SELECT count(*)::int AS n FROM debate_rooms
    WHERE (participant1_id = ${userId} OR participant2_id = ${userId})
      AND status = 'active' AND phase <> 'voting' AND invite_status IN ('pending', 'accepted')`);
  return Number((r.rows ?? r)[0]?.n || 0);
}

/** Throws FlowError when the start isn't allowed; returns an existing open room to reuse, if any. */
export async function checkDebateStart(inviterId: string, inviteeId: string, topicId: string) {
  const [existing] = await db.select().from(debateRooms).where(and(
    eq(debateRooms.topicId, topicId),
    eq(debateRooms.status, 'active'),
    inArray(debateRooms.inviteStatus, ['pending', 'accepted']),
    or(
      and(eq(debateRooms.participant1Id, inviterId), eq(debateRooms.participant2Id, inviteeId)),
      and(eq(debateRooms.participant1Id, inviteeId), eq(debateRooms.participant2Id, inviterId)),
    ),
  )).limit(1);
  if (existing) return existing;

  const now = Date.now();
  const recent = (starts.get(inviterId) || []).filter((t) => now - t < HOUR);
  if (recent.length >= MAX_STARTS_PER_HOUR) {
    throw new FlowError(429, `You've started ${MAX_STARTS_PER_HOUR} debates in the last hour. Take a breather and try again later.`);
  }

  const pr: any = await db.execute(sql`
    SELECT count(*)::int AS n FROM debate_rooms
    WHERE invite_status = 'pending' AND status = 'active' AND invitee_id IS NOT NULL AND invitee_id <> ${inviterId}
      AND (participant1_id = ${inviterId} OR participant2_id = ${inviterId})`);
  if (Number((pr.rows ?? pr)[0]?.n || 0) >= MAX_PENDING_SENT) {
    throw new FlowError(429, `You have ${MAX_PENDING_SENT} invites waiting for an answer. Wait for a reply before sending more.`);
  }
  if (await openLoad(inviterId) >= MAX_ACTIVE) {
    throw new FlowError(409, `You're in ${MAX_ACTIVE} open debates. Finish one before starting another.`);
  }
  if (await openLoad(inviteeId) >= MAX_ACTIVE) {
    throw new FlowError(409, 'They have a full plate of debates right now. Try again later.');
  }
  return null;
}

/** Call after a new room is created. Marks it as a pending invite and counts it toward the hourly limit. */
export async function markInvitePending(roomId: string, inviterId: string, inviteeId: string) {
  const now = Date.now();
  starts.set(inviterId, [...(starts.get(inviterId) || []).filter((t) => now - t < HOUR), now]);
  if (starts.size > 10000) starts.clear();
  await db.update(debateRooms).set({ inviteStatus: 'pending', inviteeId }).where(eq(debateRooms.id, roomId));
}
