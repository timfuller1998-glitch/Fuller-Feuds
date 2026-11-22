import { db } from '../db.js';
import { opinions, users, userProfiles } from '../../shared/schema.js';
import { eq, desc, and, sql } from 'drizzle-orm';
import { CumulativeOpinionRepository } from '../repositories/cumulativeOpinionRepository.js';
import { TopicRepository } from '../repositories/topicRepository.js';
import { AIService, sentencesFromSummary } from '../aiService.js';
import type { CumulativeOpinion } from '../../shared/schema.js';

export class CumulativeOpinionService {
  private cumulativeOpinionRepo = new CumulativeOpinionRepository();
  private topicRepo = new TopicRepository();
  private summaryRegenerationQueue = new Set<string>();
  private processingQueue = false;

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
    const existing = await this.getCumulativeOpinion(topicId);

    // If OpenAI failed or is unconfigured, do not overwrite a real stored summary
    // with the vote-count fallback. Keep the existing text and attach sentence citations to it.
    if (analysis.usedFallback && existing?.summary && !existing.summary.startsWith("Based on ") && !existing.summary.startsWith("Mock AI summary")) {
      console.warn(`[AI Summary] Keeping existing summary for topic ${topicId} because generation fell back`);
      const kept = await this.cumulativeOpinionRepo.upsert(topicId, {
        summary: existing.summary,
        summarySentences: sentencesFromSummary(existing.summary, formattedOpinions),
        keyPoints: existing.keyPoints,
        totalOpinions: analysis.totalOpinions,
        confidence: existing.confidence,
      });
      await this.refreshDistribution(topicId);
      return Object.assign(kept, { usedFallback: true });
    }

    // Save the cumulative opinion
    const saved = await this.cumulativeOpinionRepo.upsert(topicId, {
      summary: analysis.summary,
      summarySentences: analysis.summarySentences,
      keyPoints: analysis.keyPoints,
      totalOpinions: analysis.totalOpinions,
      confidence: analysis.confidence,
    });
    // The compass/tint distribution is only written onto an existing summary row, so a topic whose
    // first summary was created after its opinions never got one. Fill it in now.
    await this.refreshDistribution(topicId);
    return analysis.usedFallback ? Object.assign(saved, { usedFallback: true }) : saved;
  }

  private async refreshDistribution(topicId: string): Promise<void> {
    try {
      const { OpinionService } = await import('./opinionService.js');
      await new OpinionService().recalculateTopicDistributionNow(topicId);
    } catch (error) {
      console.error(`[AI Summary] Distribution update failed for topic ${topicId}:`, error);
    }
  }

  async refreshCumulativeOpinion(topicId: string): Promise<CumulativeOpinion> {
    // Always regenerate so sentence-level citations and the summary text stay current.
    return await this.generateCumulativeOpinion(topicId);
  }
}

