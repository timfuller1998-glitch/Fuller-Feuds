import {
  users,
  topics,
  opinions,
  cumulativeOpinions,
  debateRooms,
  debateMessages,
  debateVotes,
  userDebateStats,
  liveStreams,
  streamInvitations,
  streamParticipants,
  streamChatMessages,
  opinionVotes,
  opinionFlags,
  topicFlags,
  debateMessageFlags,
  moderationActions,
  bannedPhrases,
  userFollows,
  userProfiles,
  topicViews,
  badges,
  userBadges,
  notifications,
  pushSubscriptions,
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
  type DebateVote,
  type InsertDebateVote,
  type UserDebateStats,
  type InsertUserDebateStats,
  type LiveStream,
  type InsertLiveStream,
  type StreamInvitation,
  type StreamParticipant,
  type StreamChatMessage,
  type OpinionVote,
  type UserFollow,
  type InsertUserFollow,
  type UserProfile,
  type InsertUserProfile,
  type BannedPhrase,
  type InsertBannedPhrase,
  type Badge,
  type InsertBadge,
  type UserBadge,
  type InsertUserBadge,
  type Notification,
  type InsertNotification,
  type PushSubscription,
  type InsertPushSubscription,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, sql, count, ilike, or, inArray, ne } from "drizzle-orm";
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
  getTopics(options?: { limit?: number; category?: string; search?: string; createdBy?: string }): Promise<TopicWithCounts[]>;
  getTopic(id: string): Promise<Topic | undefined>;
  deleteTopic(id: string): Promise<void>;
  countTopicsByUser(userId: string): Promise<number>;
  updateTopicEmbedding(topicId: string, embedding: number[]): Promise<void>;
  getTopicPoliticalDistribution(topicId: string): Promise<{
    authoritarianCapitalist: number;
    authoritarianSocialist: number;
    libertarianCapitalist: number;
    libertarianSocialist: number;
  }>;
  getActiveUserPoliticalDistribution(): Promise<{
    authoritarianCapitalist: number;
    authoritarianSocialist: number;
    libertarianCapitalist: number;
    libertarianSocialist: number;
  }>;
  
  // Opinion operations
  createOpinion(opinion: InsertOpinion): Promise<Opinion>;
  getOpinionsByTopic(topicId: string, userRole?: string, currentUserId?: string): Promise<Opinion[]>;
  getRecentOpinions(limit?: number, userRole?: string, currentUserId?: string): Promise<Opinion[]>;
  getOpinion(id: string): Promise<Opinion | undefined>;
  updateOpinion(opinionId: string, data: Partial<InsertOpinion>): Promise<Opinion>;
  updateOpinionCounts(opinionId: string, likesCount: number, dislikesCount: number): Promise<void>;
  
  // Opinion voting
  voteOnOpinion(opinionId: string, userId: string, voteType: 'like' | 'dislike' | null): Promise<void>;
  getUserVoteOnOpinion(opinionId: string, userId: string): Promise<OpinionVote | undefined>;
  
  // Cumulative opinions
  getCumulativeOpinion(topicId: string): Promise<CumulativeOpinion | undefined>;
  upsertCumulativeOpinion(topicId: string, data: Partial<CumulativeOpinion>): Promise<CumulativeOpinion>;
  generateCumulativeOpinion(topicId: string): Promise<CumulativeOpinion>;
  refreshCumulativeOpinion(topicId: string): Promise<CumulativeOpinion>;
  
  // Debate rooms
  createDebateRoom(room: InsertDebateRoom): Promise<DebateRoom>;
  createDebateRoomWithOpinionAuthor(opinionId: string, userId: string): Promise<DebateRoom>;
  getDebateRoom(id: string): Promise<DebateRoom | undefined>;
  getUserDebateRooms(userId: string): Promise<DebateRoom[]>;
  endDebateRoom(id: string): Promise<void>;
  findOppositeOpinionUsers(topicId: string, userId: string, currentStance: string): Promise<User[]>;
  updateDebateRoomPrivacy(roomId: string, userId: string, privacy: 'public' | 'private'): Promise<void>;
  
  // Debate messages
  addDebateMessage(roomId: string, userId: string, content: string, status?: string): Promise<DebateMessage>;
  getDebateMessages(roomId: string, viewerId?: string): Promise<DebateMessage[]>;
  updateDebateRoomTurn(roomId: string, userId: string): Promise<DebateRoom>;
  
  // Debate voting and stats
  submitDebateVote(vote: InsertDebateVote): Promise<DebateVote>;
  getDebateVotes(roomId: string): Promise<DebateVote[]>;
  updateUserDebateStats(userId: string): Promise<UserDebateStats>;
  getUserDebateStats(userId: string): Promise<UserDebateStats | undefined>;
  updateDebatePhase(roomId: string, phase: 'structured' | 'voting' | 'free-form'): Promise<void>;
  submitVoteToContinue(roomId: string, userId: string, voteToContinue: boolean): Promise<DebateRoom>;
  
  // Debate management
  getGroupedDebateRooms(userId: string): Promise<{
    opponent: User;
    debates: DebateRoom[];
    totalUnread: number;
    isRecent: boolean;
  }[]>;
  getArchivedDebateRooms(userId: string): Promise<DebateRoom[]>;
  markDebateRoomAsRead(roomId: string, userId: string): Promise<void>;
  archiveDebateRoom(roomId: string): Promise<void>;
  getEndedDebatesForArchiving(daysInactive: number): Promise<DebateRoom[]>;
  
  // Notifications
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUserNotifications(userId: string, limit?: number): Promise<Notification[]>;
  markNotificationAsRead(notificationId: string): Promise<void>;
  
  // Push subscriptions
  subscribeToPush(subscription: InsertPushSubscription): Promise<PushSubscription>;
  unsubscribeFromPush(userId: string, endpoint: string): Promise<void>;
  getUserPushSubscriptions(userId: string): Promise<PushSubscription[]>;
  
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
  getUserOpinions(userId: string, sortBy?: 'recent' | 'popular' | 'controversial', limit?: number, viewerUserId?: string): Promise<Opinion[]>;
  
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
  suspendUser(userId: string, moderatorId: string, reason?: string): Promise<void>;
  banUser(userId: string, moderatorId: string, reason?: string): Promise<void>;
  reinstateUser(userId: string, moderatorId: string, reason?: string): Promise<void>;
  hideTopic(topicId: string, moderatorId: string, reason?: string): Promise<void>;
  archiveTopic(topicId: string, moderatorId: string, reason?: string): Promise<void>;
  restoreTopic(topicId: string, moderatorId: string, reason?: string): Promise<void>;
  
  // Admin - User management
  getAllUsers(filters?: { role?: string; status?: string; search?: string; limit?: number }): Promise<User[]>;
  updateUserRole(userId: string, role: string, adminId: string): Promise<void>;
  updateUserStatus(userId: string, status: string, adminId: string): Promise<void>;
  deleteUser(userId: string, adminId: string): Promise<void>;
  
  // Admin - Content management
  getAllTopics(filters?: { status?: string; startDate?: Date; endDate?: Date; limit?: number }): Promise<TopicWithCounts[]>;
  getAllOpinions(filters?: { status?: string; startDate?: Date; endDate?: Date; limit?: number }): Promise<Opinion[]>;
  deleteTopicAdmin(topicId: string, adminId: string): Promise<void>;
  deleteOpinionAdmin(opinionId: string, adminId: string): Promise<void>;
  
  // Admin - Audit log
  getModerationActions(filters?: { actionType?: string; moderatorId?: string; startDate?: Date; endDate?: Date; limit?: number }): Promise<any[]>;
  
  // Admin - Data sync utilities
  syncOpinionCounts(): Promise<{ updated: number; synced: Array<{ userId: string; oldCount: number; newCount: number }> }>;
  
  // Banned phrases operations
  getAllBannedPhrases(): Promise<BannedPhrase[]>;
  createBannedPhrase(phrase: InsertBannedPhrase): Promise<BannedPhrase>;
  deleteBannedPhrase(id: string): Promise<void>;
  
  // Badge operations
  initializeBadges(): Promise<void>;
  getAllBadges(): Promise<any[]>;
  getUserBadges(userId: string): Promise<any[]>;
  checkAndAwardBadges(userId: string): Promise<string[]>;
  setSelectedBadge(userId: string, badgeId: string | null): Promise<void>;
  getLeaderboards(): Promise<any>;
  
  // Topic views tracking
  recordTopicView(userId: string, topicId: string): Promise<void>;
  getRecentlyViewedCategories(userId: string, limit?: number): Promise<string[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Try to insert, and if there's a conflict on ID, update the existing user
    // If there's a conflict on email (different ID), the insert will fail due to unique constraint
    try {
      const [user] = await db
        .insert(users)
        .values(userData)
        .onConflictDoUpdate({
          target: users.id,
          set: {
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            updatedAt: new Date(),
          },
        })
        .returning();
      return user;
    } catch (error: any) {
      // Check if it's a duplicate email constraint error
      if (error.message?.includes('users_email_unique')) {
        // Email already exists with a different ID
        // Find the existing user by email and update their info (preserve their ID)
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, userData.email))
          .limit(1);
        
        if (existingUser) {
          // Update the existing user's info, keeping their original ID
          const [updatedUser] = await db
            .update(users)
            .set({
              firstName: userData.firstName,
              lastName: userData.lastName,
              profileImageUrl: userData.profileImageUrl,
              updatedAt: new Date(),
            })
            .where(eq(users.email, userData.email))
            .returning();
          return updatedUser;
        }
      }
      throw error;
    }
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

  async updateTopicEmbedding(topicId: string, embedding: number[]): Promise<void> {
    await db
      .update(topics)
      .set({ embedding: embedding as any })
      .where(eq(topics.id, topicId));
  }

  // Helper method to enrich a topic with preview content and political diversity
  private async enrichTopicWithPreview(topic: Topic): Promise<{
    previewContent?: string;
    previewAuthor?: string;
    previewIsAI: boolean;
    diversityScore: number;
    politicalDistribution: {
      authoritarianCapitalist: number;
      authoritarianSocialist: number;
      libertarianCapitalist: number;
      libertarianSocialist: number;
    };
  }> {
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

    // Get political distribution and diversity score
    const politicalDistribution = await this.getTopicPoliticalDistribution(topic.id);
    const diversityScore = this.calculatePoliticalDiversityScore(politicalDistribution);
    
    return { 
      previewContent, 
      previewAuthor, 
      previewIsAI,
      diversityScore,
      politicalDistribution
    };
  }

  async getTopics(options?: { limit?: number; category?: string; search?: string; createdBy?: string }): Promise<TopicWithCounts[]> {
    const { limit = 50, category, search, createdBy } = options || {};
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
    
    if (createdBy) {
      conditions.push(eq(topics.createdById, createdBy));
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
        
        // Count unique participants across opinions, votes, and flags using a single SQL query
        // This uses UNION to combine all three sources and DISTINCT to count unique users
        // Only counts participants for approved opinions
        const participantsResult = await db.execute(sql`
          SELECT COUNT(DISTINCT user_id)::int as count
          FROM (
            SELECT user_id FROM opinions WHERE topic_id = ${topic.id} AND status = 'approved'
            UNION
            SELECT user_id FROM opinion_votes WHERE opinion_id IN (
              SELECT id FROM opinions WHERE topic_id = ${topic.id} AND status = 'approved'
            )
            UNION
            SELECT user_id FROM opinion_flags WHERE opinion_id IN (
              SELECT id FROM opinions WHERE topic_id = ${topic.id} AND status = 'approved'
            )
          ) AS all_participants
          WHERE user_id IS NOT NULL
        `);
        
        const participantCount = Number(participantsResult.rows[0]?.count || 0);
        
        // Get preview content using helper method
        const previewData = await this.enrichTopicWithPreview(topic);
        
        return {
          ...topic,
          opinionsCount,
          participantCount,
          ...previewData
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
    let authoritarianCapitalist = 0;  // economic >= 0, authoritarian >= 0
    let authoritarianSocialist = 0;   // economic < 0, authoritarian >= 0
    let libertarianCapitalist = 0;    // economic >= 0, authoritarian < 0
    let libertarianSocialist = 0;     // economic < 0, authoritarian < 0

    for (const opinion of topicOpinions) {
      const economic = opinion.topicEconomicScore || 0;
      const authoritarian = opinion.topicAuthoritarianScore || 0;

      if (economic >= 0 && authoritarian >= 0) {
        authoritarianCapitalist++;
      } else if (economic < 0 && authoritarian >= 0) {
        authoritarianSocialist++;
      } else if (economic >= 0 && authoritarian < 0) {
        libertarianCapitalist++;
      } else {
        libertarianSocialist++;
      }
    }

    const total = topicOpinions.length;

    // Calculate percentages with proper rounding to ensure sum = 100
    const percentages = {
      authoritarianCapitalist: (authoritarianCapitalist / total) * 100,
      authoritarianSocialist: (authoritarianSocialist / total) * 100,
      libertarianCapitalist: (libertarianCapitalist / total) * 100,
      libertarianSocialist: (libertarianSocialist / total) * 100
    };

    // Round each value
    const rounded = {
      authoritarianCapitalist: Math.round(percentages.authoritarianCapitalist),
      authoritarianSocialist: Math.round(percentages.authoritarianSocialist),
      libertarianCapitalist: Math.round(percentages.libertarianCapitalist),
      libertarianSocialist: Math.round(percentages.libertarianSocialist)
    };

    // Adjust to ensure sum = 100 (distribute rounding error)
    const sum = rounded.authoritarianCapitalist + rounded.authoritarianSocialist + 
                rounded.libertarianCapitalist + rounded.libertarianSocialist;
    const diff = 100 - sum;

    if (diff !== 0) {
      // Find the quadrant with the largest fractional part and adjust it
      const fractionals = [
        { key: 'authoritarianCapitalist' as const, frac: percentages.authoritarianCapitalist - rounded.authoritarianCapitalist },
        { key: 'authoritarianSocialist' as const, frac: percentages.authoritarianSocialist - rounded.authoritarianSocialist },
        { key: 'libertarianCapitalist' as const, frac: percentages.libertarianCapitalist - rounded.libertarianCapitalist },
        { key: 'libertarianSocialist' as const, frac: percentages.libertarianSocialist - rounded.libertarianSocialist }
      ].sort((a, b) => Math.abs(b.frac) - Math.abs(a.frac));

      rounded[fractionals[0].key] += diff;
    }

    return rounded;
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
      .where(sql`${opinions.createdAt} >= ${twelveHoursAgo}`);

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
    const uniqueUserIds = [...new Set(recentOpinions.map(o => o.userId))];

    // Get user profiles with political scores
    const activeUserProfiles = await db
      .select()
      .from(userProfiles)
      .where(and(
        inArray(userProfiles.userId, uniqueUserIds),
        sql`${userProfiles.economicScore} IS NOT NULL`,
        sql`${userProfiles.authoritarianScore} IS NOT NULL`
      ));

    if (activeUserProfiles.length === 0) {
      // No users with political scores yet
      return {
        authoritarianCapitalist: 0,
        authoritarianSocialist: 0,
        libertarianCapitalist: 0,
        libertarianSocialist: 0
      };
    }

    // Count users in each quadrant
    // Schema: economicScore -100 (socialist) to +100 (capitalist)
    // authoritarianScore -100 (libertarian) to +100 (authoritarian)
    let authoritarianCapitalist = 0;  // economic >= 0, authoritarian >= 0
    let authoritarianSocialist = 0;   // economic < 0, authoritarian >= 0
    let libertarianCapitalist = 0;    // economic >= 0, authoritarian < 0
    let libertarianSocialist = 0;     // economic < 0, authoritarian < 0

    for (const profile of activeUserProfiles) {
      const economic = profile.economicScore || 0;
      const authoritarian = profile.authoritarianScore || 0;

      if (economic >= 0 && authoritarian >= 0) {
        authoritarianCapitalist++;
      } else if (economic < 0 && authoritarian >= 0) {
        authoritarianSocialist++;
      } else if (economic >= 0 && authoritarian < 0) {
        libertarianCapitalist++;
      } else {
        libertarianSocialist++;
      }
    }

    const total = activeUserProfiles.length;

    // Calculate percentages with proper rounding to ensure sum = 100
    const percentages = {
      authoritarianCapitalist: (authoritarianCapitalist / total) * 100,
      authoritarianSocialist: (authoritarianSocialist / total) * 100,
      libertarianCapitalist: (libertarianCapitalist / total) * 100,
      libertarianSocialist: (libertarianSocialist / total) * 100
    };

    // Round each value
    const rounded = {
      authoritarianCapitalist: Math.round(percentages.authoritarianCapitalist),
      authoritarianSocialist: Math.round(percentages.authoritarianSocialist),
      libertarianCapitalist: Math.round(percentages.libertarianCapitalist),
      libertarianSocialist: Math.round(percentages.libertarianSocialist)
    };

    // Adjust to ensure sum = 100 (distribute rounding error)
    const sum = rounded.authoritarianCapitalist + rounded.authoritarianSocialist + 
                rounded.libertarianCapitalist + rounded.libertarianSocialist;
    const diff = 100 - sum;

    if (diff !== 0) {
      // Find the quadrant with the largest fractional part and adjust it
      const fractionals = [
        { key: 'authoritarianCapitalist' as const, frac: percentages.authoritarianCapitalist - rounded.authoritarianCapitalist },
        { key: 'authoritarianSocialist' as const, frac: percentages.authoritarianSocialist - rounded.authoritarianSocialist },
        { key: 'libertarianCapitalist' as const, frac: percentages.libertarianCapitalist - rounded.libertarianCapitalist },
        { key: 'libertarianSocialist' as const, frac: percentages.libertarianSocialist - rounded.libertarianSocialist }
      ].sort((a, b) => Math.abs(b.frac) - Math.abs(a.frac));

      rounded[fractionals[0].key] += diff;
    }

    return rounded;
  }

  calculatePoliticalDiversityScore(distribution: {
    authoritarianCapitalist: number;
    authoritarianSocialist: number;
    libertarianCapitalist: number;
    libertarianSocialist: number;
  }): number {
    // Convert percentages to proportions (0-1)
    const proportions = [
      distribution.authoritarianCapitalist / 100,
      distribution.authoritarianSocialist / 100,
      distribution.libertarianCapitalist / 100,
      distribution.libertarianSocialist / 100
    ].filter(p => p > 0);

    // If no opinions, return 0
    if (proportions.length === 0) return 0;

    // Calculate Shannon entropy
    const entropy = -proportions.reduce((sum, p) => sum + p * Math.log2(p), 0);

    // Normalize by max entropy (log2(4) = 2) and convert to percentage
    // Max entropy is when all 4 quadrants are equal (25% each)
    const maxEntropy = Math.log2(4);
    const diversityScore = (entropy / maxEntropy) * 100;

    return Math.round(diversityScore);
  }

  async getTopicsWithEmbeddings(): Promise<TopicWithCounts[]> {
    const topicsFromDb = await db
      .select()
      .from(topics)
      .where(and(
        eq(topics.isActive, true),
        sql`${topics.embedding} IS NOT NULL`
      ));
    
    // Enrich each topic with preview data, opinions count, and participant count
    const enrichedTopics = await Promise.all(
      topicsFromDb.map(async (topic) => {
        // Get opinions count
        const opinionsResult = await db.execute<{ count: number }>(sql`
          SELECT COUNT(*)::int as count
          FROM opinions
          WHERE topic_id = ${topic.id} AND status = 'approved'
        `);
        const opinionsCount = Number(opinionsResult.rows[0]?.count || 0);
        
        // Get participant count
        const participantsResult = await db.execute<{ count: number }>(sql`
          SELECT COUNT(DISTINCT user_id)::int as count
          FROM (
            SELECT user_id FROM opinions WHERE topic_id = ${topic.id} AND status = 'approved'
            UNION
            SELECT user_id FROM opinion_flags WHERE opinion_id IN (
              SELECT id FROM opinions WHERE topic_id = ${topic.id} AND status = 'approved'
            )
          ) AS all_participants
          WHERE user_id IS NOT NULL
        `);
        const participantCount = Number(participantsResult.rows[0]?.count || 0);
        
        // Get preview content using helper method
        const previewData = await this.enrichTopicWithPreview(topic);
        
        return {
          ...topic,
          opinionsCount,
          participantCount,
          ...previewData
        };
      })
    );
    
    return enrichedTopics;
  }

  async deleteTopic(id: string): Promise<void> {
    // Soft delete the topic by setting isActive to false
    await db
      .update(topics)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(topics.id, id));
  }

  async countTopicsByUser(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(topics)
      .where(and(
        eq(topics.createdById, userId),
        eq(topics.isActive, true)
      ));
    return Number(result[0].count);
  }

  // Opinion operations
  async createOpinion(opinion: InsertOpinion): Promise<Opinion> {
    const [created] = await db.insert(opinions).values(opinion).returning();
    
    // Ensure user profile exists and increment both opinionCount and totalOpinions using UPSERT
    const [profile] = await db
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
      })
      .returning();
    
    console.log(`[Opinion Created] User ${opinion.userId} now has ${profile.opinionCount} opinions`);
    
    // Trigger AI political compass analysis every 5 opinions (asynchronously)
    if (profile && profile.opinionCount !== null && profile.opinionCount % 5 === 0) {
      console.log(`[Trigger AI Analysis] User ${opinion.userId} reached ${profile.opinionCount} opinions - triggering 2D political compass analysis`);
      // Run analysis in background without blocking response
      this.analyze2DUserPoliticalCompass(opinion.userId).catch(error => {
        console.error(`[AI Analysis ERROR] Failed to analyze political compass for user ${opinion.userId}:`, error);
      });
    }
    
    return created;
  }

  async getOpinionsByTopic(topicId: string, userRole?: string, currentUserId?: string): Promise<Opinion[]> {
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

    // Enrich each opinion with vote and challenge counts
    const enrichedOpinions = await Promise.all(
      baseOpinions.map(async (row) => {
        const opinion = row.opinion;
        const author = row.author;
        const profile = row.profile;
        
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

        return {
          ...opinion,
          author: author ? {
            id: author.id,
            firstName: author.firstName,
            lastName: author.lastName,
            profileImageUrl: author.profileImageUrl,
            politicalLeaningScore: profile?.leaningScore ?? undefined,
            economicScore: profile?.economicScore ?? undefined,
            authoritarianScore: profile?.authoritarianScore ?? undefined
          } : null,
          likesCount: Number(likesResult[0]?.count || 0),
          dislikesCount: Number(dislikesResult[0]?.count || 0),
          repliesCount: 0,
          fallacyCounts: fallacyCountsMap.get(opinion.id) || {},
        };
      })
    );

    return enrichedOpinions as Opinion[];
  }

  async getRecentOpinions(limit: number = 50, userRole?: string, currentUserId?: string): Promise<Opinion[]> {
    const isModOrAdmin = userRole === 'admin' || userRole === 'moderator';
    
    // Build where conditions
    const whereConditions = [];
    
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
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(opinions.createdAt))
      .limit(limit);

    if (baseOpinions.length === 0) {
      return [];
    }

    // Batch aggregate fallacy counts for all opinions
    const fallacyCountsMap = await aggregateFallacyCounts(
      baseOpinions.map(row => row.opinion),
      opinionFlags,
      'opinionId'
    );

    // Enrich each opinion with vote and challenge counts
    const enrichedOpinions = await Promise.all(
      baseOpinions.map(async (row) => {
        const opinion = row.opinion;
        const author = row.author;
        const profile = row.profile;
        
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

        return {
          ...opinion,
          author: author ? {
            id: author.id,
            firstName: author.firstName,
            lastName: author.lastName,
            profileImageUrl: author.profileImageUrl,
            politicalLeaningScore: profile?.leaningScore ?? undefined,
            economicScore: profile?.economicScore ?? undefined,
            authoritarianScore: profile?.authoritarianScore ?? undefined
          } : null,
          likesCount: Number(likesResult[0]?.count || 0),
          dislikesCount: Number(dislikesResult[0]?.count || 0),
          repliesCount: 0,
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
          set: { voteType },
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

  // Adopt opinion - creates a new opinion for the user with same content and stance
  async adoptOpinion(opinionId: string, userId: string, content?: string, stance?: "for" | "against" | "neutral"): Promise<Opinion> {
    // Get the original opinion
    const [original] = await db
      .select()
      .from(opinions)
      .where(eq(opinions.id, opinionId));
    
    if (!original) {
      throw new Error('Opinion not found');
    }

    // Use provided content/stance or fallback to original opinion's values
    const finalContent = content || original.content;
    const finalStance = stance || original.stance;

    // Check if user already has an opinion on this topic
    const [existing] = await db
      .select()
      .from(opinions)
      .where(and(
        eq(opinions.topicId, original.topicId),
        eq(opinions.userId, userId)
      ));

    if (existing) {
      // Update existing opinion with the adopted/edited content and stance
      const [updated] = await db
        .update(opinions)
        .set({
          content: finalContent,
          stance: finalStance,
          updatedAt: new Date()
        })
        .where(eq(opinions.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new opinion with the adopted/edited content and stance
      const [created] = await db
        .insert(opinions)
        .values({
          topicId: original.topicId,
          userId,
          content: finalContent,
          stance: finalStance,
        })
        .returning();
      return created;
    }
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

    // Get ALL opinions including private ones for cumulative analysis
    // Private opinions are hidden from individual view but still influence overall sentiment
    const allOpinions = await db
      .select({
        opinion: opinions,
        author: users,
        profile: userProfiles
      })
      .from(opinions)
      .leftJoin(users, eq(opinions.userId, users.id))
      .leftJoin(userProfiles, eq(opinions.userId, userProfiles.userId))
      .where(
        and(
          eq(opinions.topicId, topicId),
          eq(opinions.status, 'approved')
        )
      )
      .orderBy(desc(opinions.createdAt));

    const formattedOpinions = allOpinions.map(row => ({
      ...row.opinion,
      author: row.author,
      profile: row.profile
    }));
    
    // Generate AI analysis using all opinions (including private)
    const analysis = await AIService.generateCumulativeOpinion(topic, formattedOpinions);
    
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
    // Smart regeneration: only update if new opinions exist since last summary
    const existingSummary = await this.getCumulativeOpinion(topicId);
    
    if (existingSummary) {
      // Check if there are any new opinions since the last summary update
      const latestOpinion = await db
        .select({ createdAt: opinions.createdAt })
        .from(opinions)
        .where(
          and(
            eq(opinions.topicId, topicId),
            eq(opinions.status, 'approved')
          )
        )
        .orderBy(desc(opinions.createdAt))
        .limit(1);
      
      if (latestOpinion.length === 0) {
        // No opinions exist, return existing summary
        return existingSummary;
      }
      
      const latestOpinionDate = latestOpinion[0].createdAt;
      const summaryDate = existingSummary.updatedAt;
      
      // Only regenerate if there are new opinions since the last update
      if (latestOpinionDate && summaryDate && latestOpinionDate <= summaryDate) {
        console.log(`[AI Summary] No new opinions for topic ${topicId} since last summary, skipping regeneration`);
        return existingSummary;
      }
    }
    
    // Generate new summary (either no existing summary or new opinions exist)
    return await this.generateCumulativeOpinion(topicId);
  }

  // Debate rooms
  async createDebateRoom(room: InsertDebateRoom): Promise<DebateRoom> {
    const [created] = await db.insert(debateRooms).values(room).returning();
    return created;
  }

  async createDebateRoomWithOpinionAuthor(opinionId: string, userId: string): Promise<DebateRoom> {
    // Get the opinion to find the author and topic
    const opinion = await this.getOpinion(opinionId);
    if (!opinion) {
      throw new Error("Opinion not found");
    }

    const opinionAuthorId = opinion.userId;
    const topicId = opinion.topicId;
    
    console.log(`[Debate Storage] Creating debate: opinionAuthor=${opinionAuthorId}, currentUser=${userId}, topicId=${topicId}`);

    // Prevent users from debating themselves
    if (opinionAuthorId === userId) {
      throw new Error("You cannot debate your own opinion");
    }

    // Get current user's opinion on the same topic to determine their stance
    const userOpinions = await db
      .select()
      .from(opinions)
      .where(and(
        eq(opinions.topicId, topicId),
        eq(opinions.userId, userId)
      ))
      .limit(1);
    
    console.log(`[Debate Storage] Found ${userOpinions.length} opinions for user ${userId} on topic ${topicId}`);

    if (userOpinions.length === 0) {
      throw new Error("You must have an opinion on this topic before starting a debate");
    }

    const userOpinion = userOpinions[0];

    // Check if they have the same stance
    if (userOpinion.stance === opinion.stance) {
      throw new Error("You cannot debate someone with the same stance as you");
    }

    // Check if both opinions are open for debate
    if (opinion.debateStatus !== 'open') {
      if (opinion.debateStatus === 'private') {
        throw new Error("This opinion is private and not available for debate");
      } else if (opinion.debateStatus === 'closed') {
        throw new Error("This opinion is not open for debate");
      }
    }

    if (userOpinion.debateStatus !== 'open') {
      if (userOpinion.debateStatus === 'private') {
        throw new Error("Your opinion is private. Change it to 'open for debate' to start debates");
      } else if (userOpinion.debateStatus === 'closed') {
        throw new Error("Your opinion is not open for debate. Change it to 'open for debate' to start debates");
      }
    }

    // Create the debate room with structured phase initialization
    const room = await this.createDebateRoom({
      topicId,
      participant1Id: userId,
      participant2Id: opinionAuthorId,
      participant1Stance: userOpinion.stance,
      participant2Stance: opinion.stance,
      participant1Privacy: "public",
      participant2Privacy: "public",
      phase: 'structured',
      currentTurn: userId, // Initiator goes first
      turnCount1: 0,
      turnCount2: 0,
    });

    return room;
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
          eq(opinions.debateStatus, 'open'),
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

  async updateDebateRoomTurn(roomId: string, userId: string): Promise<DebateRoom> {
    const room = await this.getDebateRoom(roomId);
    if (!room) throw new Error("Debate room not found");

    const isParticipant1 = userId === room.participant1Id;
    const isParticipant2 = userId === room.participant2Id;

    if (!isParticipant1 && !isParticipant2) {
      throw new Error("User is not a participant in this debate");
    }

    // Increment turn count for the user who just sent a message
    const updates: Partial<DebateRoom> = {
      turnCount1: isParticipant1 ? (room.turnCount1 || 0) + 1 : room.turnCount1,
      turnCount2: isParticipant2 ? (room.turnCount2 || 0) + 1 : room.turnCount2,
      currentTurn: isParticipant1 ? room.participant2Id : room.participant1Id, // Switch turn
    };

    // Check if both participants have reached 3 turns (transition to voting phase)
    const newTurnCount1 = updates.turnCount1 || room.turnCount1 || 0;
    const newTurnCount2 = updates.turnCount2 || room.turnCount2 || 0;

    if (newTurnCount1 >= 3 && newTurnCount2 >= 3 && room.phase === 'structured') {
      updates.phase = 'voting';
      updates.currentTurn = null; // No more turns in voting phase
    }

    await db
      .update(debateRooms)
      .set(updates)
      .where(eq(debateRooms.id, roomId));

    return { ...room, ...updates } as DebateRoom;
  }

  async submitDebateVote(vote: InsertDebateVote): Promise<DebateVote> {
    const [created] = await db
      .insert(debateVotes)
      .values(vote)
      .onConflictDoUpdate({
        target: [debateVotes.roomId, debateVotes.voterId],
        set: {
          logicalReasoning: vote.logicalReasoning,
          politeness: vote.politeness,
          opennessToChange: vote.opennessToChange,
        }
      })
      .returning();
    
    // Update aggregate stats for the user being voted on
    await this.updateUserDebateStats(vote.votedForUserId);
    
    return created;
  }

  async getDebateVotes(roomId: string): Promise<DebateVote[]> {
    return await db
      .select()
      .from(debateVotes)
      .where(eq(debateVotes.roomId, roomId));
  }

  async updateUserDebateStats(userId: string): Promise<UserDebateStats> {
    // Calculate averages from all votes received
    const votes = await db
      .select()
      .from(debateVotes)
      .where(eq(debateVotes.votedForUserId, userId));

    if (votes.length === 0) {
      // Create or return empty stats
      const [stats] = await db
        .insert(userDebateStats)
        .values({
          userId,
          totalDebates: 0,
          avgLogicalReasoning: 0,
          avgPoliteness: 0,
          avgOpennessToChange: 0,
          totalVotesReceived: 0,
        })
        .onConflictDoNothing()
        .returning();
      
      return stats || { userId, totalDebates: 0, avgLogicalReasoning: 0, avgPoliteness: 0, avgOpennessToChange: 0, totalVotesReceived: 0, updatedAt: new Date() } as UserDebateStats;
    }

    // Calculate averages (multiply by 100 to store as integers)
    const avgLogical = Math.round((votes.reduce((sum, v) => sum + v.logicalReasoning, 0) / votes.length) * 100);
    const avgPolite = Math.round((votes.reduce((sum, v) => sum + v.politeness, 0) / votes.length) * 100);
    const avgOpenness = Math.round((votes.reduce((sum, v) => sum + v.opennessToChange, 0) / votes.length) * 100);

    // Count unique debates this user participated in
    const uniqueRoomIds = new Set(votes.map(v => v.roomId));

    const [updated] = await db
      .insert(userDebateStats)
      .values({
        userId,
        totalDebates: uniqueRoomIds.size,
        avgLogicalReasoning: avgLogical,
        avgPoliteness: avgPolite,
        avgOpennessToChange: avgOpenness,
        totalVotesReceived: votes.length,
      })
      .onConflictDoUpdate({
        target: userDebateStats.userId,
        set: {
          totalDebates: uniqueRoomIds.size,
          avgLogicalReasoning: avgLogical,
          avgPoliteness: avgPolite,
          avgOpennessToChange: avgOpenness,
          totalVotesReceived: votes.length,
          updatedAt: new Date(),
        }
      })
      .returning();

    return updated;
  }

  async getUserDebateStats(userId: string): Promise<UserDebateStats | undefined> {
    const [stats] = await db
      .select()
      .from(userDebateStats)
      .where(eq(userDebateStats.userId, userId))
      .limit(1);
    
    return stats;
  }

  async updateDebatePhase(roomId: string, phase: 'structured' | 'voting' | 'free-form'): Promise<void> {
    await db
      .update(debateRooms)
      .set({ phase })
      .where(eq(debateRooms.id, roomId));
  }

  async submitVoteToContinue(roomId: string, userId: string, voteToContinue: boolean): Promise<DebateRoom> {
    const room = await this.getDebateRoom(roomId);
    if (!room) throw new Error("Debate room not found");

    const isParticipant1 = userId === room.participant1Id;
    const isParticipant2 = userId === room.participant2Id;

    if (!isParticipant1 && !isParticipant2) {
      throw new Error("User is not a participant in this debate");
    }

    const updates: Partial<DebateRoom> = {
      votesToContinue1: isParticipant1 ? voteToContinue : room.votesToContinue1,
      votesToContinue2: isParticipant2 ? voteToContinue : room.votesToContinue2,
    };

    // Check if both have voted
    const newVote1 = updates.votesToContinue1 ?? room.votesToContinue1;
    const newVote2 = updates.votesToContinue2 ?? room.votesToContinue2;

    // If both have voted and both want to continue, transition to free-form
    if (newVote1 !== null && newVote2 !== null) {
      if (newVote1 === true && newVote2 === true) {
        updates.phase = 'free-form';
      } else {
        // At least one person voted to end - end the debate
        updates.status = 'ended';
        updates.endedAt = new Date();
      }
    }

    await db
      .update(debateRooms)
      .set(updates)
      .where(eq(debateRooms.id, roomId));

    return { ...room, ...updates } as DebateRoom;
  }

  // Debate management
  async getGroupedDebateRooms(userId: string): Promise<{
    opponent: User;
    debates: DebateRoom[];
    totalUnread: number;
    isRecent: boolean;
  }[]> {
    const activeDebates = await db
      .select()
      .from(debateRooms)
      .where(
        and(
          or(
            eq(debateRooms.participant1Id, userId),
            eq(debateRooms.participant2Id, userId)
          ),
          eq(debateRooms.status, 'active')
        )
      );

    if (activeDebates.length === 0) {
      return [];
    }

    const grouped = new Map<string, {
      opponent: User;
      debates: DebateRoom[];
      totalUnread: number;
      isRecent: boolean;
    }>();

    for (const debate of activeDebates) {
      const opponentId = debate.participant1Id === userId 
        ? debate.participant2Id 
        : debate.participant1Id;
      
      const isParticipant1 = debate.participant1Id === userId;
      const lastReadAt = isParticipant1 
        ? debate.participant1LastReadAt 
        : debate.participant2LastReadAt;

      const unreadCount = await db
        .select({ count: count() })
        .from(debateMessages)
        .where(
          and(
            eq(debateMessages.roomId, debate.id),
            lastReadAt 
              ? sql`${debateMessages.createdAt} > ${lastReadAt}`
              : sql`true`
          )
        );

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const isRecent = debate.lastMessageAt 
        ? debate.lastMessageAt > thirtyDaysAgo 
        : true;

      if (!grouped.has(opponentId)) {
        const [opponent] = await db
          .select()
          .from(users)
          .where(eq(users.id, opponentId));

        if (opponent) {
          grouped.set(opponentId, {
            opponent,
            debates: [],
            totalUnread: 0,
            isRecent
          });
        }
      }

      const group = grouped.get(opponentId);
      if (group) {
        group.debates.push(debate);
        group.totalUnread += Number(unreadCount[0]?.count || 0);
        if (isRecent) {
          group.isRecent = true;
        }
      }
    }

    return Array.from(grouped.values());
  }

  async getArchivedDebateRooms(userId: string): Promise<DebateRoom[]> {
    return await db
      .select()
      .from(debateRooms)
      .where(
        and(
          or(
            eq(debateRooms.participant1Id, userId),
            eq(debateRooms.participant2Id, userId)
          ),
          eq(debateRooms.status, 'archived')
        )
      )
      .orderBy(desc(debateRooms.endedAt));
  }

  async markDebateRoomAsRead(roomId: string, userId: string): Promise<void> {
    const [room] = await db
      .select()
      .from(debateRooms)
      .where(eq(debateRooms.id, roomId));

    if (!room) {
      throw new Error('Debate room not found');
    }

    const isParticipant1 = room.participant1Id === userId;
    const isParticipant2 = room.participant2Id === userId;

    if (!isParticipant1 && !isParticipant2) {
      throw new Error('User is not a participant in this debate room');
    }

    const updates: Partial<DebateRoom> = {};
    if (isParticipant1) {
      updates.participant1LastReadAt = new Date();
    }
    if (isParticipant2) {
      updates.participant2LastReadAt = new Date();
    }

    await db
      .update(debateRooms)
      .set(updates)
      .where(eq(debateRooms.id, roomId));
  }

  async archiveDebateRoom(roomId: string): Promise<void> {
    await db
      .update(debateRooms)
      .set({ status: 'archived' })
      .where(eq(debateRooms.id, roomId));
  }

  async getEndedDebatesForArchiving(daysInactive: number): Promise<DebateRoom[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);
    
    return await db
      .select()
      .from(debateRooms)
      .where(
        and(
          eq(debateRooms.status, 'ended'),
          sql`${debateRooms.lastMessageAt} < ${cutoffDate}`
        )
      )
      .orderBy(asc(debateRooms.lastMessageAt));
  }

  // Notifications
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db
      .insert(notifications)
      .values(notification)
      .returning();
    return created;
  }

  async getUserNotifications(userId: string, limit = 50): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId));
  }

  // Push subscriptions
  async subscribeToPush(subscription: InsertPushSubscription): Promise<PushSubscription> {
    const [created] = await db
      .insert(pushSubscriptions)
      .values(subscription)
      .onConflictDoUpdate({
        target: [pushSubscriptions.userId, pushSubscriptions.endpoint],
        set: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      })
      .returning();
    return created;
  }

  async unsubscribeFromPush(userId: string, endpoint: string): Promise<void> {
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.endpoint, endpoint)
        )
      );
  }

  async getUserPushSubscriptions(userId: string): Promise<PushSubscription[]> {
    return await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
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
    // Get user's opinions for analysis (including private ones)
    const userOpinions = await this.getUserOpinions(userId, 'recent', 50, userId);
    
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

  async analyze2DUserPoliticalCompass(userId: string): Promise<UserProfile> {
    // Get user's last 50 opinions for analysis (including private ones)
    const userOpinions = await this.getUserOpinions(userId, 'recent', 50, userId);
    
    if (userOpinions.length === 0) {
      // No opinions to analyze, return basic profile
      return await this.upsertUserProfile(userId, {
        economicScore: 0,
        authoritarianScore: 0,
        leaningConfidence: 'low',
        totalOpinions: 0,
        lastAnalyzedAt: new Date(),
      });
    }

    // Use AI to analyze 2D political compass position based on opinions
    const analysis = await AIService.analyze2DPoliticalCompass(userOpinions);
    
    // Update profile with analysis results
    return await this.upsertUserProfile(userId, {
      economicScore: analysis.economicScore,
      authoritarianScore: analysis.authoritarianScore,
      leaningConfidence: analysis.confidence,
      totalOpinions: userOpinions.length,
      lastAnalyzedAt: new Date(),
    });
  }

  async getUserOpinions(userId: string, sortBy: 'recent' | 'oldest' | 'popular' | 'controversial' = 'recent', limit = 20, viewerUserId?: string): Promise<Opinion[]> {
    // Build where conditions
    const whereConditions = [eq(opinions.userId, userId)];
    
    // Filter private opinions unless viewing own profile
    if (viewerUserId !== userId) {
      // Not viewing own profile - exclude private opinions
      whereConditions.push(ne(opinions.debateStatus, 'private'));
    }
    
    const whereClause = and(...whereConditions);
    
    switch (sortBy) {
      case 'recent':
        return await db
          .select()
          .from(opinions)
          .where(whereClause)
          .orderBy(desc(opinions.createdAt))
          .limit(limit);
      case 'oldest':
        return await db
          .select()
          .from(opinions)
          .where(whereClause)
          .orderBy(asc(opinions.createdAt))
          .limit(limit);
      case 'popular':
        return await db
          .select()
          .from(opinions)
          .where(whereClause)
          .orderBy(desc(opinions.likesCount))
          .limit(limit);
      case 'controversial':
        return await db
          .select()
          .from(opinions)
          .where(whereClause)
          .orderBy(desc(sql`${opinions.likesCount} + ${opinions.dislikesCount}`))
          .limit(limit);
      default:
        return await db
          .select()
          .from(opinions)
          .where(whereClause)
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

  async updateUserStatus(userId: string, status: string, adminId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Update user status
      await tx.update(users)
        .set({ status })
        .where(eq(users.id, userId));
      
      // Log the action
      await tx.insert(moderationActions).values({
        actionType: 'status_change',
        targetType: 'user',
        targetId: userId,
        moderatorId: adminId,
        reason: `Status changed to ${status}`,
      });
    });
  }

  async deleteUser(userId: string, adminId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Log the deletion action before deleting
      await tx.insert(moderationActions).values({
        actionType: 'user_deletion',
        targetType: 'user',
        targetId: userId,
        moderatorId: adminId,
        reason: `User account permanently deleted`,
      });

      // Delete user's data in the correct order (due to foreign key constraints)
      // Delete opinions first (they reference users)
      await tx.delete(opinions).where(eq(opinions.userId, userId));
      
      // Delete debate messages (they reference users)
      await tx.delete(debateMessages).where(eq(debateMessages.userId, userId));
      
      // Delete debate rooms where user is participant
      await tx.delete(debateRooms).where(
        or(
          eq(debateRooms.participant1Id, userId),
          eq(debateRooms.participant2Id, userId)
        )
      );
      
      // Delete topics created by user
      await tx.delete(topics).where(eq(topics.createdById, userId));
      
      // Delete user follows
      await tx.delete(userFollows).where(
        or(
          eq(userFollows.followerId, userId),
          eq(userFollows.followingId, userId)
        )
      );
      
      // Delete user profile
      await tx.delete(userProfiles).where(eq(userProfiles.userId, userId));
      
      // Delete opinion votes
      await tx.delete(opinionVotes).where(eq(opinionVotes.userId, userId));
      
      // Delete user badges
      await tx.delete(userBadges).where(eq(userBadges.userId, userId));
      
      // Finally, delete the user
      await tx.delete(users).where(eq(users.id, userId));
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
    
    const results = await db
      .select({
        id: topics.id,
        title: topics.title,
        description: topics.description,
        categories: topics.categories,
        imageUrl: topics.imageUrl,
        createdById: topics.createdById,
        isActive: topics.isActive,
        status: topics.status,
        createdAt: topics.createdAt,
        updatedAt: topics.updatedAt,
        opinionsCount: sql<number>`(SELECT COUNT(*)::int FROM ${opinions} WHERE ${opinions.topicId} = ${topics.id})`,
      })
      .from(topics)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(topics.createdAt))
      .limit(limit);
    
    // Map to TopicWithCounts format (add missing fields)
    return results.map(topic => ({
      ...topic,
      participantCount: 0, // Can calculate if needed
      previewContent: undefined,
      previewAuthor: undefined,
      previewIsAI: undefined,
    }));
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

  async deleteTopicAdmin(topicId: string, adminId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Soft delete the topic
      await tx.update(topics)
        .set({ isActive: false })
        .where(eq(topics.id, topicId));
      
      // Log the action
      await tx.insert(moderationActions).values({
        actionType: 'topic_delete',
        targetType: 'topic',
        targetId: topicId,
        moderatorId: adminId,
        reason: 'Deleted by admin',
      });
    });
  }

  async deleteOpinionAdmin(opinionId: string, adminId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Get the opinion to know which user to decrement
      const [opinion] = await tx.select()
        .from(opinions)
        .where(eq(opinions.id, opinionId))
        .limit(1);
      
      if (!opinion) {
        throw new Error('Opinion not found');
      }
      
      // Hard delete the opinion
      await tx.delete(opinions)
        .where(eq(opinions.id, opinionId));
      
      // Count remaining opinions for this user (after deletion)
      const [remainingCount] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(opinions)
        .where(eq(opinions.userId, opinion.userId));
      
      const newCount = Number(remainingCount.count);
      
      // Ensure user profile exists and update with correct counts (both opinionCount and totalOpinions) using UPSERT
      // This handles both existing profiles and missing profiles
      await tx
        .insert(userProfiles)
        .values({
          userId: opinion.userId,
          opinionCount: newCount,
          totalOpinions: newCount,
          economicScore: 0,
          authoritarianScore: 0,
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: userProfiles.userId,
          set: {
            opinionCount: newCount,
            totalOpinions: newCount,
            updatedAt: new Date()
          }
        });
      
      console.log(`[Opinion Deleted] User ${opinion.userId} opinion counts set to ${newCount} (${newCount} remaining opinions)`);
      
      // Log the action
      await tx.insert(moderationActions).values({
        actionType: 'opinion_delete',
        targetType: 'opinion',
        targetId: opinionId,
        moderatorId: adminId,
        reason: 'Deleted by admin',
      });
    });
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

  // Admin - Data sync utilities
  async syncOpinionCounts(): Promise<{ updated: number; synced: Array<{ userId: string; oldCount: number; newCount: number }> }> {
    console.log('[Sync Opinion Counts] Starting sync...');
    
    // Get all user IDs from opinions table with their counts
    const opinionCounts = await db
      .select({
        userId: opinions.userId,
        count: sql<number>`count(*)::int`
      })
      .from(opinions)
      .groupBy(opinions.userId);
    
    // Create a map of userId -> actual count
    const actualCountsMap = new Map<string, number>();
    for (const { userId, count } of opinionCounts) {
      actualCountsMap.set(userId, Number(count));
    }
    
    // Get ALL user profiles (including those with no opinions)
    const allProfiles = await db
      .select({
        userId: userProfiles.userId,
        opinionCount: userProfiles.opinionCount
      })
      .from(userProfiles);
    
    const syncedUsers: Array<{ userId: string; oldCount: number; newCount: number }> = [];
    let updated = 0;
    
    // Sync users who have opinions
    for (const [userId, actualCount] of actualCountsMap) {
      const profile = allProfiles.find(p => p.userId === userId);
      const oldCount = profile?.opinionCount || 0;
      
      if (oldCount !== actualCount) {
        await db
          .insert(userProfiles)
          .values({
            userId,
            opinionCount: actualCount,
            totalOpinions: actualCount,
            economicScore: 0,
            authoritarianScore: 0,
            updatedAt: new Date()
          })
          .onConflictDoUpdate({
            target: userProfiles.userId,
            set: {
              opinionCount: actualCount,
              totalOpinions: actualCount,
              updatedAt: new Date()
            }
          });
        
        syncedUsers.push({ userId, oldCount, newCount: actualCount });
        updated++;
        console.log(`[Sync] User ${userId}: ${oldCount} → ${actualCount}`);
      }
    }
    
    // Fix profiles that have opinion_count > 0 but no actual opinions
    for (const profile of allProfiles) {
      if (profile.opinionCount > 0 && !actualCountsMap.has(profile.userId)) {
        await db
          .update(userProfiles)
          .set({
            opinionCount: 0,
            totalOpinions: 0,
            updatedAt: new Date()
          })
          .where(eq(userProfiles.userId, profile.userId));
        
        syncedUsers.push({ userId: profile.userId, oldCount: profile.opinionCount, newCount: 0 });
        updated++;
        console.log(`[Sync] User ${profile.userId}: ${profile.opinionCount} → 0 (no opinions found)`);
      }
    }
    
    console.log(`[Sync Opinion Counts] Completed. Updated ${updated} users.`);
    return { updated, synced: syncedUsers };
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

  // Topic views tracking
  async recordTopicView(userId: string, topicId: string): Promise<void> {
    // Record the topic view
    await db.insert(topicViews).values({
      userId,
      topicId,
    });
  }

  async getRecentlyViewedCategories(userId: string, limit: number = 5): Promise<string[]> {
    // Get recent topic views for this user
    const recentViews = await db
      .select({
        topicId: topicViews.topicId,
        viewedAt: topicViews.viewedAt,
      })
      .from(topicViews)
      .where(eq(topicViews.userId, userId))
      .orderBy(desc(topicViews.viewedAt))
      .limit(50); // Get more views to extract unique categories

    if (recentViews.length === 0) {
      return [];
    }

    // Get the topics for these views
    const topicIds = recentViews.map((v) => v.topicId);
    const viewedTopics = await db
      .select()
      .from(topics)
      .where(inArray(topics.id, topicIds));

    // Extract unique categories in order of most recent view
    const categorySet = new Set<string>();
    const categoryOrder: string[] = [];

    for (const view of recentViews) {
      const topic = viewedTopics.find((t) => t.id === view.topicId);
      if (topic && topic.categories) {
        for (const category of topic.categories) {
          if (!categorySet.has(category)) {
            categorySet.add(category);
            categoryOrder.push(category);
            if (categoryOrder.length >= limit) {
              return categoryOrder;
            }
          }
        }
      }
    }

    return categoryOrder;
  }

  async getAllOpinionsForBackfill(): Promise<Array<{ id: string; content: string; topicId: string; topicTitle: string }>> {
    const opinionsData = await db
      .select({
        id: opinions.id,
        content: opinions.content,
        topicId: opinions.topicId,
        topicTitle: topics.title
      })
      .from(opinions)
      .leftJoin(topics, eq(opinions.topicId, topics.id))
      .where(eq(opinions.status, 'approved'));

    return opinionsData.map(row => ({
      id: row.id,
      content: row.content,
      topicId: row.topicId,
      topicTitle: row.topicTitle || 'Unknown Topic'
    }));
  }
}

export const storage = new DatabaseStorage();
