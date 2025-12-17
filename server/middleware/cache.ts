import { Request, Response, NextFunction } from 'express';
import { getCache, setCache, cacheKey, CACHE_TTL } from '../services/cacheService';
import { createHash } from 'crypto';

interface CacheOptions {
  ttl?: number;
  keyGenerator?: (req: Request) => string;
  skipCache?: (req: Request) => boolean;
  varyBy?: string[]; // Headers/query params to vary cache by
}

/**
 * Express middleware for route-level caching
 */
export function cacheMiddleware(options: CacheOptions = {}) {
  const {
    ttl = CACHE_TTL.MEDIUM,
    keyGenerator,
    skipCache = () => false,
    varyBy = [],
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip if skipCache returns true
    if (skipCache(req)) {
      return next();
    }

    // Generate cache key
    let key: string;
    if (keyGenerator) {
      key = keyGenerator(req);
    } else {
      // Default key generation
      const path = req.path;
      const query = new URLSearchParams(req.query as Record<string, string>).toString();
      const varyValues = varyBy.map(header => req.headers[header] || req.query[header] || '').join(':');
      key = cacheKey('route', path, query, varyValues);
    }

    // Try to get from cache
    const cached = await getCache<{ data: any; etag: string }>(key);
    
    if (cached) {
      // Set ETag header
      res.setHeader('ETag', cached.etag);
      res.setHeader('Cache-Control', `public, max-age=${ttl}`);
      
      // Check if client has matching ETag (304 Not Modified)
      const clientEtag = req.headers['if-none-match'];
      if (clientEtag === cached.etag) {
        res.status(304).end();
        return;
      }

      // Return cached data
      res.json(cached.data);
      return;
    }

    // Cache miss - intercept response
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      // Generate ETag from response
      const etag = createHash('md5')
        .update(JSON.stringify(body))
        .digest('hex')
        .slice(0, 16);

      // Store in cache
      setCache(key, { data: body, etag }, ttl).catch(err => {
        console.warn(`[Cache Middleware] Failed to cache response for ${key}:`, err);
      });

      // Set headers
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', `public, max-age=${ttl}`);

      // Send response
      return originalJson(body);
    };

    next();
  };
}

/**
 * Helper to generate cache keys for common patterns
 */
export function generateCacheKey(prefix: string, req: Request, includeQuery = true): string {
  const parts = [prefix, req.path];
  
  if (includeQuery && Object.keys(req.query).length > 0) {
    const queryStr = new URLSearchParams(req.query as Record<string, string>).toString();
    parts.push(queryStr);
  }

  // Include user ID if authenticated
  const user = req.user as Express.User | undefined;
  if (user?.id) {
    parts.push(`user:${user.id}`);
  }

  return cacheKey(...parts);
}
