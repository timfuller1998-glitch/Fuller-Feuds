import { Router } from 'express';
import { requireAdmin } from '../middleware/auth';
import { ScrapingService } from '../services/scrapingService';
import { RedditScraper } from '../scrapers/redditScraper';
import { ContentTransformer } from '../services/contentTransformer';
import { TopicRepository } from '../repositories/topicRepository';
import { AIService } from '../aiService';

const router = Router();
const scrapingService = new ScrapingService();
const topicRepository = new TopicRepository();

// Get available sources
router.get('/sources', requireAdmin, async (req, res) => {
  try {
    res.json({
      sources: [
        {
          id: 'reddit',
          name: 'Reddit',
          subreddits: [
            { id: 'changemyview', name: 'r/changemyview', description: 'High quality structured debates' },
            { id: 'unpopularopinion', name: 'r/unpopularopinion', description: 'Controversial takes' },
            { id: 'TrueOffMyChest', name: 'r/TrueOffMyChest', description: 'Personal perspectives' },
            { id: 'AmItheAsshole', name: 'r/AmItheAsshole', description: 'Moral dilemmas' },
          ],
        },
      ],
    });
  } catch (error) {
    console.error('Error fetching sources:', error);
    res.status(500).json({ error: 'Failed to fetch sources' });
  }
});

// Preview transformation (dry run)
router.post('/preview', requireAdmin, async (req, res) => {
  try {
    const { source, config } = req.body;

    if (source !== 'reddit') {
      return res.status(400).json({ error: 'Only Reddit source is supported' });
    }

    const { subreddit, postLimit = 2, opinionsPerPost = 3 } = config;

    const scraper = new RedditScraper();
    const debates = await scraper.scrapeSubreddit(subreddit, postLimit, opinionsPerPost);

    const previewPosts = [];

    for (const debate of debates.slice(0, 2)) {
      // Extract neutral topic
      const neutralTopic = await ContentTransformer.extractNeutralTopic(debate.post.title);

      // Check if topic exists
      let matchedExistingTopic: string | null = null;
      try {
        const embedding = await AIService.generateEmbedding(neutralTopic);
        const similar = await topicRepository.findSimilarByEmbedding(embedding, 0.85);
        if (similar.length > 0) {
          matchedExistingTopic = similar[0].title;
        }
      } catch (error) {
        console.error('Error checking topic match:', error);
      }

      // Transform sample opinions
      const sampleOpinions = [];
      const intensities = ContentTransformer.assignIntensities(Math.min(debate.comments.length, 3));

      for (let i = 0; i < Math.min(debate.comments.length, 3); i++) {
        const comment = debate.comments[i];
        const intensity = intensities[i];

        try {
          const transformed = await ContentTransformer.transformToDebateArgument(
            comment.body,
            neutralTopic,
            intensity
          );

          sampleOpinions.push({
            original: comment.body.substring(0, 200) + (comment.body.length > 200 ? '...' : ''),
            transformed: transformed.content.substring(0, 300) + (transformed.content.length > 300 ? '...' : ''),
            stance: transformed.stance,
            intensity,
          });
        } catch (error) {
          console.error('Error transforming opinion:', error);
        }
      }

      previewPosts.push({
        originalTitle: debate.post.title,
        neutralTopic,
        matchedExistingTopic,
        sampleOpinions,
      });
    }

    // Estimate API calls and cost
    const estimatedApiCalls = postLimit * (1 + opinionsPerPost); // 1 topic extraction + N opinion transformations
    const estimatedCost = `~$${(estimatedApiCalls * 0.0005).toFixed(2)}`; // Rough estimate

    res.json({
      posts: previewPosts,
      estimatedApiCalls,
      estimatedCost,
    });
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Preview failed' 
    });
  }
});

// Execute import
router.post('/import', requireAdmin, async (req, res) => {
  try {
    const { source, config } = req.body;
    const adminUserId = (req.user as any)?.claims?.sub || (req.user as any)?.id;

    if (source !== 'reddit') {
      return res.status(400).json({ error: 'Only Reddit source is supported' });
    }

    const { subreddit, postLimit = 10, opinionsPerPost = 10 } = config;

    if (!subreddit || postLimit < 1 || postLimit > 50 || opinionsPerPost < 1 || opinionsPerPost > 10) {
      return res.status(400).json({ error: 'Invalid configuration' });
    }

    const result = await scrapingService.importFromReddit(
      subreddit,
      postLimit,
      opinionsPerPost,
      adminUserId
    );

    res.json(result);
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Import failed' 
    });
  }
});

// Generate opinions for a topic using AI
router.post('/generate', requireAdmin, async (req, res) => {
  try {
    const { topicTitle, opinionCount } = req.body;
    const adminUserId = (req.user as any)?.claims?.sub || (req.user as any)?.id;

    if (!topicTitle || typeof topicTitle !== 'string' || topicTitle.trim().length === 0) {
      return res.status(400).json({ error: 'Topic title is required' });
    }

    if (!opinionCount || typeof opinionCount !== 'number' || opinionCount < 1 || opinionCount > 50) {
      return res.status(400).json({ error: 'Opinion count must be between 1 and 50' });
    }

    const result = await scrapingService.generateOpinionsForTopic(
      topicTitle.trim(),
      opinionCount,
      adminUserId
    );

    res.json(result);
  } catch (error) {
    console.error('Generate error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Generation failed' 
    });
  }
});

// Get seeding jobs history
router.get('/jobs', requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const jobs = await scrapingService.getSeedingJobs(limit);
    res.json(jobs);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

export default router;

