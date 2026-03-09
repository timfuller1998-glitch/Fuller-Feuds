import { db } from '../db.js';
import { opinions } from '../../shared/schema.js';
import { and, sql, eq, asc } from 'drizzle-orm';
import { AIService } from '../aiService.js';
import { TopicRepository } from '../repositories/topicRepository.js';
import type { Opinion } from '../../shared/schema.js';

/**
 * Batch processing service for political score analysis
 * Processes opinions in batches every 5 minutes to optimize AI API usage
 */
export class OpinionBatchService {
  private readonly BATCH_SIZE = 50;
  private readonly MAX_BATCHES_PER_RUN = 2; // Process up to 100 opinions per 5-min cycle
  private topicRepository: TopicRepository;
  
  private metrics = {
    totalProcessed: 0,
    totalFailed: 0,
    averageLatency: 0,
    lastRunTime: null as Date | null
  };

  constructor() {
    this.topicRepository = new TopicRepository();
  }
  
  async processPendingOpinions(): Promise<void> {
    const startTime = Date.now();
    let totalProcessed = 0;
    let batchNumber = 0;
    
    try {
      while (batchNumber < this.MAX_BATCHES_PER_RUN) {
        // Fetch oldest unscored opinions (handles backlog)
        const opinionsToProcess = await this.fetchUnscoredOpinions(this.BATCH_SIZE);
        
        if (opinionsToProcess.length === 0) {
          break; // No more opinions to process
        }
        
        try {
          // Group by topic for context
          const groupedByTopic = this.groupByTopic(opinionsToProcess);
          
          // Process each topic group
          for (const [topicId, topicOpinions] of groupedByTopic) {
            await this.processTopicBatch(topicId, topicOpinions);
          }
          
          totalProcessed += opinionsToProcess.length;
          batchNumber++;
          
          // If we got fewer than BATCH_SIZE, we're done
          if (opinionsToProcess.length < this.BATCH_SIZE) {
            break;
          }
        } catch (error) {
          console.error(`[Batch Processing] Error processing batch ${batchNumber}:`, error);
          // Mark opinions for retry (implement retry queue)
          await this.markForRetry(opinionsToProcess.map(o => o.id));
          throw error; // Re-throw to trigger alert/monitoring
        }
      }
      
      const latency = Date.now() - startTime;
      this.metrics.totalProcessed += totalProcessed;
      this.metrics.averageLatency = 
        (this.metrics.averageLatency + latency) / 2;
      this.metrics.lastRunTime = new Date();
      
      console.log(`[Batch Processing] Processed ${totalProcessed} opinions in ${batchNumber} batches, latency: ${latency}ms`);
    } catch (error) {
      this.metrics.totalFailed++;
      throw error;
    }
  }
  
  private async fetchUnscoredOpinions(limit: number): Promise<Opinion[]> {
    return await db
      .select()
      .from(opinions)
      .where(
        and(
          sql`${opinions.topicEconomicScore} IS NULL`,
          sql`${opinions.status} IN ('approved', 'pending')`
        )
      )
      .orderBy(asc(opinions.createdAt)) // Oldest first (FIFO)
      .limit(limit);
  }
  
  private groupByTopic(opinions: Opinion[]): Map<string, Opinion[]> {
    const grouped = new Map<string, Opinion[]>();
    for (const opinion of opinions) {
      const existing = grouped.get(opinion.topicId) || [];
      existing.push(opinion);
      grouped.set(opinion.topicId, existing);
    }
    return grouped;
  }
  
  private async processTopicBatch(topicId: string, topicOpinions: Opinion[]): Promise<void> {
    // Get topic for context
    const topic = await this.topicRepository.findById(topicId);
    if (!topic) {
      throw new Error(`Topic ${topicId} not found`);
    }
    
    // Batch analyze opinions
    const results = await AIService.batchAnalyzeOpinions(
      topic,
      topicOpinions.map(o => ({ id: o.id, content: o.content }))
    );
    
    // Update opinions atomically in transaction
    await db.transaction(async (tx) => {
      for (const result of results) {
        await tx.update(opinions)
          .set({
            topicEconomicScore: result.economicScore,
            topicAuthoritarianScore: result.authoritarianScore,
            analyzedAt: sql`now()`
          })
          .where(eq(opinions.id, result.opinionId));
      }
    });
    
    // Trigger distribution update after batch completes (import dynamically to avoid circular dependency)
    const { OpinionService } = await import('./opinionService.js');
    const opinionService = new OpinionService();
    await opinionService.updateTopicDistribution(topicId);
  }
  
  private async markForRetry(opinionIds: string[]): Promise<void> {
    // TODO: Implement retry queue table or in-memory queue with persistence
    // For now, just log - opinions will be retried in next batch run
    console.warn(`[Batch Processing] Marked ${opinionIds.length} opinions for retry`);
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalProcessed / 
        (this.metrics.totalProcessed + this.metrics.totalFailed || 1)
    };
  }
}

