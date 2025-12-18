import { db } from '../db.js';
import { liveStreams, topics } from '@shared/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import type { InsertLiveStream, LiveStream } from '@shared/schema';

export class LiveStreamRepository {
  async create(stream: InsertLiveStream): Promise<LiveStream> {
    const [created] = await db.insert(liveStreams).values(stream).returning();
    return created;
  }

  async findAll(status?: string, category?: string): Promise<LiveStream[]> {
    // If category filter is needed, we must join with topics
    if (category) {
      let conditions = [];

      // Add status filter if provided
      if (status) {
        conditions.push(eq(liveStreams.status, status));
      }

      // Add category filter
      conditions.push(sql`${category} = ANY(${topics.categories})`);

      // Join with topics to filter by category
      const streamsWithCategory = await db
        .select({
          id: liveStreams.id,
          topicId: liveStreams.topicId,
          title: liveStreams.title,
          description: liveStreams.description,
          moderatorId: liveStreams.moderatorId,
          status: liveStreams.status,
          participantSelectionMethod: liveStreams.participantSelectionMethod,
          scheduledAt: liveStreams.scheduledAt,
          startedAt: liveStreams.startedAt,
          endedAt: liveStreams.endedAt,
          viewerCount: liveStreams.viewerCount,
          createdAt: liveStreams.createdAt,
        })
        .from(liveStreams)
        .innerJoin(topics, eq(liveStreams.topicId, topics.id))
        .where(and(...conditions))
        .orderBy(desc(liveStreams.createdAt));

      return streamsWithCategory as LiveStream[];
    }

    // No category filter - just filter by status if provided
    if (status) {
      return await db
        .select()
        .from(liveStreams)
        .where(eq(liveStreams.status, status))
        .orderBy(desc(liveStreams.createdAt));
    }

    // No filters at all
    return await db
      .select()
      .from(liveStreams)
      .orderBy(desc(liveStreams.createdAt));
  }

  async findById(id: string): Promise<LiveStream | undefined> {
    const [stream] = await db.select().from(liveStreams).where(eq(liveStreams.id, id)).limit(1);
    return stream;
  }

  async findByUserId(userId: string, statusFilter?: string): Promise<LiveStream[]> {
    let conditions = [eq(liveStreams.moderatorId, userId)];

    if (statusFilter) {
      conditions.push(eq(liveStreams.status, statusFilter));
    }

    return await db
      .select()
      .from(liveStreams)
      .where(and(...conditions))
      .orderBy(desc(liveStreams.scheduledAt));
  }

  async updateStatus(id: string, status: string): Promise<void> {
    const updates: any = { status };
    if (status === 'live') {
      updates.startedAt = new Date();
    } else if (status === 'ended') {
      updates.endedAt = new Date();
    }

    await db
      .update(liveStreams)
      .set(updates)
      .where(eq(liveStreams.id, id));
  }
}

