import { db } from '../db.js';
import { counterpointLikes, opinionSentenceCounterpoints, opinions, users, userDebateStats } from '../../shared/schema.js';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

export class CounterpointRepository {
  async createCounterpoint(params: {
    opinionId: string;
    sentenceIndex: number;
    authorUserId: string;
    content: string;
  }) {
    const [created] = await db
      .insert(opinionSentenceCounterpoints)
      .values({
        opinionId: params.opinionId,
        sentenceIndex: params.sentenceIndex,
        authorUserId: params.authorUserId,
        content: params.content,
        status: 'approved',
      })
      .returning();

    return created;
  }

  async listCounterpoints(params: { opinionId: string; sentenceIndex: number; currentUserId?: string }) {
    const rows = await db
      .select({
        counterpoint: opinionSentenceCounterpoints,
        author: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        },
        likeCount: sql<number>`count(${counterpointLikes.id})::int`,
        likedByMe: params.currentUserId
          ? sql<boolean>`bool_or(${counterpointLikes.userId} = ${params.currentUserId})`
          : sql<boolean>`false`,
      })
      .from(opinionSentenceCounterpoints)
      .leftJoin(users, eq(opinionSentenceCounterpoints.authorUserId, users.id))
      .leftJoin(counterpointLikes, eq(counterpointLikes.counterpointId, opinionSentenceCounterpoints.id))
      .where(
        and(
          eq(opinionSentenceCounterpoints.opinionId, params.opinionId),
          eq(opinionSentenceCounterpoints.sentenceIndex, params.sentenceIndex),
          eq(opinionSentenceCounterpoints.status, 'approved')
        )
      )
      .groupBy(opinionSentenceCounterpoints.id, users.id)
      .orderBy(desc(sql`count(${counterpointLikes.id})`), desc(opinionSentenceCounterpoints.createdAt));

    return rows.map(r => ({
      ...r.counterpoint,
      author: r.author?.id ? r.author : null,
      likeCount: r.likeCount ?? 0,
      likedByMe: !!r.likedByMe,
    }));
  }

  async setCounterpointLike(params: { counterpointId: string; userId: string; like: boolean }) {
    if (!params.like) {
      await db
        .delete(counterpointLikes)
        .where(and(eq(counterpointLikes.counterpointId, params.counterpointId), eq(counterpointLikes.userId, params.userId)));
      return;
    }

    await db
      .insert(counterpointLikes)
      .values({ counterpointId: params.counterpointId, userId: params.userId })
      .onConflictDoNothing();
  }

  async getCounterpointById(counterpointId: string) {
    const [row] = await db
      .select()
      .from(opinionSentenceCounterpoints)
      .where(eq(opinionSentenceCounterpoints.id, counterpointId))
      .limit(1);
    return row ?? null;
  }

  async getOpinionById(opinionId: string) {
    const [row] = await db.select().from(opinions).where(eq(opinions.id, opinionId)).limit(1);
    return row ?? null;
  }

  async listCounterpointLikerIds(counterpointId: string) {
    const rows = await db
      .select({ userId: counterpointLikes.userId })
      .from(counterpointLikes)
      .where(eq(counterpointLikes.counterpointId, counterpointId));
    return rows.map(r => r.userId);
  }

  async getDebaterStatsForUsers(userIds: string[]) {
    if (userIds.length === 0) return new Map<string, { debaterRank: number }>();
    const rows = await db
      .select({
        userId: userDebateStats.userId,
        avgLogicalReasoning: userDebateStats.avgLogicalReasoning,
        avgPoliteness: userDebateStats.avgPoliteness,
        avgOpennessToChange: userDebateStats.avgOpennessToChange,
        totalVotesReceived: userDebateStats.totalVotesReceived,
        totalDebates: userDebateStats.totalDebates,
      })
      .from(userDebateStats)
      .where(inArray(userDebateStats.userId, userIds));

    // Simple composite score (0..500-ish): average of the three *plus* a small weight for experience.
    const result = new Map<string, { debaterRank: number }>();
    for (const r of rows) {
      const avg =
        ((r.avgLogicalReasoning || 0) + (r.avgPoliteness || 0) + (r.avgOpennessToChange || 0)) / 3; // values are *100
      const experience = Math.min(200, (r.totalVotesReceived || 0) + (r.totalDebates || 0) * 2);
      result.set(r.userId, { debaterRank: Math.round(avg + experience) });
    }
    return result;
  }
}

