import { db } from '../db';
import { topics, opinions, opinionVotes, topicFlags, users } from '@shared/schema';
import { eq, desc, and, sql, count } from 'drizzle-orm';
import type { InsertTopic, Topic, TopicWithCounts, TopicInsert } from '@shared/schema';
import { getCache, setCache, cacheKey, CACHE_TTL } from '../services/cacheService';

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

    return {
      ...topic,
      opinionsCount: counts.opinionsCount,
      participantCount: counts.participantCount,
      previewContent: preview.content,
      previewAuthor: preview.author,
      previewIsAI: preview.isAI,
      diversityScore: 0, // TODO: Implement diversity calculation
      politicalDistribution: {
        authoritarianCapitalist: 0,
        authoritarianSocialist: 0,
        libertarianCapitalist: 0,
        libertarianSocialist: 0,
      },
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
    const topicsWithCounts = await Promise.all(
      topicsList.map(async (topic) => {
        const counts = await this.getTopicCounts(topic.id);
        const preview = await this.getTopicPreview(topic.id);

        return {
          ...topic,
          opinionsCount: counts.opinionsCount,
          participantCount: counts.participantCount,
          previewContent: preview.content,
          previewAuthor: preview.author,
          previewIsAI: preview.isAI,
          diversityScore: 0, // TODO: Implement diversity calculation
          politicalDistribution: {
            authoritarianCapitalist: 0,
            authoritarianSocialist: 0,
            libertarianCapitalist: 0,
            libertarianSocialist: 0,
          },
        };
      })
    );

    return topicsWithCounts;
  }

  async updateEmbedding(topicId: string, embedding: number[]): Promise<void> {
    await db
      .update(topics)
      .set({ embedding: embedding as any })
      .where(eq(topics.id, topicId));
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
    const topicsWithCounts = await Promise.all(
      topicsList.map(async (topic) => {
        const counts = await this.getTopicCounts(topic.id);
        const preview = await this.getTopicPreview(topic.id);

        return {
          ...topic,
          opinionsCount: counts.opinionsCount,
          participantCount: counts.participantCount,
          previewContent: preview.content,
          previewAuthor: preview.author,
          previewIsAI: preview.isAI,
          diversityScore: 0,
          politicalDistribution: {
            authoritarianCapitalist: 0,
            authoritarianSocialist: 0,
            libertarianCapitalist: 0,
            libertarianSocialist: 0,
          },
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
    const { AIService } = await import('../aiService');

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
      
      result = {
        content: mostLiked.content?.slice(0, 200) + (mostLiked.content && mostLiked.content.length > 200 ? '...' : ''),
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
}
