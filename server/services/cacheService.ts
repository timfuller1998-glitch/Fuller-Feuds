import memoize from 'memoizee';
import { createHash } from 'crypto';

// TTL Constants (in seconds)
export const CACHE_TTL = {
  SHORT: 60,        // 1 minute - search, recent data
  MEDIUM: 120,      // 2 minutes - lists, user data
  LONG: 300,        // 5 minutes - analytics, computed stats
  TOPIC_FULL: 180,  // 3 minutes - full topic data
} as const;

// Redis client (optional - graceful fallback if unavailable)
let redisClient: any = null;
let redisAvailable = false;

// Try to initialize Redis if available
try {
  // Check if redis is available in environment
  if (process.env.REDIS_URL || process.env.REDIS_HOST) {
    // Dynamic import to avoid errors if redis is not installed
    // @ts-ignore - redis is optional dependency
    import('redis').then((redis: any) => {
      const client = redis.createClient({
        url: process.env.REDIS_URL,
        socket: {
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
        },
      });
      
      client.on('error', (err: Error) => {
        console.warn('[Cache] Redis connection error:', err);
        redisAvailable = false;
      });
      
      client.connect().then(() => {
        redisClient = client;
        redisAvailable = true;
        console.log('[Cache] Redis connected successfully');
      }).catch((err: Error) => {
        console.warn('[Cache] Redis connection failed, using in-memory cache only:', err);
        redisAvailable = false;
      });
    }).catch(() => {
      console.log('[Cache] Redis not installed, using in-memory cache only');
    });
  }
} catch (error: unknown) {
  console.log('[Cache] Redis not available, using in-memory cache only');
}

// In-memory cache store for pattern-based invalidation
const memoryCacheStore = new Map<string, { data: any; expires: number }>();
const cacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  invalidations: 0,
};

/**
 * Generate a cache key from parts
 */
export function cacheKey(...parts: (string | number | undefined | null)[]): string {
  const validParts = parts
    .filter(p => p !== undefined && p !== null)
    .map(p => String(p).replace(/:/g, '_'));
  return validParts.join(':');
}

/**
 * Generate a hash-based cache key for complex objects
 */
export function cacheKeyHash(prefix: string, obj: any): string {
  const hash = createHash('md5').update(JSON.stringify(obj)).digest('hex');
  return `${prefix}:${hash}`;
}

/**
 * Get value from cache (checks both Redis and in-memory)
 */
export async function getCache<T>(key: string): Promise<T | null> {
  // Try Redis first if available
  if (redisAvailable && redisClient) {
    try {
      const value = await redisClient.get(key);
      if (value) {
        cacheStats.hits++;
        return JSON.parse(value) as T;
      }
    } catch (error) {
      console.warn(`[Cache] Redis get error for key ${key}:`, error);
    }
  }

  // Fallback to in-memory cache
  const cached = memoryCacheStore.get(key);
  if (cached && cached.expires > Date.now()) {
    cacheStats.hits++;
    return cached.data as T;
  }

  // Clean up expired entry
  if (cached) {
    memoryCacheStore.delete(key);
  }

  cacheStats.misses++;
  return null;
}

/**
 * Set value in cache (stores in both Redis and in-memory)
 */
export async function setCache(key: string, value: any, ttlSeconds: number = CACHE_TTL.MEDIUM): Promise<void> {
  const expires = Date.now() + (ttlSeconds * 1000);

  // Store in Redis if available
  if (redisAvailable && redisClient) {
    try {
      await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
      cacheStats.sets++;
    } catch (error) {
      console.warn(`[Cache] Redis set error for key ${key}:`, error);
    }
  }

  // Also store in-memory for fast access
  memoryCacheStore.set(key, { data: value, expires });
  cacheStats.sets++;
}

/**
 * Delete a specific cache key
 */
export async function deleteCache(key: string): Promise<void> {
  // Delete from Redis
  if (redisAvailable && redisClient) {
    try {
      await redisClient.del(key);
    } catch (error) {
      console.warn(`[Cache] Redis delete error for key ${key}:`, error);
    }
  }

  // Delete from in-memory
  memoryCacheStore.delete(key);
  cacheStats.invalidations++;
}

/**
 * Invalidate all cache keys matching a pattern
 * Note: Redis pattern matching requires SCAN, in-memory uses simple prefix matching
 */
export async function invalidatePattern(pattern: string): Promise<void> {
  const keysToDelete: string[] = [];

  // For Redis, use pattern matching
  if (redisAvailable && redisClient) {
    try {
      // Convert pattern to Redis pattern (simple prefix matching)
      const redisPattern = pattern.replace('*', '*');
      const keys = await redisClient.keys(redisPattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
        keysToDelete.push(...keys);
      }
    } catch (error) {
      console.warn(`[Cache] Redis pattern invalidation error for ${pattern}:`, error);
    }
  }

  // For in-memory, use prefix matching
  const prefix = pattern.replace('*', '');
  for (const key of memoryCacheStore.keys()) {
    if (key.startsWith(prefix)) {
      memoryCacheStore.delete(key);
      keysToDelete.push(key);
    }
  }

  cacheStats.invalidations += keysToDelete.length;
  if (keysToDelete.length > 0) {
    console.log(`[Cache] Invalidated ${keysToDelete.length} keys matching pattern: ${pattern}`);
  }
}

/**
 * Clear all cache
 */
export async function clearAllCache(): Promise<void> {
  if (redisAvailable && redisClient) {
    try {
      await redisClient.flushDb();
    } catch (error) {
      console.warn('[Cache] Redis flush error:', error);
    }
  }
  memoryCacheStore.clear();
  cacheStats.invalidations++;
  console.log('[Cache] All cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    ...cacheStats,
    memorySize: memoryCacheStore.size,
    hitRate: cacheStats.hits + cacheStats.misses > 0
      ? (cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100
      : 0,
  };
}

/**
 * Create a memoized function with cache support
 */
export function memoizeWithCache<T extends (...args: any[]) => any>(
  fn: T,
  options: {
    keyPrefix: string;
    ttl?: number;
    maxAge?: number;
    max?: number;
  }
): T {
  const { keyPrefix, ttl = CACHE_TTL.MEDIUM, maxAge, max } = options;

  // Create memoized function
  const memoized = memoize(async (...args: any[]) => {
    const result = await fn(...args);
    return result;
  }, {
    maxAge: (maxAge || ttl) * 1000,
    max,
    promise: true,
  });

  // Wrap to also use cache service
  return (async (...args: any[]) => {
    const cacheKey = cacheKeyHash(keyPrefix, args);
    const cached = await getCache(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const result = await memoized(...args);
    await setCache(cacheKey, result, ttl);
    return result;
  }) as T;
}

/**
 * Cache wrapper for async functions
 */
export function withCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: {
    keyPrefix: string;
    ttl?: number;
    keyGenerator?: (...args: Parameters<T>) => string;
  }
): T {
  const { keyPrefix, ttl = CACHE_TTL.MEDIUM, keyGenerator } = options;

  return (async (...args: Parameters<T>) => {
    const key = keyGenerator
      ? `${keyPrefix}:${keyGenerator(...args)}`
      : cacheKeyHash(keyPrefix, args);

    // Try to get from cache
    const cached = await getCache(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn(...args);
    await setCache(key, result, ttl);
    return result;
  }) as T;
}

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, value] of memoryCacheStore.entries()) {
    if (value.expires <= now) {
      memoryCacheStore.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[Cache] Cleaned up ${cleaned} expired entries`);
  }
}, 60000); // Run every minute
