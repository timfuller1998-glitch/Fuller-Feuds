import { OpinionRepository } from '../repositories/opinionRepository.js';
import { UserRepository } from '../repositories/userRepository.js';
import { InteractionRepository } from '../repositories/interactionRepository.js';
import { CumulativeOpinionService } from './cumulativeOpinionService.js';
import { AIService } from '../aiService.js';
import { lexiconAnalysisService } from './lexiconAnalysisService.js';
import { db } from '../db.js';
import { opinions, cumulativeOpinions } from '../../shared/schema.js';
import { eq, and, sql, asc } from 'drizzle-orm';
import type { InsertOpinion, Opinion } from '../../shared/schema.js';
import { getCache, setCache, cacheKey, CACHE_TTL } from './cacheService.js';
import { invalidateOpinionCache, invalidateTopicCache, invalidateCumulativeOpinionCache } from './cacheInvalidation.js';

export class OpinionService {
  private repository: OpinionRepository;
  private userRepository: UserRepository;
  private interactionRepository: InteractionRepository;
  private cumulativeOpinionService: CumulativeOpinionService;
  private distributionUpdateQueue = new Map<string, NodeJS.Timeout>();

  constructor() {
    this.repository = new OpinionRepository();
    this.userRepository = new UserRepository();
    this.interactionRepository = new InteractionRepository();
    this.cumulativeOpinionService = new CumulativeOpinionService();
  }

  async getOpinionsByTopic(topicId: string, options?: {
    userRole?: string;
    currentUserId?: string;
  }): Promise<Opinion[]> {
    const key = cacheKey('topic', topicId, 'opinions', options?.userRole, options?.currentUserId);
    
    // Try cache first
    const cached = await getCache<Opinion[]>(key);
    if (cached) {
      return cached;
    }

    // Fetch from repository
    const opinions = await this.repository.findByTopicId(topicId, options);
    
    // Cache for 2 minutes
    await setCache(key, opinions, CACHE_TTL.MEDIUM);
    
    return opinions;
  }

  async getOpinion(id: string): Promise<Opinion | null> {
    const key = cacheKey('opinion', id);
    
    // Try cache first
    const cached = await getCache<Opinion>(key);
    if (cached) {
      return cached;
    }

    // Fetch from repository
    const opinion = await this.repository.findById(id);
    
    if (!opinion) {
      return null;
    }

    // Cache for 3 minutes
    await setCache(key, opinion, CACHE_TTL.TOPIC_FULL);
    
    return opinion;
  }

  async createOpinion(data: InsertOpinion): Promise<Opinion> {
    // 1. Analyze taste/passion immediately (lexicon-based)
    const localAnalysis = lexiconAnalysisService.analyzeOpinionLocally(data.content);
    
    // 2. Create opinion with taste/passion scores
    // Explicitly exclude analyzedAt - it should only be set when AI analysis completes
    const { analyzedAt, ...dataWithoutAnalyzedAt } = data as any;
    const opinionData = {
      ...dataWithoutAnalyzedAt,
      tasteScore: localAnalysis.taste.score,
      passionScore: localAnalysis.passion.score,
      analysisConfidence: localAnalysis.confidence,
    };
    const opinion = await this.repository.create(opinionData);
    
    // 3. Mark that user has an opinion on this topic
    await this.interactionRepository.markHasOpinion(data.userId, data.topicId);
    
    // 4. Update topic distribution (debounced, handles partial distributions)
    await this.updateTopicDistribution(data.topicId);
    
    // 5. Check if summary regeneration needed (tiered, uses actual counts)
    await this.checkAndTriggerSummaryUpdate(data.topicId);
    
    // 6. Trigger AI political compass analysis every 5 opinions (existing logic)
    const profile = await this.userRepository.getProfile(data.userId);
    if (profile && profile.opinionCount && profile.opinionCount % 5 === 0) {
      console.log(`[Trigger AI Analysis] User ${data.userId} reached ${profile.opinionCount} opinions`);

      // Run analysis asynchronously
      this.analyzeUserPoliticalCompass(data.userId).catch(error => {
        console.error(`[AI Analysis ERROR] Failed to analyze political compass for user ${data.userId}:`, error);
      });
    }
    
    return opinion;
  }

  async updateOpinion(id: string, data: Partial<InsertOpinion>): Promise<Opinion> {
    const opinion = await this.repository.update(id, data);
    
    // Invalidate caches after updating opinion
    await invalidateOpinionCache(id, opinion.topicId);
    
    return opinion;
  }

  async updateOpinionCounts(id: string, likesCount: number, dislikesCount: number): Promise<void> {
    await this.repository.updateCounts(id, likesCount, dislikesCount);
  }

  async deleteOpinion(id: string): Promise<void> {
    // Get topicId before deleting for cache invalidation
    const opinion = await this.repository.findById(id);
    const topicId = opinion?.topicId;
    
    await this.repository.delete(id);
    
    // Invalidate caches after deleting opinion
    await invalidateOpinionCache(id, topicId);
  }

  async getRecentOpinions(limit = 50, userRole?: string, currentUserId?: string): Promise<Opinion[]> {
    const key = cacheKey('opinions', 'recent', limit, userRole, currentUserId);
    
    // Try cache first
    const cached = await getCache<Opinion[]>(key);
    if (cached) {
      return cached;
    }

    // Fetch from repository
    const opinions = await this.repository.getRecentOpinions(limit, userRole, currentUserId);
    
    // Cache for 1 minute (short TTL for recent data)
    await setCache(key, opinions, CACHE_TTL.SHORT);
    
    return opinions;
  }

  async updateTopicDistribution(topicId: string): Promise<void> {
    // Debounce: update after 2 seconds of no new opinions (prevents excessive updates)
    const existing = this.distributionUpdateQueue.get(topicId);
    if (existing) clearTimeout(existing);
    
    const timeout = setTimeout(async () => {
      await this.calculateAndUpdateDistribution(topicId);
      this.distributionUpdateQueue.delete(topicId);
    }, 2000);
    
    this.distributionUpdateQueue.set(topicId, timeout);
  }

  private async calculateAndUpdateDistribution(topicId: string): Promise<void> {
    // Use transaction for atomicity (prevents race conditions)
    await db.transaction(async (tx) => {
      // Calculate distribution from all available scores
      // Include opinions with taste/passion even if political scores missing (FILTER handles NULLs)
      const [distribution] = await tx.execute(sql<{
        avg_economic: number | null;
        avg_authoritarian: number | null;
        avg_taste: number | null;
        avg_passion: number | null;
        auth_cap: number;
        lib_cap: number;
        auth_soc: number;
        lib_soc: number;
        revulsion: number;
        aversion: number;
        neutral_taste: number;
        preference: number;
        delight: number;
        academic: number;
        measured: number;
        moderate_passion: number;
        passionate: number;
        aggressive: number;
      }>`
        SELECT 
          AVG(topic_economic_score) FILTER (WHERE topic_economic_score IS NOT NULL) as avg_economic,
          AVG(topic_authoritarian_score) FILTER (WHERE topic_authoritarian_score IS NOT NULL) as avg_authoritarian,
          AVG(taste_score) FILTER (WHERE taste_score IS NOT NULL) as avg_taste,
          AVG(passion_score) FILTER (WHERE passion_score IS NOT NULL) as avg_passion,
          -- Political quadrant counts (only count opinions with both scores)
          COUNT(*) FILTER (WHERE topic_economic_score > 20 AND topic_authoritarian_score > 20) as auth_cap,
          COUNT(*) FILTER (WHERE topic_economic_score > 20 AND topic_authoritarian_score < -20) as lib_cap,
          COUNT(*) FILTER (WHERE topic_economic_score < -20 AND topic_authoritarian_score > 20) as auth_soc,
          COUNT(*) FILTER (WHERE topic_economic_score < -20 AND topic_authoritarian_score < -20) as lib_soc,
          -- Taste distribution buckets (-100 to +100)
          COUNT(*) FILTER (WHERE taste_score < -50) as revulsion,
          COUNT(*) FILTER (WHERE taste_score >= -50 AND taste_score < -20) as aversion,
          COUNT(*) FILTER (WHERE taste_score >= -20 AND taste_score <= 20) as neutral_taste,
          COUNT(*) FILTER (WHERE taste_score > 20 AND taste_score <= 50) as preference,
          COUNT(*) FILTER (WHERE taste_score > 50) as delight,
          -- Passion distribution buckets (-100 to +100)
          COUNT(*) FILTER (WHERE passion_score < -50) as academic,
          COUNT(*) FILTER (WHERE passion_score >= -50 AND passion_score < -20) as measured,
          COUNT(*) FILTER (WHERE passion_score >= -20 AND passion_score <= 20) as moderate_passion,
          COUNT(*) FILTER (WHERE passion_score > 20 AND passion_score <= 50) as passionate,
          COUNT(*) FILTER (WHERE passion_score > 50) as aggressive
        FROM opinions
        WHERE topic_id = ${topicId}
          AND status IN ('approved', 'pending')
      `);
      
      // Calculate diversity scores (standard deviation normalized to 0-100)
      const tasteDiversity = await this.calculateDiversityScore(tx, topicId, 'taste_score');
      const passionDiversity = await this.calculateDiversityScore(tx, topicId, 'passion_score');
      
      // Update cumulative_opinions atomically
      await tx.update(cumulativeOpinions)
        .set({
          averageTasteScore: Math.round((distribution.avg_taste as number) || 0),
          averagePassionScore: Math.round((distribution.avg_passion as number) || 0),
          averageEconomicScore: Math.round((distribution.avg_economic as number) || 0),
          averageAuthoritarianScore: Math.round((distribution.avg_authoritarian as number) || 0),
          tasteDistribution: {
            revulsion: distribution.revulsion || 0,
            aversion: distribution.aversion || 0,
            neutral: distribution.neutral_taste || 0,
            preference: distribution.preference || 0,
            delight: distribution.delight || 0,
          },
          passionDistribution: {
            academic: distribution.academic || 0,
            measured: distribution.measured || 0,
            moderate: distribution.moderate_passion || 0,
            passionate: distribution.passionate || 0,
            aggressive: distribution.aggressive || 0,
          },
          politicalDistribution: {
            authoritarianCapitalist: distribution.auth_cap || 0,
            libertarianCapitalist: distribution.lib_cap || 0,
            authoritarianSocialist: distribution.auth_soc || 0,
            libertarianSocialist: distribution.lib_soc || 0,
          },
          tasteDiversity: Math.round(tasteDiversity),
          passionDiversity: Math.round(passionDiversity),
          updatedAt: sql`now()`
        })
        .where(eq(cumulativeOpinions.topicId, topicId));
    });
    
    // Invalidate caches after update
    await invalidateTopicCache(topicId);
    await invalidateCumulativeOpinionCache(topicId);
  }

  private async calculateDiversityScore(tx: any, topicId: string, scoreColumn: string): Promise<number> {
    const [result] = await tx.execute(sql<{ stddev: number | null; count: number }>`
      SELECT 
        STDDEV(${sql.raw(scoreColumn)}) as stddev,
        COUNT(*) as count
      FROM opinions
      WHERE topic_id = ${topicId}
        AND ${sql.raw(scoreColumn)} IS NOT NULL
        AND status IN ('approved', 'pending')
    `);
    
    if (!result.count || result.count < 2 || !result.stddev) return 0;
    
    // Normalize standard deviation to 0-100 scale
    // Max possible stddev for -100 to +100 range is ~57.7 (when evenly split)
    const normalized = Math.min(100, (result.stddev / 57.7) * 100);
    return normalized;
  }

  async checkAndTriggerSummaryUpdate(topicId: string): Promise<void> {
    // Get actual count from database (not from cumulativeOpinions which may be stale)
    const [last24hResult] = await db.execute(sql<{ count: number }>`
      SELECT COUNT(*)::integer as count
      FROM opinions
      WHERE topic_id = ${topicId}
        AND created_at > NOW() - INTERVAL '24 hours'
        AND status IN ('approved', 'pending')
    `);
    const last24h = (last24hResult as { count: number }).count;
    
    // Get last update time from cumulative opinion
    const existing = await this.cumulativeOpinionService.getCumulativeOpinion(topicId);
    const lastUpdateTime = existing?.updatedAt || new Date(0);
    
    // Count opinions created since last summary update
    const [sinceUpdateResult] = await db.execute(sql<{ count: number }>`
      SELECT COUNT(*)::integer as count
      FROM opinions
      WHERE topic_id = ${topicId}
        AND created_at > ${lastUpdateTime}
        AND status IN ('approved', 'pending')
    `);
    const opinionsSinceUpdate = (sinceUpdateResult as { count: number }).count;
    
    // Tier 1: Hot topic (>50 opinions/24h) - update every 10 new
    if (last24h > 50 && opinionsSinceUpdate >= 10) {
      await this.cumulativeOpinionService.refreshCumulativeOpinion(topicId);
    }
    // Tier 2: Active topic (10-50/24h) - update every 25 new
    else if (last24h > 10 && opinionsSinceUpdate >= 25) {
      await this.cumulativeOpinionService.refreshCumulativeOpinion(topicId);
    }
    // Tier 3: Cold topics handled by daily CRON
  }

  private async analyzeUserPoliticalCompass(userId: string): Promise<void> {
    try {
      // Get user's last 50 opinions for analysis
      // This would need to be implemented - for now just log
      console.log(`[AI Analysis] Analyzing political compass for user ${userId}`);
      // TODO: Implement AI analysis using AIService
    } catch (error) {
      console.error(`Failed to analyze political compass for user ${userId}:`, error);
    }
  }
}
