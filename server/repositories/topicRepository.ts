import { db } from '../db.js';
import { topics, opinions, opinionVotes, topicFlags, users } from '../../shared/schema.js';
import { eq, desc, and, sql, count } from 'drizzle-orm';

import type { InsertTopic, Topic, TopicWithCounts, TopicInsert } from '../../shared/schema.js';
import { getCache, setCache, cacheKey, CACHE_TTL } from '../services/cacheService.js';
import { AIService } from '../aiService.js';


export class TopicRepository {
  async create(topic: TopicInsert): Promise<Topic> {
    const [created] = await db.insert(topics).values(topic).returning();
    return created;
  }

  async findById(id: string): Promise<Topic | undefined> {
    const [topic] = await db.select().from(topics).where(eq(topics.id, id)).limit(1);
    return topic;
  }

  async findByIdWithCounts(id: string): Promise<TopicWithCounts | undefined> {
    const topic = await this.findById(id);
    if (!topic) return undefined;

    const counts = await this.getTopicCounts(id);
    const preview = await this.getTopicPreview(id);
    
    // Get cumulative opinion for distribution data
    const { CumulativeOpinionRepository } = await import('./cumulativeOpinionRepository.js');
    const cumulativeRepo = new CumulativeOpinionRepository();
    const cumulative = await cumulativeRepo.findByTopicId(id);

    return {
      ...topic,
      opinionsCount: counts.opinionsCount,
      participantCount: counts.participantCount,
      previewContent: preview.content,
      previewAuthor: preview.author,
      previewIsAI: preview.isAI,
      diversityScore: cumulative?.diversityScore ?? 0,
      avgTasteScore: typeof cumulative?.averageTasteScore === 'number' ? cumulative.averageTasteScore : undefined,
      avgPassionScore: typeof cumulative?.averagePassionScore === 'number' ? cumulative.averagePassionScore : undefined,
      politicalDistribution: (() => {
        const dist = cumulative?.politicalDistribution;
        if (
          dist &&
          typeof dist === 'object' &&
          dist !== null &&
          'authoritarianCapitalist' in dist &&
          'authoritarianSocialist' in dist &&
          'libertarianCapitalist' in dist &&
          'libertarianSocialist' in dist &&
          typeof (dist as any).authoritarianCapitalist === 'number' &&
          typeof (dist as any).authoritarianSocialist === 'number' &&
          typeof (dist as any).libertarianCapitalist === 'number' &&
          typeof (dist as any).libertarianSocialist === 'number'
        ) {
          return {
            authoritarianCapitalist: (dist as any).authoritarianCapitalist,
            authoritarianSocialist: (dist as any).authoritarianSocialist,
            libertarianCapitalist: (dist as any).libertarianCapitalist,
            libertarianSocialist: (dist as any).libertarianSocialist,
          };
        }
        return {
          authoritarianCapitalist: 0,
          authoritarianSocialist: 0,
          libertarianCapitalist: 0,
          libertarianSocialist: 0,
        };
      })(),
    };
  }

  async findWithFilters(options?: {
    limit?: number;
    category?: string;
    search?: string;
    createdBy?: string;
  }): Promise<TopicWithCounts[]> {
    const { limit = 50, category, search, createdBy } = options || {};
    let conditions = [eq(topics.isActive, true)];

    if (category) {
      conditions.push(sql`${category} = ANY(${topics.categories})`);
    }

    if (search) {
      conditions.push(
        sql`${topics.title} ILIKE ${`%${search}%`} OR ${topics.description} ILIKE ${`%${search}%`}`
      );
    }

    if (createdBy) {
      conditions.push(eq(topics.createdById, createdBy));
    }

    const topicsList = await db
      .select()
      .from(topics)
      .where(and(...conditions))
      .orderBy(desc(topics.createdAt))
      .limit(limit);

    // Get counts for each topic
    const { CumulativeOpinionRepository } = await import('./cumulativeOpinionRepository.js');
    const cumulativeRepo = new CumulativeOpinionRepository();
    
    const topicsWithCounts = await Promise.all(
      topicsList.map(async (topic) => {
        const counts = await this.getTopicCounts(topic.id);
        const preview = await this.getTopicPreview(topic.id);
        const cumulative = await cumulativeRepo.findByTopicId(topic.id);

        return {
          ...topic,
          opinionsCount: counts.opinionsCount,
          participantCount: counts.participantCount,
          previewContent: preview.content,
          previewAuthor: preview.author,
          previewIsAI: preview.isAI,
          diversityScore: cumulative?.diversityScore ?? 0,
          avgTasteScore: typeof cumulative?.averageTasteScore === 'number' ? cumulative.averageTasteScore : undefined,
          avgPassionScore: typeof cumulative?.averagePassionScore === 'number' ? cumulative.averagePassionScore : undefined,
          politicalDistribution: (() => {
            const dist = cumulative?.politicalDistribution;
            if (
              dist &&
              typeof dist === 'object' &&
              dist !== null &&
              'authoritarianCapitalist' in dist &&
              'authoritarianSocialist' in dist &&
              'libertarianCapitalist' in dist &&
              'libertarianSocialist' in dist &&
              typeof (dist as any).authoritarianCapitalist === 'number' &&
              typeof (dist as any).authoritarianSocialist === 'number' &&
              typeof (dist as any).libertarianCapitalist === 'number' &&
              typeof (dist as any).libertarianSocialist === 'number'
            ) {
              return {
                authoritarianCapitalist: (dist as any).authoritarianCapitalist,
                authoritarianSocialist: (dist as any).authoritarianSocialist,
                libertarianCapitalist: (dist as any).libertarianCapitalist,
                libertarianSocialist: (dist as any).libertarianSocialist,
              };
            }
            return {
              authoritarianCapitalist: 0,
              authoritarianSocialist: 0,
              libertarianCapitalist: 0,
              libertarianSocialist: 0,
            };
          })(),
        };
      })
    );

    // Convert any `null` values in avgTasteScore and avgPassionScore to `undefined`
    // to satisfy the TopicWithCounts type expectation (`number | undefined`, not `number | null | undefined`)
    // Also ensure politicalDistribution is properly typed
    const normalizedTopicsWithCounts: TopicWithCounts[] = topicsWithCounts.map(t => {
      const dist = t.politicalDistribution;
      const validDist: {
        authoritarianCapitalist: number;
        authoritarianSocialist: number;
        libertarianCapitalist: number;
        libertarianSocialist: number;
      } = (
        dist &&
        typeof dist === 'object' &&
        'authoritarianCapitalist' in dist &&
        'authoritarianSocialist' in dist &&
        'libertarianCapitalist' in dist &&
        'libertarianSocialist' in dist &&
        typeof (dist as any).authoritarianCapitalist === 'number' &&
        typeof (dist as any).authoritarianSocialist === 'number' &&
        typeof (dist as any).libertarianCapitalist === 'number' &&
        typeof (dist as any).libertarianSocialist === 'number'
      ) ? {
        authoritarianCapitalist: (dist as any).authoritarianCapitalist,
        authoritarianSocialist: (dist as any).authoritarianSocialist,
        libertarianCapitalist: (dist as any).libertarianCapitalist,
        libertarianSocialist: (dist as any).libertarianSocialist,
      } : {
        authoritarianCapitalist: 0,
        authoritarianSocialist: 0,
        libertarianCapitalist: 0,
        libertarianSocialist: 0,
      };
      
      return {
        ...t,
        avgTasteScore: t.avgTasteScore === null ? undefined : t.avgTasteScore,
        avgPassionScore: t.avgPassionScore === null ? undefined : t.avgPassionScore,
        politicalDistribution: validDist,
      } as TopicWithCounts;
    });

    return normalizedTopicsWithCounts;
  }

  async updateEmbedding(topicId: string, embedding: number[]): Promise<void> {
    await db
      .update(topics)
      .set({ embedding: embedding as any })
      .where(eq(topics.id, topicId));
  }

  async findWithoutEmbeddings(limit?: number): Promise<Topic[]> {
    const topicsList = await db
      .select()
      .from(topics)
      .where(and(
        eq(topics.isActive, true),
        sql`${topics.embedding} IS NULL`
      ))
      .orderBy(desc(topics.createdAt))
      .limit(limit || 1000);
    
    return topicsList;
  }

  async delete(id: string): Promise<void> {
    await db.update(topics)
      .set({ isActive: false })
      .where(eq(topics.id, id));
  }

  async countByUser(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(topics)
      .where(and(
        eq(topics.createdById, userId),
        eq(topics.isActive, true)
      ));
    return Number(result[0].count);
  }

  async findWithEmbeddings(): Promise<TopicWithCounts[]> {
    const topicsList = await db
      .select()
      .from(topics)
      .where(and(
        eq(topics.isActive, true),
        sql`${topics.embedding} IS NOT NULL`
      ))
      .orderBy(desc(topics.createdAt));

    // Get counts for each topic (simplified version)
    const { CumulativeOpinionRepository } = await import('./cumulativeOpinionRepository.js');
    const cumulativeRepo = new CumulativeOpinionRepository();
    
    const topicsWithCounts = await Promise.all(
      topicsList.map(async (topic) => {
        const counts = await this.getTopicCounts(topic.id);
        const preview = await this.getTopicPreview(topic.id);
        const cumulative = await cumulativeRepo.findByTopicId(topic.id);

        const avgTaste = cumulative?.averageTasteScore;
        const avgPassion = cumulative?.averagePassionScore;
        
        return {
          ...topic,
          opinionsCount: counts.opinionsCount,
          participantCount: counts.participantCount,
          previewContent: preview.content,
          previewAuthor: preview.author,
          previewIsAI: preview.isAI,
          diversityScore: cumulative?.diversityScore ?? 0,
          avgTasteScore: typeof avgTaste === 'number' ? avgTaste : (avgTaste === null ? undefined : undefined),
          avgPassionScore: typeof avgPassion === 'number' ? avgPassion : (avgPassion === null ? undefined : undefined),
          politicalDistribution: (() => {
            const dist = cumulative?.politicalDistribution;
            if (
              dist &&
              typeof dist === 'object' &&
              dist !== null &&
              'authoritarianCapitalist' in dist &&
              'authoritarianSocialist' in dist &&
              'libertarianCapitalist' in dist &&
              'libertarianSocialist' in dist &&
              typeof (dist as any).authoritarianCapitalist === 'number' &&
              typeof (dist as any).authoritarianSocialist === 'number' &&
              typeof (dist as any).libertarianCapitalist === 'number' &&
              typeof (dist as any).libertarianSocialist === 'number'
            ) {
              return {
                authoritarianCapitalist: (dist as any).authoritarianCapitalist,
                authoritarianSocialist: (dist as any).authoritarianSocialist,
                libertarianCapitalist: (dist as any).libertarianCapitalist,
                libertarianSocialist: (dist as any).libertarianSocialist,
              };
            }
            return {
              authoritarianCapitalist: 0,
              authoritarianSocialist: 0,
              libertarianCapitalist: 0,
              libertarianSocialist: 0,
            };
          })(),
        };
      })
    );

    return topicsWithCounts;
  }

  async findSimilarByEmbedding(queryEmbedding: number[], similarityThreshold: number = 0.85): Promise<Topic[]> {
    // Get all topics with embeddings
    const topicsWithEmbeddings = await db
      .select()
      .from(topics)
      .where(and(
        eq(topics.isActive, true),
        sql`${topics.embedding} IS NOT NULL`
      ));

    // Import AIService for cosine similarity
    const { AIService } = await import('../aiService.js');

    // Calculate similarity for each topic
    const similarTopics: { topic: Topic; similarity: number }[] = [];

    for (const topic of topicsWithEmbeddings) {
      if (!topic.embedding || !Array.isArray(topic.embedding)) continue;
      
      const similarity = AIService.cosineSimilarity(queryEmbedding, topic.embedding as number[]);
      
      if (similarity >= similarityThreshold) {
        similarTopics.push({ topic, similarity });
      }
    }

    // Sort by similarity (highest first) and return just the topics
    return similarTopics
      .sort((a, b) => b.similarity - a.similarity)
      .map(item => item.topic);
  }

  private async getTopicCounts(topicId: string): Promise<{
    opinionsCount: number;
    participantCount: number;
  }> {
    const cacheKey = `topic:${topicId}:counts`;
    
    // Try to get from cache
    const cached = await getCache<{ opinionsCount: number; participantCount: number }>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get approved opinions for this topic
    const opinionsList = await db
      .select({ userId: opinions.userId, id: opinions.id })
      .from(opinions)
      .where(and(
        eq(opinions.topicId, topicId),
        eq(opinions.status, 'approved')
      ));

    const opinionsCount = opinionsList.length;

    // Get unique participants using UNION query
    const participantsResult = await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int as count
      FROM (
        SELECT user_id FROM opinions WHERE topic_id = ${topicId} AND status = 'approved'
        UNION
        SELECT user_id FROM opinion_votes WHERE opinion_id IN (
          SELECT id FROM opinions WHERE topic_id = ${topicId} AND status = 'approved'
        )
        UNION
        SELECT user_id FROM topic_flags WHERE topic_id = ${topicId}
      ) as participants
    `);

    const participantCount = Number(participantsResult[0]?.count) || 0;

    const result = { opinionsCount, participantCount };
    
    // Cache for 2 minutes
    await setCache(cacheKey, result, CACHE_TTL.MEDIUM);
    
    return result;
  }

  private async getTopicPreview(topicId: string): Promise<{
    content: string | undefined;
    author: string | undefined;
    isAI: boolean;
  }> {
    const cacheKey = `topic:${topicId}:preview`;
    
    // Try to get from cache
    const cached = await getCache<{ content: string | undefined; author: string | undefined; isAI: boolean }>(cacheKey);
    if (cached) {
      return cached;
    }

    // Try to get most liked opinion first with proper user join
    const [mostLiked] = await db
      .select({
        content: opinions.content,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(opinions)
      .leftJoin(users, eq(opinions.userId, users.id))
      .where(and(
        eq(opinions.topicId, topicId),
        eq(opinions.status, 'approved')
      ))
      .orderBy(desc(sql`(SELECT COUNT(*) FROM opinion_votes WHERE opinion_id = ${opinions.id} AND vote_type = 'like')`))
      .limit(1);

    let result: { content: string | undefined; author: string | undefined; isAI: boolean };
    
    if (mostLiked) {
      const authorName = mostLiked.firstName && mostLiked.lastName 
        ? `${mostLiked.firstName} ${mostLiked.lastName}` 
        : undefined;
      
      // Handle content preview safely - avoid "undefined" string coercion
      const contentPreview = mostLiked.content 
        ? mostLiked.content.slice(0, 200) + (mostLiked.content.length > 200 ? '...' : '')
        : undefined;
      
      result = {
        content: contentPreview,
        author: authorName,
        isAI: false,
      };
    } else {
      result = { content: undefined, author: undefined, isAI: false };
    }

    // Cache for 2 minutes
    await setCache(cacheKey, result, CACHE_TTL.MEDIUM);
    
    return result;
  }

  /**
   * Search topics by vector similarity using pgvector
   * @param embedding - Query embedding vector (1536 dimensions)
   * @param limit - Maximum number of results
   * @param threshold - Minimum similarity threshold (0-1)
   */
  async searchByVector(embedding: number[], limit: number = 20, threshold: number = 0.7): Promise<Topic[]> {
    const embeddingStr = `[${embedding.join(',')}]`;
    
    const results = await db.execute(sql`
      SELECT *, 
        1 - (embedding_vec <=> ${embeddingStr}::vector) as similarity
      FROM topics
      WHERE embedding_vec IS NOT NULL
        AND is_active = true
        AND 1 - (embedding_vec <=> ${embeddingStr}::vector) >= ${threshold}
      ORDER BY embedding_vec <=> ${embeddingStr}::vector
      LIMIT ${limit * 2}
    `);
    
    return results.map((r: any) => ({ 
      ...r, 
      similarity: Number(r.similarity) 
    })) as Topic[];
  }

  /**
   * Search topics by keywords using PostgreSQL full-text search
   * @param query - Search query string
   * @param limit - Maximum number of results
   */
  async searchByKeywords(query: string, limit: number = 20): Promise<Topic[]> {
    const results = await db.execute(sql`
      SELECT *, 
        ts_rank(to_tsvector('english', title || ' ' || description), 
                plainto_tsquery('english', ${query})) as rank
      FROM topics
      WHERE is_active = true
        AND to_tsvector('english', title || ' ' || description) @@ 
            plainto_tsquery('english', ${query})
      ORDER BY rank DESC
      LIMIT ${limit * 2}
    `);
    
    return results.map((r: any) => r) as Topic[];
  }

  /**
   * Hybrid search combining semantic (vector) and keyword search
   * Uses Reciprocal Rank Fusion (RRF) to merge results
   * @param query - Search query string
   * @param limit - Maximum number of results
   */
  async hybridSearch(query: string, limit: number = 20): Promise<Topic[]> {
    // Generate embedding for semantic search
    const queryEmbedding = await AIService.generateEmbedding(query);
    
    // Perform both searches in parallel
    const [semanticResults, keywordResults] = await Promise.all([
      this.searchByVector(queryEmbedding, limit * 2),
      this.searchByKeywords(query, limit * 2)
    ]);
    
    // Reciprocal Rank Fusion with k=60 (standard parameter)
    return this.reciprocalRankFusion(semanticResults, keywordResults, 60).slice(0, limit);
  }

  /**
   * Reciprocal Rank Fusion (RRF) for merging search results
   * Combines results from multiple search methods with weighted scoring
   */
  private reciprocalRankFusion(
    list1: Topic[],
    list2: Topic[],
    k: number = 60
  ): Topic[] {
    const scores = new Map<string, number>();
    
    // Score each result from semantic search
    list1.forEach((item, rank) => {
      const score = 1 / (k + rank + 1);
      scores.set(item.id, (scores.get(item.id) || 0) + score);
    });
    
    // Score each result from keyword search
    list2.forEach((item, rank) => {
      const score = 1 / (k + rank + 1);
      scores.set(item.id, (scores.get(item.id) || 0) + score);
    });
    
    // Combine and deduplicate
    const allItems = Array.from(new Set([...list1, ...list2]));
    
    // Sort by combined score
    return allItems
      .sort((a, b) => (scores.get(b.id) || 0) - (scores.get(a.id) || 0));
  }

  /**
   * Update embedding vector column (for pgvector)
   */
  async updateEmbeddingVector(topicId: string, embedding: number[]): Promise<void> {
    const embeddingStr = `[${embedding.join(',')}]`;
    await db.execute(sql`
      UPDATE topics 
      SET embedding_vec = ${embeddingStr}::vector
      WHERE id = ${topicId}
    `);
  }
}
