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
  insertUserFollowSchema,
  insertBannedPhraseSchema
} from "@shared/schema";
import { z } from "zod";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { AIService } from "./aiService";
import { validateContent } from "./utils/contentFilter";
import { 
  attachUserRole,
  requireAuth,
  requireModerator,
  requireAdmin,
  requireActiveAccount
} from "./middleware/permissions";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware from Replit Auth blueprint
  await setupAuth(app);

  // Attach user role to all requests
  app.use(attachUserRole);

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

  // Onboarding routes
  app.put("/api/onboarding/profile", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    try {
      await storage.updateUserProfile(userId, req.body);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.put("/api/onboarding/categories", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const { categories } = req.body;
    
    if (!Array.isArray(categories)) {
      return res.status(400).json({ error: "categories must be an array" });
    }

    try {
      await storage.updateFollowedCategories(userId, categories);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error updating categories:", error);
      res.status(500).json({ error: "Failed to update categories" });
    }
  });

  app.put("/api/onboarding/progress", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const { step, complete } = req.body;

    try {
      await storage.updateOnboardingProgress(userId, step, complete);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error updating onboarding progress:", error);
      res.status(500).json({ error: "Failed to update onboarding progress" });
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

  // Platform statistics endpoint
  app.get('/api/stats/platform', async (req, res) => {
    try {
      const [topics, liveStreams] = await Promise.all([
        storage.getTopics(),
        storage.getLiveStreams()
      ]);

      // Extract unique categories from all topics
      const allCategories = new Set<string>();
      topics.forEach((topic: any) => {
        if (topic.categories && Array.isArray(topic.categories)) {
          topic.categories.forEach((cat: string) => allCategories.add(cat));
        }
      });

      // Get all opinions to count unique participants
      const allOpinionsPromises = topics.map((topic: any) => storage.getOpinionsByTopic(topic.id, req.userRole));
      const allOpinionsArrays = await Promise.all(allOpinionsPromises);
      const allOpinions = allOpinionsArrays.flat();

      // Count unique participants (users who have posted opinions)
      const uniqueParticipants = new Set(allOpinions.map((o: any) => o.userId)).size;

      res.json({
        totalTopics: topics.length,
        liveStreams: liveStreams.filter((s: any) => s.status === 'live').length,
        totalParticipants: uniqueParticipants,
        totalCategories: allCategories.size
      });
    } catch (error) {
      console.error("Error fetching platform stats:", error);
      res.status(500).json({ message: "Failed to fetch platform statistics" });
    }
  });

  // Topic routes
  app.get('/api/topics', async (req, res) => {
    try {
      const { category, search, limit, createdBy } = req.query;
      const topics = await storage.getTopics({
        limit: limit ? parseInt(limit as string) : undefined,
        category: category as string,
        search: search as string,
        createdBy: createdBy as string,
      });
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

  // Record topic view
  app.post('/api/topics/:id/view', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const topicId = req.params.id;
      
      await storage.recordTopicView(userId, topicId);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error recording topic view:", error);
      res.status(500).json({ message: "Failed to record topic view" });
    }
  });

  // Get recently viewed categories for user
  app.get('/api/users/me/recent-categories', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      
      const categories = await storage.getRecentlyViewedCategories(userId, limit);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching recent categories:", error);
      res.status(500).json({ message: "Failed to fetch recent categories" });
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
      const { initialOpinion, stance, references, ...topicData } = req.body;
      
      // Validate initial opinion is provided and not empty
      if (!initialOpinion || !initialOpinion.trim()) {
        return res.status(400).json({ message: "Initial opinion is required" });
      }

      // Validate stance if provided (case-insensitive)
      const normalizedStance = stance ? String(stance).toLowerCase() : 'neutral';
      const validStance = ['for', 'against', 'neutral'].includes(normalizedStance) ? normalizedStance : 'neutral';
      
      // Validate the topic data
      const validatedData = insertTopicSchema.parse({
        ...topicData,
        createdById: userId,
        description: '' // Set empty description for backward compatibility
      });
      
      // Content filter validation for topic title
      const titleFilterResult = await validateContent(validatedData.title);
      if (!titleFilterResult.isAllowed) {
        return res.status(400).json({ 
          message: "Topic title contains inappropriate language.",
          detail: "Please review our community guidelines."
        });
      }
      
      // Content filter validation for initial opinion
      const opinionFilterResult = await validateContent(initialOpinion.trim());
      if (!opinionFilterResult.isAllowed) {
        return res.status(400).json({ 
          message: "Your opinion contains inappropriate language.",
          detail: "Please review our community guidelines."
        });
      }
      
      // If title or opinion should be flagged, mark topic as flagged
      const shouldFlagTopic = titleFilterResult.shouldFlag || opinionFilterResult.shouldFlag;
      
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
        imageUrl,
        status: shouldFlagTopic ? 'hidden' : 'active' // Flag topic if content needs review
      });
      
      // Create initial opinion (required)
      try {
        const opinionStatus = opinionFilterResult.shouldFlag ? 'flagged' : 'approved';
        await storage.createOpinion({
          topicId: topic.id,
          userId: userId,
          content: initialOpinion.trim(),
          stance: validStance, // Use the stance provided by user
          status: opinionStatus,
          references: references || []
        });
      } catch (opinionError) {
        console.error("Error creating initial opinion:", opinionError);
        // If opinion creation fails, we should probably delete the topic to maintain consistency
        // For now, we'll let it fail and the topic will exist without opinions
        return res.status(500).json({ message: "Failed to create initial opinion" });
      }
      
      // Check and award badges asynchronously
      storage.checkAndAwardBadges(userId).catch(err => {
        console.error("Error checking badges:", err);
      });
      
      res.status(201).json(topic);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating topic:", error);
      res.status(500).json({ message: "Failed to create topic" });
    }
  });

  app.delete('/api/topics/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const topicId = req.params.id;

      // Get the topic to verify ownership
      const topic = await storage.getTopic(topicId);
      if (!topic) {
        return res.status(404).json({ message: "Topic not found" });
      }

      // Check if the user is the creator of the topic
      if (topic.createdById !== userId) {
        return res.status(403).json({ message: "You can only delete topics you created" });
      }

      // Delete the topic (soft delete)
      await storage.deleteTopic(topicId);
      res.json({ success: true, message: "Topic deleted successfully" });
    } catch (error) {
      console.error("Error deleting topic:", error);
      res.status(500).json({ message: "Failed to delete topic" });
    }
  });

  // Opinion routes
  app.get('/api/opinions/recent', async (req: any, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const opinions = await storage.getRecentOpinions(limit, req.userRole);
      
      // If user is authenticated, include their vote for each opinion
      if (req.user?.claims?.sub) {
        const userId = req.user.claims.sub;
        const opinionsWithVotes = await Promise.all(
          opinions.map(async (opinion) => {
            const userVote = await storage.getUserVoteOnOpinion(opinion.id, userId);
            return {
              ...opinion,
              userVote: userVote ? { voteType: userVote.voteType } : null
            };
          })
        );
        return res.json(opinionsWithVotes);
      }
      
      res.json(opinions);
    } catch (error) {
      console.error("Error fetching recent opinions:", error);
      res.status(500).json({ message: "Failed to fetch recent opinions" });
    }
  });

  app.get('/api/topics/:topicId/opinions', async (req: any, res) => {
    try {
      const opinions = await storage.getOpinionsByTopic(req.params.topicId, req.userRole);
      
      // If user is authenticated, include their vote for each opinion
      if (req.user?.claims?.sub) {
        const userId = req.user.claims.sub;
        const opinionsWithVotes = await Promise.all(
          opinions.map(async (opinion) => {
            const userVote = await storage.getUserVoteOnOpinion(opinion.id, userId);
            return {
              ...opinion,
              userVote: userVote ? { voteType: userVote.voteType } : null
            };
          })
        );
        return res.json(opinionsWithVotes);
      }
      
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
      
      // Content filter validation
      const filterResult = await validateContent(validatedData.content);
      if (!filterResult.isAllowed) {
        return res.status(400).json({ 
          message: "Your post contains inappropriate language and cannot be submitted.",
          detail: "Please review our community guidelines."
        });
      }
      
      // If content should be flagged, create opinion with flagged status
      if (filterResult.shouldFlag) {
        validatedData.status = 'flagged';
      }
      
      const opinion = await storage.createOpinion(validatedData);
      
      // Auto-update political leaning analysis after creating opinion
      // Do this asynchronously without blocking the response
      storage.analyzeUserPoliticalLeaning(userId).catch(err => {
        console.error("Error auto-analyzing political leaning:", err);
      });
      
      // Check and award badges asynchronously
      storage.checkAndAwardBadges(userId).catch(err => {
        console.error("Error checking badges:", err);
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
      
      if (voteType !== null && !['like', 'dislike'].includes(voteType)) {
        return res.status(400).json({ message: "Invalid vote type" });
      }
      
      await storage.voteOnOpinion(req.params.opinionId, userId, voteType);
      res.json({ message: voteType === null ? "Vote removed" : "Vote recorded" });
    } catch (error) {
      console.error("Error voting on opinion:", error);
      res.status(500).json({ message: "Failed to vote on opinion" });
    }
  });

  app.get('/api/opinions/:opinionId/my-vote', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const vote = await storage.getUserVoteOnOpinion(req.params.opinionId, userId);
      res.json(vote || null);
    } catch (error) {
      console.error("Error fetching user vote:", error);
      res.status(500).json({ message: "Failed to fetch user vote" });
    }
  });

  app.post('/api/opinions/:opinionId/adopt', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { content, stance } = req.body;
      const adoptedOpinion = await storage.adoptOpinion(req.params.opinionId, userId, content, stance);
      res.json(adoptedOpinion);
    } catch (error) {
      console.error("Error adopting opinion:", error);
      res.status(500).json({ message: "Failed to adopt opinion" });
    }
  });

  // Moderation routes - Flag opinion
  app.post('/api/opinions/:opinionId/flag', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { fallacyType } = req.body;
      
      if (!fallacyType || typeof fallacyType !== 'string') {
        return res.status(400).json({ error: 'Fallacy type is required' });
      }
      
      await storage.flagOpinion(req.params.opinionId, userId, fallacyType);
      res.status(200).json({ message: 'Opinion flagged successfully' });
    } catch (error) {
      console.error("Error flagging opinion:", error);
      res.status(500).json({ message: "Failed to flag opinion" });
    }
  });

  // Start debate with opinion author
  app.post('/api/opinions/:opinionId/start-debate', isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const { opinionId } = req.params;
    
    try {
      console.log(`[Debate] User ${userId} attempting to start debate with opinion ${opinionId}`);

      const room = await storage.createDebateRoomWithOpinionAuthor(opinionId, userId);
      
      console.log(`[Debate] Successfully created debate room ${room.id} between ${room.participant1Id} and ${room.participant2Id}`);
      res.status(201).json(room);
    } catch (error: any) {
      console.error(`[Debate] Error starting debate for user ${userId} with opinion ${opinionId}:`, error.message);
      res.status(error.message?.includes('cannot debate') || error.message?.includes('same stance') || error.message?.includes('must have an opinion') ? 400 : 500)
        .json({ message: error.message || "Failed to start debate" });
    }
  });

  // Flag topic
  app.post('/api/topics/:topicId/flag', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { fallacyType } = req.body;
      
      if (!fallacyType || typeof fallacyType !== 'string') {
        return res.status(400).json({ error: 'Fallacy type is required' });
      }
      
      await storage.flagTopic(req.params.topicId, userId, fallacyType);
      res.status(200).json({ message: 'Topic flagged successfully' });
    } catch (error) {
      console.error("Error flagging topic:", error);
      res.status(500).json({ message: "Failed to flag topic" });
    }
  });

  // Flag debate message
  app.post('/api/debate-messages/:messageId/flag', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { fallacyType } = req.body;
      
      if (!fallacyType || typeof fallacyType !== 'string') {
        return res.status(400).json({ error: 'Fallacy type is required' });
      }
      
      await storage.flagDebateMessage(req.params.messageId, userId, fallacyType);
      res.status(200).json({ message: 'Debate message flagged successfully' });
    } catch (error) {
      console.error("Error flagging debate message:", error);
      res.status(500).json({ message: "Failed to flag debate message" });
    }
  });

  // Admin routes - Get flagged opinions
  app.get('/api/admin/flagged-opinions', requireModerator, async (req, res) => {
    try {
      const flagged = await storage.getFlaggedOpinions();
      res.json(flagged);
    } catch (error) {
      console.error("Error fetching flagged opinions:", error);
      res.status(500).json({ message: "Failed to fetch flagged opinions" });
    }
  });

  // Admin routes - Approve opinion
  app.post('/api/admin/opinions/:opinionId/approve', requireModerator, async (req: any, res) => {
    try {
      const moderatorId = req.user.claims.sub;
      const { reason } = req.body;
      
      await storage.approveOpinion(req.params.opinionId, moderatorId, reason);
      res.status(200).json({ message: 'Opinion approved' });
    } catch (error) {
      console.error("Error approving opinion:", error);
      res.status(500).json({ message: "Failed to approve opinion" });
    }
  });

  // Admin routes - Hide opinion
  app.post('/api/admin/opinions/:opinionId/hide', requireModerator, async (req: any, res) => {
    try {
      const moderatorId = req.user.claims.sub;
      const { reason } = req.body;
      
      await storage.hideOpinion(req.params.opinionId, moderatorId, reason);
      res.status(200).json({ message: 'Opinion hidden' });
    } catch (error) {
      console.error("Error hiding opinion:", error);
      res.status(500).json({ message: "Failed to hide opinion" });
    }
  });

  // Admin routes - User moderation
  app.post('/api/admin/users/:userId/suspend', requireModerator, async (req: any, res) => {
    try {
      const moderatorId = req.user.claims.sub;
      const { reason } = req.body;
      
      await storage.suspendUser(req.params.userId, moderatorId, reason);
      res.status(200).json({ message: 'User suspended' });
    } catch (error) {
      console.error("Error suspending user:", error);
      res.status(500).json({ message: "Failed to suspend user" });
    }
  });

  app.post('/api/admin/users/:userId/ban', requireModerator, async (req: any, res) => {
    try {
      const moderatorId = req.user.claims.sub;
      const { reason } = req.body;
      
      await storage.banUser(req.params.userId, moderatorId, reason);
      res.status(200).json({ message: 'User banned' });
    } catch (error) {
      console.error("Error banning user:", error);
      res.status(500).json({ message: "Failed to ban user" });
    }
  });

  app.post('/api/admin/users/:userId/reinstate', requireModerator, async (req: any, res) => {
    try {
      const moderatorId = req.user.claims.sub;
      const { reason } = req.body;
      
      await storage.reinstateUser(req.params.userId, moderatorId, reason);
      res.status(200).json({ message: 'User reinstated' });
    } catch (error) {
      console.error("Error reinstating user:", error);
      res.status(500).json({ message: "Failed to reinstate user" });
    }
  });

  // Admin routes - Topic moderation
  app.post('/api/admin/topics/:topicId/hide', requireModerator, async (req: any, res) => {
    try {
      const moderatorId = req.user.claims.sub;
      const { reason } = req.body;
      
      await storage.hideTopic(req.params.topicId, moderatorId, reason);
      res.status(200).json({ message: 'Topic hidden' });
    } catch (error) {
      console.error("Error hiding topic:", error);
      res.status(500).json({ message: "Failed to hide topic" });
    }
  });

  app.post('/api/admin/topics/:topicId/archive', requireModerator, async (req: any, res) => {
    try {
      const moderatorId = req.user.claims.sub;
      const { reason } = req.body;
      
      await storage.archiveTopic(req.params.topicId, moderatorId, reason);
      res.status(200).json({ message: 'Topic archived' });
    } catch (error) {
      console.error("Error archiving topic:", error);
      res.status(500).json({ message: "Failed to archive topic" });
    }
  });

  app.post('/api/admin/topics/:topicId/restore', requireModerator, async (req: any, res) => {
    try {
      const moderatorId = req.user.claims.sub;
      const { reason } = req.body;
      
      await storage.restoreTopic(req.params.topicId, moderatorId, reason);
      res.status(200).json({ message: 'Topic restored' });
    } catch (error) {
      console.error("Error restoring topic:", error);
      res.status(500).json({ message: "Failed to restore topic" });
    }
  });

  // Banned phrases routes (admin only)
  app.get('/api/admin/banned-phrases', requireAdmin, async (req, res) => {
    try {
      const phrases = await storage.getAllBannedPhrases();
      res.json(phrases);
    } catch (error) {
      console.error("Error fetching banned phrases:", error);
      res.status(500).json({ message: "Failed to fetch banned phrases" });
    }
  });

  app.post('/api/admin/banned-phrases', requireAdmin, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const validatedData = insertBannedPhraseSchema.parse({
        ...req.body,
        addedById: adminId
      });
      
      const newPhrase = await storage.createBannedPhrase(validatedData);
      res.status(201).json(newPhrase);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      console.error("Error creating banned phrase:", error);
      res.status(500).json({ message: "Failed to create banned phrase" });
    }
  });

  app.delete('/api/admin/banned-phrases/:id', requireAdmin, async (req, res) => {
    try {
      await storage.deleteBannedPhrase(req.params.id);
      res.status(200).json({ message: 'Banned phrase deleted' });
    } catch (error) {
      console.error("Error deleting banned phrase:", error);
      res.status(500).json({ message: "Failed to delete banned phrase" });
    }
  });

  // Admin - User management routes
  app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
      const { role, status, search, limit } = req.query;
      const users = await storage.getAllUsers({
        role: role as string,
        status: status as string,
        search: search as string,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.put('/api/admin/users/:userId/role', requireAdmin, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const { role } = req.body;
      
      if (!role || !['user', 'moderator', 'admin'].includes(role)) {
        return res.status(400).json({ message: "Invalid role. Must be 'user', 'moderator', or 'admin'" });
      }
      
      await storage.updateUserRole(req.params.userId, role, adminId);
      res.json({ message: 'User role updated successfully' });
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  app.put('/api/admin/users/:userId/status', requireAdmin, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const { status } = req.body;
      
      if (!status || !['active', 'suspended', 'banned'].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be 'active', 'suspended', or 'banned'" });
      }
      
      await storage.updateUserStatus(req.params.userId, status, adminId);
      res.json({ message: 'User status updated successfully' });
    } catch (error) {
      console.error("Error updating user status:", error);
      res.status(500).json({ message: "Failed to update user status" });
    }
  });

  app.delete('/api/admin/users/:userId', requireAdmin, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const userId = req.params.userId;

      // Prevent admin from deleting their own account
      if (adminId === userId) {
        return res.status(400).json({ message: "You cannot delete your own account" });
      }

      await storage.deleteUser(userId, adminId);
      res.json({ message: 'User account deleted successfully' });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Admin - Content management routes
  app.get('/api/admin/topics', requireAdmin, async (req, res) => {
    try {
      const { status, startDate, endDate, limit } = req.query;
      const topics = await storage.getAllTopics({
        status: status as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      res.json(topics);
    } catch (error) {
      console.error("Error fetching topics:", error);
      res.status(500).json({ message: "Failed to fetch topics" });
    }
  });

  app.get('/api/admin/opinions', requireAdmin, async (req, res) => {
    try {
      const { status, startDate, endDate, limit } = req.query;
      const opinions = await storage.getAllOpinions({
        status: status as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      res.json(opinions);
    } catch (error) {
      console.error("Error fetching opinions:", error);
      res.status(500).json({ message: "Failed to fetch opinions" });
    }
  });

  app.delete('/api/admin/topics/:topicId', requireAdmin, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const topicId = req.params.topicId;
      
      await storage.deleteTopicAdmin(topicId, adminId);
      res.json({ message: 'Topic deleted successfully' });
    } catch (error) {
      console.error("Error deleting topic:", error);
      res.status(500).json({ message: "Failed to delete topic" });
    }
  });

  app.delete('/api/admin/opinions/:opinionId', requireAdmin, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const opinionId = req.params.opinionId;
      
      await storage.deleteOpinionAdmin(opinionId, adminId);
      res.json({ message: 'Opinion deleted successfully' });
    } catch (error) {
      console.error("Error deleting opinion:", error);
      res.status(500).json({ message: "Failed to delete opinion" });
    }
  });

  // Admin - Audit log routes
  app.get('/api/admin/audit-log', requireAdmin, async (req, res) => {
    try {
      const { actionType, moderatorId, startDate, endDate, limit } = req.query;
      const actions = await storage.getModerationActions({
        actionType: actionType as string,
        moderatorId: moderatorId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      res.json(actions);
    } catch (error) {
      console.error("Error fetching audit log:", error);
      res.status(500).json({ message: "Failed to fetch audit log" });
    }
  });

  // Admin - Data sync utilities
  app.post('/api/admin/sync-opinion-counts', requireAdmin, async (req, res) => {
    try {
      const result = await storage.syncOpinionCounts();
      res.json(result);
    } catch (error) {
      console.error("Error syncing opinion counts:", error);
      res.status(500).json({ message: "Failed to sync opinion counts" });
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
      
      // Count user's created topics
      const totalTopics = await storage.countTopicsByUser(req.params.userId);
      
      res.json({
        user,
        profile: {
          ...profile,
          totalTopics,
        },
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
        sortBy as 'recent' | 'oldest' | 'popular' | 'controversial',
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

  // Theme routes
  app.post('/api/themes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { insertThemeSchema } = await import("@shared/schema");
      const validatedData = insertThemeSchema.parse({
        ...req.body,
        userId
      });
      
      const theme = await storage.createTheme(validatedData);
      res.status(201).json(theme);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating theme:", error);
      res.status(500).json({ message: "Failed to create theme" });
    }
  });

  app.get('/api/themes', async (req, res) => {
    try {
      const { userId, visibility, limit, search } = req.query;
      const themes = await storage.getThemes({
        userId: userId as string,
        visibility: visibility as string,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string,
      });
      res.json(themes);
    } catch (error) {
      console.error("Error fetching themes:", error);
      res.status(500).json({ message: "Failed to fetch themes" });
    }
  });

  app.get('/api/themes/public', async (req: any, res) => {
    try {
      const { limit = 50, search } = req.query;
      const userId = req.user?.claims?.sub;
      const themes = await storage.getPublicThemes(
        parseInt(limit as string),
        search as string,
        userId
      );
      res.json(themes);
    } catch (error) {
      console.error("Error fetching public themes:", error);
      res.status(500).json({ message: "Failed to fetch public themes" });
    }
  });

  app.get('/api/themes/my-themes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const themes = await storage.getUserThemes(userId);
      res.json(themes);
    } catch (error) {
      console.error("Error fetching user themes:", error);
      res.status(500).json({ message: "Failed to fetch user themes" });
    }
  });

  app.get('/api/themes/:themeId', async (req, res) => {
    try {
      const theme = await storage.getTheme(req.params.themeId);
      if (!theme) {
        return res.status(404).json({ message: "Theme not found" });
      }
      res.json(theme);
    } catch (error) {
      console.error("Error fetching theme:", error);
      res.status(500).json({ message: "Failed to fetch theme" });
    }
  });

  app.patch('/api/themes/:themeId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { themeId } = req.params;
      
      const theme = await storage.updateTheme(themeId, userId, req.body);
      res.json(theme);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      if (error.message === 'Theme not found or unauthorized') {
        return res.status(404).json({ message: error.message });
      }
      console.error("Error updating theme:", error);
      res.status(500).json({ message: "Failed to update theme" });
    }
  });

  app.delete('/api/themes/:themeId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { themeId } = req.params;
      
      await storage.deleteTheme(themeId, userId);
      res.json({ message: "Theme deleted successfully" });
    } catch (error) {
      console.error("Error deleting theme:", error);
      res.status(500).json({ message: "Failed to delete theme" });
    }
  });

  app.post('/api/themes/:themeId/fork', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { themeId } = req.params;
      const { name, description } = req.body;
      
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ message: "Theme name is required" });
      }
      
      const forkedTheme = await storage.forkTheme(themeId, userId, name, description);
      res.status(201).json(forkedTheme);
    } catch (error) {
      if (error.message === 'Theme not found') {
        return res.status(404).json({ message: error.message });
      }
      console.error("Error forking theme:", error);
      res.status(500).json({ message: "Failed to fork theme" });
    }
  });

  app.post('/api/themes/:themeId/like', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { themeId } = req.params;
      
      await storage.likeTheme(themeId, userId);
      res.json({ message: "Theme liked successfully" });
    } catch (error) {
      console.error("Error liking theme:", error);
      res.status(500).json({ message: "Failed to like theme" });
    }
  });

  app.delete('/api/themes/:themeId/like', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { themeId } = req.params;
      
      await storage.unlikeTheme(themeId, userId);
      res.json({ message: "Theme unliked successfully" });
    } catch (error) {
      console.error("Error unliking theme:", error);
      res.status(500).json({ message: "Failed to unlike theme" });
    }
  });

  app.get('/api/themes/:themeId/liked', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { themeId } = req.params;
      
      const liked = await storage.isThemeLiked(themeId, userId);
      res.json({ liked });
    } catch (error) {
      console.error("Error checking theme like status:", error);
      res.status(500).json({ message: "Failed to check like status" });
    }
  });

  app.post('/api/themes/:themeId/apply', isAuthenticated, async (req: any, res) => {
    try {
      const { themeId } = req.params;
      
      await storage.incrementThemeUsage(themeId);
      res.json({ message: "Theme applied successfully" });
    } catch (error) {
      console.error("Error applying theme:", error);
      res.status(500).json({ message: "Failed to apply theme" });
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
  app.get('/api/debate-rooms/:roomId/messages', async (req: any, res) => {
    try {
      // Pass the viewer ID if authenticated, for privacy redaction
      const viewerId = req.user?.claims?.sub;
      const messages = await storage.getDebateMessages(req.params.roomId, viewerId);
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

      // Content filter validation
      const filterResult = await validateContent(content.trim());
      if (!filterResult.isAllowed) {
        return res.status(400).json({ 
          message: "Your message contains inappropriate language and cannot be sent.",
          detail: "Please review our community guidelines."
        });
      }

      // If content should be flagged, mark message as flagged
      const messageStatus = filterResult.shouldFlag ? 'flagged' : 'approved';
      const message = await storage.addDebateMessage(req.params.roomId, userId, content, messageStatus);
      res.status(201).json(message);
    } catch (error) {
      console.error("Error adding debate message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Auto-match debate endpoint
  app.post('/api/topics/:topicId/match-debate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { topicId } = req.params;

      // Get user's opinion on this topic to determine their stance
      const userOpinions = await storage.getOpinionsByTopic(topicId);
      const userOpinion = userOpinions.find(o => o.userId === userId);

      if (!userOpinion) {
        return res.status(400).json({ 
          message: "You must have an opinion on this topic before starting a debate" 
        });
      }

      // Find users with opposite opinions
      const oppositeUsers = await storage.findOppositeOpinionUsers(topicId, userId, userOpinion.stance);

      if (oppositeUsers.length === 0) {
        return res.status(404).json({ 
          message: "No users with opposite opinions are available for debate right now" 
        });
      }

      // Randomly select an opponent
      const opponent = oppositeUsers[Math.floor(Math.random() * oppositeUsers.length)];

      // Get opponent's opinion to determine their stance
      const opponentOpinion = userOpinions.find(o => o.userId === opponent.id);
      const opponentStance = opponentOpinion?.stance || (userOpinion.stance === 'for' ? 'against' : 'for');

      // Create the debate room
      const room = await storage.createDebateRoom({
        topicId,
        participant1Id: userId,
        participant2Id: opponent.id,
        participant1Stance: userOpinion.stance,
        participant2Stance: opponentStance,
      });

      // Check and award badges asynchronously for both participants
      storage.checkAndAwardBadges(userId).catch(err => {
        console.error("Error checking badges for user:", err);
      });
      storage.checkAndAwardBadges(opponent.id).catch(err => {
        console.error("Error checking badges for opponent:", err);
      });

      res.status(201).json(room);
    } catch (error) {
      console.error("Error matching debate:", error);
      res.status(500).json({ message: "Failed to match debate" });
    }
  });

  // Get available opponents for a topic
  app.get('/api/topics/:topicId/available-opponents', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { topicId } = req.params;

      // Get user's opinion on this topic
      const userOpinions = await storage.getOpinionsByTopic(topicId);
      const userOpinion = userOpinions.find(o => o.userId === userId);

      if (!userOpinion) {
        return res.status(400).json({ 
          message: "You must have an opinion on this topic first" 
        });
      }

      // Find users with opposite opinions
      const oppositeUsers = await storage.findOppositeOpinionUsers(topicId, userId, userOpinion.stance);

      res.json(oppositeUsers);
    } catch (error) {
      console.error("Error fetching available opponents:", error);
      res.status(500).json({ message: "Failed to fetch available opponents" });
    }
  });

  // Switch opponent in debate room
  app.post('/api/debate-rooms/:roomId/switch-opponent', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { roomId } = req.params;
      const { opponentId } = req.body; // Optional - if not provided, match randomly

      // Get current room
      const currentRoom = await storage.getDebateRoom(roomId);
      if (!currentRoom) {
        return res.status(404).json({ message: "Debate room not found" });
      }

      // Verify user is a participant
      if (currentRoom.participant1Id !== userId && currentRoom.participant2Id !== userId) {
        return res.status(403).json({ message: "You are not a participant in this debate" });
      }

      // End the current room
      await storage.endDebateRoom(roomId);

      // Determine user's stance
      const userStance = currentRoom.participant1Id === userId 
        ? currentRoom.participant1Stance 
        : currentRoom.participant2Stance;

      let newOpponentId: string;
      let newOpponentStance: string;

      if (opponentId) {
        // Specific opponent selected
        newOpponentId = opponentId;
        // Get opponent's opinion to determine stance
        const opponentOpinions = await storage.getOpinionsByTopic(currentRoom.topicId);
        const opponentOpinion = opponentOpinions.find(o => o.userId === opponentId);
        newOpponentStance = opponentOpinion?.stance || (userStance === 'for' ? 'against' : 'for');
      } else {
        // Random match
        const oppositeUsers = await storage.findOppositeOpinionUsers(
          currentRoom.topicId, 
          userId, 
          userStance
        );

        if (oppositeUsers.length === 0) {
          return res.status(404).json({ 
            message: "No users with opposite opinions are available" 
          });
        }

        const opponent = oppositeUsers[Math.floor(Math.random() * oppositeUsers.length)];
        newOpponentId = opponent.id;

        const opponentOpinions = await storage.getOpinionsByTopic(currentRoom.topicId);
        const opponentOpinion = opponentOpinions.find(o => o.userId === newOpponentId);
        newOpponentStance = opponentOpinion?.stance || (userStance === 'for' ? 'against' : 'for');
      }

      // Create new debate room
      const newRoom = await storage.createDebateRoom({
        topicId: currentRoom.topicId,
        participant1Id: userId,
        participant2Id: newOpponentId,
        participant1Stance: userStance,
        participant2Stance: newOpponentStance,
      });

      res.status(201).json(newRoom);
    } catch (error) {
      console.error("Error switching opponent:", error);
      res.status(500).json({ message: "Failed to switch opponent" });
    }
  });

  // Update debate room privacy
  app.put('/api/debate-rooms/:roomId/privacy', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { roomId } = req.params;
      const { privacy } = req.body;

      if (!privacy || (privacy !== 'public' && privacy !== 'private')) {
        return res.status(400).json({ 
          message: "Privacy must be 'public' or 'private'" 
        });
      }

      await storage.updateDebateRoomPrivacy(roomId, userId, privacy);

      res.json({ message: "Privacy settings updated successfully" });
    } catch (error) {
      console.error("Error updating privacy:", error);
      if (error instanceof Error && error.message.includes("not a participant")) {
        return res.status(403).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to update privacy settings" });
    }
  });

  // Get user's active debate rooms with enriched data
  app.get('/api/users/me/debate-rooms', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const rooms = await storage.getUserActiveDebateRoomsEnriched(userId);
      res.json(rooms);
    } catch (error) {
      console.error("Error fetching user debate rooms:", error);
      res.status(500).json({ message: "Failed to fetch debate rooms" });
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

  // Badge routes
  app.get('/api/badges', async (req, res) => {
    try {
      const allBadges = await storage.getAllBadges();
      res.json(allBadges);
    } catch (error) {
      console.error("Error fetching badges:", error);
      res.status(500).json({ message: "Failed to fetch badges" });
    }
  });

  app.get('/api/users/:userId/badges', async (req, res) => {
    try {
      const { userId } = req.params;
      const userBadges = await storage.getUserBadges(userId);
      res.json(userBadges);
    } catch (error) {
      console.error("Error fetching user badges:", error);
      res.status(500).json({ message: "Failed to fetch user badges" });
    }
  });

  app.post('/api/users/me/selected-badge', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { badgeId } = req.body;
      
      await storage.setSelectedBadge(userId, badgeId || null);
      res.json({ message: "Selected badge updated successfully" });
    } catch (error: any) {
      console.error("Error setting selected badge:", error);
      if (error.message === "User has not unlocked this badge") {
        return res.status(403).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to set selected badge" });
    }
  });

  app.get('/api/leaderboards', async (req, res) => {
    try {
      const leaderboards = await storage.getLeaderboards();
      res.json(leaderboards);
    } catch (error) {
      console.error("Error fetching leaderboards:", error);
      res.status(500).json({ message: "Failed to fetch leaderboards" });
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
