import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { 
  insertTopicSchema, 
  insertOpinionSchema, 
  insertDebateRoomSchema,
  insertLiveStreamSchema,
  insertUserProfileSchema,
  insertUserFollowSchema
} from "@shared/schema";
import { z } from "zod";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { AIService } from "./aiService";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware from Replit Auth blueprint
  await setupAuth(app);

  // Auth routes from Replit Auth blueprint
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Object storage routes - Referenced from integration: javascript_object_storage
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path,
      );
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", isAuthenticated, async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
  });

  app.put("/api/profile-picture", isAuthenticated, async (req: any, res) => {
    if (!req.body.objectId) {
      return res.status(400).json({ error: "objectId is required" });
    }

    const userId = req.user?.claims?.sub;

    try {
      const objectStorageService = new ObjectStorageService();
      // Use secure method that verifies ownership
      const objectPath = await objectStorageService.setUploadedObjectAclPolicy(
        req.body.objectId,
        userId,
        {
          visibility: "public", // Profile pictures are public
        },
      );

      // Update user's profile image in database
      await storage.updateUserProfileImage(userId, objectPath);

      res.status(200).json({
        objectPath: objectPath,
      });
    } catch (error) {
      console.error("Error setting profile picture:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      if (error.message?.includes("Unauthorized")) {
        return res.status(403).json({ error: error.message });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // User routes
  app.get('/api/users/:id', async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Topic routes
  app.get('/api/topics', async (req, res) => {
    try {
      const { category, search, limit } = req.query;
      const topics = await storage.getTopics(
        limit ? parseInt(limit as string) : undefined,
        category as string,
        search as string
      );
      res.json(topics);
    } catch (error) {
      console.error("Error fetching topics:", error);
      res.status(500).json({ message: "Failed to fetch topics" });
    }
  });

  app.get('/api/topics/:id', async (req, res) => {
    try {
      const topic = await storage.getTopic(req.params.id);
      if (!topic) {
        return res.status(404).json({ message: "Topic not found" });
      }
      res.json(topic);
    } catch (error) {
      console.error("Error fetching topic:", error);
      res.status(500).json({ message: "Failed to fetch topic" });
    }
  });

  app.post('/api/topics/generate-categories', isAuthenticated, async (req: any, res) => {
    try {
      const { title } = req.body;
      if (!title || typeof title !== 'string') {
        return res.status(400).json({ message: "Title is required" });
      }
      
      const categories = await AIService.generateCategories(title);
      res.json({ categories });
    } catch (error) {
      console.error("Error generating categories:", error);
      res.status(500).json({ message: "Failed to generate categories" });
    }
  });

  app.post('/api/topics', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { initialOpinion, ...topicData } = req.body;
      
      // Validate initial opinion is provided and not empty
      if (!initialOpinion || !initialOpinion.trim()) {
        return res.status(400).json({ message: "Initial opinion is required" });
      }
      
      // Validate the topic data
      const validatedData = insertTopicSchema.parse({
        ...topicData,
        createdById: userId,
        description: '' // Set empty description for backward compatibility
      });
      
      // Generate AI image based on topic title
      let imageUrl: string | undefined;
      try {
        imageUrl = await AIService.generateTopicImage(validatedData.title);
      } catch (imageError) {
        console.error("Error generating topic image, continuing without image:", imageError);
        // Continue without image if generation fails
      }
      
      // Create topic with generated image
      const topic = await storage.createTopic({
        ...validatedData,
        imageUrl
      });
      
      // Create initial opinion (required)
      try {
        await storage.createOpinion({
          topicId: topic.id,
          userId: userId,
          content: initialOpinion.trim(),
          stance: 'neutral' // Default stance, user can change later
        });
      } catch (opinionError) {
        console.error("Error creating initial opinion:", opinionError);
        // If opinion creation fails, we should probably delete the topic to maintain consistency
        // For now, we'll let it fail and the topic will exist without opinions
        return res.status(500).json({ message: "Failed to create initial opinion" });
      }
      
      res.status(201).json(topic);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating topic:", error);
      res.status(500).json({ message: "Failed to create topic" });
    }
  });

  // Opinion routes
  app.get('/api/topics/:topicId/opinions', async (req, res) => {
    try {
      const opinions = await storage.getOpinionsByTopic(req.params.topicId);
      res.json(opinions);
    } catch (error) {
      console.error("Error fetching opinions:", error);
      res.status(500).json({ message: "Failed to fetch opinions" });
    }
  });

  app.post('/api/topics/:topicId/opinions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertOpinionSchema.parse({
        ...req.body,
        topicId: req.params.topicId,
        userId
      });
      
      const opinion = await storage.createOpinion(validatedData);
      
      // Auto-update political leaning analysis after creating opinion
      // Do this asynchronously without blocking the response
      storage.analyzeUserPoliticalLeaning(userId).catch(err => {
        console.error("Error auto-analyzing political leaning:", err);
      });
      
      res.status(201).json(opinion);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating opinion:", error);
      res.status(500).json({ message: "Failed to create opinion" });
    }
  });

  app.patch('/api/opinions/:opinionId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const opinion = await storage.getOpinion(req.params.opinionId);
      
      if (!opinion) {
        return res.status(404).json({ message: "Opinion not found" });
      }
      
      if (opinion.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to update this opinion" });
      }
      
      const validatedData = insertOpinionSchema.omit({ topicId: true, userId: true }).parse(req.body);
      const updatedOpinion = await storage.updateOpinion(req.params.opinionId, validatedData);
      res.json(updatedOpinion);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating opinion:", error);
      res.status(500).json({ message: "Failed to update opinion" });
    }
  });

  app.post('/api/opinions/:opinionId/vote', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { voteType } = req.body;
      
      if (!['like', 'dislike'].includes(voteType)) {
        return res.status(400).json({ message: "Invalid vote type" });
      }
      
      await storage.voteOnOpinion(req.params.opinionId, userId, voteType);
      res.json({ message: "Vote recorded" });
    } catch (error) {
      console.error("Error voting on opinion:", error);
      res.status(500).json({ message: "Failed to vote on opinion" });
    }
  });

  // Cumulative opinion routes
  app.get('/api/topics/:topicId/cumulative', async (req, res) => {
    try {
      const cumulative = await storage.getCumulativeOpinion(req.params.topicId);
      res.json(cumulative);
    } catch (error) {
      console.error("Error fetching cumulative opinion:", error);
      res.status(500).json({ message: "Failed to fetch cumulative opinion" });
    }
  });

  app.post('/api/topics/:topicId/cumulative/generate', isAuthenticated, async (req, res) => {
    try {
      const cumulative = await storage.generateCumulativeOpinion(req.params.topicId);
      res.status(201).json(cumulative);
    } catch (error) {
      console.error("Error generating cumulative opinion:", error);
      res.status(500).json({ message: "Failed to generate cumulative opinion" });
    }
  });

  app.patch('/api/topics/:topicId/cumulative/refresh', isAuthenticated, async (req, res) => {
    try {
      const cumulative = await storage.refreshCumulativeOpinion(req.params.topicId);
      res.json(cumulative);
    } catch (error) {
      console.error("Error refreshing cumulative opinion:", error);
      res.status(500).json({ message: "Failed to refresh cumulative opinion" });
    }
  });

  // Debate room routes
  app.get('/api/debates/my-rooms', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const rooms = await storage.getUserDebateRooms(userId);
      res.json(rooms);
    } catch (error) {
      console.error("Error fetching debate rooms:", error);
      res.status(500).json({ message: "Failed to fetch debate rooms" });
    }
  });

  app.post('/api/debates/rooms', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertDebateRoomSchema.parse({
        ...req.body,
        participant1Id: userId
      });
      
      const room = await storage.createDebateRoom(validatedData);
      res.status(201).json(room);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating debate room:", error);
      res.status(500).json({ message: "Failed to create debate room" });
    }
  });

  app.get('/api/debates/rooms/:roomId', isAuthenticated, async (req, res) => {
    try {
      const room = await storage.getDebateRoom(req.params.roomId);
      if (!room) {
        return res.status(404).json({ message: "Debate room not found" });
      }
      res.json(room);
    } catch (error) {
      console.error("Error fetching debate room:", error);
      res.status(500).json({ message: "Failed to fetch debate room" });
    }
  });

  app.get('/api/debates/rooms/:roomId/messages', isAuthenticated, async (req, res) => {
    try {
      const messages = await storage.getDebateMessages(req.params.roomId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching debate messages:", error);
      res.status(500).json({ message: "Failed to fetch debate messages" });
    }
  });

  // Live stream routes
  app.get('/api/streams', async (req, res) => {
    try {
      const { status } = req.query;
      const streams = await storage.getLiveStreams(status as string);
      res.json(streams);
    } catch (error) {
      console.error("Error fetching live streams:", error);
      res.status(500).json({ message: "Failed to fetch live streams" });
    }
  });

  app.post('/api/streams', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertLiveStreamSchema.parse({
        ...req.body,
        moderatorId: userId
      });
      
      const stream = await storage.createLiveStream(validatedData);
      res.status(201).json(stream);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating live stream:", error);
      res.status(500).json({ message: "Failed to create live stream" });
    }
  });

  app.get('/api/streams/:streamId', async (req, res) => {
    try {
      const stream = await storage.getLiveStream(req.params.streamId);
      if (!stream) {
        return res.status(404).json({ message: "Live stream not found" });
      }
      res.json(stream);
    } catch (error) {
      console.error("Error fetching live stream:", error);
      res.status(500).json({ message: "Failed to fetch live stream" });
    }
  });

  // Moderation routes
  app.patch('/api/streams/:streamId/participants/:userId/mute', isAuthenticated, async (req: any, res) => {
    try {
      const { streamId, userId } = req.params;
      const muteSchema = z.object({ mute: z.boolean() });
      const { mute } = muteSchema.parse(req.body);
      const requestingUserId = req.user.claims.sub;
      
      const stream = await storage.getLiveStream(streamId);
      if (!stream) {
        return res.status(404).json({ message: "Stream not found" });
      }
      
      if (stream.moderatorId !== requestingUserId) {
        return res.status(403).json({ message: "Only the moderator can mute participants" });
      }
      
      await storage.updateParticipantStatus(streamId, userId, { isMuted: mute });
      res.json({ message: "Participant mute status updated" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating participant mute status:", error);
      res.status(500).json({ message: "Failed to update mute status" });
    }
  });

  app.delete('/api/streams/:streamId/participants/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const { streamId, userId } = req.params;
      const requestingUserId = req.user.claims.sub;
      
      const stream = await storage.getLiveStream(streamId);
      if (!stream) {
        return res.status(404).json({ message: "Stream not found" });
      }
      
      if (stream.moderatorId !== requestingUserId) {
        return res.status(403).json({ message: "Only the moderator can remove participants" });
      }
      
      await storage.removeStreamParticipant(streamId, userId);
      res.json({ message: "Participant removed" });
    } catch (error) {
      console.error("Error removing participant:", error);
      res.status(500).json({ message: "Failed to remove participant" });
    }
  });

  app.patch('/api/streams/:streamId/end', isAuthenticated, async (req: any, res) => {
    try {
      const { streamId } = req.params;
      const requestingUserId = req.user.claims.sub;
      
      const stream = await storage.getLiveStream(streamId);
      if (!stream) {
        return res.status(404).json({ message: "Stream not found" });
      }
      
      if (stream.moderatorId !== requestingUserId) {
        return res.status(403).json({ message: "Only the moderator can end the stream" });
      }
      
      await storage.updateStreamStatus(streamId, 'ended');
      res.json({ message: "Stream ended successfully" });
    } catch (error) {
      console.error("Error ending stream:", error);
      res.status(500).json({ message: "Failed to end stream" });
    }
  });

  // Debate room routes
  app.post('/api/debates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertDebateRoomSchema.parse({
        ...req.body,
        participant1Id: userId
      });
      
      const room = await storage.createDebateRoom(validatedData);
      res.status(201).json(room);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating debate room:", error);
      res.status(500).json({ message: "Failed to create debate room" });
    }
  });

  app.get('/api/debates/user/:userId', async (req, res) => {
    try {
      const rooms = await storage.getUserDebateRooms(req.params.userId);
      res.json(rooms);
    } catch (error) {
      console.error("Error fetching user debate rooms:", error);
      res.status(500).json({ message: "Failed to fetch debate rooms" });
    }
  });

  // Stream invitation routes
  app.post('/api/streams/:streamId/invitations', isAuthenticated, async (req: any, res) => {
    try {
      const { streamId } = req.params;
      const { userId } = req.body;
      const requestingUserId = req.user.claims.sub;
      
      // Verify the requesting user is the moderator of the stream
      const stream = await storage.getLiveStream(streamId);
      if (!stream) {
        return res.status(404).json({ message: "Stream not found" });
      }
      
      if (stream.moderatorId !== requestingUserId) {
        return res.status(403).json({ message: "Only the moderator can invite users" });
      }
      
      await storage.inviteUserToStream(streamId, userId);
      res.status(201).json({ message: "User invited successfully" });
    } catch (error) {
      console.error("Error inviting user to stream:", error);
      res.status(500).json({ message: "Failed to invite user" });
    }
  });

  app.get('/api/streams/:streamId/invitations', isAuthenticated, async (req: any, res) => {
    try {
      const { streamId } = req.params;
      const requestingUserId = req.user.claims.sub;
      
      // Verify the requesting user is the moderator of the stream
      const stream = await storage.getLiveStream(streamId);
      if (!stream) {
        return res.status(404).json({ message: "Stream not found" });
      }
      
      if (stream.moderatorId !== requestingUserId) {
        return res.status(403).json({ message: "Only the moderator can view invitations" });
      }
      
      const invitations = await storage.getStreamInvitations(streamId);
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching stream invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  app.post('/api/stream-invitations/:invitationId/respond', isAuthenticated, async (req: any, res) => {
    try {
      const { invitationId } = req.params;
      const { accept } = req.body;
      const userId = req.user.claims.sub;
      
      await storage.respondToStreamInvitation(invitationId, userId, accept);
      res.json({ message: accept ? "Invitation accepted" : "Invitation declined" });
    } catch (error) {
      console.error("Error responding to invitation:", error);
      res.status(500).json({ message: "Failed to respond to invitation" });
    }
  });

  app.get('/api/user/stream-invitations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { status } = req.query;
      
      const invitations = await storage.getUserStreamInvitations(userId, status as string);
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching user stream invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  app.get('/api/user/streams', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { status } = req.query;
      
      const streams = await storage.getUserStreams(userId, status as string);
      res.json(streams);
    } catch (error) {
      console.error("Error fetching user streams:", error);
      res.status(500).json({ message: "Failed to fetch streams" });
    }
  });

  // Profile routes
  app.get('/api/profile/:userId', async (req, res) => {
    try {
      const user = await storage.getUser(req.params.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const profile = await storage.getUserProfile(req.params.userId);
      const followerCount = profile?.followerCount || 0;
      const followingCount = profile?.followingCount || 0;
      
      res.json({
        user,
        profile,
        followerCount,
        followingCount
      });
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  app.get('/api/profile/:userId/opinions', async (req, res) => {
    try {
      const { sortBy = 'recent', limit = 20 } = req.query;
      const opinions = await storage.getUserOpinions(
        req.params.userId, 
        sortBy as 'recent' | 'popular' | 'controversial',
        parseInt(limit as string)
      );
      res.json(opinions);
    } catch (error) {
      console.error("Error fetching user opinions:", error);
      res.status(500).json({ message: "Failed to fetch user opinions" });
    }
  });

  app.post('/api/profile/:userId/analyze', isAuthenticated, async (req: any, res) => {
    try {
      const targetUserId = req.params.userId;
      const requestingUserId = req.user.claims.sub;
      
      // Only allow users to analyze their own profile
      if (targetUserId !== requestingUserId) {
        return res.status(403).json({ message: "Can only analyze your own profile" });
      }
      
      const profile = await storage.analyzeUserPoliticalLeaning(targetUserId);
      res.json(profile);
    } catch (error) {
      console.error("Error analyzing political leaning:", error);
      res.status(500).json({ message: "Failed to analyze political leaning" });
    }
  });

  app.patch('/api/profile/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const targetUserId = req.params.userId;
      const requestingUserId = req.user.claims.sub;
      
      // Only allow users to update their own profile
      if (targetUserId !== requestingUserId) {
        return res.status(403).json({ message: "Can only update your own profile" });
      }
      
      const validatedData = insertUserProfileSchema.parse(req.body);
      const profile = await storage.upsertUserProfile(targetUserId, validatedData);
      res.json(profile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Following routes
  app.post('/api/follow/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const followingId = req.params.userId;
      const followerId = req.user.claims.sub;
      
      const follow = await storage.followUser(followerId, followingId);
      res.status(201).json(follow);
    } catch (error) {
      console.error("Error following user:", error);
      res.status(500).json({ message: "Failed to follow user" });
    }
  });

  app.delete('/api/follow/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const followingId = req.params.userId;
      const followerId = req.user.claims.sub;
      
      await storage.unfollowUser(followerId, followingId);
      res.status(204).send();
    } catch (error) {
      console.error("Error unfollowing user:", error);
      res.status(500).json({ message: "Failed to unfollow user" });
    }
  });

  app.get('/api/follow/:userId/status', isAuthenticated, async (req: any, res) => {
    try {
      const followingId = req.params.userId;
      const followerId = req.user.claims.sub;
      
      const isFollowing = await storage.isFollowing(followerId, followingId);
      res.json({ isFollowing });
    } catch (error) {
      console.error("Error checking follow status:", error);
      res.status(500).json({ message: "Failed to check follow status" });
    }
  });

  app.get('/api/profile/:userId/followers', async (req, res) => {
    try {
      const { limit = 50 } = req.query;
      const followers = await storage.getUserFollowers(
        req.params.userId,
        parseInt(limit as string)
      );
      res.json(followers);
    } catch (error) {
      console.error("Error fetching followers:", error);
      res.status(500).json({ message: "Failed to fetch followers" });
    }
  });

  app.get('/api/profile/:userId/following', async (req, res) => {
    try {
      const { limit = 50 } = req.query;
      const following = await storage.getUserFollowing(
        req.params.userId,
        parseInt(limit as string)
      );
      res.json(following);
    } catch (error) {
      console.error("Error fetching following:", error);
      res.status(500).json({ message: "Failed to fetch following" });
    }
  });

  app.get('/api/profile/:userId/debate-rooms', async (req, res) => {
    try {
      const debateRooms = await storage.getUserDebateRooms(req.params.userId);
      res.json(debateRooms);
    } catch (error) {
      console.error("Error fetching debate rooms:", error);
      res.status(500).json({ message: "Failed to fetch debate rooms" });
    }
  });

  // Debate room routes
  app.get('/api/debate-rooms', async (req, res) => {
    try {
      const { status } = req.query;
      // For now, return empty array since full implementation would need
      // to query with joins to get participant info and topic details
      res.json([]);
    } catch (error) {
      console.error("Error fetching debate rooms:", error);
      res.status(500).json({ message: "Failed to fetch debate rooms" });
    }
  });

  app.get('/api/debate-rooms/:id', async (req, res) => {
    try {
      const room = await storage.getDebateRoom(req.params.id);
      if (!room) {
        return res.status(404).json({ message: "Debate room not found" });
      }
      res.json(room);
    } catch (error) {
      console.error("Error fetching debate room:", error);
      res.status(500).json({ message: "Failed to fetch debate room" });
    }
  });

  app.post('/api/debate-rooms', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertDebateRoomSchema.parse({
        ...req.body,
        participant1Id: userId
      });
      
      const room = await storage.createDebateRoom(validatedData);
      res.status(201).json(room);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating debate room:", error);
      res.status(500).json({ message: "Failed to create debate room" });
    }
  });

  // Debate message routes
  app.get('/api/debate-rooms/:roomId/messages', async (req, res) => {
    try {
      const messages = await storage.getDebateMessages(req.params.roomId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching debate messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post('/api/debate-rooms/:roomId/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { content } = req.body;
      
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ message: "Message content is required" });
      }

      const message = await storage.addDebateMessage(req.params.roomId, userId, content);
      res.status(201).json(message);
    } catch (error) {
      console.error("Error adding debate message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Live stream routes
  app.get('/api/live-streams', async (req, res) => {
    try {
      const { status, category } = req.query;
      const streams = await storage.getLiveStreams(status as string, category as string);
      res.json(streams);
    } catch (error) {
      console.error("Error fetching live streams:", error);
      res.status(500).json({ message: "Failed to fetch live streams" });
    }
  });

  app.get('/api/live-streams/:id', async (req, res) => {
    try {
      const stream = await storage.getLiveStream(req.params.id);
      if (!stream) {
        return res.status(404).json({ message: "Live stream not found" });
      }
      res.json(stream);
    } catch (error) {
      console.error("Error fetching live stream:", error);
      res.status(500).json({ message: "Failed to fetch live stream" });
    }
  });

  app.post('/api/live-streams', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertLiveStreamSchema.parse({
        ...req.body,
        moderatorId: userId
      });
      
      const stream = await storage.createLiveStream(validatedData);
      res.status(201).json(stream);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating live stream:", error);
      res.status(500).json({ message: "Failed to create live stream" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server for real-time features following blueprint pattern
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Store active connections by room and user
  const rooms = new Map<string, Map<string, WebSocket>>();
  const userConnections = new Map<WebSocket, { userId?: string, roomId?: string }>();

  wss.on('connection', (ws: WebSocket, req) => {
    console.log('New WebSocket connection');
    userConnections.set(ws, {});

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'join_room':
            handleJoinRoom(ws, message.roomId, message.userId);
            break;
          
          case 'leave_room':
            handleLeaveRoom(ws);
            break;
          
          case 'chat_message':
            handleChatMessage(ws, message);
            break;
          
          case 'live_vote':
            handleLiveVote(ws, message);
            break;
          
          case 'moderator_action':
            handleModeratorAction(ws, message);
            break;
          
          case 'stream_update':
            handleStreamUpdate(ws, message);
            break;
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      handleDisconnection(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      handleDisconnection(ws);
    });
  });

  // Helper functions for WebSocket message handling
  function handleJoinRoom(ws: WebSocket, roomId: string, userId?: string) {
    if (!roomId) return;
    
    // Leave previous room if any
    handleLeaveRoom(ws);
    
    // Join new room
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }
    
    const room = rooms.get(roomId)!;
    const connectionId = userId || `guest_${Date.now()}_${Math.random()}`;
    room.set(connectionId, ws);
    
    // Update user connection info
    userConnections.set(ws, { userId, roomId });
    
    // Notify user they joined
    ws.send(JSON.stringify({
      type: 'room_joined',
      roomId,
      userId: connectionId,
      participantCount: room.size
    }));
    
    // Notify others in room
    broadcastToRoom(roomId, {
      type: 'user_joined',
      roomId,
      userId: connectionId,
      participantCount: room.size
    }, ws);
    
    console.log(`User ${connectionId} joined room ${roomId}`);
  }

  function handleLeaveRoom(ws: WebSocket) {
    const connection = userConnections.get(ws);
    if (!connection?.roomId) return;
    
    const room = rooms.get(connection.roomId);
    let departingUserId: string | null = null;
    
    if (room) {
      // Find and remove user from room
      for (const [userId, socket] of Array.from(room.entries())) {
        if (socket === ws) {
          departingUserId = userId;
          room.delete(userId);
          break;
        }
      }
      
      // Clean up empty rooms
      if (room.size === 0) {
        rooms.delete(connection.roomId);
      } else {
        // Notify others user left - include departing userId
        broadcastToRoom(connection.roomId, {
          type: 'user_left',
          roomId: connection.roomId,
          userId: departingUserId,
          participantCount: room.size
        });
      }
    }
    
    // Update connection info
    userConnections.set(ws, { userId: connection.userId });
  }

  function handleChatMessage(ws: WebSocket, message: any) {
    const connection = userConnections.get(ws);
    if (!connection?.roomId) return;
    
    // Validate user is actually in the room
    const room = rooms.get(connection.roomId);
    if (!room) return;
    
    let userInRoom = false;
    for (const [userId, socket] of room.entries()) {
      if (socket === ws) {
        userInRoom = true;
        break;
      }
    }
    if (!userInRoom) return;
    
    const chatMessage = {
      type: 'chat_message',
      roomId: connection.roomId,
      userId: connection.userId || 'Anonymous',
      content: message.content,
      timestamp: new Date().toISOString()
    };
    
    // Broadcast to all users in room
    broadcastToRoom(connection.roomId, chatMessage);
  }

  function handleLiveVote(ws: WebSocket, message: any) {
    const connection = userConnections.get(ws);
    if (!connection?.roomId) return;
    
    // Validate user is actually in the room
    const room = rooms.get(connection.roomId);
    if (!room) return;
    
    let userInRoom = false;
    for (const [userId, socket] of room.entries()) {
      if (socket === ws) {
        userInRoom = true;
        break;
      }
    }
    if (!userInRoom) return;
    
    const voteMessage = {
      type: 'live_vote',
      roomId: connection.roomId,
      userId: connection.userId || 'Anonymous',
      vote: message.vote, // 'for', 'against', 'neutral'
      timestamp: new Date().toISOString()
    };
    
    // Broadcast vote to room
    broadcastToRoom(connection.roomId, voteMessage);
  }

  function handleModeratorAction(ws: WebSocket, message: any) {
    const connection = userConnections.get(ws);
    if (!connection?.roomId) return;
    
    // Validate user is actually in the room
    const room = rooms.get(connection.roomId);
    if (!room) return;
    
    let userInRoom = false;
    for (const [userId, socket] of room.entries()) {
      if (socket === ws) {
        userInRoom = true;
        break;
      }
    }
    if (!userInRoom) return;
    
    // TODO: Add additional verification that user is moderator for this room
    const modAction = {
      type: 'moderator_action',
      roomId: connection.roomId,
      action: message.action, // 'mute', 'unmute', 'kick', 'pause_stream', etc.
      target: message.target,
      moderatorId: connection.userId,
      timestamp: new Date().toISOString()
    };
    
    // Broadcast moderator action to room
    broadcastToRoom(connection.roomId, modAction);
  }

  function handleStreamUpdate(ws: WebSocket, message: any) {
    const connection = userConnections.get(ws);
    if (!connection?.roomId) return;
    
    // Validate user is actually in the room
    const room = rooms.get(connection.roomId);
    if (!room) return;
    
    let userInRoom = false;
    for (const [userId, socket] of room.entries()) {
      if (socket === ws) {
        userInRoom = true;
        break;
      }
    }
    if (!userInRoom) return;
    
    const streamUpdate = {
      type: 'stream_update',
      roomId: connection.roomId,
      status: message.status, // 'live', 'paused', 'ended'
      timestamp: new Date().toISOString()
    };
    
    // Broadcast stream status to room
    broadcastToRoom(connection.roomId, streamUpdate);
  }

  function handleDisconnection(ws: WebSocket) {
    handleLeaveRoom(ws);
    userConnections.delete(ws);
  }

  function broadcastToRoom(roomId: string, message: any, exclude?: WebSocket) {
    const room = rooms.get(roomId);
    if (!room) return;
    
    const messageStr = JSON.stringify(message);
    
    for (const [userId, socket] of Array.from(room.entries())) {
      if (socket !== exclude && socket.readyState === WebSocket.OPEN) {
        socket.send(messageStr);
      }
    }
  }

  return httpServer;
}
