import { db } from '../db.js';
import { badges, userBadges, users, debateRooms, opinions, topics, debateMessages, debateMessageFlags } from '../../shared/schema.js';
import { eq, and, or, count, asc, inArray } from 'drizzle-orm';
import { BADGE_DEFINITIONS } from '../../shared/badgeDefinitions.js';

export class BadgeRepository {
  async initializeBadges(): Promise<void> {
    // Insert all badge definitions into the database if they don't exist
    for (const badge of BADGE_DEFINITIONS) {
      const existing = await db
        .select()
        .from(badges)
        .where(eq(badges.id, badge.id))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(badges).values(badge);
      }
    }
  }

  async getAllBadges(): Promise<any[]> {
    return await db.select().from(badges).orderBy(asc(badges.category), asc(badges.tier));
  }

  async getUserBadges(userId: string): Promise<any[]> {
    // Get user's selected badge ID
    const [user] = await db
      .select({ selectedBadgeId: users.selectedBadgeId })
      .from(users)
      .where(eq(users.id, userId));

    const selectedBadgeId = user?.selectedBadgeId;

    // Get all badge definitions
    const allBadges = await db.select().from(badges).orderBy(asc(badges.category), asc(badges.tier));

    // Get unlocked badges for this user
    const unlockedBadges = await db
      .select({
        badgeId: userBadges.badgeId,
        unlockedAt: userBadges.unlockedAt,
      })
      .from(userBadges)
      .where(eq(userBadges.userId, userId));

    // Create a map of unlocked badges
    const unlockedMap = new Map(unlockedBadges.map(ub => [ub.badgeId, ub.unlockedAt]));

    // Return all badges with unlock status and selection status
    return allBadges.map(badge => ({
      ...badge,
      badgeId: badge.id,
      icon: badge.icon,
      name: badge.name,
      description: badge.description,
      category: badge.category,
      unlockedAt: unlockedMap.get(badge.id) || null,
      isSelected: selectedBadgeId === badge.id,
    }));
  }

  async checkAndAwardBadges(userId: string): Promise<string[]> {
    const newlyAwardedBadges: string[] = [];

    // Get user stats
    const debateCount = await db
      .select({ count: count() })
      .from(debateRooms)
      .where(
        or(
          eq(debateRooms.participant1Id, userId),
          eq(debateRooms.participant2Id, userId)
        )
      );

    const opinionCount = await db
      .select({ count: count() })
      .from(opinions)
      .where(eq(opinions.userId, userId));

    const topicCount = await db
      .select({ count: count() })
      .from(topics)
      .where(eq(topics.createdById, userId));

    // Calculate fallacy rate for quality badges
    const userMessages = await db
      .select({ id: debateMessages.id })
      .from(debateMessages)
      .where(eq(debateMessages.userId, userId));

    const totalMessages = userMessages.length;
    let flaggedMessagesCount = 0;

    if (totalMessages > 0) {
      const flaggedMessages = await db
        .select({ count: count() })
        .from(debateMessageFlags)
        .where(
          inArray(
            debateMessageFlags.messageId,
            userMessages.map((m) => m.id)
          )
        );
      flaggedMessagesCount = Number(flaggedMessages[0]?.count || 0);
    }

    const fallacyRate = totalMessages > 0 ? (flaggedMessagesCount / totalMessages) * 100 : 0;

    const stats = {
      debateCount: Number(debateCount[0]?.count || 0),
      opinionCount: Number(opinionCount[0]?.count || 0),
      topicCount: Number(topicCount[0]?.count || 0),
      fallacyRate,
    };

    // Check each badge
    for (const badge of BADGE_DEFINITIONS) {
      let qualifies = false;

      switch (badge.requirementType) {
        case "debate_count":
          qualifies = stats.debateCount >= badge.requirement;
          break;
        case "opinion_count":
          qualifies = stats.opinionCount >= badge.requirement;
          break;
        case "topic_count":
          qualifies = stats.topicCount >= badge.requirement;
          break;
        case "low_fallacy_rate":
          // For quality badges, check debate count and fallacy rate
          if (badge.id === "logical_thinker") {
            qualifies = stats.debateCount >= 10 && stats.fallacyRate < 5;
          } else if (badge.id === "master_debater") {
            qualifies = stats.debateCount >= 25 && stats.fallacyRate < 3;
          }
          break;
      }

      if (qualifies) {
        // Check if user already has this badge
        const existingBadge = await db
          .select()
          .from(userBadges)
          .where(
            and(
              eq(userBadges.userId, userId),
              eq(userBadges.badgeId, badge.id)
            )
          )
          .limit(1);

        if (existingBadge.length === 0) {
          // Award the badge
          await db.insert(userBadges).values({
            userId,
            badgeId: badge.id,
          });
          newlyAwardedBadges.push(badge.id);
        }
      }
    }

    return newlyAwardedBadges;
  }

  async setSelectedBadge(userId: string, badgeId: string | null): Promise<void> {
    // If badgeId is provided, verify the user has unlocked this badge
    if (badgeId) {
      const hasBadge = await db
        .select()
        .from(userBadges)
        .where(
          and(
            eq(userBadges.userId, userId),
            eq(userBadges.badgeId, badgeId)
          )
        )
        .limit(1);

      if (hasBadge.length === 0) {
        throw new Error("User has not unlocked this badge");
      }
    }

    await db
      .update(users)
      .set({ selectedBadgeId: badgeId })
      .where(eq(users.id, userId));
  }
}

