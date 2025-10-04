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
  userFollows,
  userProfiles,
  type User,
  type UpsertUser,
  type Topic,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, count, ilike, or } from "drizzle-orm";
import { AIService } from "./aiService";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserProfileImage(userId: string, profileImageUrl: string): Promise<void>;
  
  // Topic operations
  createTopic(topic: InsertTopic): Promise<Topic>;
  getTopics(limit?: number, category?: string, search?: string): Promise<Topic[]>;
  getTopic(id: string): Promise<Topic | undefined>;
  
  // Opinion operations
  createOpinion(opinion: InsertOpinion): Promise<Opinion>;
  getOpinionsByTopic(topicId: string): Promise<Opinion[]>;
  getOpinion(id: string): Promise<Opinion | undefined>;
  updateOpinion(opinionId: string, data: Partial<InsertOpinion>): Promise<Opinion>;
  updateOpinionCounts(opinionId: string, likesCount: number, dislikesCount: number): Promise<void>;
  
  // Opinion voting
  voteOnOpinion(opinionId: string, userId: string, voteType: 'like' | 'dislike' | null): Promise<void>;
  getUserVoteOnOpinion(opinionId: string, userId: string): Promise<OpinionVote | undefined>;
  
  // Opinion challenges
  challengeOpinion(opinionId: string, userId: string, context: string): Promise<void>;
  getOpinionChallenges(opinionId: string): Promise<any[]>;
  
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
  
  // Debate messages
  addDebateMessage(roomId: string, userId: string, content: string): Promise<DebateMessage>;
  getDebateMessages(roomId: string): Promise<DebateMessage[]>;
  
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
  
  // User debate rooms
  getUserDebateRooms(userId: string): Promise<DebateRoom[]>;
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

  // Topic operations
  async createTopic(topic: InsertTopic): Promise<Topic> {
    const [created] = await db.insert(topics).values(topic).returning();
    return created;
  }

  async getTopics(limit = 50, category?: string, search?: string): Promise<Topic[]> {
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
    
    return await db
      .select()
      .from(topics)
      .where(and(...conditions))
      .orderBy(desc(topics.createdAt))
      .limit(limit);
  }

  async getTopic(id: string): Promise<Topic | undefined> {
    const [topic] = await db.select().from(topics).where(eq(topics.id, id));
    return topic;
  }

  // Opinion operations
  async createOpinion(opinion: InsertOpinion): Promise<Opinion> {
    const [created] = await db.insert(opinions).values(opinion).returning();
    return created;
  }

  async getOpinionsByTopic(topicId: string): Promise<Opinion[]> {
    return await db
      .select()
      .from(opinions)
      .where(eq(opinions.topicId, topicId))
      .orderBy(desc(opinions.createdAt));
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
  async challengeOpinion(opinionId: string, userId: string, context: string): Promise<void> {
    await db
      .insert(opinionChallenges)
      .values({ opinionId, userId, context });
    
    // Increment challenges count
    await db
      .update(opinions)
      .set({ challengesCount: sql`${opinions.challengesCount} + 1` })
      .where(eq(opinions.id, opinionId));
  }

  async getOpinionChallenges(opinionId: string): Promise<any[]> {
    const challenges = await db
      .select({
        id: opinionChallenges.id,
        context: opinionChallenges.context,
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
      .where(eq(opinionChallenges.opinionId, opinionId))
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

  // Debate messages
  async addDebateMessage(roomId: string, userId: string, content: string): Promise<DebateMessage> {
    const [message] = await db
      .insert(debateMessages)
      .values({ roomId, userId, content })
      .returning();
    return message;
  }

  async getDebateMessages(roomId: string): Promise<DebateMessage[]> {
    return await db
      .select()
      .from(debateMessages)
      .where(eq(debateMessages.roomId, roomId))
      .orderBy(debateMessages.createdAt);
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

  async getUserOpinions(userId: string, sortBy: 'recent' | 'popular' | 'controversial' = 'recent', limit = 20): Promise<Opinion[]> {
    switch (sortBy) {
      case 'recent':
        return await db
          .select()
          .from(opinions)
          .where(eq(opinions.userId, userId))
          .orderBy(desc(opinions.createdAt))
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
}

export const storage = new DatabaseStorage();
