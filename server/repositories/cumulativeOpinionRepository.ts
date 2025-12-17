import { db } from '../db';
import { cumulativeOpinions } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { CumulativeOpinion } from '@shared/schema';

export class CumulativeOpinionRepository {
  async findByTopicId(topicId: string): Promise<CumulativeOpinion | undefined> {
    const [cumulative] = await db
      .select()
      .from(cumulativeOpinions)
      .where(eq(cumulativeOpinions.topicId, topicId))
      .limit(1);
    return cumulative;
  }

  async upsert(topicId: string, data: Partial<CumulativeOpinion>): Promise<CumulativeOpinion> {
    const existing = await this.findByTopicId(topicId);

    if (existing) {
      const [updated] = await db
        .update(cumulativeOpinions)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(cumulativeOpinions.topicId, topicId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(cumulativeOpinions)
        .values({
          topicId,
          ...data,
          summary: data.summary || '',
        } as any)
        .returning();
      return created;
    }
  }
}
