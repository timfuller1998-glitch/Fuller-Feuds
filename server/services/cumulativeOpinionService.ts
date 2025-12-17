import { db } from '../db';
import { opinions, users, userProfiles } from '@shared/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { CumulativeOpinionRepository } from '../repositories/cumulativeOpinionRepository';
import { TopicRepository } from '../repositories/topicRepository';
import { AIService } from '../aiService';
import type { CumulativeOpinion } from '@shared/schema';

export class CumulativeOpinionService {
  private cumulativeOpinionRepo = new CumulativeOpinionRepository();
  private topicRepo = new TopicRepository();

  async getCumulativeOpinion(topicId: string): Promise<CumulativeOpinion | undefined> {
    return await this.cumulativeOpinionRepo.findByTopicId(topicId);
  }

  async generateCumulativeOpinion(topicId: string): Promise<CumulativeOpinion> {
    // Get the topic and all opinions
    const topic = await this.topicRepo.findById(topicId);
    if (!topic) {
      throw new Error("Topic not found");
    }

    // Get ALL opinions including private ones for cumulative analysis
    const allOpinions = await db
      .select({
        opinion: opinions,
        author: users,
        profile: userProfiles
      })
      .from(opinions)
      .leftJoin(users, eq(opinions.userId, users.id))
      .leftJoin(userProfiles, eq(opinions.userId, userProfiles.userId))
      .where(
        and(
          eq(opinions.topicId, topicId),
          // Include both approved and pending opinions for analysis
          // (pending opinions are user-created and should be included)
          sql`${opinions.status} IN ('approved', 'pending')`
        )
      )
      .orderBy(desc(opinions.createdAt));

    const formattedOpinions = allOpinions.map(row => ({
      ...row.opinion,
      author: row.author,
      profile: row.profile
    }));

    // Generate AI analysis using all opinions
    const analysis = await AIService.generateCumulativeOpinion(topic, formattedOpinions);

    // Save the cumulative opinion
    return await this.cumulativeOpinionRepo.upsert(topicId, {
      summary: analysis.summary,
      keyPoints: analysis.keyPoints,
      totalOpinions: analysis.totalOpinions,
      confidence: analysis.confidence,
    });
  }

  async refreshCumulativeOpinion(topicId: string): Promise<CumulativeOpinion> {
    // Smart regeneration: only update if new opinions exist since last summary
    const existingSummary = await this.getCumulativeOpinion(topicId);

    if (existingSummary) {
      // Check if there are any new opinions since the last summary update
      const latestOpinion = await db
        .select({ createdAt: opinions.createdAt })
        .from(opinions)
        .where(
          and(
            eq(opinions.topicId, topicId),
            sql`${opinions.status} IN ('approved', 'pending')`
          )
        )
        .orderBy(desc(opinions.createdAt))
        .limit(1);

      if (latestOpinion.length === 0) {
        // No opinions exist, return existing summary
        return existingSummary;
      }

      const latestOpinionDate = latestOpinion[0].createdAt;
      const summaryDate = existingSummary.updatedAt;

      // Only regenerate if there are new opinions since the last update
      if (latestOpinionDate && summaryDate && latestOpinionDate <= summaryDate) {
        console.log(`[AI Summary] No new opinions for topic ${topicId} since last summary, skipping regeneration`);
        return existingSummary;
      }
    }

    // Generate new summary (either no existing summary or new opinions exist)
    return await this.generateCumulativeOpinion(topicId);
  }
}

