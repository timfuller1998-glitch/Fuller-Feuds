import { db } from '../db';
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
} from '@shared/schema';
import { eq, and, or, desc, sql, inArray, lt } from 'drizzle-orm';
import type {
  InsertDebateRoom,
  DebateRoom,
  DebateMessage,
  InsertDebateVote,
  DebateVote,
  UserDebateStats,
  InsertUserDebateStats
} from '@shared/schema';

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

  async getDebateRoom(id: string): Promise<DebateRoom | undefined> {
    const [room] = await db.select().from(debateRooms).where(eq(debateRooms.id, id)).limit(1);
    return room;
  }

  async getUserDebateRooms(userId: string): Promise<DebateRoom[]> {
    return await db
      .select()
      .from(debateRooms)
      .where(or(
        eq(debateRooms.participant1Id, userId),
        eq(debateRooms.participant2Id, userId)
      ))
      .orderBy(desc(debateRooms.startedAt));
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

  async addDebateMessage(roomId: string, userId: string, content: string, status: string = 'approved'): Promise<DebateMessage> {
    // Verify user is participant
    const [room] = await db.select().from(debateRooms).where(eq(debateRooms.id, roomId)).limit(1);
    if (!room) {
      throw new Error("Debate room not found");
    }

    if (room.participant1Id !== userId && room.participant2Id !== userId) {
      throw new Error("User is not a participant in this debate");
    }

    if (room.status !== 'active') {
      throw new Error("Debate room is not active");
    }

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
      .set({ lastMessageAt: new Date() })
      .where(eq(debateRooms.id, roomId));

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

    // Add fallacy counts to messages
    return messages.map(message => ({
      ...message,
      fallacyCounts: fallacyMap[message.id] || {},
    }));
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
