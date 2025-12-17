import { OpinionRepository } from '../repositories/opinionRepository';
import { UserRepository } from '../repositories/userRepository';
import { InteractionRepository } from '../repositories/interactionRepository';
import { AIService } from '../aiService';
import type { InsertOpinion, Opinion } from '@shared/schema';
import { getCache, setCache, cacheKey, CACHE_TTL } from './cacheService';
import { invalidateOpinionCache } from './cacheInvalidation';

export class OpinionService {
  private repository: OpinionRepository;
  private userRepository: UserRepository;
  private interactionRepository: InteractionRepository;

  constructor() {
    this.repository = new OpinionRepository();
    this.userRepository = new UserRepository();
    this.interactionRepository = new InteractionRepository();
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
    const opinion = await this.repository.create(data);

    // Mark that user has an opinion on this topic
    await this.interactionRepository.markHasOpinion(data.userId, data.topicId);

    // Trigger AI political compass analysis every 5 opinions
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
