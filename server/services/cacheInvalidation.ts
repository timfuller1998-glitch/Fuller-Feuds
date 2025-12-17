import { invalidatePattern, deleteCache, cacheKey } from './cacheService';

/**
 * Cache invalidation helpers for different entity types
 */

/**
 * Invalidate all caches related to a topic
 */
export async function invalidateTopicCache(topicId: string): Promise<void> {
  await Promise.all([
    invalidatePattern(`topic:${topicId}:*`),
    invalidatePattern('topics:list:*'),
    invalidatePattern('topics:search:*'),
    invalidatePattern('topics:category:*'),
    deleteCache('stats:platform'),
  ]);
}

/**
 * Invalidate all caches related to topics list
 */
export async function invalidateTopicsListCache(): Promise<void> {
  await Promise.all([
    invalidatePattern('topics:list:*'),
    invalidatePattern('topics:search:*'),
    invalidatePattern('topics:category:*'),
    deleteCache('stats:platform'),
  ]);
}

/**
 * Invalidate all caches related to an opinion
 */
export async function invalidateOpinionCache(opinionId: string, topicId?: string): Promise<void> {
  const promises: Promise<void>[] = [
    deleteCache(`opinion:${opinionId}`),
    invalidatePattern(`opinion:${opinionId}:*`),
    invalidatePattern('opinions:recent:*'),
    deleteCache('stats:platform'),
  ];

  if (topicId) {
    promises.push(
      invalidatePattern(`topic:${topicId}:opinions:*`),
      deleteCache(`topic:${topicId}:political-dist`),
      deleteCache(`topic:${topicId}:full`),
    );
  }

  await Promise.all(promises);
}

/**
 * Invalidate all caches related to a user
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  await Promise.all([
    invalidatePattern(`user:${userId}:*`),
    deleteCache('users:active-distribution'),
  ]);
}

/**
 * Invalidate user badges cache
 */
export async function invalidateUserBadgesCache(userId: string): Promise<void> {
  await deleteCache(`user:${userId}:badges`);
}

/**
 * Invalidate user debate stats cache
 */
export async function invalidateUserDebateStatsCache(userId: string): Promise<void> {
  await deleteCache(`user:${userId}:debate-stats`);
}

/**
 * Invalidate vote-related caches
 */
export async function invalidateVoteCache(opinionId: string, userId: string): Promise<void> {
  await Promise.all([
    deleteCache(`opinion:${opinionId}:vote:${userId}`),
    deleteCache(`opinion:${opinionId}`),
  ]);
}

/**
 * Invalidate analytics caches
 */
export async function invalidateAnalyticsCache(): Promise<void> {
  await Promise.all([
    deleteCache('stats:platform'),
    invalidatePattern('analytics:political-dist:*'),
    deleteCache('users:active-distribution'),
  ]);
}

/**
 * Invalidate search caches
 */
export async function invalidateSearchCache(): Promise<void> {
  await invalidatePattern('search:*');
}

/**
 * Invalidate category caches
 */
export async function invalidateCategoryCache(category?: string): Promise<void> {
  if (category) {
    await invalidatePattern(`topics:category:${category}:*`);
  } else {
    await invalidatePattern('topics:category:*');
  }
}
