import { db } from '../db.js';
import { pool } from '../db.js';
import { opinions, users, userProfiles, opinionVotes, opinionFlags } from '../../shared/schema.js';
import { eq, desc, and, or, ne, sql } from 'drizzle-orm';
import type { InsertOpinion, Opinion } from '../../shared/schema.js';
import { aggregateFallacyCounts } from '../utils/fallacyUtils.js';

/**
 * Recursively remove all Date objects from an object
 * This prevents postgres library errors when Date objects are passed
 */
function removeDateObjects(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (obj instanceof Date) {
    return undefined; // Remove Date objects
  }
  // Check for Date-like objects (from different contexts or serialization)
  if (typeof obj === 'object' && obj !== null && obj.constructor?.name === 'Date') {
    return undefined;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeDateObjects).filter(item => item !== undefined);
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip timestamp fields that should use database defaults
      if (key === 'analyzedAt' || key === 'createdAt' || key === 'updatedAt') {
        continue;
      }
      // Skip any field that might contain Date objects
      if (value instanceof Date || (typeof value === 'object' && value !== null && value.constructor?.name === 'Date')) {
        console.warn(`[removeDateObjects] Skipping Date object in field: ${key}`);
        continue;
      }
      const cleanedValue = removeDateObjects(value);
      if (cleanedValue !== undefined) {
        cleaned[key] = cleanedValue;
      }
    }
    return cleaned;
  }
  return obj;
}

export class OpinionRepository {
  async create(opinion: InsertOpinion): Promise<Opinion> {
    // Use JSON serialization to deeply clone and convert any Date objects to strings
    // This ensures we have a completely clean plain object
    let serialized: any;
    try {
      serialized = JSON.parse(JSON.stringify(opinion, (key, value) => {
        // Convert Date objects to undefined so they're removed
        if (value instanceof Date) {
          console.warn(`[OpinionRepository] Removing Date object from field: ${key}`);
          return undefined;
        }
        return value;
      }));
    } catch (error) {
      console.error('[OpinionRepository] Error serializing opinion data:', error);
      // Fallback to manual cleaning
      serialized = removeDateObjects(opinion);
    }
    
    // Create a completely fresh plain object with only the fields we need
    const finalData: any = {
      topicId: serialized?.topicId,
      userId: serialized?.userId,
      content: serialized?.content,
      status: serialized?.status || opinion.status || 'approved',
      debateStatus: serialized?.debateStatus || opinion.debateStatus || 'open',
      references: serialized?.references,
      topicEconomicScore: serialized?.topicEconomicScore,
      topicAuthoritarianScore: serialized?.topicAuthoritarianScore,
      tasteScore: serialized?.tasteScore,
      passionScore: serialized?.passionScore,
      analysisConfidence: serialized?.analysisConfidence,
      // Explicitly exclude all timestamp fields - let database defaults handle them
    };
    
    // Remove undefined values to keep the object clean
    Object.keys(finalData).forEach(key => {
      if (finalData[key] === undefined) {
        delete finalData[key];
      }
    });
    
    // Final verification - ensure no Date objects
    for (const [key, value] of Object.entries(finalData)) {
      if (value instanceof Date) {
        console.error(`[OpinionRepository] CRITICAL: Date object found in finalData: ${key}`, value);
        delete finalData[key];
      }
      // Check nested structures
      if (Array.isArray(value)) {
        value.forEach((item, idx) => {
          if (item instanceof Date) {
            console.error(`[OpinionRepository] CRITICAL: Date object found in array ${key}[${idx}]`);
          }
        });
      }
    }
    
    // Log the exact data being inserted
    console.log('[OpinionRepository] About to insert opinion with data:', JSON.stringify(finalData));
    
    // Explicitly ensure no timestamp fields are included
    const insertData: any = {};
    const allowedFields = ['topicId', 'userId', 'content', 'status', 'debateStatus', 'references', 
                          'topicEconomicScore', 'topicAuthoritarianScore', 'tasteScore', 
                          'passionScore', 'analysisConfidence'];
    for (const field of allowedFields) {
      if (finalData[field] !== undefined) {
        // Double-check it's not a Date
        if (finalData[field] instanceof Date) {
          console.error(`[OpinionRepository] Date object in allowed field ${field} - skipping`);
          continue;
        }
        insertData[field] = finalData[field];
      }
    }
    
    // Log the exact data being inserted
    console.log('[OpinionRepository] About to insert opinion with data:', JSON.stringify(insertData));
    
    let created;
    try {
      created = await db.insert(opinions).values(insertData).returning();
      console.log('[OpinionRepository] Successfully inserted opinion:', created[0]?.id);
    } catch (error) {
      console.error('[OpinionRepository] ERROR during opinion insert:', error);
      console.error('[OpinionRepository] Data that caused error:', JSON.stringify(insertData, null, 2));
      // Check for Date objects one more time
      const hasDate = Object.values(insertData).some(v => {
        if (v instanceof Date) return true;
        if (Array.isArray(v)) return v.some(item => item instanceof Date);
        return false;
      });
      if (hasDate) {
        console.error('[OpinionRepository] Date object detected in insertData!');
      }
      throw error;
    }

    // Update user profile opinion counts (this logic should move to service layer)
    // Use raw SQL to avoid any drizzle/postgres-js Date object handling issues
    try {
      console.log('[OpinionRepository] About to update userProfile with raw SQL for userId:', opinion.userId);
      
      // Use raw SQL query to avoid any Date object issues with drizzle
      await pool`
        INSERT INTO user_profiles (user_id, opinion_count, total_opinions, economic_score, authoritarian_score)
        VALUES (${opinion.userId}, 1, 1, 0, 0)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          opinion_count = user_profiles.opinion_count + 1,
          total_opinions = user_profiles.total_opinions + 1,
          updated_at = NOW()
      `;
      
      console.log('[OpinionRepository] Successfully updated userProfile');
    } catch (error) {
      console.error('[OpinionRepository] ERROR during userProfiles insert:', error);
      console.error('[OpinionRepository] Error stack:', error instanceof Error ? error.stack : 'No stack');
      // Don't fail opinion creation if userProfiles update fails
      console.warn('[OpinionRepository] Continuing despite userProfiles insert error');
    }
    
    const [createdOpinion] = created;

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
