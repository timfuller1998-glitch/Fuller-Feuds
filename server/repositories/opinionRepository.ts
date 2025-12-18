import { db } from '../db.js';
import { opinions, users, userProfiles, opinionVotes, opinionFlags } from '@shared/schema';
import { eq, desc, and, or, ne, sql } from 'drizzle-orm';
import type { InsertOpinion, Opinion } from '@shared/schema';
import { aggregateFallacyCounts } from '../utils/fallacyUtils.js';

export class OpinionRepository {
  async create(opinion: InsertOpinion): Promise<Opinion> {
    // Ensure status defaults to 'approved' if not specified
    const opinionData = {
      ...opinion,
      status: opinion.status || 'approved',
    };
    const [created] = await db.insert(opinions).values(opinionData).returning();

    // Update user profile opinion counts (this logic should move to service layer)
    await db
      .insert(userProfiles)
      .values({
        userId: opinion.userId,
        opinionCount: 1,
        totalOpinions: 1,
        economicScore: 0,
        authoritarianScore: 0,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          opinionCount: sql`${userProfiles.opinionCount} + 1`,
          totalOpinions: sql`${userProfiles.totalOpinions} + 1`,
          updatedAt: new Date()
        }
      });

    return created;
  }

  async findById(id: string): Promise<Opinion | undefined> {
    const [opinion] = await db.select().from(opinions).where(eq(opinions.id, id)).limit(1);
    return opinion;
  }

  async findByTopicId(topicId: string, options?: {
    userRole?: string;
    currentUserId?: string;
  }): Promise<Opinion[]> {
    const { userRole, currentUserId } = options || {};
    const isModOrAdmin = userRole === 'admin' || userRole === 'moderator';

    // Build where conditions
    const whereConditions = [eq(opinions.topicId, topicId)];

    // Regular users only see approved opinions
    if (!isModOrAdmin) {
      whereConditions.push(eq(opinions.status, 'approved'));
    }

    // Filter private opinions - only show to the author
    if (currentUserId) {
      whereConditions.push(
        or(
          ne(opinions.debateStatus, 'private'),
          eq(opinions.userId, currentUserId)
        )!
      );
    } else {
      // Not logged in - exclude all private opinions
      whereConditions.push(ne(opinions.debateStatus, 'private'));
    }

    const baseOpinions = await db
      .select({
        opinion: opinions,
        author: users,
        profile: userProfiles
      })
      .from(opinions)
      .leftJoin(users, eq(opinions.userId, users.id))
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(and(...whereConditions))
      .orderBy(desc(opinions.createdAt));

    if (baseOpinions.length === 0) {
      return [];
    }

    // Batch aggregate fallacy counts for all opinions
    const fallacyCountsMap = await aggregateFallacyCounts(
      baseOpinions.map(row => row.opinion),
      opinionFlags,
      'opinionId'
    );

    // Enrich each opinion with vote counts and author info
    const enrichedOpinions = await Promise.all(
      baseOpinions.map(async (row) => {
        const opinion = row.opinion;

        // Get vote counts
        const [voteCounts] = await db
          .select({
            likesCount: sql<number>`COUNT(CASE WHEN ${opinionVotes.voteType} = 'like' THEN 1 END)`,
            dislikesCount: sql<number>`COUNT(CASE WHEN ${opinionVotes.voteType} = 'dislike' THEN 1 END)`
          })
          .from(opinionVotes)
          .where(eq(opinionVotes.opinionId, opinion.id));

        // Get user's vote if logged in
        let userVote = null;
        if (currentUserId) {
          const [vote] = await db
            .select()
            .from(opinionVotes)
            .where(and(
              eq(opinionVotes.opinionId, opinion.id),
              eq(opinionVotes.userId, currentUserId)
            ))
            .limit(1);
          userVote = vote ? { voteType: vote.voteType as 'like' | 'dislike' } : null;
        }

        return {
          ...opinion,
          likesCount: voteCounts?.likesCount || 0,
          dislikesCount: voteCounts?.dislikesCount || 0,
          fallacyCounts: fallacyCountsMap.get(opinion.id) || {},
          userVote,
          author: row.author ? {
            id: row.author.id,
            firstName: row.author.firstName,
            lastName: row.author.lastName,
            profileImageUrl: row.author.profileImageUrl,
            politicalLeaningScore: row.profile?.economicScore != null && row.profile?.authoritarianScore != null ?
              (row.profile.economicScore + row.profile.authoritarianScore) / 2 : undefined,
            economicScore: row.profile?.economicScore ?? undefined,
            authoritarianScore: row.profile?.authoritarianScore ?? undefined
          } : null
        };
      })
    );

    return enrichedOpinions;
  }

  async update(id: string, data: Partial<InsertOpinion>): Promise<Opinion> {
    const [updated] = await db
      .update(opinions)
      .set(data)
      .where(eq(opinions.id, id))
      .returning();
    return updated;
  }

  async updateCounts(id: string, likesCount: number, dislikesCount: number): Promise<void> {
    await db
      .update(opinions)
      .set({ likesCount, dislikesCount })
      .where(eq(opinions.id, id));
  }

  async delete(id: string): Promise<void> {
    await db.delete(opinions).where(eq(opinions.id, id));
  }

  async voteOnOpinion(opinionId: string, userId: string, voteType: 'like' | 'dislike' | null): Promise<void> {
    if (voteType === null) {
      // Remove vote
      await db
        .delete(opinionVotes)
        .where(and(eq(opinionVotes.opinionId, opinionId), eq(opinionVotes.userId, userId)));
    } else {
      // Add or update vote
      await db
        .insert(opinionVotes)
        .values({ opinionId, userId, voteType })
        .onConflictDoUpdate({
          target: [opinionVotes.opinionId, opinionVotes.userId],
          set: { voteType },
        });
    }
  }

  async getUserVoteOnOpinion(opinionId: string, userId: string): Promise<any | undefined> {
    const [vote] = await db
      .select()
      .from(opinionVotes)
      .where(and(eq(opinionVotes.opinionId, opinionId), eq(opinionVotes.userId, userId)))
      .limit(1);
    return vote;
  }

  async adoptOpinion(opinionId: string, userId: string, customContent?: string): Promise<any> {
    // Get the original opinion
    const [original] = await db
      .select()
      .from(opinions)
      .where(eq(opinions.id, opinionId))
      .limit(1);

    if (!original) {
      throw new Error("Opinion not found");
    }

    // Create new opinion for the user with same or modified content
    const newOpinion = {
      topicId: original.topicId,
      userId,
      content: customContent || original.content,
      status: 'approved' as const,
      debateStatus: 'open' as const,
      references: original.references || [],
      topicEconomicScore: original.topicEconomicScore,
      topicAuthoritarianScore: original.topicAuthoritarianScore,
    };

    return await this.create(newOpinion);
  }

  async findWithoutPoliticalScores(limit?: number): Promise<Opinion[]> {
    const opinionsList = await db
      .select()
      .from(opinions)
      .where(and(
        eq(opinions.status, 'approved'),
        sql`(${opinions.topicEconomicScore} IS NULL OR ${opinions.topicAuthoritarianScore} IS NULL)`
      ))
      .orderBy(desc(opinions.createdAt))
      .limit(limit || 1000);
    
    return opinionsList;
  }

  async updatePoliticalScores(opinionId: string, economicScore: number, authoritarianScore: number): Promise<void> {
    await db
      .update(opinions)
      .set({
        topicEconomicScore: economicScore,
        topicAuthoritarianScore: authoritarianScore
      })
      .where(eq(opinions.id, opinionId));
  }

  async getRecentOpinions(limit = 50, userRole?: string, currentUserId?: string): Promise<any[]> {
    const isModOrAdmin = userRole === 'admin' || userRole === 'moderator';

    // Build where conditions
    const whereConditions = [];

    // Regular users only see approved opinions
    if (!isModOrAdmin) {
      whereConditions.push(eq(opinions.status, 'approved'));
    }

    // Filter private opinions
    if (currentUserId) {
      whereConditions.push(
        or(
          ne(opinions.debateStatus, 'private'),
          eq(opinions.userId, currentUserId)
        )!
      );
    } else {
      whereConditions.push(ne(opinions.debateStatus, 'private'));
    }

    const baseOpinions = await db
      .select({
        opinion: opinions,
        author: users,
        profile: sql`NULL`, // Simplified for now
      })
      .from(opinions)
      .leftJoin(users, eq(opinions.userId, users.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(opinions.createdAt))
      .limit(limit);

    return baseOpinions.map(row => ({
      ...row.opinion,
      author: row.author ? {
        id: row.author.id,
        firstName: row.author.firstName,
        lastName: row.author.lastName,
        profileImageUrl: row.author.profileImageUrl,
      } : null
    }));
  }
}
