import { TopicRepository } from '../repositories/topicRepository.js';
import { OpinionService } from './opinionService.js';
import { AIService } from '../aiService.js';
import type { InsertTopic, TopicWithCounts, InsertOpinion, TopicInsert } from '../../shared/schema.js';
import { withCache, getCache, setCache, cacheKey, CACHE_TTL } from './cacheService.js';
import { invalidateTopicCache, invalidateTopicsListCache } from './cacheInvalidation.js';
import { logSecurityEvent } from '../utils/securityLogger.js';
import { normalizeHome, GENERAL_SUB_ID } from '../../shared/topicTaxonomy.js';
import { ForbiddenError } from '../utils/securityErrors.js';
import type { Request } from 'express';

export class TopicService {
  private repository: TopicRepository;
  private opinionService: OpinionService;

  constructor() {
    this.repository = new TopicRepository();
    this.opinionService = new OpinionService();
  }

  async getTopics(options?: {
    limit?: number;
    category?: string;
    search?: string;
    createdBy?: string;
  }): Promise<TopicWithCounts[]> {
    const key = cacheKey('topics', 'list', options?.limit, options?.category, options?.search, options?.createdBy);
    
    // Try cache first
    const cached = await getCache<TopicWithCounts[]>(key);
    if (cached) {
      return cached;
    }

    // Fetch from repository
    const topics = await this.repository.findWithFilters(options);
    
    // Cache for 2 minutes
    await setCache(key, topics, CACHE_TTL.MEDIUM);
    
    return topics;
  }

  async getTopic(
    id: string,
    requestingUserId?: string,
    requestingUserRole?: string,
    req?: Request
  ): Promise<TopicWithCounts | null> {
    const startTime = Date.now();
    
    // Log service entry for security-critical operations
    if (requestingUserId) {
      logSecurityEvent('info', 'data_access', {
        userId: requestingUserId,
        userRole: requestingUserRole,
        action: 'get_topic',
        resourceType: 'topic',
        resourceId: id,
        ipAddress: req?.ip || req?.connection?.remoteAddress,
        userAgent: req?.headers['user-agent'],
        requestId: req?.id,
        metadata: { service: 'TopicService', method: 'getTopic' }
      });
    }
    
    try {
      const key = cacheKey('topic', id, 'full');
      
      // Try cache first
      const cached = await getCache<TopicWithCounts>(key);
      if (cached) {
        return cached;
      }

      // Fetch from repository
      const topic = await this.repository.findByIdWithCounts(id);
      
      if (!topic) {
        return null;
      }

      // Cache for 3 minutes
      await setCache(key, topic, CACHE_TTL.TOPIC_FULL);
      
      // Log slow operations
      const duration = Date.now() - startTime;
      if (duration > 1000) {
        logSecurityEvent('warn', 'database_operation', {
          userId: requestingUserId,
          action: 'get_topic',
          metadata: { duration, service: 'TopicService' }
        });
      }
      
      return topic;
    } catch (error) {
      logSecurityEvent('error', 'database_operation', {
        userId: requestingUserId,
        action: 'get_topic',
        error: error instanceof Error ? error.message : String(error),
        metadata: { service: 'TopicService' }
      });
      throw error;
    }
  }

  async createTopic(
    data: {
      title: string;
      description?: string;
      categories?: string[];
      homeMajor?: string | null;
      homeSub?: string | null;
      imageUrl?: string | null;
      isActive?: boolean;
      status?: string;
      embedding?: any;
      initialOpinion?: string;
      references?: string[];
      stance?: string; // Accept but ignore
      sourceUrl?: string | null;
    },
    userId: string,
    requestingUserId?: string,
    requestingUserRole?: string,
    req?: Request
  ): Promise<TopicWithCounts> {
    const startTime = Date.now();
    
    // Log service entry for security-critical operations
    if (requestingUserId) {
      logSecurityEvent('info', 'data_access', {
        userId: requestingUserId,
        userRole: requestingUserRole,
        action: 'create_topic',
        resourceType: 'topic',
        ipAddress: req?.ip || req?.connection?.remoteAddress,
        userAgent: req?.headers['user-agent'],
        requestId: req?.id,
        metadata: { service: 'TopicService', method: 'createTopic' }
      });
    }
    
    try {
      // Extract opinion-related fields that shouldn't be in topic data
      const { initialOpinion, references, stance, categories: userCategories, ...topicData } = data; // eslint-disable-line @typescript-eslint/no-unused-vars

      // Prefer an explicit topic description (e.g. drafted from a source link), then the opening opinion, then the title.
      const description = data.description?.trim() || initialOpinion?.trim() || data.title || 'No description provided';

      // Official home group + optional extra tags.
      // The author's picked home wins when it is on the official list. Otherwise the AI picks from the
      // official list (validated), falling back to alias/keyword matching, then the closest major's General.
      // Free-form tags are optional extras (max 5); the AI offers a few when the author gave none.
      let categories: string[] = Array.isArray(userCategories)
        ? [...new Set(userCategories.map((c) => String(c).trim()).filter(Boolean))].slice(0, 5)
        : [];
      let home = normalizeHome(data.homeMajor, data.homeSub);
      if (!home) {
        const suggestion = await AIService.suggestTopicHome(data.title, description, categories);
        if (!home) home = { majorId: suggestion.majorId, subId: suggestion.subId };
        if (categories.length === 0) categories = suggestion.tags.slice(0, 5);
      }

      // Build topic data with only valid database fields (excluding extended schema fields)
      const sourceUrl = data.sourceUrl?.trim() || null;

      const finalTopicData: TopicInsert = {
        title: data.title,
        description,
        categories,
        homeMajor: home.majorId,
        homeSub: home.subId,
        createdById: userId,
        ...(sourceUrl ? { sourceUrl } : {}),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.embedding !== undefined && { embedding: data.embedding }),
      };

      const topic = await this.repository.create(finalTopicData);

      // Generate embedding for semantic search (async, don't block topic creation)
      this.generateAndStoreEmbedding(topic.id, `${data.title} ${description}`).catch(error => {
        console.error(`[TopicService] Error generating embedding for topic ${topic.id}:`, error);
      });

      // Invalidate caches after creating topic
      await invalidateTopicsListCache();

      // Create initial opinion if provided
      // Note: Do NOT pass security context to opinionService (per user preference)
      if (initialOpinion && initialOpinion.trim()) {
        try {
          // Filter and validate references
          let validReferences: string[] | undefined;
          if (references && references.length > 0) {
            validReferences = references
              .filter(ref => ref.trim() !== '')
              .filter(ref => {
                try {
                  new URL(ref);
                  return true;
                } catch {
                  console.warn(`Invalid reference URL: ${ref}`);
                  return false;
                }
              });
            if (validReferences.length === 0) {
              validReferences = undefined;
            }
          }

          const opinionData: InsertOpinion = {
            topicId: topic.id,
            userId,
            content: initialOpinion.trim(),
            references: validReferences,
            status: 'approved',
            debateStatus: 'open', // Set explicitly to ensure it's included
          };
          // Do NOT pass security context to opinionService (per user preference)
          const createdOpinion = await this.opinionService.createOpinion(opinionData);
          console.log(`[TopicService] Successfully created initial opinion ${createdOpinion.id} for topic ${topic.id}`);
        } catch (error) {
          console.error('[TopicService] Error creating initial opinion:', error);
          if (error instanceof Error) {
            console.error('[TopicService] Error message:', error.message);
            console.error('[TopicService] Error stack:', error.stack);
          }
          // Don't fail topic creation if opinion creation fails
        }
      }

      // Return enriched topic - pass through security context
      const enrichedTopic = await this.getTopic(topic.id, requestingUserId, requestingUserRole, req) as TopicWithCounts;
      
      // Log slow operations
      const duration = Date.now() - startTime;
      if (duration > 1000) {
        logSecurityEvent('warn', 'database_operation', {
          userId: requestingUserId,
          action: 'create_topic',
          metadata: { duration, service: 'TopicService' }
        });
      }
      
      return enrichedTopic;
    } catch (error) {
      logSecurityEvent('error', 'database_operation', {
        userId: requestingUserId,
        action: 'create_topic',
        error: error instanceof Error ? error.message : String(error),
        metadata: { service: 'TopicService' }
      });
      throw error;
    }
  }

  async updateEmbedding(topicId: string, embedding: number[]): Promise<void> {
    // Update both JSONB embedding (backup) and vector embedding (for pgvector)
    await this.repository.updateEmbedding(topicId, embedding);
    try {
      await this.repository.updateEmbeddingVector(topicId, embedding);
    } catch (error) {
      // Log but don't fail if pgvector update fails (JSONB embedding still works)
      console.warn(`[TopicService] Failed to update vector embedding for topic ${topicId}, but JSONB embedding was saved:`, error);
    }
  }

  /**
   * Generate embedding and store in both JSONB and vector formats
   */
  private async generateAndStoreEmbedding(topicId: string, text: string): Promise<void> {
    try {
      const embedding = await AIService.generateEmbedding(text);
      await this.updateEmbedding(topicId, embedding);
    } catch (error) {
      console.error(`[TopicService] Failed to generate embedding for topic ${topicId}:`, error);
      throw error;
    }
  }

  /** Admin: move a topic to another official home (major + sub). Official groups only. */
  async setTopicHome(topicId: string, major: string, sub?: string | null): Promise<{ homeMajor: string; homeSub: string }> {
    const home = normalizeHome(major, sub);
    if (!home) throw new Error('Not an official group');
    // An unknown sub is rejected, not silently turned into General.
    if (sub && home.subId === GENERAL_SUB_ID && String(sub).trim().toLowerCase() !== GENERAL_SUB_ID) {
      throw new Error('Not an official sub-group');
    }
    await this.repository.setHome(topicId, home.majorId, home.subId);
    await invalidateTopicCache(topicId);
    await invalidateTopicsListCache();
    return { homeMajor: home.majorId, homeSub: home.subId };
  }

  async lastActivityByTopicIds(ids: string[]): Promise<Map<string, Date | null>> {
    return this.repository.lastActivityByTopicIds(ids);
  }

  /**
   * Permanently delete a topic and its dependent rows.
   * When requestingUserId is passed, only the author or an admin may delete it.
   */
  async deleteTopic(id: string, requestingUserId?: string, requestingUserRole?: string): Promise<void> {
    const topic = await this.repository.findById(id);
    if (!topic) throw new Error('Topic not found');
    if (requestingUserId) {
      const allowed = topic.createdById === requestingUserId || requestingUserRole === 'admin';
      if (!allowed) throw new ForbiddenError('You can only delete a topic you created');
    }
    const { userIds } = await this.repository.hardDelete(id);
    await invalidateTopicCache(id);
    await invalidateTopicsListCache();
    for (const userId of userIds) {
      await this.opinionService.recountUserOpinionsAndRefreshCompass(userId);
    }
  }

  async searchTopics(query: string, options?: {
    limit?: number;
    category?: string;
  }): Promise<TopicWithCounts[]> {
    const key = cacheKey('topics', 'search', query, options?.limit, options?.category);
    
    // Try cache first
    const cached = await getCache<TopicWithCounts[]>(key);
    if (cached) {
      return cached;
    }

    // Fetch from repository
    const topics = await this.repository.findWithFilters({
      ...options,
      search: query,
    });
    
    // Cache for 1 minute (short TTL for search)
    await setCache(key, topics, CACHE_TTL.SHORT);
    
    return topics;
  }

  async getTopicsByCategory(category: string, limit = 50): Promise<TopicWithCounts[]> {
    const key = cacheKey('topics', 'category', category, limit);
    
    // Try cache first
    const cached = await getCache<TopicWithCounts[]>(key);
    if (cached) {
      return cached;
    }

    // Fetch from repository
    const topics = await this.repository.findWithFilters({
      category,
      limit,
    });
    
    // Cache for 2 minutes
    await setCache(key, topics, CACHE_TTL.MEDIUM);
    
    return topics;
  }
}
