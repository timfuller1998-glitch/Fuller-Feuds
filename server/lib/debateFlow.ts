import type { Request } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db.js';
import { debateRooms, debateVotes } from '../../shared/schema.js';
import { DebateService } from '../services/debateService.js';
import { BadgeRepository } from '../repositories/badgeRepository.js';
import { notifyUser } from './notify.js';

/** Each side gets this many turns in the structured phase; after that both rate each other. */
export const STRUCTURED_TURNS = 3;

const debateService = new DebateService();

export class FlowError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function getRoomRaw(roomId: string) {
  const [room] = await db.select().from(debateRooms).where(eq(debateRooms.id, roomId)).limit(1);
  return room;
}

export async function displayNameOf(userId: string): Promise<string> {
  const r: any = await db.execute(sql`
    SELECT coalesce(nullif(trim(p.display_first_name), ''), u.first_name, u.handle, 'Someone') AS name
    FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id = ${userId} LIMIT 1`);
  return ((r.rows ?? r)[0]?.name as string) || 'Someone';
}

async function topicTitle(topicId: string): Promise<string> {
  const r: any = await db.execute(sql`SELECT title FROM topics WHERE id = ${topicId} LIMIT 1`);
  return ((r.rows ?? r)[0]?.title as string) || 'a topic';
}

/**
 * Send a message with turn order enforced. In the structured phase only `currentTurn` may post;
 * each post hands the turn over, and once both sides used STRUCTURED_TURNS the room moves to voting.
 * Sends the matching bell notifications.
 */
export async function postDebateMessage(roomId: string, userId: string, content: string, role?: string, req?: Request, opts: { silent?: boolean } = {}) {
  const room = await getRoomRaw(roomId);
  if (!room) throw new FlowError(404, 'Debate room not found');
  const isParticipant = room.participant1Id === userId || room.participant2Id === userId;
  if (!isParticipant) throw new FlowError(403, 'Only the two debaters can post here');
  if (room.status !== 'active') throw new FlowError(400, 'This debate has ended');
  if (room.phase === 'voting') throw new FlowError(400, 'Turns are over. Rate your opponent to finish.');
  if (room.phase === 'structured' && room.currentTurn && room.currentTurn !== userId) {
    throw new FlowError(409, "It's not your turn yet");
  }

  const message = await debateService.sendMessage(roomId, userId, content, userId, role, req);
  const opponentId = room.participant1Id === userId ? room.participant2Id : room.participant1Id;
  let updated = room;
  if (room.phase === 'structured') {
    updated = await debateService.updateTurn(roomId, userId);
    if ((updated.turnCount1 || 0) >= STRUCTURED_TURNS && (updated.turnCount2 || 0) >= STRUCTURED_TURNS) {
      await debateService.updateDebatePhase(roomId, 'voting');
      await db.update(debateRooms).set({ currentTurn: null }).where(eq(debateRooms.id, roomId));
      updated = (await getRoomRaw(roomId))!;
    }
  }

  if (opponentId && !opts.silent) {
    const me = await displayNameOf(userId);
    if (updated.phase === 'voting') {
      const them = await displayNameOf(opponentId);
      await notifyUser(opponentId, { type: 'rate_opponent', title: 'Time to rate', message: `Turns are done. Rate ${me}'s debating.`, debateRoomId: roomId });
      await notifyUser(userId, { type: 'rate_opponent', title: 'Time to rate', message: `Turns are done. Rate ${them}'s debating.`, debateRoomId: roomId });
    } else if (updated.phase === 'structured') {
      await notifyUser(opponentId, { type: 'your_turn', title: 'Your turn', message: `${me} replied. It's your turn.`, debateRoomId: roomId });
    }
  }
  return { message, room: updated, opponentId };
}

/** Bell notification for the person invited into a new debate. */
export async function notifyDebateInvite(roomId: string, fromUserId: string, toUserId: string, topicId: string) {
  const [me, title] = await Promise.all([displayNameOf(fromUserId), topicTitle(topicId)]);
  await notifyUser(toUserId, {
    type: 'new_debate',
    title: 'New debate',
    message: `${me} challenged you on "${title}".`,
    debateRoomId: roomId,
  });
}

/** End a debate early: it closes and both sides are asked to rate. */
export async function endDebate(roomId: string, userId: string) {
  const room = await getRoomRaw(roomId);
  if (!room) throw new FlowError(404, 'Debate room not found');
  if (room.participant1Id !== userId && room.participant2Id !== userId) throw new FlowError(403, 'Only the two debaters can end this debate');
  if (room.status === 'ended') return room;
  await db.update(debateRooms).set({ status: 'ended', endedAt: new Date(), currentTurn: null, phase: 'voting' }).where(eq(debateRooms.id, roomId));
  const opponentId = room.participant1Id === userId ? room.participant2Id : room.participant1Id;
  if (opponentId) {
    const me = await displayNameOf(userId);
    await notifyUser(opponentId, { type: 'debate_ended', title: 'Debate ended', message: `${me} ended the debate. Rate how they debated.`, debateRoomId: roomId });
  }
  return (await getRoomRaw(roomId))!;
}

export async function getVoteSummary(roomId: string, viewerId?: string) {
  const room = await getRoomRaw(roomId);
  if (!room) throw new FlowError(404, 'Debate room not found');
  const votes = await db.select().from(debateVotes).where(eq(debateVotes.roomId, roomId));
  const pick = (voter?: string | null) => {
    const v = votes.find((x) => x.voterId === voter);
    return v ? { logicalReasoning: v.logicalReasoning, politeness: v.politeness, opennessToChange: v.opennessToChange, votedForUserId: v.votedForUserId } : undefined;
  };
  const p1 = pick(room.participant1Id);
  const p2 = pick(room.participant2Id);
  const bothIn = !!(p1 && p2);
  const isParticipant = viewerId === room.participant1Id || viewerId === room.participant2Id;
  // Scores stay hidden from a participant until both sides have rated (no peeking before you vote).
  const hide = isParticipant && !bothIn;
  return {
    participant1Votes: hide ? (viewerId === room.participant1Id ? p1 : undefined) : p1,
    participant2Votes: hide ? (viewerId === room.participant2Id ? p2 : undefined) : p2,
    myVoteSubmitted: !!votes.find((x) => x.voterId === viewerId),
    bothSubmitted: bothIn,
  };
}

/** Rate the opponent (1–5 on three scales). Updates stats and badges; when both are in, everyone is told. */
export async function submitRating(roomId: string, voterId: string, body: any) {
  const room = await getRoomRaw(roomId);
  if (!room) throw new FlowError(404, 'Debate room not found');
  if (room.participant1Id !== voterId && room.participant2Id !== voterId) throw new FlowError(403, 'Only the two debaters can rate');
  const opponentId = room.participant1Id === voterId ? room.participant2Id : room.participant1Id;
  if (!opponentId) throw new FlowError(400, 'No opponent to rate');
  if (body?.votedForUserId && body.votedForUserId !== opponentId) throw new FlowError(400, 'You can only rate your opponent');
  if (room.phase !== 'voting' && room.status !== 'ended') throw new FlowError(400, 'Rating opens when the turns are over or the debate ends');
  const score = (k: string) => {
    const n = Number(body?.[k]);
    if (!Number.isInteger(n) || n < 1 || n > 5) throw new FlowError(400, `${k} must be a whole number from 1 to 5`);
    return n;
  };
  const vote = { roomId, voterId, votedForUserId: opponentId, logicalReasoning: score('logicalReasoning'), politeness: score('politeness'), opennessToChange: score('opennessToChange') };
  try {
    await debateService.submitVote(vote as any);
  } catch (e: any) {
    if (String(e?.code) === '23505' || /unique/i.test(String(e?.message))) throw new FlowError(409, 'You already rated this debate');
    throw e;
  }
  await debateService.updateUserDebateStats(opponentId);

  // Structured flow: the "continue?" choice is recorded too. Both yes -> free-form; otherwise the debate ends.
  if (room.status === 'active' && typeof body?.wantsToContinue === 'boolean') {
    await debateService.submitVoteToContinue(roomId, voterId, body.wantsToContinue);
  }

  const summary = await getVoteSummary(roomId, voterId);
  if (summary.bothSubmitted) {
    // If no one chose to continue, make sure the room is closed.
    const latest = await getRoomRaw(roomId);
    if (latest && latest.status === 'active' && latest.phase === 'voting') {
      await db.update(debateRooms).set({ status: 'ended', endedAt: new Date() }).where(eq(debateRooms.id, roomId));
    }
    const badges = new BadgeRepository();
    await Promise.all([voterId, opponentId].map((u) => badges.checkAndAwardBadges(u).catch(() => [])));
    for (const uid of [room.participant1Id, room.participant2Id].filter(Boolean) as string[]) {
      await notifyUser(uid, { type: 'ratings_in', title: 'Ratings are in', message: 'Both sides rated. See your scores.', debateRoomId: roomId });
    }
  }
  return summary;
}
