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
  app.get('/api/users/me', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let user = await storage.getUser(userId);
      
      // If user doesn't exist, create them automatically
      if (!user) {
        const claims = req.user.claims;
        await storage.createUser({
          id: userId,
          email: claims.email,
          firstName: claims.first_name || null,
          lastName: claims.last_name || null,
          profileImageUrl: claims.profile_image_url || null,
        });
        user = await storage.getUser(userId);
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching current user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.patch('/api/users/me', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { followedCategories } = req.body;

      if (followedCategories !== undefined && !Array.isArray(followedCategories)) {
        return res.status(400).json({ message: "followedCategories must be an array" });
      }

      if (followedCategories) {
        await storage.updateFollowedCategories(userId, followedCategories);
      }

      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error updating current user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.get('/api/users/active-distribution', async (req, res) => {
    try {
      const distribution = await storage.getActiveUserPoliticalDistribution();
      res.json(distribution);
    } catch (error) {
      console.error("Error fetching active user political distribution:", error);
      res.status(500).json({ message: "Failed to fetch active user distribution" });
    }
  });

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

  // Search for similar topics using semantic similarity
  app.get('/api/topics/search-similar', async (req, res) => {
    try {
      const { query, threshold } = req.query;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: "Query parameter is required" });
      }

      if (query.trim().length < 3) {
        return res.json([]); // Return empty array for short queries
      }

      // Parse threshold or use default of 0.4 (broad recommendations)
      const similarityThreshold = threshold ? parseFloat(threshold as string) : 0.4;

      // Generate embedding for the query
      const queryEmbedding = await AIService.generateEmbedding(query);

      // Get all topics with embeddings
      const topics = await storage.getTopicsWithEmbeddings();

      // Calculate similarity scores and sort
      const topicsWithScores = topics
        .filter(topic => topic.embedding) // Only topics with embeddings
        .map(topic => ({
          ...topic,
          similarityScore: AIService.cosineSimilarity(
            queryEmbedding,
            topic.embedding as number[]
          )
        }))
        .sort((a, b) => b.similarityScore - a.similarityScore)
        .slice(0, 10); // Return top 10 similar topics

      // Filter by similarity threshold
      const relevantTopics = topicsWithScores.filter(t => t.similarityScore > similarityThreshold);

      // Remove embedding vectors from response to reduce payload size
      const topicsWithoutEmbeddings = relevantTopics.map(({ embedding, ...topic }) => topic);

      res.json(topicsWithoutEmbeddings);
    } catch (error) {
      console.error("Error searching similar topics:", error);
      res.status(500).json({ message: "Failed to search similar topics" });
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

  // Get political distribution for a topic
  app.get('/api/topics/:id/political-distribution', async (req, res) => {
    try {
      const distribution = await storage.getTopicPoliticalDistribution(req.params.id);
      res.json(distribution);
    } catch (error) {
      console.error("Error fetching topic political distribution:", error);
      res.status(500).json({ message: "Failed to fetch political distribution" });
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
      
      // Generate and store embedding for topic (async, don't block creation)
      AIService.generateEmbedding(validatedData.title)
        .then(embedding => storage.updateTopicEmbedding(topic.id, embedding))
        .catch(err => console.error("Error generating topic embedding:", err));
      
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
      const currentUserId = req.user?.claims?.sub;
      const opinions = await storage.getRecentOpinions(limit, req.userRole, currentUserId);
      
      // If user is authenticated, include their vote for each opinion
      if (currentUserId) {
        const opinionsWithVotes = await Promise.all(
          opinions.map(async (opinion) => {
            const userVote = await storage.getUserVoteOnOpinion(opinion.id, currentUserId);
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
      const currentUserId = req.user?.claims?.sub;
      const opinions = await storage.getOpinionsByTopic(req.params.topicId, req.userRole, currentUserId);
      
      // If user is authenticated, include their vote for each opinion
      if (currentUserId) {
        const opinionsWithVotes = await Promise.all(
          opinions.map(async (opinion) => {
            const userVote = await storage.getUserVoteOnOpinion(opinion.id, currentUserId);
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
      
      // Analyze opinion's political stance asynchronously (don't block the response)
      const topic = await storage.getTopic(req.params.topicId);
      if (topic) {
        AIService.analyzeOpinionPoliticalStance(validatedData.content, topic.title)
          .then(async (scores) => {
            // Update the opinion with political scores after creation
            await storage.updateOpinion(opinion.id, {
              topicEconomicScore: scores.economicScore,
              topicAuthoritarianScore: scores.authoritarianScore
            });
          })
          .catch(err => {
            console.error("Error analyzing opinion political stance:", err);
          });
      }
      
      // Auto-update political leaning analysis after creating opinion
      // Do this asynchronously without blocking the response
      storage.analyzeUserPoliticalLeaning(userId).catch(err => {
        console.error("Error auto-analyzing political leaning:", err);
      });
      
      // Check and award badges asynchronously
      storage.checkAndAwardBadges(userId).catch(err => {
        console.error("Error checking badges:", err);
      });
      
      // Auto-generate/update AI summary for the topic asynchronously
      storage.refreshCumulativeOpinion(req.params.topicId).catch(err => {
        console.error("Error auto-updating cumulative opinion:", err);
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

  app.get('/api/opinions/:opinionId', async (req, res) => {
    try {
      const opinion = await storage.getOpinion(req.params.opinionId);
      
      if (!opinion) {
        return res.status(404).json({ message: "Opinion not found" });
      }
      
      res.json(opinion);
    } catch (error) {
      console.error("Error fetching opinion:", error);
      res.status(500).json({ message: "Failed to fetch opinion" });
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
      
      // If content was updated, re-analyze political stance
      if (validatedData.content) {
        const topic = await storage.getTopic(opinion.topicId);
        if (topic) {
          AIService.analyzeOpinionPoliticalStance(validatedData.content, topic.title)
            .then(async (scores) => {
              await storage.updateOpinion(req.params.opinionId, {
                topicEconomicScore: scores.economicScore,
                topicAuthoritarianScore: scores.authoritarianScore
              });
            })
            .catch(err => {
              console.error("Error re-analyzing opinion political stance:", err);
            });
        }
      }
      
      // Auto-update political leaning analysis after updating opinion
      storage.analyzeUserPoliticalLeaning(userId).catch(err => {
        console.error("Error auto-analyzing political leaning:", err);
      });
      
      // Auto-generate/update AI summary for the topic asynchronously
      storage.refreshCumulativeOpinion(opinion.topicId).catch(err => {
        console.error("Error auto-updating cumulative opinion:", err);
      });
      
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
    const { openingMessage } = req.body;
    
    try {
      console.log(`[Debate] User ${userId} attempting to start debate with opinion ${opinionId}`);

      // Validate opening message if provided
      if (openingMessage && typeof openingMessage !== 'string') {
        return res.status(400).json({ message: "Opening message must be a string" });
      }

      if (openingMessage && openingMessage.trim().length === 0) {
        return res.status(400).json({ message: "Opening message cannot be empty" });
      }

      // Validate content BEFORE creating the room
      if (openingMessage && openingMessage.trim()) {
        const filterResult = await validateContent(openingMessage.trim());
        if (!filterResult.allowed) {
          return res.status(400).json({ 
            message: filterResult.reason || "Your opening message contains inappropriate content" 
          });
        }
      }

      const room = await storage.createDebateRoomWithOpinionAuthor(opinionId, userId);
      
      console.log(`[Debate] Successfully created debate room ${room.id} between ${room.participant1Id} and ${room.participant2Id}`);

      // If opening message provided, send it as first message
      if (openingMessage && openingMessage.trim()) {
        try {
          const message = await storage.addDebateMessage(room.id, userId, openingMessage.trim());

          // Update turn count and switch turn to opponent
          const updatedRoom = await storage.updateDebateRoomTurn(room.id, userId);

          // Broadcast via WebSocket
          broadcastToRoom(room.id, {
            type: 'new_message',
            message,
            roomId: room.id,
          });

          broadcastToRoom(room.id, {
            type: 'turn_update',
            roomId: room.id,
            currentTurn: updatedRoom.currentTurn,
            turnCount1: updatedRoom.turnCount1,
            turnCount2: updatedRoom.turnCount2,
          });

          console.log(`[Debate] Sent opening message for room ${room.id}`);
          
          // Return updated room with turn info
          return res.status(201).json(updatedRoom);
        } catch (msgError: any) {
          console.error(`[Debate] Failed to send opening message for room ${room.id}:`, msgError);
          // Still return the room - user can send message manually in debate room
        }
      }
      
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

  // Admin - Backfill embeddings for existing topics
  app.post('/api/admin/backfill-embeddings', requireAdmin, async (req, res) => {
    try {
      // Get ALL topics (not just those with embeddings)
      const allTopics = await storage.getTopics({});
      
      // Filter topics without embeddings
      const topicsWithoutEmbeddings = allTopics.filter(topic => !topic.embedding);
      
      console.log(`Found ${topicsWithoutEmbeddings.length} topics without embeddings out of ${allTopics.length} total topics`);
      
      if (topicsWithoutEmbeddings.length === 0) {
        return res.json({ 
          message: "All topics already have embeddings",
          updated: 0,
          total: allTopics.length
        });
      }
      
      // Generate embeddings for all topics without them
      let successCount = 0;
      let failureCount = 0;
      
      for (const topic of topicsWithoutEmbeddings) {
        try {
          const embedding = await AIService.generateEmbedding(topic.title);
          await storage.updateTopicEmbedding(topic.id, embedding);
          successCount++;
          console.log(`Generated embedding for topic: ${topic.title}`);
        } catch (error) {
          console.error(`Failed to generate embedding for topic ${topic.id}:`, error);
          failureCount++;
        }
      }
      
      res.json({
        message: `Successfully generated embeddings for ${successCount} topics`,
        updated: successCount,
        failed: failureCount,
        total: allTopics.length
      });
    } catch (error) {
      console.error("Error backfilling embeddings:", error);
      res.status(500).json({ message: "Failed to backfill embeddings" });
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

  // Admin - Backfill political scores for all opinions
  app.post('/api/admin/backfill-opinion-scores', requireAdmin, async (req, res) => {
    try {
      const { model = 'gpt-4o-mini' } = req.body;
      
      // Validate model parameter
      if (model !== 'gpt-4o-mini' && model !== 'gpt-5') {
        return res.status(400).json({ message: 'Invalid model. Must be gpt-4o-mini or gpt-5' });
      }

      console.log(`[Admin] Starting opinion political score backfill using ${model}`);
      
      // Get all opinions that need political scores
      const opinionsToProcess = await storage.getAllOpinionsForBackfill();
      
      console.log(`[Admin] Found ${opinionsToProcess.length} opinions to process`);

      // Process opinions in batches to avoid timeout
      const batchSize = 10;
      let processed = 0;
      let errors = 0;

      // Process in background and return immediately
      res.json({
        message: `Started backfill process for ${opinionsToProcess.length} opinions using ${model}`,
        totalOpinions: opinionsToProcess.length,
        model
      });

      // Process asynchronously
      (async () => {
        for (let i = 0; i < opinionsToProcess.length; i += batchSize) {
          const batch = opinionsToProcess.slice(i, i + batchSize);
          
          await Promise.all(
            batch.map(async (opinion) => {
              try {
                const scores = await AIService.analyzeOpinionPoliticalStance(
                  opinion.content,
                  opinion.topicTitle,
                  model as "gpt-4o-mini" | "gpt-5"
                );
                
                await storage.updateOpinion(opinion.id, {
                  topicEconomicScore: scores.economicScore,
                  topicAuthoritarianScore: scores.authoritarianScore
                });
                
                processed++;
                
                if (processed % 10 === 0) {
                  console.log(`[Admin Backfill] Processed ${processed}/${opinionsToProcess.length} opinions`);
                }
              } catch (error) {
                console.error(`[Admin Backfill] Error processing opinion ${opinion.id}:`, error);
                errors++;
              }
            })
          );

          // Small delay between batches to avoid rate limiting
          if (i + batchSize < opinionsToProcess.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        console.log(`[Admin Backfill] Complete! Processed: ${processed}, Errors: ${errors}`);
      })();

    } catch (error) {
      console.error("Error backfilling opinion scores:", error);
      res.status(500).json({ message: "Failed to start backfill process" });
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
        participant1Id: userId,
        // Set defaults for structured debate if not provided
        phase: req.body.phase || 'structured',
        currentTurn: req.body.currentTurn || userId,
        turnCount1: req.body.turnCount1 ?? 0,
        turnCount2: req.body.turnCount2 ?? 0,
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
        participant1Id: userId,
        // Set defaults for structured debate if not provided
        phase: req.body.phase || 'structured',
        currentTurn: req.body.currentTurn || userId,
        turnCount1: req.body.turnCount1 ?? 0,
        turnCount2: req.body.turnCount2 ?? 0,
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

  app.get('/api/profile/:userId/opinions', async (req: any, res) => {
    try {
      const { sortBy = 'recent', limit = 20 } = req.query;
      const viewerUserId = req.user?.claims?.sub;
      const opinions = await storage.getUserOpinions(
        req.params.userId, 
        sortBy as 'recent' | 'oldest' | 'popular' | 'controversial',
        parseInt(limit as string),
        viewerUserId
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
        participant1Id: userId,
        // Set defaults for structured debate if not provided
        phase: req.body.phase || 'structured',
        currentTurn: req.body.currentTurn || userId,
        turnCount1: req.body.turnCount1 ?? 0,
        turnCount2: req.body.turnCount2 ?? 0,
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

      // Get debate room to check turn and phase
      const room = await storage.getDebateRoom(req.params.roomId);
      if (!room) {
        return res.status(404).json({ message: "Debate room not found" });
      }

      // Determine which participant this user is
      const isParticipant1 = userId === room.participant1Id;
      const isParticipant2 = userId === room.participant2Id;

      if (!isParticipant1 && !isParticipant2) {
        return res.status(403).json({ message: "You are not a participant in this debate" });
      }

      // Turn enforcement for structured phase
      if (room.phase === 'structured') {
        // Check if it's the user's turn
        if (room.currentTurn && room.currentTurn !== userId) {
          return res.status(400).json({ 
            message: "It's not your turn to speak. Please wait for your opponent's response." 
          });
        }

        // Check if user has exceeded turn limit (3 turns max)
        const userTurnCount = isParticipant1 ? (room.turnCount1 || 0) : (room.turnCount2 || 0);
        if (userTurnCount >= 3) {
          return res.status(400).json({ 
            message: "You have reached the maximum of 3 turns. Waiting for voting phase." 
          });
        }
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
      
      // Update turn tracking if in structured phase
      let updatedRoom = room;
      if (room.phase === 'structured') {
        updatedRoom = await storage.updateDebateRoomTurn(req.params.roomId, userId);
        
        // Broadcast turn update
        broadcastToRoom(req.params.roomId, {
          type: 'turn_update',
          roomId: req.params.roomId,
          currentTurn: updatedRoom.currentTurn,
          turnCount1: updatedRoom.turnCount1,
          turnCount2: updatedRoom.turnCount2,
          phase: updatedRoom.phase,
          timestamp: new Date().toISOString()
        });
      }

      // Broadcast message to room via WebSocket for real-time delivery
      broadcastToRoom(req.params.roomId, {
        type: 'chat_message',
        roomId: req.params.roomId,
        userId: userId,
        content: content,
        timestamp: new Date().toISOString()
      });
      
      res.status(201).json({ message, room: updatedRoom });
    } catch (error) {
      console.error("Error adding debate message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Debate voting endpoints
  app.post('/api/debate-rooms/:roomId/vote', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { roomId } = req.params;
      const { logicalReasoning, politeness, opennessToChange, voteToContinue } = req.body;

      // Validate ratings
      if (!logicalReasoning || !politeness || !opennessToChange || 
          logicalReasoning < 1 || logicalReasoning > 5 ||
          politeness < 1 || politeness > 5 ||
          opennessToChange < 1 || opennessToChange > 5) {
        return res.status(400).json({ 
          message: "All ratings must be provided and between 1-5" 
        });
      }

      if (typeof voteToContinue !== 'boolean') {
        return res.status(400).json({ 
          message: "Vote to continue must be true or false" 
        });
      }

      // Get debate room to determine opponent
      const room = await storage.getDebateRoom(roomId);
      if (!room) {
        return res.status(404).json({ message: "Debate room not found" });
      }

      // Verify user is a participant
      const isParticipant1 = userId === room.participant1Id;
      const isParticipant2 = userId === room.participant2Id;

      if (!isParticipant1 && !isParticipant2) {
        return res.status(403).json({ message: "You are not a participant in this debate" });
      }

      // Check if debate is in voting phase
      if (room.phase !== 'voting') {
        return res.status(400).json({ 
          message: "Voting is only allowed in the voting phase" 
        });
      }

      // Determine opponent
      const votedForUserId = isParticipant1 ? room.participant2Id : room.participant1Id;

      // Submit the vote (ratings)
      const vote = await storage.submitDebateVote({
        roomId,
        voterId: userId,
        votedForUserId,
        logicalReasoning,
        politeness,
        opennessToChange,
      });

      // Submit vote to continue
      const updatedRoom = await storage.submitVoteToContinue(roomId, userId, voteToContinue);

      // Broadcast phase change if both voted
      if (updatedRoom.phase !== room.phase || updatedRoom.status !== room.status) {
        broadcastToRoom(roomId, {
          type: 'phase_update',
          roomId,
          phase: updatedRoom.phase,
          status: updatedRoom.status,
          votesToContinue1: updatedRoom.votesToContinue1,
          votesToContinue2: updatedRoom.votesToContinue2,
          timestamp: new Date().toISOString()
        });
      }

      res.json({ vote, room: updatedRoom });
    } catch (error) {
      console.error("Error submitting debate vote:", error);
      res.status(500).json({ message: "Failed to submit vote" });
    }
  });

  app.get('/api/debate-rooms/:roomId/votes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { roomId } = req.params;

      // Get debate room to verify participant
      const room = await storage.getDebateRoom(roomId);
      if (!room) {
        return res.status(404).json({ message: "Debate room not found" });
      }

      // Verify user is a participant
      const isParticipant = userId === room.participant1Id || userId === room.participant2Id;
      if (!isParticipant) {
        return res.status(403).json({ message: "You are not a participant in this debate" });
      }

      // Get all votes for this room
      const votes = await storage.getDebateVotes(roomId);

      res.json(votes);
    } catch (error) {
      console.error("Error fetching debate votes:", error);
      res.status(500).json({ message: "Failed to fetch votes" });
    }
  });

  app.get('/api/users/:userId/debate-stats', async (req: any, res) => {
    try {
      const { userId } = req.params;

      const stats = await storage.getUserDebateStats(userId);

      // Return empty stats if not found
      if (!stats) {
        return res.json({
          userId,
          totalDebates: 0,
          avgLogicalReasoning: 0,
          avgPoliteness: 0,
          avgOpennessToChange: 0,
          totalVotesReceived: 0,
        });
      }

      // Convert averages back to decimal (they're stored as integers * 100)
      res.json({
        ...stats,
        avgLogicalReasoning: stats.avgLogicalReasoning / 100,
        avgPoliteness: stats.avgPoliteness / 100,
        avgOpennessToChange: stats.avgOpennessToChange / 100,
      });
    } catch (error) {
      console.error("Error fetching user debate stats:", error);
      res.status(500).json({ message: "Failed to fetch debate stats" });
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

      // Check if user's opinion is open for debate
      if (userOpinion.debateStatus !== 'open') {
        if (userOpinion.debateStatus === 'private') {
          return res.status(400).json({ 
            message: "Your opinion is private. Change it to 'open for debate' to start debates" 
          });
        } else if (userOpinion.debateStatus === 'closed') {
          return res.status(400).json({ 
            message: "Your opinion is not open for debate. Change it to 'open for debate' to start debates" 
          });
        }
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

      // Create the debate room with structured phase initialization
      const room = await storage.createDebateRoom({
        topicId,
        participant1Id: userId,
        participant2Id: opponent.id,
        participant1Stance: userOpinion.stance,
        participant2Stance: opponentStance,
        phase: 'structured',
        currentTurn: userId, // Initiator goes first
        turnCount1: 0,
        turnCount2: 0,
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

      // Create new debate room with structured phase initialization
      const newRoom = await storage.createDebateRoom({
        topicId: currentRoom.topicId,
        participant1Id: userId,
        participant2Id: newOpponentId,
        participant1Stance: userStance,
        participant2Stance: newOpponentStance,
        phase: 'structured',
        currentTurn: userId, // Initiator goes first
        turnCount1: 0,
        turnCount2: 0,
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

  // Get recommended topics for a user (based on their categories and political leaning)
  app.get('/api/users/:userId/recommended-topics', async (req, res) => {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      
      // Get user's profile to find their interests
      const profile = await storage.getUserProfile(userId);
      
      // Get user's opinions to find categories they engage with
      const userOpinions = await storage.getUserOpinions(userId, 'recent', 50, userId);
      
      // Get topics the user has already participated in
      const participatedTopicIds = new Set(userOpinions.map((o: any) => o.topicId));
      
      // Get all topics
      const allTopics = await storage.getTopics();
      
      // Filter out topics the user has already participated in (for category matching)
      const candidateTopics = allTopics.filter(t => !participatedTopicIds.has(t.id));
      
      // Find categories the user engages with most
      const topicCategories = new Map<string, number>();
      for (const opinion of userOpinions) {
        const topic = await storage.getTopic(opinion.topicId);
        if (topic?.categories) {
          for (const category of topic.categories) {
            topicCategories.set(category, (topicCategories.get(category) || 0) + 1);
          }
        }
      }
      
      // Score topics based on category match
      const scoredTopics = candidateTopics.map(topic => {
        let score = 0;
        
        // Score based on matching categories
        if (topic.categories) {
          for (const category of topic.categories) {
            score += topicCategories.get(category) || 0;
          }
        }
        
        // Boost newer topics slightly
        const createdAt = topic.createdAt || new Date();
        const ageInDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
        if (ageInDays < 7) score += 2;
        else if (ageInDays < 30) score += 1;
        
        return { topic, score };
      });
      
      // Sort by score
      let recommended = scoredTopics
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ topic }) => topic);
      
      // Fallback to trending topics if we don't have enough category-based recommendations
      // This allows users to re-engage with topics and see updated summaries
      if (recommended.length < 5) {
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        
        const trendingTopics = allTopics
          // Filter to topics active in the last 30 days
          .filter(topic => {
            const topicDate = topic.createdAt ? new Date(topic.createdAt).getTime() : 0;
            return topicDate >= thirtyDaysAgo;
          })
          .map(topic => ({
            topic,
            trendingScore: (topic.opinionCount || 0) * 10 + 
                          (topic.participantCount || 0) * 5 +
                          (topic.createdAt && (Date.now() - new Date(topic.createdAt).getTime()) / (1000 * 60 * 60 * 24) < 7 ? 20 : 0)
          }))
          // Sort by trending score, then by most recent activity
          .sort((a, b) => {
            if (b.trendingScore !== a.trendingScore) {
              return b.trendingScore - a.trendingScore;
            }
            const dateA = a.topic.createdAt ? new Date(a.topic.createdAt).getTime() : 0;
            const dateB = b.topic.createdAt ? new Date(b.topic.createdAt).getTime() : 0;
            return dateB - dateA;
          })
          .map(({ topic }) => topic);
        
        // Add trending topics to fill the gap, avoiding duplicates
        const recommendedIds = new Set(recommended.map(t => t.id));
        for (const topic of trendingTopics) {
          if (recommended.length >= limit) break;
          if (!recommendedIds.has(topic.id)) {
            recommended.push(topic);
            recommendedIds.add(topic.id);
          }
        }
      }
      
      res.json(recommended);
    } catch (error) {
      console.error("Error fetching recommended topics:", error);
      res.status(500).json({ message: "Failed to fetch recommended topics" });
    }
  });

  // Get topics and opinions from users that this user follows (mixed feed)
  app.get('/api/users/:userId/following-topics', async (req, res) => {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      
      // Get list of users this user follows
      const following = await storage.getUserFollowing(userId);
      const followingIds = following.map((f: any) => f.id);
      
      if (followingIds.length === 0) {
        return res.json([]);
      }
      
      // Get all topics
      const allTopics = await storage.getTopics();
      
      // Filter topics created by followed users (topics already enriched with preview)
      const followingTopics = allTopics
        .filter(topic => followingIds.includes(topic.createdById))
        .map(topic => ({
          type: 'topic' as const,
          data: topic,
          timestamp: topic.createdAt || new Date()
        }));
      
      // Get recent opinions from all topics
      const allOpinions = await storage.getRecentOpinions(50);
      
      // Filter opinions posted by followed users
      const followingOpinions = allOpinions
        .filter((opinion: any) => followingIds.includes(opinion.userId))
        .map((opinion: any) => ({
          type: 'opinion' as const,
          data: opinion,
          timestamp: opinion.createdAt || new Date()
        }));
      
      // Combine and sort by timestamp (most recent first)
      const mixedFeed = [...followingTopics, ...followingOpinions]
        .sort((a, b) => {
          const dateA = new Date(a.timestamp).getTime();
          const dateB = new Date(b.timestamp).getTime();
          return dateB - dateA;
        })
        .slice(0, limit)
        .map(item => ({
          type: item.type,
          ...item.data
        }));
      
      res.json(mixedFeed);
    } catch (error) {
      console.error("Error fetching following content:", error);
      res.status(500).json({ message: "Failed to fetch following content" });
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
          
          case 'typing':
            handleTyping(ws, message);
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

  function handleTyping(ws: WebSocket, message: any) {
    const connection = userConnections.get(ws);
    if (!connection?.roomId) return;
    
    // Broadcast typing event to others in room (not to sender)
    const typingEvent = {
      type: 'typing',
      roomId: connection.roomId,
      userId: connection.userId,
      isTyping: message.isTyping,
      timestamp: new Date().toISOString()
    };
    
    broadcastToRoom(connection.roomId, typingEvent, ws);
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
