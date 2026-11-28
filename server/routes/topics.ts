import { Router } from 'express';
import { TopicService } from '../services/topicService.js';
import { OpinionService } from '../services/opinionService.js';
import { InteractionRepository } from '../repositories/interactionRepository.js';
import { CumulativeOpinionService } from '../services/cumulativeOpinionService.js';
import { AIService } from '../aiService.js';
import { previewSource, UnsafeUrlError, assertPublicHttpUrl } from '../services/sourcePreviewService.js';
import { aggregateTopicResources, normalizeHttpUrl, resourceDomain } from '../../shared/topicResources.js';
import { db } from '../db.js';
import { feedbackRequests } from '../../shared/schema.js';
import { isAuthenticated, requireModerator, requireAdmin } from '../middleware/auth.js';
import { insertTopicSchema, insertOpinionSchema } from '../../shared/schema.js';
import { buildMapTree, buildSyntheticTopics, countByGroup, findSplitCandidates, MAJOR_CATEGORIES, subsOf, type MapTopicRef } from '../../shared/topicTaxonomy.js';
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
  try {
    // Accept both 'q' and 'query' for backwards compatibility
    const queryParam = (req.query.query || req.query.q) as string | undefined;
    const limit = req.query.limit;

    if (!queryParam || typeof queryParam !== 'string') {
      return res.status(400).json({ error: 'Query parameter (q or query) is required' });
    }

    const topics = await topicService.searchTopics(queryParam, {
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.json(topics);
  } catch (error) {
    console.error('Error searching topics:', error);
    res.status(500).json({ error: 'Failed to search topics' });
  }
});


// Compact topic rows for the map (active topics only; the 2-minute topic list cache already applies).
async function loadMapTopics(): Promise<MapTopicRef[]> {
  const topics = await topicService.getTopics({ limit: 2000 });
  return (topics || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    description: t.description ?? null,
    categories: Array.isArray(t.categories) ? t.categories : [],
    homeMajor: t.homeMajor ?? null,
    homeSub: t.homeSub ?? null,
  }));
}

// A sub over ~20 topics is only logged for a person to split (names are never invented automatically). At most once per 10 minutes.
let lastSplitLog = 0;
function logSplitCandidates(c?: { majorName: string; subName: string; count: number }[]) {
  if (!c?.length || Date.now() - lastSplitLog < 10 * 60 * 1000) return;
  lastSplitLog = Date.now();
  console.warn('[topics map] groups to consider splitting: ' + c.map((x) => `${x.majorName} / ${x.subName} (${x.count})`).join(', '));
}

// GET /api/topics/groups - Official groups with live topic counts (for pickers, Search tabs, the sidebar and admin Move)
router.get('/groups', async (_req, res) => {
  try {
    const { byMajor, bySub } = countByGroup(await loadMapTopics());
    const splits = findSplitCandidates(bySub);
    res.json({
      majors: MAJOR_CATEGORIES.map((m) => ({
        id: m.id,
        name: m.name,
        count: byMajor[m.id] || 0,
        subs: subsOf(m.id).map((s) => ({ id: s.id, name: s.name, count: bySub[`${m.id}/${s.id}`] || 0 })),
      })),
      splitCandidates: splits,
    });
  } catch (error) {
    console.error('Error building topic groups:', error);
    res.status(500).json({ error: 'Failed to load topic groups' });
  }
});

// GET /api/topics/map - Public radial-map tree (signed-out visitors welcome)
router.get('/map', async (req, res) => {
  try {
    const wantSynthetic = req.query.synthetic === '1';
    if (wantSynthetic && process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Synthetic map trees are not available in production' });
    }
    if (wantSynthetic) {
      const count = Math.min(800, Math.max(50, parseInt(String(req.query.count || '420'), 10) || 420));
      return res.json(buildMapTree(buildSyntheticTopics(count)));
    }
    const compact = await loadMapTopics();
    const tree = buildMapTree(compact);
    logSplitCandidates(tree.splitCandidates);
    res.json(tree);
  } catch (error) {
    console.error('Error building topics map:', error);
    res.status(500).json({ error: 'Failed to build topics map' });
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

// GET /api/topics/:id/resources - Ranked reference links cited in this topic's opinions.
router.get('/:id/resources', async (req, res) => {
  try {
    const requestingUserId = (req.user as Express.User)?.id;
    const requestingUserRole = req.userRole;
    const topic = await topicService.getTopic(req.params.id, requestingUserId, requestingUserRole, req);
    const isStaff = requestingUserRole === 'admin' || requestingUserRole === 'moderator';
    if (!topic || ((topic as any).status === 'hidden' && !isStaff)) {
      return res.status(404).json({ error: 'Topic not found' });
    }
    const opinions = await opinionService.getOpinionsByTopic(
      req.params.id,
      { userRole: requestingUserRole, currentUserId: requestingUserId },
      requestingUserId,
      requestingUserRole,
      req,
    );
    res.json({ items: aggregateTopicResources(opinions || []).slice(0, 40) });
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof AuthorizationError || error instanceof DataAccessError) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    console.error('Error listing topic resources:', error);
    res.status(500).json({ error: 'Failed to load resources' });
  }
});

// POST /api/topics/:id/resources/report - Report a bad link; it shows up in admin Requests.
router.post('/:id/resources/report', isAuthenticated, async (req, res) => {
  try {
    const requestingUserId = (req.user as Express.User)?.id;
    if (!requestingUserId) return res.status(401).json({ error: 'Sign in to report a link' });
    const requestingUserRole = req.userRole;
    const topic = await topicService.getTopic(req.params.id, requestingUserId, requestingUserRole, req);
    const isStaff = requestingUserRole === 'admin' || requestingUserRole === 'moderator';
    if (!topic || ((topic as any).status === 'hidden' && !isStaff)) {
      return res.status(404).json({ error: 'Topic not found' });
    }
    const url = normalizeHttpUrl(String(req.body?.url || ''));
    if (!url) return res.status(400).json({ error: 'That link is not allowed.' });
    try {
      await assertPublicHttpUrl(url);
    } catch (error) {
      if (error instanceof UnsafeUrlError) return res.status(400).json({ error: error.message });
      throw error;
    }
    const reason = String(req.body?.reason || '').trim().slice(0, 2000);
    await db.insert(feedbackRequests).values({
      userId: requestingUserId,
      type: 'bug',
      title: `Reported link: ${resourceDomain(url)}`.slice(0, 140),
      description: `A link on "${topic.title}" was reported.\n\nURL: ${url}\nTopic: https://www.fullerfeuds.com/topic/${topic.id}\n\nReason:\n${reason || '(none given)'}`,
      pageUrl: url,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 500) || null,
    });
    res.status(201).json({ ok: true });
  } catch (error) {
    console.error('Error reporting topic resource:', error);
    res.status(500).json({ error: 'Could not send the report' });
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

    // Deleted topics (admin delete sets status 'hidden') are not found, except for moderators/admins.
    const isStaff = requestingUserRole === 'admin' || requestingUserRole === 'moderator';
    if (!topic || ((topic as any).status === 'hidden' && !isStaff)) {
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

// POST /api/topics/preview-source - Fetch a public link and draft a neutral title/description
router.post('/preview-source', isAuthenticated, async (req, res) => {
  try {
    const url = typeof req.body?.url === 'string' ? req.body.url : '';
    if (!url.trim()) return res.status(400).json({ error: 'A URL is required' });
    const preview = await previewSource(url);
    res.json(preview);
  } catch (error: any) {
    if (error instanceof UnsafeUrlError || error?.status === 400) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error previewing source:', error);
    res.status(500).json({
      error: "Couldn't load that link. You can still add it and write the title yourself.",
    });
  }
});

// POST /api/topics/generate-categories - Generate categories for topic
router.post('/generate-categories', isAuthenticated, async (req, res) => {
  try {
    const { title } = req.body;

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Title is required' });
    }

    const description = typeof req.body.description === 'string' ? req.body.description : undefined;
    const tags = Array.isArray(req.body.categories) ? req.body.categories.filter((c: unknown) => typeof c === 'string').slice(0, 5) : [];
    // The suggested official home plus a few optional extra tags. `categories` is kept so older clients keep working.
    const suggestion = await AIService.suggestTopicHome(title.trim(), description, tags);
    res.json({
      categories: suggestion.tags,
      home: { homeMajor: suggestion.majorId, homeSub: suggestion.subId, source: suggestion.source },
    });
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
