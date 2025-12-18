import { randomUUID } from 'crypto';
import { eq, desc } from 'drizzle-orm';
import { RedditScraper } from '../scrapers/redditScraper.js';
import { ContentTransformer, type TransformedOpinion } from './contentTransformer.js';
import { TopicService } from './topicService.js';
import { OpinionService } from './opinionService.js';
import { UserRepository } from '../repositories/userRepository.js';
import { TopicRepository } from '../repositories/topicRepository.js';
import { AIService } from '../aiService.js';
import { db } from '../db.js';
import { seedingJobs } from '@shared/schema';
import type { Topic, User } from '@shared/schema';

export interface SeedingResult {
  jobId: string;
  topicsCreated: number;
  topicsReused: number;
  usersCreated: number;
  opinionsCreated: number;
  errors: string[];
}

export class ScrapingService {
  private topicService: TopicService;
  private opinionService: OpinionService;
  private userRepository: UserRepository;
  private topicRepository: TopicRepository;
  private authorToUserIdCache: Map<string, string> = new Map();

  constructor() {
    this.topicService = new TopicService();
    this.opinionService = new OpinionService();
    this.userRepository = new UserRepository();
    this.topicRepository = new TopicRepository();
  }

  async importFromReddit(
    subreddit: string,
    postLimit: number,
    opinionsPerPost: number,
    adminUserId: string
  ): Promise<SeedingResult> {
    // Reset cache for new import
    this.authorToUserIdCache.clear();

    const scraper = new RedditScraper();
    const errors: string[] = [];
    let topicsCreated = 0;
    let topicsReused = 0;
    let usersCreated = 0;
    let opinionsCreated = 0;

    // Create job record
    const [job] = await db.insert(seedingJobs).values({
      source: 'reddit',
      sourceConfig: { subreddit, postLimit, opinionsPerPost } as any,
      status: 'running',
      createdById: adminUserId,
    }).returning();

    try {
      // Scrape Reddit
      const debates = await scraper.scrapeSubreddit(subreddit, postLimit, opinionsPerPost);

      for (const debate of debates) {
        try {
          // Extract neutral topic
          const neutralTopic = await ContentTransformer.extractNeutralTopic(debate.post.title);
          
          // Find or create topic
          const { topic, isNew } = await this.findOrCreateTopic(neutralTopic, adminUserId);
          
          if (isNew) {
            topicsCreated++;
          } else {
            topicsReused++;
          }

          // Assign emotional intensities
          const intensities = ContentTransformer.assignIntensities(debate.comments.length);

          // Transform and create opinions
          for (let i = 0; i < debate.comments.length; i++) {
            const comment = debate.comments[i];
            const intensity = intensities[i];

            try {
              // Transform comment to debate argument
              const transformed = await ContentTransformer.transformToDebateArgument(
                comment.body,
                neutralTopic,
                intensity
              );

              // Get or create synthetic user
              const userId = await this.getOrCreateSyntheticUser(comment.author);

              // Create opinion
              await this.opinionService.createOpinion({
                topicId: topic.id,
                userId,
                content: transformed.content,
                status: 'approved',
                debateStatus: 'open',
                references: debate.post.permalink ? [`https://reddit.com${debate.post.permalink}`] : [],
              });

              opinionsCreated++;
            } catch (error) {
              const errorMsg = `Error processing comment from ${comment.author}: ${error instanceof Error ? error.message : 'Unknown error'}`;
              console.error(errorMsg, error);
              errors.push(errorMsg);
            }
          }
        } catch (error) {
          const errorMsg = `Error processing post "${debate.post.title}": ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMsg, error);
          errors.push(errorMsg);
        }
      }

      // Update job record
      await db.update(seedingJobs)
        .set({
          status: 'completed',
          topicsCreated,
          topicsReused,
          usersCreated: this.authorToUserIdCache.size,
          opinionsCreated,
          errorMessage: errors.length > 0 ? errors.join('\n') : undefined,
        })
        .where(eq(seedingJobs.id, job.id));

      return {
        jobId: job.id,
        topicsCreated,
        topicsReused,
        usersCreated: this.authorToUserIdCache.size,
        opinionsCreated,
        errors,
      };
    } catch (error) {
      // Update job with error
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await db.update(seedingJobs)
        .set({
          status: 'completed',
          errorMessage: errorMsg,
        })
        .where(eq(seedingJobs.id, job.id));

      throw error;
    }
  }

  private async findOrCreateTopic(neutralTitle: string, adminUserId: string): Promise<{ topic: Topic; isNew: boolean }> {
    // Generate embedding for semantic search
    const embedding = await AIService.generateEmbedding(neutralTitle);
    
    // Search existing topics with 0.85 similarity threshold
    const similar = await this.topicRepository.findSimilarByEmbedding(embedding, 0.85);
    
    if (similar.length > 0) {
      return { topic: similar[0], isNew: false };
    }
    
    // Create new topic
    const topic = await this.topicService.createTopic({
      title: neutralTitle,
      description: `Debate topic: ${neutralTitle}`,
    }, adminUserId);
    
    // Generate and store embedding for future matching
    try {
      await this.topicRepository.updateEmbedding(topic.id, embedding);
    } catch (error) {
      console.error('Error updating topic embedding:', error);
    }
    
    return { topic, isNew: true };
  }

  private async getOrCreateSyntheticUser(authorName: string): Promise<string> {
    // Check cache first
    if (this.authorToUserIdCache.has(authorName)) {
      return this.authorToUserIdCache.get(authorName)!;
    }

    // Generate name from username
    const { firstName, lastName } = ContentTransformer.generateNameFromUsername(authorName);

    // Create synthetic user
    const userId = randomUUID();
    const email = `${userId.slice(0, 8)}@synthetic.fullerfeud`;
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(authorName)}`;

    await this.userRepository.create({
      id: userId,
      email,
      firstName,
      lastName,
      profileImageUrl: avatarUrl,
      role: 'user',
      status: 'active',
      isSynthetic: true,
      onboardingComplete: true,
    });

    // Cache for this batch
    this.authorToUserIdCache.set(authorName, userId);
    return userId;
  }

  async generateOpinionsForTopic(
    topicTitle: string,
    opinionCount: number,
    adminUserId: string
  ): Promise<SeedingResult> {
    // Reset cache for new generation
    this.authorToUserIdCache.clear();

    const errors: string[] = [];
    let topicsCreated = 0;
    let topicsReused = 0;
    let opinionsCreated = 0;

    // Create job record
    const [job] = await db.insert(seedingJobs).values({
      source: 'ai_generate',
      sourceConfig: { topicTitle, opinionCount } as any,
      status: 'running',
      createdById: adminUserId,
    }).returning();

    try {
      // Find or create topic
      const { topic, isNew } = await this.findOrCreateTopic(topicTitle, adminUserId);
      
      if (isNew) {
        topicsCreated++;
      } else {
        topicsReused++;
      }

      // Generate opinions using AI
      const generatedOpinions = await ContentTransformer.generateOpinions(topicTitle, opinionCount);

      // Create synthetic users and opinions
      for (const opinion of generatedOpinions) {
        try {
          // Parse author name (could be "First Last" or just "First")
          const nameParts = opinion.authorName.trim().split(' ');
          const firstName = nameParts[0] || 'Alex';
          const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

          // Get or create synthetic user
          const userId = await this.getOrCreateSyntheticUserFromName(firstName, lastName);

          // Create opinion
          await this.opinionService.createOpinion({
            topicId: topic.id,
            userId,
            content: opinion.content,
            status: 'approved',
            debateStatus: 'open',
          });

          opinionsCreated++;
        } catch (error) {
          const errorMsg = `Error creating opinion: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMsg, error);
          errors.push(errorMsg);
        }
      }

      // Update job record
      await db.update(seedingJobs)
        .set({
          status: 'completed',
          topicsCreated,
          topicsReused: topicsReused || 0,
          usersCreated: this.authorToUserIdCache.size,
          opinionsCreated,
          errorMessage: errors.length > 0 ? errors.join('\n') : undefined,
        })
        .where(eq(seedingJobs.id, job.id));

      return {
        jobId: job.id,
        topicsCreated,
        topicsReused,
        usersCreated: this.authorToUserIdCache.size,
        opinionsCreated,
        errors,
      };
    } catch (error) {
      // Update job with error
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await db.update(seedingJobs)
        .set({
          status: 'completed',
          errorMessage: errorMsg,
        })
        .where(eq(seedingJobs.id, job.id));

      throw error;
    }
  }

  private async getOrCreateSyntheticUserFromName(firstName: string, lastName: string | null): Promise<string> {
    // Create a unique key for caching
    const cacheKey = `${firstName}_${lastName || ''}`;
    
    // Check cache first
    if (this.authorToUserIdCache.has(cacheKey)) {
      return this.authorToUserIdCache.get(cacheKey)!;
    }

    // Create synthetic user
    const userId = randomUUID();
    const email = `${userId.slice(0, 8)}@synthetic.fullerfeud`;
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cacheKey)}`;

    await this.userRepository.create({
      id: userId,
      email,
      firstName,
      lastName,
      profileImageUrl: avatarUrl,
      role: 'user',
      status: 'active',
      isSynthetic: true,
      onboardingComplete: true,
    });

    // Cache for this batch
    this.authorToUserIdCache.set(cacheKey, userId);
    return userId;
  }

  async getSeedingJobs(limit: number = 50) {
    return await db
      .select()
      .from(seedingJobs)
      .orderBy(desc(seedingJobs.createdAt))
      .limit(limit);
  }
}

