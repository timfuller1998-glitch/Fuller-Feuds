import { Router } from 'express';
import { ModerationService } from '../services/moderationService.js';
import { TopicService } from '../services/topicService.js';
import { TopicRepository } from '../repositories/topicRepository.js';
import { OpinionRepository } from '../repositories/opinionRepository.js';
import { AIService } from '../aiService.js';
import { requireModerator, requireAdmin } from '../middleware/auth.js';
import { insertBannedPhraseSchema } from '../../shared/schema.js';
import { z } from 'zod';
import { runAISummaryUpdate } from '../scheduled-jobs.js';

const router = Router();
const moderationService = new ModerationService();
const topicService = new TopicService();

// User moderation routes
router.post('/users/:userId/suspend', requireModerator, async (req, res) => {
  try {
    const { reason } = req.body;
    await moderationService.suspendUser(req.params.userId, req.user!.id, reason);
    res.json({ message: "User suspended successfully" });
  } catch (error) {
    console.error("Error suspending user:", error);
    res.status(500).json({ message: "Failed to suspend user" });
  }
});

router.post('/users/:userId/ban', requireModerator, async (req, res) => {
  try {
    const { reason } = req.body;
    await moderationService.banUser(req.params.userId, req.user!.id, reason);
    res.json({ message: "User banned successfully" });
  } catch (error) {
    console.error("Error banning user:", error);
    res.status(500).json({ message: "Failed to ban user" });
  }
});

router.post('/users/:userId/reinstate', requireModerator, async (req, res) => {
  try {
    const { reason } = req.body;
    await moderationService.reinstateUser(req.params.userId, req.user!.id, reason);
    res.json({ message: "User reinstated successfully" });
  } catch (error) {
    console.error("Error reinstating user:", error);
    res.status(500).json({ message: "Failed to reinstate user" });
  }
});

// Topic moderation routes
router.post('/topics/:topicId/hide', requireModerator, async (req, res) => {
  try {
    const { reason } = req.body;
    await moderationService.hideTopic(req.params.topicId, req.user!.id, reason);
    res.json({ message: "Topic hidden successfully" });
  } catch (error) {
    console.error("Error hiding topic:", error);
    res.status(500).json({ message: "Failed to hide topic" });
  }
});

router.post('/topics/:topicId/archive', requireModerator, async (req, res) => {
  try {
    const { reason } = req.body;
    await moderationService.archiveTopic(req.params.topicId, req.user!.id, reason);
    res.json({ message: "Topic archived successfully" });
  } catch (error) {
    console.error("Error archiving topic:", error);
    res.status(500).json({ message: "Failed to archive topic" });
  }
});

router.post('/topics/:topicId/restore', requireModerator, async (req, res) => {
  try {
    const { reason } = req.body;
    await moderationService.restoreTopic(req.params.topicId, req.user!.id, reason);
    res.json({ message: "Topic restored successfully" });
  } catch (error) {
    console.error("Error restoring topic:", error);
    res.status(500).json({ message: "Failed to restore topic" });
  }
});

// Banned phrases management
router.get('/banned-phrases', requireAdmin, async (req, res) => {
  try {
    const phrases = await moderationService.getBannedPhrases();
    res.json(phrases);
  } catch (error) {
    console.error("Error fetching banned phrases:", error);
    res.status(500).json({ message: "Failed to fetch banned phrases" });
  }
});

router.post('/banned-phrases', requireAdmin, async (req, res) => {
  try {
    const validatedData = insertBannedPhraseSchema.parse(req.body);
    const phrase = await moderationService.createBannedPhrase(validatedData);
    res.status(201).json(phrase);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    console.error("Error creating banned phrase:", error);
    res.status(500).json({ message: "Failed to create banned phrase" });
  }
});

router.delete('/banned-phrases/:id', requireAdmin, async (req, res) => {
  try {
    await moderationService.deleteBannedPhrase(req.params.id);
    res.json({ message: "Banned phrase deleted successfully" });
  } catch (error) {
    console.error("Error deleting banned phrase:", error);
    res.status(500).json({ message: "Failed to delete banned phrase" });
  }
});

// Admin user management
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await moderationService.getUsersForAdmin();
    res.json(users);
  } catch (error) {
    console.error("Error fetching admin users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

router.put('/users/:userId/role', requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!role || !['user', 'moderator', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Valid role is required' });
    }

    await moderationService.updateUserRole(req.params.userId, role, req.user!.id);
    res.json({ message: "User role updated successfully" });
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({ message: "Failed to update user role" });
  }
});

router.put('/users/:userId/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !['active', 'suspended', 'banned'].includes(status)) {
      return res.status(400).json({ error: 'Valid status is required' });
    }

    await moderationService.updateUserStatus(req.params.userId, status, req.user!.id);
    res.json({ message: "User status updated successfully" });
  } catch (error) {
    console.error("Error updating user status:", error);
    res.status(500).json({ message: "Failed to update user status" });
  }
});

router.delete('/users/:userId', requireAdmin, async (req, res) => {
  try {
    await moderationService.deleteUser(req.params.userId, req.user!.id);
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

// Admin topic management
router.get('/topics', requireAdmin, async (req, res) => {
  try {
    const topics = await moderationService.getTopicsForAdmin();
    res.json(topics);
  } catch (error) {
    console.error("Error fetching admin topics:", error);
    res.status(500).json({ message: "Failed to fetch topics" });
  }
});

// Admin opinion management
router.get('/opinions', requireAdmin, async (req, res) => {
  try {
    const opinions = await moderationService.getOpinionsForAdmin();
    res.json(opinions);
  } catch (error) {
    console.error("Error fetching admin opinions:", error);
    res.status(500).json({ message: "Failed to fetch opinions" });
  }
});

router.get('/flagged-opinions', requireModerator, async (req, res) => {
  try {
    const flaggedOpinions = await moderationService.getFlaggedOpinions();
    res.json(flaggedOpinions);
  } catch (error) {
    console.error("Error fetching flagged opinions:", error);
    res.status(500).json({ message: "Failed to fetch flagged opinions" });
  }
});

router.post('/opinions/:opinionId/approve', requireModerator, async (req, res) => {
  try {
    const { reason } = req.body;
    const user = req.user as Express.User;
    const userId = user?.id;
    await moderationService.approveOpinion(req.params.opinionId, userId, reason);
    res.json({ message: "Opinion approved" });
  } catch (error) {
    console.error("Error approving opinion:", error);
    res.status(500).json({ message: "Failed to approve opinion" });
  }
});

router.post('/opinions/:opinionId/hide', requireModerator, async (req, res) => {
  try {
    const { reason } = req.body;
    const user = req.user as Express.User;
    const userId = user?.id;
    await moderationService.hideOpinion(req.params.opinionId, userId, reason);
    res.json({ message: "Opinion hidden" });
  } catch (error) {
    console.error("Error hiding opinion:", error);
    res.status(500).json({ message: "Failed to hide opinion" });
  }
});

router.delete('/opinions/:opinionId', requireAdmin, async (req, res) => {
  try {
    const user = req.user as Express.User;
    const userId = user?.id;
    await moderationService.deleteOpinionAdmin(req.params.opinionId, userId);
    res.json({ message: "Opinion deleted successfully" });
  } catch (error) {
    console.error("Error deleting opinion:", error);
    res.status(500).json({ message: "Failed to delete opinion" });
  }
});

router.delete('/topics/:topicId', requireAdmin, async (req, res) => {
  try {
    await moderationService.deleteTopicAdmin(req.params.topicId, req.user!.id);
    res.json({ message: "Topic deleted successfully" });
  } catch (error) {
    console.error("Error deleting topic:", error);
    res.status(500).json({ message: "Failed to delete topic" });
  }
});

// Admin backfill routes
router.post('/backfill-embeddings', requireAdmin, async (req, res) => {
  try {
    const topicRepository = new TopicRepository();
    const topicsWithoutEmbeddings = await topicRepository.findWithoutEmbeddings();
    
    let updated = 0;
    let failed = 0;
    
    for (const topic of topicsWithoutEmbeddings) {
      try {
        // Generate embedding from topic title and description
        const textToEmbed = `${topic.title} ${topic.description || ''}`.trim();
        const embedding = await AIService.generateEmbedding(textToEmbed);
        
        // Update topic with embedding
        await topicRepository.updateEmbedding(topic.id, embedding);
        updated++;
        
        console.log(`[Backfill] Generated embedding for topic: ${topic.title}`);
      } catch (error) {
        console.error(`[Backfill] Error processing topic ${topic.id}:`, error);
        failed++;
      }
    }
    
    res.json({
      updated,
      failed,
      total: topicsWithoutEmbeddings.length
    });
  } catch (error) {
    console.error("Error backfilling embeddings:", error);
    res.status(500).json({ message: "Failed to backfill embeddings", error: error instanceof Error ? error.message : String(error) });
  }
});

// AI Summary generation trigger
router.post('/summaries/generate', requireAdmin, async (req, res) => {
  try {
    const result = await runAISummaryUpdate();
    res.json({
      success: true,
      generated: result.generated,
      refreshed: result.refreshed,
      skipped: result.skipped,
      errors: result.errors,
      message: `Summary generation completed: ${result.generated} generated, ${result.refreshed} refreshed, ${result.skipped} skipped`
    });
  } catch (error) {
    console.error('Error triggering AI summary generation:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to generate summaries'
    });
  }
});

router.post('/backfill-opinion-scores', requireAdmin, async (req, res) => {
  try {
    const { model = 'gpt-4o-mini' } = req.body;
    
    if (model !== 'gpt-4o-mini' && model !== 'gpt-5') {
      return res.status(400).json({ error: 'Invalid model. Must be "gpt-4o-mini" or "gpt-5"' });
    }
    
    const opinionRepository = new OpinionRepository();
    const topicRepository = new TopicRepository();
    const opinionsWithoutScores = await opinionRepository.findWithoutPoliticalScores();
    
    const totalOpinions = opinionsWithoutScores.length;
    
    // Start processing in background (return immediately)
    res.json({
      message: "Opinion score analysis started",
      totalOpinions,
      model
    });
    
    // Process opinions asynchronously
    (async () => {
      let processed = 0;
      let failed = 0;
      
      for (const opinion of opinionsWithoutScores) {
        try {
          // Get topic for context
          const topic = await topicRepository.findById(opinion.topicId);
          if (!topic) {
            console.error(`[Backfill] Topic not found for opinion ${opinion.id}`);
            failed++;
            continue;
          }
          
          // Analyze political stance
          const scores = await AIService.analyzeOpinionPoliticalStance(
            opinion.content,
            topic.title,
            model as 'gpt-4o-mini' | 'gpt-5'
          );
          
          // Update opinion with scores
          await opinionRepository.updatePoliticalScores(
            opinion.id,
            scores.economicScore,
            scores.authoritarianScore
          );
          
          processed++;
          
          if (processed % 10 === 0) {
            console.log(`[Backfill] Processed ${processed}/${totalOpinions} opinions`);
          }
        } catch (error) {
          console.error(`[Backfill] Error processing opinion ${opinion.id}:`, error);
          failed++;
        }
      }
      
      console.log(`[Backfill] Completed opinion score analysis: ${processed} processed, ${failed} failed`);
    })();
    
  } catch (error) {
    console.error("Error starting opinion score backfill:", error);
    res.status(500).json({ message: "Failed to start opinion score backfill", error: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
