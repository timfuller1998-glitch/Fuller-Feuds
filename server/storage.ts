import {
  users,
  topics,
  opinions,
  cumulativeOpinions,
  debateRooms,
  debateMessages,
  liveStreams,
  streamInvitations,
  streamParticipants,
  streamChatMessages,
  opinionVotes,
  opinionChallenges,
  opinionFlags,
  topicFlags,
  debateMessageFlags,
  moderationActions,
  bannedPhrases,
  userFollows,
  userProfiles,
  themes,
  themeLikes,
  badges,
  userBadges,
  type User,
  type UpsertUser,
  type Topic,
  type TopicWithCounts,
  type InsertTopic,
  type Opinion,
  type InsertOpinion,
  type CumulativeOpinion,
  type DebateRoom,
  type InsertDebateRoom,
  type DebateMessage,
  type LiveStream,
  type InsertLiveStream,
  type StreamInvitation,
  type StreamParticipant,
  type StreamChatMessage,
  type OpinionVote,
  type OpinionChallenge,
  type UserFollow,
  type InsertUserFollow,
  type UserProfile,
  type InsertUserProfile,
  type Theme,
  type InsertTheme,
  type ThemeLike,
  type InsertThemeLike,
  type BannedPhrase,
  type InsertBannedPhrase,
  type Badge,
  type InsertBadge,
  type UserBadge,
  type InsertUserBadge,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, sql, count, ilike, or, inArray } from "drizzle-orm";
import { AIService } from "./aiService";
import { FALLACY_OPTIONS } from "@shared/fallacies";
import { BADGE_DEFINITIONS } from "@shared/badgeDefinitions";

// Helper function to aggregate fallacy counts by entity IDs
async function aggregateFallacyCounts<T extends { id: string }>(
  entities: T[],
  flagTable: typeof opinionFlags | typeof topicFlags | typeof debateMessageFlags,
  entityIdField: keyof typeof flagTable.$inferSelect
): Promise<Map<string, Record<string, number>>> {
  if (entities.length === 0) {
    return new Map();
  }

  const entityIds = entities.map(e => e.id);
  
  // Query all flags for these entities
  const flags = await db
    .select({
      entityId: flagTable[entityIdField as any],
      fallacyType: flagTable.fallacyType,
      count: count()
    })
    .from(flagTable)
    .where(inArray(flagTable[entityIdField as any], entityIds))
    .groupBy(flagTable[entityIdField as any], flagTable.fallacyType);

  // Build map of entity ID -> fallacy counts
  const countsMap = new Map<string, Record<string, number>>();
  
  for (const entity of entities) {
    // Initialize with all fallacy types at 0
    const fallacyCounts: Record<string, number> = {};
    FALLACY_OPTIONS.forEach(f => {
      fallacyCounts[f.id] = 0;
    });
    countsMap.set(entity.id, fallacyCounts);
  }

  // Fill in actual counts
  for (const flag of flags) {
    const counts = countsMap.get(flag.entityId as string);
    if (counts && flag.fallacyType) {
      counts[flag.fallacyType] = Number(flag.count);
    }
  }

  return countsMap;
}

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserProfileImage(userId: string, profileImageUrl: string): Promise<void>;
  updateUserProfile(userId: string, data: { firstName?: string; lastName?: string; bio?: string; location?: string; profileImageUrl?: string }): Promise<void>;
  updateFollowedCategories(userId: string, categories: string[]): Promise<void>;
  updateOnboardingProgress(userId: string, step: number, complete: boolean): Promise<void>;
  
  // Topic operations
  createTopic(topic: InsertTopic): Promise<Topic>;
  getTopics(limit?: number, category?: string, search?: string): Promise<TopicWithCounts[]>;
  getTopic(id: string): Promise<Topic | undefined>;
  
  // Opinion operations
  createOpinion(opinion: InsertOpinion): Promise<Opinion>;
  getOpinionsByTopic(topicId: string, userRole?: string): Promise<Opinion[]>;
  getRecentOpinions(limit?: number, userRole?: string): Promise<Opinion[]>;
  getOpinion(id: string): Promise<Opinion | undefined>;
  updateOpinion(opinionId: string, data: Partial<InsertOpinion>): Promise<Opinion>;
  updateOpinionCounts(opinionId: string, likesCount: number, dislikesCount: number): Promise<void>;
  
  // Opinion voting
  voteOnOpinion(opinionId: string, userId: string, voteType: 'like' | 'dislike' | null): Promise<void>;
  getUserVoteOnOpinion(opinionId: string, userId: string): Promise<OpinionVote | undefined>;
  
  // Opinion challenges
  challengeOpinion(opinionId: string, userId: string, context: string, status?: string): Promise<void>;
  getOpinionChallenges(opinionId: string, userRole?: string): Promise<any[]>;
  
  // Cumulative opinions
  getCumulativeOpinion(topicId: string): Promise<CumulativeOpinion | undefined>;
  upsertCumulativeOpinion(topicId: string, data: Partial<CumulativeOpinion>): Promise<CumulativeOpinion>;
  generateCumulativeOpinion(topicId: string): Promise<CumulativeOpinion>;
  refreshCumulativeOpinion(topicId: string): Promise<CumulativeOpinion>;
  
  // Debate rooms
  createDebateRoom(room: InsertDebateRoom): Promise<DebateRoom>;
  getDebateRoom(id: string): Promise<DebateRoom | undefined>;
  getUserDebateRooms(userId: string): Promise<DebateRoom[]>;
  endDebateRoom(id: string): Promise<void>;
  findOppositeOpinionUsers(topicId: string, userId: string, currentStance: string): Promise<User[]>;
  updateDebateRoomPrivacy(roomId: string, userId: string, privacy: 'public' | 'private'): Promise<void>;
  
  // Debate messages
  addDebateMessage(roomId: string, userId: string, content: string, status?: string): Promise<DebateMessage>;
  getDebateMessages(roomId: string, viewerId?: string): Promise<DebateMessage[]>;
  
  // Live streams
  createLiveStream(stream: InsertLiveStream): Promise<LiveStream>;
  getLiveStreams(status?: string, category?: string): Promise<LiveStream[]>;
  getLiveStream(id: string): Promise<LiveStream | undefined>;
  updateStreamStatus(id: string, status: string): Promise<void>;
  updateViewerCount(id: string, count: number): Promise<void>;
  
  // Stream participants
  addStreamParticipant(streamId: string, userId: string, stance: string): Promise<StreamParticipant>;
  getStreamParticipants(streamId: string): Promise<StreamParticipant[]>;
  updateParticipantStatus(streamId: string, userId: string, updates: Partial<StreamParticipant>): Promise<void>;
  removeStreamParticipant(streamId: string, userId: string): Promise<void>;
  
  // Stream chat
  addStreamChatMessage(streamId: string, userId: string, content: string, type?: string): Promise<StreamChatMessage>;
  getStreamChatMessages(streamId: string, limit?: number): Promise<StreamChatMessage[]>;
  moderateStreamMessage(messageId: string, isModerated: boolean): Promise<void>;
  
  // Stream invitations
  inviteUserToStream(streamId: string, userId: string): Promise<void>;
  getStreamInvitations(streamId: string): Promise<any[]>;
  respondToStreamInvitation(invitationId: string, userId: string, accept: boolean): Promise<void>;
  getUserStreamInvitations(userId: string, status?: string): Promise<any[]>;
  getUserStreams(userId: string, statusFilter?: string): Promise<LiveStream[]>;
  
  // User profiles
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  upsertUserProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile>;
  analyzeUserPoliticalLeaning(userId: string): Promise<UserProfile>;
  getUserOpinions(userId: string, sortBy?: 'recent' | 'popular' | 'controversial', limit?: number): Promise<Opinion[]>;
  
  // User following
  followUser(followerId: string, followingId: string): Promise<UserFollow>;
  unfollowUser(followerId: string, followingId: string): Promise<void>;
  isFollowing(followerId: string, followingId: string): Promise<boolean>;
  getUserFollowers(userId: string, limit?: number): Promise<User[]>;
  getUserFollowing(userId: string, limit?: number): Promise<User[]>;
  updateFollowCounts(userId: string): Promise<void>;
  
  // User debate rooms with enriched data
  getUserActiveDebateRoomsEnriched(userId: string): Promise<any[]>;
  
  // Moderation operations
  flagOpinion(opinionId: string, userId: string, fallacyType: string): Promise<void>;
  flagTopic(topicId: string, userId: string, fallacyType: string): Promise<void>;
  flagDebateMessage(messageId: string, userId: string, fallacyType: string): Promise<void>;
  getFlaggedOpinions(): Promise<any[]>;
  approveOpinion(opinionId: string, moderatorId: string, reason?: string): Promise<void>;
  hideOpinion(opinionId: string, moderatorId: string, reason?: string): Promise<void>;
  approveChallenge(challengeId: string, moderatorId: string, reason?: string): Promise<void>;
  rejectChallenge(challengeId: string, moderatorId: string, reason?: string): Promise<void>;
  getPendingChallenges(): Promise<any[]>;
  suspendUser(userId: string, moderatorId: string, reason?: string): Promise<void>;
  banUser(userId: string, moderatorId: string, reason?: string): Promise<void>;
  reinstateUser(userId: string, moderatorId: string, reason?: string): Promise<void>;
  hideTopic(topicId: string, moderatorId: string, reason?: string): Promise<void>;
  archiveTopic(topicId: string, moderatorId: string, reason?: string): Promise<void>;
  restoreTopic(topicId: string, moderatorId: string, reason?: string): Promise<void>;
  
  // Admin - User management
  getAllUsers(filters?: { role?: string; status?: string; search?: string; limit?: number }): Promise<User[]>;
  updateUserRole(userId: string, role: string, adminId: string): Promise<void>;
  
  // Admin - Content management
  getAllTopics(filters?: { status?: string; startDate?: Date; endDate?: Date; limit?: number }): Promise<TopicWithCounts[]>;
  getAllOpinions(filters?: { status?: string; startDate?: Date; endDate?: Date; limit?: number }): Promise<Opinion[]>;
  
  // Admin - Audit log
  getModerationActions(filters?: { actionType?: string; moderatorId?: string; startDate?: Date; endDate?: Date; limit?: number }): Promise<any[]>;
  
  // Banned phrases operations
  getAllBannedPhrases(): Promise<BannedPhrase[]>;
  createBannedPhrase(phrase: InsertBannedPhrase): Promise<BannedPhrase>;
  deleteBannedPhrase(id: string): Promise<void>;
  
  // Theme operations
  createTheme(theme: InsertTheme): Promise<Theme>;
  getTheme(id: string): Promise<Theme | undefined>;
  getThemes(options?: { userId?: string; visibility?: string; limit?: number; search?: string }): Promise<Theme[]>;
  getUserThemes(userId: string): Promise<Theme[]>;
  getPublicThemes(limit?: number, search?: string): Promise<Theme[]>;
  updateTheme(themeId: string, userId: string, data: Partial<InsertTheme>): Promise<Theme>;
  deleteTheme(themeId: string, userId: string): Promise<void>;
  forkTheme(themeId: string, userId: string, newName: string, newDescription?: string): Promise<Theme>;
  likeTheme(themeId: string, userId: string): Promise<void>;
  unlikeTheme(themeId: string, userId: string): Promise<void>;
  isThemeLiked(themeId: string, userId: string): Promise<boolean>;
  incrementThemeUsage(themeId: string): Promise<void>;
  
  // Badge operations
  initializeBadges(): Promise<void>;
  getAllBadges(): Promise<any[]>;
  getUserBadges(userId: string): Promise<any[]>;
  checkAndAwardBadges(userId: string): Promise<string[]>;
  setSelectedBadge(userId: string, badgeId: string | null): Promise<void>;
  getLeaderboards(): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserProfileImage(userId: string, profileImageUrl: string): Promise<void> {
    await db
      .update(users)
      .set({ 
        profileImageUrl,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  async updateUserProfile(userId: string, data: { firstName?: string; lastName?: string; bio?: string; location?: string; profileImageUrl?: string }): Promise<void> {
    await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  async updateFollowedCategories(userId: string, categories: string[]): Promise<void> {
    await db
      .update(users)
      .set({
        followedCategories: categories,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  async updateOnboardingProgress(userId: string, step: number, complete: boolean): Promise<void> {
    await db
      .update(users)
      .set({
        onboardingStep: step,
        onboardingComplete: complete,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  // Topic operations
  async createTopic(topic: InsertTopic): Promise<Topic> {
    const [created] = await db.insert(topics).values(topic).returning();
    return created;
  }

  async getTopics(limit = 50, category?: string, search?: string): Promise<TopicWithCounts[]> {
    let conditions = [eq(topics.isActive, true)];
    
    if (category) {
      // Check if the category is in the categories array
      conditions.push(sql`${category} = ANY(${topics.categories})`);
    }
    
    if (search) {
      conditions.push(
        sql`${topics.title} ILIKE ${`%${search}%`} OR ${topics.description} ILIKE ${`%${search}%`}`
      );
    }
    
    const topicsList = await db
      .select()
      .from(topics)
      .where(and(...conditions))
      .orderBy(desc(topics.createdAt))
      .limit(limit);
    
    // Fetch counts and preview content for each topic
    const topicsWithCounts = await Promise.all(
      topicsList.map(async (topic) => {
        // Get opinion count and participant count
        const opinionsList = await db
          .select({ userId: opinions.userId, id: opinions.id })
          .from(opinions)
          .where(and(
            eq(opinions.topicId, topic.id),
            eq(opinions.status, 'approved')
          ));
        
        const opinionsCount = opinionsList.length;
        const participantCount = new Set(opinionsList.map(o => o.userId)).size;
        
        // Get preview content: AI summary if exists, otherwise first opinion
        let previewContent: string | undefined;
        let previewAuthor: string | undefined;
        let previewIsAI = false;
        
        // Try to get AI summary first
        const [cumulative] = await db
          .select()
          .from(cumulativeOpinions)
          .where(eq(cumulativeOpinions.topicId, topic.id))
          .orderBy(desc(cumulativeOpinions.updatedAt))
          .limit(1);
        
        if (cumulative) {
          previewContent = cumulative.summary;
          previewAuthor = 'AI Summary';
          previewIsAI = true;
        } else {
          // Get first opinion as fallback
          const [firstOpinion] = await db
            .select()
            .from(opinions)
            .innerJoin(users, eq(opinions.userId, users.id))
            .where(and(
              eq(opinions.topicId, topic.id),
              eq(opinions.status, 'approved')
            ))
            .orderBy(desc(opinions.createdAt))
            .limit(1);
          
          if (firstOpinion) {
            previewContent = firstOpinion.opinions.content;
            const user = firstOpinion.users;
            previewAuthor = user.firstName && user.lastName 
              ? `${user.firstName} ${user.lastName}` 
              : user.email || 'Anonymous';
            previewIsAI = false;
          }
        }
        
        return {
          ...topic,
          opinionsCount,
          participantCount,
          previewContent,
          previewAuthor,
          previewIsAI
        };
      })
    );
    
    return topicsWithCounts;
  }

  async getTopic(id: string): Promise<Topic | undefined> {
    const [topic] = await db.select().from(topics).where(eq(topics.id, id));
    
    if (!topic) {
      return undefined;
    }

    // Aggregate fallacy counts for the topic
    const fallacyCountsMap = await aggregateFallacyCounts(
      [topic],
      topicFlags,
      'topicId'
    );

    return {
      ...topic,
      fallacyCounts: fallacyCountsMap.get(topic.id) || {},
    } as any;
  }

  // Opinion operations
  async createOpinion(opinion: InsertOpinion): Promise<Opinion> {
    const [created] = await db.insert(opinions).values(opinion).returning();
    return created;
  }

  async getOpinionsByTopic(topicId: string, userRole?: string): Promise<Opinion[]> {
    const isModOrAdmin = userRole === 'admin' || userRole === 'moderator';
    
    // Build where conditions
    const whereConditions = [eq(opinions.topicId, topicId)];
    
    // Regular users only see approved opinions
    if (!isModOrAdmin) {
      whereConditions.push(eq(opinions.status, 'approved'));
    }
    
    const baseOpinions = await db
      .select()
      .from(opinions)
      .where(and(...whereConditions))
      .orderBy(desc(opinions.createdAt));

    if (baseOpinions.length === 0) {
      return [];
    }

    // Batch aggregate fallacy counts for all opinions
    const fallacyCountsMap = await aggregateFallacyCounts(
      baseOpinions,
      opinionFlags,
      'opinionId'
    );

    // Enrich each opinion with vote and challenge counts
    const enrichedOpinions = await Promise.all(
      baseOpinions.map(async (opinion) => {
        // Count likes
        const likesResult = await db
          .select({ count: count() })
          .from(opinionVotes)
          .where(and(
            eq(opinionVotes.opinionId, opinion.id),
            eq(opinionVotes.voteType, 'like')
          ));
        
        // Count dislikes
        const dislikesResult = await db
          .select({ count: count() })
          .from(opinionVotes)
          .where(and(
            eq(opinionVotes.opinionId, opinion.id),
            eq(opinionVotes.voteType, 'dislike')
          ));
        
        // Count challenges
        const challengesResult = await db
          .select({ count: count() })
          .from(opinionChallenges)
          .where(eq(opinionChallenges.opinionId, opinion.id));

        return {
          ...opinion,
          likesCount: Number(likesResult[0]?.count || 0),
          dislikesCount: Number(dislikesResult[0]?.count || 0),
          repliesCount: 0,
          challengesCount: Number(challengesResult[0]?.count || 0),
          fallacyCounts: fallacyCountsMap.get(opinion.id) || {},
        };
      })
    );

    return enrichedOpinions as Opinion[];
  }

  async getRecentOpinions(limit: number = 50, userRole?: string): Promise<Opinion[]> {
    const isModOrAdmin = userRole === 'admin' || userRole === 'moderator';
    
    // Build where conditions
    const whereConditions = [];
    
    // Regular users only see approved opinions
    if (!isModOrAdmin) {
      whereConditions.push(eq(opinions.status, 'approved'));
    }
    
    const baseOpinions = await db
      .select()
      .from(opinions)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(opinions.createdAt))
      .limit(limit);

    if (baseOpinions.length === 0) {
      return [];
    }

    // Batch aggregate fallacy counts for all opinions
    const fallacyCountsMap = await aggregateFallacyCounts(
      baseOpinions,
      opinionFlags,
      'opinionId'
    );

    // Enrich each opinion with vote and challenge counts
    const enrichedOpinions = await Promise.all(
      baseOpinions.map(async (opinion) => {
        // Count likes
        const likesResult = await db
          .select({ count: count() })
          .from(opinionVotes)
          .where(and(
            eq(opinionVotes.opinionId, opinion.id),
            eq(opinionVotes.voteType, 'like')
          ));
        
        // Count dislikes
        const dislikesResult = await db
          .select({ count: count() })
          .from(opinionVotes)
          .where(and(
            eq(opinionVotes.opinionId, opinion.id),
            eq(opinionVotes.voteType, 'dislike')
          ));
        
        // Count challenges
        const challengesResult = await db
          .select({ count: count() })
          .from(opinionChallenges)
          .where(eq(opinionChallenges.opinionId, opinion.id));

        return {
          ...opinion,
          likesCount: Number(likesResult[0]?.count || 0),
          dislikesCount: Number(dislikesResult[0]?.count || 0),
          repliesCount: 0,
          challengesCount: Number(challengesResult[0]?.count || 0),
          fallacyCounts: fallacyCountsMap.get(opinion.id) || {},
        };
      })
    );

    return enrichedOpinions as Opinion[];
  }

  async getOpinion(id: string): Promise<Opinion | undefined> {
    const [opinion] = await db.select().from(opinions).where(eq(opinions.id, id));
    return opinion;
  }

  async updateOpinion(opinionId: string, data: Partial<InsertOpinion>): Promise<Opinion> {
    const [updated] = await db
      .update(opinions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(opinions.id, opinionId))
      .returning();
    return updated;
  }

  async updateOpinionCounts(opinionId: string, likesCount: number, dislikesCount: number): Promise<void> {
    await db
      .update(opinions)
      .set({ likesCount, dislikesCount })
      .where(eq(opinions.id, opinionId));
  }

  // Opinion voting
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
          set: { voteType, createdAt: new Date() },
        });
    }
  }

  async getUserVoteOnOpinion(opinionId: string, userId: string): Promise<OpinionVote | undefined> {
    const [vote] = await db
      .select()
      .from(opinionVotes)
      .where(and(eq(opinionVotes.opinionId, opinionId), eq(opinionVotes.userId, userId)));
    return vote;
  }

  // Opinion challenges
  async challengeOpinion(opinionId: string, userId: string, context: string, status: string = 'pending'): Promise<void> {
    await db
      .insert(opinionChallenges)
      .values({ opinionId, userId, context, status });
    
    // Increment challenges count
    await db
      .update(opinions)
      .set({ challengesCount: sql`${opinions.challengesCount} + 1` })
      .where(eq(opinions.id, opinionId));
  }

  // Adopt opinion - creates a new opinion for the user with same content and stance
  async adoptOpinion(opinionId: string, userId: string): Promise<Opinion> {
    // Get the original opinion
    const [original] = await db
      .select()
      .from(opinions)
      .where(eq(opinions.id, opinionId));
    
    if (!original) {
      throw new Error('Opinion not found');
    }

    // Check if user already has an opinion on this topic
    const [existing] = await db
      .select()
      .from(opinions)
      .where(and(
        eq(opinions.topicId, original.topicId),
        eq(opinions.userId, userId)
      ));

    if (existing) {
      // Update existing opinion to match the adopted one
      const [updated] = await db
        .update(opinions)
        .set({
          content: original.content,
          stance: original.stance,
          updatedAt: new Date()
        })
        .where(eq(opinions.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new opinion with same content and stance
      const [created] = await db
        .insert(opinions)
        .values({
          topicId: original.topicId,
          userId,
          content: original.content,
          stance: original.stance,
        })
        .returning();
      return created;
    }
  }

  async getOpinionChallenges(opinionId: string, userRole?: string): Promise<any[]> {
    const isModOrAdmin = userRole === 'admin' || userRole === 'moderator';
    
    // Build where conditions
    const whereConditions = [eq(opinionChallenges.opinionId, opinionId)];
    
    // Regular users only see approved challenges
    if (!isModOrAdmin) {
      whereConditions.push(eq(opinionChallenges.status, 'approved'));
    }
    
    const challenges = await db
      .select({
        id: opinionChallenges.id,
        context: opinionChallenges.context,
        status: opinionChallenges.status,
        createdAt: opinionChallenges.createdAt,
        userId: opinionChallenges.userId,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        }
      })
      .from(opinionChallenges)
      .leftJoin(users, eq(opinionChallenges.userId, users.id))
      .where(and(...whereConditions))
      .orderBy(desc(opinionChallenges.createdAt));
    
    return challenges;
  }

  // Cumulative opinions
  async getCumulativeOpinion(topicId: string): Promise<CumulativeOpinion | undefined> {
    const [cumulative] = await db
      .select()
      .from(cumulativeOpinions)
      .where(eq(cumulativeOpinions.topicId, topicId))
      .orderBy(desc(cumulativeOpinions.updatedAt))
      .limit(1);
    return cumulative;
  }

  async upsertCumulativeOpinion(topicId: string, data: Partial<CumulativeOpinion>): Promise<CumulativeOpinion> {
    const existing = await this.getCumulativeOpinion(topicId);
    
    if (existing) {
      const [updated] = await db
        .update(cumulativeOpinions)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(cumulativeOpinions.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(cumulativeOpinions)
        .values({ ...data, topicId } as any)
        .returning();
      return created;
    }
  }

  async generateCumulativeOpinion(topicId: string): Promise<CumulativeOpinion> {
    // Get the topic and all opinions
    const topic = await this.getTopic(topicId);
    if (!topic) {
      throw new Error("Topic not found");
    }

    const opinions = await this.getOpinionsByTopic(topicId);
    
    // Generate AI analysis
    const analysis = await AIService.generateCumulativeOpinion(topic, opinions);
    
    // Save the cumulative opinion
    return await this.upsertCumulativeOpinion(topicId, {
      summary: analysis.summary,
      keyPoints: analysis.keyPoints,
      supportingPercentage: analysis.supportingPercentage,
      opposingPercentage: analysis.opposingPercentage,
      neutralPercentage: analysis.neutralPercentage,
      totalOpinions: analysis.totalOpinions,
      confidence: analysis.confidence,
    });
  }

  async refreshCumulativeOpinion(topicId: string): Promise<CumulativeOpinion> {
    // This is the same as generate - refresh regenerates the analysis
    return await this.generateCumulativeOpinion(topicId);
  }

  // Debate rooms
  async createDebateRoom(room: InsertDebateRoom): Promise<DebateRoom> {
    const [created] = await db.insert(debateRooms).values(room).returning();
    return created;
  }

  async getDebateRoom(id: string): Promise<DebateRoom | undefined> {
    const [room] = await db.select().from(debateRooms).where(eq(debateRooms.id, id));
    return room;
  }

  async getUserDebateRooms(userId: string): Promise<DebateRoom[]> {
    return await db
      .select()
      .from(debateRooms)
      .where(
        or(
          eq(debateRooms.participant1Id, userId),
          eq(debateRooms.participant2Id, userId)
        )
      )
      .orderBy(desc(debateRooms.startedAt));
  }

  async endDebateRoom(id: string): Promise<void> {
    await db
      .update(debateRooms)
      .set({ status: 'ended', endedAt: new Date() })
      .where(eq(debateRooms.id, id));
  }

  async findOppositeOpinionUsers(topicId: string, userId: string, currentStance: string): Promise<User[]> {
    // Find users with opposite or different stance on the topic
    // - "for" can debate with "against" or "neutral"
    // - "against" can debate with "for" or "neutral"
    // - "neutral" can debate with "for" or "against"
    let oppositeStances: string[];
    if (currentStance === 'for') {
      oppositeStances = ['against', 'neutral'];
    } else if (currentStance === 'against') {
      oppositeStances = ['for', 'neutral'];
    } else { // neutral
      oppositeStances = ['for', 'against'];
    }
    
    const usersWithOpinions = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        bio: users.bio,
        location: users.location,
        followedCategories: users.followedCategories,
        onboardingStep: users.onboardingStep,
        onboardingComplete: users.onboardingComplete,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(opinions)
      .innerJoin(users, eq(opinions.userId, users.id))
      .where(
        and(
          eq(opinions.topicId, topicId),
          inArray(opinions.stance, oppositeStances),
          sql`${opinions.userId} != ${userId}`
        )
      )
      .groupBy(users.id);
    
    return usersWithOpinions;
  }

  async updateDebateRoomPrivacy(roomId: string, userId: string, privacy: 'public' | 'private'): Promise<void> {
    // First get the room to determine which participant this is
    const room = await this.getDebateRoom(roomId);
    if (!room) {
      throw new Error('Debate room not found');
    }

    // Determine which participant field to update
    if (room.participant1Id === userId) {
      await db
        .update(debateRooms)
        .set({ participant1Privacy: privacy })
        .where(eq(debateRooms.id, roomId));
    } else if (room.participant2Id === userId) {
      await db
        .update(debateRooms)
        .set({ participant2Privacy: privacy })
        .where(eq(debateRooms.id, roomId));
    } else {
      throw new Error('User is not a participant in this debate room');
    }
  }

  async getUserActiveDebateRoomsEnriched(userId: string): Promise<any[]> {
    // Get active debate rooms for the user
    const rooms = await db
      .select()
      .from(debateRooms)
      .where(
        and(
          eq(debateRooms.status, 'active'),
          or(
            eq(debateRooms.participant1Id, userId),
            eq(debateRooms.participant2Id, userId)
          )
        )
      )
      .orderBy(desc(debateRooms.startedAt));

    if (rooms.length === 0) {
      return [];
    }

    // Enrich with topic and opponent data, filtering out rooms with errors or missing data
    const enrichedRooms = await Promise.all(
      rooms.map(async (room) => {
        try {
          // Get topic information
          const topic = await this.getTopic(room.topicId);
          
          // Determine opponent ID
          const opponentId = room.participant1Id === userId 
            ? room.participant2Id 
            : room.participant1Id;
          
          // Get opponent information
          const opponent = await this.getUser(opponentId);
          
          // Skip if topic or opponent is missing
          if (!topic || !opponent) {
            return null;
          }
          
          // Count messages in this room
          const messageCount = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(debateMessages)
            .where(eq(debateMessages.roomId, room.id));
          
          // Determine user's stance
          const userStance = room.participant1Id === userId
            ? room.participant1Stance
            : room.participant2Stance;
          
          const opponentStance = room.participant1Id === userId
            ? room.participant2Stance
            : room.participant1Stance;

          return {
            ...room,
            topic,
            opponent,
            messageCount: messageCount[0]?.count || 0,
            userStance,
            opponentStance,
          };
        } catch (error) {
          // Skip rooms that error during enrichment (e.g., deleted topics/users)
          console.error(`Error enriching debate room ${room.id}:`, error);
          return null;
        }
      })
    );

    // Filter out null entries (rooms with errors or missing data)
    return enrichedRooms.filter(room => room !== null);
  }

  // Debate messages
  async addDebateMessage(roomId: string, userId: string, content: string, status: string = 'approved'): Promise<DebateMessage> {
    const [message] = await db
      .insert(debateMessages)
      .values({ roomId, userId, content, status })
      .returning();
    return message;
  }

  async getDebateMessages(roomId: string, viewerId?: string): Promise<DebateMessage[]> {
    const messages = await db
      .select()
      .from(debateMessages)
      .where(eq(debateMessages.roomId, roomId))
      .orderBy(debateMessages.createdAt);

    // Aggregate fallacy counts for all messages
    const messageIds = messages.map(m => m.id);
    const fallacyCounts = messageIds.length > 0 
      ? await db
          .select({
            messageId: debateMessageFlags.messageId,
            fallacyType: debateMessageFlags.fallacyType,
            count: sql<number>`count(*)::int`,
          })
          .from(debateMessageFlags)
          .where(inArray(debateMessageFlags.messageId, messageIds))
          .groupBy(debateMessageFlags.messageId, debateMessageFlags.fallacyType)
      : [];

    // Build fallacy counts map
    const fallacyMap: Record<string, Record<string, number>> = {};
    for (const row of fallacyCounts) {
      if (!fallacyMap[row.messageId]) {
        fallacyMap[row.messageId] = {};
      }
      fallacyMap[row.messageId][row.fallacyType] = row.count;
    }

    // If no viewer specified, return all messages with fallacy counts
    if (!viewerId) {
      return messages.map(m => ({
        ...m,
        fallacyCounts: fallacyMap[m.id] || {}
      }));
    }

    // Get the debate room to check privacy settings
    const room = await this.getDebateRoom(roomId);
    if (!room) {
      return messages.map(m => ({
        ...m,
        fallacyCounts: fallacyMap[m.id] || {}
      }));
    }

    // Redact messages based on privacy settings and add fallacy counts
    return messages.map(message => {
      // Check if this message's author has privacy set to private
      const isParticipant1 = message.userId === room.participant1Id;
      const isParticipant2 = message.userId === room.participant2Id;
      
      const shouldRedact = 
        (isParticipant1 && room.participant1Privacy === 'private' && viewerId !== room.participant1Id) ||
        (isParticipant2 && room.participant2Privacy === 'private' && viewerId !== room.participant2Id);

      if (shouldRedact) {
        return {
          ...message,
          content: '[Message redacted - user privacy settings]',
          fallacyCounts: fallacyMap[message.id] || {}
        };
      }

      return {
        ...message,
        fallacyCounts: fallacyMap[message.id] || {}
      };
    });
  }

  // Live streams
  async createLiveStream(stream: InsertLiveStream): Promise<LiveStream> {
    const [created] = await db.insert(liveStreams).values(stream).returning();
    return created;
  }

  async getLiveStreams(status?: string, category?: string): Promise<LiveStream[]> {
    // If category filter is needed, we must join with topics
    if (category) {
      let conditions = [];
      
      // Add status filter if provided
      if (status) {
        conditions.push(eq(liveStreams.status, status));
      }
      
      // Add category filter
      conditions.push(sql`${category} = ANY(${topics.categories})`);
      
      // Join with topics to filter by category
      const streamsWithCategory = await db
        .select({
          id: liveStreams.id,
          topicId: liveStreams.topicId,
          title: liveStreams.title,
          description: liveStreams.description,
          moderatorId: liveStreams.moderatorId,
          status: liveStreams.status,
          participantSelectionMethod: liveStreams.participantSelectionMethod,
          scheduledAt: liveStreams.scheduledAt,
          startedAt: liveStreams.startedAt,
          endedAt: liveStreams.endedAt,
          viewerCount: liveStreams.viewerCount,
          createdAt: liveStreams.createdAt,
        })
        .from(liveStreams)
        .innerJoin(topics, eq(liveStreams.topicId, topics.id))
        .where(and(...conditions))
        .orderBy(desc(liveStreams.createdAt));
      
      return streamsWithCategory;
    }
    
    // No category filter - just filter by status if provided
    if (status) {
      return await db
        .select()
        .from(liveStreams)
        .where(eq(liveStreams.status, status))
        .orderBy(desc(liveStreams.createdAt));
    }
    
    // No filters at all
    return await db
      .select()
      .from(liveStreams)
      .orderBy(desc(liveStreams.createdAt));
  }

  async getLiveStream(id: string): Promise<LiveStream | undefined> {
    const [stream] = await db.select().from(liveStreams).where(eq(liveStreams.id, id));
    return stream;
  }

  async updateStreamStatus(id: string, status: string): Promise<void> {
    const updates: any = { status };
    if (status === 'live') {
      updates.startedAt = new Date();
    } else if (status === 'ended') {
      updates.endedAt = new Date();
    }
    
    await db.update(liveStreams).set(updates).where(eq(liveStreams.id, id));
  }

  async updateViewerCount(id: string, count: number): Promise<void> {
    await db
      .update(liveStreams)
      .set({ viewerCount: count })
      .where(eq(liveStreams.id, id));
  }

  // Stream participants
  async addStreamParticipant(streamId: string, userId: string, stance: string): Promise<StreamParticipant> {
    const [participant] = await db
      .insert(streamParticipants)
      .values({ streamId, userId, stance })
      .returning();
    return participant;
  }

  async getStreamParticipants(streamId: string): Promise<StreamParticipant[]> {
    return await db
      .select()
      .from(streamParticipants)
      .where(eq(streamParticipants.streamId, streamId))
      .orderBy(streamParticipants.joinedAt);
  }

  async updateParticipantStatus(streamId: string, userId: string, updates: Partial<StreamParticipant>): Promise<void> {
    await db
      .update(streamParticipants)
      .set(updates)
      .where(
        and(
          eq(streamParticipants.streamId, streamId),
          eq(streamParticipants.userId, userId)
        )
      );
  }

  async removeStreamParticipant(streamId: string, userId: string): Promise<void> {
    await db
      .delete(streamParticipants)
      .where(
        and(
          eq(streamParticipants.streamId, streamId),
          eq(streamParticipants.userId, userId)
        )
      );
  }

  // Stream chat
  async addStreamChatMessage(streamId: string, userId: string, content: string, type = 'chat'): Promise<StreamChatMessage> {
    const [message] = await db
      .insert(streamChatMessages)
      .values({ streamId, userId, content, type })
      .returning();
    return message;
  }

  async getStreamChatMessages(streamId: string, limit = 100): Promise<StreamChatMessage[]> {
    return await db
      .select()
      .from(streamChatMessages)
      .where(eq(streamChatMessages.streamId, streamId))
      .orderBy(desc(streamChatMessages.createdAt))
      .limit(limit);
  }

  async moderateStreamMessage(messageId: string, isModerated: boolean): Promise<void> {
    await db
      .update(streamChatMessages)
      .set({ isModerated })
      .where(eq(streamChatMessages.id, messageId));
  }

  // Stream invitations
  async inviteUserToStream(streamId: string, userId: string): Promise<void> {
    await db.insert(streamInvitations).values({
      streamId,
      userId,
      status: 'pending',
    });
  }

  async getStreamInvitations(streamId: string): Promise<any[]> {
    const invites = await db
      .select({
        invitation: streamInvitations,
        user: users,
      })
      .from(streamInvitations)
      .leftJoin(users, eq(streamInvitations.userId, users.id))
      .where(eq(streamInvitations.streamId, streamId));
    
    return invites.map(inv => ({
      ...inv.invitation,
      user: inv.user,
    }));
  }

  async respondToStreamInvitation(invitationId: string, userId: string, accept: boolean): Promise<void> {
    await db
      .update(streamInvitations)
      .set({
        status: accept ? 'accepted' : 'declined',
        respondedAt: new Date(),
      })
      .where(and(
        eq(streamInvitations.id, invitationId),
        eq(streamInvitations.userId, userId)
      ));
  }

  async getUserStreamInvitations(userId: string, status?: string): Promise<any[]> {
    let conditions = [eq(streamInvitations.userId, userId)];
    
    if (status) {
      conditions.push(eq(streamInvitations.status, status));
    }
    
    const invites = await db
      .select({
        invitation: streamInvitations,
        stream: liveStreams,
        topic: topics,
      })
      .from(streamInvitations)
      .leftJoin(liveStreams, eq(streamInvitations.streamId, liveStreams.id))
      .leftJoin(topics, eq(liveStreams.topicId, topics.id))
      .where(and(...conditions))
      .orderBy(desc(streamInvitations.invitedAt));
    
    return invites.map(inv => ({
      ...inv.invitation,
      stream: inv.stream,
      topic: inv.topic,
    }));
  }

  async getUserStreams(userId: string, statusFilter?: string): Promise<LiveStream[]> {
    let conditions = [eq(liveStreams.moderatorId, userId)];
    
    if (statusFilter) {
      conditions.push(eq(liveStreams.status, statusFilter));
    }
    
    return await db
      .select()
      .from(liveStreams)
      .where(and(...conditions))
      .orderBy(desc(liveStreams.scheduledAt));
  }

  // User profiles
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId));
    return profile;
  }

  async upsertUserProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
    const existing = await this.getUserProfile(userId);
    
    if (existing) {
      const [updated] = await db
        .update(userProfiles)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(userProfiles.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(userProfiles)
        .values({ ...data, userId } as any)
        .returning();
      return created;
    }
  }

  async analyzeUserPoliticalLeaning(userId: string): Promise<UserProfile> {
    // Get user's opinions for analysis
    const userOpinions = await this.getUserOpinions(userId, 'recent', 50);
    
    if (userOpinions.length === 0) {
      // No opinions to analyze, return basic profile
      return await this.upsertUserProfile(userId, {
        politicalLeaning: 'unknown',
        leaningScore: 0,
        leaningConfidence: 'low',
        totalOpinions: 0,
        lastAnalyzedAt: new Date(),
      });
    }

    // Use AI to analyze political leaning based on opinions
    const analysis = await AIService.analyzePoliticalLeaning(userOpinions);
    
    // Update profile with analysis results
    return await this.upsertUserProfile(userId, {
      politicalLeaning: analysis.leaning,
      leaningScore: analysis.score,
      leaningConfidence: analysis.confidence,
      totalOpinions: userOpinions.length,
      lastAnalyzedAt: new Date(),
    });
  }

  async getUserOpinions(userId: string, sortBy: 'recent' | 'oldest' | 'popular' | 'controversial' = 'recent', limit = 20): Promise<Opinion[]> {
    switch (sortBy) {
      case 'recent':
        return await db
          .select()
          .from(opinions)
          .where(eq(opinions.userId, userId))
          .orderBy(desc(opinions.createdAt))
          .limit(limit);
      case 'oldest':
        return await db
          .select()
          .from(opinions)
          .where(eq(opinions.userId, userId))
          .orderBy(asc(opinions.createdAt))
          .limit(limit);
      case 'popular':
        return await db
          .select()
          .from(opinions)
          .where(eq(opinions.userId, userId))
          .orderBy(desc(opinions.likesCount))
          .limit(limit);
      case 'controversial':
        return await db
          .select()
          .from(opinions)
          .where(eq(opinions.userId, userId))
          .orderBy(desc(sql`${opinions.likesCount} + ${opinions.dislikesCount}`))
          .limit(limit);
      default:
        return await db
          .select()
          .from(opinions)
          .where(eq(opinions.userId, userId))
          .orderBy(desc(opinions.createdAt))
          .limit(limit);
    }
  }

  // User following
  async followUser(followerId: string, followingId: string): Promise<UserFollow> {
    if (followerId === followingId) {
      throw new Error("Users cannot follow themselves");
    }

    const [follow] = await db
      .insert(userFollows)
      .values({ followerId, followingId })
      .onConflictDoNothing()
      .returning();
    
    // Update follow counts for both users
    await this.updateFollowCounts(followerId);
    await this.updateFollowCounts(followingId);
    
    return follow;
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    await db
      .delete(userFollows)
      .where(
        and(
          eq(userFollows.followerId, followerId),
          eq(userFollows.followingId, followingId)
        )
      );
    
    // Update follow counts for both users
    await this.updateFollowCounts(followerId);
    await this.updateFollowCounts(followingId);
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const [follow] = await db
      .select()
      .from(userFollows)
      .where(
        and(
          eq(userFollows.followerId, followerId),
          eq(userFollows.followingId, followingId)
        )
      );
    return !!follow;
  }

  async getUserFollowers(userId: string, limit = 50): Promise<User[]> {
    return await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(userFollows)
      .innerJoin(users, eq(userFollows.followerId, users.id))
      .where(eq(userFollows.followingId, userId))
      .orderBy(desc(userFollows.createdAt))
      .limit(limit);
  }

  async getUserFollowing(userId: string, limit = 50): Promise<User[]> {
    return await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(userFollows)
      .innerJoin(users, eq(userFollows.followingId, users.id))
      .where(eq(userFollows.followerId, userId))
      .orderBy(desc(userFollows.createdAt))
      .limit(limit);
  }

  async updateFollowCounts(userId: string): Promise<void> {
    // Get follower count
    const [followerResult] = await db
      .select({ count: count() })
      .from(userFollows)
      .where(eq(userFollows.followingId, userId));
    
    // Get following count
    const [followingResult] = await db
      .select({ count: count() })
      .from(userFollows)
      .where(eq(userFollows.followerId, userId));
    
    // Update user profile with counts
    await this.upsertUserProfile(userId, {
      followerCount: followerResult.count,
      followingCount: followingResult.count,
    });
  }

  // Moderation operations
  async flagOpinion(opinionId: string, userId: string, fallacyType: string): Promise<void> {
    await db.insert(opinionFlags).values({ opinionId, userId, fallacyType }).onConflictDoNothing();
    await db.update(opinions).set({ status: 'flagged' }).where(eq(opinions.id, opinionId));
  }

  async flagTopic(topicId: string, userId: string, fallacyType: string): Promise<void> {
    await db.insert(topicFlags).values({ topicId, userId, fallacyType }).onConflictDoNothing();
  }

  async flagDebateMessage(messageId: string, userId: string, fallacyType: string): Promise<void> {
    await db.insert(debateMessageFlags).values({ messageId, userId, fallacyType }).onConflictDoNothing();
    await db.update(debateMessages).set({ status: 'flagged' }).where(eq(debateMessages.id, messageId));
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

  async approveChallenge(challengeId: string, moderatorId: string, reason?: string): Promise<void> {
    await db.update(opinionChallenges).set({ status: 'approved' }).where(eq(opinionChallenges.id, challengeId));
    await db.insert(moderationActions).values({
      moderatorId,
      actionType: 'approve_challenge',
      targetType: 'challenge',
      targetId: challengeId,
      reason: reason || 'Challenge approved',
    });
  }

  async rejectChallenge(challengeId: string, moderatorId: string, reason?: string): Promise<void> {
    await db.update(opinionChallenges).set({ status: 'rejected' }).where(eq(opinionChallenges.id, challengeId));
    await db.insert(moderationActions).values({
      moderatorId,
      actionType: 'reject_challenge',
      targetType: 'challenge',
      targetId: challengeId,
      reason: reason || 'Challenge rejected',
    });
  }

  async getPendingChallenges(): Promise<any[]> {
    const pending = await db
      .select({
        challenge: opinionChallenges,
        opinion: opinions,
        topic: topics,
        author: users,
      })
      .from(opinionChallenges)
      .innerJoin(opinions, eq(opinionChallenges.opinionId, opinions.id))
      .innerJoin(topics, eq(opinions.topicId, topics.id))
      .innerJoin(users, eq(opinionChallenges.userId, users.id))
      .where(eq(opinionChallenges.status, 'pending'))
      .orderBy(desc(opinionChallenges.createdAt));
    
    return pending;
  }

  async suspendUser(userId: string, moderatorId: string, reason?: string): Promise<void> {
    await db.update(users).set({ status: 'suspended' }).where(eq(users.id, userId));
    await db.insert(moderationActions).values({
      moderatorId,
      actionType: 'suspend_user',
      targetType: 'user',
      targetId: userId,
      reason: reason || 'User suspended',
    });
  }

  async banUser(userId: string, moderatorId: string, reason?: string): Promise<void> {
    await db.update(users).set({ status: 'banned' }).where(eq(users.id, userId));
    await db.insert(moderationActions).values({
      moderatorId,
      actionType: 'ban_user',
      targetType: 'user',
      targetId: userId,
      reason: reason || 'User banned',
    });
  }

  async reinstateUser(userId: string, moderatorId: string, reason?: string): Promise<void> {
    await db.update(users).set({ status: 'active' }).where(eq(users.id, userId));
    await db.insert(moderationActions).values({
      moderatorId,
      actionType: 'reinstate_user',
      targetType: 'user',
      targetId: userId,
      reason: reason || 'User reinstated',
    });
  }

  async hideTopic(topicId: string, moderatorId: string, reason?: string): Promise<void> {
    await db.update(topics).set({ status: 'hidden' }).where(eq(topics.id, topicId));
    await db.insert(moderationActions).values({
      moderatorId,
      actionType: 'hide_topic',
      targetType: 'topic',
      targetId: topicId,
      reason: reason || 'Topic hidden',
    });
  }

  async archiveTopic(topicId: string, moderatorId: string, reason?: string): Promise<void> {
    await db.update(topics).set({ status: 'archived' }).where(eq(topics.id, topicId));
    await db.insert(moderationActions).values({
      moderatorId,
      actionType: 'archive_topic',
      targetType: 'topic',
      targetId: topicId,
      reason: reason || 'Topic archived',
    });
  }

  async restoreTopic(topicId: string, moderatorId: string, reason?: string): Promise<void> {
    await db.update(topics).set({ status: 'active' }).where(eq(topics.id, topicId));
    await db.insert(moderationActions).values({
      moderatorId,
      actionType: 'restore_topic',
      targetType: 'topic',
      targetId: topicId,
      reason: reason || 'Topic restored',
    });
  }

  // Banned phrases operations
  // Admin - User management
  async getAllUsers(filters: { role?: string; status?: string; search?: string; limit?: number } = {}): Promise<User[]> {
    const { role, status, search, limit = 100 } = filters;
    
    let query = db.select().from(users);
    
    const conditions = [];
    if (role) {
      conditions.push(eq(users.role, role));
    }
    if (status) {
      conditions.push(eq(users.status, status));
    }
    if (search) {
      conditions.push(
        or(
          ilike(users.email, `%${search}%`),
          ilike(users.firstName, `%${search}%`),
          ilike(users.lastName, `%${search}%`)
        )
      );
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(users.createdAt)).limit(limit);
  }

  async updateUserRole(userId: string, role: string, adminId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Update user role
      await tx.update(users)
        .set({ role })
        .where(eq(users.id, userId));
      
      // Log the action
      await tx.insert(moderationActions).values({
        actionType: 'role_change',
        targetType: 'user',
        targetId: userId,
        moderatorId: adminId,
        reason: `Role changed to ${role}`,
      });
    });
  }
  
  // Admin - Content management
  async getAllTopics(filters: { status?: string; startDate?: Date; endDate?: Date; limit?: number } = {}): Promise<TopicWithCounts[]> {
    const { status, startDate, endDate, limit = 100 } = filters;
    
    const conditions = [];
    if (status) {
      conditions.push(eq(topics.status, status));
    }
    if (startDate) {
      conditions.push(sql`${topics.createdAt} >= ${startDate}`);
    }
    if (endDate) {
      conditions.push(sql`${topics.createdAt} <= ${endDate}`);
    }
    
    let query = db
      .select({
        id: topics.id,
        title: topics.title,
        category: topics.category,
        status: topics.status,
        createdAt: topics.createdAt,
        updatedAt: topics.updatedAt,
        participantsCount: topics.participantsCount,
        opinionsCount: topics.opinionsCount,
        previewContent: topics.previewContent,
        previewAuthor: topics.previewAuthor,
        previewIsAI: topics.previewIsAI,
      })
      .from(topics);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(topics.createdAt)).limit(limit);
  }

  async getAllOpinions(filters: { status?: string; startDate?: Date; endDate?: Date; limit?: number } = {}): Promise<Opinion[]> {
    const { status, startDate, endDate, limit = 100 } = filters;
    
    const conditions = [];
    if (status) {
      conditions.push(eq(opinions.status, status));
    }
    if (startDate) {
      conditions.push(sql`${opinions.createdAt} >= ${startDate}`);
    }
    if (endDate) {
      conditions.push(sql`${opinions.createdAt} <= ${endDate}`);
    }
    
    let query = db.select().from(opinions);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(opinions.createdAt)).limit(limit);
  }
  
  // Admin - Audit log
  async getModerationActions(filters: { actionType?: string; moderatorId?: string; startDate?: Date; endDate?: Date; limit?: number } = {}): Promise<any[]> {
    const { actionType, moderatorId, startDate, endDate, limit = 100 } = filters;
    
    const conditions = [];
    if (actionType) {
      conditions.push(eq(moderationActions.actionType, actionType));
    }
    if (moderatorId) {
      conditions.push(eq(moderationActions.moderatorId, moderatorId));
    }
    if (startDate) {
      conditions.push(sql`${moderationActions.createdAt} >= ${startDate}`);
    }
    if (endDate) {
      conditions.push(sql`${moderationActions.createdAt} <= ${endDate}`);
    }
    
    let query = db
      .select({
        action: moderationActions,
        moderator: users,
      })
      .from(moderationActions)
      .leftJoin(users, eq(moderationActions.moderatorId, users.id));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.orderBy(desc(moderationActions.createdAt)).limit(limit);
  }

  async getAllBannedPhrases(): Promise<BannedPhrase[]> {
    return await db.select().from(bannedPhrases).orderBy(desc(bannedPhrases.createdAt));
  }

  async createBannedPhrase(phrase: InsertBannedPhrase): Promise<BannedPhrase> {
    const [newPhrase] = await db.insert(bannedPhrases).values(phrase).returning();
    return newPhrase;
  }

  async deleteBannedPhrase(id: string): Promise<void> {
    await db.delete(bannedPhrases).where(eq(bannedPhrases.id, id));
  }

  // Theme operations
  async createTheme(theme: InsertTheme): Promise<Theme> {
    const [newTheme] = await db.insert(themes).values(theme).returning();
    return newTheme;
  }

  async getTheme(id: string): Promise<Theme | undefined> {
    const [theme] = await db.select().from(themes).where(eq(themes.id, id));
    return theme;
  }

  async getThemes(options?: { userId?: string; visibility?: string; limit?: number; search?: string }): Promise<Theme[]> {
    let query = db.select().from(themes);
    
    const conditions = [];
    if (options?.userId) {
      conditions.push(eq(themes.userId, options.userId));
    }
    if (options?.visibility) {
      conditions.push(eq(themes.visibility, options.visibility));
    }
    if (options?.search) {
      conditions.push(
        or(
          ilike(themes.name, `%${options.search}%`),
          ilike(themes.description, `%${options.search}%`)
        )
      );
    }
    
    if (conditions.length > 0) {
      query = query.where(conditions.length === 1 ? conditions[0] : and(...conditions)) as any;
    }
    
    query = query.orderBy(desc(themes.createdAt)) as any;
    
    if (options?.limit) {
      query = query.limit(options.limit) as any;
    }
    
    return await query;
  }

  async getUserThemes(userId: string): Promise<Theme[]> {
    return await db
      .select()
      .from(themes)
      .where(eq(themes.userId, userId))
      .orderBy(desc(themes.createdAt));
  }

  async getPublicThemes(limit: number = 50, search?: string, userId?: string): Promise<any[]> {
    let query = db
      .select({
        id: themes.id,
        userId: themes.userId,
        name: themes.name,
        description: themes.description,
        visibility: themes.visibility,
        baseTheme: themes.baseTheme,
        colors: themes.colors,
        forkedFromThemeId: themes.forkedFromThemeId,
        likesCount: themes.likesCount,
        usageCount: themes.usageCount,
        createdAt: themes.createdAt,
        updatedAt: themes.updatedAt,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        liked: userId ? sql<boolean>`EXISTS(
          SELECT 1 FROM ${themeLikes} 
          WHERE ${themeLikes.themeId} = ${themes.id} 
          AND ${themeLikes.userId} = ${userId}
        )` : sql<boolean>`false`,
      })
      .from(themes)
      .leftJoin(users, eq(themes.userId, users.id))
      .where(eq(themes.visibility, 'public'));

    if (search) {
      query = query.where(
        and(
          eq(themes.visibility, 'public'),
          or(
            ilike(themes.name, `%${search}%`),
            ilike(themes.description, `%${search}%`)
          )
        )
      ) as any;
    }

    query = query.orderBy(desc(themes.createdAt)) as any;

    if (limit) {
      query = query.limit(limit) as any;
    }

    return await query;
  }

  async updateTheme(themeId: string, userId: string, data: Partial<InsertTheme>): Promise<Theme> {
    const [updated] = await db
      .update(themes)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(themes.id, themeId), eq(themes.userId, userId)))
      .returning();
    
    if (!updated) {
      throw new Error('Theme not found or unauthorized');
    }
    
    return updated;
  }

  async deleteTheme(themeId: string, userId: string): Promise<void> {
    await db
      .delete(themes)
      .where(and(eq(themes.id, themeId), eq(themes.userId, userId)));
  }

  async forkTheme(themeId: string, userId: string, newName: string, newDescription?: string): Promise<Theme> {
    const [originalTheme] = await db.select().from(themes).where(eq(themes.id, themeId));
    
    if (!originalTheme) {
      throw new Error('Theme not found');
    }
    
    const [forkedTheme] = await db.insert(themes).values({
      userId,
      name: newName,
      description: newDescription || `Forked from ${originalTheme.name}`,
      visibility: 'private',
      baseTheme: originalTheme.baseTheme,
      colors: originalTheme.colors,
      forkedFromThemeId: themeId,
    }).returning();
    
    return forkedTheme;
  }

  async likeTheme(themeId: string, userId: string): Promise<void> {
    try {
      await db.insert(themeLikes).values({ themeId, userId });
      await db
        .update(themes)
        .set({ likesCount: sql`${themes.likesCount} + 1` })
        .where(eq(themes.id, themeId));
    } catch (error) {
      // Ignore duplicate like errors
    }
  }

  async unlikeTheme(themeId: string, userId: string): Promise<void> {
    await db
      .delete(themeLikes)
      .where(and(eq(themeLikes.themeId, themeId), eq(themeLikes.userId, userId)));
    
    await db
      .update(themes)
      .set({ likesCount: sql`GREATEST(${themes.likesCount} - 1, 0)` })
      .where(eq(themes.id, themeId));
  }

  async isThemeLiked(themeId: string, userId: string): Promise<boolean> {
    const [like] = await db
      .select()
      .from(themeLikes)
      .where(and(eq(themeLikes.themeId, themeId), eq(themeLikes.userId, userId)));
    
    return !!like;
  }

  async incrementThemeUsage(themeId: string): Promise<void> {
    await db
      .update(themes)
      .set({ usageCount: sql`${themes.usageCount} + 1` })
      .where(eq(themes.id, themeId));
  }

  // Badge operations
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
    const unlocked = await db
      .select({
        badge: badges,
        unlockedAt: userBadges.unlockedAt,
      })
      .from(userBadges)
      .innerJoin(badges, eq(userBadges.badgeId, badges.id))
      .where(eq(userBadges.userId, userId))
      .orderBy(desc(userBadges.unlockedAt));

    return unlocked;
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

  async getLeaderboards(): Promise<any> {
    // Most Opinionated (top 10 by opinion count)
    const mostOpinionated = await db
      .select({
        userId: opinions.userId,
        count: count(),
      })
      .from(opinions)
      .groupBy(opinions.userId)
      .orderBy(desc(count()))
      .limit(10);

    // Active Debater (top 10 by debate participation)
    const activeDebaters = await db
      .select({
        userId: sql<string>`CASE 
          WHEN ${debateRooms.participant1Id} IS NOT NULL THEN ${debateRooms.participant1Id}
          WHEN ${debateRooms.participant2Id} IS NOT NULL THEN ${debateRooms.participant2Id}
        END`.as('user_id'),
        count: count(),
      })
      .from(debateRooms)
      .groupBy(sql`user_id`)
      .orderBy(desc(count()))
      .limit(10);

    // Topic Creators (top 10 by topics created)
    const topicCreators = await db
      .select({
        userId: topics.createdById,
        count: count(),
      })
      .from(topics)
      .groupBy(topics.createdById)
      .orderBy(desc(count()))
      .limit(10);

    // Get user details for each leaderboard
    const opinionatedUserIds = mostOpinionated.map((u) => u.userId);
    const debaterUserIds = activeDebaters.map((u) => u.userId).filter((id): id is string => id !== null);
    const creatorUserIds = topicCreators.map((u) => u.userId);

    const allUserIds = Array.from(new Set([...opinionatedUserIds, ...debaterUserIds, ...creatorUserIds]));
    
    const usersData = allUserIds.length > 0
      ? await db
          .select()
          .from(users)
          .where(inArray(users.id, allUserIds))
      : [];

    const userMap = new Map(usersData.map((u) => [u.id, u]));

    return {
      mostOpinionated: mostOpinionated.map((item) => ({
        user: userMap.get(item.userId),
        count: Number(item.count),
      })).filter(item => item.user),
      activeDebaters: activeDebaters.map((item) => ({
        user: item.userId ? userMap.get(item.userId) : null,
        count: Number(item.count),
      })).filter(item => item.user),
      topicCreators: topicCreators.map((item) => ({
        user: userMap.get(item.userId),
        count: Number(item.count),
      })).filter(item => item.user),
    };
  }
}

export const storage = new DatabaseStorage();
