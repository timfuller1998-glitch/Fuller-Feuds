import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { 
  insertTopicSchema, 
  insertOpinionSchema, 
  insertDebateRoomSchema,
  insertLiveStreamSchema
} from "@shared/schema";
import { z } from "zod";

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

  app.post('/api/topics', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertTopicSchema.parse({
        ...req.body,
        createdById: userId
      });
      
      const topic = await storage.createTopic(validatedData);
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
      res.status(201).json(opinion);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating opinion:", error);
      res.status(500).json({ message: "Failed to create opinion" });
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

  const httpServer = createServer(app);

  return httpServer;
}
