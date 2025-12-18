import { db } from '../db.js';
import { opinions, users, topics, userProfiles } from '../../shared/schema.js';
import { sql, and, gte, eq, inArray } from 'drizzle-orm';

export class AnalyticsRepository {
  async getTopicPoliticalDistribution(topicId: string): Promise<{
    authoritarianCapitalist: number;
    authoritarianSocialist: number;
    libertarianCapitalist: number;
    libertarianSocialist: number;
  }> {
    // Get all opinions for this topic that have political scores
    const topicOpinions = await db
      .select()
      .from(opinions)
      .where(and(
        eq(opinions.topicId, topicId),
        sql`${opinions.topicEconomicScore} IS NOT NULL`,
        sql`${opinions.topicAuthoritarianScore} IS NOT NULL`
      ));

    if (topicOpinions.length === 0) {
      // No opinions with political scores yet
      return {
        authoritarianCapitalist: 0,
        authoritarianSocialist: 0,
        libertarianCapitalist: 0,
        libertarianSocialist: 0
      };
    }

    // Count opinions in each quadrant
    // Schema: economicScore -100 (socialist) to +100 (capitalist)
    // authoritarianScore -100 (libertarian) to +100 (authoritarian)
    // Tie-breaking: 0 on either axis is treated as the positive side (capitalist/authoritarian)
    let authoritarianCapitalist = 0;
    let authoritarianSocialist = 0;
    let libertarianCapitalist = 0;
    let libertarianSocialist = 0;

    for (const opinion of topicOpinions) {
      const economic = opinion.topicEconomicScore || 0;
      const authoritarian = opinion.topicAuthoritarianScore || 0;

      if (authoritarian >= 0) {
        // Authoritarian
        if (economic >= 0) {
          authoritarianCapitalist++;
        } else {
          authoritarianSocialist++;
        }
      } else {
        // Libertarian
        if (economic >= 0) {
          libertarianCapitalist++;
        } else {
          libertarianSocialist++;
        }
      }
    }

    return {
      authoritarianCapitalist,
      authoritarianSocialist,
      libertarianCapitalist,
      libertarianSocialist
    };
  }

  async getActiveUserPoliticalDistribution(): Promise<{
    authoritarianCapitalist: number;
    authoritarianSocialist: number;
    libertarianCapitalist: number;
    libertarianSocialist: number;
  }> {
    // Get all opinions created in the last 12 hours
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

    const recentOpinions = await db
      .select()
      .from(opinions)
      .where(gte(opinions.createdAt, twelveHoursAgo));

    if (recentOpinions.length === 0) {
      // No recent activity
      return {
        authoritarianCapitalist: 0,
        authoritarianSocialist: 0,
        libertarianCapitalist: 0,
        libertarianSocialist: 0
      };
    }

    // Get unique user IDs
    const uniqueUserIds = Array.from(new Set(recentOpinions.map(o => o.userId)));

    if (uniqueUserIds.length === 0) {
      return {
        authoritarianCapitalist: 0,
        authoritarianSocialist: 0,
        libertarianCapitalist: 0,
        libertarianSocialist: 0
      };
    }

    // Get user profiles with political scores from user_profiles table
    const activeUserProfiles = await db
      .select({
        economicScore: userProfiles.economicScore,
        authoritarianScore: userProfiles.authoritarianScore
      })
      .from(userProfiles)
      .where(inArray(userProfiles.userId, uniqueUserIds));

    // Count users in each quadrant
    let authoritarianCapitalist = 0;
    let authoritarianSocialist = 0;
    let libertarianCapitalist = 0;
    let libertarianSocialist = 0;

    for (const profile of activeUserProfiles) {
      const economic = profile.economicScore || 0;
      const authoritarian = profile.authoritarianScore || 0;

      if (authoritarian >= 0) {
        // Authoritarian
        if (economic >= 0) {
          authoritarianCapitalist++;
        } else {
          authoritarianSocialist++;
        }
      } else {
        // Libertarian
        if (economic >= 0) {
          libertarianCapitalist++;
        } else {
          libertarianSocialist++;
        }
      }
    }

    return {
      authoritarianCapitalist,
      authoritarianSocialist,
      libertarianCapitalist,
      libertarianSocialist
    };
  }

  async getPlatformStats(): Promise<{
    totalUsers: number;
    totalTopics: number;
    totalOpinions: number;
    activeDebates: number;
    recentActivity: {
      usersLast24h: number;
      opinionsLast24h: number;
      topicsLast24h: number;
    };
  }> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get basic counts
    const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    const [topicCount] = await db.select({ count: sql<number>`count(*)::int` }).from(topics);
    const [opinionCount] = await db.select({ count: sql<number>`count(*)::int` }).from(opinions);

    // Get recent activity
    const [recentUsers] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(sql`${users.createdAt} >= ${twentyFourHoursAgo}`);

    const [recentOpinions] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opinions)
      .where(sql`${opinions.createdAt} >= ${twentyFourHoursAgo}`);

    const [recentTopics] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(topics)
      .where(sql`${topics.createdAt} >= ${twentyFourHoursAgo}`);

    // This would need to be implemented if we had debate rooms table
    // For now, returning 0
    const activeDebates = 0;

    return {
      totalUsers: userCount?.count || 0,
      totalTopics: topicCount?.count || 0,
      totalOpinions: opinionCount?.count || 0,
      activeDebates,
      recentActivity: {
        usersLast24h: recentUsers?.count || 0,
        opinionsLast24h: recentOpinions?.count || 0,
        topicsLast24h: recentTopics?.count || 0,
      }
    };
  }
}
