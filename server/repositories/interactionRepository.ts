import { db } from '../db';
import { topicInteractions, topics, opinions } from '@shared/schema';
import { eq, and, or, sql, isNull, isNotNull, desc, notInArray, inArray } from 'drizzle-orm';
import type { InsertTopicInteraction, TopicInteraction, TopicWithCounts } from '@shared/schema';

export class InteractionRepository {
  /**
   * Record or update a topic interaction (swipe)
   */
  async recordSwipe(userId: string, topicId: string, preference: 'liked' | 'disliked'): Promise<TopicInteraction> {
    const existing = await this.findInteraction(userId, topicId);
    
    if (existing) {
      const [updated] = await db
        .update(topicInteractions)
        .set({
          preference,
          swipedAt: sql`NOW()`,
        })
        .where(
          and(
            eq(topicInteractions.userId, userId),
            eq(topicInteractions.topicId, topicId)
          )
        )
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(topicInteractions)
        .values({
          userId,
          topicId,
          preference,
          seenAt: sql`NOW()`,
          swipedAt: sql`NOW()`,
        })
        .returning();
      return created;
    }
  }

  /**
   * Mark a topic as seen (without swiping)
   */
  async markAsSeen(userId: string, topicId: string): Promise<TopicInteraction> {
    const existing = await this.findInteraction(userId, topicId);
    
    if (existing) {
      return existing;
    } else {
      const [created] = await db
        .insert(topicInteractions)
        .values({
          userId,
          topicId,
          preference: null,
          seenAt: sql`NOW()`,
        })
        .returning();
      return created;
    }
  }

  /**
   * Mark that user has an opinion on a topic
   */
  async markHasOpinion(userId: string, topicId: string): Promise<void> {
    const existing = await this.findInteraction(userId, topicId);
    
    if (existing) {
      await db
        .update(topicInteractions)
        .set({ hasOpinion: true })
        .where(
          and(
            eq(topicInteractions.userId, userId),
            eq(topicInteractions.topicId, topicId)
          )
        );
    } else {
      await db
        .insert(topicInteractions)
        .values({
          userId,
          topicId,
          hasOpinion: true,
          seenAt: sql`NOW()`,
        });
    }
  }

  /**
   * Find a specific interaction
   */
  async findInteraction(userId: string, topicId: string): Promise<TopicInteraction | undefined> {
    const [interaction] = await db
      .select()
      .from(topicInteractions)
      .where(
        and(
          eq(topicInteractions.userId, userId),
          eq(topicInteractions.topicId, topicId)
        )
      )
      .limit(1);
    return interaction;
  }

  /**
   * Get prioritized topic queue for a user
   * Priority order:
   * 1. Unseen topics (no interaction record)
   * 2. Liked + no opinion
   * 3. Disliked + no opinion
   * 4. Liked + has opinion
   * 5. Disliked + has opinion
   */
  async getPrioritizedQueue(
    userId: string,
    sectionTopics: string[], // Array of topic IDs for this section
    limit: number = 20
  ): Promise<string[]> {
    if (sectionTopics.length === 0) return [];

    // Get all interactions for this user and these topics
    const userInteractions = await db
      .select()
      .from(topicInteractions)
      .where(
        and(
          eq(topicInteractions.userId, userId),
          inArray(topicInteractions.topicId, sectionTopics)
        )
      );

    const interactionMap = new Map(
      userInteractions.map(i => [i.topicId, i])
    );

    // Categorize topics by priority
    const unseen: string[] = [];
    const likedNoOpinion: string[] = [];
    const dislikedNoOpinion: string[] = [];
    const likedWithOpinion: string[] = [];
    const dislikedWithOpinion: string[] = [];

    for (const topicId of sectionTopics) {
      const interaction = interactionMap.get(topicId);
      
      if (!interaction) {
        unseen.push(topicId);
      } else if (interaction.preference === 'liked' && !interaction.hasOpinion) {
        likedNoOpinion.push(topicId);
      } else if (interaction.preference === 'disliked' && !interaction.hasOpinion) {
        dislikedNoOpinion.push(topicId);
      } else if (interaction.preference === 'liked' && interaction.hasOpinion) {
        likedWithOpinion.push(topicId);
      } else if (interaction.preference === 'disliked' && interaction.hasOpinion) {
        dislikedWithOpinion.push(topicId);
      }
    }

    // Combine in priority order
    const prioritizedIds = [
      ...unseen,
      ...likedNoOpinion,
      ...dislikedNoOpinion,
      ...likedWithOpinion,
      ...dislikedWithOpinion,
    ].slice(0, limit);

    return prioritizedIds;
  }

  /**
   * Get all interactions for a user
   */
  async getUserInteractions(userId: string): Promise<TopicInteraction[]> {
    return await db
      .select()
      .from(topicInteractions)
      .where(eq(topicInteractions.userId, userId))
      .orderBy(desc(topicInteractions.swipedAt), desc(topicInteractions.seenAt));
  }
}

