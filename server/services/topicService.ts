import { TopicRepository } from '../repositories/topicRepository';
import { OpinionService } from './opinionService';
import { AIService } from '../aiService';
import type { InsertTopic, TopicWithCounts, InsertOpinion, TopicInsert } from '@shared/schema';
import { withCache, getCache, setCache, cacheKey, CACHE_TTL } from './cacheService';
import { invalidateTopicCache, invalidateTopicsListCache } from './cacheInvalidation';

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

  async getTopic(id: string): Promise<TopicWithCounts | null> {
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
    
    return topic;
  }

  async createTopic(
    data: {
      title: string;
      description?: string;
      categories?: string[];
      imageUrl?: string | null;
      isActive?: boolean;
      status?: string;
      embedding?: any;
      initialOpinion?: string;
      references?: string[];
      stance?: string; // Accept but ignore
    },
    userId: string
  ): Promise<TopicWithCounts> {
    // Extract opinion-related fields that shouldn't be in topic data
    const { initialOpinion, references, stance, categories: userCategories, ...topicData } = data;

    // Use initialOpinion as description if provided, otherwise use title as fallback
    // Description is required by schema, so we always provide one
    const description = initialOpinion?.trim() || data.title || 'No description provided';

    // Handle categories: use provided categories if available, otherwise generate AI categories
    let categories: string[] = [];
    if (userCategories && Array.isArray(userCategories) && userCategories.length > 0) {
      categories = userCategories.slice(0, 5); // Limit to 5 categories
      // If less than 3 categories, supplement with AI-generated ones
      if (categories.length < 3) {
        try {
          const aiCategories = await AIService.generateCategories(data.title);
          // Merge unique categories, prioritizing user-provided ones
          const allCategories = [...categories];
          for (const aiCat of aiCategories) {
            if (!allCategories.includes(aiCat) && allCategories.length < 5) {
              allCategories.push(aiCat);
            }
          }
          categories = allCategories.slice(0, 5);
        } catch (error) {
          console.error('Error generating AI categories, using user categories only:', error);
        }
      }
    } else {
      // No user categories provided, generate AI categories
      try {
        categories = await AIService.generateCategories(data.title);
      } catch (error) {
        console.error('Error generating AI categories, using defaults:', error);
        // Fallback to default categories if AI generation fails
        categories = ['General', 'Politics', 'Society'];
      }
    }

    // Build topic data with only valid database fields (excluding extended schema fields)
    const finalTopicData: TopicInsert = {
      title: data.title,
      description,
      categories,
      createdById: userId,
      ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.embedding !== undefined && { embedding: data.embedding }),
    };

    const topic = await this.repository.create(finalTopicData);

    // Invalidate caches after creating topic
    await invalidateTopicsListCache();

    // Create initial opinion if provided
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

    // Return enriched topic
    return await this.getTopic(topic.id) as TopicWithCounts;
  }

  async updateEmbedding(topicId: string, embedding: number[]): Promise<void> {
    await this.repository.updateEmbedding(topicId, embedding);
  }

  async deleteTopic(id: string): Promise<void> {
    await this.repository.delete(id);
    // Invalidate caches after deleting topic
    await invalidateTopicCache(id);
    await invalidateTopicsListCache();
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
