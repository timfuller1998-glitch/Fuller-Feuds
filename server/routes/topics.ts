import { Router } from 'express';
import { TopicService } from '../services/topicService.js';
import { OpinionService } from '../services/opinionService.js';
import { InteractionRepository } from '../repositories/interactionRepository.js';
import { CumulativeOpinionService } from '../services/cumulativeOpinionService.js';
import { isAuthenticated, requireModerator, requireAdmin } from '../middleware/auth.js';
import { insertTopicSchema, insertOpinionSchema } from '../../shared/schema.js';
import { z } from 'zod';
import { UnauthorizedError, ForbiddenError, AuthorizationError, DataAccessError } from '../utils/securityErrors.js';

const router = Router();
const topicService = new TopicService();
const opinionService = new OpinionService();
const interactionRepository = new InteractionRepository();

// GET /api/topics - Get all topics with optional filters
router.get('/', async (req, res) => {
  try {
    const { limit, category, search, createdBy } = req.query;
    // Note: getTopics doesn't have security context parameters yet, but we still handle errors
    const topics = await topicService.getTopics({
      limit: limit ? parseInt(limit as string, 10) : undefined,
      category: category as string,
      search: search as string,
      createdBy: createdBy as string,
    });

    res.json(topics);
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof AuthorizationError || error instanceof DataAccessError) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error('Error fetching topics:', error);
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

// GET /api/topics/search-similar - Search for similar topics
router.get('/search-similar', async (req, res) => {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'topics.ts:35',message:'search-similar route entry',data:{query:req.query.query||req.query.q,limit:req.query.limit},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  try {
    // Accept both 'q' and 'query' for backwards compatibility
    const queryParam = (req.query.query || req.query.q) as string | undefined;
    const limit = req.query.limit;

    if (!queryParam || typeof queryParam !== 'string') {
      return res.status(400).json({ error: 'Query parameter (q or query) is required' });
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'topics.ts:45',message:'Calling topicService.searchTopics',data:{queryParam,limit},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion

    const topics = await topicService.searchTopics(queryParam, {
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'topics.ts:49',message:'searchTopics succeeded',data:{resultCount:topics?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion

    res.json(topics);
  } catch (error) {
    // #region agent log
    const errorData = error instanceof Error ? {message:error.message,code:(error as any).code,errno:(error as any).errno,syscall:(error as any).syscall,hostname:(error as any).hostname,stack:error.stack?.substring(0,200)} : {error:String(error)};
    fetch('http://127.0.0.1:7242/ingest/cc7b491d-1059-46da-b282-4faf14617785',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'topics.ts:51',message:'Error searching topics',data:errorData,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.error('Error searching topics:', error);
    res.status(500).json({ error: 'Failed to search topics' });
  }
});

// GET /api/topics/:id/political-distribution - Get topic political distribution
router.get('/:id/political-distribution', async (req, res) => {
  try {
    const cumulativeOpinionService = new CumulativeOpinionService();
    const cumulative = await cumulativeOpinionService.getCumulativeOpinion(req.params.id);
    
    if (cumulative && cumulative.politicalDistribution) {
      res.json(cumulative.politicalDistribution);
    } else {
      // Return zeros if no distribution data yet
      res.json({
        authoritarianCapitalist: 0,
        authoritarianSocialist: 0,
        libertarianCapitalist: 0,
        libertarianSocialist: 0,
      });
    }
  } catch (error) {
    console.error('Error fetching political distribution:', error);
    res.status(500).json({ error: 'Failed to fetch political distribution' });
  }
});

// GET /api/topics/:id/cumulative - Get AI cumulative opinion analysis
// NOTE: This must come BEFORE /:id route to avoid route conflicts
router.get('/:id/cumulative', async (req, res) => {
  try {
    const cumulativeOpinionService = new CumulativeOpinionService();
    const cumulative = await cumulativeOpinionService.getCumulativeOpinion(req.params.id);
    res.json(cumulative || null);
  } catch (error) {
    console.error('Error fetching cumulative opinion:', error);
    res.status(500).json({ error: 'Failed to fetch cumulative opinion' });
  }
});

// GET /api/topics/:id/opinions - Get opinions for a topic
// NOTE: This must come BEFORE /:id route to avoid route conflicts
router.get('/:id/opinions', async (req, res) => {
  try {
    // Get current user ID - support both local auth (req.user.id) and Replit auth (req.user.claims.sub)
    const user = req.user as Express.User;
    const requestingUserId = user?.id || (req.user as any)?.claims?.sub;
    const requestingUserRole = req.userRole;
    const opinions = await opinionService.getOpinionsByTopic(
      req.params.id,
      {
        userRole: requestingUserRole,
        currentUserId: requestingUserId,
      },
      requestingUserId,
      requestingUserRole,
      req
    );

    res.json(opinions);
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof AuthorizationError || error instanceof DataAccessError) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error('Error fetching opinions:', error);
    res.status(500).json({ error: 'Failed to fetch opinions' });
  }
});

// POST /api/topics/:id/opinions - Create new opinion on topic
// NOTE: This must come BEFORE /:id route to avoid route conflicts
router.post('/:id/opinions', isAuthenticated, async (req, res) => {
  try {
    // Ensure user is authenticated and has an id
    const user = req.user as Express.User;
    if (!user || !user.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const requestingUserId = user.id;
    const requestingUserRole = req.userRole;

    const validatedData = insertOpinionSchema.parse({
      ...req.body,
      topicId: req.params.id,
      userId: requestingUserId,
    });

    const opinion = await opinionService.createOpinion(
      validatedData,
      requestingUserId,
      requestingUserRole,
      req
    );
    res.status(201).json(opinion);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError || error instanceof AuthorizationError || error instanceof DataAccessError) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error('Error creating opinion:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: 'Failed to create opinion',
      message: errorMessage
    });
  }
});

// GET /api/topics/:id - Get single topic
router.get('/:id', async (req, res) => {
  try {
    const requestingUserId = (req.user as Express.User)?.id;
    const requestingUserRole = req.userRole;
    const topic = await topicService.getTopic(
      req.params.id,
      requestingUserId,
      requestingUserRole,
      req
    );

    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    res.json(topic);
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof AuthorizationError || error instanceof DataAccessError) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error('Error fetching topic:', error);
    res.status(500).json({ error: 'Failed to fetch topic' });
  }
});

// POST /api/topics/:id/swipe - Record swipe interaction (like/dislike)
router.post('/:id/swipe', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as Express.User;
    if (!user || !user.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { direction } = req.body;
    if (!direction || (direction !== 'left' && direction !== 'right')) {
      return res.status(400).json({ error: 'Direction must be "left" or "right"' });
    }

    const preference = direction === 'right' ? 'liked' : 'disliked';
    const interaction = await interactionRepository.recordSwipe(user.id, req.params.id, preference);

    res.json({ success: true, interaction });
  } catch (error) {
    console.error('Error recording swipe:', error);
    res.status(500).json({ error: 'Failed to record swipe' });
  }
});

// POST /api/topics/:id/view - Track topic view
router.post('/:id/view', isAuthenticated, async (req, res) => {
  try {
    const user = req.user as Express.User;
    if (!user || !user.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    await interactionRepository.markAsSeen(user.id, req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking topic view:', error);
    res.status(500).json({ error: 'Failed to track view' });
  }
});

// POST /api/topics/generate-categories - Generate categories for topic
router.post('/generate-categories', isAuthenticated, async (req, res) => {
  try {
    const { title } = req.body;

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Title is required' });
    }

    // This would typically be handled by TopicService
    // For now, return placeholder
    res.json({ categories: ['Politics', 'Society', 'General'] });
  } catch (error) {
    console.error('Error generating categories:', error);
    res.status(500).json({ error: 'Failed to generate categories' });
  }
});

// POST /api/topics - Create new topic
router.post('/', isAuthenticated, async (req, res) => {
  try {
    // Ensure user is authenticated and has an id
    const user = req.user as Express.User;
    if (!user || !user.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const requestingUserId = user.id;
    const requestingUserRole = req.userRole;

    const validatedData = insertTopicSchema.parse(req.body);
    
    // Extract opinion-related fields before passing to service
    // These fields are not part of the topics table schema
    const { initialOpinion, references, stance, isActive, status, ...topicData } = validatedData;
    
    // Build topic data, filtering out null values and converting them to undefined
    const topicDataForService = {
      ...topicData,
      ...(isActive !== null && isActive !== undefined && { isActive: isActive as boolean }),
      ...(status !== null && status !== undefined && { status: status as string }),
      initialOpinion,
      references,
      stance, // Pass through but will be ignored
    };
    
    const topic = await topicService.createTopic(
      topicDataForService,
      requestingUserId,
      requestingUserId,
      requestingUserRole,
      req
    );

    res.status(201).json(topic);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError || error instanceof AuthorizationError || error instanceof DataAccessError) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error('Error creating topic:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    res.status(500).json({ 
      error: 'Failed to create topic',
      message: errorMessage,
      ...(errorStack && { stack: errorStack })
    });
  }
});

// DELETE /api/topics/:id - Delete topic (soft delete)
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    await topicService.deleteTopic(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting topic:', error);
    res.status(500).json({ error: 'Failed to delete topic' });
  }
});

// POST /api/topics/:id/flag - Flag topic
router.post('/:id/flag', isAuthenticated, async (req, res) => {
  try {
    // TODO: Implement topic flagging
    res.json({ success: true });
  } catch (error) {
    console.error('Error flagging topic:', error);
    res.status(500).json({ error: 'Failed to flag topic' });
  }
});

// Admin routes
router.post('/admin/:id/hide', requireModerator, async (req, res) => {
  try {
    // TODO: Implement topic hiding
    res.json({ success: true });
  } catch (error) {
    console.error('Error hiding topic:', error);
    res.status(500).json({ error: 'Failed to hide topic' });
  }
});

router.post('/admin/:id/archive', requireModerator, async (req, res) => {
  try {
    // TODO: Implement topic archiving
    res.json({ success: true });
  } catch (error) {
    console.error('Error archiving topic:', error);
    res.status(500).json({ error: 'Failed to archive topic' });
  }
});

router.post('/admin/:id/restore', requireModerator, async (req, res) => {
  try {
    // TODO: Implement topic restoration
    res.json({ success: true });
  } catch (error) {
    console.error('Error restoring topic:', error);
    res.status(500).json({ error: 'Failed to restore topic' });
  }
});

export default router;
