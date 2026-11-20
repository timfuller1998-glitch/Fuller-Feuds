import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db.js';
import { opinionAiFlags, opinions, users, topics } from '../../shared/schema.js';

export class AiFlagService {
  async flag(opinionId: string, userId: string): Promise<{ already: boolean }> {
    const [opinion] = await db.select({ id: opinions.id, userId: opinions.userId }).from(opinions).where(eq(opinions.id, opinionId)).limit(1);
    if (!opinion) throw Object.assign(new Error('Opinion not found'), { status: 404 });
    if (opinion.userId === userId) throw Object.assign(new Error('You cannot flag your own opinion'), { status: 400 });

    const [existing] = await db
      .select({ id: opinionAiFlags.id })
      .from(opinionAiFlags)
      .where(and(eq(opinionAiFlags.opinionId, opinionId), eq(opinionAiFlags.userId, userId)))
      .limit(1);
    if (existing) return { already: true };

    try {
      await db.insert(opinionAiFlags).values({ opinionId, userId });
    } catch (error: any) {
      if (error?.code === '23505') return { already: true };
      throw error;
    }
    return { already: false };
  }

  async unflag(opinionId: string, userId: string): Promise<void> {
    await db.delete(opinionAiFlags).where(and(eq(opinionAiFlags.opinionId, opinionId), eq(opinionAiFlags.userId, userId)));
  }

  async hasFlag(opinionId: string, userId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: opinionAiFlags.id })
      .from(opinionAiFlags)
      .where(and(eq(opinionAiFlags.opinionId, opinionId), eq(opinionAiFlags.userId, userId)))
      .limit(1);
    return !!row;
  }

  async flagsForUser(userId: string): Promise<string[]> {
    const rows = await db
      .select({ opinionId: opinionAiFlags.opinionId })
      .from(opinionAiFlags)
      .where(eq(opinionAiFlags.userId, userId));
    return rows.map((r) => r.opinionId);
  }

  async listForAdmins(): Promise<Array<{
    opinionId: string;
    topicId: string;
    topicTitle: string;
    excerpt: string;
    authorId: string;
    flagCount: number;
    lastFlaggedAt: Date | null;
  }>> {
    const rows = await db
      .select({
        opinionId: opinions.id,
        topicId: opinions.topicId,
        topicTitle: topics.title,
        content: opinions.content,
        authorId: opinions.userId,
        flagCount: sql<number>`count(${opinionAiFlags.id})::int`,
        lastFlaggedAt: sql<Date | null>`max(${opinionAiFlags.createdAt})`,
      })
      .from(opinionAiFlags)
      .innerJoin(opinions, eq(opinionAiFlags.opinionId, opinions.id))
      .innerJoin(topics, eq(opinions.topicId, topics.id))
      .groupBy(opinions.id, opinions.topicId, topics.title, opinions.content, opinions.userId)
      .orderBy(desc(sql`count(${opinionAiFlags.id})`), desc(sql`max(${opinionAiFlags.createdAt})`));

    return rows.map((r) => ({
      opinionId: r.opinionId,
      topicId: r.topicId,
      topicTitle: r.topicTitle,
      excerpt: (r.content || '').replace(/\s+/g, ' ').trim().slice(0, 180),
      authorId: r.authorId,
      flagCount: r.flagCount,
      lastFlaggedAt: r.lastFlaggedAt,
    }));
  }
}
