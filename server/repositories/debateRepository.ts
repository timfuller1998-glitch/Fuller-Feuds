import { db } from '../db.js';
import {
  debateRooms,
  debateMessages,
  debateVotes,
  userDebateStats,
  opinions,
  users,
  topics,
  debateMessageFlags,
  userProfiles
} from '../../shared/schema.js';
import { eq, and, or, desc, sql, inArray, lt } from 'drizzle-orm';
import type {
  InsertDebateRoom,
  DebateRoom,
  DebateMessage,
  InsertDebateVote,
  DebateVote,
  UserDebateStats,
  InsertUserDebateStats
} from '../../shared/schema.js';
import { checkDebateParticipation } from '../utils/authorization.js';
import { logDataAccess, logDatabaseOperation, logSecurityEvent } from '../utils/securityLogger.js';
import type { Request } from 'express';

export class DebateRepository {
  async createDebateRoom(room: InsertDebateRoom): Promise<DebateRoom> {
    const [created] = await db.insert(debateRooms).values(room).returning();
    return created;
  }

  async createDebateRoomWithOpinionAuthor(opinionId: string, userId: string): Promise<DebateRoom> {
    // Get the opinion to find the author and topic
    const [opinion] = await db.select().from(opinions).where(eq(opinions.id, opinionId)).limit(1);
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

    // Get current user's opinion on the same topic
    const [userOpinion] = await db
      .select()
      .from(opinions)
      .where(and(
        eq(opinions.topicId, topicId),
        eq(opinions.userId, userId)
      ))
      .limit(1);

    console.log(`[Debate Storage] Found ${userOpinion ? 1 : 0} opinions for user ${userId} on topic ${topicId}`);

    if (!userOpinion) {
      throw new Error("You must have an opinion on this topic before starting a debate");
    }

    // Get political scores for both users to check alignment difference
    // Join with userProfiles to get economicScore and authoritarianScore
    const [currentUser] = await db
      .select({ 
        economicScore: userProfiles.economicScore, 
        authoritarianScore: userProfiles.authoritarianScore 
      })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    const [opinionAuthor] = await db
      .select({ 
        economicScore: userProfiles.economicScore, 
        authoritarianScore: userProfiles.authoritarianScore 
      })
      .from(userProfiles)
      .where(eq(userProfiles.userId, opinionAuthorId))
      .limit(1);

    // Calculate political distance between users
    let politicalDistance = 0;
    if (currentUser?.economicScore !== null && currentUser?.authoritarianScore !== null &&
        opinionAuthor?.economicScore !== null && opinionAuthor?.authoritarianScore !== null) {
      const economicDiff = Math.abs((currentUser.economicScore || 0) - (opinionAuthor.economicScore || 0));
      const authoritarianDiff = Math.abs((currentUser.authoritarianScore || 0) - (opinionAuthor.authoritarianScore || 0));
      politicalDistance = Math.sqrt(economicDiff ** 2 + authoritarianDiff ** 2);
    }

    console.log(`[Debate Storage] Political distance: ${politicalDistance}`);

    // Create the debate room
    // Note: status, phase, turnCount1, turnCount2, and startedAt are omitted from InsertDebateRoom
    // They will use their default values from the schema
    const debateRoomData: InsertDebateRoom = {
      topicId,
      participant1Id: opinionAuthorId,
      participant2Id: userId,
      participant1Privacy: 'public',
      participant2Privacy: 'public',
      currentTurn: opinionAuthorId, // Opinion author goes first
    };

    const [created] = await db.insert(debateRooms).values(debateRoomData).returning();
    console.log(`[Debate Storage] Created debate room: ${created.id}`);

    return created;
  }

  async getDebateRoom(id: string, requestingUserId?: string, requestingUserRole?: string, req?: Request): Promise<DebateRoom | undefined> {
    const startTime = Date.now();

    try {
      const [room] = await db.select().from(debateRooms).where(eq(debateRooms.id, id)).limit(1);

      if (!room) {
        return undefined;
      }

      // Authorization check - only participants can access debate rooms (unless moderator/admin)
      if (requestingUserId && requestingUserRole !== 'admin' && requestingUserRole !== 'moderator') {
        checkDebateParticipation(requestingUserId, room, req);
      }

      logDataAccess({
        userId: requestingUserId,
        userRole: requestingUserRole,
        action: 'read_debate_room',
        resourceType: 'debate_room',
        resourceId: id,
        accessLevel: 'read',
        ipAddress: req ? (req.ip || req.connection?.remoteAddress) : undefined,
        userAgent: req?.headers['user-agent'],
      });

      const queryTime = Date.now() - startTime;
      logDatabaseOperation({
        userId: requestingUserId,
        action: 'read_debate_room',
        resourceType: 'debate_room',
        resourceId: id,
        tableName: 'debate_rooms',
        operation: 'select',
        queryTimeMs: queryTime,
        rowsAffected: room ? 1 : 0,
      });

      return room;
    } catch (error) {
      logSecurityEvent('error', 'database_operation', {
        userId: requestingUserId,
        action: 'read_debate_room',
        resourceType: 'debate_room',
        resourceId: id,
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'DATABASE_ERROR',
      });
      throw error;
    }
  }

  async getUserDebateRooms(userId: string, requestingUserId?: string, requestingUserRole?: string, req?: Request): Promise<DebateRoom[]> {
    // Authorization check - users can only see their own debate rooms
    if (requestingUserId && userId !== requestingUserId && requestingUserRole !== 'admin' && requestingUserRole !== 'moderator') {
      logSecurityEvent('warn', 'unauthorized_access', {
        userId: requestingUserId,
        action: 'read_user_debate_rooms',
        resourceType: 'debate_room',
        error: 'Attempted to access another user\'s debate rooms',
        errorCode: 'UNAUTHORIZED_ACCESS',
      });
      throw new Error('Cannot access another user\'s debate rooms');
    }

    const startTime = Date.now();

    try {
      logDataAccess({
        userId: requestingUserId || userId,
        userRole: requestingUserRole,
        action: 'read_user_debate_rooms',
        resourceType: 'debate_room',
        resourceId: userId,
        accessLevel: 'read',
        ipAddress: req ? (req.ip || req.connection?.remoteAddress) : undefined,
        userAgent: req?.headers['user-agent'],
      });

      const rooms = await db
        .select()
        .from(debateRooms)
        .where(or(
          eq(debateRooms.participant1Id, userId),
          eq(debateRooms.participant2Id, userId)
        ))
        .orderBy(desc(debateRooms.startedAt));

      const queryTime = Date.now() - startTime;
      logDatabaseOperation({
        userId: requestingUserId || userId,
        action: 'read_user_debate_rooms',
        resourceType: 'debate_room',
        resourceId: userId,
        tableName: 'debate_rooms',
        operation: 'select',
        queryTimeMs: queryTime,
        rowsAffected: rooms.length,
      });

      return rooms;
    } catch (error) {
      logSecurityEvent('error', 'database_operation', {
        userId: requestingUserId || userId,
        action: 'read_user_debate_rooms',
        resourceType: 'debate_room',
        resourceId: userId,
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'DATABASE_ERROR',
      });
      throw error;
    }
  }

  async endDebateRoom(id: string): Promise<void> {
    await db
      .update(debateRooms)
      .set({
        status: 'ended',
        endedAt: new Date(),
        currentTurn: null,
      })
      .where(eq(debateRooms.id, id));
  }

  async updateDebateRoomPrivacy(roomId: string, userId: string, privacy: 'public' | 'private'): Promise<void> {
    const updates: any = {};

    const [room] = await db.select().from(debateRooms).where(eq(debateRooms.id, roomId)).limit(1);
    if (!room) {
      throw new Error("Debate room not found");
    }

    if (room.participant1Id === userId) {
      updates.participant1Privacy = privacy;
    } else if (room.participant2Id === userId) {
      updates.participant2Privacy = privacy;
    } else {
      throw new Error("User is not a participant in this debate");
    }

    await db.update(debateRooms).set(updates).where(eq(debateRooms.id, roomId));
  }

  async getUserActiveDebateRoomsEnriched(userId: string): Promise<any[]> {
    const rooms = await db
      .select({
        room: debateRooms,
        topic: topics,
        participant1: {
          id: sql<string>`p1.id`,
          firstName: sql<string>`p1.first_name`,
          lastName: sql<string>`p1.last_name`,
          profileImageUrl: sql<string>`p1.profile_image_url`,
        },
        participant2: {
          id: sql<string>`p2.id`,
          firstName: sql<string>`p2.first_name`,
          lastName: sql<string>`p2.last_name`,
          profileImageUrl: sql<string>`p2.profile_image_url`,
        },
      })
      .from(debateRooms)
      .leftJoin(topics, eq(debateRooms.topicId, topics.id))
      .leftJoin(sql`users as p1`, eq(debateRooms.participant1Id, sql`p1.id`))
      .leftJoin(sql`users as p2`, eq(debateRooms.participant2Id, sql`p2.id`))
      .where(and(
        or(
          eq(debateRooms.participant1Id, userId),
          eq(debateRooms.participant2Id, userId)
        ),
        eq(debateRooms.status, 'active')
      ))
      .orderBy(desc(debateRooms.lastMessageAt));

    // Enrich with unread counts and last messages
    const enrichedRooms = await Promise.all(
      rooms.map(async (row) => {
        const room = row.room;
        const isParticipant1 = room.participant1Id === userId;

        // Get unread count
        const lastReadAt = isParticipant1 ? room.participant1LastReadAt : room.participant2LastReadAt;
        const [unreadResult] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(debateMessages)
          .where(and(
            eq(debateMessages.roomId, room.id),
            eq(debateMessages.status, 'approved'),
            lastReadAt ? sql`${debateMessages.createdAt} > ${lastReadAt}` : sql`true`
          ));

        // Get last message
        const [lastMessage] = await db
          .select()
          .from(debateMessages)
          .where(and(
            eq(debateMessages.roomId, room.id),
            eq(debateMessages.status, 'approved')
          ))
          .orderBy(desc(debateMessages.createdAt))
          .limit(1);

        return {
          ...room,
          topic: row.topic,
          opponent: isParticipant1 ? row.participant2 : row.participant1,
          unreadCount: unreadResult?.count || 0,
          lastMessage: lastMessage ? {
            content: lastMessage.content,
            createdAt: lastMessage.createdAt,
            senderId: lastMessage.userId,
          } : null,
        };
      })
    );

    return enrichedRooms;
  }

  async addDebateMessage(roomId: string, userId: string, content: string, status: string = 'approved', requestingUserId?: string, requestingUserRole?: string, req?: Request): Promise<DebateMessage> {
    const startTime = Date.now();

    // Ensure user is creating message for themselves
    if (requestingUserId && userId !== requestingUserId) {
      logSecurityEvent('warn', 'unauthorized_access', {
        userId: requestingUserId,
        action: 'create_debate_message',
        resourceType: 'debate_message',
        resourceId: roomId,
        error: 'User attempted to create message for another user',
        errorCode: 'UNAUTHORIZED_USER_ID',
      });
      throw new Error('Cannot create message for another user');
    }

    try {
      // Verify user is participant
      const room = await this.getDebateRoom(roomId, requestingUserId || userId, requestingUserRole, req);
      if (!room) {
        throw new Error("Debate room not found");
      }

      // Authorization check - only participants can add messages
      if (requestingUserId && requestingUserRole !== 'admin' && requestingUserRole !== 'moderator') {
        checkDebateParticipation(requestingUserId || userId, room, req);
      }

      if (room.status !== 'active') {
        throw new Error("Debate room is not active");
      }

      logDataAccess({
        userId: requestingUserId || userId,
        userRole: requestingUserRole,
        action: 'create_debate_message',
        resourceType: 'debate_message',
        resourceId: roomId,
        accessLevel: 'write',
        ipAddress: req ? (req.ip || req.connection?.remoteAddress) : undefined,
        userAgent: req?.headers['user-agent'],
      });

      const [message] = await db
        .insert(debateMessages)
        .values({
          roomId,
          userId,
          content,
          status,
        })
        .returning();

      // Update room's last message timestamp
      await db
        .update(debateRooms)
        .set({ lastMessageAt: sql`now()` })
        .where(eq(debateRooms.id, roomId));

      const queryTime = Date.now() - startTime;
      logDatabaseOperation({
        userId: requestingUserId || userId,
        action: 'create_debate_message',
        resourceType: 'debate_message',
        resourceId: roomId,
        tableName: 'debate_messages',
        operation: 'insert',
        queryTimeMs: queryTime,
        rowsAffected: 1,
      });

      return message;
    } catch (error) {
      logSecurityEvent('error', 'database_operation', {
        userId: requestingUserId || userId,
        action: 'create_debate_message',
        resourceType: 'debate_message',
        resourceId: roomId,
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'DATABASE_ERROR',
      });
      throw error;
    }
  }

  async getDebateMessages(roomId: string, viewerId?: string, requestingUserId?: string, requestingUserRole?: string, req?: Request): Promise<DebateMessage[]> {
    const startTime = Date.now();

    try {
      // First check if user can access this debate room
      const room = await this.getDebateRoom(roomId, requestingUserId || viewerId, requestingUserRole, req);
      if (!room) {
        throw new Error('Debate room not found');
      }

      // Authorization check - only participants can see messages (unless moderator/admin)
      if (requestingUserId && requestingUserRole !== 'admin' && requestingUserRole !== 'moderator') {
        checkDebateParticipation(requestingUserId || viewerId || '', room, req);
      }

      logDataAccess({
        userId: requestingUserId || viewerId,
        userRole: requestingUserRole,
        action: 'read_debate_messages',
        resourceType: 'debate_message',
        resourceId: roomId,
        accessLevel: 'read',
        ipAddress: req ? (req.ip || req.connection?.remoteAddress) : undefined,
        userAgent: req?.headers['user-agent'],
      });

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

      // Add fallacy counts to messages
      const enrichedMessages = messages.map(message => ({
        ...message,
        fallacyCounts: fallacyMap[message.id] || {},
      }));

      const queryTime = Date.now() - startTime;
      logDatabaseOperation({
        userId: requestingUserId || viewerId,
        action: 'read_debate_messages',
        resourceType: 'debate_message',
        resourceId: roomId,
        tableName: 'debate_messages',
        operation: 'select',
        queryTimeMs: queryTime,
        rowsAffected: enrichedMessages.length,
      });

      return enrichedMessages;
    } catch (error) {
      logSecurityEvent('error', 'database_operation', {
        userId: requestingUserId || viewerId,
        action: 'read_debate_messages',
        resourceType: 'debate_message',
        resourceId: roomId,
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'DATABASE_ERROR',
      });
      throw error;
    }
  }

  async updateDebateRoomTurn(roomId: string, userId: string): Promise<DebateRoom> {
    const [room] = await db.select().from(debateRooms).where(eq(debateRooms.id, roomId)).limit(1);
    if (!room) {
      throw new Error("Debate room not found");
    }

    if (room.status !== 'active') {
      throw new Error("Debate room is not active");
    }

    let updates: any = {};

    if (room.participant1Id === userId) {
      updates.turnCount1 = (room.turnCount1 || 0) + 1;
      updates.currentTurn = room.participant2Id;
    } else if (room.participant2Id === userId) {
      updates.turnCount2 = (room.turnCount2 || 0) + 1;
      updates.currentTurn = room.participant1Id;
    } else {
      throw new Error("User is not a participant in this debate");
    }

    const [updated] = await db
      .update(debateRooms)
      .set(updates)
      .where(eq(debateRooms.id, roomId))
      .returning();

    return updated;
  }

  async submitDebateVote(vote: InsertDebateVote): Promise<DebateVote> {
    const [created] = await db.insert(debateVotes).values(vote).returning();
    return created;
  }

  async getDebateVotes(roomId: string): Promise<DebateVote[]> {
    return await db
      .select()
      .from(debateVotes)
      .where(eq(debateVotes.roomId, roomId))
      .orderBy(desc(debateVotes.createdAt));
  }

  async updateUserDebateStats(userId: string): Promise<UserDebateStats> {
    // Calculate stats from debate votes
    const [stats] = await db
      .select({
        totalDebates: sql<number>`count(distinct ${debateVotes.roomId})::int`,
        avgLogicalReasoning: sql<number>`round(avg(${debateVotes.logicalReasoning}) * 100)::int`,
        avgPoliteness: sql<number>`round(avg(${debateVotes.politeness}) * 100)::int`,
        avgOpennessToChange: sql<number>`round(avg(${debateVotes.opennessToChange}) * 100)::int`,
        totalVotesReceived: sql<number>`count(*)::int`,
      })
      .from(debateVotes)
      .where(eq(debateVotes.votedForUserId, userId));

    const userStats: InsertUserDebateStats = {
      userId,
      totalDebates: stats?.totalDebates || 0,
      avgLogicalReasoning: stats?.avgLogicalReasoning || 0,
      avgPoliteness: stats?.avgPoliteness || 0,
      avgOpennessToChange: stats?.avgOpennessToChange || 0,
      totalVotesReceived: stats?.totalVotesReceived || 0,
    };

    const [upserted] = await db
      .insert(userDebateStats)
      .values(userStats)
      .onConflictDoUpdate({
        target: userDebateStats.userId,
        set: userStats
      })
      .returning();

    return upserted;
  }

  async getUserDebateStats(userId: string): Promise<UserDebateStats | undefined> {
    const [stats] = await db.select().from(userDebateStats).where(eq(userDebateStats.userId, userId)).limit(1);
    return stats;
  }

  async updateDebatePhase(roomId: string, phase: 'structured' | 'voting' | 'free-form'): Promise<void> {
    await db
      .update(debateRooms)
      .set({ phase })
      .where(eq(debateRooms.id, roomId));
  }

  async submitVoteToContinue(roomId: string, userId: string, voteToContinue: boolean): Promise<DebateRoom> {
    const [room] = await db.select().from(debateRooms).where(eq(debateRooms.id, roomId)).limit(1);
    if (!room) {
      throw new Error("Debate room not found");
    }

    if (room.participant1Id !== userId && room.participant2Id !== userId) {
      throw new Error("User is not a participant in this debate");
    }

    let updates: any = {};

    if (room.participant1Id === userId) {
      updates.votesToContinue1 = voteToContinue;
    } else {
      updates.votesToContinue2 = voteToContinue;
    }

    // Check if both participants have voted
    const hasParticipant1Voted = room.participant1Id === userId ? voteToContinue !== null : room.votesToContinue1 !== null;
    const hasParticipant2Voted = room.participant2Id === userId ? voteToContinue !== null : room.votesToContinue2 !== null;

    if (hasParticipant1Voted && hasParticipant2Voted) {
      // Both have voted - check if they agree to continue
      const participant1Vote = room.participant1Id === userId ? voteToContinue : room.votesToContinue1;
      const participant2Vote = room.participant2Id === userId ? voteToContinue : room.votesToContinue2;

      if (participant1Vote === participant2Vote && participant1Vote === true) {
        // Both want to continue - move to free-form phase
        updates.phase = 'free-form';
        updates.currentTurn = null; // Free-form, no turn management
      } else {
        // They disagree or both want to end - end the debate
        updates.status = 'ended';
        updates.endedAt = new Date();
      }
    }

    const [updated] = await db
      .update(debateRooms)
      .set(updates)
      .where(eq(debateRooms.id, roomId))
      .returning();

    return updated;
  }

  async getGroupedDebateRooms(userId: string): Promise<{
    active: DebateRoom[];
    ended: DebateRoom[];
    archived: DebateRoom[];
  }> {
    const allRooms = await db
      .select()
      .from(debateRooms)
      .where(or(
        eq(debateRooms.participant1Id, userId),
        eq(debateRooms.participant2Id, userId)
      ))
      .orderBy(desc(debateRooms.startedAt));

    return {
      active: allRooms.filter(room => room.status === 'active'),
      ended: allRooms.filter(room => room.status === 'ended'),
      archived: allRooms.filter(room => room.status === 'archived'),
    };
  }

  async getArchivedDebateRooms(userId: string): Promise<DebateRoom[]> {
    return await db
      .select()
      .from(debateRooms)
      .where(and(
        or(
          eq(debateRooms.participant1Id, userId),
          eq(debateRooms.participant2Id, userId)
        ),
        eq(debateRooms.status, 'archived')
      ))
      .orderBy(desc(debateRooms.startedAt));
  }

  async markDebateRoomAsRead(roomId: string, userId: string): Promise<void> {
    const [room] = await db.select().from(debateRooms).where(eq(debateRooms.id, roomId)).limit(1);
    if (!room) {
      throw new Error("Debate room not found");
    }

    let updates: any = {};

    if (room.participant1Id === userId) {
      updates.participant1LastReadAt = new Date();
    } else if (room.participant2Id === userId) {
      updates.participant2LastReadAt = new Date();
    } else {
      throw new Error("User is not a participant in this debate");
    }

    await db.update(debateRooms).set(updates).where(eq(debateRooms.id, roomId));
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
      .where(and(
        eq(debateRooms.status, 'ended'),
        lt(debateRooms.lastMessageAt, cutoffDate)
      ));
  }

  async flagDebateMessage(messageId: string, userId: string, fallacyType: string): Promise<void> {
    await db.insert(debateMessageFlags).values({
      messageId,
      userId,
      fallacyType,
    });
  }
}
