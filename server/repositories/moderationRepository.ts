import { db } from '../db.js';
import {
  opinions,
  topics,
  users,
  opinionFlags,
  topicFlags,
  debateMessageFlags,
  bannedPhrases,
  moderationActions,
  debateMessages
} from '@shared/schema';
import { eq, desc, sql, inArray } from 'drizzle-orm';
import type { BannedPhrase, InsertBannedPhrase } from '@shared/schema';

export class ModerationRepository {
  async flagOpinion(opinionId: string, userId: string, fallacyType: string): Promise<void> {
    await db.insert(opinionFlags).values({
      opinionId,
      userId,
      fallacyType,
    });
  }

  async flagTopic(topicId: string, userId: string, fallacyType: string): Promise<void> {
    await db.insert(topicFlags).values({
      topicId,
      userId,
      fallacyType,
    });
  }

  async flagDebateMessage(messageId: string, userId: string, fallacyType: string): Promise<void> {
    await db.insert(debateMessageFlags).values({
      messageId,
      userId,
      fallacyType,
    });
  }

  async getFlaggedOpinions(): Promise<any[]> {
    const flagged = await db
      .select({
        opinion: opinions,
        topic: topics,
        author: users,
        flags: opinionFlags,
      })
      .from(opinions)
      .innerJoin(topics, eq(opinions.topicId, topics.id))
      .innerJoin(users, eq(opinions.userId, users.id))
      .innerJoin(opinionFlags, eq(opinions.id, opinionFlags.opinionId))
      .where(eq(opinions.status, 'flagged'))
      .orderBy(desc(opinions.createdAt));

    return flagged;
  }

  async approveOpinion(opinionId: string, moderatorId: string, reason?: string): Promise<void> {
    await db.update(opinions).set({ status: 'approved' }).where(eq(opinions.id, opinionId));
    await db.insert(moderationActions).values({
      moderatorId,
      actionType: 'approve_opinion',
      targetType: 'opinion',
      targetId: opinionId,
      reason: reason || 'Opinion approved after review',
    });
  }

  async hideOpinion(opinionId: string, moderatorId: string, reason?: string): Promise<void> {
    await db.update(opinions).set({ status: 'hidden' }).where(eq(opinions.id, opinionId));
    await db.insert(moderationActions).values({
      moderatorId,
      actionType: 'hide_opinion',
      targetType: 'opinion',
      targetId: opinionId,
      reason: reason || 'Opinion hidden by moderator',
    });
  }

  async suspendUser(userId: string, moderatorId: string, reason?: string): Promise<void> {
    await db.update(users).set({ status: 'suspended' }).where(eq(users.id, userId));
    await db.insert(moderationActions).values({
      moderatorId,
      actionType: 'suspend_user',
      targetType: 'user',
      targetId: userId,
      reason: reason || 'User suspended by moderator',
    });
  }

  async banUser(userId: string, moderatorId: string, reason?: string): Promise<void> {
    await db.update(users).set({ status: 'banned' }).where(eq(users.id, userId));
    await db.insert(moderationActions).values({
      moderatorId,
      actionType: 'ban_user',
      targetType: 'user',
      targetId: userId,
      reason: reason || 'User banned by moderator',
    });
  }

  async reinstateUser(userId: string, moderatorId: string, reason?: string): Promise<void> {
    await db.update(users).set({ status: 'active' }).where(eq(users.id, userId));
    await db.insert(moderationActions).values({
      moderatorId,
      actionType: 'reinstate_user',
      targetType: 'user',
      targetId: userId,
      reason: reason || 'User reinstated by moderator',
    });
  }

  async hideTopic(topicId: string, moderatorId: string, reason?: string): Promise<void> {
    await db.update(topics).set({ status: 'hidden' }).where(eq(topics.id, topicId));
    await db.insert(moderationActions).values({
      moderatorId,
      actionType: 'hide_topic',
      targetType: 'topic',
      targetId: topicId,
      reason: reason || 'Topic hidden by moderator',
    });
  }

  async archiveTopic(topicId: string, moderatorId: string, reason?: string): Promise<void> {
    await db.update(topics).set({ status: 'archived' }).where(eq(topics.id, topicId));
    await db.insert(moderationActions).values({
      moderatorId,
      actionType: 'archive_topic',
      targetType: 'topic',
      targetId: topicId,
      reason: reason || 'Topic archived by moderator',
    });
  }

  async restoreTopic(topicId: string, moderatorId: string, reason?: string): Promise<void> {
    await db.update(topics).set({ status: 'active' }).where(eq(topics.id, topicId));
    await db.insert(moderationActions).values({
      moderatorId,
      actionType: 'restore_topic',
      targetType: 'topic',
      targetId: topicId,
      reason: reason || 'Topic restored by moderator',
    });
  }

  async updateUserRole(userId: string, role: string, adminId: string): Promise<void> {
    await db.update(users).set({ role }).where(eq(users.id, userId));
    await db.insert(moderationActions).values({
      moderatorId: adminId,
      actionType: 'update_user_role',
      targetType: 'user',
      targetId: userId,
      reason: `User role updated to ${role}`,
    });
  }

  async updateUserStatus(userId: string, status: string, adminId: string): Promise<void> {
    await db.update(users).set({ status }).where(eq(users.id, userId));
    await db.insert(moderationActions).values({
      moderatorId: adminId,
      actionType: 'update_user_status',
      targetType: 'user',
      targetId: userId,
      reason: `User status updated to ${status}`,
    });
  }

  async deleteUser(userId: string, adminId: string): Promise<void> {
    // Soft delete by marking as banned and updating status
    await db.update(users).set({ status: 'banned' }).where(eq(users.id, userId));
    await db.insert(moderationActions).values({
      moderatorId: adminId,
      actionType: 'delete_user',
      targetType: 'user',
      targetId: userId,
      reason: 'User account deleted by admin',
    });
  }

  async deleteTopicAdmin(topicId: string, adminId: string): Promise<void> {
    await db.update(topics).set({ status: 'hidden' }).where(eq(topics.id, topicId));
    await db.insert(moderationActions).values({
      moderatorId: adminId,
      actionType: 'delete_topic',
      targetType: 'topic',
      targetId: topicId,
      reason: 'Topic deleted by admin',
    });
  }

  async deleteOpinionAdmin(opinionId: string, adminId: string): Promise<void> {
    await db.update(opinions).set({ status: 'hidden' }).where(eq(opinions.id, opinionId));
    await db.insert(moderationActions).values({
      moderatorId: adminId,
      actionType: 'delete_opinion',
      targetType: 'opinion',
      targetId: opinionId,
      reason: 'Opinion deleted by admin',
    });
  }

  async createBannedPhrase(phrase: InsertBannedPhrase): Promise<BannedPhrase> {
    const [created] = await db.insert(bannedPhrases).values(phrase).returning();
    return created;
  }

  async getBannedPhrases(): Promise<BannedPhrase[]> {
    return await db
      .select()
      .from(bannedPhrases)
      .orderBy(desc(bannedPhrases.createdAt));
  }

  async deleteBannedPhrase(id: string): Promise<void> {
    await db.delete(bannedPhrases).where(eq(bannedPhrases.id, id));
  }

  async getUsersForAdmin(): Promise<any[]> {
    return await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));
  }

  async getTopicsForAdmin(): Promise<any[]> {
    const topicsList = await db
      .select({
        id: topics.id,
        title: topics.title,
        description: topics.description,
        status: topics.status,
        isActive: topics.isActive,
        createdById: topics.createdById,
        createdAt: topics.createdAt,
        updatedAt: topics.updatedAt,
        authorId: users.id,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        authorEmail: users.email,
      })
      .from(topics)
      .leftJoin(users, eq(topics.createdById, users.id))
      .orderBy(desc(topics.createdAt));

    // Get opinion counts and transform to nested structure
    const topicsWithCounts = await Promise.all(
      topicsList.map(async (topic) => {
        const [opinionCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(opinions)
          .where(eq(opinions.topicId, topic.id));
        
        return {
          id: topic.id,
          title: topic.title,
          description: topic.description,
          status: topic.status,
          isActive: topic.isActive,
          createdById: topic.createdById,
          createdAt: topic.createdAt,
          updatedAt: topic.updatedAt,
          opinionsCount: Number(opinionCount?.count) || 0,
          author: topic.authorId ? {
            id: topic.authorId,
            firstName: topic.authorFirstName,
            lastName: topic.authorLastName,
            email: topic.authorEmail,
          } : null,
        };
      })
    );

    return topicsWithCounts;
  }

  async getOpinionsForAdmin(): Promise<any[]> {
    const opinionsList = await db
      .select({
        id: opinions.id,
        content: opinions.content,
        status: opinions.status,
        topicId: opinions.topicId,
        userId: opinions.userId,
        likesCount: opinions.likesCount,
        dislikesCount: opinions.dislikesCount,
        createdAt: opinions.createdAt,
        updatedAt: opinions.updatedAt,
        topicEconomicScore: opinions.topicEconomicScore,
        topicAuthoritarianScore: opinions.topicAuthoritarianScore,
        authorId: users.id,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        authorEmail: users.email,
        authorProfileImageUrl: users.profileImageUrl,
        topicTopicId: topics.id,
        topicTitle: topics.title,
      })
      .from(opinions)
      .leftJoin(users, eq(opinions.userId, users.id))
      .leftJoin(topics, eq(opinions.topicId, topics.id))
      .orderBy(desc(opinions.createdAt));

    // Transform to match frontend expectations
    return opinionsList.map((row) => ({
      id: row.id,
      content: row.content,
      status: row.status,
      topicId: row.topicId,
      userId: row.userId,
      likesCount: row.likesCount || 0,
      dislikesCount: row.dislikesCount || 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      // Derive stance from economic score: positive = "for" (capitalist), negative = "against" (socialist), null = neutral
      stance: row.topicEconomicScore != null 
        ? (row.topicEconomicScore > 0 ? 'for' : row.topicEconomicScore < 0 ? 'against' : null)
        : null,
      author: row.authorId ? {
        id: row.authorId,
        firstName: row.authorFirstName,
        lastName: row.authorLastName,
        email: row.authorEmail,
        profileImageUrl: row.authorProfileImageUrl,
      } : null,
      topic: row.topicTopicId ? {
        id: row.topicTopicId,
        title: row.topicTitle,
      } : null,
    }));
  }
}
